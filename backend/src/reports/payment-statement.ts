export type PaymentStatementInputLine = {
  id: string;
  title: string;
  clientName: string;
  siteName: string;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  hourlyRate: number;
};

export type PaymentStatementLine = PaymentStatementInputLine & {
  payableMinutes: number;
  deferredMinutes: number;
  amount: number;
};

export type PaymentStatementTotals = {
  completedMinutes: number;
  payableMinutes: number;
  deferredMinutes: number;
  grossAmount: number;
};

export function calculatePaymentStatement(
  lines: PaymentStatementInputLine[],
  monthlyLimitMinutes: number | null,
): { lines: PaymentStatementLine[]; totals: PaymentStatementTotals } {
  let remainingPayableMinutes = monthlyLimitMinutes ?? Number.POSITIVE_INFINITY;

  const calculatedLines = [...lines]
    .sort((first, second) => first.startAt.getTime() - second.startAt.getTime())
    .map((line) => {
      const durationMinutes = Math.max(0, Math.round(line.durationMinutes));
      const payableMinutes = Math.min(durationMinutes, remainingPayableMinutes);
      remainingPayableMinutes -= payableMinutes;
      const deferredMinutes = durationMinutes - payableMinutes;

      return {
        ...line,
        durationMinutes,
        payableMinutes,
        deferredMinutes,
        amount: Number(((payableMinutes / 60) * line.hourlyRate).toFixed(2)),
      };
    });

  const totals = calculatedLines.reduce<PaymentStatementTotals>(
    (summary, line) => ({
      completedMinutes: summary.completedMinutes + line.durationMinutes,
      payableMinutes: summary.payableMinutes + line.payableMinutes,
      deferredMinutes: summary.deferredMinutes + line.deferredMinutes,
      grossAmount: Number((summary.grossAmount + line.amount).toFixed(2)),
    }),
    {
      completedMinutes: 0,
      payableMinutes: 0,
      deferredMinutes: 0,
      grossAmount: 0,
    },
  );

  return { lines: calculatedLines, totals };
}

/**
 * Produces the rows used by the internal settlement PDF.
 *
 * Student lines have already been capped by calculatePaymentStatement. This
 * projection removes deferred time and shortens the final partially payable
 * interval, so the PDF can never show more than the configured monthly cap.
 */
export function buildInternalStatementLines(
  lines: PaymentStatementLine[],
): PaymentStatementLine[] {
  return [...lines]
    .sort((first, second) => first.startAt.getTime() - second.startAt.getTime())
    .flatMap((line) => {
      const actualMinutes = Math.max(0, Math.round(line.durationMinutes));
      const payableMinutes = Math.max(
        0,
        Math.min(actualMinutes, Math.round(line.payableMinutes)),
      );

      if (payableMinutes === 0) return [];

      const payableEnd = new Date(
        Math.min(
          line.endAt.getTime(),
          line.startAt.getTime() + payableMinutes * 60_000,
        ),
      );

      return [
        {
          ...line,
          endAt: payableEnd,
          durationMinutes: payableMinutes,
          payableMinutes,
          deferredMinutes: 0,
        },
      ];
    });
}
