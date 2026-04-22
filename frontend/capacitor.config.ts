import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.travelhub.app',
  appName: 'TravelerHub',
  webDir: 'dist',
  server: {
    // During development, point to local dev server
    // Comment this out for production builds
    url: 'http://localhost:5173',
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Geolocation: {
      // iOS: required for background location
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#160f29',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#183a37',
    },
  },
};

export default config;
