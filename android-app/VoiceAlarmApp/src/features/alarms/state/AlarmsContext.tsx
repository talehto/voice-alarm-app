// src/features/alarms/state/AlarmsContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import { NativeEventEmitter, NativeModules } from "react-native";

// --- Types ---
export type AlarmType = "single" | "weekly";

export type WeeklySpec = {
  daysMask: number;                     // bitmask Sun..Sat = bit0..bit6
  timeOfDay: { hour: number; minute: number };
};

export type SingleSpec = {
  dateTime: string;                     // ISO string
};

export type Alarm = {
  id: number;
  type: AlarmType;
  title: string;
  text: string;
  enabled: boolean;
  weekly?: WeeklySpec;
  single?: SingleSpec;
};

// --- Native bridge (thin wrapper) ---
const mod = NativeModules.AlarmModule;
if (!mod) throw new Error("AlarmModule not linked");

const AlarmNative = {
  getAll(): Promise<Alarm[]> { return mod.getAll(); },
  add(a: Omit<Alarm, "id" | "enabled"> & { enabled?: boolean; id?: number }): Promise<number> { return mod.add(a); },
  update(a: Alarm): Promise<void> { return mod.update(a); },
  remove(id: number): Promise<void> { return mod.remove(id); },
  emitter: new NativeEventEmitter(mod),
  EVENTS: { CHANGED: "alarmsChanged" },
};

// --- Context ---
type State = { alarms: Alarm[]; loaded: boolean };
type Action = { type: "SET_ALL"; payload: Alarm[] } | { type: "LOADED" };

const Ctx = createContext<{
  state: State;
  add(a: Omit<Alarm, "id" | "enabled"> & { enabled?: boolean; id?: number }): Promise<number>;
  update(a: Alarm): Promise<void>;
  remove(id: number): Promise<void>;
} | null>(null);

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "SET_ALL": return { ...s, alarms: a.payload };
    case "LOADED":  return { ...s, loaded: true };
    default:        return s;
  }
}

export const AlarmsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, { alarms: [], loaded: false });

  // initial load
  useEffect(() => {
    let mounted = true;
    AlarmNative.getAll()
      .then(rows => mounted && dispatch({ type: "SET_ALL", payload: rows }))
      .finally(() => mounted && dispatch({ type: "LOADED" }));
    return () => { mounted = false; };
  }, []);

  // live updates from native
  useEffect(() => {
    const sub = AlarmNative.emitter.addListener(AlarmNative.EVENTS.CHANGED, (rows: Alarm[]) => {
      dispatch({ type: "SET_ALL", payload: rows });
    });
    return () => sub.remove();
  }, []);

  const api = useMemo(() => ({
    state,
    add:  (a: Omit<Alarm, "id" | "enabled"> & { enabled?: boolean; id?: number }) => AlarmNative.add(a),
    update: (a: Alarm) => AlarmNative.update(a),
    remove: (id: number) => AlarmNative.remove(id),
  }), [state]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
};

export function useAlarms() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAlarms must be used within AlarmsProvider");
  return ctx;
}
