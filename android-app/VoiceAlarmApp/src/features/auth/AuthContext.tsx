// src/features/auth/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, firestore, FirebaseAuthTypes } from '../../lib/firebase';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Alert } from 'react-native';

type UserDoc = { handle?: string | null; displayName?: string | null; email?: string | null; };

type AuthState = {
  authLoading: boolean;           // waiting for Firebase onAuthStateChanged
  user: FirebaseAuthTypes.User | null;
  profile: UserDoc | null;
  profileLoaded: boolean;        // waiting for /users/{uid} snapshot
  handleLoaded: boolean;         // waiting for handles query for this uid
  hasHandle: boolean;            // true if any handle doc exists for this uid
};

const Ctx = createContext<{
  state: AuthState;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
} | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const [state, setState] = useState<AuthState>({
    authLoading: true,
    user: null,
    profile: null,
    profileLoaded: false,
    handleLoaded: false,
    hasHandle: false,
  });

  useEffect(() => {
    const unsubAuth = auth().onAuthStateChanged((user) => {
      if (!user) {
        setState({ authLoading: false, user: null, profile: null, profileLoaded: false, handleLoaded: false, hasHandle: false });
        return;
      }
      // we have a user; start listening to their profile
      setState(s => ({ ...s, authLoading: false, user, profileLoaded: false, handleLoaded: false }));
  
      const unsubUser = firestore()
        .doc(`users/${user.uid}`)
        .onSnapshot(
          (snap) => {
            setState(s => ({
              ...s,
              profile: (snap.data() as UserDoc) ?? null,
              profileLoaded: true,        // <-- mark loaded only after first snapshot
            }));
          },
          (_err) => {
            setState(s => ({ ...s, profile: null, profileLoaded: true }));
          }
        );

      // Also check whether a handle exists for this uid via the reverse index in `handles`
      const unsubHandle = firestore()
        .collection('handles')
        .where('uid', '==', user.uid)
        .limit(1)
        .onSnapshot(
          (snap) => {
            setState(s => ({ ...s, hasHandle: snap.size > 0, handleLoaded: true }));
          },
          (_err) => {
            setState(s => ({ ...s, hasHandle: false, handleLoaded: true }));
          }
        );
  
      return () => { unsubUser(); unsubHandle(); };
    });
  
    return unsubAuth;
  }, []);

  const signInWithGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const { type, data } = await GoogleSignin.signIn();
      if (type === 'success') {
        const googleCredential = auth.GoogleAuthProvider.credential(data.idToken);
        await auth().signInWithCredential(googleCredential);
      } else if (type === 'cancelled') {
        // When the user cancels the flow for any operation that requires user interaction.
        console.log('WARNING: GoogleSignin.signIn type is cancelled');
        return; // do nothing
      }
      
    } catch (e: any) {
      Alert.alert('Login failed', e?.message ?? String(e));
    }
  };

  const signOut = async () => {
    setState(s => ({ ...s, authLoading: true, user: null, profile: null, profileLoaded: false, handleLoaded: false, hasHandle: false }));
    try { await auth().signOut(); await GoogleSignin.signOut(); } catch {}
  };

  return <Ctx.Provider value={{ state, signInWithGoogle, signOut }}>{children}</Ctx.Provider>;
};

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
