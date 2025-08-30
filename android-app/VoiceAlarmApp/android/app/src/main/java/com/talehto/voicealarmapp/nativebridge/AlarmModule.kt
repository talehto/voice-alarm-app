package com.talehto.voicealarmapp.nativebridge

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.talehto.voicealarmapp.alarm.AlarmReceiver
import com.talehto.voicealarmapp.alarm.AlarmScheduler
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.bridge.Promise
import com.talehto.voicealarmapp.db.AppDatabase
import com.talehto.voicealarmapp.db.AlarmEntity
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.map
import java.time.Instant
import java.time.format.DateTimeParseException

class AlarmModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val db by lazy { AppDatabase.getDatabase(reactContext) }
    private val dao by lazy { db.alarmDao() }

    override fun getName(): String = "AlarmModule"

    companion object {
        private const val TAG = "AlarmModule"
        private const val EVENT_ALARMS_CHANGED = "alarmsChanged"
    }

    override fun initialize() {
        super.initialize()
        // Start streaming Room changes to JS as soon as the module is ready.
        scope.launch {
          dao.observeAll()
            .map { list -> list.toWritableArray() }
            .collectLatest { arr -> sendEvent(EVENT_ALARMS_CHANGED, arr) }
        }
    }

    override fun onCatalystInstanceDestroy() {
        scope.cancel() // avoid leaks
    }

    /**
     * getAll(): Promise<Alarm[]>
     * Alarm: { id: number, label: string, time: string(ISO), enabled?: boolean }
     */
    @ReactMethod
    fun getAll(promise: Promise) {
        scope.launch {
            try {
                val rows = dao.getAllOnce().toWritableArray()
                promise.resolve(rows)
            } catch (e: Exception) {
                promise.reject("ERR_GET_ALL", e.message, e)
            }
        }
    }

    /**
     * add(alarm): Promise<number>
     * Input alarm may omit id -> Room autogenerates. Returns numeric id (row id cast to Int).
     */
    @ReactMethod
    fun add(map: ReadableMap, promise: Promise) {
        scope.launch {
            try {
                val entity = map.toEntity()
                val rowId = dao.insert(entity)
                AlarmScheduler.schedule(reactApplicationContext, entity.copy(id = rowId.toInt()))
                // If your DAO uses autoGenerate PK, you may want to fetch back to get the actual id.
                // For simplicity we return rowId as Int (often equals PK for single-table, but not guaranteed).
                promise.resolve(rowId.toInt())
            } catch (e: Exception) {
                promise.reject("ERR_ADD", e.message, e)
            }
        }
    }

    /**
     * update(alarm): Promise<void>
     * Requires a valid id.
     */
    @ReactMethod
    fun update(map: ReadableMap, promise: Promise) {
        scope.launch {
            try {
                val entity = map.toEntity(requireId = true)
                dao.update(entity)
                if (entity.enabled) AlarmScheduler.schedule(reactApplicationContext, entity)else AlarmScheduler.cancel(reactApplicationContext, entity.id)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("ERR_UPDATE", e.message, e)
            }
        }
    }

    /**
     * remove(id: number): Promise<void>
     */
    @ReactMethod
    fun remove(id: Int, promise: Promise) {
        scope.launch {
            try {
                dao.deleteById(id)
                AlarmScheduler.cancel(reactApplicationContext, id)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("ERR_DELETE", e.message, e)
            }
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
    // Required for RN event emitter. No-op, but must exist.
    }

    @ReactMethod
    fun removeListeners(count: Double) {
    // Required for RN event emitter. No-op, but must exist.
    }

    //@ReactMethod
    //fun setAlarm(timestamp: Double, message: String?) {
    //    val context: Context = getReactApplicationContext()
    //    val alarmManager: AlarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    //    val intent = Intent(context, AlarmReceiver::class.java)
    //    intent.putExtra("alarm_message", message)
    //    val requestCode = System.currentTimeMillis().toInt()
    //    val pendingIntent: PendingIntent = PendingIntent.getBroadcast(
    //            context,
    //            requestCode,
    //            intent,
    //            PendingIntent.FLAG_IMMUTABLE
    //    )
    //    val triggerTime = timestamp.toLong()
    //    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
    //        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
    //        Log.d(TAG, "Alarm set with setExactAndAllowWhileIdle for: $triggerTime")
    //    } else {
    //        alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
    //        Log.d(TAG, "Alarm set with setExact for: $triggerTime")
    //    }
    //}

    // ---------- Helpers: send event to JS ----------
    private fun sendEvent(name: String, params: WritableArray) {
        try {
            reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(name, params)
        } catch (_: Exception) {
        // If JS isn't ready yet, ignore; the initial getAll() will populate anyway.
        }
    }

    // ---------- Mapping helpers (Room <-> JS) ----------

    private fun List<AlarmEntity>.toWritableArray(): WritableArray {
        val arr = Arguments.createArray()
        forEach { arr.pushMap(it.toWritableMap()) }
        return arr
    }

    private fun AlarmEntity.toWritableMap(): WritableMap = Arguments.createMap().apply {
        putInt("id", id)
        putString("type", type)
        putString("title", title)
        putString("text", text)
        putBoolean("enabled", enabled)
    
        if (type == "single") {
            val iso = singleDateTimeMillis?.let { millisToIso(it) }
            val single = Arguments.createMap().apply { putString("dateTime", iso) }
            putMap("single", single)
        } else if (type == "weekly") {
            val weekly = Arguments.createMap().apply {
                putInt("daysMask", weeklyDaysMask ?: 0)
                val tod = Arguments.createMap().apply {
                    putInt("hour", weeklyHour ?: 0)
                    putInt("minute", weeklyMinute ?: 0)
                }
                putMap("timeOfDay", tod)
            }
            putMap("weekly", weekly)
        }
    }

    private fun ReadableMap.toEntity(requireId: Boolean = false): AlarmEntity {
        val id = if (hasKey("id") && !isNull("id")) getInt("id")
                 else if (requireId) error("Missing id") else 0
    
        val type = getStringOrEmpty("type") // "single" | "weekly"
        val title = getStringOrEmpty("title")
        val text = getStringOrEmpty("text")
        val enabled = if (hasKey("enabled") && !isNull("enabled")) getBoolean("enabled") else true
    
        var singleMillis: Long? = null
        var mask: Int? = null
        var hour: Int? = null
        var minute: Int? = null
    
        if (type == "single" && hasKey("single") && !isNull("single")) {
            val s = getMap("single")
            val iso = s?.getString("dateTime")
            singleMillis = iso?.let { isoToMillis(it) }
        } else if (type == "weekly" && hasKey("weekly") && !isNull("weekly")) {
            val w = getMap("weekly")
            mask = w?.getInt("daysMask")
            val tod = w?.getMap("timeOfDay")
            hour = tod?.getInt("hour")
            minute = tod?.getInt("minute")
        }

        return AlarmEntity(
            id = id,
            type = type,
            title = title,
            text  = text,
            enabled = enabled,
            singleDateTimeMillis = singleMillis,
            weeklyDaysMask = mask,
            weeklyHour = hour,
            weeklyMinute = minute
        )
    }

    private fun ReadableMap.getStringOrEmpty(key: String): String =
    if (hasKey(key) && !isNull(key)) getString(key) ?: "" else ""

    private fun isoToMillis(iso: String): Long {
        return try {
          // Requires Java 8+ desugaring for older APIs; enable in Gradle if minSdk < 26.
          Instant.parse(iso).toEpochMilli()
        } catch (e: DateTimeParseException) {
          // Fallback: if it's already millis as string, try parsing it
          iso.toLongOrNull() ?: System.currentTimeMillis()
        }
    }

    private fun millisToIso(ms: Long): String {
        return try {
          Instant.ofEpochMilli(ms).toString()
        } catch (_: Exception) {
          // Should not happen; provide best-effort
          Instant.now().toString()
        }
    }
}
