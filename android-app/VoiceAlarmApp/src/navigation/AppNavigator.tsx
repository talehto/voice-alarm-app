// src/navigation/AppNavigator.tsx (sketch)
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../features/auth/AuthContext';
import LoginScreen from '../features/auth/LoginScreen';
import HandleClaimScreen from '../features/auth/HandleClaimScreen';
import AlarmListScreen from '../features/alarms/screens/AlarmListScreen';
import AlarmCreateScreen from '../features/alarms/screens/AlarmCreateScreen';
import { Button } from "react-native";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {

  // const { state, signOut } = useAuth();
  // const { loading, user, profile } = state;
  //if (loading) return null; // or splash

  const { authLoading, user, profile, profileLoaded } = useAuth().state;
  // Show splash/blank while determining state
  // if (authLoading || (user && profileLoading)) {
  //   return null; // or <Splash />
  // }

  // Show nothing (or a splash) until we KNOW the profile state.
  if (authLoading || (user && !profileLoaded)) {
    return null; // or <Splash />
  }
  

  // const needsLogin = !user;
  // const needsHandle = !!user && (!profile || !profile.handle);
  
  // const needsLogin  = !user;
  // const hasProfile  = !!profile;
  // const needsHandle = !!user && hasProfile && !profile?.handle;

  // const needsLogin  = !user;
  // const needsHandle = !!user && !profileLoading && !profile?.handle;

  const needsLogin  = !user;
  const needsHandle = !!user && profileLoaded && !profile?.handle;

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
              options={{ headerRight: () => <Button title="Logout" onPress={useAuth().signOut} /> }}
            />
            <Stack.Screen name="AlarmCreate" component={AlarmCreateScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );

  // return (
  //   <NavigationContainer>
  //     <Stack.Navigator>
  //       {needsLogin ? (
  //         <Stack.Screen name="Login" component={LoginScreen} />
  //       ) : needsHandle ? (
  //         <Stack.Screen name="HandleClaim" component={HandleClaimScreen} />
  //       ) : (
  //         <>
  //           <Stack.Screen
  //             name="AlarmList"
  //             component={AlarmListScreen}
  //             options={{
  //               title: "Alarms",
  //               headerRight: () => (
  //                 <Button title="Logout" onPress={signOut} />
  //               ),
  //             }}
  //           />
  //           <Stack.Screen
  //             name="AlarmCreate"
  //             component={AlarmCreateScreen}
  //             options={{ title: "Create Alarm" }}
  //           />
  //         </>
  //       )}
  //     </Stack.Navigator>
  //   </NavigationContainer>
  // );
}
