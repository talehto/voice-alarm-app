// src/features/auth/LoginScreen.tsx
import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useAuth } from './AuthContext';

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Sign in</Text>
      <Button title="Continue with Google" onPress={signInWithGoogle} />
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  h1: { fontSize: 22, fontWeight: '700' },
});
