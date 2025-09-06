package com.talehto.voicealarmapp.alarm

import android.app.*
import android.content.*
import android.media.AudioAttributes
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.talehto.voicealarmapp.R
import com.talehto.voicealarmapp.db.AppDatabase
import com.talehto.voicealarmapp.db.AlarmEntity
import kotlinx.coroutines.*
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.*
import android.app.ActivityManager

class AlarmService : Service(), TextToSpeech.OnInitListener {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var tts: TextToSpeech? = null
    private var currentAlarm: AlarmEntity? = null
    private var initialized = false
    private var wakeLock: PowerManager.WakeLock? = null

    // Utterance tracking
    private val utteranceCompletions = mutableMapOf<String, CompletableDeferred<Unit>>()

    private val audioManager by lazy { getSystemService(Context.AUDIO_SERVICE) as android.media.AudioManager }
    private var focusRequest: android.media.AudioFocusRequest? = null

    override fun onCreate() {
        super.onCreate()
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "voicealarm:tts").apply { setReferenceCounted(false) }
    wakeLock?.acquire(10 * 60 * 1000L)
        createChannel()
        tts = TextToSpeech(this, this)
    }

    override fun onDestroy() {

        try {
            if (Build.VERSION.SDK_INT >= 26) {
                focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
            } else {
                @Suppress("DEPRECATION")
                audioManager.abandonAudioFocus(null)
            }
        } catch (_: Exception) {}

        scope.cancel()
        tts?.stop()
        tts?.shutdown()
        wakeLock?.release()
        // Clean up any pending utterance completions
        utteranceCompletions.values.forEach { it.cancel() }
        utteranceCompletions.clear()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val id = intent.getIntExtra(AlarmReceiver.EXTRA_ALARM_ID, -1)
                if (id != -1) scope.launch { handleStart(id) }
            }
            ACTION_STOP -> stopSelf()
        }
        return START_NOT_STICKY
    }

    private suspend fun handleStart(alarmId: Int) {
        val db = AppDatabase.getDatabase(applicationContext)
        val dao = db.alarmDao()
        val alarm = dao.getAllOnce().firstOrNull { it.id == alarmId } ?: run { stopSelf(); return }
        currentAlarm = alarm

        // Start foreground immediately
        startForeground(NOTIF_ID, buildNotification(alarm))

        if (isAppInForeground() || isScreenOn()) {
            launchStopActivity(alarm)
        }

        // Speak 5 times
        speakFiveTimes(alarm)

        // For weekly alarms, reschedule next occurrence
        if (alarm.type == "weekly") {
            AlarmScheduler.schedule(applicationContext, alarm)
        }

        stopSelf()
    }
    
    private fun isAppInForeground(): Boolean {
        val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val my = packageName
        val procs = am.runningAppProcesses ?: return false
        return procs.any { it.processName == my && it.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND }
    }
    
    private fun isScreenOn(): Boolean {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        @Suppress("DEPRECATION")
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH) pm.isInteractive else pm.isScreenOn
    }

    private fun launchStopActivity(alarm: AlarmEntity) {
        val full = Intent(this, AlarmStopActivity::class.java).apply {
          putExtra(AlarmStopActivity.EXTRA_TITLE, alarm.title.ifBlank { "Alarm" })
          putExtra(AlarmStopActivity.EXTRA_TEXT,  alarm.text.ifBlank { "Alarm is ringing" })
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        startActivity(full)
    }

    private fun buildNotification(alarm: AlarmEntity): Notification {
        val stopIntent = Intent(this, AlarmService::class.java).apply { action = ACTION_STOP }
        val stopPending = PendingIntent.getService(
            this, 0, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    
        val full = Intent(this, AlarmStopActivity::class.java).apply {
            putExtra(AlarmStopActivity.EXTRA_TITLE, alarm.title.ifBlank { "Alarm" })
            putExtra(AlarmStopActivity.EXTRA_TEXT,  alarm.text.ifBlank { "Alarm is ringing" })
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val fullPending = PendingIntent.getActivity(
            this, 1, full, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    
        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(alarm.title.ifBlank { "Alarm" })
            .setContentText(alarm.text.ifBlank { "Alarm is ringing" })
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            //.setSilent(true)              // 🔇 mute builder on pre-O too
            .setDefaults(0)               // no default sound/vibrate/light
            //.setVibrate(null)             // just in case
            .setContentIntent(fullPending)
            .setFullScreenIntent(fullPending, true)
            .addAction(NotificationCompat.Action(0, "Stop", stopPending))
    
        if (Build.VERSION.SDK_INT >= 31) {
            builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
        }
        return builder.build()
    }
            
    private suspend fun speakFiveTimes(alarm: AlarmEntity) = withContext(Dispatchers.Main) {
        // Wait for TTS init if needed
        var tries = 0
        while (!initialized && tries < 20) {
            delay(100)
            tries++
        }

        // Acquire transient focus
        //NOTE: App works without this optimization.
        //TODO: Find out whether this is needed.
        if (Build.VERSION.SDK_INT >= 26) {
            val req = android.media.AudioFocusRequest.Builder(android.media.AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                ).build()
            if (audioManager.requestAudioFocus(req) == android.media.AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                focusRequest = req
            }
        } else {
            @Suppress("DEPRECATION")
            audioManager.requestAudioFocus(
                null,
                android.media.AudioManager.STREAM_MUSIC,
                android.media.AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
            )
        }

        val txt = alarm.text.ifBlank { alarm.title.ifBlank { "Alarm" } }
        repeat(5) {
            val utteranceId = say(txt)
            // Wait for actual utterance completion using onUtteranceProgressListener
            try {
                utteranceCompletions[utteranceId]?.await()
                // Clean up the completed utterance
                utteranceCompletions.remove(utteranceId)
            } catch (e: Exception) {
                android.util.Log.e("AlarmService", "Error waiting for utterance completion: ${e.message}")
                // Clean up the failed utterance
                utteranceCompletions.remove(utteranceId)
            }
        }
    }

    private fun say(text: String): String {
        val utteranceId = UUID.randomUUID().toString()
        val deferred = CompletableDeferred<Unit>()
        utteranceCompletions[utteranceId] = deferred
        
        val params = Bundle().apply {
            putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId)
        }
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId)
        
        return utteranceId
    }

    override fun onInit(status: Int) {
        initialized = (status == TextToSpeech.SUCCESS)
        tts?.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
        )
        //tts?.language = Locale.getDefault()
        val result = tts?.setLanguage(Locale("fi", "FI"))

        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            android.util.Log.w("AlarmService", "Finnish language not supported on this device")
        } else {
            android.util.Log.d("AlarmService", "Finnish language set")
        }
        
        // Set up utterance progress listener
        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {
                android.util.Log.d("AlarmService", "TTS started: $utteranceId")
            }
            
            override fun onDone(utteranceId: String?) {
                android.util.Log.d("AlarmService", "TTS completed: $utteranceId")
                utteranceId?.let { id ->
                    utteranceCompletions[id]?.complete(Unit)
                }
            }
            
            override fun onError(utteranceId: String?) {
                android.util.Log.e("AlarmService", "TTS error: $utteranceId")
                utteranceId?.let { id ->
                    utteranceCompletions[id]?.completeExceptionally(Exception("TTS error"))
                }
            }
        })
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val ch = NotificationChannel(
                CHANNEL_ID,
                "Alarms (Silent)",
                NotificationManager.IMPORTANCE_HIGH // heads-up visuals, no sound if muted
            ).apply {
                description = "Shows alarm UI without playing a notification sound"
                setSound(null, null)            // 🔇 no sound
                enableVibration(false)          // 🔇 no vibration
                vibrationPattern = null
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            mgr.createNotificationChannel(ch)
        }
    }

    companion object {
        const val ACTION_START = "com.talehto.voicealarmapp.alarm.ACTION_START"
        const val ACTION_STOP = "com.talehto.voicealarmapp.alarm.ACTION_STOP"
        const val CHANNEL_ID = "alarms_silent"
        const val NOTIF_ID = 4041
    }
}
