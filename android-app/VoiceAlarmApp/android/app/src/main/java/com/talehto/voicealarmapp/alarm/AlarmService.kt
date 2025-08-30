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
import java.util.*

class AlarmService : Service(), TextToSpeech.OnInitListener {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var tts: TextToSpeech? = null
    private var currentAlarm: AlarmEntity? = null
    private var initialized = false
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "voicealarm:tts").apply { setReferenceCounted(false) }
    wakeLock?.acquire(10 * 60 * 1000L)
        createChannel()
        tts = TextToSpeech(this, this)
        tts?.setLanguage(Locale("fi"))
    }

    override fun onDestroy() {
        scope.cancel()
        tts?.stop()
        tts?.shutdown()
        wakeLock?.release()
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

        maybeStartStopUiIfForeground(alarm)
        //launchStopActivity(alarm)

        // Speak 5 times
        speakFiveTimes(alarm)

        // For weekly alarms, reschedule next occurrence
        if (alarm.type == "weekly") {
            AlarmScheduler.schedule(applicationContext, alarm)
        }

        stopSelf()
    }

    private fun maybeStartStopUiIfForeground(alarm: AlarmEntity) {
        if (isAppInForeground()) {
            val full = Intent(this, AlarmStopActivity::class.java).apply {
                putExtra(AlarmStopActivity.EXTRA_TITLE, alarm.title.ifBlank { "Alarm" })
                putExtra(AlarmStopActivity.EXTRA_TEXT,  alarm.text.ifBlank { "Alarm is ringing" })
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            startActivity(full) // Allowed when app is foreground
        }
    }
    
    private fun isAppInForeground(): Boolean {
        val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val procs = am.runningAppProcesses ?: return false
        val myPkg = packageName
        return procs.any { it.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND && it.processName == myPkg }
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
            .setSmallIcon(R.mipmap.ic_launcher) // correct R import
            .setContentTitle(alarm.title.ifBlank { "Alarm" })
            .setContentText(alarm.text.ifBlank { "Alarm is ringing" })
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setOnlyAlertOnce(true)
            .setOngoing(true) // stays in shade while speaking
            .setContentIntent(fullPending)
            .setFullScreenIntent(fullPending, true) // << key for background launch
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
        val txt = alarm.text.ifBlank { alarm.title.ifBlank { "Alarm" } }
        repeat(5) {
            say(txt)
            // naive wait: in real apps, hook onUtteranceProgressListener; here, wait ~3s
            delay(3000)
        }
    }

    private fun say(text: String) {
        val params = Bundle().apply {
            putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, UUID.randomUUID().toString())
        }
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, params, params.getString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID))
    }

    override fun onInit(status: Int) {
        initialized = (status == TextToSpeech.SUCCESS)
        tts?.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
        )
        tts?.language = Locale.getDefault()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val ch = NotificationChannel(
                CHANNEL_ID, "Alarms", NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Alarm notifications"
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            mgr.createNotificationChannel(ch)
        }
    }

    companion object {
        const val ACTION_START = "com.talehto.voicealarmapp.alarm.ACTION_START"
        const val ACTION_STOP = "com.talehto.voicealarmapp.alarm.ACTION_STOP"
        const val CHANNEL_ID = "alarms_channel"
        const val NOTIF_ID = 4041
    }
}
