import React from "react";
import AppNavigator from "./src/navigation/AppNavigator";
import { AlarmsProvider } from "./src/features/alarms/state/AlarmsContext";

export default function App() {  
  return (
    <AlarmsProvider>
      <AppNavigator />
    </AlarmsProvider>
  );
}
