// AlarmDao.kt
package com.talehto.voicealarmapp.db

import androidx.room.*

@Dao
interface AlarmDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(alarm: AlarmEntity): Long

    @Update
    suspend fun update(alarm: AlarmEntity)

    @Delete
    suspend fun delete(alarm: AlarmEntity)

    @Query("SELECT * FROM alarms WHERE isEnabled = 1 ORDER BY time ASC")
    suspend fun getAllEnabledAlarms(): List<AlarmEntity>

    @Query("SELECT * FROM alarms WHERE id = :id LIMIT 1")
    suspend fun getAlarmById(id: Int): AlarmEntity?

    @Query("DELETE FROM alarms")
    suspend fun clearAll()
}
