# VoiceAlarmApp Documentation

## 1. Product Overview
- VoiceAlarmApp is a React Native client that lets authenticated users schedule speech-based alarms.
- Firebase Authentication (Google, email/password) and Firestore back the user identity and cloud alarm storage.
- Native Android services handle precise scheduling, foreground notifications, and Text-to-Speech playback when an alarm fires.

## 2. Technology Stack
- React Native 0.80 with React 19 for mobile UI (App.tsx).
- React Navigation native stack for routing (src/navigation/AppNavigator.tsx).
- Firebase modular SDKs for auth and Firestore access (@react-native-firebase/*).
- Room database for local alarm persistence (ndroid/app/src/main/java/com/talehto/voicealarmapp/db).
- Android AlarmManager + foreground AlarmService for alarms, TextToSpeech for playback.
- Google Sign-In SDK (src/lib/googleSignIn.ts) configured via .env > GOOGLE_WEB_CLIENT_ID.

## 3. JavaScript/TypeScript Architecture
### 3.1 Providers and Contexts
- src/features/auth/AuthContext.tsx: wraps Firebase auth, Google Sign-In, email flows, and loads /users/{uid} profile documents. Attaches the Firestore -> native sync listener when a user is present.
- src/features/alarms/state/AlarmsContext.tsx: single source of truth for alarms in React. It calls the native AlarmModule for local persistence and mirrors changes back to Firestore through saveAlarmRemote / deleteAlarmRemote.

### 3.2 Screens and UX
- LoginScreen.tsx: Google sign-in, email/handle auth, password reset.
- HandleClaimScreen.tsx: transactional username claim stored under /handles/{handle} and /users/{uid}.
- AlarmListScreen.tsx: renders alarms with enable toggles, edit/delete actions, and the ability to navigate to the editor.
- AlarmCreateScreen.tsx: supports single and weekly alarms, language selection, date/time pickers, and permission checks before saving.

### 3.3 Alarm Data Flow (JS side)
1. UI dispatches to AlarmsContext (dd, update, emove, setEnabled).
2. Context constructs RemoteAlarm payloads (src/features/alarms/sync/remoteApi.ts) and writes to Firestore.
3. On success, the context mirrors the change to the native module for immediate UI feedback.
4. Firestore listener (ttachAlarmsListener) eventually publishes authoritative rows back to native, ensuring local Room + UI stay consistent.

## 4. Native Android Architecture
### 4.1 Room Persistence Layer
- AlarmEntity.kt: schema for stored alarms, aligned with Firestore fields and enhanced with owner/target metadata.
- AlarmDao.kt: CRUD, bulk upserts by emoteId, and helpers for scheduling state.
- AppDatabase.kt: Room database singleton with schema migrations up to version 4.

### 4.2 React Native Bridge
- AlarmModule.kt: exposes CRUD, replacement, and incremental sync entry points to JS; re-schedules alarms after every change.
- AlarmPackage.kt: registers the module in MainApplication.kt so NativeModules.AlarmModule is available in JavaScript.

### 4.3 Alarm Lifecycle Components
- AlarmScheduler.kt: maps alarm specs to the next trigger time and maintains corresponding PendingIntents.
- AlarmReceiver.kt: wakes when AlarmManager fires and starts AlarmService in the foreground.
- AlarmService.kt: grabs wake locks, promotes itself to foreground, shows a full-screen stop UI, acquires audio focus, sets the TTS language, and speaks alarm text five times; weekly alarms are re-scheduled after firing.
- AlarmStopActivity.kt: heads-up screen that turns on over the lock screen and lets the user stop the alarm.
- ctivity_alarm_stop.xml: simple dark theme layout for the stop UI.

### 4.4 Notification & Permission Model
- Foreground service notification channel larms_silent (importance high, muted sound) is created in AlarmService#createChannel().
- AndroidManifest.xml declares exact alarm, wake lock, full-screen intent, notification, and foreground service permissions.
- Runtime notification permission is requested on Android 13+ by ensureNotificationsPermission().

## 5. Cloud Synchronisation Model
- Firestore hierarchy: /users/{uid} documents hold profile data; /users/{uid}/alarms/{alarmId} subcollection stores alarm specs.
- Handles are stored under /handles/{lowercaseHandle} with the owning UID for uniqueness.
- saveAlarmRemote derives an alarm id (existing emoteId or generated timestamp/random token) and writes merged data with updatedAt timestamps. deleteAlarmRemote removes subcollection documents.
- ttachAlarmsListener orders snapshots by updatedAt and streams them into the native layer. First snapshot replaces all local rows for the user; subsequent snapshots upsert.

## 6. Permissions, Wake Locks, and Background Behaviour
- AlarmService acquires a partial wake lock for up to 10 minutes, ensuring TTS playback even if the device is idle.
- Audio focus is requested transiently (AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK) to duck other media while speaking.
- Foreground service starts with a placeholder notification to satisfy Android's 5s rule; replaced by the detailed notification once alarm data is loaded.
- AlarmStopActivity is launched as a full-screen intent and is auto-dismissed after 15 seconds or when the user presses Stop.

## 7. Configuration & Environment
- .env must provide GOOGLE_WEB_CLIENT_ID for Google Sign-In. The value is consumed via eact-native-dotenv (src/lib/googleSignIn.ts).
- Firebase app configuration is expected via the standard native files (google-services.json / GoogleService-Info.plist) which must be added separately.
- To override Firebase environments, adjust the native config files and redeploy; JavaScript modules reference whichever default app is bundled.

## 8. Running & Tooling
- Install dependencies: 
pm install (Node 18+ required).
- Start Metro: 
pm start.
- Android build & install: 
pm run android (ensure an emulator or device is connected and ndroid/local.properties points to your SDK).
- iOS build: undle exec pod install inside ios, then 
pm run ios (macOS only).
- Linting: 
pm run lint; testing: 
pm test (no custom tests are defined yet).
- Native rebuild is required after modifying Kotlin/Java files (./gradlew assembleDebug or rerun 
pm run android).

## 9. Extending the App
- Add new alarm recurrence types by extending AlarmEntity, DAO migrations, scheduler logic, and the React form.
- Integrate remote notifications (e.g., FCM) by posting from Firestore triggers and listening in React Native.
- Support multi-target alarms by expanding 	argetUid semantics and exposing selection UI in AlarmCreateScreen.
- Add analytics or logging by tapping into context methods (AlarmsContext) and service lifecycle events.

## 10. Troubleshooting Notes
- If the stop dialog never appears, confirm the Alarms (Silent) notification channel still has high importance (channels cannot be changed programmatically after creation).
- Keep an eye on db logcat for tags AlarmModule, AlarmService, AlarmScheduler, and AlarmReceiver to trace scheduling issues.
- When alarms fail to speak, verify TTS language availability on the device; the service falls back to Finnish if the chosen locale is unsupported.

## 11. Repository Layout Cheat Sheet
`
App.tsx                         # wraps providers and navigator
src/features/auth               # auth screens and context
src/features/alarms             # alarm screens, context, sync helpers
src/lib/googleSignIn.ts         # Google Sign-In configuration
android/app/src/main/java/...   # native alarm, db, and bridge code
ios/                            # iOS host project (no custom native code yet)
`

