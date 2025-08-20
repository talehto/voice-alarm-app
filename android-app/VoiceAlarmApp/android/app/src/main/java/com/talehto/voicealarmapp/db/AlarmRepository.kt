// AlarmRepository.kt
package com.talehto.voicealarmapp.db

import com.talehto.voicealarmapp.db.AlarmDao
import com.talehto.voicealarmapp.db.AlarmEntity

class AlarmRepository(private val dao: AlarmDao) {
    suspend fun insert(alarm: AlarmEntity) = dao.insertAlarm(alarm)
    suspend fun update(alarm: AlarmEntity) = dao.updateAlarm(alarm)
    suspend fun delete(alarm: AlarmEntity) = dao.deleteAlarm(alarm)
    suspend fun getAllEnabled() = dao.getAllEnabledAlarms()
    suspend fun getById(id: Int) = dao.getAlarmById(id)
}
