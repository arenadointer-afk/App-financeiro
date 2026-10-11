import React, { useState, useEffect } from 'react';
import { ShieldAlert, Check, X } from 'lucide-react';

interface SecurityChallengeModalProps {
  isOpen: boolean;
  actionName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const SecurityChallengeModal: React.FC<SecurityChallengeModalProps> = ({
  isOpen,
  actionName,
  onConfirm,
  onCancel,
}) => {
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const n1 = Math.floor(Math.random() * 9) + 2;
      const n2 = Math.floor(Math.random() * 9) + 2;
      setNum1(n1);
      setNum2(n2);
      setAnswer('');
      setError(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (parseInt(answer, 10) === num1 + num2) {
      onConfirm();
    } else {
      setError(true);
      setAnswer('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xs bg-[#13131f] border border-purple-500/20 rounded-2xl p-6 shadow-2xl text-center flex flex-col items-center">
        <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3">
          <ShieldAlert className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-bold text-white font-display">Confirmação de Segurança</h3>
        <p className="text-xs text-neutral-400 mt-1 mb-4">
          Para prosseguir com <b className="text-purple-300 font-semibold">{actionName}</b>, resolva a operação:
        </p>

        <div className="py-3 px-6 bg-white/5 rounded-xl border border-white/10 mb-4 inline-block">
          <span className="text-2xl font-bold font-mono tracking-wider text-white">
            {num1} + {num2} = ?
          </span>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-3">
          <input
            type="number"
            inputMode="numeric"
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              setError(false);
            }}
            placeholder="Resultado"
            autoFocus
            className={`w-full py-2.5 px-4 text-center text-xl font-bold font-mono bg-white/5 border rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 ${
              error
                ? 'border-red-500 focus:ring-red-500/50'
                : 'border-white/15 focus:border-purple-500 focus:ring-purple-500/30'
            }`}
          />

          {error && <p className="text-xs text-red-400 font-medium">Resposta incorreta. Tente novamente.</p>}

          <div className="flex gap-2 pt-2 touch-manipulation select-none">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 active:bg-white/20 active:scale-95 text-neutral-300 text-xs font-semibold rounded-xl border border-white/10 transition-transform duration-75 touch-manipulation"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-lg shadow-purple-600/30 transition-transform duration-75 touch-manipulation"
            >
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
