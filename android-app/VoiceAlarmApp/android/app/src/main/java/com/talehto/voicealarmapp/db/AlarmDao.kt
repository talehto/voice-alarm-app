// android/.../db/AlarmDao.kt
package com.talehto.voicealarmapp.db

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface AlarmDao {
    @Query("""SELECT * FROM alarms 
        ORDER BY CASE WHEN type='single' THEN singleDateTimeMillis ELSE NULL END ASC,
        weeklyHour ASC, weeklyMinute ASC""")
    fun observeAll(): Flow<List<AlarmEntity>>

    @Query("""SELECT * FROM alarms ORDER BY 
        CASE WHEN type='single' THEN singleDateTimeMillis ELSE NULL END ASC,weeklyHour ASC,
        weeklyMinute ASC""")
    suspend fun getAllOnce(): List<AlarmEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(a: AlarmEntity): Long

    @Update
    suspend fun update(a: AlarmEntity)

    @Query("DELETE FROM alarms WHERE id = :id")
    suspend fun deleteById(id: Int)

    @Query("SELECT * FROM alarms WHERE id = :id LIMIT 1")
    suspend fun getById(id: Int): AlarmEntity?

    @Query("UPDATE alarms SET enabled = :enabled WHERE id = :id")
    suspend fun setEnabled(id: Int, enabled: Boolean): Int
}
