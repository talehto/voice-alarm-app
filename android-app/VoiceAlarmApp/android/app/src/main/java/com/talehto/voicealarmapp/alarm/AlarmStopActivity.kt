package com.talehto.voicealarmapp.alarm

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import android.content.BroadcastReceiver
import android.content.IntentFilter
import android.content.Context
import androidx.core.content.ContextCompat
import com.talehto.voicealarmapp.R

class AlarmStopActivity : Activity() {
  private val handler = Handler(Looper.getMainLooper())
  private var finished = false
  private var stopReceiver: BroadcastReceiver? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
      )
    }

    setContentView(R.layout.activity_alarm_stop)

    findViewById<TextView>(R.id.alarmTitle).text =
      intent.getStringExtra(EXTRA_TITLE) ?: "Alarm"
    findViewById<TextView>(R.id.alarmText).text  =
      intent.getStringExtra(EXTRA_TEXT) ?: "Alarm is ringing"

    findViewById<Button>(R.id.stopButton).setOnClickListener {
      if (finished) return@setOnClickListener
      finished = true
      startService(Intent(this, AlarmService::class.java).apply { action = AlarmService.ACTION_STOP })
      finish()
    }

    // Keep UI up for 5s unless user presses Stop
    handler.postDelayed({
      if (!finished) { finished = true; finish() }
    }, 15_000)

    // Close UI if service Stop action is pressed from notification
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action == AlarmService.ACTION_UI_STOP) {
          if (!finished) { finished = true; finish() }
        }
      }
    }
    stopReceiver = receiver
    val filter = IntentFilter(AlarmService.ACTION_UI_STOP)
    ContextCompat.registerReceiver(this, receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    try { stopReceiver?.let { unregisterReceiver(it) } } catch (_: Exception) {}
    super.onDestroy()
  }
  companion object {
    const val EXTRA_TITLE = "title"
    const val EXTRA_TEXT  = "text"
  }
}
