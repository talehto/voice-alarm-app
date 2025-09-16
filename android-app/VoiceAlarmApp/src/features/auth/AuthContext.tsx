// src/features/auth/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, firestore, FirebaseAuthTypes } from '../../lib/firebase';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Alert } from 'react-native';

type UserDoc = { handle?: string | null; displayName?: string | null; email?: string | null; };
//type AuthState = { loading: boolean; user: FirebaseAuthTypes.User | null; profile: UserDoc | null; };

type AuthState = {
  authLoading: boolean;           // waiting for Firebase onAuthStateChanged
  user: FirebaseAuthTypes.User | null;
  profile: UserDoc | null;
  profileLoaded: boolean;        // waiting for /users/{uid} snapshot
};

const Ctx = createContext<{
  state: AuthState;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
} | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  //const [state, setState] = useState<AuthState>({ loading: true, user: null, profile: null });

  const [state, setState] = useState<AuthState>({
    authLoading: true,
    user: null,
    profile: null,
    profileLoaded: false,
  });

  // useEffect(() => {
  //   const unsub = auth().onAuthStateChanged(async (user) => {
  //     if (!user) { setState({ loading: false, user: null, profile: null }); return; }
  //     const doc = await firestore().doc(`users/${user.uid}`).get();
  //     setState({ loading: false, user, profile: (doc.data() as UserDoc) ?? null });
  //   });
  //   return unsub;
  // }, []);

  // src/features/auth/AuthContext.tsx
  // useEffect(() => {
  //   const unsubAuth = auth().onAuthStateChanged((user) => {
  //     if (!user) {
  //       setState({ loading: false, user: null, profile: null });
  //       return;
  //     }

  //     // 👇 subscribe to /users/{uid} changes
  //     const unsubUser = firestore()
  //       .doc(`users/${user.uid}`)
  //       .onSnapshot(
  //         (snap) => {
  //           setState({
  //             loading: false,
  //             user,
  //             profile: (snap.data() as any) ?? null,
  //           });
  //         },
  //         (err) => {
  //           console.warn('profile listener error', err);
  //           setState({ loading: false, user, profile: null });
  //         }
  //       );

  //     // clean up the user listener when auth changes/unmounts
  //     return unsubUser;
  //   });

  //   return unsubAuth;
  // }, []);

  // useEffect(() => {
  //   const unsubAuth = auth().onAuthStateChanged((user) => {
  //     if (!user) {
  //       setState({ loading: false, user: null, profile: null });
  //       return;
  //     }
  //     const unsubUser = firestore().doc(`users/${user.uid}`).onSnapshot(
  //       snap => setState({ loading: false, user, profile: (snap.data() as any) ?? null }),
  //       _err => setState({ loading: false, user, profile: null })
  //     );
  //     return unsubUser;
  //   });
  //   return unsubAuth;
  // }, []);
  
  // useEffect(() => {
  //   const unsubAuth = auth().onAuthStateChanged((user) => {
  //     if (!user) {
  //       setState({ authLoading: false, user: null, profile: null, profileLoading: false });
  //       return;
  //     }
  //     // we have a user -> start profile loading
  //     setState(s => ({ ...s, authLoading: false, user, profileLoading: true }));
  
  //     const unsubUser = firestore().doc(`users/${user.uid}`).onSnapshot(
  //       (snap) => {
  //         setState(s => ({
  //           ...s,
  //           profile: (snap.data() as UserDoc) ?? null,
  //           profileLoading: false,
  //         }));
  //       },
  //       (_err) => {
  //         setState(s => ({ ...s, profile: null, profileLoading: false }));
  //       }
  //     );
  //     return unsubUser;
  //   });
  
  //   return unsubAuth;
  // }, []);

  useEffect(() => {
    const unsubAuth = auth().onAuthStateChanged((user) => {
      if (!user) {
        setState({ authLoading: false, user: null, profile: null, profileLoaded: false });
        return;
      }
      // we have a user; start listening to their profile
      setState(s => ({ ...s, authLoading: false, user, profileLoaded: false }));
  
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
  
      return unsubUser;
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

  // const signOut = async () => {
  //   // keep the gate from re-rendering to HandleClaim during transition
  //   setState(s => ({ ...s, loading: true, user: null, profile: null }));
  //   try {
  //     await auth().signOut();
  //     await GoogleSignin.signOut();
  //   } catch (e: any) {
  //     Alert.alert('Logout failed', e?.message ?? String(e));
  //   } finally {
  //     setState({ loading: false, user: null, profile: null });
  //   }
  // };

  // Logout: keep app in a "loading/splash" state until onAuthStateChanged(null) lands.
  // Do NOT set authLoading=false manually here; let the auth listener finalize state.
  // const signOut = async () => {
  //   setState(s => ({ ...s, authLoading: true, user: null, profile: null, profileLoading: false }));
  //   try {
  //     await auth().signOut();
  //     await GoogleSignin.signOut();
  //   } catch {}
  //   // no setState here; listener will set the final logged-out state
  // };

  const signOut = async () => {
    setState(s => ({ ...s, authLoading: true, user: null, profile: null, profileLoaded: false }));
    try { await auth().signOut(); await GoogleSignin.signOut(); } catch {}
  };

  return <Ctx.Provider value={{ state, signInWithGoogle, signOut }}>{children}</Ctx.Provider>;
};

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
