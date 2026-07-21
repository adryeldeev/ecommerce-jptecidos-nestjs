import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import type { JwtPayload } from '../common/types/jwt-payload.type';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async getMe(userId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nome: true,
        ehAdmin: true,
        criadoEm: true,
      },
    });

    if (!usuario) {
      throw new BadRequestException('Usuario nao encontrado.');
    }

    return usuario;
  }

  async updateMe(userId: string, dto: UpdateUsuarioDto, user: JwtPayload) {
    if (!dto.nome && !dto.email) {
      throw new BadRequestException(
        'Pelo menos um campo (nome ou email) deve ser fornecido.',
      );
    }

    if (dto.email) {
      const email = dto.email.toLowerCase().trim();
      const existingUser = await this.prisma.usuario.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new BadRequestException('E-mail ja cadastrado.');
      }
    }

    const usuario = await this.prisma.usuario.update({
      where: { id: userId },
      data: {
        ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
        ...(dto.email !== undefined
          ? { email: dto.email.toLowerCase().trim() }
          : {}),
      },
      select: {
        id: true,
        email: true,
        nome: true,
        ehAdmin: true,
      },
    });

    await this.auditService.record({
      atorId: user.sub,
      atorEmail: user.email,
      acao: 'ATUALIZACAO_DADOS_USUARIO',
      entidade: 'Usuario',
      entidadeId: usuario.id,
      dados: { nome: dto.nome, email: dto.email },
    });

    return usuario;
  }

  async updatePassword(
    userId: string,
    dto: UpdatePasswordDto,
    user: JwtPayload,
  ) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { id: true, senha: true },
    });

    if (!usuario) {
      throw new BadRequestException('Usuario nao encontrado.');
    }

    const senhaOk = await bcrypt.compare(dto.senhaAtual, usuario.senha);
    if (!senhaOk) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    const rounds = Number(this.configService.get<string>('BCRYPT_ROUNDS') ?? '10');
    const senhaHash = await bcrypt.hash(dto.novaSenha, rounds);

    await this.prisma.usuario.update({
      where: { id: userId },
      data: { senha: senhaHash },
    });

    await this.auditService.record({
      atorId: user.sub,
      atorEmail: user.email,
      acao: 'ALTERACAO_SENHA',
      entidade: 'Usuario',
      entidadeId: usuario.id,
    });

    return { message: 'Senha alterada com sucesso.' };
  }
}
