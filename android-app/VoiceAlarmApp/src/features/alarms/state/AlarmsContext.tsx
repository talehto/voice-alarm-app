// src/features/alarms/state/AlarmsContext.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { NativeEventEmitter, NativeModules } from "react-native";
import { useAuth } from "../../auth/AuthContext";
import { saveAlarmRemote, deleteAlarmRemote, type RemoteAlarm } from "../sync/remoteApi";

/* ----------------------------- Types & helpers ----------------------------- */
// This context file defines the alarms “data layer” for the React Native UI. 
// It creates a React context that loads alarms from the native Room database, 
// keeps them in sync with Firestore, and exposes actions 
// (add/update/remove/enable) to the rest of the app.

export type AlarmType = "single" | "weekly";
export type TtsLang = "fi-FI" | "en-US";

export type TimeOfDay = { hour: number; minute: number };
export type WeeklySpec = { daysMask: number; timeOfDay: TimeOfDay };
export type SingleSpec = { dateTime: string; dateTimeMillis?: number };

export type Alarm = {
  // Local (Room) identity
  id: number;
  // Firestore identity
  remoteId?: string;
  // Ownership/targeting
  ownerUid: string;
  targetUid: string;

  type: AlarmType;
  title: string;
  text: string;
  ttsLang: TtsLang;
  enabled: boolean;

  single?: SingleSpec;
  weekly?: WeeklySpec;

  updatedAtMillis: number;
};

type State = {
  loading: boolean;
  loaded: boolean;
  alarms: Alarm[];
};

// CtxApi is just the TypeScript shape of what the context provides. 
// AlarmsProvider actually creates those functions/state and passes them into the context.
type CtxApi = {
  state: State;
  add: (a: {
    type: AlarmType;
    title: string;
    text: string;
    ttsLang: TtsLang;
    enabled?: boolean;
    single?: { dateTime: string };
    weekly?: { daysMask: number; timeOfDay: TimeOfDay };
  }) => Promise<string>; // returns remoteId
  update: (a: Alarm) => Promise<void>;
  remove: (idOrRemoteId: number | string) => Promise<void>;
  setEnabled: (id: number, enabled: boolean) => Promise<void>;
};

const Ctx = createContext<CtxApi | null>(null);

/* ----------------------------- Native bridge ------------------------------ */

type AlarmModuleType = {
  getAll: () => Promise<any[]>; // returns rows from Room
  upsertFromRemote: (rows: any[]) => Promise<void>;
  replaceAllForUser: (uid: string, rows: any[]) => Promise<void>;
};
const { AlarmModule } = NativeModules as { AlarmModule: AlarmModuleType };

/* ------------------------- Mapping Room -> UI shape ------------------------ */

function mapNativeRow(row: any): Alarm {
  const type: AlarmType = row.type === "weekly" ? "weekly" : "single";
  const singleMillis = row.singleDateTimeMillis ?? null;

  return {
    id: row.id,
    remoteId: row.remoteId ?? undefined,
    ownerUid: row.ownerUid || "",
    targetUid: row.targetUid || "",
    type,
    title: row.title || "",
    text: row.text || "",
    ttsLang: (row.ttsLang || "fi-FI") as TtsLang,
    enabled: !!row.enabled,
    single:
      type === "single"
        ? {
            dateTimeMillis: singleMillis ?? undefined,
            dateTime: singleMillis ? new Date(singleMillis).toISOString() : new Date().toISOString(),
          }
        : undefined,
    weekly:
      type === "weekly"
        ? {
            daysMask: row.weeklyDaysMask ?? 0,
            timeOfDay: {
              hour: row.weeklyHour ?? 7,
              minute: row.weeklyMinute ?? 0,
            },
          }
        : undefined,
    updatedAtMillis: row.updatedAtMillis ?? 0,
  };
}

/* -------------------------------- Provider -------------------------------- */

export function AlarmsProvider({ children }: { children: React.ReactNode }) {
  const { state: auth } = useAuth();
  const uid = auth.user?.uid ?? null;

  const [state, setState] = useState<State>({ loading: true, loaded: false, alarms: [] });

  // useCallback is a React hook that memoizes (= cache the result) a function so its identity stays stable between 
  // renders unless its dependencies change.
  // Benefits of useCallback hook:
  // 1. Performance Optimization: Prevents unnecessary re-creations of functions on every render. Only when uid changes.
  // 2. Stable References: Useful when passing functions as props to child components that rely on reference equality.
  // 3. Dependency Management: Allows you to specify dependencies, ensuring the function is updated only when necessary.
  const refreshFromNative = useCallback(async () => {
    try {
      console.log("AlarmsProvider before AlarmModule.getAll()")
      const rows = (await AlarmModule.getAll()) || [];
      console.log("AlarmsProvider after AlarmModule.getAll()")
      const mapped = rows.map(mapNativeRow);
      // If you want to scope by current user (in case getAll returns all):
      const filtered = uid ? mapped.filter((a) => a.targetUid === uid) : mapped;
      setState({ loading: false, loaded: true, alarms: filtered });
    } catch (_e) {
      console.log("AlarmsProvider EXCEPTION: " + _e)
      setState((s) => ({ ...s, loading: false, loaded: true }));
    }
  }, [uid]);

  // Initial load & subscribe to native "alarmsChanged" to keep UI in sync
  useEffect(() => {
    // Below are updated loading and loaded state members.
    setState((s) => ({ ...s, loading: true, loaded: false }));
    refreshFromNative();

    const emitter = new NativeEventEmitter(NativeModules.AlarmModule);
    const sub = emitter.addListener("alarmsChanged", () => {
      refreshFromNative();
    });
    return () => {
      try { sub.remove(); } catch {}
    };
  }, [refreshFromNative]);

  // When user switches accounts, refresh list (Room gets replaced by Firestore listener from AuthProvider)
  useEffect(() => {
    setState((s) => ({ ...s, loading: true, loaded: false }));
    refreshFromNative();
  }, [uid, refreshFromNative]);

  /* ------------------------------- Actions -------------------------------- */

  // This method do following things:
  // 1. Build a payload (the alarm fields to store).
  // 2. saveAlarmRemote(uid, payload) writes the alarm to Firebase/Firestore and returns a remoteId.
  // 3. Then it calls AlarmModule.upsertFromRemote([...]) with the same payload + remoteId + updatedAtMillis 
  //    as an optimistic local mirror so the UI updates immediately.
  // 4. Finally, it calls refreshFromNative() to pull fresh data from Room database to ensure UI is in sync.
  const add: CtxApi["add"] = useCallback(
    async (a) => {
      console.log("AlarmsContext.add() start");
      if (!uid) throw new Error("Not signed in");

      const payload: RemoteAlarm = {
        ownerUid: uid,
        targetUid: uid, // extend later for grants
        type: a.type,
        title: a.title,
        text: a.text,
        ttsLang: a.ttsLang,
        enabled: a.enabled ?? true,
        singleDateTimeMillis: a.type === "single" ? Date.parse(a.single!.dateTime) : null,
        weeklyDaysMask: a.type === "weekly" ? a.weekly!.daysMask : null,
        weeklyHour: a.type === "weekly" ? a.weekly!.timeOfDay.hour : null,
        weeklyMinute: a.type === "weekly" ? a.weekly!.timeOfDay.minute : null,
      };

      console.log("AlarmsContext.add() calling saveAlarmRemote");
      const remoteId = await saveAlarmRemote(uid, payload);
      console.log("AlarmsContext.add() saveAlarmRemote completed, remoteId:", remoteId);

      try {
        // Optional optimistic mirror so UI updates immediately (snapshot will confirm shortly)
        console.log("AlarmsContext.add() calling AlarmModule.upsertFromRemote");
        await AlarmModule.upsertFromRemote([
          {
            ...payload,
            remoteId,
            updatedAtMillis: Date.now(),
          },
        ]);
        console.log("AlarmsContext.add() AlarmModule.upsertFromRemote completed");

        // Pull fresh (in case DAO preserved local IDs etc.)
        console.log("AlarmsContext.add() calling refreshFromNative");
        // This is done here to ensure that the newly added alarm appears in the UI immediately.
        // This is needed to get preserve or assign stable local IDs.
        await refreshFromNative();
        console.log("AlarmsContext.add() refreshFromNative completed");
        
        return remoteId;
      } catch (error) {
        console.error("AlarmsContext.add() error in native operations:", error);
        // Still return the remoteId even if native operations fail
        // The Firestore listener will eventually sync the data
        return remoteId;
      }
    },
    [uid, refreshFromNative]
  );

  const update: CtxApi["update"] = useCallback(
    async (a) => {
      if (!uid) throw new Error("Not signed in");
      const payload: RemoteAlarm = {
        remoteId: a.remoteId,
        ownerUid: a.ownerUid || uid,
        targetUid: a.targetUid || uid,
        type: a.type,
        title: a.title,
        text: a.text,
        ttsLang: a.ttsLang,
        enabled: a.enabled,
        singleDateTimeMillis: a.type === "single" ? (a.single?.dateTime ? Date.parse(a.single.dateTime) : null) : null,
        weeklyDaysMask: a.type === "weekly" ? a.weekly?.daysMask ?? null : null,
        weeklyHour: a.type === "weekly" ? a.weekly?.timeOfDay?.hour ?? null : null,
        weeklyMinute: a.type === "weekly" ? a.weekly?.timeOfDay?.minute ?? null : null,
      };
      const id = await saveAlarmRemote(uid, payload);

      await AlarmModule.upsertFromRemote([
        { ...payload, remoteId: id, updatedAtMillis: Date.now() },
      ]);

      await refreshFromNative();
    },
    [uid, refreshFromNative]
  );

  const remove: CtxApi["remove"] = useCallback(
    async (idOrRemoteId) => {
      if (!uid) throw new Error("Not signed in");

      let remoteId: string | undefined;
      if (typeof idOrRemoteId === "string") {
        remoteId = idOrRemoteId;
      } else {
        const hit = state.alarms.find((x) => x.id === idOrRemoteId);
        remoteId = hit?.remoteId;
      }
      if (!remoteId) throw new Error("Alarm not found");

      await deleteAlarmRemote(uid, remoteId);
      // Let snapshot update Room → native emitter will refresh us.
    },
    [uid, state.alarms]
  );

  const setEnabled: CtxApi["setEnabled"] = useCallback(
    async (id, enabled) => {
      if (!uid) throw new Error("Not signed in");
      const a = state.alarms.find((x) => x.id === id);
      if (!a?.remoteId) return;

      const payload: RemoteAlarm = {
        remoteId: a.remoteId,
        ownerUid: a.ownerUid || uid,
        targetUid: a.targetUid || uid,
        type: a.type,
        title: a.title,
        text: a.text,
        ttsLang: a.ttsLang,
        enabled,
        singleDateTimeMillis: a.type === "single" ? (a.single?.dateTime ? Date.parse(a.single.dateTime) : null) : null,
        weeklyDaysMask: a.type === "weekly" ? a.weekly?.daysMask ?? null : null,
        weeklyHour: a.type === "weekly" ? a.weekly?.timeOfDay?.hour ?? null : null,
        weeklyMinute: a.type === "weekly" ? a.weekly?.timeOfDay?.minute ?? null : null,
      };

      await saveAlarmRemote(uid, payload);
      // Optimistic local update:
      await AlarmModule.upsertFromRemote([
        { ...payload, updatedAtMillis: Date.now() },
      ]);
      await refreshFromNative();
    },
    [uid, state.alarms, refreshFromNative]
  );

  const value = useMemo<CtxApi>(
    () => ({ state, add, update, remove, setEnabled }),
    [state, add, update, remove, setEnabled]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ---------------------------------- Hook ---------------------------------- */

export function useAlarms() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAlarms must be used within AlarmsProvider");
  return ctx;
}
