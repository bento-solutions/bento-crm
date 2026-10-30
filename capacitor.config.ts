import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The Bento staff app for Android and iOS: the Angular build wrapped by Capacitor.
 * See docs/mobile.md for adding the platforms and setting up push notifications.
 */
const config: CapacitorConfig = {
  appId: 'ma.bento.app',
  appName: 'Bento',
  // The Angular application builder's output (angular.json has no outputPath: dist/<project>/browser).
  webDir: 'dist/app/browser',
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
