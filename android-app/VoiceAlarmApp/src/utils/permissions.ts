// permissions.ts
import { PermissionsAndroid, Platform } from 'react-native';

export async function ensureNotificationsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;           // iOS handled elsewhere
  if ((Platform.Version as number) < 33) return true;   // < Android 13: no runtime permission

  // RN 0.81 has proper typing; if your type defs complain, cast as any.
  const res = await PermissionsAndroid.request(
    (PermissionsAndroid as any).PERMISSIONS.POST_NOTIFICATIONS
  );
  return res === PermissionsAndroid.RESULTS.GRANTED;
}
