/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Owner / manager / employee boundaries (disposable PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: string, manager: string, worker: string;
  let managerId: string,
    managerUserId: string,
    workerId: string,
    clientId: string,
    siteId: string,
    archivedEmployeeId: string,
    archivedClientId: string;
  let managerCookie: string;
  const password = 'Isolated-Test-Password-2026';
  const managerEmail = `${randomUUID()}@manager.example.invalid`;
  const api = (token: string) => ({
    get: (path: string) =>
      request(app.getHttpServer())
        .get(`/api/v1/${path}`)
        .auth(token, { type: 'bearer' }),
    post: (path: string) =>
      request(app.getHttpServer())
        .post(`/api/v1/${path}`)
        .auth(token, { type: 'bearer' }),
    patch: (path: string) =>
      request(app.getHttpServer())
        .patch(`/api/v1/${path}`)
        .auth(token, { type: 'bearer' }),
    delete: (path: string) =>
      request(app.getHttpServer())
        .delete(`/api/v1/${path}`)
        .auth(token, { type: 'bearer' }),
  });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    const email = `${randomUUID()}@owner.example.invalid`;
    await prisma.user.create({
      data: {
        email,
        role: 'ADMIN',
        status: 'ACTIVE',
        passwordHash: await argon2.hash(password),
      },
    });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: email, password })
      .expect(200);
    owner = login.body.accessToken as string;
    const result = await api(owner)
      .post('employees')
      .send({
        firstName: 'Manager',
        lastName: 'Test',
        email: managerEmail,
        role: 'MANAGER',
        hourlyRate: 15,
      })
      .expect(201);
    managerId = result.body.employee.id as string;
    managerUserId = result.body.employee.userId as string;
    const invitation = new URL(
      result.body.invitation.invitationUrl as string,
    ).searchParams.get('invitation');
    await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invitation')
      .send({ token: invitation, newPassword: password })
      .expect(200);
    const signedIn = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: result.body.employee.loginCode as string, password })
      .expect(200);
    manager = signedIn.body.accessToken as string;
    managerCookie = (
      signedIn.headers['set-cookie'] as unknown as string[]
    )[0].split(';')[0];
    const employee = await prisma.employee.create({
      data: {
        firstName: 'Worker',
        lastName: 'Test',
        user: {
          create: {
            role: 'EMPLOYEE',
            status: 'ACTIVE',
            passwordHash: await argon2.hash(password),
          },
        },
      },
    });
    workerId = employee.id;
    const workerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: employee.loginCode, password })
      .expect(200);
    worker = workerLogin.body.accessToken as string;
    const archived = await prisma.employee.create({
      data: {
        firstName: 'Archived',
        lastName: 'Test',
        active: false,
        user: { create: { role: 'EMPLOYEE', status: 'INACTIVE' } },
      },
    });
    archivedEmployeeId = archived.id;
    const archivedClient = await prisma.client.create({
      data: { companyName: 'Archived fixture', active: false },
    });
    archivedClientId = archivedClient.id;
  }, 60_000);
  afterAll(async () => {
    await app?.close();
  });

  it('manager logs in by ID only, has a standard work profile and business dashboard', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: managerEmail, password })
      .expect(401);
    const profile = await api(manager).get('employees/me').expect(200);
    expect(profile.body.isStudent).toBe(false);
    const dashboard = await api(manager).get('dashboard').expect(200);
    expect(dashboard.body.role).toBe('MANAGER');
    expect(dashboard.body.maintenanceEnabled).toBe(false);
  });
  it('manager can create clients, sites and ordinary employees and assign work to self', async () => {
    const client = await api(manager)
      .post('clients')
      .send({ companyName: 'Manager client' })
      .expect(201);
    clientId = client.body.id as string;
    const site = await api(manager)
      .post('sites')
      .send({
        clientId,
        name: 'Office',
        addressLine1: 'Teststrasse 1',
        city: 'Konstanz',
        countryCode: 'DE',
      })
      .expect(201);
    siteId = site.body.id as string;
    await api(manager)
      .post('employees')
      .send({ firstName: 'New', lastName: 'Worker' })
      .expect(201);
    await api(manager)
      .patch(`employees/${workerId}`)
      .send({ phone: '12345' })
      .expect(200);
    const assignment = await api(manager)
      .post('assignments')
      .send({
        siteId,
        title: 'Manager own work',
        clientCharge: 50,
        startAt: '2027-06-07T08:00:00Z',
        endAt: '2027-06-07T10:00:00Z',
        employeeIds: [managerId],
        status: 'SCHEDULED',
      })
      .expect(201);
    await api(manager)
      .patch(`assignments/${assignment.body.assignment.id}`)
      .send({ title: 'Updated work' })
      .expect(200);
    await api(manager).get('employees').expect(200);
    await api(manager).get('clients').expect(200);
    await api(manager).get('calendar').expect(200);
    await api(manager).get(`employees/${workerId}/analytics`).expect(200);
    await api(manager).get('reports/monthly?month=2026-10').expect(200);
    await api(manager)
      .get(
        `reports/monthly-payment-statement?month=2026-10&employeeId=${workerId}`,
      )
      .expect(200)
      .expect('Content-Type', /pdf/);
  });
  it.each([
    'audit-logs',
    'feedback',
    'dashboard/archive-analysis?month=2026-10',
    'employees?active=false',
    'clients?active=false',
    'sites?active=false',
    'dashboard/reset-test-workspace/preview',
    'dashboard/reset-operational-data/preview',
  ])('denies owner-only GET %s', async (path) => {
    await api(manager).get(path).expect(403);
  });
  it('blocks archive/status mutations, account resets and privilege escalation', async () => {
    await api(manager).delete(`employees/${workerId}`).expect(403);
    await api(manager)
      .patch(`employees/${workerId}/status`)
      .send({ active: false })
      .expect(403);
    await api(manager).delete(`clients/${clientId}`).expect(403);
    await api(manager)
      .patch(`sites/${siteId}/status`)
      .send({ active: false })
      .expect(403);
    await api(manager)
      .post(`employees/${workerId}/reset-password`)
      .send({ newPassword: password })
      .expect(403);
    await api(manager).post(`employees/${workerId}/invitation`).expect(403);
    await api(manager)
      .patch(`employees/${workerId}/access-role`)
      .send({ role: 'MANAGER' })
      .expect(403);
    await api(manager)
      .post('employees')
      .send({ firstName: 'Forbidden', lastName: 'Manager', role: 'MANAGER' })
      .expect(403);
    await api(manager)
      .patch(`employees/${managerId}`)
      .send({ firstName: 'Hijacked' })
      .expect(403);
    await api(owner)
      .patch(`employees/${managerId}`)
      .send({ isStudent: true })
      .expect(400);
    await api(owner)
      .patch(`employees/${workerId}/access-role`)
      .send({ role: 'ADMIN' })
      .expect(400);
  });
  it('blocks direct archived IDs, analytics and exports, not just archive navigation', async () => {
    await api(manager).get(`employees/${archivedEmployeeId}`).expect(404);
    await api(manager)
      .get(`employees/${archivedEmployeeId}/analytics`)
      .expect(404);
    await api(manager).get(`clients/${archivedClientId}/overview`).expect(404);
    await api(manager)
      .get(
        `reports/monthly-payment-statement?month=2026-10&employeeId=${archivedEmployeeId}`,
      )
      .expect(404);
  });
  it('ordinary employees remain restricted and owner retains archive/log/feedback access', async () => {
    for (const path of ['employees', 'clients', 'audit-logs', 'feedback'])
      await api(worker).get(path).expect(403);
    await api(worker).post('assignments').send({}).expect(403);
    for (const path of [
      'employees?active=false',
      'clients?active=false',
      'audit-logs',
      'feedback',
    ])
      await api(owner).get(path).expect(200);
  });
  it('revokes old JWT and refresh sessions atomically when owner removes manager access', async () => {
    await api(owner)
      .patch(`employees/${managerId}/access-role`)
      .send({ role: 'EMPLOYEE' })
      .expect(200);
    await api(manager).get('dashboard').expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', managerCookie)
      .expect(401);
    const saved = await prisma.user.findUniqueOrThrow({
      where: { id: managerUserId },
    });
    expect(saved.authVersion).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { entityId: managerUserId, action: 'ACCESS_ROLE_CHANGED' },
      }),
    ).toBe(1);
  });

  it('owner promotion is explicit, audited, idempotent and preserves the existing employee record', async () => {
    const before = await prisma.employee.findUniqueOrThrow({
      where: { id: workerId },
    });
    await api(owner)
      .patch(`employees/${workerId}/access-role`)
      .send({ role: 'MANAGER' })
      .expect(200);
    await api(owner)
      .patch(`employees/${workerId}/access-role`)
      .send({ role: 'MANAGER' })
      .expect(200);
    const after = await prisma.employee.findUniqueOrThrow({
      where: { id: workerId },
      include: { user: true },
    });
    expect(after.id).toBe(before.id);
    expect(after.loginCode).toBe(before.loginCode);
    expect(after.userId).toBe(before.userId);
    expect(after.user.authVersion).toBe(1);
    expect(after.user.role).toBe('MANAGER');
    expect(
      await prisma.auditLog.count({
        where: { entityId: after.userId, action: 'ACCESS_ROLE_CHANGED' },
      }),
    ).toBe(1);
    await api(worker).get('employees/me').expect(401);
    await api(owner)
      .post('employees')
      .send({
        firstName: 'Invalid',
        lastName: 'Student manager',
        role: 'MANAGER',
        isStudent: true,
      })
      .expect(400);
  });

  it('owner-only non-production test reset leaves no orphan manager login and preserves owner access (disposable DB only)', async () => {
    expect(process.env.E2E_DATABASE_URL).toBe(process.env.DATABASE_URL);
    expect(new URL(process.env.E2E_DATABASE_URL!).pathname).toMatch(
      /(?:_ci|_test|esms_audit_\d{8}_[a-f0-9]{12})$/,
    );
    await api(owner)
      .post('dashboard/reset-test-workspace')
      .send({ confirmation: 'RESET TEST WORKSPACE' })
      .expect(201);
    expect(await prisma.employee.count()).toBe(0);
    expect(
      await prisma.user.count({
        where: { role: { in: ['EMPLOYEE', 'MANAGER'] } },
      }),
    ).toBe(0);
    await api(owner).get('auth/me').expect(200);
  });
});
