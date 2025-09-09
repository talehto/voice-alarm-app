package com.talehto.voicealarmapp.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.time.*
import com.talehto.voicealarmapp.db.AlarmEntity

object AlarmScheduler {
    private const val REQ_CODE_BASE = 10000
    private const val SAFETY_MS = 2_000L // 2s buffer

    fun schedule(context: Context, alarm: AlarmEntity) {
        cancel(context, alarm.id)
        if (!alarm.enabled) return

        val now = System.currentTimeMillis()
        val triggerAt = when (alarm.type) {
            "single" -> alarm.singleDateTimeMillis ?: return
            "weekly" -> nextWeeklyTrigger(
                alarm.weeklyDaysMask ?: return,
                alarm.weeklyHour ?: return,
                alarm.weeklyMinute ?: return
            )
            else -> return
        }

        // Hard stop: never schedule “now/past”
        if (triggerAt <= now + SAFETY_MS) return

        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = pendingIntent(context, alarm.id)
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
    }

    fun cancel(context: Context, alarmId: Int) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(pendingIntent(context, alarmId))
    }

    /** For weekly: compute the next occurrence from now (local time). */
    private fun nextWeeklyTrigger(daysMask: Int, hour: Int, minute: Int): Long {
        val tz = java.time.ZoneId.systemDefault()
        var candidate = java.time.ZonedDateTime.now(tz)
            .withSecond(0).withNano(0).withHour(hour).withMinute(minute)
    
        repeat(8) {
            val idx = candidate.dayOfWeek.value % 7 // Mon=1..Sun=7 → 1..6,0
            val selected = ((daysMask shr idx) and 1) == 1
            val ms = candidate.toInstant().toEpochMilli()
            if (selected && ms > System.currentTimeMillis() + SAFETY_MS) return ms
            candidate = candidate.plusDays(1)
        }
        return candidate.toInstant().toEpochMilli()
    }

    private fun pendingIntent(context: Context, alarmId: Int): PendingIntent {
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            action = AlarmReceiver.ACTION_FIRE
            putExtra(AlarmReceiver.EXTRA_ALARM_ID, alarmId)
        }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return PendingIntent.getBroadcast(context, REQ_CODE_BASE + alarmId, intent, flags)
    }
}
