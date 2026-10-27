import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import type {
  PaymentStatementLine,
  PaymentStatementTotals,
} from './payment-statement';
import { buildInternalStatementLines } from './payment-statement';
import type { StudentAccounting } from './student-accounting';
import {
  buildWorkTimeSheetDays,
  formatMinutes,
  type WorkTimeSheetDay,
} from './work-time-sheet';

export type EmployeePaymentStatement = {
  studentSimulation?: StudentAccounting & { status: string };
  statementNumber: string;
  monthLabel: string;
  employee: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    active: boolean;
    isStudent: boolean;
    defaultHourlyRate: number | null;
  };
  lines: PaymentStatementLine[];
  totals: PaymentStatementTotals;
};

type TextAlignment = 'left' | 'center' | 'right';

const TEMPLATE_FILENAME = 'stundenzettel-minijob-datev.pdf';
const INK = rgb(0.05, 0.05, 0.05);

@Injectable()
export class PaymentStatementPdfService {
  constructor(private readonly configService: ConfigService) {}

  async build(
    statements: EmployeePaymentStatement[],
    period: string,
  ): Promise<Buffer> {
    const templateBytes = await readFile(
      join(__dirname, 'assets', TEMPLATE_FILENAME),
    );
    const template = await PDFDocument.load(templateBytes);
    const output = await PDFDocument.create();
    const font = await output.embedFont(StandardFonts.Helvetica);
    const boldFont = await output.embedFont(StandardFonts.HelveticaBold);

    output.setTitle(`${this.companyName()} Interne Abrechnung ${period}`);
    output.setAuthor(this.companyName());
    output.setSubject(
      'Interne Abrechnung - kein amtlicher Arbeitszeitnachweis',
    );
    output.setKeywords([
      'Interne Abrechnung',
      'Mitarbeiter',
      'Nicht offiziell',
    ]);
    output.setCreator('Glanzio Reinigung employee scheduling system');
    output.setProducer('Glanzio Reinigung employee scheduling system');

    if (statements.length === 0) {
      const [page] = await output.copyPages(template, [0]);
      output.addPage(page);
      this.fillSharedFields(page, font, period, 'Keine Mitarbeiterdaten');
      this.drawTopText(page, font, '00:00', 237.5, 667, 47, 7.2, 'center');
    } else {
      for (const statement of statements) {
        const [page] = await output.copyPages(template, [0]);
        output.addPage(page);
        this.fillStatement(page, font, boldFont, statement, period);
      }
    }

    return Buffer.from(await output.save());
  }

  private fillStatement(
    page: PDFPage,
    font: PDFFont,
    boldFont: PDFFont,
    statement: EmployeePaymentStatement,
    period: string,
  ) {
    const employeeName =
      statement.studentSimulation?.employeeName ??
      `${statement.employee.firstName} ${statement.employee.lastName}`;
    this.fillSharedFields(page, boldFont, period, employeeName);

    const simulation = statement.studentSimulation;
    const lines = simulation
      ? simulation.allocations.map((row, index) => ({
          id: `simulation-${index}`,
          title: 'SIMULATION',
          clientName: 'Credit allocation',
          siteName: row.originMonth,
          startAt: new Date(row.startAt),
          endAt: new Date(row.endAt),
          durationMinutes: row.minutes,
          payableMinutes: row.minutes,
          deferredMinutes: 0,
          hourlyRate: row.hourlyRate,
          amount: (row.minutes / 60) * row.hourlyRate,
        }))
      : buildInternalStatementLines(statement.lines);
    const days = buildWorkTimeSheetDays(
      lines,
      period,
      simulation?.zone ??
        this.configService.get<string>('SYSTEM_TIME_ZONE', 'Europe/Paris'),
    );
    days.forEach((day) => this.fillDay(page, font, day));

    // Bemerkungen stays empty. No additional banner or footer is added here.

    const totalMinutes = days.reduce(
      (total, day) => total + day.workedMinutes,
      0,
    );
    this.drawTopText(
      page,
      boldFont,
      formatMinutes(totalMinutes),
      237.5,
      667,
      47,
      7.2,
      'center',
    );
  }

  private fillSharedFields(
    page: PDFPage,
    font: PDFFont,
    period: string,
    employeeName: string,
  ) {
    const [year, month] = period.split('-');

    this.drawTopText(page, font, this.companyName(), 201, 51, 214, 8.3);
    this.drawTopText(page, font, employeeName, 201, 68, 214, 8.3);
    this.drawTopText(
      page,
      font,
      `${month}/${year}`,
      309,
      85,
      107,
      8.3,
      'center',
    );
  }

  private fillDay(page: PDFPage, font: PDFFont, day: WorkTimeSheetDay) {
    const rowTop = 138 + (day.day - 1) * 17;
    const values = [
      { text: day.startTime, x: 104, width: 46, align: 'center' as const },
      { text: day.endTime, x: 197, width: 40.5, align: 'center' as const },
      {
        text: formatMinutes(day.workedMinutes),
        x: 237.5,
        width: 47,
        align: 'center' as const,
      },
    ];

    values.forEach(({ text, x, width, align }) => {
      this.drawTopText(page, font, text, x, rowTop + 4.5, width, 6.7, align);
    });
  }

  private drawTopText(
    page: PDFPage,
    font: PDFFont,
    text: string,
    x: number,
    top: number,
    width: number,
    size: number,
    align: TextAlignment = 'left',
    color = INK,
  ) {
    const fittedText = this.fitText(font, text, size, width - 4);
    const textWidth = font.widthOfTextAtSize(fittedText, size);
    const drawX =
      align === 'center'
        ? x + Math.max(2, (width - textWidth) / 2)
        : align === 'right'
          ? x + width - textWidth - 2
          : x + 2;

    page.drawText(fittedText, {
      x: drawX,
      y: page.getHeight() - top - size,
      font,
      size,
      color,
      lineHeight: size,
    });
  }

  private fitText(
    font: PDFFont,
    text: string,
    size: number,
    maxWidth: number,
  ): string {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
    let candidate = text;
    while (
      candidate.length > 0 &&
      font.widthOfTextAtSize(`${candidate}...`, size) > maxWidth
    ) {
      candidate = candidate.slice(0, -1);
    }
    return `${candidate.trimEnd()}...`;
  }

  private companyName() {
    return this.configService.get<string>(
      'PAYROLL_COMPANY_LEGAL_NAME',
      'glanzio-reinigung',
    );
  }
}
