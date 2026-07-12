package com.phonescan.reactnative

import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * CH55x firmware flash bridge: file pick, bootloader wait, and ISP programming.
 *
 * Typical flow (orchestrated from JS):
 * 1. CDC `bootloader\r\n` → device re-enumerates as VID 0x4348 / PID 0x55E0 (~5s window)
 * 2. [waitForBootloader] + permission
 * 3. [flashFirmware] with raw .bin bytes or parsed Intel HEX image
 */
class FirmwareFlashModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  companion object {
    const val NAME = "FirmwareFlashModule"
    private const val TAG = "FirmwareFlash"
    private const val ACTION_USB_PERMISSION = "com.phonescan.reactnative.FLASH_USB_PERMISSION"
    private const val EVENT_PROGRESS = "FirmwareFlash:onProgress"
    private const val PICK_FIRMWARE_REQUEST = 0xF155
    private const val PERMISSION_TIMEOUT_MS = 30_000L
    private const val POLL_INTERVAL_MS = 200L
    private const val MAX_HEX_IMAGE = Ch55xBootloaderProgrammer.MAX_FIRMWARE_BYTES
  }

  private val usbManager: UsbManager =
    reactContext.getSystemService(Context.USB_SERVICE) as UsbManager
  private val mainHandler = Handler(Looper.getMainLooper())
  private val flashExecutor = Executors.newSingleThreadExecutor { runnable ->
    Thread(runnable, "PhoneScan-Flash").apply { isDaemon = true }
  }

  private val isFlashing = AtomicBoolean(false)

  private var permissionPromise: Promise? = null
  private var permissionDeviceId: Int? = null
  private var permissionTimeoutRunnable: Runnable? = null
  private var pickPromise: Promise? = null

  private val usbPermissionReceiver =
    object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action != ACTION_USB_PERMISSION) {
          return
        }
        val device = readUsbDeviceExtra(intent)
        val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
        val expectedId = permissionDeviceId
        val promise = permissionPromise
        cancelPermissionTimeout()
        if (promise == null) {
          return
        }
        if (device != null && expectedId != null && device.deviceId == expectedId) {
          permissionPromise = null
          permissionDeviceId = null
          try {
            promise.resolve(granted)
          } catch (error: Exception) {
            Log.w(TAG, "Permission promise already settled", error)
          }
        }
      }
    }

  private val usbDetachReceiver =
    object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action != UsbManager.ACTION_USB_DEVICE_DETACHED) {
          return
        }
        val device = readUsbDeviceExtra(intent) ?: return
        if (permissionDeviceId != null && permissionDeviceId == device.deviceId) {
          Log.i(TAG, "Bootloader device detached during permission: ${device.deviceId}")
          settlePermissionDetached()
        }
      }
    }

  init {
    reactContext.addActivityEventListener(this)
    registerPermissionReceiver()
  }

  override fun getName(): String = NAME

  override fun invalidate() {
    try {
      settlePermission(false)
      settlePick(null)
      unregisterPermissionReceiver()
      reactContext.removeActivityEventListener(this)
    } catch (error: Exception) {
      Log.w(TAG, "invalidate cleanup failed", error)
    }
    try {
      flashExecutor.shutdownNow()
    } catch (_: Exception) {
      // Ignore.
    }
    super.invalidate()
  }

  @ReactMethod
  fun listBootloaderDevices(promise: Promise) {
    try {
      val result = Arguments.createArray()
      for (device in Ch55xBootloaderProgrammer.findBootloaderDevices(usbManager)) {
        result.pushMap(deviceToMap(device))
      }
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("LIST_BOOTLOADER_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun requestBootloaderPermission(deviceId: Int, promise: Promise) {
    try {
      val device = findDevice(deviceId)
      if (device == null || !Ch55xBootloaderProgrammer.isBootloaderDevice(device)) {
        promise.reject("DEVICE_NOT_FOUND", "No CH55x bootloader with id $deviceId")
        return
      }
      if (usbManager.hasPermission(device)) {
        promise.resolve(true)
        return
      }
      if (permissionPromise != null) {
        settlePermission(false)
      }
      permissionPromise = promise
      permissionDeviceId = deviceId
      val flags =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        } else {
          PendingIntent.FLAG_UPDATE_CURRENT
        }
      val intent = Intent(ACTION_USB_PERMISSION).setPackage(reactContext.packageName)
      val pendingIntent = PendingIntent.getBroadcast(reactContext, deviceId + 10_000, intent, flags)
      schedulePermissionTimeout()
      usbManager.requestPermission(device, pendingIntent)
    } catch (error: Exception) {
      cancelPermissionTimeout()
      permissionPromise = null
      permissionDeviceId = null
      promise.reject("REQUEST_PERMISSION_FAILED", error.message, error)
    }
  }

  /**
   * Poll for a CH55x bootloader until [timeoutMs] elapses (default 5s flash window).
   */
  @ReactMethod
  fun waitForBootloader(timeoutMs: Int, promise: Promise) {
    flashExecutor.execute {
      val deadline = System.currentTimeMillis() + timeoutMs.coerceAtLeast(500).toLong()
      try {
        while (System.currentTimeMillis() < deadline) {
          val devices = Ch55xBootloaderProgrammer.findBootloaderDevices(usbManager)
          if (devices.isNotEmpty()) {
            val device = devices.first()
            emitProgress("waiting", 1, 1, "Bootloader detected")
            promise.resolve(deviceToMap(device))
            return@execute
          }
          Thread.sleep(POLL_INTERVAL_MS)
        }
        promise.reject(
          "BOOTLOADER_TIMEOUT",
          "CH55x bootloader not seen within ${timeoutMs}ms. Re-plug and try again within the flash window.",
        )
      } catch (error: Exception) {
        promise.reject("WAIT_BOOTLOADER_FAILED", error.message, error)
      }
    }
  }

  @ReactMethod
  fun flashFirmware(deviceId: Int, firmwareBase64: String, promise: Promise) {
    if (!isFlashing.compareAndSet(false, true)) {
      promise.reject("FLASH_IN_PROGRESS", "Another firmware flash is already running")
      return
    }

    flashExecutor.execute {
      var programmer: Ch55xBootloaderProgrammer? = null
      try {
        val device = findDevice(deviceId)
        if (device == null || !Ch55xBootloaderProgrammer.isBootloaderDevice(device)) {
          promise.reject("DEVICE_NOT_FOUND", "No CH55x bootloader with id $deviceId")
          return@execute
        }
        if (!usbManager.hasPermission(device)) {
          promise.reject("PERMISSION_DENIED", "USB permission not granted for bootloader")
          return@execute
        }

        val firmware =
          try {
            Base64.decode(firmwareBase64, Base64.DEFAULT)
          } catch (error: Exception) {
            promise.reject("INVALID_FIRMWARE", "Firmware Base64 decode failed", error)
            return@execute
          }

        if (firmware.isEmpty()) {
          promise.reject("INVALID_FIRMWARE", "Firmware payload is empty")
          return@execute
        }

        emitProgress("open", 0, 1, "Opening bootloader")
        programmer = Ch55xBootloaderProgrammer.open(usbManager, device)
        val info = programmer.detect()
        emitProgress(
          "detect",
          1,
          1,
          "Bootloader ${info.bootloaderVersion}",
        )

        programmer.flash(firmware) { phase, current, total, message ->
          emitProgress(phase, current, total, message)
        }

        val result = Arguments.createMap()
        result.putBoolean("success", true)
        result.putInt("bytesWritten", firmware.size)
        result.putString("bootloaderVersion", info.bootloaderVersion)
        result.putInt("mcuId", info.deviceIdByte)
        result.putArray(
          "chipId",
          Arguments.createArray().also { arr ->
            info.chipId.forEach { arr.pushInt(it) }
          },
        )
        promise.resolve(result)
      } catch (error: Exception) {
        Log.e(TAG, "flashFirmware failed", error)
        emitProgress("error", 0, 1, error.message ?: "Flash failed")
        promise.reject("FLASH_FAILED", error.message ?: "Firmware flash failed", error)
      } finally {
        try {
          programmer?.close()
        } catch (_: Exception) {
          // Ignore.
        }
        isFlashing.set(false)
      }
    }
  }

  /**
   * Opens a system document picker for `.bin` / `.hex` firmware.
   * Returns `{ name, size, base64, format }` where format is `bin` or `hex-image`
   * (Intel HEX is parsed to a flash image before Base64 encoding).
   */
  @ReactMethod
  fun pickFirmwareFile(promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "No Android activity available for file picker")
      return
    }
    if (pickPromise != null) {
      settlePick(null)
    }
    pickPromise = promise
    try {
      val intent =
        Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
          addCategory(Intent.CATEGORY_OPENABLE)
          type = "*/*"
          putExtra(
            Intent.EXTRA_MIME_TYPES,
            arrayOf(
              "application/octet-stream",
              "text/plain",
              "application/x-binary",
              "*/*",
            ),
          )
        }
      activity.startActivityForResult(intent, PICK_FIRMWARE_REQUEST)
    } catch (error: Exception) {
      pickPromise = null
      promise.reject("PICK_FAILED", error.message ?: "Could not open file picker", error)
    }
  }

  /** Required by NativeEventEmitter on newer React Native. */
  @ReactMethod
  fun addListener(eventName: String) {
    // No-op
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // No-op
  }

  override fun onActivityResult(
    activity: Activity,
    requestCode: Int,
    resultCode: Int,
    data: Intent?,
  ) {
    if (requestCode != PICK_FIRMWARE_REQUEST) {
      return
    }
    val promise = pickPromise ?: return
    pickPromise = null

    if (resultCode != Activity.RESULT_OK || data?.data == null) {
      promise.resolve(null)
      return
    }

    flashExecutor.execute {
      try {
        promise.resolve(readFirmwareUri(data.data!!))
      } catch (error: Exception) {
        Log.e(TAG, "readFirmwareUri failed", error)
        promise.reject("READ_FIRMWARE_FAILED", error.message ?: "Failed to read firmware", error)
      }
    }
  }

  override fun onNewIntent(intent: Intent) {
    // No-op — USB attach is handled by the host activity / serial module.
  }

  private fun readFirmwareUri(uri: Uri): WritableMap {
    val resolver = reactContext.contentResolver
    val name = queryDisplayName(uri) ?: "firmware.bin"
    val lower = name.lowercase()
    val isHex = lower.endsWith(".hex") || lower.endsWith(".ihx")

    val bytes: ByteArray
    val format: String
    if (isHex) {
      val text =
        resolver.openInputStream(uri)?.use { stream ->
          BufferedReader(InputStreamReader(stream, Charsets.US_ASCII)).readText()
        } ?: throw IllegalStateException("Could not open firmware file")
      bytes = parseIntelHex(text, MAX_HEX_IMAGE)
      format = "hex-image"
    } else {
      bytes =
        resolver.openInputStream(uri)?.use { stream ->
          stream.readBytes()
        } ?: throw IllegalStateException("Could not open firmware file")
      format = "bin"
    }

    if (bytes.isEmpty()) {
      throw IllegalStateException("Firmware file is empty")
    }
    if (bytes.size > MAX_HEX_IMAGE) {
      throw IllegalStateException("Firmware exceeds ${MAX_HEX_IMAGE} bytes")
    }

    val map = Arguments.createMap()
    map.putString("name", name)
    map.putInt("size", bytes.size)
    map.putString("format", format)
    map.putString("base64", Base64.encodeToString(bytes, Base64.NO_WRAP))
    return map
  }

  private fun queryDisplayName(uri: Uri): String? {
    val cursor =
      reactContext.contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)
    cursor?.use {
      if (it.moveToFirst()) {
        return it.getString(0)
      }
    }
    return uri.lastPathSegment
  }

  /**
   * Minimal Intel HEX → binary image (padded gaps with 0xFF), matching ch55xbl.js.
   */
  private fun parseIntelHex(data: String, bufferSize: Int): ByteArray {
    val buf = ByteArray(bufferSize) { 0xFF.toByte() }
    var bufLength = 0
    var highAddress = 0
    var pos = 0
    var lineNum = 0
    val smallest = 11

    while (pos + smallest <= data.length) {
      if (data[pos] != ':') {
        throw IllegalArgumentException("Line ${lineNum + 1} does not start with ':'")
      }
      pos++
      lineNum++

      val dataLength = data.substring(pos, pos + 2).toInt(16)
      pos += 2
      val lowAddress = data.substring(pos, pos + 4).toInt(16)
      pos += 4
      val recordType = data.substring(pos, pos + 2).toInt(16)
      pos += 2

      val dataField = data.substring(pos, pos + dataLength * 2)
      val dataFieldBuf = ByteArray(dataLength)
      for (i in 0 until dataLength) {
        dataFieldBuf[i] = dataField.substring(i * 2, i * 2 + 2).toInt(16).toByte()
      }
      pos += dataLength * 2

      val checksum = data.substring(pos, pos + 2).toInt(16)
      pos += 2

      var calc = (dataLength + (lowAddress shr 8) + lowAddress + recordType) and 0xFF
      for (b in dataFieldBuf) {
        calc = (calc + (b.toInt() and 0xFF)) and 0xFF
      }
      calc = (0x100 - calc) and 0xFF
      if (checksum != calc) {
        throw IllegalArgumentException("Invalid checksum on line $lineNum")
      }

      when (recordType) {
        0 -> { // DATA
          val absolute = highAddress + lowAddress
          if (absolute + dataLength > buf.size) {
            throw IllegalArgumentException("HEX data exceeds ${buf.size} byte image")
          }
          for (i in dataFieldBuf.indices) {
            buf[absolute + i] = dataFieldBuf[i]
          }
          bufLength = maxOf(bufLength, absolute + dataLength)
        }
        1 -> { // EOF
          return buf.copyOf(bufLength)
        }
        2 -> { // EXT_SEGMENT_ADDR
          highAddress = dataField.toInt(16) shl 4
        }
        4 -> { // EXT_LINEAR_ADDR
          highAddress = dataField.toInt(16) shl 16
        }
        3, 5 -> {
          // Start address records — ignored for flash image.
        }
        else -> throw IllegalArgumentException("Invalid record type $recordType on line $lineNum")
      }

      if (pos < data.length && data[pos] == '\r') pos++
      if (pos < data.length && data[pos] == '\n') pos++
    }
    throw IllegalArgumentException("Unexpected end of HEX: missing EOF record")
  }

  private fun deviceToMap(device: UsbDevice): WritableMap {
    val map = Arguments.createMap()
    map.putInt("deviceId", device.deviceId)
    map.putInt("vendorId", device.vendorId)
    map.putInt("productId", device.productId)
    map.putString("deviceName", device.productName ?: device.deviceName ?: "CH55x Bootloader")
    map.putBoolean("hasPermission", usbManager.hasPermission(device))
    map.putBoolean("isBootloader", true)
    return map
  }

  private fun findDevice(deviceId: Int): UsbDevice? {
    return try {
      usbManager.deviceList.values.firstOrNull { it.deviceId == deviceId }
    } catch (error: Exception) {
      Log.e(TAG, "findDevice failed", error)
      null
    }
  }

  private fun readUsbDeviceExtra(intent: Intent): UsbDevice? {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
    } else {
      @Suppress("DEPRECATION") intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
    }
  }

  private fun schedulePermissionTimeout() {
    cancelPermissionTimeout()
    val runnable = Runnable {
      Log.w(TAG, "Bootloader USB permission timed out")
      settlePermission(false)
    }
    permissionTimeoutRunnable = runnable
    mainHandler.postDelayed(runnable, PERMISSION_TIMEOUT_MS)
  }

  private fun cancelPermissionTimeout() {
    permissionTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
    permissionTimeoutRunnable = null
  }

  private fun settlePermission(granted: Boolean) {
    cancelPermissionTimeout()
    val promise = permissionPromise
    permissionPromise = null
    permissionDeviceId = null
    if (promise != null) {
      try {
        promise.resolve(granted)
      } catch (error: Exception) {
        Log.w(TAG, "Permission promise already settled", error)
      }
    }
  }

  private fun settlePermissionDetached() {
    cancelPermissionTimeout()
    val promise = permissionPromise
    permissionPromise = null
    permissionDeviceId = null
    if (promise != null) {
      try {
        promise.reject("DEVICE_DETACHED", "USB device was unplugged during permission request")
      } catch (error: Exception) {
        Log.w(TAG, "Permission promise already settled", error)
      }
    }
  }

  private fun settlePick(value: WritableMap?) {
    val promise = pickPromise
    pickPromise = null
    if (promise != null) {
      try {
        promise.resolve(value)
      } catch (error: Exception) {
        Log.w(TAG, "Pick promise already settled", error)
      }
    }
  }

  private fun registerPermissionReceiver() {
    val permissionFilter = IntentFilter(ACTION_USB_PERMISSION)
    val detachFilter = IntentFilter(UsbManager.ACTION_USB_DEVICE_DETACHED)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      reactContext.registerReceiver(
        usbPermissionReceiver,
        permissionFilter,
        Context.RECEIVER_NOT_EXPORTED,
      )
      reactContext.registerReceiver(
        usbDetachReceiver,
        detachFilter,
        Context.RECEIVER_NOT_EXPORTED,
      )
    } else {
      @Suppress("UnspecifiedRegisterReceiverFlag")
      reactContext.registerReceiver(usbPermissionReceiver, permissionFilter)
      @Suppress("UnspecifiedRegisterReceiverFlag")
      reactContext.registerReceiver(usbDetachReceiver, detachFilter)
    }
  }

  private fun unregisterPermissionReceiver() {
    try {
      reactContext.unregisterReceiver(usbPermissionReceiver)
    } catch (_: IllegalArgumentException) {
      // Already unregistered.
    }
    try {
      reactContext.unregisterReceiver(usbDetachReceiver)
    } catch (_: IllegalArgumentException) {
      // Already unregistered.
    }
  }

  private fun emitProgress(phase: String, current: Int, total: Int, message: String) {
    val payload = Arguments.createMap()
    payload.putString("phase", phase)
    payload.putInt("current", current)
    payload.putInt("total", total)
    payload.putString("message", message)
    try {
      if (!reactContext.hasActiveReactInstance()) {
        return
      }
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(EVENT_PROGRESS, payload)
    } catch (error: Exception) {
      Log.w(TAG, "Failed to emit progress", error)
    }
  }

}
