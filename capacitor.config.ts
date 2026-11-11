import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.liftforge.app',
  appName: 'LiftForge',
  webDir: 'out',
  server: {
    androidScheme: 'https',
  },
};

export default config;
