// AlarmEntity.kt
package com.talehto.voicealarmapp.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "alarms")
data class AlarmEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val time: Long,             // trigger time in millis
    val message: String,        // TTS message
    val isEnabled: Boolean = true,
    val isRemote: Boolean = false,
    val senderId: String? = null // for remote alarms (optional)
)
