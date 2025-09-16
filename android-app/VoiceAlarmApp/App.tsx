import React from "react";
import AppNavigator from "./src/navigation/AppNavigator";
import { AuthProvider } from './src/features/auth/AuthContext';
import { AlarmsProvider } from "./src/features/alarms/state/AlarmsContext";
import { configureGoogleSignIn } from './src/lib/googleSignIn';



export default function App() {  
  configureGoogleSignIn();
  return (
    <AuthProvider>
      <AlarmsProvider>
        <AppNavigator />
      </AlarmsProvider>
    </AuthProvider>
  );
}
