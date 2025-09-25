// src/features/auth/HandleClaimScreen.tsx
import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useAuth } from "./AuthContext";

import { getApp } from "@react-native-firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  runTransaction,
  setDoc,
  serverTimestamp,
} from "@react-native-firebase/firestore";

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

export default function HandleClaimScreen() {
  const { state } = useAuth();
  const uid = state.user?.uid!;
  const app = useMemo(() => getApp(), []);
  const db = useMemo(() => getFirestore(app), [app]);

  // Suggestion from displayName/email
  const suggested = useMemo(() => {
    const base =
      (state.user?.displayName || state.user?.email || "user")
        ?.toLowerCase()
        ?.replace(/[^a-z0-9_]+/g, "_")
        ?.replace(/^_+|_+$/g, "") || "user";
    return base.slice(0, 20);
  }, [state.user]);

  const [handle, setHandle] = useState(suggested);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  const validate = (h: string) => HANDLE_RE.test(h);

  const checkAvailability = async () => {
    const h = handle.trim().toLowerCase();
    if (!validate(h)) {
      Alert.alert("Invalid username", "Use 3–20 chars: a–z, 0–9, _");
      setAvailable(null);
      return;
    }
    setChecking(true);
    try {
      const snap = await getDoc(doc(db, "handles", h));
      setAvailable(!snap.exists());
      if (snap.exists()) {
        Alert.alert("Taken", "That username is already in use. #1");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? String(e));
      setAvailable(null);
    } finally {
      setChecking(false);
    }
  };

  const claim = async () => {
    const h = handle.trim().toLowerCase();
    if (!validate(h)) {
      Alert.alert("Invalid username", "Use 3–20 chars: a–z, 0–9, _");
      return;
    }
    setSubmitting(true);
    try {
      // Atomic claim: create /handles/{h} if missing, and set /users/{uid}.handle
      await runTransaction(db, async (tx) => {
        const handleRef = doc(db, "handles", h);
        const userRef = doc(db, "users", uid);

        //const hSnap = await tx.get(handleRef);
        const hSnap = tx.get(handleRef);
        if (hSnap.exists) {
          throw new Error("Handle is already taken");
        }

        tx.set(handleRef, {
          uid,
          createdAt: serverTimestamp(),
        });

        tx.set(
          userRef,
          {
            handle: h,
            displayName: state.user?.displayName ?? null,
            email: state.user?.email ?? null,
            updatedAt: serverTimestamp(),
            // ensure createdAt exists if user doc was missing
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      // Optional: eagerly touch updatedAt (not strictly needed; transaction handled it)
      await setDoc(
        doc(db, "users", uid),
        { updatedAt: serverTimestamp() },
        { merge: true }
      );

      // No imperative navigation here—the profile snapshot in AuthProvider
      // will set profile.handle and your navigator will move to AlarmList.
      Alert.alert("Success", `Your username is @${h}`);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (/taken/i.test(msg)) {
        Alert.alert("Taken", "That username is already in use. #2");
      } else {
        Alert.alert("Could not claim", msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Choose a username</Text>
      <Text style={styles.p}>This will be your public handle (a–z, 0–9, _).</Text>

      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        value={handle}
        onChangeText={(t) => {
          setHandle(t);
          setAvailable(null);
        }}
        placeholder="your_username"
      />

      <View style={styles.row}>
        <Button title="Check availability" onPress={checkAvailability} />
        {checking && <ActivityIndicator style={{ marginLeft: 8 }} />}
      </View>

      {available === true && <Text style={styles.good}>Available ✓</Text>}
      {available === false && <Text style={styles.bad}>Not available ✗</Text>}

      <Button title={submitting ? "Claiming..." : "Claim"} onPress={claim} disabled={submitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 12, justifyContent: "center" },
  h1: { fontSize: 22, fontWeight: "700", marginBottom: 6, textAlign: "center" },
  p: { color: "#666", textAlign: "center", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  good: { color: "green" },
  bad: { color: "red" },
});
