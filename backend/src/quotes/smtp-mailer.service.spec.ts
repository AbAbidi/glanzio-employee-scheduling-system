import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { QUOTE_RECIPIENT, SmtpMailer } from './smtp-mailer.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
describe('SMTP delivery envelope', () => {
  const config = {
    SMTP_ENABLED: 'true',
    SMTP_PORT: 587,
    SMTP_HOST: 'example.test',
    SMTP_USER: 'site@example.test',
    SMTP_PASSWORD: 'test-only',
    SMTP_FROM: 'info@glanzio-reinigung.de',
  };
  const input = {
    submissionKey: 'not-used-here',
    fullName: 'Customer',
    email: 'customer@example.test',
    service: 'Glass',
    location: 'Konstanz',
    message: 'Plain text only',
  };
  beforeEach(() => jest.clearAllMocks());
  it('forces the business recipient, uses Reply-To and requires TLS', async () => {
    const sendMail = jest
      .fn()
      .mockResolvedValue({ accepted: [QUOTE_RECIPIENT] });
    jest
      .mocked(nodemailer.createTransport)
      .mockReturnValue({ sendMail } as never);
    const mail = new SmtpMailer(new ConfigService(config));
    await mail.sendQuote(input, 'request-1');
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 587,
        secure: false,
        requireTLS: true,
        disableFileAccess: true,
        disableUrlAccess: true,
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: QUOTE_RECIPIENT,
        replyTo: input.email,
        from: { name: 'Glanzio Website', address: QUOTE_RECIPIENT },
        messageId: '<quote-request-1@glanzio-reinigung.de>',
      }),
    );
  });
  it('rejects unavailable SMTP and unaccepted recipients', async () => {
    const disabled = new SmtpMailer(
      new ConfigService({ SMTP_ENABLED: 'false' }),
    );
    expect(() => disabled.assertConfigured()).toThrow();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    const sendMail = jest.fn().mockResolvedValue({ accepted: [] });
    jest
      .mocked(nodemailer.createTransport)
      .mockReturnValue({ sendMail } as never);
    await expect(
      new SmtpMailer(new ConfigService(config)).sendQuote(input, 'request-2'),
    ).rejects.toMatchObject({ responseCode: 550 });
  });
});
