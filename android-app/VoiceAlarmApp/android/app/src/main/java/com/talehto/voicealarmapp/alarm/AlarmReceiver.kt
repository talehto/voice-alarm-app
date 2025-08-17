package com.talehto.voicealarmapp.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Log.d("AlarmReceiver", "Alarm received, starting TTS service")
        
        // Get message with null safety
        val message = intent.getStringExtra("alarm_message")
        val finalMessage = when {
            message.isNullOrEmpty() -> "Hyvää huomenta! Tämä on herätyksesi."
            else -> message
        }

        // Starting a tts service.
        val serviceIntent = Intent(context, TTSService::class.java)
        serviceIntent.putExtra("alarm_message", finalMessage)
        
        // Use startForegroundService for API 26+ and startService for older versions
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }

        // Starting a stop dialog.
        val dialogIntent = Intent(context, AlarmDialogActivity::class.java)
        dialogIntent.putExtra("alarm_message", finalMessage)
        dialogIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        context.startActivity(dialogIntent)
    }
}
