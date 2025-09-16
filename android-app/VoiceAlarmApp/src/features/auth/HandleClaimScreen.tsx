// src/features/auth/HandleClaimScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { useAuth } from './AuthContext';
import { firestore } from '../../lib/firebase';

const isValid = (h: string) => /^[a-z0-9_]{3,20}$/.test(h);

export default function HandleClaimScreen() {
  const { state } = useAuth();
  const uid = state.user?.uid!;
  const suggested = (state.user?.displayName ?? state.user?.email ?? 'user').split(/[^\w]/)[0].toLowerCase();
  const [handle, setHandle] = useState(suggested || '');

  const claim = async () => {
    const desired = handle.trim().toLowerCase();
    if (!isValid(desired)) { Alert.alert('Invalid', '3-20 chars: a-z, 0-9, _'); return; }

    const handleRef = firestore().doc(`handles/${desired}`);
    const userRef = firestore().doc(`users/${uid}`);

    try {
      await firestore().runTransaction(async (tx) => {
        const hSnap = await tx.get(handleRef);
        if (hSnap.exists()) throw new Error('Handle is taken');
        tx.set(handleRef, { uid, createdAt: firestore.FieldValue.serverTimestamp() });
        tx.set(userRef, {
          handle: desired,
          displayName: state.user?.displayName ?? null,
          email: state.user?.email ?? null,
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      });
    } catch (e: any) {
      Alert.alert('Could not claim', e?.message ?? String(e));
      return;
    }
    Alert.alert('Success', `Your username is @${desired}`);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Choose a username</Text>
      <TextInput style={styles.input} value={handle} onChangeText={setHandle} autoCapitalize="none" />
      <Button title="Claim" onPress={claim} />
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, justifyContent: 'center', gap: 12 },
  h1: { fontSize: 20, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
});
