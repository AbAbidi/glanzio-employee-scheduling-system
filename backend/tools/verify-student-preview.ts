// Local QA only: creates/refreshes DRAFT simulations; never closes or resets data.
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserRole } from '../src/generated/prisma/client';
import { StudentAccountingService } from '../src/reports/student-accounting.service';
import { PaymentStatementPdfService } from '../src/reports/payment-statement-pdf.service';
import { ReportsService } from '../src/reports/reports.service';
import { AssignmentCompletionService } from '../src/assignments/assignment-completion.service';
import { DashboardService } from '../src/dashboard/dashboard.service';
import { AuditService } from '../src/audit/audit.service';

async function main() {
  const config = new ConfigService(process.env);
  const prisma = new PrismaService(config);
  try {
    const completion = new AssignmentCompletionService(prisma);
    const accounting = new StudentAccountingService(prisma, config, completion);
    const reports = new ReportsService(prisma, config, new PaymentStatementPdfService(config), accounting, completion);
    const dashboard = new DashboardService(prisma, config, reports, new AuditService(prisma), completion);
    const overview = await dashboard.get({ id: 'qa-admin', role: UserRole.ADMIN, email: 'qa@example.invalid' });
    if ('operationsAnalysis' in overview) console.log(JSON.stringify({ monthly: overview.operationsAnalysis.employees.filter((row) => row.month === '2026-10').map((row) => ({ employee: `${row.employee.firstName} ${row.employee.lastName}`, workedHours: row.completedMinutes / 60, creditedHours: row.creditedMinutes / 60 })), weekly: overview.operationsAnalysis.weeklyStudents.items.map((row) => ({ employee: `${row.employee.firstName} ${row.employee.lastName}`, workedHours: row.workedMinutes / 60 })) }));
    const students = await prisma.employee.findMany({ where: { isStudent: true, active: true }, orderBy: { createdAt: 'asc' } });
    const output = resolve('../tmp/pdfs/student-accounting');
    await mkdir(output, { recursive: true });
    for (let index = 0; index < students.length; index += 1) {
      const student = students[index];
      const october = await accounting.period(student.id, '2026-10');
      const november = await accounting.period(student.id, '2026-11');
      if (october.data.carryOutMinutes !== november.data.carryInMinutes) throw new Error('October/November carry mismatch');
      const countBefore = await prisma.studentCreditMovement.count({ where: { statement: { employeeId: student.id } } });
      const again = await accounting.period(student.id, '2026-11');
      const concurrent = await Promise.all(Array.from({ length: 3 }, () => accounting.period(student.id, '2026-11')));
      const countAfter = await prisma.studentCreditMovement.count({ where: { statement: { employeeId: student.id } } });
      if (again.sourceHash !== november.sourceHash || countBefore !== countAfter) throw new Error('Repeat changed the credit ledger');
      if (concurrent.some((result) => result.sourceHash !== november.sourceHash)) throw new Error('Concurrent preview changed the allocation');
      console.log(JSON.stringify({ employee: `${student.firstName} ${student.lastName}`, october: totals(october), november: totals(november), ledgerStable: true }));
      if (index === 0) for (const month of ['2026-10', '2026-11']) {
        const user = { id: 'qa-admin', role: UserRole.ADMIN, email: 'qa@example.invalid' };
        const first = await reports.monthlyPaymentStatement(user, { employeeId: student.id, month });
        const repeat = await reports.monthlyPaymentStatement(user, { employeeId: student.id, month });
        if (!first.buffer.equals(repeat.buffer)) throw new Error('PDF download is not byte-identical');
        const path = resolve(output, `student-simulation-${month}.pdf`);
        await writeFile(path, first.buffer);
        console.log(JSON.stringify({ pdf: path, byteIdentical: true }));
      }
    }
    console.log(JSON.stringify({ studentsChecked: students.length, resetExecuted: false, monthsClosed: false }));
  } finally { await prisma.$disconnect(); }
}
function totals(value: Awaited<ReturnType<StudentAccountingService['period']>>) {
  return { status: value.status, workedHours: value.data.workedMinutes / 60, carryInHours: value.data.carryInMinutes / 60, creditedHours: value.data.creditedMinutes / 60, carryOutHours: value.data.carryOutMinutes / 60 };
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
