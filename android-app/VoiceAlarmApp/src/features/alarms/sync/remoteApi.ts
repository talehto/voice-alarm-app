// src/features/alarms/sync/remoteApi.ts
import { getApp } from '@react-native-firebase/app';
import {
  getFirestore, doc, setDoc, deleteDoc, serverTimestamp,
} from '@react-native-firebase/firestore';

const db = getFirestore(getApp());

export type RemoteAlarm = {
  remoteId?: string; // if known
  ownerUid: string;
  targetUid: string;
  type: 'single'|'weekly';
  title: string;
  text: string;
  ttsLang: 'fi-FI'|'en-US';
  enabled: boolean;
  singleDateTimeMillis?: number|null;
  weeklyDaysMask?: number|null;
  weeklyHour?: number|null;
  weeklyMinute?: number|null;
};

export async function saveAlarmRemote(uid: string, a: RemoteAlarm) {
  console.log("saveAlarmRemote() start")
  
  // Generate a unique ID - use a more compatible approach
  const id = a.remoteId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const ref = doc(db, `users/${uid}/alarms/${id}`);
  console.log("saveAlarmRemote() ref retrieved, id:", id)
  
  try {
    await setDoc(ref, {
      id,
      ownerUid: a.ownerUid,
      targetUid: a.targetUid,
      type: a.type,
      title: a.title,
      text: a.text,
      ttsLang: a.ttsLang,
      enabled: a.enabled,
      singleDateTimeMillis: a.singleDateTimeMillis ?? null,
      weeklyDaysMask: a.weeklyDaysMask ?? null,
      weeklyHour: a.weeklyHour ?? null,
      weeklyMinute: a.weeklyMinute ?? null,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    console.log("saveAlarmRemote() setDoc was executed successfully")
    return id;
  } catch (error) {
    console.error("saveAlarmRemote() setDoc failed:", error);
    throw error;
  }
}

export async function deleteAlarmRemote(uid: string, remoteId: string) {
  await deleteDoc(doc(db, `users/${uid}/alarms/${remoteId}`));
}
