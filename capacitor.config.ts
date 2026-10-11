import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sutello.financeiro',
  appName: 'Sutello Financeiro',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      '*.run.app',
      '*.vercel.app',
      '*.firebaseapp.com',
      '*.googleapis.com',
    ],
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_sutello',
      iconColor: '#9333EA',
    },
  },
};

export default config;
