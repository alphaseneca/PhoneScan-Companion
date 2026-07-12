package com.barcodeusbreader

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Tiny SharedPreferences bridge for Companion settings.
 * Keeps host-app preferences off the PhoneScan hardware library.
 */
class PreferencesModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val NAME = "CompanionPreferences"
    private const val PREFS = "phonescan_companion_prefs"
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun getString(key: String, promise: Promise) {
    try {
      val prefs = reactContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      promise.resolve(prefs.getString(key, null))
    } catch (error: Exception) {
      promise.reject("PREFS_GET_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun setString(key: String, value: String, promise: Promise) {
    try {
      val prefs = reactContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      prefs.edit().putString(key, value).apply()
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("PREFS_SET_FAILED", error.message, error)
    }
  }
}
