package com.talehto.voicealarmapp.nativebridge

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AlarmModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    override fun getName(): String = "AlarmModule"

    @ReactMethod
    fun setAlarm(timestamp: Double, message: String?) {
        val context: Context = getReactApplicationContext()
        val alarmManager: AlarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, AlarmReceiver::class.java)
        intent.putExtra("alarm_message", message)
        val requestCode = System.currentTimeMillis().toInt()
        val pendingIntent: PendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_IMMUTABLE
        )
        val triggerTime = timestamp.toLong()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
            Log.d(TAG, "Alarm set with setExactAndAllowWhileIdle for: $triggerTime")
        } else {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
            Log.d(TAG, "Alarm set with setExact for: $triggerTime")
        }
    }

    companion object {
        private const val TAG = "AlarmModule"
    }
}
