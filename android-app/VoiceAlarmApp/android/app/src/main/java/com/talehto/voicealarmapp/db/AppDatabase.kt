// android/.../db/AppDatabase.kt
package com.talehto.voicealarmapp.db

import android.content.Context
//import androidx.room.*
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(entities = [AlarmEntity::class], version = 2, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun alarmDao(): AlarmDao

    companion object {
        @Volatile private var INSTANCE: AppDatabase? = null

        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS alarms_new (
                      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                      type TEXT NOT NULL,
                      title TEXT NOT NULL,
                      text TEXT NOT NULL,
                      enabled INTEGER NOT NULL,
                      singleDateTimeMillis INTEGER,
                      weeklyDaysMask INTEGER,
                      weeklyHour INTEGER,
                      weeklyMinute INTEGER
                    )
                """.trimIndent())

                // Map old rows → single alarms
                db.execSQL("""
                    INSERT INTO alarms_new (id, type, title, text, enabled, singleDateTimeMillis, weeklyDaysMask, weeklyHour, weeklyMinute)
                    SELECT id, 'single', 
                           COALESCE(label, ''), 
                           COALESCE(label, ''), 
                           CASE WHEN enabled IS NULL THEN 1 ELSE enabled END,
                           timeMillis,
                           NULL, NULL, NULL
                    FROM alarms
                """.trimIndent())

                db.execSQL("DROP TABLE alarms")
                db.execSQL("ALTER TABLE alarms_new RENAME TO alarms")
            }
        }

        fun getDatabase(context: Context): AppDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "voice_alarm_db"
                )
                .addMigrations(MIGRATION_1_2)
                .build()
                .also { INSTANCE = it }
            }
    }
}
