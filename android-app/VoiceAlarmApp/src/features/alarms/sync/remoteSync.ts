// src/features/alarms/sync/remoteSync.ts
import { getApp } from '@react-native-firebase/app';
import {
  getFirestore, collection, onSnapshot, orderBy, query,
} from '@react-native-firebase/firestore';
import { NativeModules } from 'react-native';

const { AlarmModule } = NativeModules as any;

export function attachAlarmsListener(uid: string) {
  const db = getFirestore(getApp());
  const q = query(collection(db, `users/${uid}/alarms`), orderBy('updatedAt', 'desc'));

  let initial = true;
  const unsub = onSnapshot(q, async (snap) => {
    const rows = snap.docs.map((d) => {
      const a = d.data() as any;
      return {
        remoteId: d.id,
        ownerUid: a.ownerUid,
        targetUid: a.targetUid,
        type: a.type,
        title: a.title || '',
        text: a.text || '',
        ttsLang: a.ttsLang || 'fi-FI',
        enabled: !!a.enabled,
        singleDateTimeMillis: a.singleDateTimeMillis ?? null,
        weeklyDaysMask: a.weeklyDaysMask ?? null,
        weeklyHour: a.weeklyHour ?? null,
        weeklyMinute: a.weeklyMinute ?? null,
        updatedAtMillis: a.updatedAt?.toMillis?.() ?? 0,
      };
    });

    if (initial) {
      initial = false;
      await AlarmModule.replaceAllForUser(uid, rows);
    } else {
      await AlarmModule.upsertFromRemote(rows);
    }
  });

  return unsub;
}
