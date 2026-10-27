import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { DateTime } from 'luxon';
import { AssignmentStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentCompletionService } from '../assignments/assignment-completion.service';
import { STUDENT_PDF_LAYOUT_VERSION } from './pdf-layout-version';
import {
  allocateStudentMonth,
  nextWeekUsage,
  STUDENT_POLICY,
  type CreditLot,
  type StudentAccounting,
} from './student-accounting';

export type StudentSnapshot = {
  id: string;
  status: string;
  sourceHash: string;
  closedAt: Date | null;
  data: StudentAccounting;
};

@Injectable()
export class StudentAccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() private readonly completion?: AssignmentCompletionService,
  ) {}

  async period(
    employeeId: string,
    month: string,
    finalize = false,
    actorUserId?: string,
  ): Promise<StudentSnapshot> {
    await this.completion?.reconcile();
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
      month < STUDENT_POLICY.effectiveMonth
    ) {
      throw new BadRequestException(
        'Student simulation starts in October 2026.',
      );
    }
    const zone = this.config.get<string>('SYSTEM_TIME_ZONE', 'Europe/Paris');
    const now = DateTime.now().setZone(zone);
    if (month > now.plus({ years: 1 }).toFormat('yyyy-MM')) {
      throw new BadRequestException(
        'Preview is limited to the next twelve months.',
      );
    }
    if (finalize && month >= now.toFormat('yyyy-MM')) {
      throw new BadRequestException(
        'Only finished months may be closed. Use the draft preview for the current or next month.',
      );
    }
    // Serialize by employee, not month: adjacent months can consume the same lots.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT "id" FROM "Employee" WHERE "id" = ${employeeId}::uuid FOR UPDATE`;
            return this.calculate(
              tx,
              employeeId,
              month,
              zone,
              now,
              finalize,
              actorUserId,
            );
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 15000,
          },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < 2
        )
          continue;
        throw error;
      }
    }
    throw new ConflictException('Accounting is busy; retry the request.');
  }

  private async calculate(
    tx: Prisma.TransactionClient,
    employeeId: string,
    month: string,
    zone: string,
    now: DateTime,
    finalize: boolean,
    actorUserId?: string,
  ): Promise<StudentSnapshot> {
    const employee = await tx.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found.');
    const records = await tx.studentStatement.findMany({
      where: { employeeId, month: { lte: month } },
      orderBy: [{ month: 'asc' }, { revision: 'asc' }],
    });
    const existing = records.filter((row) => row.month === month).at(-1);
    if (existing?.status === 'CLOSED') return this.snapshot(existing);
    if (!employee.isStudent)
      throw new BadRequestException('This employee is not a student.');
    const previousClosed = records
      .filter((row) => row.status === 'CLOSED' && row.month < month)
      .at(-1);
    const requestedStart = DateTime.fromISO(`${month}-01`, { zone });
    const expectedPrevious = requestedStart
      .minus({ months: 1 })
      .toFormat('yyyy-MM');
    if (
      finalize &&
      month !== STUDENT_POLICY.effectiveMonth &&
      previousClosed?.month !== expectedPrevious
    ) {
      throw new ConflictException(
        `Close ${expectedPrevious} first. Downloading a draft never closes a month.`,
      );
    }
    const first = previousClosed
      ? DateTime.fromISO(`${previousClosed.month}-01`, { zone }).plus({
          months: 1,
        })
      : DateTime.fromISO(`${STUDENT_POLICY.effectiveMonth}-01`, { zone });
    const links = await tx.assignmentEmployee.findMany({
      where: {
        employeeId,
        assignment: {
          status: {
            in: [AssignmentStatus.SCHEDULED, AssignmentStatus.COMPLETED],
          },
          startAt: {
            lt: requestedStart.plus({ months: 1 }).toUTC().toJSDate(),
          },
          endAt: {
            gt: first.toUTC().toJSDate(),
          },
        },
      },
      include: { assignment: true },
      orderBy: [{ assignment: { startAt: 'asc' } }, { assignmentId: 'asc' }],
    });
    let previous = previousClosed
      ? (previousClosed.payload as unknown as StudentAccounting)
      : undefined;
    let previousHash =
      previousClosed?.sourceHash ?? 'opening-balance-zero-2026-10';
    let result: StudentSnapshot | undefined;
    for (
      let cursor = first;
      cursor <= requestedStart;
      cursor = cursor.plus({ months: 1 })
    ) {
      const key = cursor.toFormat('yyyy-MM');
      const stop = cursor.plus({ months: 1 });
      const sources: CreditLot[] = links.flatMap((link) => {
        if (
          link.assignment.status !== AssignmentStatus.COMPLETED ||
          link.assignment.endAt.getTime() > now.toMillis()
        )
          return [];
        const start = Math.max(
          cursor.toMillis(),
          link.assignment.startAt.getTime(),
        );
        const end = Math.min(stop.toMillis(), link.assignment.endAt.getTime());
        const minutes = Math.max(0, Math.round((end - start) / 60000));
        if (!minutes) return [];
        return [
          {
            key: `${link.assignmentId}:${key}`,
            assignmentId: link.assignmentId,
            title: link.assignment.title,
            originMonth: key,
            sourceStart: new Date(start).toISOString(),
            sourceEnd: new Date(end).toISOString(),
            minutes,
            hourlyRate: Number(
              link.agreedHourlyRate ?? employee.hourlyRate ?? 0,
            ),
          },
        ];
      });
      const data = allocateStudentMonth({
        month: key,
        zone,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        sources,
        carryIn: previous?.carryOut,
        previousWeeks: previous ? nextWeekUsage(previous) : undefined,
        busyIntervals: links
          .filter(
            (link) =>
              link.assignment.startAt.getTime() < stop.toMillis() &&
              link.assignment.endAt.getTime() > cursor.toMillis(),
          )
          .map((link) => ({
            startAt: link.assignment.startAt.toISOString(),
            endAt: link.assignment.endAt.toISOString(),
          })),
      });
      const sourceHash = createHash('sha256')
        .update(
          JSON.stringify({
            previousHash,
            data,
            pdfLayoutVersion: STUDENT_PDF_LAYOUT_VERSION,
          }),
        )
        .digest('hex');
      let row = records.filter((item) => item.month === key).at(-1);
      if (!row || row.sourceHash !== sourceHash) {
        const values = {
          sourceHash,
          policyVersion: STUDENT_POLICY.version,
          payload: data as unknown as Prisma.InputJsonValue,
          pdfBytes: null,
        };
        row = row
          ? await tx.studentStatement.update({
              where: { id: row.id },
              data: values,
            })
          : await tx.studentStatement.create({
              data: { employeeId, month: key, ...values },
            });
        await tx.studentCreditMovement.deleteMany({
          where: { statementId: row.id },
        });
        const consumed = new Map<string, number>();
        for (const allocation of data.allocations)
          consumed.set(
            allocation.sourceKey,
            (consumed.get(allocation.sourceKey) ?? 0) + allocation.minutes,
          );
        const allLots = [
          ...data.carryIn,
          ...data.sources,
          ...data.deferredSources,
        ];
        const movements = [
          ...data.sources.map((lot) => ({
            lot,
            kind: 'EARNED',
            minutes: lot.minutes,
          })),
          ...allLots
            .filter((lot) => consumed.has(lot.key))
            .map((lot) => ({
              lot,
              kind: 'ALLOCATED',
              minutes: consumed.get(lot.key)!,
            })),
        ];
        if (movements.length)
          await tx.studentCreditMovement.createMany({
            data: movements.map(({ lot, kind, minutes }) => ({
              statementId: row!.id,
              kind,
              sourceKey: lot.key,
              originMonth: lot.originMonth,
              sourceAssignmentId: lot.assignmentId,
              minutes,
              hourlyRate: new Prisma.Decimal(lot.hourlyRate),
            })),
          });
      }
      if (finalize && key === month) {
        row = await tx.studentStatement.update({
          where: { id: row.id },
          data: {
            status: 'CLOSED',
            closedAt: now.toUTC().toJSDate(),
            pdfBytes: null,
          },
        });
        await tx.auditLog.create({
          data: {
            actorUserId,
            action: 'STUDENT_MONTH_CLOSED',
            entityType: 'StudentStatement',
            entityId: row.id,
            metadata: {
              employeeId,
              month,
              sourceHash,
              policyVersion: STUDENT_POLICY.version,
              closureMode: actorUserId ? 'MANUAL' : 'AUTOMATIC',
            },
          },
        });
      }
      result = this.snapshot(row);
      previous = data;
      previousHash = sourceHash;
    }
    return result!;
  }

  private snapshot(row: {
    id: string;
    status: string;
    sourceHash: string;
    closedAt: Date | null;
    payload: Prisma.JsonValue;
  }): StudentSnapshot {
    return {
      id: row.id,
      status: row.status,
      sourceHash: row.sourceHash,
      closedAt: row.closedAt,
      data: row.payload as unknown as StudentAccounting,
    };
  }

  async pdf(
    snapshot: StudentSnapshot,
    generate: () => Promise<Buffer>,
  ): Promise<Buffer> {
    const stored = await this.prisma.studentStatement.findUniqueOrThrow({
      where: { id: snapshot.id },
    });
    if (
      stored.sourceHash !== snapshot.sourceHash ||
      stored.status !== snapshot.status
    )
      throw new ConflictException(
        'The draft changed. Refresh and export again.',
      );
    if (stored.pdfBytes) return Buffer.from(stored.pdfBytes);
    const buffer = await generate(); // Keep PDF rendering outside the short database transaction.
    await this.prisma.studentStatement.updateMany({
      where: {
        id: snapshot.id,
        sourceHash: snapshot.sourceHash,
        status: snapshot.status,
        pdfBytes: null,
      },
      data: { pdfBytes: new Uint8Array(buffer) },
    });
    const current = await this.prisma.studentStatement.findUniqueOrThrow({
      where: { id: snapshot.id },
    });
    if (
      current.sourceHash !== snapshot.sourceHash ||
      current.status !== snapshot.status ||
      !current.pdfBytes
    )
      throw new ConflictException('The draft changed. Export again.');
    return Buffer.from(current.pdfBytes);
  }
}
