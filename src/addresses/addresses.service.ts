import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  create(usuarioId: string, dto: CreateAddressDto) {
    return this.prisma.endereco.create({
      data: {
        usuarioId,
        cep: dto.cep,
        rua: dto.rua,
        numero: dto.numero,
        complemento: dto.complemento,
        bairro: dto.bairro,
        cidade: dto.cidade,
        estado: dto.estado.toUpperCase(),
      },
    });
  }

  list(usuarioId: string) {
    return this.prisma.endereco.findMany({
      where: { usuarioId },
      orderBy: { cidade: 'asc' },
    });
  }

  async update(usuarioId: string, enderecoId: string, dto: UpdateAddressDto) {
    const endereco = await this.prisma.endereco.findFirst({
      where: { id: enderecoId, usuarioId },
      select: { id: true },
    });

    if (!endereco) {
      throw new NotFoundException('Endereco nao encontrado.');
    }

    return this.prisma.endereco.update({
      where: { id: enderecoId },
      data: {
        ...dto,
          ...(dto.estado ? { estado: dto.estado.toUpperCase() } : {}),
      },
    });
  }

  async remove(usuarioId: string, enderecoId: string) {
    const endereco = await this.prisma.endereco.findFirst({
      where: { id: enderecoId, usuarioId },
      select: { id: true },
    });

    if (!endereco) {
      throw new NotFoundException('Endereco nao encontrado.');
    }

    await this.prisma.endereco.delete({ where: { id: enderecoId } });
    return { deleted: true };
  }
}
