import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import { AlarmNative, type Alarm } from "../services/AlarmNative";
import { NativeModules, NativeEventEmitter } from "react-native";

type State = { alarms: Alarm[]; loaded: boolean };
type Action =
  | { type: "SET_ALL"; payload: Alarm[] }
  | { type: "LOADED" };

const Ctx = createContext<{
  state: State;
  add(alarm: Omit<Alarm, "id"> & { id?: number }): Promise<number>;
  update(alarm: Alarm): Promise<void>;
  remove(id: number): Promise<void>;
} | null>(null);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_ALL":
      return { ...state, alarms: action.payload };
    case "LOADED":
      return { ...state, loaded: true };
    default:
      return state;
  }
}

export const AlarmsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, { alarms: [], loaded: false });

  // Initial load
  useEffect(() => {
    let mounted = true;
    AlarmNative.getAll()
      .then((rows) => mounted && dispatch({ type: "SET_ALL", payload: rows }))
      .finally(() => mounted && dispatch({ type: "LOADED" }));
    return () => { mounted = false; };
  }, []);

  // Subscribe to native DB change stream
  useEffect(() => {
    const sub = AlarmNative.emitter.addListener(AlarmNative.EVENTS.CHANGED, (rows: Alarm[]) => {
      dispatch({ type: "SET_ALL", payload: rows });
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const emitter = new NativeEventEmitter(NativeModules.AlarmModule);
    const sub = emitter.addListener("alarmsChanged", (rows: Alarm[]) => {
      dispatch({ type: "SET_ALL", payload: rows });
    });
    return () => sub.remove();
  }, []);

  // CRUD actions just call native; the stream will refresh the list
  const api = useMemo(() => ({
    state,
    add: (a: Omit<Alarm, "id"> & { id?: number }) => AlarmNative.add(a),
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
