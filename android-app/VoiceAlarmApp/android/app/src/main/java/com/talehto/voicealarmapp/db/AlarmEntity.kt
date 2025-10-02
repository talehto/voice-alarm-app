// android/app/src/main/java/com/talehto/voicealarmapp/db/AlarmEntity.kt
package com.talehto.voicealarmapp.db

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ColumnInfo
import androidx.room.Index

@Entity(
    tableName = "alarms",
    indices = [
        Index(value = ["remoteId"], unique = true),
        Index(value = ["targetUid"])
    ]
)
data class AlarmEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,

    // Firestore doc id (stable across devices). Nullable for legacy/local-only rows.
    @ColumnInfo(name = "remoteId")
    val remoteId: String? = null,

    // Ownership/targeting (for multi-user)
    @ColumnInfo(name = "ownerUid")
    val ownerUid: String = "",   // who created it
    @ColumnInfo(name = "targetUid")
    val targetUid: String = "",  // who should receive it (self or someone else)

    val type: String,            // "single" | "weekly"
    val title: String,
    val text: String,
    @ColumnInfo(name = "enabled")
    val enabled: Boolean = true,
    val ttsLang: String = "fi-FI",

    // single
    val singleDateTimeMillis: Long? = null,

    // weekly
    val weeklyDaysMask: Int? = null,
    val weeklyHour: Int? = null,
    val weeklyMinute: Int? = null,

    // For conflict resolution vs Firestore
    val updatedAtMillis: Long = 0
)
