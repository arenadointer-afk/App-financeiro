import React, { useState } from 'react';
import { Calculator, X, Delete } from 'lucide-react';

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CalculatorModal: React.FC<CalculatorModalProps> = ({ isOpen, onClose }) => {
  const [expression, setExpression] = useState('');
  const [resultPreview, setResultPreview] = useState('');

  if (!isOpen) return null;

  const handleInput = (val: string) => {
    const updated = expression + val;
    setExpression(updated);
    try {
      // Safe math evaluator without eval()
      const sanitized = updated.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
      // Only allow safe characters
      if (/^[0-9+\-*/.() ]+$/.test(sanitized)) {
        const res = Function(`"use strict"; return (${sanitized})`)();
        if (typeof res === 'number' && !isNaN(res)) {
          setResultPreview(res.toLocaleString('pt-BR', { maximumFractionDigits: 4 }));
        }
      }
    } catch {
      // expression incomplete
    }
  };

  const handleCalculate = () => {
    try {
      const sanitized = expression.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
      if (/^[0-9+\-*/.() ]+$/.test(sanitized)) {
        const res = Function(`"use strict"; return (${sanitized})`)();
        if (typeof res === 'number' && !isNaN(res)) {
          setExpression(res.toString());
          setResultPreview('');
        }
      }
    } catch {
      setResultPreview('Erro');
    }
  };

  const handleClear = () => {
    setExpression('');
    setResultPreview('');
  };

  const handleBackspace = () => {
    setExpression((prev) => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xs bg-[#13131f] border border-white/10 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
          <div className="flex items-center gap-2 text-white font-display font-bold text-sm">
            <Calculator className="w-4 h-4 text-purple-400" />
            Calculadora Rápida
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Display */}
        <div className="bg-[#08080f] border border-white/10 rounded-xl p-3 mb-3 text-right">
          <div className="text-xs text-neutral-500 min-h-[16px] truncate font-mono">
            {expression || '0'}
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight min-h-[32px] truncate">
            {resultPreview || expression || '0'}
          </div>
        </div>

        {/* Grid de teclas */}
        <div className="grid grid-cols-4 gap-2 touch-manipulation select-none">
          <button
            type="button"
            onClick={handleClear}
            className="py-3 bg-red-500/15 hover:bg-red-500/25 active:bg-red-500/40 text-red-400 rounded-xl text-sm font-bold border border-red-500/20 active:scale-90 transition-transform duration-75 touch-manipulation"
          >
            C
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="py-3 bg-white/5 hover:bg-white/10 active:bg-white/20 text-neutral-300 rounded-xl text-sm font-semibold border border-white/10 flex items-center justify-center active:scale-90 transition-transform duration-75 touch-manipulation"
          >
            <Delete className="w-4 h-4 pointer-events-none" />
          </button>
          <button
            type="button"
            onClick={() => handleInput('%')}
            className="py-3 bg-purple-500/10 hover:bg-purple-500/20 active:bg-purple-500/40 text-purple-300 rounded-xl text-sm font-semibold border border-purple-500/20 active:scale-90 transition-transform duration-75 touch-manipulation"
          >
            %
          </button>
          <button
            type="button"
            onClick={() => handleInput('÷')}
            className="py-3 bg-purple-600/30 hover:bg-purple-600/40 active:bg-purple-600/60 text-purple-300 rounded-xl text-base font-bold border border-purple-500/30 active:scale-90 transition-transform duration-75 touch-manipulation"
          >
            ÷
          </button>

          {['7', '8', '9'].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleInput(n)}
              className="py-3 bg-white/5 hover:bg-white/10 active:bg-white/20 text-white rounded-xl text-base font-semibold border border-white/10 active:scale-90 transition-transform duration-75 touch-manipulation"
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleInput('×')}
            className="py-3 bg-purple-600/30 hover:bg-purple-600/40 active:bg-purple-600/60 text-purple-300 rounded-xl text-base font-bold border border-purple-500/30 active:scale-90 transition-transform duration-75 touch-manipulation"
          >
            ×
          </button>

          {['4', '5', '6'].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleInput(n)}
              className="py-3 bg-white/5 hover:bg-white/10 active:bg-white/20 text-white rounded-xl text-base font-semibold border border-white/10 active:scale-90 transition-transform duration-75 touch-manipulation"
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleInput('−')}
            className="py-3 bg-purple-600/30 hover:bg-purple-600/40 active:bg-purple-600/60 text-purple-300 rounded-xl text-base font-bold border border-purple-500/30 active:scale-90 transition-transform duration-75 touch-manipulation"
          >
            −
          </button>

          {['1', '2', '3'].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleInput(n)}
              className="py-3 bg-white/5 hover:bg-white/10 active:bg-white/20 text-white rounded-xl text-base font-semibold border border-white/10 active:scale-90 transition-transform duration-75 touch-manipulation"
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleInput('+')}
            className="py-3 bg-purple-600/30 hover:bg-purple-600/40 active:bg-purple-600/60 text-purple-300 rounded-xl text-base font-bold border border-purple-500/30 active:scale-90 transition-transform duration-75 touch-manipulation"
          >
            +
          </button>

          <button
            type="button"
            onClick={() => handleInput('0')}
            className="col-span-2 py-3 bg-white/5 hover:bg-white/10 active:bg-white/20 text-white rounded-xl text-base font-semibold border border-white/10 active:scale-90 transition-transform duration-75 touch-manipulation"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleInput('.')}
            className="py-3 bg-white/5 hover:bg-white/10 active:bg-white/20 text-white rounded-xl text-base font-bold border border-white/10 active:scale-90 transition-transform duration-75 touch-manipulation"
          >
            .
          </button>
          <button
            type="button"
            onClick={handleCalculate}
            className="py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-base font-bold shadow-lg shadow-emerald-600/30 active:scale-90 transition-transform duration-75 touch-manipulation"
          >
            =
          </button>
        </div>
      </div>
    </div>
  );
};
