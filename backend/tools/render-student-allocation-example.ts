// Fictional, offline visual QA. Does not connect to the database.
import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { allocateStudentMonth, nextWeekUsage, type CreditLot, type StudentAccounting } from '../src/reports/student-accounting';
import { PaymentStatementPdfService, type EmployeePaymentStatement } from '../src/reports/payment-statement-pdf.service';

const zone = 'Europe/Paris';
function source(date: string, hours: number, hour = 9): CreditLot {
  const start = DateTime.fromISO(`${date}T${String(hour).padStart(2, '0')}:00`, { zone });
  return { key: `fictional-${date}`, assignmentId: `fictional-${date}`, title: 'Fictional COMPLETED work', originMonth: date.slice(0, 7), sourceStart: start.toUTC().toISO()!, sourceEnd: start.plus({ hours }).toUTC().toISO()!, minutes: hours * 60, hourlyRate: 20 };
}
async function main() {
  const october = allocateStudentMonth({ month: '2026-10', zone, employeeName: 'Fictional Test Student', sources: [source('2026-10-26', 4), source('2026-10-27', 4), source('2026-10-29', 4)] });
  const november = allocateStudentMonth({ month: '2026-11', zone, employeeName: 'Fictional Test Student', sources: [source('2026-11-03', 4, 14)], carryIn: october.carryOut, previousWeeks: nextWeekUsage(october), busyIntervals: [{ startAt: '2026-11-02T07:00:00.000Z', endAt: '2026-11-02T11:00:00.000Z' }] });
  const service = new PaymentStatementPdfService(new ConfigService({ SYSTEM_TIME_ZONE: zone, PAYROLL_COMPANY_LEGAL_NAME: 'Glanzio - FICTIONAL TEST' }));
  const output = resolve('../tmp/pdfs/student-accounting-v4');
  await mkdir(output, { recursive: true });
  for (const data of [october, november]) {
    const statement: EmployeePaymentStatement = {
      statementNumber: `FICTIONAL-${data.month}`, monthLabel: data.month,
      employee: { firstName: 'Fictional', lastName: 'Test Student', email: 'fictional@example.invalid', phone: null, active: true, isStudent: true, defaultHourlyRate: 20 },
      lines: [], totals: { completedMinutes: data.workedMinutes, payableMinutes: data.creditedMinutes, deferredMinutes: data.carryOutMinutes, grossAmount: data.creditedAmount },
      studentSimulation: { ...data, status: 'DRAFT' },
    };
    const file = resolve(output, `fictional-${data.month}.pdf`);
    await writeFile(file, await service.build([statement], data.month));
    console.log(JSON.stringify({ file, worked: data.workedMinutes / 60, credited: data.creditedMinutes / 60, carry: data.carryOutMinutes / 60, allocations: data.allocations }));
  }
}
void main();
