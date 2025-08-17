package package com.talehto.voicealarmapp.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.IntentFilter
import android.os.Build
import android.os.IBinder
import android.speech.tts.TextToSpeech
import java.util.Locale
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class TTSService : Service() {
    private var tts: TextToSpeech? = null
    private var alarmMessage: String? = null
    private var packageName: String? = null
    private var repeatCount = 0
    private val stopReceiver: BroadcastReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            stopSelf()
        }
    }

    override fun onCreate() {
        super.onCreate()

        packageName = getPackageName()
        Log.d("TTSService", "Service created with package: $packageName")

        // Register broadcast receiver using ContextCompat for automatic API compatibility
        ContextCompat.registerReceiver(
            this,
            stopReceiver, 
            IntentFilter("com.ttsalarmapp.STOP_TTS_SERVICE"), 
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel(
                    CHANNEL_ID, "TTS Channel", NotificationManager.IMPORTANCE_HIGH)
            val manager: NotificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)

            // 🔹 Intent for stop a tts service.
            val stopIntent = Intent("com.ttsalarmapp.STOP_TTS_SERVICE")
            val stopPendingIntent: PendingIntent = PendingIntent.getBroadcast(
                    this,
                    0,
                    stopIntent,
                    PendingIntent.FLAG_IMMUTABLE
            )
            val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
                    .setContentTitle("TTS Alarm")
                    .setContentText("Speaking message...")
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setOngoing(true)
                    .addAction(NotificationCompat.Action(
                            R.mipmap.ic_launcher,
                            "Pysäytä",
                            stopPendingIntent
                    ))
                    .build()
            startForeground(1, notification)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Retrieve message from the Intent object.
        if (intent != null) {
            alarmMessage = intent.getStringExtra("alarm_message")
        }

        // Starting the text-to-speech functionality. 
        Log.d("TTSService", "Starting TTS with message: $alarmMessage")
        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.setLanguage(Locale("fi"))
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {
                    }

                    override fun onDone(utteranceId: String?) {
                        repeatCount++
                        if (repeatCount < MAX_REPEATS) {
                            tts?.speak(alarmMessage, TextToSpeech.QUEUE_FLUSH, null, "ALARM_UTTERANCE")
                        } else {
                            // Closing a "stop speech" dialog.
                            val doneIntent = Intent("com.ttsalarmapp.ACTION_ALARM_FINISHED")
                            doneIntent.setPackage(packageName) // Explicitly target this app
                            sendBroadcast(doneIntent)
                            stopSelf()
                        }
                    }

                    override fun onError(utteranceId: String?) {
                        stopSelf()
                    }
                })
                tts?.speak(alarmMessage, TextToSpeech.QUEUE_FLUSH, null, "ALARM_UTTERANCE")
            }
        }
        return START_STICKY
        //return START_NOT_STICKY;
    }

    override fun onDestroy() {
        if (tts != null) {
            tts?.stop()
            tts?.shutdown()
        }
        try {
            unregisterReceiver(stopReceiver)
        } catch (e: IllegalArgumentException) {
            // Receiver was not registered
        }
        super.onDestroy()
    }

    fun stopSpeaking() {
        if (tts != null) {
            tts?.stop()
        }
        stopSelf()
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    companion object {
        private const val CHANNEL_ID = "tts_channel"
        private const val MAX_REPEATS = 5
    }
}
