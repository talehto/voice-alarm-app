import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Platform,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/AppNavigator";
import DateTimePicker from "@react-native-community/datetimepicker";

type Props = NativeStackScreenProps<RootStackParamList, "AlarmCreate">;

export default function AlarmCreateScreen({ navigation, route }: Props) {
  const editingAlarm = route.params?.alarm;
  const editMode = route.params?.editMode ?? false;

  // If editing, parse the stored time string, otherwise default now
  const initialDate = editingAlarm
    ? new Date(editingAlarm.time)
    : new Date();

  const [label, setLabel] = useState(editingAlarm?.label || "");
  const [time, setTime] = useState(initialDate);
  const [showPicker, setShowPicker] = useState(false);

  const onChangeTime = (_: any, selectedDate?: Date) => {
    setShowPicker(Platform.OS === "ios");
    if (selectedDate) {
      setTime(selectedDate);
    }
  };

  const handleSave = () => {
    const uniqueId = editingAlarm?.id ?? Number(`${Date.now()}${Math.floor(Math.random()*1000)}`);
    const newAlarm = {
      id: uniqueId,   // keep id on edit, new id on create
      label,
      time: time.toISOString(),             // ISO for reliable parsing/formatting
    };
    navigation.navigate({
      name: "AlarmList",
      params: { newAlarm, editMode, _ts: Date.now() }, // _ts forces param change each time
      merge: true, // avoid pushing a new list instance
    } as any);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {editMode ? "Edit Alarm" : "Create Alarm"}
      </Text>

      <Text style={styles.label}>Label</Text>
      <TextInput
        style={styles.input}
        placeholder="Alarm label"
        value={label}
        onChangeText={setLabel}
      />

      <Text style={styles.label}>Time</Text>
      <Button title="Pick Time" onPress={() => setShowPicker(true)} />
      <Text style={styles.timePreview}>
        {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </Text>

      {showPicker && (
        <DateTimePicker
          value={time}
          mode="time"
          is24Hour
          display="default"
          onChange={onChangeTime}
        />
      )}

      <View style={styles.actions}>
        <Button title="Save" onPress={handleSave} />
        <Button title="Cancel" color="red" onPress={() => navigation.goBack()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: "600", marginBottom: 20 },
  label: { marginTop: 12, fontSize: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  timePreview: {
    marginVertical: 8,
    fontSize: 18,
    fontWeight: "500",
  },
  actions: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
