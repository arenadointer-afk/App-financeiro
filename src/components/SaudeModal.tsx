import React, { useState, useMemo } from 'react';
import {
  X,
  Heart,
  Pill,
  Calendar,
  Activity,
  UserCheck,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Phone,
  Droplet,
  Scale,
  Shield,
  Stethoscope,
  Check,
  Share2,
  TrendingDown,
  TrendingUp,
  Minus,
  Sparkles,
  Info
} from 'lucide-react';
import {
  DadosSaude,
  MedicamentoSaude,
  ConsultaExameSaude,
  MetricaSaude,
  RegistroPesoAltura
} from '../types';

interface SaudeModalProps {
  isOpen: boolean;
  onClose: () => void;
  dadosSaude: DadosSaude;
  onSaveSaude: (dados: DadosSaude) => void;
}

// Utilitário de Cálculo de IMC e Classificação da OMS
export function calcularIMC(peso: number, altura: number) {
  let h = altura;
  if (h > 3) h = h / 100; // Converte cm para metros (ex: 175 -> 1.75)
  if (h <= 0 || peso <= 0) {
    return {
      imc: 0,
      classificacao: 'Não informado',
      cor: 'text-neutral-400',
      bg: 'bg-white/5 border-white/10',
      pesoIdealMin: 0,
      pesoIdealMax: 0,
      mensagem: '',
    };
  }

  const imc = Number((peso / (h * h)).toFixed(1));
  let classificacao = 'Peso normal';
  let cor = 'text-emerald-400';
  let bg = 'bg-emerald-500/15 border-emerald-500/30';
  let mensagem = 'Seu peso está na faixa ideal para a sua altura!';

  if (imc < 18.5) {
    classificacao = 'Abaixo do peso';
    cor = 'text-sky-400';
    bg = 'bg-sky-500/15 border-sky-500/30';
    mensagem = 'Abaixo do recomendado pela OMS. Converse com seu nutricionista.';
  } else if (imc < 25.0) {
    classificacao = 'Peso ideal (Normal)';
    cor = 'text-emerald-400';
    bg = 'bg-emerald-500/15 border-emerald-500/30';
    mensagem = 'Excelente! Você está na faixa de peso mais saudável.';
  } else if (imc < 30.0) {
    classificacao = 'Sobrepeso';
    cor = 'text-amber-400';
    bg = 'bg-amber-500/15 border-amber-500/30';
    mensagem = 'Um pouco acima do peso ideal. Atenção à alimentação e exercícios.';
  } else if (imc < 35.0) {
    classificacao = 'Obesidade Grau I';
    cor = 'text-rose-400';
    bg = 'bg-rose-500/15 border-rose-500/30';
    mensagem = 'Grau I de obesidade. Recomendado acompanhamento médico.';
  } else if (imc < 40.0) {
    classificacao = 'Obesidade Grau II';
    cor = 'text-red-500';
    bg = 'bg-red-600/20 border-red-600/40';
    mensagem = 'Grau II de obesidade severa. Cuide da sua saúde.';
  } else {
    classificacao = 'Obesidade Grau III (Mórbida)';
    cor = 'text-purple-400';
    bg = 'bg-purple-600/20 border-purple-600/40';
    mensagem = 'Grau III de obesidade. Acompanhamento médico prioritário.';
  }

  const pesoIdealMin = Number((18.5 * h * h).toFixed(1));
  const pesoIdealMax = Number((24.9 * h * h).toFixed(1));

  return { imc, classificacao, cor, bg, pesoIdealMin, pesoIdealMax, mensagem };
}

export const SaudeModal: React.FC<SaudeModalProps> = ({
  isOpen,
  onClose,
  dadosSaude,
  onSaveSaude,
}) => {
  const [activeTab, setActiveTab] = useState<'pesoxaltura' | 'remedios' | 'consultas' | 'metricas' | 'cartao'>('pesoxaltura');

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Modais de Criação
  const [showAddPesoAltura, setShowAddPesoAltura] = useState(false);
  const [showAddRemedio, setShowAddRemedio] = useState(false);
  const [showAddConsulta, setShowAddConsulta] = useState(false);
  const [showAddMetrica, setShowAddMetrica] = useState(false);
  const [editingPerfil, setEditingPerfil] = useState(false);

  // Estados Peso x Altura
  const [inputPeso, setInputPeso] = useState('');
  const [inputAltura, setInputAltura] = useState('');
  const [inputDataPeso, setInputDataPeso] = useState(new Date().toISOString().split('T')[0]);
  const [inputHoraPeso, setInputHoraPeso] = useState(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  const [inputObsPeso, setInputObsPeso] = useState('');

  // Estados Medicamentos
  const [remNome, setRemNome] = useState('');
  const [remDose, setRemDose] = useState('');
  const [remHorarios, setRemHorarios] = useState('');
  const [remFreq, setRemFreq] = useState('');
  const [remInstrucoes, setRemInstrucoes] = useState('');

  // Estados Consultas / Exames
  const [consTipo, setConsTipo] = useState<ConsultaExameSaude['tipo']>('consulta');
  const [consTitulo, setConsTitulo] = useState('');
  const [consLocal, setConsLocal] = useState('');
  const [consData, setConsData] = useState(new Date().toISOString().split('T')[0]);
  const [consHora, setConsHora] = useState('');
  const [consValor, setConsValor] = useState('');
  const [consNotas, setConsNotas] = useState('');

  // Estados Métricas
  const [metTipo, setMetTipo] = useState<MetricaSaude['tipo']>('pressao');
  const [metRotulo, setMetRotulo] = useState('Pressão Arterial');
  const [metValor, setMetValor] = useState('');
  const [metUnidade, setMetUnidade] = useState('mmHg');
  const [metData, setMetData] = useState(new Date().toISOString().split('T')[0]);
  const [metHora, setMetHora] = useState(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  const [metObs, setMetObs] = useState('');

  // Estados Perfil de Saúde
  const [tipoSanguineo, setTipoSanguineo] = useState(dadosSaude.perfilSaude?.tipoSanguineo || '');
  const [convenio, setConvenio] = useState(dadosSaude.perfilSaude?.convenio || '');
  const [numConvenio, setNumConvenio] = useState(dadosSaude.perfilSaude?.numeroConvenio || '');
  const [alergias, setAlergias] = useState(dadosSaude.perfilSaude?.alergias || '');
  const [emergenciaNome, setEmergenciaNome] = useState(dadosSaude.perfilSaude?.contatoEmergenciaNome || '');
  const [emergenciaTel, setEmergenciaTel] = useState(dadosSaude.perfilSaude?.contatoEmergenciaTelefone || '');

  const dataHojeStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Histórico ordenado de Peso x Altura (mais recente primeiro)
  const historicoPesosOrdenado = useMemo(() => {
    const list = dadosSaude.historicoPesoAltura || [];
    return list.slice().sort((a, b) => {
      const dataA = a.data + (a.hora ? 'T' + a.hora : 'T00:00:00');
      const dataB = b.data + (b.hora ? 'T' + b.hora : 'T00:00:00');
      return dataB.localeCompare(dataA);
    });
  }, [dadosSaude.historicoPesoAltura]);

  // Medição mais recente
  const ultimaMedicaoPeso = useMemo(() => {
    if (historicoPesosOrdenado.length > 0) return historicoPesosOrdenado[0];
    if (dadosSaude.pesoAlturaAtual?.peso) {
      return {
        id: 'peso_atual',
        peso: dadosSaude.pesoAlturaAtual.peso,
        altura: dadosSaude.pesoAlturaAtual.altura,
        imc: dadosSaude.pesoAlturaAtual.imc,
        classificacao: dadosSaude.pesoAlturaAtual.classificacao || 'Peso normal',
        data: dadosSaude.pesoAlturaAtual.dataAtualizacao || new Date().toISOString().split('T')[0],
      };
    }
    return null;
  }, [historicoPesosOrdenado, dadosSaude.pesoAlturaAtual]);

  // Análise da última medição
  const analiseAtual = useMemo(() => {
    if (!ultimaMedicaoPeso) return null;
    return calcularIMC(ultimaMedicaoPeso.peso, ultimaMedicaoPeso.altura);
  }, [ultimaMedicaoPeso]);

  // ==========================================
  // Handlers Peso x Altura
  // ==========================================
  const handleOpenAddPesoAltura = () => {
    if (ultimaMedicaoPeso?.altura) {
      setInputAltura(String(ultimaMedicaoPeso.altura));
    }
    if (ultimaMedicaoPeso?.peso) {
      setInputPeso(String(ultimaMedicaoPeso.peso));
    }
    setInputDataPeso(new Date().toISOString().split('T')[0]);
    setInputHoraPeso(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    setInputObsPeso('');
    setShowAddPesoAltura(true);
  };

  const handleSavePesoAltura = (e: React.FormEvent) => {
    e.preventDefault();
    const pesoNum = parseFloat(inputPeso.replace(',', '.'));
    let alturaNum = parseFloat(inputAltura.replace(',', '.'));

    if (!pesoNum || pesoNum <= 0 || !alturaNum || alturaNum <= 0) {
      alert('Por favor, informe peso e altura válidos.');
      return;
    }

    if (alturaNum > 3) alturaNum = alturaNum / 100; // se informou 175 -> 1.75

    const calc = calcularIMC(pesoNum, alturaNum);
    const novo: RegistroPesoAltura = {
      id: 'peso_' + Date.now(),
      peso: pesoNum,
      altura: alturaNum,
      imc: calc.imc,
      classificacao: calc.classificacao,
      data: inputDataPeso || new Date().toISOString().split('T')[0],
      hora: inputHoraPeso.trim() || undefined,
      observacoes: inputObsPeso.trim() || undefined,
    };

    const atual = {
      peso: pesoNum,
      altura: alturaNum,
      imc: calc.imc,
      classificacao: calc.classificacao,
      dataAtualizacao: new Date().toISOString(),
    };

    const updated: DadosSaude = {
      ...dadosSaude,
      historicoPesoAltura: [novo, ...(dadosSaude.historicoPesoAltura || [])],
      pesoAlturaAtual: atual,
    };

    onSaveSaude(updated);
    showToast(`Peso x Altura salvo com sucesso! IMC: ${calc.imc} (${calc.classificacao})`);
    setShowAddPesoAltura(false);
    setInputPeso('');
    setInputObsPeso('');
  };

  const handleDeletePesoAltura = (id: string) => {
    const list = (dadosSaude.historicoPesoAltura || []).filter((p) => p.id !== id);
    const novoUltimo = list[0];
    onSaveSaude({
      ...dadosSaude,
      historicoPesoAltura: list,
      pesoAlturaAtual: novoUltimo
        ? {
            peso: novoUltimo.peso,
            altura: novoUltimo.altura,
            imc: novoUltimo.imc,
            classificacao: novoUltimo.classificacao,
            dataAtualizacao: novoUltimo.data,
          }
        : undefined,
    });
    showToast('Registro de peso removido.');
  };

  // ==========================================
  // Handlers Medicamentos
  // ==========================================
  const handleSaveRemedio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remNome.trim()) return;

    const horariosArr = remHorarios
      .split(',')
      .map((h) => h.trim())
      .filter((h) => h.length > 0);

    const novo: MedicamentoSaude = {
      id: 'med_' + Date.now(),
      nome: remNome.trim(),
      dosagem: remDose.trim() || 'Conforme orientação',
      horarios: horariosArr.length > 0 ? horariosArr : ['08:00'],
      frequencia: remFreq.trim() || 'Diário',
      lembreteAtivo: true,
      instrucoes: remInstrucoes.trim() || undefined,
      tomadoHoje: {},
    };

    const updated = {
      ...dadosSaude,
      medicamentos: [novo, ...(dadosSaude.medicamentos || [])],
    };
    onSaveSaude(updated);
    showToast(`Medicamento "${novo.nome}" cadastrado com sucesso!`);
    setShowAddRemedio(false);
    setRemNome('');
    setRemDose('');
    setRemHorarios('');
    setRemFreq('');
    setRemInstrucoes('');
  };

  const handleToggleTomadoHoje = (medId: string, horario: string) => {
    const list = (dadosSaude.medicamentos || []).map((m) => {
      if (m.id !== medId) return m;
      const chave = `${dataHojeStr}_${horario}`;
      const statusAtual = m.tomadoHoje?.[chave] || false;
      return {
        ...m,
        tomadoHoje: {
          ...(m.tomadoHoje || {}),
          [chave]: !statusAtual,
        },
      };
    });
    onSaveSaude({ ...dadosSaude, medicamentos: list });
  };

  const handleDeleteRemedio = (id: string) => {
    const list = (dadosSaude.medicamentos || []).filter((m) => m.id !== id);
    onSaveSaude({ ...dadosSaude, medicamentos: list });
    showToast('Medicamento removido.');
  };

  // ==========================================
  // Handlers Consultas / Exames
  // ==========================================
  const handleSaveConsulta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consTitulo.trim()) return;

    const nova: ConsultaExameSaude = {
      id: 'cons_' + Date.now(),
      tipo: consTipo,
      titulo: consTitulo.trim(),
      medicoOuLocal: consLocal.trim() || 'Não informado',
      data: consData,
      hora: consHora.trim() || undefined,
      status: 'agendado',
      valor: consValor ? parseFloat(consValor.replace(',', '.')) : undefined,
      anotacoes: consNotas.trim() || undefined,
    };

    const updated = {
      ...dadosSaude,
      consultas: [nova, ...(dadosSaude.consultas || [])],
    };
    onSaveSaude(updated);
    showToast(`${consTipo === 'consulta' ? 'Consulta' : 'Exame'} cadastrado com sucesso!`);
    setShowAddConsulta(false);
    setConsTitulo('');
    setConsLocal('');
    setConsHora('');
    setConsValor('');
    setConsNotas('');
  };

  const handleToggleConsultaStatus = (id: string) => {
    const list = (dadosSaude.consultas || []).map((c) => {
      if (c.id !== id) return c;
      const novoStatus = c.status === 'agendado' ? 'realizado' : 'agendado';
      return { ...c, status: novoStatus as any };
    });
    onSaveSaude({ ...dadosSaude, consultas: list });
  };

  const handleDeleteConsulta = (id: string) => {
    const list = (dadosSaude.consultas || []).filter((c) => c.id !== id);
    onSaveSaude({ ...dadosSaude, consultas: list });
    showToast('Registro de consulta/exame removido.');
  };

  // ==========================================
  // Handlers Métricas
  // ==========================================
  const handleSaveMetrica = (e: React.FormEvent) => {
    e.preventDefault();
    if (!metValor.trim()) return;

    const nova: MetricaSaude = {
      id: 'met_' + Date.now(),
      tipo: metTipo,
      rotulo: metRotulo.trim(),
      valor: metValor.trim(),
      unidade: metUnidade.trim(),
      data: metData,
      hora: metHora.trim() || undefined,
      observacoes: metObs.trim() || undefined,
    };

    const updated = {
      ...dadosSaude,
      metricas: [nova, ...(dadosSaude.metricas || [])],
    };
    onSaveSaude(updated);
    showToast('Métrica de saúde registrada com sucesso!');
    setShowAddMetrica(false);
    setMetValor('');
    setMetObs('');
  };

  const handleDeleteMetrica = (id: string) => {
    const list = (dadosSaude.metricas || []).filter((m) => m.id !== id);
    onSaveSaude({ ...dadosSaude, metricas: list });
    showToast('Métrica excluída.');
  };

  // ==========================================
  // Handlers Perfil de Emergência
  // ==========================================
  const handleSavePerfil = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...dadosSaude,
      perfilSaude: {
        tipoSanguineo: tipoSanguineo.trim(),
        convenio: convenio.trim(),
        numeroConvenio: numConvenio.trim(),
        alergias: alergias.trim(),
        contatoEmergenciaNome: emergenciaNome.trim(),
        contatoEmergenciaTelefone: emergenciaTel.trim(),
      },
    };
    onSaveSaude(updated);
    setEditingPerfil(false);
    showToast('Cartão de emergência atualizado!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0f0f1c] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-white">
        
        {/* Toast Notificação */}
        {toastMsg && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-rose-500 text-white font-semibold text-xs py-2 px-4 rounded-full shadow-lg shadow-rose-500/20 flex items-center gap-1.5 animate-bounce">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Topo do Modal */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#141424]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600/25 border border-rose-500/30 flex items-center justify-center text-rose-300 shadow-md shadow-rose-600/20">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-display text-white">
                  Saúde & Bem-Estar
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
                  Cuidados Pessoais
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Peso x Altura (IMC), remédios diários, consultas, exames e cartão médico
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Abas de Navegação */}
        <div className="flex bg-[#121220] border-b border-white/10 px-3 pt-2 gap-1 overflow-x-auto text-xs no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('pesoxaltura')}
            className={`py-2 px-3 rounded-t-xl font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'pesoxaltura'
                ? 'bg-[#0f0f1c] text-rose-400 border-t border-x border-white/10 shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Peso x Altura</span>
            {historicoPesosOrdenado.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300">
                {historicoPesosOrdenado.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('remedios')}
            className={`py-2 px-3 rounded-t-xl font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'remedios'
                ? 'bg-[#0f0f1c] text-rose-400 border-t border-x border-white/10'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Pill className="w-4 h-4" />
            <span>Medicamentos</span>
            {(dadosSaude.medicamentos || []).length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300">
                {(dadosSaude.medicamentos || []).length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('consultas')}
            className={`py-2 px-3 rounded-t-xl font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'consultas'
                ? 'bg-[#0f0f1c] text-rose-400 border-t border-x border-white/10'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Consultas & Exames</span>
            {(dadosSaude.consultas || []).length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300">
                {(dadosSaude.consultas || []).length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('metricas')}
            className={`py-2 px-3 rounded-t-xl font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'metricas'
                ? 'bg-[#0f0f1c] text-rose-400 border-t border-x border-white/10'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Pressão / Glicose</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cartao')}
            className={`py-2 px-3 rounded-t-xl font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'cartao'
                ? 'bg-[#0f0f1c] text-rose-400 border-t border-x border-white/10'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Cartão de Emergência</span>
          </button>
        </div>

        {/* Conteúdo Principal com Scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* =========================================
              ABA 0: PESO X ALTURA (IMC)
             ========================================= */}
          {activeTab === 'pesoxaltura' && (
            <div className="space-y-4">
              
              {/* Card Resumo do IMC Atual */}
              {ultimaMedicaoPeso && analiseAtual ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#1c1424] via-[#141424] to-neutral-900 border border-rose-500/30 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block">
                        Última Medição ({new Date(ultimaMedicaoPeso.data + 'T00:00:00').toLocaleDateString('pt-BR')})
                      </span>
                      <div className="flex items-baseline gap-3 mt-1">
                        <span className="text-3xl sm:text-4xl font-extrabold font-display text-white">
                          {ultimaMedicaoPeso.peso.toFixed(1)} <span className="text-sm font-normal text-neutral-400">kg</span>
                        </span>
                        <span className="text-lg font-bold text-neutral-300 font-display">
                          • {ultimaMedicaoPeso.altura.toFixed(2)} <span className="text-xs font-normal text-neutral-400">m</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:items-end">
                      <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                        Índice de Massa Corporal
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
                          IMC {analiseAtual.imc}
                        </span>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${analiseAtual.bg} ${analiseAtual.cor}`}>
                          {analiseAtual.classificacao}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Barra Visual de IMC */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span>Magreza &lt;18.5</span>
                      <span className="text-emerald-400 font-semibold">Ideal 18.5 - 24.9</span>
                      <span className="text-amber-400 font-semibold">Sobrepeso 25 - 29.9</span>
                      <span className="text-rose-400 font-semibold">Obesidade &gt;30</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden flex relative">
                      <div className="w-[18.5%] h-full bg-sky-500/80" title="Abaixo do peso" />
                      <div className="w-[28%] h-full bg-emerald-500/80" title="Peso normal" />
                      <div className="w-[22%] h-full bg-amber-500/80" title="Sobrepeso" />
                      <div className="w-[31.5%] h-full bg-rose-500/80" title="Obesidade" />
                    </div>
                  </div>

                  {/* Informações de Peso Ideal */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-white/5 text-xs">
                    <div className="p-2.5 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                      <span className="text-neutral-400">Peso ideal para sua altura:</span>
                      <strong className="text-emerald-300 font-semibold">
                        {analiseAtual.pesoIdealMin} kg a {analiseAtual.pesoIdealMax} kg
                      </strong>
                    </div>

                    <div className="p-2.5 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                      <span className="text-neutral-400">Diferença para peso normal:</span>
                      <strong className={analiseAtual.cor}>
                        {ultimaMedicaoPeso.peso > analiseAtual.pesoIdealMax ? (
                          <span>+{(ultimaMedicaoPeso.peso - analiseAtual.pesoIdealMax).toFixed(1)} kg acima</span>
                        ) : ultimaMedicaoPeso.peso < analiseAtual.pesoIdealMin ? (
                          <span>-{(analiseAtual.pesoIdealMin - ultimaMedicaoPeso.peso).toFixed(1)} kg abaixo</span>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Na faixa ideal!
                          </span>
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-[#141424] border border-white/10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
                    <Scale className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Nenhuma medição Peso x Altura registrada</h3>
                    <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">
                      Informe seu peso e altura para calcular seu IMC automaticamente e acompanhar sua evolução física.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenAddPesoAltura}
                    className="py-2.5 px-4 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold rounded-xl text-xs inline-flex items-center gap-2 shadow-lg shadow-rose-600/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Registrar Primeiro Peso x Altura</span>
                  </button>
                </div>
              )}

              {/* Botão Adicionar & Título do Histórico */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <h4 className="text-sm font-bold text-white">Histórico de Medições</h4>
                  <p className="text-[11px] text-neutral-400">Todas as pesagens sincronizadas no Firebase</p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddPesoAltura}
                  className="py-2 px-3 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Pesagem</span>
                </button>
              </div>

              {/* Lista do Histórico */}
              {historicoPesosOrdenado.length === 0 ? (
                <div className="text-center py-6 text-xs text-neutral-500">
                  Nenhum registro anterior no histórico.
                </div>
              ) : (
                <div className="space-y-2">
                  {historicoPesosOrdenado.map((item, idx) => {
                    const anterior = historicoPesosOrdenado[idx + 1];
                    const diffPeso = anterior ? item.peso - anterior.peso : null;
                    const calc = calcularIMC(item.peso, item.altura);

                    return (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl bg-[#141424] border border-white/10 hover:border-rose-500/30 transition-all flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${calc.bg} ${calc.cor}`}>
                            <Scale className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold font-display text-white">
                                {item.peso.toFixed(1)} kg
                              </span>
                              <span className="text-xs text-neutral-400 font-mono">
                                ({item.altura.toFixed(2)} m)
                              </span>
                              <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold border ${calc.bg} ${calc.cor}`}>
                                IMC {item.imc || calc.imc} • {item.classificacao || calc.classificacao}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                              <span>📅 {new Date(item.data + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                              {item.hora && <span>às {item.hora}</span>}
                              {diffPeso !== null && (
                                <span className={`flex items-center gap-0.5 font-semibold ${
                                  diffPeso > 0 ? 'text-rose-400' : diffPeso < 0 ? 'text-emerald-400' : 'text-neutral-400'
                                }`}>
                                  {diffPeso > 0 ? <TrendingUp className="w-3 h-3" /> : diffPeso < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                  {diffPeso > 0 ? `+${diffPeso.toFixed(1)} kg` : `${diffPeso.toFixed(1)} kg`}
                                </span>
                              )}
                            </div>

                            {item.observacoes && (
                              <p className="text-[10px] text-neutral-400 italic mt-0.5">
                                "{item.observacoes}"
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Deseja excluir este registro de pesagem?')) {
                              handleDeletePesoAltura(item.id);
                            }
                          }}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-neutral-400 hover:text-red-400 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =========================================
              ABA 1: MEDICAMENTOS
             ========================================= */}
          {activeTab === 'remedios' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Meus Medicamentos Contínuos</h3>
                  <p className="text-xs text-neutral-400">Marque se já tomou a dose de hoje</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddRemedio(true)}
                  className="py-2 px-3 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Remédio</span>
                </button>
              </div>

              {(!dadosSaude.medicamentos || dadosSaude.medicamentos.length === 0) ? (
                <div className="text-center py-10 px-4 rounded-2xl bg-white/[0.02] border border-white/5">
                  <div className="w-14 h-14 rounded-2xl bg-rose-600/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-3 text-rose-300">
                    <Pill className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-white text-sm mb-1">Nenhum medicamento cadastrado</h4>
                  <p className="text-xs text-neutral-400 max-w-xs mx-auto mb-3">
                    Cadastre remédios que você toma diariamente com seus horários para não esquecer de nenhuma dose.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddRemedio(true)}
                    className="py-2 px-4 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-xl text-xs"
                  >
                    Adicionar Medicamento
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {dadosSaude.medicamentos.map((med) => (
                    <div
                      key={med.id}
                      className="p-4 rounded-2xl bg-[#141424] border border-white/10 flex flex-col justify-between group shadow-sm hover:border-rose-500/40 transition-all"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                              <Pill className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-white">{med.nome}</h4>
                              <span className="text-[11px] text-neutral-400">{med.dosagem} • {med.frequencia}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteRemedio(med.id)}
                            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-neutral-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {med.instrucoes && (
                          <p className="text-[11px] text-neutral-400 italic mb-2.5">
                            "{med.instrucoes}"
                          </p>
                        )}
                      </div>

                      {/* Horários e Checklist Diário */}
                      <div className="pt-2 border-t border-white/5 space-y-1.5">
                        <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider block">
                          Doses de Hoje ({new Date().toLocaleDateString('pt-BR')})
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {med.horarios.map((h) => {
                            const chave = `${dataHojeStr}_${h}`;
                            const tomado = med.tomadoHoje?.[chave] || false;
                            return (
                              <button
                                key={h}
                                type="button"
                                onClick={() => handleToggleTomadoHoje(med.id, h)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                  tomado
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-white/5 text-neutral-300 hover:bg-white/10 border border-white/10'
                                }`}
                              >
                                <Clock className="w-3 h-3 opacity-70" />
                                <span>{h}</span>
                                {tomado ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <span className="text-[10px] text-neutral-400 underline ml-0.5">Tomar</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =========================================
              ABA 2: CONSULTAS & EXAMES
             ========================================= */}
          {activeTab === 'consultas' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Consultas e Exames Agendados</h3>
                  <p className="text-xs text-neutral-400">Controle datas, locais e resultados</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddConsulta(true)}
                  className="py-2 px-3 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Agendamento</span>
                </button>
              </div>

              {(!dadosSaude.consultas || dadosSaude.consultas.length === 0) ? (
                <div className="text-center py-10 px-4 rounded-2xl bg-white/[0.02] border border-white/5">
                  <div className="w-14 h-14 rounded-2xl bg-rose-600/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-3 text-rose-300">
                    <Stethoscope className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-white text-sm mb-1">Nenhum exame ou consulta cadastrado</h4>
                  <p className="text-xs text-neutral-400 max-w-xs mx-auto mb-3">
                    Cadastre suas próximas consultas com especialistas ou exames de rotina.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddConsulta(true)}
                    className="py-2 px-4 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-xl text-xs"
                  >
                    Agendar Consulta
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {dadosSaude.consultas.map((c) => {
                    const realizada = c.status === 'realizado';
                    return (
                      <div
                        key={c.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          realizada
                            ? 'bg-white/[0.02] border-white/5 opacity-70'
                            : 'bg-[#141424] border-white/10 hover:border-rose-500/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleConsultaStatus(c.id)}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                              realizada
                                ? 'bg-emerald-500 text-black'
                                : 'bg-white/5 hover:bg-white/10 text-neutral-400 border border-white/10'
                            }`}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                c.tipo === 'consulta'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-indigo-500/20 text-indigo-300'
                              }`}>
                                {c.tipo}
                              </span>
                              <h4 className={`text-sm font-bold ${realizada ? 'line-through text-neutral-400' : 'text-white'}`}>
                                {c.titulo}
                              </h4>
                            </div>
                            <span className="text-xs text-neutral-400 block mt-0.5">
                              📍 {c.medicoOuLocal} • 📅 {new Date(c.data + 'T00:00:00').toLocaleDateString('pt-BR')} {c.hora && `às ${c.hora}`}
                            </span>
                            {c.anotacoes && (
                              <p className="text-[11px] text-neutral-500 mt-1 italic">
                                Nota: {c.anotacoes}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {c.valor && c.valor > 0 && (
                            <span className="text-xs font-mono font-bold text-emerald-400">
                              R$ {c.valor.toFixed(2)}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteConsulta(c.id)}
                            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-neutral-400 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =========================================
              ABA 3: MÉTRICAS (PRESSÃO / GLICOSE)
             ========================================= */}
          {activeTab === 'metricas' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Pressão Arterial e Glicose</h3>
                  <p className="text-xs text-neutral-400">Histórico de pressão e glicemia em jejum</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddMetrica(true)}
                  className="py-2 px-3 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Registro</span>
                </button>
              </div>

              {(!dadosSaude.metricas || dadosSaude.metricas.length === 0) ? (
                <div className="text-center py-10 px-4 rounded-2xl bg-white/[0.02] border border-white/5">
                  <div className="w-14 h-14 rounded-2xl bg-rose-600/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-3 text-rose-300">
                    <Activity className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-white text-sm mb-1">Nenhuma medição registrada</h4>
                  <p className="text-xs text-neutral-400 max-w-xs mx-auto mb-3">
                    Registre seus testes de pressão arterial ou dosagens de glicemia para manter um histórico.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddMetrica(true)}
                    className="py-2 px-4 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-xl text-xs"
                  >
                    Registrar Métrica
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {dadosSaude.metricas.map((met) => (
                    <div
                      key={met.id}
                      className="p-3.5 rounded-2xl bg-[#141424] border border-white/10 flex flex-col justify-between shadow-sm relative group"
                    >
                      <button
                        type="button"
                        onClick={() => handleDeleteMetrica(met.id)}
                        className="absolute top-2.5 right-2.5 w-6 h-6 rounded bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-neutral-500 hover:text-red-400 opacity-60 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>

                      <div>
                        <span className="text-[10px] uppercase font-semibold text-rose-300 tracking-wider block">
                          {met.rotulo}
                        </span>
                        <div className="text-2xl font-bold font-mono text-white mt-1">
                          {met.valor} <span className="text-xs text-neutral-400 font-sans">{met.unidade}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/5 mt-2 flex items-center justify-between text-[10px] text-neutral-400">
                        <span>{new Date(met.data + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                        {met.hora && <span>{met.hora}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =========================================
              ABA 4: CARTÃO DE EMERGÊNCIA
             ========================================= */}
          {activeTab === 'cartao' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Cartão de Emergência & Saúde</h3>
                  <p className="text-xs text-neutral-400">Informações cruciais em caso de atendimento médico</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingPerfil(true)}
                  className="py-1.5 px-3 bg-white/10 hover:bg-white/15 text-white font-medium rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Editar Cartão</span>
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-950/40 via-[#181420] to-neutral-900 border border-rose-500/30 shadow-xl space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-[10px] text-neutral-400 block uppercase font-semibold">Tipo Sanguíneo</span>
                    <span className="text-lg font-bold text-rose-400 font-display">
                      {dadosSaude.perfilSaude?.tipoSanguineo || 'Não informado'}
                    </span>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-[10px] text-neutral-400 block uppercase font-semibold">Plano de Saúde</span>
                    <span className="text-sm font-bold text-white block truncate">
                      {dadosSaude.perfilSaude?.convenio || 'Não informado'}
                    </span>
                    {dadosSaude.perfilSaude?.numeroConvenio && (
                      <span className="text-[10px] text-neutral-400 font-mono">
                        Nº {dadosSaude.perfilSaude.numeroConvenio}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs">
                  <span className="text-[10px] text-neutral-400 block uppercase font-semibold">Alergias Conhecidas</span>
                  <span className="text-xs text-white block mt-0.5">
                    {dadosSaude.perfilSaude?.alergias || 'Nenhuma alergia cadastrada'}
                  </span>
                </div>

                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-rose-300 uppercase font-bold block">Contato de Emergência</span>
                    <span className="text-sm font-bold text-white">
                      {dadosSaude.perfilSaude?.contatoEmergenciaNome || 'Nome do Contato'}
                    </span>
                    <span className="text-xs text-neutral-300 block font-mono">
                      {dadosSaude.perfilSaude?.contatoEmergenciaTelefone || 'Telefone não informado'}
                    </span>
                  </div>

                  {dadosSaude.perfilSaude?.contatoEmergenciaTelefone && (
                    <a
                      href={`tel:${dadosSaude.perfilSaude.contatoEmergenciaTelefone.replace(/\D/g, '')}`}
                      className="py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Ligar</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-3.5 bg-[#121220] border-t border-white/10 flex items-center justify-between text-xs text-neutral-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            Sincronizado na nuvem (dados_saude)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-white font-medium rounded-lg text-xs transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Modal Adicionar Peso x Altura */}
      {showAddPesoAltura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#161626] border border-white/15 rounded-2xl p-5 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base font-display">Registrar Peso x Altura</h3>
                  <span className="text-[11px] text-neutral-400">Cálculo e histórico de IMC</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPesoAltura(false)}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePesoAltura} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Peso (kg) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    autoFocus
                    value={inputPeso}
                    onChange={(e) => setInputPeso(e.target.value)}
                    placeholder="Ex: 78.5"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-base font-bold focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Altura (m ou cm) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={inputAltura}
                    onChange={(e) => setInputAltura(e.target.value)}
                    placeholder="Ex: 1.75 ou 175"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-base font-bold focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Preview em tempo real do IMC */}
              {(() => {
                const p = parseFloat(inputPeso.replace(',', '.'));
                let a = parseFloat(inputAltura.replace(',', '.'));
                if (a > 3) a = a / 100;
                if (p > 0 && a > 0) {
                  const preview = calcularIMC(p, a);
                  return (
                    <div className={`p-3 rounded-xl border flex items-center justify-between ${preview.bg}`}>
                      <div>
                        <span className="text-[10px] text-neutral-400 block uppercase font-bold">IMC Calculado</span>
                        <span className="text-xl font-bold font-mono text-white">{preview.imc}</span>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${preview.cor}`}>
                        {preview.classificacao}
                      </span>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Data da Medição</label>
                  <input
                    type="date"
                    value={inputDataPeso}
                    onChange={(e) => setInputDataPeso(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Horário</label>
                  <input
                    type="time"
                    value={inputHoraPeso}
                    onChange={(e) => setInputHoraPeso(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 font-semibold mb-1">Observações (Opcional)</label>
                <input
                  type="text"
                  value={inputObsPeso}
                  onChange={(e) => setInputObsPeso(e.target.value)}
                  placeholder="Ex: Em jejum pela manhã, Início da dieta"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPesoAltura(false)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 font-medium rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold rounded-xl shadow-lg shadow-rose-600/30"
                >
                  Salvar Medição
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Adicionar Remédio */}
      {showAddRemedio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#161626] border border-white/15 rounded-2xl p-5 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="font-bold text-base font-display">Novo Medicamento</h3>
              <button
                type="button"
                onClick={() => setShowAddRemedio(false)}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRemedio} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-neutral-400 font-semibold mb-1">Nome do Medicamento *</label>
                <input
                  type="text"
                  required
                  value={remNome}
                  onChange={(e) => setRemNome(e.target.value)}
                  placeholder="Ex: Losartana, Dipirona, Vitamina D"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Dosagem</label>
                  <input
                    type="text"
                    value={remDose}
                    onChange={(e) => setRemDose(e.target.value)}
                    placeholder="Ex: 50mg, 1 cp, 10ml"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Frequência</label>
                  <input
                    type="text"
                    value={remFreq}
                    onChange={(e) => setRemFreq(e.target.value)}
                    placeholder="Ex: 1x ao dia, 8 em 8h"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 font-semibold mb-1">Horários (separados por vírgula)</label>
                <input
                  type="text"
                  value={remHorarios}
                  onChange={(e) => setRemHorarios(e.target.value)}
                  placeholder="Ex: 08:00, 14:00, 20:00"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-neutral-400 font-semibold mb-1">Instruções / Dicas de uso</label>
                <input
                  type="text"
                  value={remInstrucoes}
                  onChange={(e) => setRemInstrucoes(e.target.value)}
                  placeholder="Ex: Tomar após o café com água abundante"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddRemedio(false)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 font-medium rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold rounded-xl shadow-lg shadow-rose-600/30"
                >
                  Cadastrar Medicamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nova Consulta */}
      {showAddConsulta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#161626] border border-white/15 rounded-2xl p-5 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="font-bold text-base font-display">Novo Agendamento</h3>
              <button
                type="button"
                onClick={() => setShowAddConsulta(false)}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConsulta} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-neutral-400 font-semibold mb-1">Tipo de Compromisso</label>
                <select
                  value={consTipo}
                  onChange={(e) => setConsTipo(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-[#1b1b2f] border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="consulta">🩺 Consulta Médica</option>
                  <option value="exame">🧪 Exame Laboratorial / Imagem</option>
                  <option value="retorno">🔄 Retorno Médico</option>
                  <option value="procedimento">💉 Procedimento / Tratamento</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-400 font-semibold mb-1">Título / Especialidade *</label>
                <input
                  type="text"
                  required
                  value={consTitulo}
                  onChange={(e) => setConsTitulo(e.target.value)}
                  placeholder="Ex: Cardiologista, Hemograma Completo, Dentista"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-neutral-400 font-semibold mb-1">Médico ou Clínica</label>
                <input
                  type="text"
                  value={consLocal}
                  onChange={(e) => setConsLocal(e.target.value)}
                  placeholder="Ex: Dr. Roberto / Hospital São Lucas"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={consData}
                    onChange={(e) => setConsData(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Horário</label>
                  <input
                    type="time"
                    value={consHora}
                    onChange={(e) => setConsHora(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Valor (R$ se particular)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={consValor}
                    onChange={(e) => setConsValor(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Anotações</label>
                  <input
                    type="text"
                    value={consNotas}
                    onChange={(e) => setConsNotas(e.target.value)}
                    placeholder="Ex: Levar exames anteriores"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddConsulta(false)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 font-medium rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold rounded-xl shadow-lg shadow-rose-600/30"
                >
                  Confirmar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nova Métrica */}
      {showAddMetrica && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#161626] border border-white/15 rounded-2xl p-5 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="font-bold text-base font-display">Registrar Métrica de Saúde</h3>
              <button
                type="button"
                onClick={() => setShowAddMetrica(false)}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMetrica} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-neutral-400 font-semibold mb-1">Tipo de Métrica</label>
                <select
                  value={metTipo}
                  onChange={(e) => {
                    const t = e.target.value as any;
                    setMetTipo(t);
                    if (t === 'pressao') {
                      setMetRotulo('Pressão Arterial');
                      setMetUnidade('mmHg');
                    } else if (t === 'glicose') {
                      setMetRotulo('Glicemia em Jejum');
                      setMetUnidade('mg/dL');
                    } else if (t === 'peso') {
                      setMetRotulo('Peso Corporal');
                      setMetUnidade('kg');
                    } else {
                      setMetRotulo('Temperatura');
                      setMetUnidade('°C');
                    }
                  }}
                  className="w-full px-3 py-2.5 bg-[#1b1b2f] border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="pressao">🩺 Pressão Arterial (ex: 12/8)</option>
                  <option value="glicose">🩸 Glicose / Glicemia (ex: 95 mg/dL)</option>
                  <option value="peso">⚖️ Peso Corporal (ex: 78.5 kg)</option>
                  <option value="outro">🌡️ Temperatura / Outros</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Valor Medido *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={metValor}
                    onChange={(e) => setMetValor(e.target.value)}
                    placeholder={metTipo === 'pressao' ? '12/8' : '95'}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-base font-bold focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Unidade</label>
                  <input
                    type="text"
                    value={metUnidade}
                    onChange={(e) => setMetUnidade(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Data</label>
                  <input
                    type="date"
                    value={metData}
                    onChange={(e) => setMetData(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Horário</label>
                  <input
                    type="time"
                    value={metHora}
                    onChange={(e) => setMetHora(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMetrica(false)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 font-medium rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold rounded-xl shadow-lg shadow-rose-600/30"
                >
                  Salvar Métrica
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Perfil / Cartão de Emergência */}
      {editingPerfil && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#161626] border border-white/15 rounded-2xl p-5 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="font-bold text-base font-display">Editar Cartão de Emergência</h3>
              <button
                type="button"
                onClick={() => setEditingPerfil(false)}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePerfil} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Tipo Sanguíneo</label>
                  <select
                    value={tipoSanguineo}
                    onChange={(e) => setTipoSanguineo(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#1b1b2f] border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="">Não informado</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Plano / Convênio</label>
                  <input
                    type="text"
                    value={convenio}
                    onChange={(e) => setConvenio(e.target.value)}
                    placeholder="Ex: Unimed, Bradesco, SUS"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 font-semibold mb-1">Nº Carteirinha Convênio</label>
                <input
                  type="text"
                  value={numConvenio}
                  onChange={(e) => setNumConvenio(e.target.value)}
                  placeholder="0000 0000 0000"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-neutral-400 font-semibold mb-1">Alergias ou Cuidados Especiais</label>
                <input
                  type="text"
                  value={alergias}
                  onChange={(e) => setAlergias(e.target.value)}
                  placeholder="Ex: Alergia a Penicilina, Dipirona, Asma"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Nome Contato Emergência</label>
                  <input
                    type="text"
                    value={emergenciaNome}
                    onChange={(e) => setEmergenciaNome(e.target.value)}
                    placeholder="Ex: Mãe / Cônjuge"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Telefone Contato</label>
                  <input
                    type="tel"
                    value={emergenciaTel}
                    onChange={(e) => setEmergenciaTel(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPerfil(false)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 font-medium rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold rounded-xl shadow-lg shadow-rose-600/30"
                >
                  Salvar Cartão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
