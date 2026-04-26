import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.travelhub.app',
  appName: 'TravelerHub',
  webDir: 'dist',
  // DEV ONLY — uncomment when running `npx cap run android` against a local
  // dev server, then RE-COMMENT before building a release APK. If left
  // uncommented in a production build, the WebView will try to load from
  // localhost on the device and the app will appear blank.
  // server: {
  //   url: 'http://localhost:5173',
  //   cleartext: true,
  // },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Geolocation: {
      // iOS: required for background location
    },
    SplashScreen: {
      // The JS app calls SplashScreen.hide() on mount (see src/app/main.jsx),
      // so we don't need a hard launch delay here.
      launchShowDuration: 0,
      launchAutoHide: true,
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
