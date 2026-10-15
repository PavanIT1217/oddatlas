import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.pavanit1217.oddatlas',
  appName: 'OddAtlas',
  webDir: 'dist',
  backgroundColor: '#13151c',
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#13151c', showSpinner: false },
  },
  ios: { contentInset: 'never' },
};

export default config;
