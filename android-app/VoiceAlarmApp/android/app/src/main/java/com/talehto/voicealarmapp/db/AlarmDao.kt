// AlarmDao.kt
package com.talehto.voicealarmapp.db

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface AlarmDao {

    // --- INSERT ---
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAlarm(alarm: AlarmEntity): Long

    // --- UPDATE ---
    @Update
    suspend fun updateAlarm(alarm: AlarmEntity): Int

    // --- DELETE SINGLE ---
    @Delete
    suspend fun deleteAlarm(alarm: AlarmEntity): Int

    // --- DELETE ALL ---
    @Query("DELETE FROM alarms")
    suspend fun clearAll(): Int

    // --- GET BY ID ---
    @Query("SELECT * FROM alarms WHERE id = :id")
    suspend fun getAlarmById(id: Int): AlarmEntity?

    // --- GET ALL ENABLED (Flow for observation) ---
    @Query("SELECT * FROM alarms WHERE enabled = 1 ORDER BY timeMillis ASC")
    fun getAllEnabledAlarms(): Flow<List<AlarmEntity>>

    // --- GET ALL (Flow for observation) ---
    @Query("SELECT * FROM alarms ORDER BY timeMillis ASC")
    fun getAllAlarms(): Flow<List<AlarmEntity>>
}
