// src/features/alarms/screens/AlarmListScreen.tsx
import React from "react";
import { View, Text, FlatList, Button, StyleSheet, TouchableOpacity, ActivityIndicator, Switch } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/AppNavigator";
import { useAlarms, Alarm } from "../state/AlarmsContext";

type Props = NativeStackScreenProps<RootStackParamList, "AlarmList">;

const dayShorts = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const hasBit = (mask: number, bit: number) => ((mask >> bit) & 1) === 1;

function formatAlarmRow(a: Alarm): { subtitle: string } {
  if (a.type === "single" && a.single?.dateTime) {
    const d = new Date(a.single.dateTime);
    const date = d.toLocaleDateString();
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return { subtitle: `${date} • ${time}` };
  }
  if (a.type === "weekly" && a.weekly) {
    const days = dayShorts
      .map((label, idx) => (hasBit(a.weekly!.daysMask, idx) ? label : null))
      .filter(Boolean)
      .join(", ");
    const time = `${String(a.weekly.timeOfDay.hour).padStart(2, "0")}:${String(a.weekly.timeOfDay.minute).padStart(2, "0")}`;
    return { subtitle: `${days || "No days"} • ${time}` };
  }
  return { subtitle: "" };
}

export default function AlarmListScreen({ navigation }: Props) {
  const { state, remove, setEnabled } = useAlarms();

  if (!state.loaded) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Button title="Add Alarm" onPress={() => navigation.navigate("AlarmCreate")} />

      <FlatList
        data={state.alarms}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => {
          const { subtitle } = formatAlarmRow(item);
          return (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
                {item.text ? <Text style={styles.textPreview} numberOfLines={1}>{item.text}</Text> : null}
                <View style={styles.inline}>
                  <Text style={styles.enabledLabel}>{item.enabled ? "Enabled" : "Disabled"}</Text>
                  <Switch
                    value={item.enabled}
                    onValueChange={(val) => setEnabled(item.id, val)}
                  />
                </View>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, styles.edit]}
                  onPress={() => navigation.navigate("AlarmCreate", { alarm: item, editMode: true })}
                >
                  <Text style={styles.btnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.delete]} onPress={() => remove(item.id)}>
                  <Text style={styles.btnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No alarms yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e1e1e1" },
  title: { fontSize: 16, fontWeight: "700" },
  subtitle: { fontSize: 14, color: "#555", marginTop: 2 },
  textPreview: { fontSize: 12, color: "#666", marginTop: 2 },
  actions: { flexDirection: "row", gap: 8, marginLeft: 12 },
  btn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  edit: { backgroundColor: "#3b82f6" },
  delete: { backgroundColor: "#ef4444" },
  btnText: { color: "#fff", fontWeight: "600" },
  empty: { textAlign: "center", color: "#666" },
  inline: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  enabledLabel: { fontSize: 12, color: "#666" },
});
