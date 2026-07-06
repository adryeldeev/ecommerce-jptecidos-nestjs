import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export type AuditRecordInput = {
  atorId?: string;
  atorEmail?: string;
  acao: string;
  entidade: string;
  entidadeId?: string;
  dados?: unknown;
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: AuditRecordInput) {
    return this.prisma.auditoriaEvento.create({
      data: {
        atorId: input.atorId,
        atorEmail: input.atorEmail,
        acao: input.acao,
        entidade: input.entidade,
        entidadeId: input.entidadeId,
        dados: input.dados as object | undefined,
        ip: input.ip,
        userAgent: input.userAgent,
      },
    });
  }
}
