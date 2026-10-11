import { jsPDF } from 'jspdf';
import { Conta } from '../types';

/**
 * Formata um valor numérico para a moeda brasileira (R$)
 * Respeita o modo de privacidade mascarando com bolinhas
 */
export function formatCurrency(val: number, isPrivate: boolean = false): string {
  if (isPrivate) return '••••••';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0);
}

/**
 * Converte YYYY-MM-DD para DD/MM/YYYY
 */
export function isoParaBR(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Converte DD/MM/YYYY para YYYY-MM-DD
 */
export function brParaISO(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return dateStr;
}

/**
 * Retorna Mês/Ano formatado como MM/AAAA
 */
export function getMesAno(dateStr: string): string {
  if (!dateStr) return 'Geral';
  const parts = dateStr.split('-');
  if (parts.length >= 2) {
    return `${parts[1]}/${parts[0]}`;
  }
  return 'Geral';
}

/**
 * Adiciona 1 mês para a data mantendo o mesmo dia ou ajustando se o próximo mês tiver menos dias
 */
export function proximoMes(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const dt = new Date(`${dateStr}T12:00:00`);
  dt.setMonth(dt.getMonth() + 1);
  return dt.toISOString().split('T')[0];
}

/**
 * Determina status de vencimento
 */
export function getInfoVencimento(dateStr: string): {
  texto: string;
  classe: 'vencido' | 'hoje' | 'normal';
  dias: number;
} {
  if (!dateStr) return { texto: 'Sem data', classe: 'normal', dias: 0 };
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const venc = new Date(`${dateStr}T12:00:00`);
  venc.setHours(0, 0, 0, 0);

  const diffMs = venc.getTime() - hoje.getTime();
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias < 0) {
    return {
      texto: `Venceu há ${Math.abs(diffDias)} ${Math.abs(diffDias) === 1 ? 'dia' : 'dias'}`,
      classe: 'vencido',
      dias: diffDias,
    };
  }
  if (diffDias === 0) {
    return { texto: 'Vence hoje', classe: 'hoje', dias: 0 };
  }
  if (diffDias === 1) {
    return { texto: 'Vence amanhã', classe: 'normal', dias: 1 };
  }
  return { texto: `Vence em ${diffDias} dias`, classe: 'normal', dias: diffDias };
}

/**
 * Redimensiona imagem no canvas do navegador para salvar pouco tráfego e espaço
 */
export async function redimensionarImagem(
  base64: string,
  maxWidth: number = 300
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      } else {
        resolve(base64);
      }
    };
    img.onerror = () => resolve(base64);
  });
}

/**
 * Compartilhar resumo do mês formatado para o WhatsApp
 */
export function compartilharMesWhatsApp(mes: string, contasDoMes: Conta[]) {
  let texto = `📅 *Demonstrativo Financeiro - ${mes}*\n\n`;

  const ordenadas = [...contasDoMes]
    .filter((c) => !c.oculta || c.paga)
    .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime());

  let total = 0;
  let pago = 0;

  ordenadas.forEach((c) => {
    total += c.valor;
    if (c.paga) pago += c.valor;

    const status = c.paga ? '✅' : '⭕';
    let infoParcela = '';
    let infoFinanceira = '';

    if (c.totalParcelas && c.totalParcelas > 0) {
      infoParcela = ` (${c.parcelaAtual}/${c.totalParcelas})`;
      if (c.valorTotalOriginal) {
        const parcelasContadas = c.paga ? (c.parcelaAtual || 1) : Math.max(0, (c.parcelaAtual || 1) - 1);
        const jaPago = (parcelasContadas * c.valor).toFixed(2);
        infoFinanceira = `\n   ↳ Total da Compra: R$ ${c.valorTotalOriginal.toFixed(2)} | Já Pago: R$ ${jaPago}`;
      }
    } else if (c.recorrente) {
      infoParcela = ' (Fixo Mensal)';
    }

    const pagadorTxt = c.pagador ? ` [${c.pagador}]` : '';
    texto += `${status} *${c.nome}*${pagadorTxt}${infoParcela}: R$ ${c.valor.toFixed(2)} - Venc: ${isoParaBR(c.vencimento)}${infoFinanceira}\n\n`;
  });

  const falta = total - pago;
  texto += `➖➖➖➖➖➖➖➖\n`;
  texto += `💰 *Total do Mês:* R$ ${total.toFixed(2)}\n`;
  texto += `✅ *Pago no Mês:* R$ ${pago.toFixed(2)}\n`;
  texto += `⏳ *Restante:* R$ ${falta.toFixed(2)}`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
  window.open(url, '_blank');
}

/**
 * Compartilhar conta individual no WhatsApp
 */
export function compartilharIndividualWhatsApp(c: Conta) {
  let extra = '';
  if (c.totalParcelas && c.totalParcelas > 0 && c.valorTotalOriginal) {
    const parcelasContadas = c.paga ? (c.parcelaAtual || 1) : Math.max(0, (c.parcelaAtual || 1) - 1);
    const jaPago = (parcelasContadas * c.valor).toFixed(2);
    extra = `\n📦 Parcela: ${c.parcelaAtual}/${c.totalParcelas}\n🏷️ Total Compra: R$ ${c.valorTotalOriginal.toFixed(2)}\n💸 Acumulado Pago: R$ ${jaPago}`;
  }

  const pagadorTxt = c.pagador ? ` (${c.pagador})` : '';
  const texto = `🧾 *${c.nome}*${pagadorTxt}\n💰 *Valor:* R$ ${c.valor.toFixed(2)}\n🗓 *Vencimento:* ${isoParaBR(c.vencimento)}\n📌 *Status:* ${c.paga ? 'PAGO ✅' : 'PENDENTE ⭕'}${extra}`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
  window.open(url, '_blank');
}

/**
 * Gerar PDF do Mês
 */
export function baixarPdfMes(mes: string, contasDoMes: Conta[]) {
  try {
    const doc = new jsPDF();
    doc.setFillColor(15, 15, 26);
    doc.rect(0, 0, 210, 297, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(`EXTRATO FINANCEIRO - ${mes}`, 105, 22, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 200);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 105, 30, { align: 'center' });

    let y = 46;
    let total = 0;
    let pago = 0;

    // Header tabela
    doc.setFillColor(30, 30, 48);
    doc.rect(14, y - 6, 182, 10, 'F');
    doc.setTextColor(167, 139, 250);
    doc.setFont('helvetica', 'bold');
    doc.text('Vencimento', 18, y);
    doc.text('Descrição / Pagador', 52, y);
    doc.text('Valor', 140, y);
    doc.text('Status', 172, y);

    y += 10;
    doc.setFont('helvetica', 'normal');

    const itens = contasDoMes
      .filter((c) => !c.oculta || c.paga)
      .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime());

    itens.forEach((c) => {
      if (y > 270) {
        doc.addPage();
        doc.setFillColor(15, 15, 26);
        doc.rect(0, 0, 210, 297, 'F');
        y = 25;
      }

      total += c.valor;
      if (c.paga) pago += c.valor;

      let nomeDisplay = c.nome;
      if (c.pagador) nomeDisplay += ` (${c.pagador})`;
      if (c.totalParcelas && c.totalParcelas > 0) {
        nomeDisplay += ` [${c.parcelaAtual}/${c.totalParcelas}]`;
      }

      doc.setTextColor(200, 200, 220);
      doc.text(isoParaBR(c.vencimento), 18, y);

      const truncatedName = nomeDisplay.length > 34 ? `${nomeDisplay.substring(0, 32)}...` : nomeDisplay;
      doc.text(truncatedName, 52, y);

      doc.setTextColor(255, 255, 255);
      doc.text(`R$ ${c.valor.toFixed(2)}`, 140, y);

      if (c.paga) {
        doc.setTextColor(52, 211, 153);
        doc.text('PAGO', 172, y);
      } else {
        doc.setTextColor(248, 113, 113);
        doc.text('PENDENTE', 172, y);
      }

      y += 8;
    });

    // Linha de total
    y += 6;
    doc.setDrawColor(80, 70, 120);
    doc.line(14, y, 196, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`TOTAL GERAL: R$ ${total.toFixed(2)}`, 18, y);
    doc.setTextColor(52, 211, 153);
    doc.text(`PAGO: R$ ${pago.toFixed(2)}`, 90, y);
    doc.setTextColor(248, 113, 113);
    doc.text(`FALTA: R$ ${(total - pago).toFixed(2)}`, 150, y);

    doc.save(`Extrato_${mes.replace('/', '-')}.pdf`);
  } catch (err) {
    console.error('Erro ao gerar PDF do mês:', err);
    alert('Erro ao gerar PDF do mês. Verifique os dados.');
  }
}

/**
 * Gerar comprovante individual PDF
 */
export function gerarComprovanteIndividualPdf(c: Conta, pagadorPadrao: string = 'Sutello') {
  try {
    const doc = new jsPDF();
    doc.setFillColor(15, 15, 26);
    doc.rect(0, 0, 210, 297, 'F');

    // Moldura do recibo
    doc.setDrawColor(124, 58, 237);
    doc.setLineWidth(1);
    doc.roundedRect(15, 20, 180, 120, 4, 4);

    doc.setTextColor(167, 139, 250);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('RECIBO DE PAGAMENTO', 105, 40, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(220, 220, 235);
    doc.setFont('helvetica', 'normal');

    const pagador = c.pagador || pagadorPadrao;
    doc.text(`Pagador: ${pagador}`, 25, 60);

    let refText = c.nome;
    if (c.totalParcelas && c.totalParcelas > 0) {
      refText += ` (Parcela ${c.parcelaAtual} de ${c.totalParcelas})`;
    } else if (c.recorrente) {
      refText += ` (Assinatura / Conta Fixa)`;
    }
    doc.text(`Referente a: ${refText}`, 25, 72);

    doc.text(`Valor da Parcela / Conta: R$ ${c.valor.toFixed(2)}`, 25, 84);

    if (c.valorTotalOriginal) {
      doc.text(`Valor Total Original: R$ ${c.valorTotalOriginal.toFixed(2)}`, 25, 96);
    }

    doc.text(`Vencimento: ${isoParaBR(c.vencimento)}`, 25, 108);

    if (c.paga) {
      doc.setTextColor(52, 211, 153);
      doc.setFont('helvetica', 'bold');
      doc.text(`STATUS: PAGO COM SUCESSO ✅ (${c.dataPagamento ? isoParaBR(c.dataPagamento) : 'Confirmado'})`, 25, 122);
    } else {
      doc.setTextColor(248, 113, 113);
      doc.setFont('helvetica', 'bold');
      doc.text('STATUS: PENDENTE DE PAGAMENTO ⭕', 25, 122);
    }

    doc.save(`Recibo_${c.nome.replace(/\s+/g, '_')}.pdf`);
  } catch (err) {
    console.error('Erro ao gerar recibo PDF:', err);
    alert('Erro ao gerar recibo em PDF.');
  }
}
