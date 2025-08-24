import React from "react";
import { View, Text, FlatList, Button, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/AppNavigator";
import { useAlarms } from "../state/AlarmsContext";

type Props = NativeStackScreenProps<RootStackParamList, "AlarmList">;

export default function AlarmListScreen({ navigation }: Props) {
  const { state, remove } = useAlarms();

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
          const timeLabel = new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          return (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.time}>{timeLabel}</Text>
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
  label: { fontSize: 16, fontWeight: "600" },
  time: { fontSize: 14, color: "#555", marginTop: 2 },
  actions: { flexDirection: "row", gap: 8, marginLeft: 12 },
  btn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  edit: { backgroundColor: "#3b82f6" },
  delete: { backgroundColor: "#ef4444" },
  btnText: { color: "#fff", fontWeight: "600" },
  empty: { textAlign: "center", color: "#666" },
});
