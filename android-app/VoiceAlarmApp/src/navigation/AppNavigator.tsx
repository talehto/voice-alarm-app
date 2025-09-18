// src/navigation/AppNavigator.tsx (sketch)
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../features/auth/AuthContext';
import LoginScreen from '../features/auth/LoginScreen';
import HandleClaimScreen from '../features/auth/HandleClaimScreen';
import AlarmListScreen from '../features/alarms/screens/AlarmListScreen';
import AlarmCreateScreen from '../features/alarms/screens/AlarmCreateScreen';
import { Button } from "react-native";

export type RootStackParamList = {
  AlarmList: undefined;
  AlarmCreate: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {

  const { state, signOut } = useAuth();
  const { authLoading, user, profile, profileLoaded, handleLoaded, hasHandle } = state;

  // Wait until both profile and handle checks have loaded to avoid transient flashes
  if (authLoading || (user && (!profileLoaded || !handleLoaded))) {
    return null; // or <Splash />
  }
  
  const needsLogin  = !user;
  // Prefer the authoritative reverse-index check (hasHandle). Fall back to profile?.handle if available.
  const userHasHandle = hasHandle || !!profile?.handle;
  const needsHandle = !!user && !userHasHandle;

  // no hooks after this point before any early returns

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {needsLogin ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : needsHandle ? (
          <Stack.Screen name="HandleClaim" component={HandleClaimScreen} />
        ) : (
          <>
            <Stack.Screen
              name="AlarmList"
              component={AlarmListScreen}
              options={{ headerRight: () => <Button title="Logout" onPress={signOut} /> }}
            />
            <Stack.Screen name="AlarmCreate" component={AlarmCreateScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
