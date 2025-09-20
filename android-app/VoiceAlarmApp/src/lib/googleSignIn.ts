// src/lib/googleSignIn.ts
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '@env';

export function configureGoogleSignIn() {
  console.log("GOOGLE_WEB_CLIENT_ID: ", GOOGLE_WEB_CLIENT_ID);
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID, // from Firebase console
    offlineAccess: false,
    forceCodeForRefreshToken: false,
  });
}
