// src/features/auth/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { attachAlarmsListener } from '../alarms/sync/remoteSync';

// RN Firebase (modular APIs)
import { getApp } from '@react-native-firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  signOut as fbSignOut,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from '@react-native-firebase/auth';
import {
  getFirestore,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  getDoc,
} from '@react-native-firebase/firestore';

type EmailAuthParams = { email: string; password: string; displayName?: string };

// Google Sign-In
import { GoogleSignin } from '@react-native-google-signin/google-signin';

type UserDoc = {
  handle?: string | null;
  displayName?: string | null;
  email?: string | null;
  createdAt?: any;
  updatedAt?: any;
  // add other profile fields as needed
};

type AuthState = {
  authLoading: boolean;                 // waiting for Firebase auth
  user: FirebaseUser | null;
  profile: UserDoc | null;
  profileLoaded: boolean;               // did we receive first /users/{uid} snapshot?
};

const Ctx = createContext<{
  state: AuthState;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
} | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const app = getApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  const [state, setState] = useState<AuthState>({
    authLoading: true,
    user: null,
    profile: null,
    profileLoaded: false,
  });

  useEffect(() => {
    console.log("state.user.uid: " + state.user?.uid)
    if (!state.user?.uid) return;
    const stop = attachAlarmsListener(state.user.uid);
    return () => { try { stop && stop(); } catch {} };
  }, [state.user?.uid]);

  // Subscribe to auth -> then subscribe to user doc
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        console.log("AuthContext after onAuthStateChanged no user")
        setState({ authLoading: false, user: null, profile: null, profileLoaded: false });
        return;
      }

      // we have a user; reset and start listening for their profile
      console.log("AuthContext we have a user. Reset and start listening for their profile")
      setState((s) => ({ ...s, authLoading: false, user, profileLoaded: false }));

      const unsubUser = onSnapshot(
        doc(db, `users/${user.uid}`),
        (snap) => {
          console.log("AuthContext user data retrieved")
          setState((s) => ({
            ...s,
            profile: (snap.data() as UserDoc) ?? null,
            profileLoaded: true,
          }));
        },
        (_err) => {
          console.log("AuthContext retrieved user data failed")
          setState((s) => ({ ...s, profile: null, profileLoaded: true }));
        }
      );

      return unsubUser;
    });

    return unsubAuth;
  }, [auth, db]);

  // Google sign-in -> Firebase credential (modular)
  const signInWithGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // optional: clear any cached account to avoid weird states
      //try { await GoogleSignin.signOut(); } catch {}

      const { idToken } = await GoogleSignin.signIn();
      if (!idToken) {
        // Fallback (Android-only): try to fetch tokens after interactive sign-in
        // NOTE: getTokens is Android-only; wrap in try/catch
        try {
          // @ts-ignore
          const tokens = await GoogleSignin.getTokens();
          if (tokens?.idToken) {
            const cred = GoogleAuthProvider.credential(tokens.idToken);
            return await signInWithCredential(getAuth(getApp()), cred);
          }
        } catch {}
        throw new Error('No idToken from Google Sign-In');
      }
      //if (!idToken) throw new Error('No idToken from Google Sign-In');

      const credential = GoogleAuthProvider.credential(idToken);
      const cred = await signInWithCredential(auth, credential);

      // Optional: ensure a minimal /users/{uid} doc exists (createdAt)
      const u = cred.user;
      const userRef = doc(db, `users/${u.uid}`);
      const existing = await getDoc(userRef);
      if (!existing.exists()) {
        await setDoc(
          userRef,
          {
            displayName: u.displayName ?? null,
            email: u.email ?? null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        // touch updatedAt
        await setDoc(userRef, { updatedAt: serverTimestamp() }, { merge: true });
      }
    } catch (e: any) {
      Alert.alert('Login failed', e?.message ?? String(e));
    }
  };

  // ---- Sign up with email/password ----
  const signUpWithEmail = async ({ email, password, displayName }: EmailAuthParams) => {
    const e = email.trim().toLowerCase();
    const cred = await createUserWithEmailAndPassword(auth, e, password);

    // optional: set displayName on the Firebase user profile
    if (displayName) {
      try { await updateProfile(cred.user, { displayName }); } catch {}
    }

    // ensure a minimal user doc exists
    const userRef = doc(db, `users/${cred.user.uid}`);
    const exists = await getDoc(userRef);
    if (!exists.exists()) {
      await setDoc(userRef, {
        displayName: displayName ?? cred.user.displayName ?? null,
        email: e,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  };

  // ---- Sign in with email OR handle ----
  const signInWithEmailOrHandle = async (identifier: string, password: string) => {
    const id = identifier.trim();
    let email = id;

    // If user typed a handle (no '@'), resolve handle -> uid -> email
    if (!id.includes('@')) {
      const handleDoc = await getDoc(doc(db, `handles/${id.toLowerCase()}`));
      if (!handleDoc.exists()) throw new Error('Username not found');
      const uid = handleDoc.get('uid');
      const userDoc = await getDoc(doc(db, `users/${uid}`));
      email = (userDoc.data()?.email as string) ?? null;
      if (!email) throw new Error('Account has no email linked');
    }

    await signInWithEmailAndPassword(auth, email.toLowerCase(), password);
  };

  // ---- Password reset (identifier can be email or handle) ----
  const resetPassword = async (identifier: string) => {
    let email = identifier.trim();
    if (!email.includes('@')) {
      const handleDoc = await getDoc(doc(db, `handles/${email.toLowerCase()}`));
      if (!handleDoc.exists()) throw new Error('Username not found');
      const uid = handleDoc.get('uid');
      const userDoc = await getDoc(doc(db, `users/${uid}`));
      email = (userDoc.data()?.email as string) ?? null;
      if (!email) throw new Error('No email on file');
    }
    await sendPasswordResetEmail(auth, email.toLowerCase());
  };

  // Logout without route flicker: keep authLoading true until listener confirms sign-out
  const signOut = async () => {
    setState((s) => ({ ...s, authLoading: true, user: null, profile: null, profileLoaded: false }));
    try {
      await fbSignOut(auth);
      await GoogleSignin.signOut();
    } catch {
      // ignore
    }
    // onAuthStateChanged(null) will finalize the state
  };

  return (
    <Ctx.Provider value={{ state, signInWithGoogle, signOut, signUpWithEmail, signInWithEmailOrHandle, resetPassword, }}>
      {children}
    </Ctx.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
