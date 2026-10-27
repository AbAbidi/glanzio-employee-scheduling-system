import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { QuoteDto } from './quote.dto';

export const QUOTE_RECIPIENT = 'info@glanzio-reinigung.de';

@Injectable()
export class SmtpMailer {
  private transporter?: nodemailer.Transporter;
  constructor(private readonly config: ConfigService) {}

  assertConfigured() {
    if (this.config.get<string>('SMTP_ENABLED', 'false') !== 'true') {
      throw new ServiceUnavailableException(
        'Der E-Mail-Versand ist noch nicht verfügbar. Bitte kontaktieren Sie uns direkt.',
      );
    }
  }

  async sendQuote(input: QuoteDto, requestId: string) {
    this.assertConfigured();
    const port = this.config.get<number>('SMTP_PORT', 587);
    this.transporter ??= nodemailer.createTransport({
      host: this.config.getOrThrow<string>('SMTP_HOST'),
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: {
        user: this.config.getOrThrow<string>('SMTP_USER'),
        pass: this.config.getOrThrow<string>('SMTP_PASSWORD'),
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      disableFileAccess: true,
      disableUrlAccess: true,
      logger: false,
      debug: false,
    });
    const info = (await this.transporter.sendMail({
      from: {
        name: 'Glanzio Website',
        address: this.config.get<string>('SMTP_FROM', QUOTE_RECIPIENT),
      },
      to: QUOTE_RECIPIENT,
      replyTo: input.email,
      subject: 'Neue Angebotsanfrage – Glanzio Website',
      messageId: `<quote-${requestId}@glanzio-reinigung.de>`,
      text: [
        `Referenz: ${requestId}`,
        `Name: ${input.fullName}`,
        `E-Mail: ${input.email}`,
        `Leistung: ${input.service || 'Nicht angegeben'}`,
        `Objektstandort: ${input.location}`,
        '',
        input.message || 'Keine weitere Nachricht.',
      ].join('\n'),
    })) as { accepted?: Array<string | { address: string }> };
    if (
      !info.accepted?.some(
        (item) =>
          (typeof item === 'string' ? item : item.address).toLowerCase() ===
          QUOTE_RECIPIENT,
      )
    ) {
      throw Object.assign(new Error('Recipient not accepted'), {
        responseCode: 550,
      });
    }
  }
}
