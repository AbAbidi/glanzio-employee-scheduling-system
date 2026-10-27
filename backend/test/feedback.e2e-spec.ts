/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserRole, UserStatus } from '../src/generated/prisma/client';

describe('public feedback and admin moderation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let employeeToken: string;
  const userIds: string[] = [];
  const keys = [randomUUID(), randomUUID()];
  const suffix = randomUUID();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);
    const secret = app
      .get(ConfigService)
      .getOrThrow<string>('JWT_ACCESS_SECRET');
    for (const role of [UserRole.ADMIN, UserRole.EMPLOYEE]) {
      const user = await prisma.user.create({
        data: {
          email: `feedback-${role}-${suffix}@example.invalid`,
          role,
          status: UserStatus.ACTIVE,
        },
      });
      userIds.push(user.id);
      const token = await jwt.signAsync(
        { sub: user.id, email: user.email, role },
        { secret, expiresIn: '5m' },
      );
      if (role === UserRole.ADMIN) adminToken = token;
      else employeeToken = token;
    }
  });

  it('keeps submissions private until consent and admin approval, then allows unpublishing', async () => {
    const privateBody = {
      submissionKey: keys[0],
      displayName: `Private fixture ${suffix}`,
      message: 'Private QA feedback, removed after this test.',
      allowPublic: false,
    };
    const publicBody = {
      ...privateBody,
      submissionKey: keys[1],
      displayName: `Public fixture ${suffix}`,
      allowPublic: true,
      rating: 5,
    };
    const privateResult = await request(app.getHttpServer())
      .post('/api/v1/feedback')
      .send(privateBody)
      .expect(202);
    const submitted = await request(app.getHttpServer())
      .post('/api/v1/feedback')
      .send(publicBody)
      .expect(202);
    const repeated = await request(app.getHttpServer())
      .post('/api/v1/feedback')
      .send(publicBody)
      .expect(202);
    expect(repeated.body.id).toBe(submitted.body.id);
    expect(
      await prisma.feedback.count({ where: { submissionKey: { in: keys } } }),
    ).toBe(2);
    const before = await request(app.getHttpServer())
      .get('/api/v1/feedback/published')
      .expect(200);
    expect(
      before.body.some((row: { id: string }) =>
        [privateResult.body.id, submitted.body.id].includes(row.id),
      ),
    ).toBe(false);
    await request(app.getHttpServer()).get('/api/v1/feedback').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/feedback')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/feedback/${submitted.body.id}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ status: 'PUBLISHED' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/feedback/${privateResult.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PUBLISHED' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/v1/feedback/${submitted.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PUBLISHED' })
      .expect(200);
    const after = await request(app.getHttpServer())
      .get('/api/v1/feedback/published')
      .expect(200);
    const published = after.body.find(
      (row: { id: string }) => row.id === submitted.body.id,
    ) as Record<string, unknown>;
    expect(published.message).toBe(publicBody.message);
    expect(published).not.toHaveProperty('submissionKey');
    expect(published).not.toHaveProperty('allowPublic');
    await request(app.getHttpServer())
      .patch(`/api/v1/feedback/${submitted.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PRIVATE' })
      .expect(200);
    const final = await request(app.getHttpServer())
      .get('/api/v1/feedback/published')
      .expect(200);
    expect(
      final.body.some((row: { id: string }) => row.id === submitted.body.id),
    ).toBe(false);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.feedback.deleteMany({
        where: { submissionKey: { in: keys } },
      });
      await prisma.auditLog.deleteMany({
        where: { actorUserId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await app?.close();
  });
});
