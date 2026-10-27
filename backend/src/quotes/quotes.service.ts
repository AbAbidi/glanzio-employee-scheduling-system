import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { QuoteDto } from './quote.dto';
import { SmtpMailer } from './smtp-mailer.service';

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: SmtpMailer,
  ) {}

  async submit(input: QuoteDto) {
    this.mailer.assertConfigured();
    const data = {
      fullName: input.fullName,
      email: input.email,
      service: input.service,
      location: input.location,
      message: input.message,
    };
    const inputHash = createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
    const stored = await this.prisma.quoteRequest.upsert({
      where: { submissionKey: input.submissionKey },
      create: { ...data, inputHash, submissionKey: input.submissionKey },
      update: {},
    });
    if (stored.inputHash !== inputHash)
      throw new ConflictException(
        'This submission key was already used for a different request.',
      );
    if (stored.status === 'SENT')
      return { id: stored.id, status: 'sent' as const };
    const claim = await this.prisma.quoteRequest.updateMany({
      where: {
        id: stored.id,
        status: { in: ['PENDING', 'FAILED'] },
        attempts: { lt: 3 },
      },
      data: {
        status: 'SENDING',
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });
    if (claim.count !== 1) {
      throw new ConflictException(
        'Diese Anfrage wird bereits verarbeitet oder muss geprüft werden. Bitte kontaktieren Sie uns direkt, ohne sie erneut anzulegen.',
      );
    }
    try {
      await this.mailer.sendQuote(input, stored.id);
    } catch (error: unknown) {
      const smtpCode =
        error && typeof error === 'object' && 'responseCode' in error
          ? Number(error.responseCode)
          : 0;
      // A network disconnect can occur AFTER SMTP accepted the message. Never
      // automatically replay ambiguous deliveries; keep them for reconciliation.
      await this.prisma.quoteRequest.update({
        where: { id: stored.id },
        data: {
          status: smtpCode >= 400 && smtpCode < 600 ? 'FAILED' : 'UNKNOWN',
        },
      });
      throw new ServiceUnavailableException(
        'Der Versand konnte nicht bestätigt werden. Ihre Eingaben bleiben erhalten. Bitte kontaktieren Sie uns bei Bedarf direkt.',
      );
    }
    // If this DB write fails after SMTP acceptance, SENDING remains blocked from
    // replay. A fixed Message-ID helps operators reconcile it with the mail log.
    await this.prisma.quoteRequest.update({
      where: { id: stored.id },
      data: { status: 'SENT', acceptedAt: new Date() },
    });
    return { id: stored.id, status: 'sent' as const };
  }
}
