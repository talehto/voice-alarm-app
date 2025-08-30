package com.talehto.voicealarmapp.alarm

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import com.talehto.voicealarmapp.R

class AlarmStopActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Show on top of lock screen
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

        val title = intent.getStringExtra(EXTRA_TITLE) ?: "Alarm"
        val text  = intent.getStringExtra(EXTRA_TEXT) ?: "Alarm is ringing"

        findViewById<TextView>(R.id.alarmTitle).text = title
        findViewById<TextView>(R.id.alarmText).text  = text

        findViewById<Button>(R.id.stopButton).setOnClickListener {
            val stop = Intent(this, AlarmService::class.java).apply {
                action = AlarmService.ACTION_STOP
            }
            startService(stop)
            finish()
        }
    }

    companion object {
        const val EXTRA_TITLE = "title"
        const val EXTRA_TEXT = "text"
    }
}
