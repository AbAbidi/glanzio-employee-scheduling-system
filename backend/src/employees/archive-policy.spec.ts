import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmployeesService } from './employees.service';
import { ClientsService } from '../clients/clients.service';

function harness(openAssignments = 0) {
  const employee = {
    id: 'employee',
    userId: 'user',
    user: { status: 'ACTIVE' },
  };
  const client = { id: 'client', _count: { sites: 2 } };
  const tx = {
    workAssignment: { count: jest.fn().mockResolvedValue(openAssignments) },
    employee: {
      update: jest.fn().mockResolvedValue({ ...employee, active: false }),
    },
    user: { update: jest.fn().mockResolvedValue({}) },
    refreshSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    accountInvitation: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    cleaningSite: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    client: {
      update: jest.fn().mockResolvedValue({ ...client, active: false }),
    },
  };
  const prisma = {
    employee: { findUnique: jest.fn().mockResolvedValue(employee) },
    client: { findUnique: jest.fn().mockResolvedValue(client) },
    $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  return {
    tx,
    audit,
    employees: new EmployeesService(
      prisma as never,
      audit as never,
      new ConfigService(),
    ),
    clients: new ClientsService(prisma as never, audit as never),
  };
}

describe('reversible archive policy', () => {
  it('blocks employee archiving before changing access when work is still open', async () => {
    const { employees, tx, audit } = harness(2);
    await expect(employees.archive('admin', 'employee')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.employee.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
    expect(tx.workAssignment.count).toHaveBeenCalledWith({
      where: {
        employees: { some: { employeeId: 'employee' } },
        status: { in: ['DRAFT', 'SCHEDULED'] },
        endAt: { gt: expect.any(Date) as Date },
      },
    });
  });
  it('archives by disabling access only, retaining work, credit and PDF records', async () => {
    const { employees, tx, audit } = harness();
    await employees.archive('admin', 'employee');
    expect(tx.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: false } }),
    );
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user' },
      data: { status: 'INACTIVE' },
    });
    expect(tx.refreshSession.updateMany).toHaveBeenCalled();
    expect(tx.accountInvitation.updateMany).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EMPLOYEE_ARCHIVED' }),
    );
    // No assignment, statement, movement or PDF update/delete methods exist in this harness.
  });
  it('blocks client archiving while any site has open work', async () => {
    const { clients, tx } = harness(1);
    await expect(clients.archive('admin', 'client')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.cleaningSite.updateMany).not.toHaveBeenCalled();
    expect(tx.client.update).not.toHaveBeenCalled();
  });
  it('archives client sites, not historical assignments or employee earnings', async () => {
    const { clients, tx, audit } = harness();
    await clients.archive('admin', 'client');
    expect(tx.cleaningSite.updateMany).toHaveBeenCalledWith({
      where: { clientId: 'client' },
      data: { active: false },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CLIENT_ARCHIVED',
        metadata: { sitesArchived: 2 },
      }),
    );
  });
  it('status endpoints cannot bypass the archive checks', async () => {
    const { clients, employees } = harness(1);
    await expect(
      clients.setStatus('admin', 'client', { active: false }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      employees.setStatus('admin', 'employee', { active: false }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
