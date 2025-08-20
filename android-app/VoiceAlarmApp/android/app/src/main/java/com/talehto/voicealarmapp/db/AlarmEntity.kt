// AlarmEntity.kt
package com.talehto.voicealarmapp.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "alarms")
data class AlarmEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val timeMillis: Long,
    val label: String,
    val enabled: Boolean
)
