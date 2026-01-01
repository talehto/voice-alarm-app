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
import com.talehto.voicealarmapp.db.AlarmDao
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.map
import java.time.Instant
import java.time.format.DateTimeParseException

class AlarmModule(private val reactCtx: ReactApplicationContext) : ReactContextBaseJavaModule(reactCtx) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val dao: AlarmDao by lazy(LazyThreadSafetyMode.SYNCHRONIZED) {
        AppDatabase.getDatabase(reactCtx).alarmDao()
    }

    override fun getName(): String = "AlarmModule"

    companion object {
        private const val TAG = "AlarmModule"
        private const val EVENT_ALARMS_CHANGED = "alarmsChanged"
    }

    override fun initialize() {
        Log.d(TAG, "Start initialize")
        super.initialize()
        // Ping-only event: JS will refresh from native on receipt.
        emitChanged()
    }

    override fun onCatalystInstanceDestroy() {
        scope.cancel() // avoid leaks
    }

    // ---- NEW: replace local cache for a user (first snapshot) ----
    @ReactMethod
    fun replaceAllForUser(uid: String, arr: ReadableArray, promise: Promise)  {
        scope.launch {
            try {
                val list = (0 until arr.size()).map { idx -> arr.getMap(idx)!!.toEntityFromRemote() }
                dao.clearForUser(uid)
                dao.upsertAllByRemote(list)
                // Re-schedule everything enabled using the actual local row IDs
                list.filter { it.enabled }.forEach { e ->
                    val localId = e.remoteId?.let { rid -> dao.findLocalIdByRemote(rid) }
                    if (localId != null) {
                        AlarmScheduler.schedule(reactCtx, e.copy(id = localId))
                    }
                }
                emitChanged()
                promise.resolve(null)
            } catch (e: Exception) { promise.reject("ERR_REPLACE", e) }
        }
    }

    // ---- NEW: incremental upsert (subsequent snapshots) ----
    // Function call from JS in converted by NativeModules to ReadableArray.
    // Functionality of this method:
    // In the first line, .toEntityFromRemote() converts that map into an AlarmEntity.
    // In the "add alarm" case, size of the list is 1.
    // In the "multiple alarms" case (e.g. initial sync), size can be >1.
    // Then, dao.upsertAllByRemote(list) inserts or updates the rows based on remoteId.
    // Finally, we schedule or cancel alarms based on the enabled flag.
    @ReactMethod
    fun upsertFromRemote(arr: ReadableArray, promise: Promise)  {
        scope.launch {
            try {
                val list = (0 until arr.size()).map { idx -> arr.getMap(idx)!!.toEntityFromRemote() }
                dao.upsertAllByRemote(list)
                // Update scheduling according to enabled flag
                list.forEach { e ->
                    val localId = e.remoteId?.let { rid -> dao.findLocalIdByRemote(rid) }
                    if (e.enabled) {
                        if (localId != null) AlarmScheduler.schedule(reactCtx, e.copy(id = localId))
                    } else {
                        // If we can resolve a local id, cancel by that id
                        if (localId != null) AlarmScheduler.cancel(reactCtx, localId)
                    }
                }
                emitChanged()
                promise.resolve(null)
            } catch (e: Exception) { promise.reject("ERR_UPSERT", e) }
        }
    }

    /**
     * getAll(): Promise<Alarm[]>
     * Alarm: { id: number, label: string, time: string(ISO), enabled?: boolean }
     */
    @ReactMethod
    //fun getAll(promise: Promise) = scope.launch(Dispatchers.IO) {
    fun getAll(promise: Promise) {
        scope.launch {
            try {
                Log.d(TAG, "Starting database query for all alarms")
                val rows = dao.getAllOnce()
                Log.d(TAG, "database query for all alarms executed")
                promise.resolve(rows.toWritableArray())
            } catch (t: Throwable) {
                promise.reject("ERR_GET_ALL", t)
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

    @ReactMethod
    fun setEnabled(id: Int, enabled: Boolean, promise: Promise) { 
        scope.launch {
            try {
                val row = dao.getById(id) ?: run {
                    promise.reject("ERR_NOT_FOUND", "Alarm $id not found"); return@launch
                }

                // Update enabled flag
                dao.setEnabled(id, enabled)

                // Fetch updated row
                val updated = dao.getById(id) ?: row.copy(enabled = enabled)

                if (enabled) {
                    // If single alarm time is in the past, nudge to tomorrow
                    val normalized = if (updated.type == "single" && updated.singleDateTimeMillis != null) {
                        val now = System.currentTimeMillis()
                        if (updated.singleDateTimeMillis <= now + 2_000L)
                            updated.copy(singleDateTimeMillis = updated.singleDateTimeMillis + 24L * 60 * 60 * 1000)
                        else updated
                    } else updated

                    // Re-save if we changed the time
                    if (normalized != updated) dao.update(normalized)

                    AlarmScheduler.schedule(reactApplicationContext, normalized)
                } else {
                    AlarmScheduler.cancel(reactApplicationContext, id)
                }

                // success
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("ERR_SET_ENABLED", e)
            }
        }
    }

    // ---------- Helpers: send event to JS ----------
    private fun sendEvent(name: String, params: WritableArray) {
        try {
            reactCtx
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(name, params)
        } catch (err : Exception) {
        // If JS isn't ready yet, ignore; the initial getAll() will populate anyway.
        Log.d(TAG, "sendEvent ERROR: ${err}")
        }
    }

    // ---------- Mapping helpers (Room <-> JS) ----------

    private fun List<AlarmEntity>.toWritableArray(): WritableArray {
        val arr = Arguments.createArray()
        forEach { e ->
            val m: WritableMap = Arguments.createMap()
            m.putInt("id", e.id)
            if (e.remoteId != null) m.putString("remoteId", e.remoteId)
            m.putString("ownerUid", e.ownerUid)
            m.putString("targetUid", e.targetUid)
            m.putString("type", e.type)
            m.putString("title", e.title)
            m.putString("text", e.text)
            m.putBoolean("enabled", e.enabled)
            m.putString("ttsLang", e.ttsLang)
            e.singleDateTimeMillis?.let { m.putDouble("singleDateTimeMillis", it.toDouble()) }
            e.weeklyDaysMask?.let { m.putInt("weeklyDaysMask", it) }
            e.weeklyHour?.let { m.putInt("weeklyHour", it) }
            e.weeklyMinute?.let { m.putInt("weeklyMinute", it) }
            m.putDouble("updatedAtMillis", e.updatedAtMillis.toDouble())
            arr.pushMap(m)
        }
        return arr
    }

    private fun AlarmEntity.toWritableMap(): WritableMap = Arguments.createMap().apply {
        putInt("id", id)
        putString("type", type)
        putString("title", title)
        putString("text", text)
        putBoolean("enabled", enabled)
        putString("ttsLang", ttsLang)
    
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
        val ttsLang = getStringOrEmpty("ttsLang").ifBlank { "fi-FI" }
    
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
            ttsLang = ttsLang,
            singleDateTimeMillis = singleMillis,
            weeklyDaysMask = mask,
            weeklyHour = hour,
            weeklyMinute = minute
        )
    }

    // Map Firestore-shaped object to AlarmEntity
    // This "ReadableMap.toEntityFromRemote" function declaration is extension function syntax in Kotlin.
    // It means:
    // Define a function as if it belongs to ReadableMap, without changing the class itself.
    // Inside the function, "this" refers to the ReadableMap instance.
    private fun ReadableMap.toEntityFromRemote(): AlarmEntity {
        fun optString(key: String, def: String? = null) =
            if (hasKey(key) && !isNull(key)) getString(key) else def
        fun optBool(key: String, def: Boolean = false) =
            if (hasKey(key) && !isNull(key)) getBoolean(key) else def
        fun optLong(key: String): Long? =
            if (hasKey(key) && !isNull(key)) {
                val t = getType(key)
                when (t) {
                    ReadableType.Number -> getDouble(key).toLong()
                    else -> null
                }
            } else null
        fun optInt(key: String): Int? =
            if (hasKey(key) && !isNull(key)) getDouble(key).toInt() else null

        return AlarmEntity(
            id = 0, // will be preserved in DAO if remoteId exists
            remoteId = optString("remoteId") ?: optString("id"),
            ownerUid = optString("ownerUid") ?: "",
            targetUid = optString("targetUid") ?: "",
            type = optString("type") ?: "single",
            title = optString("title") ?: "",
            text = optString("text") ?: "",
            enabled = optBool("enabled", true),
            ttsLang = optString("ttsLang") ?: "fi-FI",
            singleDateTimeMillis = optLong("singleDateTimeMillis"),
            weeklyDaysMask = optInt("weeklyDaysMask"),
            weeklyHour = optInt("weeklyHour"),
            weeklyMinute = optInt("weeklyMinute"),
            updatedAtMillis = optLong("updatedAtMillis") ?: 0L
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

    private fun emitChanged() {
        val params = Arguments.createArray() // lightweight “changed” event
        reactCtx
            .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("alarmsChanged", params)
    }
}
