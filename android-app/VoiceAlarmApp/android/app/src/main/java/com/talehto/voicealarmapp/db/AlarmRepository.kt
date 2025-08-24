// AlarmRepository.kt
package com.talehto.voicealarmapp.db

import com.talehto.voicealarmapp.db.AlarmDao
import com.talehto.voicealarmapp.db.AlarmEntity

class AlarmRepository(private val dao: AlarmDao) {
    suspend fun insert(alarm: AlarmEntity) = dao.insert(alarm)
    suspend fun update(alarm: AlarmEntity) = dao.update(alarm)
    suspend fun delete(id: Int) = dao.deleteById(id)
    suspend fun getAllEnabled() = dao.getAllOnce()
    //suspend fun getById(id: Int) = dao.getAlarmById(id)
}
