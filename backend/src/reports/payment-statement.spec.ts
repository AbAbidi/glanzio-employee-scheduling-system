import {
  buildInternalStatementLines,
  calculatePaymentStatement,
} from './payment-statement';

function line(id: string, hours: number, rate = 20) {
  const startAt = new Date(`2026-07-${id.padStart(2, '0')}T08:00:00Z`);
  return {
    id,
    title: `Assignment ${id}`,
    clientName: 'Example client',
    siteName: 'Example site',
    startAt,
    endAt: new Date(startAt.getTime() + hours * 60 * 60_000),
    durationMinutes: hours * 60,
    hourlyRate: rate,
  };
}

describe('calculatePaymentStatement', () => {
  it('caps student payable time and payment at 80 hours', () => {
    const result = calculatePaymentStatement(
      [line('1', 50), line('2', 50)],
      80 * 60,
    );

    expect(result.totals).toEqual({
      completedMinutes: 6000,
      payableMinutes: 4800,
      deferredMinutes: 1200,
      grossAmount: 1600,
    });
    expect(result.lines[1].payableMinutes).toBe(1800);
    expect(result.lines[1].deferredMinutes).toBe(1200);
  });

  it('does not cap a standard employee', () => {
    const result = calculatePaymentStatement([line('1', 100, 18.5)], null);

    expect(result.totals.payableMinutes).toBe(6000);
    expect(result.totals.deferredMinutes).toBe(0);
    expect(result.totals.grossAmount).toBe(1850);
  });

  it('projects only the payable portion into the internal PDF rows', () => {
    const calculation = calculatePaymentStatement(
      [line('1', 72), line('2', 16)],
      80 * 60,
    );
    const pdfLines = buildInternalStatementLines(calculation.lines);

    expect(pdfLines).toHaveLength(2);
    expect(pdfLines[0].durationMinutes).toBe(72 * 60);
    expect(pdfLines[1].durationMinutes).toBe(8 * 60);
    expect(
      pdfLines.reduce((total, item) => total + item.durationMinutes, 0),
    ).toBe(80 * 60);
    expect(pdfLines[1].endAt.getTime()).toBe(
      pdfLines[1].startAt.getTime() + 8 * 60 * 60_000,
    );
  });
});
