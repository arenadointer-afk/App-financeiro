export interface Conta {
  id: string | number;
  nome: string;
  pagador?: string;
  valor: number;
  valorTotalOriginal?: number | null;
  vencimento: string; // YYYY-MM-DD
  paga: boolean;
  oculta?: boolean;
  recorrente?: boolean;
  totalParcelas?: number | null;
  parcelaAtual?: number | null;
  codigoPix?: string;
  dataPagamento?: string | null;
  categoria?: string;
}

export type AcaoLog =
  | 'CRIADO'
  | 'PAGO'
  | 'PARCIAL'
  | 'ESTORNO'
  | 'EXCLUÍDO'
  | 'ARQUIVADO'
  | 'EDITADO'
  | 'ADIADO'
  | 'RESTAURAÇÃO';

export interface LogAtividade {
  id: number;
  data: string; // ISO string
  acao: AcaoLog;
  detalhe: string;
  backup?: Conta | null;
  relatedId?: string | number | null;
}

export interface UserProfile {
  nome: string;
  fotoPerfil: string;
  biometriaAtivada: boolean;
  pinAcesso: string;
}

export type FiltroContas = 'todas' | 'pendentes' | 'pagas' | 'atrasadas';
