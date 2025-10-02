// android/app/src/main/java/com/talehto/voicealarmapp/db/AlarmDao.kt
package com.talehto.voicealarmapp.db

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface AlarmDao {
    @Query("SELECT * FROM alarms WHERE id = :id LIMIT 1")
    suspend fun getById(id: Int): AlarmEntity?

    @Query("SELECT * FROM alarms WHERE remoteId = :remoteId LIMIT 1")
    suspend fun getByRemoteId(remoteId: String): AlarmEntity?

    @Query("SELECT * FROM alarms WHERE targetUid = :uid ORDER BY updatedAtMillis DESC")
    fun observeForUser(uid: String): Flow<List<AlarmEntity>>

    @Query("SELECT * FROM alarms ORDER BY updatedAtMillis DESC")
    suspend fun getAllOnce(): List<AlarmEntity>

    @Query("SELECT id FROM alarms WHERE remoteId = :remoteId LIMIT 1")
    suspend fun findLocalIdByRemote(remoteId: String): Int?

    @Query("DELETE FROM alarms WHERE targetUid = :uid")
    suspend fun clearForUser(uid: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: AlarmEntity): Long

    @Update
    suspend fun update(entity: AlarmEntity)

    @Delete
    suspend fun delete(entity: AlarmEntity)

    @Query("DELETE FROM alarms WHERE id = :id")
    suspend fun deleteById(id: Int)

    @Query("UPDATE alarms SET enabled = :enabled WHERE id = :id")
    suspend fun setEnabled(id: Int, enabled: Boolean): Int

    // Manual "upsert by remoteId" preserving stable local id (and PendingIntents)
    @Transaction
    suspend fun upsertByRemote(e: AlarmEntity) {
        val r = e.remoteId
        if (r.isNullOrBlank()) {
            insert(e)
            return
        }
        val existingId = findLocalIdByRemote(r)
        if (existingId == null) {
            insert(e)
        } else {
            update(e.copy(id = existingId))
        }
    }

    @Transaction
    suspend fun upsertAllByRemote(list: List<AlarmEntity>) {
        for (e in list) upsertByRemote(e)
    }
}
