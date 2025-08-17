// AlarmRepository.kt
package com.talehto.voicealarmapp.db

class AlarmRepository(private val dao: AlarmDao) {
    suspend fun insert(alarm: AlarmEntity) = dao.insert(alarm)
    suspend fun update(alarm: AlarmEntity) = dao.update(alarm)
    suspend fun delete(alarm: AlarmEntity) = dao.delete(alarm)
    suspend fun getAllEnabled() = dao.getAllEnabledAlarms()
    suspend fun getById(id: Int) = dao.getAlarmById(id)
}
