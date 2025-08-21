// src/features/alarms/screens/AlarmListScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Button, StyleSheet, TouchableOpacity } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "AlarmList">;

export type Alarm = {
  id: number;          // from Date.now() in create/edit screen
  label: string;
  time: string;        // ISO string
};

export default function AlarmListScreen({ navigation, route }: Props) {
  const [alarms, setAlarms] = useState<Alarm[]>([]);

  // Handle a new or edited alarm coming back from AlarmCreateScreen
  useEffect(() => {
    const newAlarm = route.params?.newAlarm as Alarm | undefined;
    const editMode = route.params?.editMode ?? false;
    if (!newAlarm) return;
  
    setAlarms(prev => {
      const idx = prev.findIndex(a => a.id === newAlarm.id);
      if (idx >= 0) {
        // replace existing
        const next = prev.slice();
        next[idx] = newAlarm;
        return next;
      }
      // append new
      return [...prev, newAlarm];
    });
  
    // clear params so effect doesn't run again unexpectedly
    navigation.setParams({ newAlarm: undefined, editMode: undefined, _ts: undefined });
  }, [route.params?._ts]);

  const deleteAlarm = (id: number) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  };

  const renderItem = ({ item }: { item: Alarm }) => {
    const timeLabel = new Date(item.time).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.time}>{timeLabel}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.edit]}
            onPress={() =>
              navigation.navigate("AlarmCreate", { alarm: item, editMode: true })
            }
          >
            <Text style={styles.btnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.delete]} onPress={() => deleteAlarm(item.id)}>
            <Text style={styles.btnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Button title="Add Alarm" onPress={() => navigation.navigate("AlarmCreate")} />
      <FlatList
        data={alarms}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No alarms yet</Text>}
        contentContainerStyle={alarms.length === 0 ? { flex: 1, justifyContent: "center" } : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e1e1",
  },
  label: { fontSize: 16, fontWeight: "600" },
  time: { fontSize: 14, color: "#555", marginTop: 2 },
  actions: { flexDirection: "row", gap: 8, marginLeft: 12 },
  btn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  edit: { backgroundColor: "#3b82f6" },
  delete: { backgroundColor: "#ef4444" },
  btnText: { color: "#fff", fontWeight: "600" },
  empty: { textAlign: "center", color: "#666" },
});
