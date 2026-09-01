import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import type {
  PaymentStatementLine,
  PaymentStatementTotals,
} from './payment-statement';

export type EmployeePaymentStatement = {
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

type PdfKitDocument = InstanceType<typeof PDFDocument>;

const COLOURS = {
  navy: '#13233f',
  blue: '#315bea',
  blueSoft: '#eef3ff',
  ink: '#19243a',
  muted: '#64748b',
  line: '#dbe3ef',
  paper: '#ffffff',
  lime: '#c8f45a',
  warning: '#9a5a00',
};

@Injectable()
export class PaymentStatementPdfService {
  constructor(private readonly configService: ConfigService) {}

  async build(
    statements: EmployeePaymentStatement[],
    period: string,
  ): Promise<Buffer> {
    const document = new PDFDocument({
      autoFirstPage: false,
      bufferPages: true,
      margins: { top: 42, right: 42, bottom: 52, left: 42 },
      size: 'A4',
      info: {
        Title: `Clarity Clean monthly employee payment statements - ${period}`,
        Author: this.companyName(),
        Subject: 'Completed-work and operational payment statement',
        Keywords: 'employee, completed hours, payment, monthly statement',
      },
    });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));

    if (statements.length === 0) {
      this.addEmptyPage(document, period);
    } else {
      statements.forEach((statement, index) => {
        if (index > 0) document.addPage();
        this.addStatement(document, statement, index === 0);
      });
    }

    const pages = document.bufferedPageRange();
    for (
      let index = pages.start;
      index < pages.start + pages.count;
      index += 1
    ) {
      document.switchToPage(index);
      this.addFooter(document, index + 1, pages.count);
    }

    document.end();
    return new Promise<Buffer>((resolve, reject) => {
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
    });
  }

  private addStatement(
    document: PdfKitDocument,
    statement: EmployeePaymentStatement,
    firstStatement: boolean,
  ) {
    if (firstStatement) document.addPage();
    this.drawHeader(document, statement);
    this.drawIdentity(document, statement);
    this.drawSummary(document, statement);
    let rowY = this.drawTableHeader(document, 326);

    if (statement.lines.length === 0) {
      document
        .font('Helvetica')
        .fontSize(9)
        .fillColor(COLOURS.muted)
        .text(
          'No completed assignments were recorded for this employee in the selected month.',
          50,
          rowY + 14,
        );
      rowY += 48;
    } else {
      statement.lines.forEach((line) => {
        if (rowY > 675) {
          document.addPage();
          this.drawContinuationHeader(document, statement);
          rowY = this.drawTableHeader(document, 116);
        }
        rowY = this.drawAssignmentRow(document, line, rowY);
      });
    }

    if (rowY > 585) {
      document.addPage();
      this.drawContinuationHeader(document, statement);
      rowY = 116;
    }
    this.drawTotalsAndApproval(document, statement, rowY + 16);
  }

  private drawHeader(
    document: PdfKitDocument,
    statement: EmployeePaymentStatement,
  ) {
    document.roundedRect(42, 42, 511, 88, 12).fill(COLOURS.navy);
    document.roundedRect(58, 58, 48, 48, 12).fill(COLOURS.blue);
    document
      .font('Helvetica-Bold')
      .fontSize(15)
      .fillColor(COLOURS.paper)
      .text('CC', 58, 74, { align: 'center', width: 48 });
    document
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(this.companyName(), 120, 61)
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor('#cbd5e1')
      .text(this.companyAddress(), 120, 82, { width: 220 })
      .text(this.companyRegistration(), 120, 96, { width: 220 });
    document
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(COLOURS.lime)
      .text('MONTHLY EMPLOYEE PAYMENT STATEMENT', 350, 62, {
        align: 'right',
        width: 185,
      })
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLOURS.paper)
      .text(statement.monthLabel, 350, 83, { align: 'right', width: 185 })
      .fillColor('#cbd5e1')
      .text(statement.statementNumber, 350, 99, { align: 'right', width: 185 });
  }

  private drawIdentity(
    document: PdfKitDocument,
    statement: EmployeePaymentStatement,
  ) {
    const employee = statement.employee;
    document
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(COLOURS.blue)
      .text('EMPLOYEE DETAILS', 48, 151);
    document
      .roundedRect(42, 165, 511, 70, 9)
      .fillAndStroke('#f8fafc', COLOURS.line);
    const fullName = `${employee.firstName} ${employee.lastName}`;
    this.labelValue(document, 'Employee', fullName, 56, 177, 145);
    this.labelValue(document, 'Email', employee.email, 214, 177, 165);
    this.labelValue(
      document,
      'Phone',
      employee.phone ?? 'Not provided',
      392,
      177,
      140,
    );
    this.labelValue(
      document,
      'Employment profile',
      employee.isStudent
        ? 'Student employee - 80h payable cap'
        : 'Standard employee',
      56,
      207,
      210,
    );
    this.labelValue(
      document,
      'Base hourly rate',
      employee.defaultHourlyRate === null
        ? 'Not configured'
        : `${employee.defaultHourlyRate.toFixed(2)} ${this.currency()}/h`,
      280,
      207,
      120,
    );
    this.labelValue(
      document,
      'Account',
      employee.active ? 'Active' : 'Inactive',
      414,
      207,
      100,
    );
  }

  private drawSummary(
    document: PdfKitDocument,
    statement: EmployeePaymentStatement,
  ) {
    const items = [
      ['Completed hours', this.hours(statement.totals.completedMinutes)],
      ['Payable hours', this.hours(statement.totals.payableMinutes)],
      ['Deferred over cap', this.hours(statement.totals.deferredMinutes)],
      [
        'Gross operational payment',
        `${statement.totals.grossAmount.toFixed(2)} ${this.currency()}`,
      ],
    ];
    items.forEach(([label, value], index) => {
      const x = 42 + index * 128;
      document
        .roundedRect(x, 251, 119, 58, 8)
        .fill(index === 3 ? COLOURS.navy : COLOURS.blueSoft);
      document
        .font('Helvetica')
        .fontSize(6.7)
        .fillColor(index === 3 ? '#cbd5e1' : COLOURS.muted)
        .text(label, x + 10, 263, { width: 99 })
        .font('Helvetica-Bold')
        .fontSize(index === 3 ? 11 : 13)
        .fillColor(index === 3 ? COLOURS.lime : COLOURS.ink)
        .text(value, x + 10, 281, { width: 99 });
    });
  }

  private drawTableHeader(document: PdfKitDocument, y: number) {
    document.roundedRect(42, y, 511, 24, 5).fill(COLOURS.navy);
    const columns = [
      ['Date', 50, 58],
      ['Assignment / client', 110, 182],
      ['Actual', 298, 52],
      ['Payable', 352, 55],
      ['Rate', 409, 59],
      ['Amount', 470, 74],
    ] as const;
    columns.forEach(([label, x, width]) => {
      document
        .font('Helvetica-Bold')
        .fontSize(6.5)
        .fillColor(COLOURS.paper)
        .text(label, x, y + 8, { width });
    });
    return y + 24;
  }

  private drawAssignmentRow(
    document: PdfKitDocument,
    line: PaymentStatementLine,
    y: number,
  ) {
    const rowHeight = line.deferredMinutes > 0 ? 42 : 34;
    document.rect(42, y, 511, rowHeight).fillAndStroke('#ffffff', COLOURS.line);
    document
      .font('Helvetica')
      .fontSize(7)
      .fillColor(COLOURS.ink)
      .text(this.shortDate(line.startAt), 50, y + 10, { width: 58 })
      .font('Helvetica-Bold')
      .text(line.title, 110, y + 7, { ellipsis: true, width: 182 })
      .font('Helvetica')
      .fontSize(6.2)
      .fillColor(COLOURS.muted)
      .text(`${line.clientName} - ${line.siteName}`, 110, y + 19, {
        ellipsis: true,
        width: 182,
      })
      .font('Helvetica')
      .fontSize(7)
      .fillColor(COLOURS.ink)
      .text(this.hours(line.durationMinutes), 298, y + 10, { width: 52 })
      .text(this.hours(line.payableMinutes), 352, y + 10, { width: 55 })
      .text(`${line.hourlyRate.toFixed(2)} ${this.currency()}`, 409, y + 10, {
        width: 59,
      })
      .font('Helvetica-Bold')
      .text(`${line.amount.toFixed(2)} ${this.currency()}`, 470, y + 10, {
        align: 'right',
        width: 74,
      });
    if (line.deferredMinutes > 0) {
      document
        .font('Helvetica-Bold')
        .fontSize(6.1)
        .fillColor(COLOURS.warning)
        .text(
          `${this.hours(line.deferredMinutes)} above the monthly student cap - excluded from this statement`,
          298,
          y + 27,
          { width: 246 },
        );
    }
    return y + rowHeight;
  }

  private drawTotalsAndApproval(
    document: PdfKitDocument,
    statement: EmployeePaymentStatement,
    y: number,
  ) {
    document
      .roundedRect(42, y, 511, 54, 8)
      .fillAndStroke(COLOURS.blueSoft, COLOURS.line);
    document
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(COLOURS.ink)
      .text('MONTH TOTAL', 56, y + 13)
      .font('Helvetica')
      .fontSize(7)
      .fillColor(COLOURS.muted)
      .text(
        `${statement.lines.length} completed assignment${statement.lines.length === 1 ? '' : 's'}`,
        56,
        y + 29,
      )
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(COLOURS.ink)
      .text(
        `${this.hours(statement.totals.payableMinutes)} payable`,
        312,
        y + 13,
        { align: 'right', width: 100 },
      )
      .fontSize(13)
      .fillColor(COLOURS.blue)
      .text(
        `${statement.totals.grossAmount.toFixed(2)} ${this.currency()}`,
        420,
        y + 12,
        { align: 'right', width: 118 },
      );

    const noteY = y + 69;
    document
      .font('Helvetica-Bold')
      .fontSize(6.7)
      .fillColor(COLOURS.ink)
      .text('IMPORTANT DOCUMENT NOTE', 42, noteY)
      .font('Helvetica')
      .fontSize(6.4)
      .fillColor(COLOURS.muted)
      .text(
        'This operational statement is calculated from completed assignments recorded in Clarity Clean. It does not calculate taxes, deductions, social contributions, leave, or other statutory payroll items. Those fields require company and jurisdiction-specific payroll configuration.',
        42,
        noteY + 13,
        { lineGap: 2, width: 511 },
      );

    const approvalY = noteY + 54;
    this.signatureBox(document, 'EMPLOYER SIGNATURE', 42, approvalY, 158);
    this.signatureBox(document, 'EMPLOYEE SIGNATURE', 218, approvalY, 158);
    this.signatureBox(document, 'COMPANY STAMP', 394, approvalY, 159);
  }

  private drawContinuationHeader(
    document: PdfKitDocument,
    statement: EmployeePaymentStatement,
  ) {
    document
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(COLOURS.navy)
      .text(this.companyName(), 42, 48)
      .fontSize(7)
      .fillColor(COLOURS.blue)
      .text('PAYMENT STATEMENT - CONTINUED', 42, 67)
      .font('Helvetica')
      .fillColor(COLOURS.muted)
      .text(
        `${statement.employee.firstName} ${statement.employee.lastName} | ${statement.monthLabel} | ${statement.statementNumber}`,
        42,
        83,
      );
    document
      .moveTo(42, 101)
      .lineTo(553, 101)
      .strokeColor(COLOURS.line)
      .stroke();
  }

  private addEmptyPage(document: PdfKitDocument, period: string) {
    document.addPage();
    document.roundedRect(42, 42, 511, 88, 12).fill(COLOURS.navy);
    document
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor(COLOURS.paper)
      .text(this.companyName(), 62, 65);
    document
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#cbd5e1')
      .text(`Monthly employee payment statements - ${period}`, 62, 94);
    document
      .font('Helvetica-Bold')
      .fontSize(15)
      .fillColor(COLOURS.ink)
      .text('No employee statements available', 42, 185);
    document
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLOURS.muted)
      .text('No employees matched the requested report scope.', 42, 214);
  }

  private addFooter(
    document: PdfKitDocument,
    page: number,
    totalPages: number,
  ) {
    document
      .moveTo(42, 766)
      .lineTo(553, 766)
      .strokeColor(COLOURS.line)
      .stroke();
    document
      .font('Helvetica')
      .fontSize(6.2)
      .fillColor(COLOURS.muted)
      .text(
        `Generated by Clarity Clean operations | ${this.generatedAt()}`,
        42,
        776,
        { lineBreak: false, width: 390 },
      )
      .text(`Page ${page} of ${totalPages}`, 455, 776, {
        align: 'right',
        lineBreak: false,
        width: 98,
      });
  }

  private labelValue(
    document: PdfKitDocument,
    label: string,
    value: string,
    x: number,
    y: number,
    width: number,
  ) {
    document
      .font('Helvetica')
      .fontSize(6)
      .fillColor(COLOURS.muted)
      .text(label.toUpperCase(), x, y, { width });
    document
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(COLOURS.ink)
      .text(value, x, y + 11, { ellipsis: true, width });
  }

  private signatureBox(
    document: PdfKitDocument,
    label: string,
    x: number,
    y: number,
    width: number,
  ) {
    document.roundedRect(x, y, width, 62, 7).strokeColor(COLOURS.line).stroke();
    document
      .font('Helvetica-Bold')
      .fontSize(6.2)
      .fillColor(COLOURS.muted)
      .text(label, x + 10, y + 10);
    document
      .moveTo(x + 10, y + 45)
      .lineTo(x + width - 10, y + 45)
      .strokeColor(COLOURS.line)
      .stroke();
    document
      .font('Helvetica')
      .fontSize(5.8)
      .fillColor(COLOURS.muted)
      .text('Date', x + 10, y + 49);
  }

  private hours(minutes: number) {
    const wholeHours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder === 0 ? `${wholeHours}h` : `${wholeHours}h ${remainder}m`;
  }

  private shortDate(date: Date) {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
    }).format(date);
  }

  private companyName() {
    return this.configService.get<string>(
      'PAYROLL_COMPANY_LEGAL_NAME',
      'Clarity Clean',
    );
  }

  private companyAddress() {
    return this.configService.get<string>(
      'PAYROLL_COMPANY_ADDRESS',
      'Company address not configured',
    );
  }

  private companyRegistration() {
    const registration = this.configService.get<string>(
      'PAYROLL_COMPANY_REGISTRATION',
      'Not configured',
    );
    return `Company registration: ${registration}`;
  }

  private currency() {
    return this.configService.get<string>('PAYROLL_CURRENCY', 'EUR');
  }

  private generatedAt() {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date());
  }
}
