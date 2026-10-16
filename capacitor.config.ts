import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.pavanit1217.oddatlas',
  appName: 'OddAtlas',
  webDir: 'dist',
  backgroundColor: '#050b14',
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#050b14', showSpinner: false },
  },
  ios: { contentInset: 'never' },
};

export default config;
