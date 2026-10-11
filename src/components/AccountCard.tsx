import React, { useState } from 'react';
import {
  CheckCircle2,
  Undo2,
  ChevronDown,
  ChevronUp,
  QrCode,
  Edit2,
  CalendarPlus,
  Copy,
  FileText,
  Share2,
  Trash2,
  Clock,
  AlertTriangle,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { Conta } from '../types';
import { formatCurrency, isoParaBR, getInfoVencimento } from '../lib/utils';

interface AccountCardProps {
  conta: Conta;
  isPrivate: boolean;
  onPay: (conta: Conta) => void;
  onUndoPay: (conta: Conta) => void;
  onEdit: (conta: Conta) => void;
  onPostpone: (conta: Conta) => void;
  onClone: (conta: Conta) => void;
  onDelete: (conta: Conta) => void;
  onCopyPix: (conta: Conta) => void;
  onShareWhatsApp: (conta: Conta) => void;
  onDownloadReceipt: (conta: Conta) => void;
}

export const AccountCard: React.FC<AccountCardProps> = React.memo(({
  conta,
  isPrivate,
  onPay,
  onUndoPay,
  onEdit,
  onPostpone,
  onClone,
  onDelete,
  onCopyPix,
  onShareWhatsApp,
  onDownloadReceipt,
}) => {
  const [expanded, setExpanded] = useState(false);
  const vencInfo = getInfoVencimento(conta.vencimento);

  // Ícone inteligente baseado nas palavras do nome da conta
  const getCategoryIcon = (nome: string) => {
    const n = (nome || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    // 1. Academia, Treino, Esporte e Suplementos
    if (
      n.includes('academia') ||
      n.includes('smartfit') ||
      n.includes('smart fit') ||
      n.includes('treino') ||
      n.includes('crossfit') ||
      n.includes('pilates') ||
      n.includes('musculacao') ||
      n.includes('fitness') ||
      n.includes('gym') ||
      n.includes('whey') ||
      n.includes('creatina') ||
      n.includes('suplemento') ||
      n.includes('personal') ||
      n.includes('natacao') ||
      n.includes('futebol') ||
      n.includes('esporte') ||
      n.includes('luta') ||
      n.includes('jiu') ||
      n.includes('boxe')
    ) {
      return '🏋️';
    }

    // 2. Celular, Recarga, Telefone, Chip e Aparelhos
    if (
      n.includes('celular') ||
      n.includes('recarga') ||
      n.includes('telefone') ||
      n.includes('chip') ||
      n.includes('tim') ||
      n.includes('movel') ||
      n.includes('pre-pago') ||
      n.includes('pre pago') ||
      n.includes('pos-pago') ||
      n.includes('pos pago') ||
      n.includes('iphone') ||
      n.includes('samsung') ||
      n.includes('xiaomi') ||
      n.includes('motorola') ||
      n.includes('smartphone')
    ) {
      return '📱';
    }

    // 3. Luz e Energia Elétrica
    if (
      n.includes('luz') ||
      n.includes('energia') ||
      n.includes('eletrica') ||
      n.includes('enel') ||
      n.includes('cemig') ||
      n.includes('cpfl') ||
      n.includes('light') ||
      n.includes('neoenergia') ||
      n.includes('copel') ||
      n.includes('celesc') ||
      n.includes('equatorial') ||
      n.includes('coelba')
    ) {
      return '⚡';
    }

    // 4. Água e Saneamento
    if (
      n.includes('agua') ||
      n.includes('sabesp') ||
      n.includes('copasa') ||
      n.includes('sanepar') ||
      n.includes('embasa') ||
      n.includes('cedae') ||
      n.includes('cagece') ||
      n.includes('corsan') ||
      n.includes('caesb') ||
      n.includes('esgoto') ||
      n.includes('saneamento')
    ) {
      return '💧';
    }

    // 5. Gás
    if (
      n.includes('gas') ||
      n.includes('botijao') ||
      n.includes('ultragaz') ||
      n.includes('supergasbras') ||
      n.includes('liquigas') ||
      n.includes('comgas')
    ) {
      return '🔥';
    }

    // 6. Internet, Wi-Fi, Fibra e TV a Cabo
    if (
      n.includes('internet') ||
      n.includes('wifi') ||
      n.includes('wi-fi') ||
      n.includes('fibra') ||
      n.includes('banda larga') ||
      n.includes('net') ||
      n.includes('claro') ||
      n.includes('vivo') ||
      n.includes('oi ') ||
      n.includes('sky') ||
      n.includes('starlink') ||
      n.includes('modem')
    ) {
      return '🌐';
    }

    // 7. Streaming, Filmes, Música e Jogos
    if (
      n.includes('jogo') ||
      n.includes('game') ||
      n.includes('playstation') ||
      n.includes('psn') ||
      n.includes('xbox') ||
      n.includes('steam') ||
      n.includes('nintendo')
    ) {
      return '🎮';
    }
    if (n.includes('spotify') || n.includes('deezer') || n.includes('musica') || n.includes('apple music')) {
      return '🎵';
    }
    if (
      n.includes('netflix') ||
      n.includes('prime') ||
      n.includes('disney') ||
      n.includes('hbo') ||
      n.includes('max') ||
      n.includes('globoplay') ||
      n.includes('youtube') ||
      n.includes('cinema') ||
      n.includes('filme') ||
      n.includes('streaming') ||
      n.includes('tv')
    ) {
      return '🎬';
    }

    // 8. Veículos, Moto, Combustível, Transporte e Manutenção
    if (n.includes('moto') || n.includes('capacete') || n.includes('honda') || n.includes('yamaha')) {
      return '🏍️';
    }
    if (
      n.includes('gasolina') ||
      n.includes('combustivel') ||
      n.includes('etanol') ||
      n.includes('alcool') ||
      n.includes('diesel') ||
      n.includes('posto') ||
      n.includes('abastecimento')
    ) {
      return '⛽';
    }
    if (
      n.includes('uber') ||
      n.includes('99') ||
      n.includes('taxi') ||
      n.includes('onibus') ||
      n.includes('metro') ||
      n.includes('passagem') ||
      n.includes('pedagio') ||
      n.includes('transporte')
    ) {
      return '🚕';
    }
    if (
      n.includes('carro') ||
      n.includes('veiculo') ||
      n.includes('automovel') ||
      n.includes('ipva') ||
      n.includes('multa') ||
      n.includes('detran') ||
      n.includes('mecanico') ||
      n.includes('oficina') ||
      n.includes('pneu') ||
      n.includes('oleo') ||
      n.includes('revisao') ||
      n.includes('estacionamento') ||
      n.includes('lava jato') ||
      n.includes('lavajato') ||
      n.includes('seguro auto')
    ) {
      return '🚗';
    }

    // 9. Alimentação, Lanche, Restaurante e Mercado
    if (
      n.includes('ifood') ||
      n.includes('restaurante') ||
      n.includes('lanche') ||
      n.includes('pizza') ||
      n.includes('hamburguer') ||
      n.includes('burger') ||
      n.includes('sushi') ||
      n.includes('acai') ||
      n.includes('sorvete') ||
      n.includes('cafe') ||
      n.includes('almoco') ||
      n.includes('jantar') ||
      n.includes('padaria') ||
      n.includes('bar') ||
      n.includes('cerveja') ||
      n.includes('churrasco') ||
      n.includes('bebida')
    ) {
      return '🍔';
    }
    if (
      n.includes('mercado') ||
      n.includes('supermercado') ||
      n.includes('atacadao') ||
      n.includes('assai') ||
      n.includes('carrefour') ||
      n.includes('feira') ||
      n.includes('hortifruti') ||
      n.includes('sacolao') ||
      n.includes('acougue') ||
      n.includes('carne') ||
      n.includes('alimento') ||
      n.includes('comida')
    ) {
      return '🛒';
    }

    // 10. Saúde, Farmácia, Médico e Dentista
    if (
      n.includes('farmacia') ||
      n.includes('remedio') ||
      n.includes('medicamento') ||
      n.includes('drogaria') ||
      n.includes('drogasil') ||
      n.includes('raia')
    ) {
      return '💊';
    }
    if (n.includes('dentista') || n.includes('odonto') || n.includes('dente')) {
      return '🦷';
    }
    if (
      n.includes('medico') ||
      n.includes('consulta') ||
      n.includes('exame') ||
      n.includes('hospital') ||
      n.includes('clinica') ||
      n.includes('unimed') ||
      n.includes('saude') ||
      n.includes('psicologo') ||
      n.includes('terapia') ||
      n.includes('oculos') ||
      n.includes('otica')
    ) {
      return '🩺';
    }

    // 11. Beleza, Barbearia, Roupas, Calçados e Compras Online
    if (
      n.includes('barbearia') ||
      n.includes('barbeiro') ||
      n.includes('cabelo') ||
      n.includes('corte') ||
      n.includes('salao') ||
      n.includes('manicure') ||
      n.includes('unha') ||
      n.includes('estetica') ||
      n.includes('perfume') ||
      n.includes('cosmetico') ||
      n.includes('boticario') ||
      n.includes('natura')
    ) {
      return '✂️';
    }
    if (n.includes('tenis') || n.includes('sapato') || n.includes('calcado') || n.includes('chinelo')) {
      return '👟';
    }
    if (
      n.includes('roupa') ||
      n.includes('camisa') ||
      n.includes('camiseta') ||
      n.includes('calca') ||
      n.includes('vestido') ||
      n.includes('blusa') ||
      n.includes('shein') ||
      n.includes('shopee') ||
      n.includes('mercado livre') ||
      n.includes('amazon') ||
      n.includes('aliexpress') ||
      n.includes('magalu') ||
      n.includes('casas bahia') ||
      n.includes('renner') ||
      n.includes('riachuelo') ||
      n.includes('cea') ||
      n.includes('shopping') ||
      n.includes('loja') ||
      n.includes('compra')
    ) {
      return '🛍️';
    }

    // 12. Educação, Escola, Faculdade e Cursos
    if (
      n.includes('escola') ||
      n.includes('colegio') ||
      n.includes('faculdade') ||
      n.includes('universidade') ||
      n.includes('curso') ||
      n.includes('ingles') ||
      n.includes('livro') ||
      n.includes('apostila') ||
      n.includes('creche') ||
      n.includes('educacao')
    ) {
      return '🎓';
    }

    // 13. Pet / Animais
    if (
      n.includes('pet') ||
      n.includes('racao') ||
      n.includes('cachorro') ||
      n.includes('gato') ||
      n.includes('veterinario') ||
      n.includes('banho e tosa')
    ) {
      return '🐾';
    }

    // 14. Viagem, Hotel e Lazer
    if (
      n.includes('viagem') ||
      n.includes('hotel') ||
      n.includes('pousada') ||
      n.includes('airbnb') ||
      n.includes('aviao') ||
      n.includes('voo') ||
      n.includes('ferias') ||
      n.includes('praia')
    ) {
      return '✈️';
    }

    // 15. Casa, Moradia, Aluguel, Condomínio, Móveis e Eletros
    if (
      n.includes('aluguel') ||
      n.includes('condominio') ||
      n.includes('casa') ||
      n.includes('apartamento') ||
      n.includes('iptu') ||
      n.includes('reforma') ||
      n.includes('obra') ||
      n.includes('pedreiro') ||
      n.includes('moveis') ||
      n.includes('sofa') ||
      n.includes('cama') ||
      n.includes('geladeira') ||
      n.includes('fogao') ||
      n.includes('lavadora') ||
      n.includes('ar condicionado') ||
      n.includes('faxina') ||
      n.includes('diarista')
    ) {
      return '🏠';
    }

    // 16. Cartão de Crédito, Bancos, Empréstimos e Financiamentos
    if (
      n.includes('card') ||
      n.includes('cartao') ||
      n.includes('nubank') ||
      n.includes('fatura') ||
      n.includes('inter') ||
      n.includes('itau') ||
      n.includes('bradesco') ||
      n.includes('santander') ||
      n.includes('caixa') ||
      n.includes('banco') ||
      n.includes('c6') ||
      n.includes('picpay') ||
      n.includes('mercado pago') ||
      n.includes('mercadopago') ||
      n.includes('will') ||
      n.includes('neon') ||
      n.includes('pan') ||
      n.includes('emprestimo') ||
      n.includes('financiamento') ||
      n.includes('consorcio')
    ) {
      return '💳';
    }

    // 17. Impostos, Taxas, Seguros e Serviços
    if (
      n.includes('imposto') ||
      n.includes('mei') ||
      n.includes('das') ||
      n.includes('inss') ||
      n.includes('taxa') ||
      n.includes('seguro') ||
      n.includes('contador') ||
      n.includes('cartorio') ||
      n.includes('advogado')
    ) {
      return '📋';
    }

    // 18. Presentes, Festas, Dízimo e Doações
    if (
      n.includes('presente') ||
      n.includes('aniversario') ||
      n.includes('festa') ||
      n.includes('casamento') ||
      n.includes('dizimo') ||
      n.includes('oferta') ||
      n.includes('igreja') ||
      n.includes('doacao') ||
      n.includes('pensao') ||
      n.includes('mesada')
    ) {
      return '🎁';
    }

    return '📄';
  };

  return (
    <div
      className={`border rounded-2xl p-4 transition-all ${
        conta.paga
          ? 'bg-[#10101c]/60 border-white/5 opacity-70 hover:opacity-100'
          : vencInfo.classe === 'vencido'
          ? 'bg-red-500/5 border-red-500/30 shadow-sm'
          : vencInfo.classe === 'hoje'
          ? 'bg-amber-500/5 border-amber-500/30'
          : 'bg-[#141422] border-white/10 hover:border-white/20'
      }`}
    >
      {/* Topo do Card */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <span className="text-xl shrink-0 p-1.5 bg-white/5 rounded-xl border border-white/10 mt-0.5">
            {getCategoryIcon(conta.nome)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4
                className={`font-semibold text-sm break-words leading-snug ${
                  conta.paga ? 'line-through text-neutral-400' : 'text-white'
                }`}
              >
                {conta.nome}
              </h4>
              {conta.pagador && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                  {conta.pagador}
                </span>
              )}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>🗓 {isoParaBR(conta.vencimento)}</span>
              {conta.totalParcelas && conta.totalParcelas > 0 ? (
                <span className="text-purple-400 font-medium">
                  🔢 {conta.parcelaAtual || 1}/{conta.totalParcelas}
                </span>
              ) : conta.recorrente ? (
                <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                  <RefreshCw className="w-3 h-3" /> Fixa
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="shrink-0">
          {conta.paga ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3" /> PAGO
            </span>
          ) : vencInfo.classe === 'vencido' ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse">
              <AlertTriangle className="w-3 h-3" /> VENCIDO
            </span>
          ) : vencInfo.classe === 'hoje' ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <Clock className="w-3 h-3" /> HOJE
            </span>
          ) : (
            <span className="text-[10px] font-medium text-neutral-400 px-2 py-0.5 rounded-full bg-white/5">
              {vencInfo.texto}
            </span>
          )}
        </div>
      </div>

      {/* Valor */}
      <div className="mt-3 flex items-baseline justify-between">
        <div>
          <span className="text-xs text-neutral-400 block font-medium">Valor</span>
          <span
            className={`text-xl font-bold font-display tracking-tight ${
              isPrivate ? 'privacy-blur' : 'text-white'
            }`}
          >
            {formatCurrency(conta.valor, isPrivate)}
          </span>
        </div>

        {conta.valorTotalOriginal && conta.totalParcelas && conta.totalParcelas > 0 && (
          <div className="text-right text-[11px] text-neutral-400">
            <span>Total da compra: </span>
            <span className={`font-semibold text-neutral-300 ${isPrivate ? 'privacy-blur' : ''}`}>
              {formatCurrency(conta.valorTotalOriginal, isPrivate)}
            </span>
          </div>
        )}
      </div>

      {/* Ações Primárias */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5 touch-manipulation select-none">
        {!conta.paga ? (
          <button
            type="button"
            onClick={() => onPay(conta)}
            className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.97] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 transition-transform duration-75 touch-manipulation"
          >
            <CheckCircle2 className="w-4 h-4 pointer-events-none" />
            PAGAR
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onUndoPay(conta)}
            className="flex-1 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.97] text-neutral-300 font-medium text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-transform duration-75 touch-manipulation"
          >
            <Undo2 className="w-4 h-4 pointer-events-none" />
            DESFAZER
          </button>
        )}

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={`w-10 h-9 rounded-xl flex items-center justify-center transition-transform duration-75 active:scale-95 border touch-manipulation ${
            expanded
              ? 'bg-purple-600/30 text-purple-300 border-purple-500/40'
              : 'bg-white/5 hover:bg-white/10 text-neutral-400 border-white/10'
          }`}
          title="Mais opções"
        >
          {expanded ? <ChevronUp className="w-4 h-4 pointer-events-none" /> : <ChevronDown className="w-4 h-4 pointer-events-none" />}
        </button>
      </div>

      {/* Menu Secundário Expansível */}
      {expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-white/10 text-xs animate-in slide-in-from-top-2 duration-100 touch-manipulation select-none">
          <button
            type="button"
            onClick={() => onCopyPix(conta)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/20 active:scale-95 text-neutral-300 flex items-center justify-center gap-1.5 transition-transform duration-75 border border-white/5 touch-manipulation"
          >
            <QrCode className="w-3.5 h-3.5 text-purple-400 pointer-events-none" />
            Pix
          </button>

          <button
            type="button"
            onClick={() => onEdit(conta)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/20 active:scale-95 text-neutral-300 flex items-center justify-center gap-1.5 transition-transform duration-75 border border-white/5 touch-manipulation"
          >
            <Edit2 className="w-3.5 h-3.5 text-blue-400 pointer-events-none" />
            Editar
          </button>

          <button
            type="button"
            onClick={() => onPostpone(conta)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/20 active:scale-95 text-neutral-300 flex items-center justify-center gap-1.5 transition-transform duration-75 border border-white/5 touch-manipulation"
          >
            <CalendarPlus className="w-3.5 h-3.5 text-amber-400 pointer-events-none" />
            Adiar +1 Mês
          </button>

          <button
            type="button"
            onClick={() => onClone(conta)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/20 active:scale-95 text-neutral-300 flex items-center justify-center gap-1.5 transition-transform duration-75 border border-white/5 touch-manipulation"
          >
            <Copy className="w-3.5 h-3.5 text-emerald-400 pointer-events-none" />
            Clonar
          </button>

          <button
            type="button"
            onClick={() => onDownloadReceipt(conta)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/20 active:scale-95 text-neutral-300 flex items-center justify-center gap-1.5 transition-transform duration-75 border border-white/5 touch-manipulation"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400 pointer-events-none" />
            Recibo PDF
          </button>

          <button
            type="button"
            onClick={() => onShareWhatsApp(conta)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/20 active:scale-95 text-neutral-300 flex items-center justify-center gap-1.5 transition-transform duration-75 border border-white/5 touch-manipulation"
          >
            <Share2 className="w-3.5 h-3.5 text-green-400 pointer-events-none" />
            WhatsApp
          </button>

          <button
            type="button"
            onClick={() => onDelete(conta)}
            className="col-span-2 p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 active:scale-95 text-red-400 flex items-center justify-center gap-1.5 transition-transform duration-75 border border-red-500/20 touch-manipulation"
          >
            <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
            Excluir Conta
          </button>
        </div>
      )}
    </div>
  );
});
