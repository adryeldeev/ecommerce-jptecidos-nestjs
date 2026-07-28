export const FINALIDADES_PRODUTO = [
  'moda',
  'decoracao',
  'alfaiataria',
  'infantil',
  'cama-banho',
  'natural',
  'premium',
  'promocao',
] as const;

export type FinalidadeProduto = (typeof FINALIDADES_PRODUTO)[number];
