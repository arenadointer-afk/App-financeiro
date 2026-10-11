# 📱 Guia Rápido: APK Android Nativo + Vercel Automaticamente Sincronizados

Seu projeto já está **100% configurado no Modo Híbrido Inteligente (APK + Vercel)**:
- **Link conectado ao APK:** `https://app-financeiro-beta-blue.vercel.app`
- **Vantagem:** Você instala o `.apk` no celular **uma única vez**. Toda vez que o seu site na Vercel atualizar, o APK no celular já abre atualizado na mesma hora, sem precisar reinstalar o APK!
- **Proteção Nativa de Banco (`FLAG_SECURE`):** Bloqueia prints e gravação de tela diretamente no sistema Android.
- **Notificações Nativas Android (`@capacitor/local-notifications`):** Dispara alertas nativos do sistema para Contas, Agenda e Avisos do ADM.
- **100% Firebase em Tempo Real:** Login, Contas, Saúde, Acordos, Caixinhas e Agenda sincronizados.

---

## 🚀 Passo a Passo para Atualizar o GitHub + Vercel e Baixar seu APK

1. **Baixe o pacote completo no App:**
   - Abra o app → **Configurações** → **Backup e Segurança dos Dados**.
   - Selecione **"📦 Baixar Código Fonte Completo (.ZIP)"** (`projeto-completo.zip`).
   - Extraia o arquivo `.zip` no seu computador ou celular.

2. **Suba os arquivos no seu repositório do GitHub (o mesmo conectado à Vercel):**
   - Ao enviar os arquivos para o GitHub:
     - **A Vercel** vai atualizar o site `https://app-financeiro-beta-blue.vercel.app` automaticamente como sempre fez.
     - **O GitHub Actions** vai ler a pasta `.github/workflows/build-apk.yml` e compilar o seu `.apk` sozinho na nuvem!

3. **Onde baixar o arquivo `.apk` pronto para instalar no celular:**
   - Entre no seu repositório no GitHub.
   - Clique na aba **"Actions"** (no topo do GitHub).
   - Clique no processo **"Gerar APK Android Nativo (Sutello Financeiro)"** (leva cerca de 2 a 3 minutos para ficar com o ícone verde ✅).
   - Role até o final da página em **"Artifacts"** e clique em **`Sutello-Financeiro-APK`** para baixar o instalador `.apk`!
