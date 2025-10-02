package com.talehto.voicealarmapp.alarm

import android.os.Build
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        android.util.Log.d("AlarmReceiver", "Received intent: ${intent.action}")
        if (intent.action == ACTION_FIRE) {
          val id = intent.getIntExtra(EXTRA_ALARM_ID, -1)
          android.util.Log.d("AlarmReceiver", "Alarm fired with ID: $id")
          if (id != -1) {
            val svc = Intent(context, AlarmService::class.java).apply {
              action = AlarmService.ACTION_START
              putExtra(EXTRA_ALARM_ID, id)
            }
            android.util.Log.d("AlarmReceiver", "Starting AlarmService")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
              context.startForegroundService(svc)   // API 26+
            } else {
              context.startService(svc)             // API 24–25
            }
          }
        }
      }

    companion object {
        const val ACTION_FIRE = "com.talehto.voicealarmapp.alarm.ACTION_FIRE"
        const val EXTRA_ALARM_ID = "alarm_id"
    }
}
