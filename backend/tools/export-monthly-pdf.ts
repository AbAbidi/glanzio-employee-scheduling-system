// Export one current statement for local visual QA; never closes or resets a month.
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserRole } from '../src/generated/prisma/client';
import { StudentAccountingService } from '../src/reports/student-accounting.service';
import { PaymentStatementPdfService } from '../src/reports/payment-statement-pdf.service';
import { ReportsService } from '../src/reports/reports.service';

async function main() {
  const [employeeId, month, outputFile] = process.argv.slice(2);
  if (!employeeId || !/^\d{4}-\d{2}$/.test(month ?? '') || !outputFile) throw new Error('Usage: export-monthly-pdf.ts <employeeId> <YYYY-MM> <output.pdf>');
  const config = new ConfigService(process.env);
  const prisma = new PrismaService(config);
  try {
    const reports = new ReportsService(prisma, config, new PaymentStatementPdfService(config), new StudentAccountingService(prisma, config));
    const result = await reports.monthlyPaymentStatement({ id: 'local-qa', email: 'qa@example.invalid', role: UserRole.ADMIN }, { ...(employeeId === 'all' ? {} : { employeeId }), month });
    const file = resolve(outputFile);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, result.buffer);
    console.log(JSON.stringify({ file, filename: result.filename, bytes: result.buffer.length, monthsClosed: false }));
  } finally { await prisma.$disconnect(); }
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
