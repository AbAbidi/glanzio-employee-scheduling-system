import { Body, Controller, HttpCode, Module, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { QuoteDto } from './quote.dto';
import { QuotesService } from './quotes.service';
import { SmtpMailer } from './smtp-mailer.service';

@Controller('quotes')
class QuotesController {
  constructor(private readonly quotes: QuotesService) {}
  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  submit(@Body() input: QuoteDto) {
    return this.quotes.submit(input);
  }
}

@Module({
  controllers: [QuotesController],
  providers: [QuotesService, SmtpMailer],
})
export class QuotesModule {}
