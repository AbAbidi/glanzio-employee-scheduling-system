import { ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { QuotesService } from './quotes.service';
import { QuoteDto } from './quote.dto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

const input = {
  submissionKey: 'b089b6fb-497f-4de2-9637-ddeef7f597d9',
  fullName: 'Test Customer',
  email: 'test@example.test',
  service: '',
  location: 'Konstanz',
  message: '',
};
const { submissionKey, ...data } = input;
void submissionKey;
const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
const row = { id: 'request-1', inputHash: hash, status: 'PENDING' };
function fixture(status = 'PENDING') {
  const db = {
    quoteRequest: {
      upsert: jest.fn().mockResolvedValue({ ...row, status }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const mail = {
    assertConfigured: jest.fn(),
    sendQuote: jest.fn().mockResolvedValue(undefined),
  };
  return { db, mail, service: new QuotesService(db as never, mail as never) };
}
describe('Quote delivery safety', () => {
  it('does not persist a fake success when SMTP is not configured', async () => {
    const { service, db, mail } = fixture();
    mail.assertConfigured.mockImplementation(() => {
      throw new ServiceUnavailableException();
    });
    await expect(service.submit(input)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(db.quoteRequest.upsert).not.toHaveBeenCalled();
  });
  it('does not resend a delivered request or a losing concurrent claim', async () => {
    const sent = fixture('SENT');
    await expect(sent.service.submit(input)).resolves.toEqual({
      id: row.id,
      status: 'sent',
    });
    expect(sent.mail.sendQuote).not.toHaveBeenCalled();
    const other = fixture();
    other.db.quoteRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(other.service.submit(input)).rejects.toThrow('bereits');
    expect(other.mail.sendQuote).not.toHaveBeenCalled();
  });
  it('blocks replay after an ambiguous network failure', async () => {
    const { service, db, mail } = fixture();
    mail.sendQuote.mockRejectedValue(new Error('Socket closed'));
    await expect(service.submit(input)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(db.quoteRequest.update).toHaveBeenCalledWith({
      where: { id: row.id },
      data: { status: 'UNKNOWN' },
    });
  });
  it('allows bounded retry only after an explicit SMTP rejection', async () => {
    const { service, db, mail } = fixture();
    mail.sendQuote.mockRejectedValue(
      Object.assign(new Error('SMTP rejected'), { responseCode: 450 }),
    );
    await expect(service.submit(input)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(db.quoteRequest.update).toHaveBeenCalledWith({
      where: { id: row.id },
      data: { status: 'FAILED' },
    });
    expect(db.quoteRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: row.id,
          status: { in: ['PENDING', 'FAILED'] },
          attempts: { lt: 3 },
        },
      }),
    );
  });
  it('validates email, honeypot, text bounds and normalizes whitespace', () => {
    const valid = plainToInstance(QuoteDto, {
      ...input,
      fullName: '  Test Customer  ',
    });
    expect(validateSync(valid)).toHaveLength(0);
    expect(valid.fullName).toBe('Test Customer');
    for (const invalid of [
      { email: 'bad\r\nBcc:other@test.de' },
      { companyWebsite: 'bot' },
      { message: 'x'.repeat(4001) },
      { fullName: 'x' },
      { submissionKey: 'wrong' },
    ]) {
      expect(
        validateSync(plainToInstance(QuoteDto, { ...input, ...invalid }))
          .length,
      ).toBeGreaterThan(0);
    }
  });
});
