import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const existingUser = await this.prisma.usuario.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new BadRequestException('Email ja cadastrado.');
    }

    const rounds = Number(this.configService.get<string>('BCRYPT_ROUNDS') ?? '10');
    const senhaHash = await bcrypt.hash(dto.senha, rounds);

    const usuario = await this.prisma.usuario.create({
      data: {
        email,
        senha: senhaHash,
        nome: dto.nome,
      },
      select: {
        id: true,
        email: true,
        nome: true,
        ehAdmin: true,
      },
    });

    const token = await this.jwtService.signAsync({
      sub: usuario.id,
      email: usuario.email,
      ehAdmin: usuario.ehAdmin,
    });

    return { usuario, accessToken: token };
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();

    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        nome: true,
        senha: true,
        ehAdmin: true,
      },
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const senhaOk = await bcrypt.compare(dto.senha, usuario.senha);
    if (!senhaOk) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const token = await this.jwtService.signAsync({
      sub: usuario.id,
      email: usuario.email,
      ehAdmin: usuario.ehAdmin,
    });

    return {
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        ehAdmin: usuario.ehAdmin,
      },
      accessToken: token,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (!usuario) {
      return {
        message: 'Se o email existir, enviaremos instrucoes para redefinicao.',
      };
    }

    await this.prisma.passwordResetToken.deleteMany({
      where: { usuarioId: usuario.id, usadoEm: null },
    });

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiraEm = new Date(Date.now() + 1000 * 60 * 60);

    await this.prisma.passwordResetToken.create({
      data: {
        usuarioId: usuario.id,
        tokenHash,
        expiraEm,
      },
    });

    return {
      message: 'Se o email existir, enviaremos instrucoes para redefinicao.',
      ...(this.configService.get<string>('NODE_ENV') !== 'production'
        ? { devResetToken: rawToken }
        : {}),
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { usuario: true },
    });

    if (!resetToken || resetToken.usadoEm || resetToken.expiraEm < new Date()) {
      throw new BadRequestException('Token invalido ou expirado.');
    }

    const rounds = Number(this.configService.get<string>('BCRYPT_ROUNDS') ?? '10');
    const senhaHash = await bcrypt.hash(dto.novaSenha, rounds);

    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: resetToken.usuarioId },
        data: { senha: senhaHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { tokenHash },
        data: { usadoEm: new Date() },
      }),
    ]);

    return { message: 'Senha redefinida com sucesso.' };
  }
}
