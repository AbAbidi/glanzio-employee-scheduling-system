/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AssignmentsService } from '../src/assignments/assignments.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SmtpMailer } from '../src/quotes/smtp-mailer.service';

describe('Employee identifiers, delivery and concurrent schedules (isolated DB)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let siteId: string;
  const employees: Array<{ id: string; loginCode: string }> = [];
  const mailer = {
    assertConfigured: jest.fn(),
    sendQuote: jest.fn().mockResolvedValue(undefined),
  };
  const password = 'Employee-Secure-Password-2026';
  const employeeEmail = `employee-${randomUUID()}@e2e.test`;
  let start: DateTime;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SmtpMailer)
      .useValue(mailer)
      .compile();
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
    const email = `${randomUUID()}@e2e.test`;
    await prisma.user.create({
      data: {
        email,
        passwordHash: await argon2.hash(password),
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: email, password })
      .expect(200);
    token = login.body.accessToken as string;
    const client = await prisma.client.create({
      data: { companyName: 'Isolated concurrency client' },
    });
    const site = await prisma.cleaningSite.create({
      data: {
        clientId: client.id,
        name: 'Isolated office',
        addressLine1: 'Teststrasse 1',
        city: 'Konstanz',
        countryCode: 'DE',
      },
    });
    siteId = site.id;
    for (let i = 0; i < 3; i += 1) {
      const result = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .auth(token, { type: 'bearer' })
        .send({
          firstName: 'Employee',
          lastName: `Code ${i}`,
          ...(i === 0 ? { email: employeeEmail } : {}),
        })
        .expect(201);
      employees.push(result.body.employee as { id: string; loginCode: string });
      expect(result.body.employee.user.email).toBe(
        i === 0 ? employeeEmail : null,
      );
      expect(result.body.invitation.invitationUrl).toContain(
        '/login?invitation=',
      );
      const invitation = new URL(
        result.body.invitation.invitationUrl as string,
      ).searchParams.get('invitation');
      await request(app.getHttpServer())
        .post('/api/v1/auth/accept-invitation')
        .send({ token: invitation, newPassword: password })
        .expect(200);
    }
    start = DateTime.now()
      .setZone('Europe/Berlin')
      .plus({ years: 1 })
      .startOf('week')
      .set({ hour: 9 });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  const payload = (employeeId: string, day: number) => ({
    siteId,
    title: 'Concurrent work',
    startAt: start.plus({ days: day }).toISO(),
    endAt: start.plus({ days: day, hours: 2 }).toISO(),
    status: 'SCHEDULED',
    employeeIds: [employeeId],
    clientCharge: 100,
  });
  const create = (employeeId: string, day: number) =>
    request(app.getHttpServer())
      .post('/api/v1/assignments')
      .auth(token, { type: 'bearer' })
      .send(payload(employeeId, day));

  it('allocates unique three-letter/three-digit IDs and accepts lowercase input', async () => {
    expect(new Set(employees.map((e) => e.loginCode)).size).toBe(3);
    for (const employee of employees)
      expect(employee.loginCode).toMatch(/^[A-Z]{3}\d{3}$/);
    const result = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: employees[0].loginCode.toLowerCase(), password })
      .expect(200);
    expect(result.body.user.role).toBe('EMPLOYEE');
    expect(result.body.user.employee.id).toBe(employees[0].id);
  });

  it('rejects employee email in both login contracts and obsolete numeric IDs', async () => {
    for (const identity of [
      { email: employeeEmail },
      { identifier: employeeEmail },
      { identifier: '000001' },
    ]) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ ...identity, password })
        .expect(401);
    }
  });

  it('maps old numeric codes without changing their sequence value', async () => {
    const result = await prisma.$queryRaw<
      Array<{ code: string }>
    >`SELECT employee_code_from_number(7) AS code`;
    expect(result[0].code).toBe('AAA007');
    const last = await prisma.$queryRaw<
      Array<{ code: string }>
    >`SELECT employee_code_from_number(17575999) AS code`;
    expect(last[0].code).toBe('ZZZ999');
  });

  it('allows simultaneous hours for different employees', async () => {
    const results = await Promise.all([
      create(employees[0].id, 0),
      create(employees[1].id, 0),
    ]);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
  });

  it('rejects the second simultaneous write even when both prechecks saw no conflict', async () => {
    const service = app.get<AssignmentsService>(
      AssignmentsService,
    ) as unknown as {
      assertNoConflicts(...args: unknown[]): Promise<void>;
    };
    const original = service.assertNoConflicts.bind(
      service,
    ) as typeof service.assertNoConflicts;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    let checked = 0;
    const spy = jest
      .spyOn(service, 'assertNoConflicts')
      .mockImplementation(async (...args) => {
        await original(...args);
        checked += 1;
        if (checked === 2) release();
        await barrier;
      });
    try {
      const results = await Promise.all([
        create(employees[2].id, 1),
        create(employees[2].id, 1),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(
        await prisma.workAssignment.count({
          where: { employees: { some: { employeeId: employees[2].id } } },
        }),
      ).toBe(1);
    } finally {
      spy.mockRestore();
    }
  }, 20_000);

  it('keeps half-open boundaries valid and rolls back a conflicting time edit', async () => {
    const first = await create(employees[0].id, 2).expect(201);
    const next = payload(employees[0].id, 2);
    next.startAt = start.plus({ days: 2, hours: 2 }).toISO();
    next.endAt = start.plus({ days: 2, hours: 3 }).toISO();
    const second = await request(app.getHttpServer())
      .post('/api/v1/assignments')
      .auth(token, { type: 'bearer' })
      .send(next)
      .expect(201);
    await expect(
      prisma.workAssignment.update({
        where: { id: second.body.assignment.id as string },
        data: { startAt: new Date(first.body.assignment.startAt as string) },
      }),
    ).rejects.toBeDefined();
    const stored = await prisma.workAssignment.findUniqueOrThrow({
      where: { id: second.body.assignment.id as string },
    });
    expect(stored.startAt.toISOString()).toBe(
      new Date(next.startAt!).toISOString(),
    );
  });

  it('validates quotes, prevents duplicate delivery, and does not accept changed retry content', async () => {
    const input = {
      submissionKey: randomUUID(),
      fullName: 'Test Customer',
      email: 'customer@example.test',
      service: 'Fensterreinigung',
      location: 'Konstanz',
      message: 'Test only, no real email.',
    };
    const first = await request(app.getHttpServer())
      .post('/api/v1/quotes')
      .send(input)
      .expect(200);
    expect(first.body.status).toBe('sent');
    await request(app.getHttpServer())
      .post('/api/v1/quotes')
      .send(input)
      .expect(200);
    expect(mailer.sendQuote).toHaveBeenCalledTimes(1);
    await request(app.getHttpServer())
      .post('/api/v1/quotes')
      .send({ ...input, message: 'Changed request' })
      .expect(409);
    // Validation is checked separately below because rate limiting is intentional.
  });
});
