// src/navigation/AppNavigator.tsx
import React from "react";
import { Button } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../features/auth/AuthContext";
import LoginScreen from "../features/auth/LoginScreen";
import HandleClaimScreen from "../features/auth/HandleClaimScreen";
import AlarmListScreen from "../features/alarms/screens/AlarmListScreen";
import AlarmCreateScreen from "../features/alarms/screens/AlarmCreateScreen";

export type RootStackParamList = {
  Login: undefined;
  HandleClaim: undefined;
  AlarmList: undefined;
  AlarmCreate: { alarm?: any; editMode?: boolean } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { state, signOut } = useAuth();
  const { authLoading, user, profile, profileLoaded } = state;

  // While auth status or profile is loading, render nothing (or a Splash)
  if (authLoading || (user && !profileLoaded)) {
    return null; // or <Splash />
  }

  const needsLogin = !user;
  const needsHandle = !!user && profileLoaded && !profile?.handle;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={
          !needsLogin && !needsHandle
            ? {
                // Signed-in stack: show Logout in the header for every screen
                headerRight: () => <Button title="Logout" onPress={signOut} />,
              }
            : undefined
        }
      >
        {needsLogin ? (
          // Not signed in
          <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Sign in" }} />
        ) : needsHandle ? (
          // Signed in but no handle yet
          <Stack.Screen name="HandleClaim" component={HandleClaimScreen} options={{ title: "Username" }} />
        ) : (
          // Signed in and handle present → main app
          <>
            <Stack.Screen name="AlarmList" component={AlarmListScreen} options={{ title: "Alarms" }} />
            <Stack.Screen name="AlarmCreate" component={AlarmCreateScreen} options={{ title: "Create Alarm" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
