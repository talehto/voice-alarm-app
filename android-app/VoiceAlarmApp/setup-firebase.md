# Setup firebase for an authentication and firestorage usage

Android setup (summary):

Add your Android app in Firebase console with the same applicationId.

Upload SHA-1 + SHA-256 for debug/release.
```
C:\voice-alarm-app\android-app\VoiceAlarmApp\android>gradlew.bat signingReport
```
```
Variant: debugAndroidTest
Config: debug
Store: C:\voice-alarm-app\android-app\VoiceAlarmApp\android\app\debug.keystore
Alias: androiddebugkey
MD5: XXX
SHA1: <copy this>
SHA-256: <copy this>
Valid until: Wednesday, 1 May 2052
```

Download google-services.json to android/app/.

In android/build.gradle: classpath 'com.google.gms:google-services:4.4.2'

In android/app/build.gradle: apply plugin: 'com.google.gms.google-services'

Configure Google Sign-In in Firebase Console (enable provider).

You can find web client id in firebase:
Open project -> Authentication -> Sign-in method -> Select google -> Web SDK configuration

Set web client id to the .env file in the following way:
```
GOOGLE_WEB_CLIENT_ID=xxx
```

```
// src/lib/googleSignIn.ts
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export function configureGoogleSignIn() {
  GoogleSignin.configure({
    webClientId: '<YOUR_WEB_CLIENT_ID>.apps.googleusercontent.com', // from Firebase console
    offlineAccess: false,
    forceCodeForRefreshToken: false,
  });
}
```

# Firestore security rules
Firebase Console (quick edits)

- Go to Firebase Console → Firestore Database → Rules tab
- There you can paste/edit your rules and publish them.
- This is easiest while prototyping.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function signedIn() { return request.auth != null; }

    match /users/{uid} {
      allow read: if signedIn();
      allow write: if signedIn() && request.auth.uid == uid;
    }

    // Public read, claimed once. For stronger guarantees, write only via CF.
    match /handles/{handle} {
      allow read: if true;
      allow create: if signedIn() && !exists(/databases/$(db)/documents/handles/$(handle));
      allow update, delete: if false;
    }

    // You can add /grants and /alarms later per your linking design
  }
}
```

# Dependencies

@react-native-firebase/app and @react-native-firebase/auth installed.

@react-native-google-signin/google-signin installed and linked.

android/app/google-services.json present.

android/app/build.gradle has:

```
apply plugin: 'com.google.gms.google-services'
```

android/build.gradle has:

```
classpath 'com.google.gms:google-services:4.4.2'
```

