package com.talehto.voicealarmapp.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.time.*
import com.talehto.voicealarmapp.db.AlarmEntity

object AlarmScheduler {
    private const val REQ_CODE_BASE = 10000

    fun schedule(context: Context, alarm: AlarmEntity) {
        cancel(context, alarm.id)
        if (!alarm.enabled) return

        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val triggerAt = when (alarm.type) {
            "single" -> alarm.singleDateTimeMillis ?: return
            "weekly" -> nextWeeklyTrigger(
                alarm.weeklyDaysMask ?: return,
                alarm.weeklyHour ?: return,
                alarm.weeklyMinute ?: return
            )
            else -> return
        }

        val pi = pendingIntent(context, alarm.id)
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
    }

    fun cancel(context: Context, alarmId: Int) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(pendingIntent(context, alarmId))
    }

    /** For weekly: compute the next occurrence from now (local time). */
    private fun nextWeeklyTrigger(daysMask: Int, hour: Int, minute: Int): Long {
        val tz = ZoneId.systemDefault()
        var d = ZonedDateTime.now(tz).withSecond(0).withNano(0)
        for (i in 0..7) {
            val candidate = d.withHour(hour).withMinute(minute).plusDays(i.toLong())
            val dowIdx = ((candidate.dayOfWeek.value) % 7) // Mon=1..Sun=7 -> 1..6,0
            if (((daysMask shr dowIdx) and 1) == 1 && candidate.toInstant().toEpochMilli() > Instant.now().toEpochMilli()) {
                return candidate.toInstant().toEpochMilli()
            }
        }
        return d.plusDays(1).toInstant().toEpochMilli()
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
