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
import com.talehto.voicealarmapp.R

class AlarmStopActivity : Activity() {
  private val handler = Handler(Looper.getMainLooper())
  private var finished = false

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
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
      )
    }

    setContentView(R.layout.activity_alarm_stop)
    findViewById<TextView>(R.id.alarmTitle).text = intent.getStringExtra(EXTRA_TITLE) ?: "Alarm"
    findViewById<TextView>(R.id.alarmText).text  = intent.getStringExtra(EXTRA_TEXT) ?: "Alarm is ringing"

    findViewById<Button>(R.id.stopButton).setOnClickListener {
      if (finished) return@setOnClickListener
      finished = true
      startService(Intent(this, AlarmService::class.java).apply { action = AlarmService.ACTION_STOP })
      finish()
    }

    // Keep visible for full 5s unless user stops sooner
    handler.postDelayed({
      if (!finished) { finished = true; finish() }
    }, 5_000)
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    super.onDestroy()
  }

  companion object {
    const val EXTRA_TITLE = "title"
    const val EXTRA_TEXT  = "text"
  }
}
