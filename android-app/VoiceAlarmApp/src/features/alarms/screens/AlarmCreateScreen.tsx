// src/features/alarms/screens/AlarmCreateScreen.tsx
import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Platform, TouchableOpacity, Alert } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/AppNavigator";
import { useAlarms, Alarm, AlarmType } from "../state/AlarmsContext";
import { ensureNotificationsPermission } from "../../../utils/permissions";

// ===== Language config (easily extend here) =====
type TtsLang = "fi-FI" | "en-US"; // extend as needed
const SUPPORTED_LANGUAGES: Array<{ code: TtsLang | string; label: string }> = [
  { code: "fi-FI", label: "Suomi (fi-FI)" },
  { code: "en-US", label: "English (en-US)" },
];

const dayLabels = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const toggleBit = (mask: number, bit: number) => (mask ^ (1 << bit));
const hasBit = (mask: number, bit: number) => ((mask >> bit) & 1) === 1;

type Props = NativeStackScreenProps<RootStackParamList, "AlarmCreate">;

export default function AlarmCreateScreen({ navigation, route }: Props) {
  const { add, update } = useAlarms();
  const editingAlarm = route.params?.alarm as Alarm | undefined;
  const editMode = route.params?.editMode ?? false;

  // type selection
  const [type, setType] = useState<AlarmType>(editingAlarm?.type ?? "single");

  // common fields
  const [title, setTitle] = useState(editingAlarm?.title ?? "");
  const [text, setText]   = useState(editingAlarm?.text ?? "");

  // NEW: language dropdown (default Finnish)
  const [ttsLang, setTtsLang] = useState<string>(editingAlarm?.["ttsLang"] ?? "fi-FI");

  // single
  const initialSingleDate = useMemo(() => {
    if (editingAlarm?.type === "single" && editingAlarm.single?.dateTime) {
      return new Date(editingAlarm.single.dateTime);
    }
    return new Date();
  }, [editingAlarm]);
  const [singleDate, setSingleDate] = useState<Date>(initialSingleDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // weekly
  const initHour   = editingAlarm?.type === "weekly" ? (editingAlarm.weekly?.timeOfDay.hour ?? 7) : 7;
  const initMinute = editingAlarm?.type === "weekly" ? (editingAlarm.weekly?.timeOfDay.minute ?? 0) : 0;
  const initMask   = editingAlarm?.type === "weekly" ? (editingAlarm.weekly?.daysMask ?? 0) : 0;

  const [weeklyHour, setWeeklyHour] = useState(initHour);
  const [weeklyMinute, setWeeklyMinute] = useState(initMinute);
  const [daysMask, setDaysMask] = useState(initMask);
  const [showWeeklyTimePicker, setShowWeeklyTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const onPickDate = (_: any, d?: Date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (d) setSingleDate(d);
  };
  const onPickTime = (_: any, d?: Date) => {
    setShowTimePicker(Platform.OS === "ios");
    if (d) setSingleDate(new Date(singleDate.getFullYear(), singleDate.getMonth(), singleDate.getDate(), d.getHours(), d.getMinutes(), 0, 0));
  };
  const onPickWeeklyTime = (_: any, d?: Date) => {
    setShowWeeklyTimePicker(Platform.OS === "ios");
    if (d) { setWeeklyHour(d.getHours()); setWeeklyMinute(d.getMinutes()); }
  };

  const handleSave = async () => {
    if (!title.trim()) { 
      Alert.alert("Error", "Please enter a title"); 
      return; 
    }

    if (saving) {
      return; // Prevent multiple saves
    }

    setSaving(true);

    try {
      // ensure notifications (Android 13+) – required for alarm notifications
      const ok = await ensureNotificationsPermission();
      if (!ok) {
        Alert.alert("Permission Required", "Notification permission is required for alarms to work properly. Please enable it in settings.");
        setSaving(false);
        return;
      }

      if (type === "single") {
        let dt = singleDate;
        const now = new Date();
        if (dt.getTime() <= now.getTime() + 2000) {
          dt = new Date(dt.getTime() + 24 * 60 * 60 * 1000); // push to tomorrow
        }
        const payload = {
          type: "single" as const,
          title,
          text,
          enabled: true,
          ttsLang: ttsLang as TtsLang,
          single: { dateTime: dt.toISOString() },
        };
        if (editMode && editingAlarm) {
          await update({ ...editingAlarm, ...payload });
        } else {
          await add(payload as any);
        }
      } else {
        if (daysMask === 0) { 
          Alert.alert("Error", "Select at least one weekday"); 
          setSaving(false);
          return; 
        }
        const payload = {
          type: "weekly" as const,
          title,
          text,
          enabled: true,
          ttsLang: ttsLang as TtsLang,
          weekly: { daysMask, timeOfDay: { hour: weeklyHour, minute: weeklyMinute } },
        };
        if (editMode && editingAlarm) {
          await update({ ...editingAlarm, ...payload });
        } else {
          await add(payload as any);
        }
      }
      
      // Only navigate back if save was successful
      navigation.goBack();
    } catch (error) {
      console.error("Failed to save alarm:", error);
      Alert.alert("Error", `Failed to save alarm: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{editMode ? "Edit Alarm" : "Create Alarm"}</Text>

      {/* Type selector */}
      <View style={styles.segment}>
        <SegmentButton label="Single" active={type === "single"} onPress={() => setType("single")} />
        <SegmentButton label="Weekly" active={type === "weekly"} onPress={() => setType("weekly")} />
      </View>

      {/* Title */}
      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Short title" />

      {/* Text */}
      <Text style={styles.label}>Text (spoken)</Text>
      <TextInput
        style={[styles.input, { height: 90, textAlignVertical: "top" }]}
        value={text}
        onChangeText={setText}
        placeholder="What should be spoken?"
        multiline
      />

      {/* Language dropdown */}
      <Text style={styles.label}>Speech language</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={ttsLang}
          onValueChange={(val) => setTtsLang(val)}
          dropdownIconColor="#333"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <Picker.Item key={lang.code} label={lang.label} value={lang.code} />
          ))}
        </Picker>
      </View>

      {type === "single" ? (
        <>
          <Text style={styles.label}>Date & Time</Text>
          <View style={styles.row}>
            <Button title={singleDate.toLocaleDateString()} onPress={() => setShowDatePicker(true)} />
            <View style={{ width: 8 }} />
            <Button
              title={singleDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              onPress={() => setShowTimePicker(true)}
            />
          </View>

          {showDatePicker && (
            <DateTimePicker value={singleDate} mode="date" display="default" onChange={onPickDate} />
          )}
          {showTimePicker && (
            <DateTimePicker value={singleDate} mode="time" is24Hour display="default" onChange={onPickTime} />
          )}
        </>
      ) : (
        <>
          <Text style={styles.label}>Weekdays</Text>
          <View style={styles.daysRow}>
            {dayLabels.map((d, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.dayChip, hasBit(daysMask, idx) && styles.dayChipOn]}
                onPress={() => setDaysMask(prev => toggleBit(prev, idx))}
              >
                <Text style={[styles.dayText, hasBit(daysMask, idx) && styles.dayTextOn]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Time of day</Text>
          <Button
            title={`${String(weeklyHour).padStart(2, "0")}:${String(weeklyMinute).padStart(2, "0")}`}
            onPress={() => setShowWeeklyTimePicker(true)}
          />
          {showWeeklyTimePicker && (
            <DateTimePicker
              value={new Date(2000, 0, 1, weeklyHour, weeklyMinute, 0, 0)}
              mode="time"
              is24Hour
              display="default"
              onChange={onPickWeeklyTime}
            />
          )}
        </>
      )}

      <View style={styles.actions}>
        <Button 
          title={saving ? "Saving..." : "Save"} 
          onPress={handleSave} 
          disabled={saving}
        />
        <Button 
          title="Cancel" 
          color="red" 
          onPress={() => navigation.goBack()} 
          disabled={saving}
        />
      </View>
    </View>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.segmentBtn, active && styles.segmentBtnActive]} onPress={onPress}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: "600", marginBottom: 16 },
  label: { marginTop: 12, marginBottom: 6, fontSize: 16 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10 },
  row: { flexDirection: "row", alignItems: "center" },
  actions: { marginTop: 24, flexDirection: "row", justifyContent: "space-between" },
  segment: { flexDirection: "row", gap: 8, marginBottom: 8 },
  segmentBtn: { flex: 1, paddingVertical: 10, borderWidth: 1, borderColor: "#bbb", borderRadius: 8, alignItems: "center" },
  segmentBtnActive: { backgroundColor: "#2157f2", borderColor: "#2157f2" },
  segmentText: { fontWeight: "600" },
  segmentTextActive: { color: "#fff" },
  daysRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: "#bbb" },
  dayChipOn: { backgroundColor: "#2157f2", borderColor: "#2157f2" },
  dayText: { fontWeight: "600" },
  dayTextOn: { color: "#fff" },
  pickerWrapper: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden" },
});
