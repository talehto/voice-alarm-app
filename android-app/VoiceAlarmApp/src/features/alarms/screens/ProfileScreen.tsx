import React from "react";
import { View, Button } from "react-native";
import { useAuth } from "../../auth/AuthContext";

export default function ProfileScreen() {
  const { signOut } = useAuth();
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Button title="Logout" onPress={signOut} />
    </View>
  );
}
