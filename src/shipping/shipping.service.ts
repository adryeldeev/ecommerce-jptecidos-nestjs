import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { QuoteShippingDto } from './dto/quote-shipping.dto';

export type ShippingQuote = {
  metodo: 'economico' | 'express';
  transportadora: string;
  prazoDias: number;
  valor: string;
};

@Injectable()
export class ShippingService {
  quote(dto: QuoteShippingDto): ShippingQuote[] {
    const subtotal = new Decimal(dto.subtotal);
    const regionMultiplier = this.getRegionMultiplier(dto.cep, dto.estado);
    const economicBase = new Decimal(14.9).plus(regionMultiplier);
    const expressBase = new Decimal(29.9).plus(regionMultiplier.mul(1.5));
    const subtotalFactor = subtotal.div(1000);

    return [
      {
        metodo: 'economico',
        transportadora: 'JP Tecidos Logistica',
        prazoDias: this.getBaseDays(dto.cep, dto.estado, 'economico'),
        valor: economicBase.plus(subtotalFactor).toFixed(2),
      },
      {
        metodo: 'express',
        transportadora: 'JP Tecidos Express',
        prazoDias: this.getBaseDays(dto.cep, dto.estado, 'express'),
        valor: expressBase.plus(subtotalFactor.mul(1.5)).toFixed(2),
      },
    ];
  }

  choose(dto: QuoteShippingDto) {
    const options = this.quote(dto);
    const selected = options.find((option) => option.metodo === (dto.metodo ?? 'economico')) ?? options[0];
    return selected;
  }

  private getRegionMultiplier(cep: string, estado?: string) {
    const prefix = Number(cep.replace(/\D/g, '').charAt(0) || '0');

    const stateMap: Record<string, number> = {
      SP: 0,
      RJ: 1,
      MG: 1,
      ES: 1,
      PR: 1,
      SC: 1,
      RS: 2,
      BA: 2,
      PE: 2,
      CE: 2,
      PA: 3,
      AM: 4,
      AC: 5,
      RO: 4,
      RR: 5,
      AP: 5,
      TO: 4,
      MA: 3,
      PI: 3,
      PB: 3,
      RN: 3,
      AL: 3,
      SE: 3,
      GO: 2,
      DF: 2,
      MT: 3,
      MS: 2,
    };

    const stateValue = estado ? stateMap[estado.toUpperCase()] ?? 2 : 2;
    return new Decimal(prefix).div(3).plus(stateValue);
  }

  private getBaseDays(cep: string, estado: string | undefined, metodo: 'economico' | 'express') {
    const state = estado?.toUpperCase();
    const local = state === 'SP' || state === 'RJ' || state === 'MG';
    const cepDigit = Number(cep.replace(/\D/g, '').charAt(0) || '0');

    if (metodo === 'express') {
      return local ? 2 + (cepDigit % 2) : 3 + (cepDigit % 3);
    }

    return local ? 4 + (cepDigit % 3) : 6 + (cepDigit % 5);
  }
}
