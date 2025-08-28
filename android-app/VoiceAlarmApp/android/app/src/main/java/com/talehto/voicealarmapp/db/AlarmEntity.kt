// android/.../db/AlarmEntity.kt
package com.talehto.voicealarmapp.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "alarms")
data class AlarmEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,

    // "single" or "weekly"
    val type: String,             // enforce values at app layer

    // split label
    val title: String,
    val text: String,

    val enabled: Boolean = true,

    // single
    val singleDateTimeMillis: Long?,  // nullable if weekly

    // weekly
    val weeklyDaysMask: Int?,         // nullable if single
    val weeklyHour: Int?,             // 0..23
    val weeklyMinute: Int?            // 0..59
)
