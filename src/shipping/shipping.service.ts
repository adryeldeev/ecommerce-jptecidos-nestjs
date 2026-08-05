import { BadRequestException, Injectable } from '@nestjs/common';
import { UnidadeMedida } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../common/prisma/prisma.service';
import { FrenetService, FrenetShippingItem } from './frenet.service';

export type ShippingQuote = {
  metodo: 'economico' | 'express';
  transportadora: string;
  prazoDias: number;
  valor: string;
};

export type ShippingItemInput = {
  produtoVariacaoId: string;
  quantidade: string;
};

// Estimativa de dimensao de pacote: ainda nao existe medida real de
// embalagem por produto, entao o "comprimento" do rolo despachado escala
// com a metragem/peso do item (rolo maior ocupa mais espaco fisico),
// dentro de um minimo/maximo razoavel aceito pelas transportadoras.
// Ajustar essas constantes quando houver medida real de embalagem.
const DIMENSAO_MIN_CM = 20;
const DIMENSAO_MAX_CM = 100;
const DIMENSAO_BASE_CM = 20;
const DIMENSAO_CM_POR_METRO = 0.5;
const DIMENSAO_CM_POR_KG = 3;
const ALTURA_LARGURA_PADRAO_CM = 15;
const PESO_MINIMO_KG = 0.1;
// Fallback so usado quando o produto vendido por METRO ainda nao tem
// gramatura/largura cadastradas (dado opcional, pode faltar em produtos antigos).
const PESO_PADRAO_KG_POR_METRO_SEM_GRAMATURA = 0.3;
const PESO_PADRAO_KG_POR_UNIDADE = 0.5;

@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly frenetService: FrenetService,
  ) {}

  async quote(cep: string, itens: ShippingItemInput[]): Promise<ShippingQuote[]> {
    const { frenetItens, subtotal } = await this.montarItensFrenet(itens);

    const cotacoes = await this.frenetService.cotar({
      recipientCep: cep,
      invoiceValue: subtotal.toFixed(2),
      itens: frenetItens,
    });

    if (cotacoes.length === 0) {
      throw new BadRequestException(
        'Nao foi possivel calcular o frete para o CEP informado.',
      );
    }

    const maisBarata = cotacoes.reduce((a, b) => (b.price < a.price ? b : a));
    const maisRapida = cotacoes.reduce((a, b) => (b.deliveryDays < a.deliveryDays ? b : a));

    return [
      {
        metodo: 'economico',
        transportadora: `${maisBarata.carrier} - ${maisBarata.serviceDescription}`,
        prazoDias: maisBarata.deliveryDays,
        valor: maisBarata.price.toFixed(2),
      },
      {
        metodo: 'express',
        transportadora: `${maisRapida.carrier} - ${maisRapida.serviceDescription}`,
        prazoDias: maisRapida.deliveryDays,
        valor: maisRapida.price.toFixed(2),
      },
    ];
  }

  async choose(
    cep: string,
    itens: ShippingItemInput[],
    metodo?: 'economico' | 'express',
  ): Promise<ShippingQuote> {
    const options = await this.quote(cep, itens);
    return options.find((option) => option.metodo === (metodo ?? 'economico')) ?? options[0];
  }

  private async montarItensFrenet(
    itens: ShippingItemInput[],
  ): Promise<{ frenetItens: FrenetShippingItem[]; subtotal: Decimal }> {
    const frenetItens: FrenetShippingItem[] = [];
    let subtotal = new Decimal(0);

    for (const item of itens) {
      const quantidade = new Decimal(item.quantidade);

      const variacao = await this.prisma.produtoVariacao.findUnique({
        where: { id: item.produtoVariacaoId },
        select: {
          preco: true,
          produto: {
            select: {
              precoBase: true,
              gramatura: true,
              largura: true,
              unidadeMedida: true,
            },
          },
        },
      });

      if (!variacao) {
        throw new BadRequestException(
          `Variacao ${item.produtoVariacaoId} nao encontrada.`,
        );
      }

      const precoUnitario = variacao.preco
        ? new Decimal(variacao.preco.toString())
        : new Decimal(variacao.produto.precoBase.toString());
      subtotal = subtotal.plus(precoUnitario.mul(quantidade));

      const { pesoKg, comprimentoCm } = this.calcularPesoEDimensao(
        variacao.produto.unidadeMedida,
        quantidade,
        variacao.produto.gramatura ? new Decimal(variacao.produto.gramatura.toString()) : null,
        variacao.produto.largura ? new Decimal(variacao.produto.largura.toString()) : null,
      );

      frenetItens.push({
        weightKg: Math.max(PESO_MINIMO_KG, pesoKg),
        lengthCm: comprimentoCm,
        heightCm: ALTURA_LARGURA_PADRAO_CM,
        widthCm: ALTURA_LARGURA_PADRAO_CM,
        quantity: 1,
      });
    }

    return { frenetItens, subtotal };
  }

  private calcularPesoEDimensao(
    unidadeMedida: UnidadeMedida,
    quantidade: Decimal,
    gramatura: Decimal | null,
    largura: Decimal | null,
  ): { pesoKg: number; comprimentoCm: number } {
    if (unidadeMedida === UnidadeMedida.KG) {
      const pesoKg = quantidade.toNumber();
      return {
        pesoKg,
        comprimentoCm: this.clampDimensao(DIMENSAO_BASE_CM + pesoKg * DIMENSAO_CM_POR_KG),
      };
    }

    if (unidadeMedida === UnidadeMedida.METRO) {
      const pesoKg =
        gramatura && largura
          ? quantidade.mul(largura).mul(gramatura).div(1000).toNumber()
          : quantidade.mul(PESO_PADRAO_KG_POR_METRO_SEM_GRAMATURA).toNumber();

      return {
        pesoKg,
        comprimentoCm: this.clampDimensao(
          DIMENSAO_BASE_CM + quantidade.toNumber() * DIMENSAO_CM_POR_METRO,
        ),
      };
    }

    // UNIDADE: sem formula de peso real disponivel, usa estimativa fixa por peca.
    return {
      pesoKg: quantidade.mul(PESO_PADRAO_KG_POR_UNIDADE).toNumber(),
      comprimentoCm: DIMENSAO_BASE_CM,
    };
  }

  private clampDimensao(valor: number): number {
    return Math.min(DIMENSAO_MAX_CM, Math.max(DIMENSAO_MIN_CM, valor));
  }
}
