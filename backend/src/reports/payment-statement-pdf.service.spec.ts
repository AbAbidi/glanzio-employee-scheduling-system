import { ConfigService } from '@nestjs/config';
import { PDFDocument, PDFPage } from 'pdf-lib';
import { allocateStudentMonth } from './student-accounting';
import {
  PaymentStatementPdfService,
  type EmployeePaymentStatement,
} from './payment-statement-pdf.service';

function statement(firstName: string): EmployeePaymentStatement {
  return {
    statementNumber: `TEST-${firstName}`,
    monthLabel: 'September 2026',
    employee: {
      firstName,
      lastName: 'Employee',
      email: `${firstName.toLowerCase()}@example.com`,
      phone: null,
      active: true,
      isStudent: false,
      defaultHourlyRate: 20,
    },
    lines: [],
    totals: {
      completedMinutes: 0,
      payableMinutes: 0,
      deferredMinutes: 0,
      grossAmount: 0,
    },
  };
}

describe('PaymentStatementPdfService', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(['DRAFT', 'CLOSED'])(
    'leaves remarks and the top margin empty for a %s simulation',
    async (status) => {
      const drawText = jest.spyOn(PDFPage.prototype, 'drawText');
      const drawRectangle = jest.spyOn(PDFPage.prototype, 'drawRectangle');
      const service = new PaymentStatementPdfService(new ConfigService());
      const data = allocateStudentMonth({
        month: '2026-10',
        zone: 'Europe/Paris',
        employeeName: 'Fictional Student',
        sources: [
          {
            key: 'source',
            assignmentId: 'source',
            title: 'Test assignment',
            originMonth: '2026-10',
            sourceStart: '2026-10-20T07:00:00Z',
            sourceEnd: '2026-10-20T19:00:00Z',
            minutes: 720,
            hourlyRate: 20,
          },
        ],
      });
      const item = statement('Fictional');
      item.studentSimulation = { ...data, status };
      const result = await service.build([item], '2026-10');
      expect((await PDFDocument.load(result)).getPageCount()).toBe(1);
      const texts = drawText.mock.calls.map(([text]) => text);
      expect(
        texts.some(
          (text) =>
            text.includes('ENTWURF / PROJEKTION') ||
            text.startsWith('COMPLETED:') ||
            text.startsWith('Einsatzanteil ') ||
            text.startsWith('Kredit ') ||
            text.startsWith('Arbeit aus Einsaetzen') ||
            text.startsWith('Regel simulation-') ||
            text.startsWith('SIMULATION -'),
        ),
      ).toBe(false);
      expect(
        texts.some((text) => text.includes('keine geleisteten Einsatzzeiten')),
      ).toBe(false);
      expect(
        drawText.mock.calls.filter(
          ([, options]) =>
            (options?.x ?? 0) >= 300 &&
            (options?.y ?? 0) > 170 &&
            (options?.y ?? 0) < 705,
        ),
      ).toHaveLength(0);
      expect(drawRectangle).not.toHaveBeenCalled();
    },
  );
  it('creates one DATEV-style timesheet page per employee', async () => {
    const service = new PaymentStatementPdfService(
      new ConfigService({
        PAYROLL_COMPANY_LEGAL_NAME: 'glanzio-reinigung',
        SYSTEM_TIME_ZONE: 'Europe/Berlin',
      }),
    );

    const buffer = await service.build(
      [statement('Sofia'), statement('Martin')],
      '2026-09',
    );
    const document = await PDFDocument.load(buffer);

    expect(document.getPageCount()).toBe(2);
    expect(document.getTitle()).toBe(
      'glanzio-reinigung Interne Abrechnung 2026-09',
    );
    expect(document.getSubject()).toContain(
      'kein amtlicher Arbeitszeitnachweis',
    );
    expect(buffer.byteLength).toBeGreaterThan(20_000);
  });
});
