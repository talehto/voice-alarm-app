// src/features/auth/LoginScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useAuth } from './AuthContext';

export default function LoginScreen() {
  const { signInWithGoogle, signInWithEmailOrHandle, signUpWithEmail, resetPassword } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [identifier, setIdentifier] = useState(''); // email or @username for signin
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');          // for signup
  const [displayName, setDisplayName] = useState(''); // optional on signup

  const doSignin = async () => {
    if (!identifier || !password) return Alert.alert('Missing info', 'Enter email/username and password.');
    try {
      await signInWithEmailOrHandle(identifier, password);
    } catch (e: any) {
      Alert.alert('Sign in failed', e?.message ?? String(e));
    }
  };

  const doSignup = async () => {
    if (!email || !password) return Alert.alert('Missing info', 'Enter email and password.');
    if (password.length < 6) return Alert.alert('Weak password', 'Use at least 6 characters.');
    try {
      await signUpWithEmail({ email, password, displayName });
      // After signup, AuthProvider listener takes over; user will move to HandleClaim
    } catch (e: any) {
      Alert.alert('Sign up failed', e?.message ?? String(e));
    }
  };

  const doReset = async () => {
    if (!identifier) return Alert.alert('Enter email or username first');
    try {
      await resetPassword(identifier);
      Alert.alert('Check your email', 'Password reset email sent (if the account exists).');
    } catch (e: any) {
      Alert.alert('Reset failed', e?.message ?? String(e));
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Welcome</Text>

      {/* Google Sign-In */}
      <Button title="Continue with Google" onPress={signInWithGoogle} />

      <View style={styles.sep}><Text style={styles.sepText}>or</Text></View>

      {mode === 'signin' ? (
        <>
          <Text style={styles.label}>Email or Username</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="email@example.com or your_username"
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
          />
          <Button title="Sign in" onPress={doSignin} />
          <TouchableOpacity onPress={() => setMode('signup')}>
            <Text style={styles.link}>Create an account</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={doReset}>
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            placeholder="email@example.com"
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
          />
          <Text style={styles.label}>Display name (optional)</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="How should we call you?"
          />
          <Button title="Create account" onPress={doSignup} />
          <TouchableOpacity onPress={() => setMode('signin')}>
            <Text style={styles.link}>Back to sign in</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 12, justifyContent: 'center' },
  h1: { fontSize: 24, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  label: { fontSize: 14, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  link: { color: '#2157f2', marginTop: 10, textAlign: 'center' },
  sep: { alignItems: 'center', marginVertical: 12 },
  sepText: { color: '#999' },
});
