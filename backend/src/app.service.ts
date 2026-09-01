import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

export type HealthStatus = Readonly<{
  status: 'ok';
  service: 'esms-backend';
}>;

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHealth(): HealthStatus {
    return {
      status: 'ok',
      service: 'esms-backend',
    };
  }

  async getReadiness() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ready' as const,
      service: 'esms-backend' as const,
      database: 'reachable' as const,
    };
  }
}
