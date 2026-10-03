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

export type TipoNotificacao =
  | 'atrasada'
  | 'hoje'
  | 'breve'
  | 'parcela_fim'
  | 'parcela_penultima'
  | 'parcela_quitada'
  | 'nova_conta'
  | 'conta_paga'
  | 'transmissao_adm';

export interface MensagemTransmissao {
  id: string;
  titulo: string;
  mensagem: string;
  data: string; // ISO string
  timestamp: number;
  urgencia: 'alta' | 'media' | 'baixa';
  enviadoPor?: string;
  deviceId?: string;
}

export interface NotificacaoAlerta {
  id: string;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  contaId?: string | number;
  valor?: number;
  vencimento?: string;
  urgencia: 'alta' | 'media' | 'baixa';
  diasAtraso?: number;
  parcelaAtual?: number | null;
  totalParcelas?: number | null;
}

export interface ParcelaAcordo {
  numero: number;
  valor: number;
  vencimento: string; // YYYY-MM-DD
  paga: boolean;
  dataPagamento?: string | null;
}

export interface Acordo {
  id: string;
  credor: string; // Ex: Nubank, Itaú, Loja
  valorOriginal?: number | null; // Valor antes da negociação
  valorTotal: number; // Valor fechado do acordo
  descontoPercentual?: number | null;
  economia?: number | null; // valorOriginal - valorTotal
  vencimentoPrimeiraParcela: string; // YYYY-MM-DD
  parcelado: boolean;
  totalParcelas: number;
  parcelasPagas: number;
  valorParcela: number;
  quitado: boolean;
  dataCriacao: string;
  observacoes?: string;
}

export interface DividaLimpaNome {
  id: string;
  nome: string;
  valor: number;
  valorTotalOriginal?: number;
  valorOriginalDica?: number | null;
  vencimento: string; // YYYY-MM-DD
  paga: boolean;
  totalParcelas: number;
  parcelaAtual: number;
  dataCriacao?: string;
  observacoes?: string;
}

// 📦 Caixinhas & Cofrinhos (Metas e Poupança Inteligente)
export interface TransacaoCaixinha {
  id: string;
  tipo: 'deposito' | 'resgate' | 'rendimento';
  valor: number;
  data: string; // ISO ou YYYY-MM-DD
  descricao?: string;
}

export interface Caixinha {
  id: string;
  nome: string;
  categoria: 'emergencia' | 'sonhos' | 'investimento' | 'viagem' | 'bens' | 'geral';
  cor?: string;
  icone?: string;
  saldo: number;
  meta?: number;
  prazoMeta?: string;
  rendimentoMensalPct?: number;
  historico?: TransacaoCaixinha[];
  dataCriacao: string;
  observacoes?: string;
}

// ❤️ Saúde & Bem-Estar
export interface MedicamentoSaude {
  id: string;
  nome: string;
  dosagem: string;
  horarios: string[];
  frequencia: string;
  lembreteAtivo: boolean;
  tomadoHoje?: { [horario: string]: boolean };
  instrucoes?: string;
  estoqueAtual?: number;
}

export interface ConsultaExameSaude {
  id: string;
  tipo: 'consulta' | 'exame' | 'retorno' | 'procedimento';
  titulo: string;
  medicoOuLocal: string;
  data: string; // YYYY-MM-DD
  hora?: string; // HH:mm
  status: 'agendado' | 'realizado' | 'cancelado';
  valor?: number;
  anotacoes?: string;
}

export interface MetricaSaude {
  id: string;
  tipo: 'pressao' | 'glicose' | 'peso' | 'temperatura' | 'outro';
  rotulo: string;
  valor: string; // Ex: "12/8" ou "76.4" ou "92"
  unidade: string;
  data: string; // YYYY-MM-DD
  hora?: string; // HH:mm
  observacoes?: string;
}

export interface RegistroPesoAltura {
  id: string;
  peso: number; // em kg (ex: 78.5)
  altura: number; // em metros (ex: 1.75)
  imc: number; // IMC calculado
  classificacao: string; // Ex: Peso Normal, Sobrepeso, etc.
  data: string; // YYYY-MM-DD
  hora?: string; // HH:mm
  observacoes?: string;
}

export interface DadosSaude {
  medicamentos: MedicamentoSaude[];
  consultas: ConsultaExameSaude[];
  metricas: MetricaSaude[];
  historicoPesoAltura?: RegistroPesoAltura[];
  pesoAlturaAtual?: {
    peso: number;
    altura: number;
    imc: number;
    classificacao?: string;
    dataAtualizacao?: string;
  };
  perfilSaude?: {
    tipoSanguineo?: string;
    convenio?: string;
    numeroConvenio?: string;
    alergias?: string;
    contatoEmergenciaNome?: string;
    contatoEmergenciaTelefone?: string;
  };
}

// 📝 Notas e Lembretes (Agenda)
export interface ItemAgenda {
  id: string;
  tipo: 'tarefa' | 'compromisso' | 'lembrete';
  titulo: string;
  data: string; // YYYY-MM-DD
  hora?: string; // HH:mm
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  concluido: boolean;
  categoria?: 'geral' | 'trabalho' | 'financeiro' | 'pessoal' | 'saude';
  descricao?: string;
}

export interface NotaRapida {
  id: string;
  titulo: string;
  conteudo: string;
  cor: string;
  fixada: boolean;
  dataAtualizacao: string;
}

export interface DadosAgenda {
  itens: ItemAgenda[];
  notas: NotaRapida[];
}

