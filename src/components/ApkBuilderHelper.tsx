import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Download, Smartphone, GitBranch, Zap } from 'lucide-react';

const WORKFLOW_YAML = `name: Gerar APK Android Nativo (Sutello Financeiro)

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build-apk:
    runs-on: ubuntu-latest

    steps:
      - name: Baixar código do projeto
        uses: actions/checkout@v4

      - name: Configurar Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Configurar Java JDK 21 para Android
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '21'

      - name: Instalar dependências e compilar Web + Sincronizar Android
        run: |
          npm install --legacy-peer-deps
          npm run build
          npx cap sync android

      - name: Dar permissão ao Gradle e Compilar APK
        working-directory: ./android
        run: |
          chmod +x gradlew
          ./gradlew assembleDebug

      - name: Disponibilizar arquivo APK para Download
        uses: actions/upload-artifact@v4
        with:
          name: Sutello-Financeiro-APK
          path: android/app/build/outputs/apk/debug/app-debug.apk
`;

export const ApkBuilderHelper: React.FC = () => {
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedYaml, setCopiedYaml] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopyPath = () => {
    navigator.clipboard.writeText('.github/workflows/build-apk.yml');
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2500);
  };

  const handleCopyYaml = () => {
    navigator.clipboard.writeText(WORKFLOW_YAML);
    setCopiedYaml(true);
    setTimeout(() => setCopiedYaml(false), 2500);
  };

  const handleDownloadYaml = () => {
    const blob = new Blob([WORKFLOW_YAML], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'build-apk.yml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-2 p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-purple-300 font-bold">
          <Smartphone className="w-4 h-4 text-purple-400 shrink-0" />
          <span>Gerador de APK + Vercel Conectados</span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 font-semibold text-[11px] transition-colors"
        >
          {expanded ? 'Ocultar Guia' : 'Não achou a pasta .github? Clique aqui'}
        </button>
      </div>

      <p className="text-[11px] text-neutral-300 leading-relaxed">
        No celular ou Windows/Mac, pastas que começam com ponto (<code className="text-purple-300 font-mono">.github</code>) ficam <strong>ocultas por padrão</strong> ao descompactar o ZIP. Você pode criar o arquivo direto no GitHub em 30 segundos:
      </p>

      {expanded && (
        <div className="space-y-3 pt-2 border-t border-purple-500/20">
          <div className="space-y-1.5 bg-black/40 p-2.5 rounded-lg border border-white/10">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5" />
              <span>Passo 1: No seu repositório do GitHub</span>
            </div>
            <p className="text-[11px] text-neutral-300">
              Clique em <strong>Add file</strong> &rarr; <strong>Create new file</strong>. No campo de nome do arquivo no topo, cole exatamente isto (o GitHub cria as pastas sozinho ao digitar as barras <code className="text-purple-300">/</code>):
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <code className="flex-1 bg-[#13131f] px-2.5 py-1.5 rounded-lg border border-white/10 text-purple-300 font-mono text-[11px] select-all">
                .github/workflows/build-apk.yml
              </code>
              <button
                type="button"
                onClick={handleCopyPath}
                className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shrink-0"
              >
                {copiedPath ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPath ? 'Copiado!' : 'Copiar Nome'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5 bg-black/40 p-2.5 rounded-lg border border-white/10">
            <div className="font-bold text-emerald-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                <span>Passo 2: Cole o código abaixo dentro do arquivo</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyYaml}
                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-md"
              >
                {copiedYaml ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedYaml ? 'Código Copiado!' : 'Copiar Código do build-apk.yml'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadYaml}
                className="py-2 px-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold text-[11px] flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar build-apk.yml</span>
              </button>
            </div>
            <p className="text-[10px] text-neutral-400 pt-1">
              Depois clique no botão verde <strong>Commit changes</strong> no GitHub, vá na aba <strong>Actions</strong> no topo do GitHub e baixe seu APK pronto! (Importante: certifique-se de que a pasta <code className="text-purple-300">android</code> do ZIP também foi enviada para o GitHub).
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
