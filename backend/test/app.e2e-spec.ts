/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserRole, UserStatus } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ESMS API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminUserId: string;
  let employeeUserId: string | undefined;
  let employeeId: string | undefined;
  let clientId: string | undefined;
  let siteId: string | undefined;
  let assignmentId: string | undefined;
  let recurringTemplateId: string | undefined;
  let adminAccessToken: string;
  let employeeAccessToken: string;
  let employeeInvitationToken: string;

  const suffix = randomUUID();
  const adminEmail = `admin-${suffix}@e2e.local`;
  const employeeEmail = `employee-${suffix}@e2e.local`;
  const adminPassword = 'Admin-E2E-Password-2026';
  const employeePassword = 'Employee-E2E-Password-2026';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
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
    const passwordHash = await argon2.hash(adminPassword, {
      type: argon2.argon2id,
    });
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
    adminUserId = admin.id;
  });

  it('reports health and database readiness', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({
        status: 'ok',
        service: 'esms-backend',
      });

    await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200)
      .expect({
        status: 'ready',
        service: 'esms-backend',
        database: 'reachable',
      });
  });

  it('rejects invalid login input and unknown credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: '' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: `missing-${suffix}@e2e.local`,
        password: adminPassword,
      })
      .expect(401);
  });

  it('completes the protected operational workflow', async () => {
    const adminAgent = request.agent(app.getHttpServer());
    const adminLogin = await adminAgent
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);

    adminAccessToken = adminLogin.body.accessToken as string;
    expect(adminLogin.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(adminLogin.body.user.role).toBe(UserRole.ADMIN);

    const employeeResponse = await adminAgent
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        email: employeeEmail,
        firstName: 'E2E',
        lastName: 'Employee',
        isStudent: true,
      })
      .expect(201);

    employeeId = employeeResponse.body.employee.id as string;
    employeeUserId = employeeResponse.body.employee.user.id as string;
    expect(employeeResponse.body.employee.user.status).toBe(UserStatus.INVITED);
    const invitationUrl = employeeResponse.body.invitation
      .developmentInvitationUrl as string;
    employeeInvitationToken = new URL(invitationUrl).searchParams.get(
      'invitation',
    ) as string;
    expect(employeeInvitationToken).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: employeeEmail, password: employeePassword })
      .expect(403);

    const employeeAcceptance = await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invitation')
      .send({
        token: employeeInvitationToken,
        newPassword: employeePassword,
      })
      .expect(200);
    employeeAccessToken = employeeAcceptance.body.accessToken as string;
    expect(employeeAcceptance.body.user.status).toBe(UserStatus.ACTIVE);

    await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invitation')
      .send({
        token: employeeInvitationToken,
        newPassword: employeePassword,
      })
      .expect(401);

    const clientResponse = await adminAgent
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        companyName: `E2E Client ${suffix}`,
        contactName: 'E2E Contact',
      })
      .expect(201);
    clientId = clientResponse.body.id as string;

    const siteResponse = await adminAgent
      .post('/api/v1/sites')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        clientId,
        name: `E2E Site ${suffix}`,
        addressLine1: '1 Test Street',
        city: 'Paris',
        countryCode: 'FR',
        estimatedDurationMinutes: 120,
        requiredEquipment: ['vacuum'],
      })
      .expect(201);
    siteId = siteResponse.body.id as string;

    const assignmentResponse = await adminAgent
      .post('/api/v1/assignments')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        siteId,
        title: 'E2E Cleaning Assignment',
        startAt: '2030-05-15T08:00:00.000Z',
        endAt: '2030-05-15T10:00:00.000Z',
        clientCharge: 240,
        employeeIds: [employeeId],
      })
      .expect(201);
    assignmentId = assignmentResponse.body.assignment.id as string;
    expect(assignmentResponse.body.studentWarnings).toEqual([]);

    await adminAgent
      .post('/api/v1/assignments')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        siteId,
        title: 'Overlapping Assignment',
        startAt: '2030-05-15T09:00:00.000Z',
        endAt: '2030-05-15T11:00:00.000Z',
        clientCharge: 180,
        employeeIds: [employeeId],
      })
      .expect(409);

    const reportResponse = await adminAgent
      .get(`/api/v1/reports/monthly?month=2030-05&employeeId=${employeeId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(reportResponse.body.terminology).toBe('planned-hours');
    expect(reportResponse.body.items[0].plannedMinutes).toBe(120);
    expect(reportResponse.body.items[0].warning).toBeNull();

    const recurringResponse = await adminAgent
      .post('/api/v1/recurring-assignments')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        siteId,
        title: 'E2E Recurring Student Schedule',
        frequency: 'DAILY',
        interval: 1,
        firstStartAt: '2030-05-01T12:00:00.000Z',
        durationMinutes: 240,
        occurrenceCount: 21,
        clientCharge: 320,
        employeeIds: [employeeId],
      })
      .expect(201);
    recurringTemplateId = recurringResponse.body.id as string;
    expect(recurringResponse.body.generatedAssignmentCount).toBe(21);

    const warningReport = await adminAgent
      .get(`/api/v1/reports/monthly?month=2030-05&employeeId=${employeeId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(warningReport.body.items[0].plannedMinutes).toBe(5160);
    expect(warningReport.body.items[0].warning).toEqual({
      thresholdMinutes: 4800,
      exceededByMinutes: 360,
      assignmentBlocked: false,
    });

    const employeeAssignments = await request(app.getHttpServer())
      .get('/api/v1/assignments')
      .set('Authorization', `Bearer ${employeeAccessToken}`)
      .expect(200);
    expect(employeeAssignments.body.total).toBe(22);
    expect(
      employeeAssignments.body.items.some(
        (assignment: { id: string }) => assignment.id === assignmentId,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${employeeAccessToken}`)
      .send({ companyName: 'Forbidden client' })
      .expect(403);

    const notifications = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${employeeAccessToken}`)
      .expect(200);
    expect(notifications.body.unread).toBeGreaterThanOrEqual(1);

    await adminAgent
      .post(`/api/v1/assignments/${assignmentId}/cancel`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ reason: 'E2E cleanup cancellation' })
      .expect(201)
      .expect((response) => {
        expect(response.body.status).toBe('CANCELLED');
      });

    const resetPreview = await adminAgent
      .get('/api/v1/dashboard/reset-operational-data/preview')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(200);
    expect(resetPreview.body.assignments).toBeGreaterThanOrEqual(22);
    expect(resetPreview.body.recurringSchedules).toBeGreaterThanOrEqual(1);

    await adminAgent
      .post('/api/v1/dashboard/reset-operational-data')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ confirmation: 'wrong phrase' })
      .expect(400);

    const refreshed = await adminAgent.post('/api/v1/auth/refresh').expect(200);
    expect(refreshed.body.accessToken).toEqual(expect.any(String));

    await adminAgent.post('/api/v1/auth/logout').expect(204);
  });

  afterAll(async () => {
    if (prisma) {
      const userIds = [adminUserId, employeeUserId].filter((id): id is string =>
        Boolean(id),
      );

      if (userIds.length) {
        await prisma.notification.deleteMany({
          where: { userId: { in: userIds } },
        });
        await prisma.auditLog.deleteMany({
          where: { actorUserId: { in: userIds } },
        });
        await prisma.refreshSession.deleteMany({
          where: { userId: { in: userIds } },
        });
        await prisma.passwordResetToken.deleteMany({
          where: { userId: { in: userIds } },
        });
        await prisma.accountInvitation.deleteMany({
          where: { userId: { in: userIds } },
        });
      }

      if (assignmentId) {
        await prisma.workAssignment.deleteMany({
          where: { id: assignmentId },
        });
      }
      if (recurringTemplateId) {
        await prisma.workAssignment.deleteMany({
          where: { recurringTemplateId },
        });
        await prisma.recurringTemplate.deleteMany({
          where: { id: recurringTemplateId },
        });
      }
      if (employeeId) {
        await prisma.employee.deleteMany({ where: { id: employeeId } });
      }
      if (employeeUserId) {
        await prisma.user.deleteMany({ where: { id: employeeUserId } });
      }
      if (siteId) {
        await prisma.cleaningSite.deleteMany({ where: { id: siteId } });
      }
      if (clientId) {
        await prisma.client.deleteMany({ where: { id: clientId } });
      }
      if (adminUserId) {
        await prisma.user.deleteMany({ where: { id: adminUserId } });
      }
    }

    await app?.close();
  });
});
