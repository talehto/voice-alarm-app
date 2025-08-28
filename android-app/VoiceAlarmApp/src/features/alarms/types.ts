// src/features/alarms/types.ts
export type AlarmType = "single" | "weekly";

export type WeeklySpec = {
  // bitmask Sun..Sat = bit0..bit6 (or use array<number> if you prefer)
  // 0b0111110 means Mon–Fri
  daysMask: number;        // 0–127
  timeOfDay: { hour: number; minute: number }; // local time
};

export type SingleSpec = {
  // exact trigger (local), store as ISO string
  dateTime: string;        // e.g. "2025-09-01T07:30:00.000+03:00"
};

export type Alarm = {
  id: number;
  type: AlarmType;
  title: string;           // split from label
  text: string;            // TTS content
  enabled: boolean;
  weekly?: WeeklySpec;
  single?: SingleSpec;
};
