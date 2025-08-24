import { NativeModules, NativeEventEmitter } from "react-native";

type Alarm = { id: number; label: string; time: string };

const LINKING_ERROR =
  `The native module 'AlarmModule' is not linked. ` +
  `Make sure you rebuilt the app after installing & registered the package.`;

const _mod = NativeModules.AlarmModule ?? (() => { throw new Error(LINKING_ERROR); })();

export const AlarmNative = {
  // CRUD (all return Promises)
  getAll(): Promise<Alarm[]> {
    return _mod.getAll(); // returns array of alarms
  },
  add(alarm: Omit<Alarm, "id"> & { id?: number }): Promise<number> {
    return _mod.add(alarm); // returns numeric id
  },
  update(alarm: Alarm): Promise<void> {
    return _mod.update(alarm);
  },
  remove(id: number): Promise<void> {
    return _mod.remove(id);
  },

  // Event emitter for DB changes
  emitter: new NativeEventEmitter(_mod),

  // Recommended event name (keep stable)
  EVENTS: {
    CHANGED: "alarmsChanged", // payload: Alarm[]
  },
};

export type { Alarm };
