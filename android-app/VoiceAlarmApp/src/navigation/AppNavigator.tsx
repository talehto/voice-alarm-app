import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import AlarmListScreen from "../features/alarms/screens/AlarmListScreen";
import AlarmCreateScreen from "../features/alarms/screens/AlarmCreateScreen";
import type { Alarm } from "../features/alarms/state/AlarmsContext";

export type RootStackParamList = {
  AlarmList: undefined;
  AlarmCreate: { alarm?: Alarm; editMode?: boolean } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="AlarmList">
        <Stack.Screen 
          name="AlarmList" 
          component={AlarmListScreen} 
          options={{ title: "Your Alarms" }} 
        />
        <Stack.Screen 
          name="AlarmCreate" 
          component={AlarmCreateScreen} 
          options={{ title: "Create Alarm" }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
