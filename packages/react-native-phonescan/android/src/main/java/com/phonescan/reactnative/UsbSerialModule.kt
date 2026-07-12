package com.phonescan.reactnative

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.hoho.android.usbserial.driver.UsbSerialDriver
import com.hoho.android.usbserial.driver.UsbSerialPort
import com.hoho.android.usbserial.driver.UsbSerialProber
import com.hoho.android.usbserial.util.SerialInputOutputManager
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/**
 * Native USB CDC serial bridge for PhoneScan.
 *
 * Connection safety goals:
 * - Survive USB unplug / re-plug without crashing the app
 * - Avoid double-close / IO-manager races
 * - Never leave JS promises hanging on permission dialogs
 * - Keep the scan hot path fast (one bridge event per barcode)
 */
class UsbSerialModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val NAME = "UsbSerialModule"
    private const val TAG = "UsbSerialModule"
    private const val ACTION_USB_PERMISSION = "com.phonescan.reactnative.USB_PERMISSION"
    private const val EVENT_SCAN = "UsbSerial:onScan"
    private const val EVENT_SERIAL_LINE = "UsbSerial:onSerialLine"
    private const val EVENT_SCAN_SIGNAL = "UsbSerial:onScanSignal"
    private const val EVENT_STATE = "UsbSerial:onConnectionState"
    private const val EVENT_ERROR = "UsbSerial:onError"
    private const val READ_BUFFER_SIZE = 8192
    private const val LINE_BUFFER_CAPACITY = 8192
    private const val SCAN_SIGNAL = "[ scan ]"
    private const val WRITE_TIMEOUT_MS = 1000
    private const val PERMISSION_TIMEOUT_MS = 30_000L
  }

  private val usbManager: UsbManager =
    reactContext.getSystemService(Context.USB_SERVICE) as UsbManager

  private val mainHandler = Handler(Looper.getMainLooper())
  private val readExecutor = Executors.newSingleThreadExecutor { runnable ->
    Thread(runnable, "UsbSerial-IO").apply { isDaemon = true }
  }

  private val isConnected = AtomicBoolean(false)
  private val isConnecting = AtomicBoolean(false)
  private val isTearingDown = AtomicBoolean(false)
  private val connectionGeneration = AtomicInteger(0)

  private val serialPortRef = AtomicReference<UsbSerialPort?>(null)
  private val usbConnectionRef = AtomicReference<UsbDeviceConnection?>(null)
  private val ioManagerRef = AtomicReference<SerialInputOutputManager?>(null)
  private val connectedDeviceIdRef = AtomicReference<Int?>(null)

  private var permissionPromise: Promise? = null
  private var permissionDeviceId: Int? = null
  private var permissionTimeoutRunnable: Runnable? = null

  private val lineBytes = ByteArray(LINE_BUFFER_CAPACITY)
  private var lineLength = 0
  private var awaitingBarcode = false
  private var skipLeadingCrLf = false
  private val parserLock = Any()

  private val usbPermissionReceiver =
    object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action != ACTION_USB_PERMISSION) {
          return
        }

        val device: UsbDevice? = readUsbDeviceExtra(intent)
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
        val connectedId = connectedDeviceIdRef.get()
        if (connectedId != null && device.deviceId == connectedId) {
          Log.i(TAG, "USB device detached: ${device.deviceId}")
          readExecutor.execute {
            safeDisconnect(emitState = true, reason = "DEVICE_DETACHED")
          }
        }

        // Unblock a pending permission dialog if the device was unplugged.
        if (permissionDeviceId != null && permissionDeviceId == device.deviceId) {
          settlePermission(false)
        }
      }
    }

  init {
    registerReceivers()
  }

  override fun getName(): String = NAME

  override fun invalidate() {
    try {
      settlePermission(false)
      safeDisconnect(emitState = false, reason = "MODULE_INVALIDATE")
      unregisterReceivers()
    } catch (error: Exception) {
      Log.w(TAG, "invalidate cleanup failed", error)
    }

    try {
      readExecutor.shutdownNow()
    } catch (_: Exception) {
      // Ignore.
    }
    super.invalidate()
  }

  @ReactMethod
  fun listDevices(promise: Promise) {
    try {
      val drivers = UsbSerialProber.getDefaultProber().findAllDrivers(usbManager)
      val result = Arguments.createArray()

      for (driver in drivers) {
        val device = driver.device
        val map = Arguments.createMap()
        map.putInt("deviceId", device.deviceId)
        map.putInt("vendorId", device.vendorId)
        map.putInt("productId", device.productId)
        map.putString("deviceName", device.deviceName ?: "Unknown")
        map.putBoolean("hasPermission", usbManager.hasPermission(device))
        map.putBoolean(
          "isPhoneScan",
          device.vendorId == 0x1209 && device.productId == 0xC55C,
        )
        result.pushMap(map)
      }

      promise.resolve(result)
    } catch (error: Exception) {
      Log.e(TAG, "listDevices failed", error)
      promise.reject("LIST_DEVICES_FAILED", error.message ?: "Failed to list USB devices", error)
    }
  }

  @ReactMethod
  fun requestPermission(deviceId: Int, promise: Promise) {
    try {
      val device = findDevice(deviceId)
      if (device == null) {
        promise.reject("DEVICE_NOT_FOUND", "No USB device with id $deviceId")
        return
      }

      if (usbManager.hasPermission(device)) {
        promise.resolve(true)
        return
      }

      if (permissionPromise != null) {
        // Replace stale permission wait instead of hard-failing the UI.
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
      val pendingIntent = PendingIntent.getBroadcast(reactContext, deviceId, intent, flags)
      schedulePermissionTimeout()
      usbManager.requestPermission(device, pendingIntent)
    } catch (error: Exception) {
      Log.e(TAG, "requestPermission failed", error)
      cancelPermissionTimeout()
      permissionPromise = null
      permissionDeviceId = null
      promise.reject(
        "REQUEST_PERMISSION_FAILED",
        error.message ?: "Failed to request USB permission",
        error,
      )
    }
  }

  @ReactMethod
  fun connect(deviceId: Int, options: ReadableMap?, promise: Promise) {
    if (!isConnecting.compareAndSet(false, true)) {
      promise.reject("CONNECT_IN_PROGRESS", "Another connect attempt is already running")
      return
    }

    readExecutor.execute {
      try {
        // Tear down any previous session quietly before opening a new one.
        // IMPORTANT: capture generation AFTER teardown — safeDisconnect bumps the
        // counter, and capturing before that made every connect abort itself.
        safeDisconnect(emitState = false, reason = "RECONNECT")
        val generation = connectionGeneration.incrementAndGet()

        val device = findDevice(deviceId)
        if (device == null) {
          promise.reject("DEVICE_NOT_FOUND", "No USB device with id $deviceId")
          return@execute
        }

        if (!usbManager.hasPermission(device)) {
          promise.reject("PERMISSION_DENIED", "USB permission not granted for device $deviceId")
          return@execute
        }

        val driver = findDriver(device)
        if (driver == null) {
          promise.reject("DRIVER_NOT_FOUND", "No serial driver for device $deviceId")
          return@execute
        }

        if (driver.ports.isEmpty()) {
          promise.reject("NO_PORTS", "USB serial driver has no ports")
          return@execute
        }

        val connection = usbManager.openDevice(device)
        if (connection == null) {
          promise.reject(
            "OPEN_FAILED",
            "Could not open USB device. Unplug/replug the scanner and try again.",
          )
          return@execute
        }

        val port = driver.ports[0]
        try {
          port.open(connection)
        } catch (error: Exception) {
          try {
            connection.close()
          } catch (_: Exception) {
            // Ignore.
          }
          throw error
        }

        // DTR/RTS help some CDC stacks; never crash if unsupported.
        try {
          port.dtr = true
          port.rts = true
        } catch (error: Exception) {
          Log.w(TAG, "DTR/RTS not supported; continuing", error)
        }

        val baudRate =
          if (options != null && options.hasKey("baudRate")) options.getInt("baudRate") else 57600
        val dataBits =
          if (options != null && options.hasKey("dataBits")) options.getInt("dataBits") else 8
        val stopBits =
          if (options != null && options.hasKey("stopBits")) {
            options.getInt("stopBits")
          } else {
            UsbSerialPort.STOPBITS_1
          }
        val parity =
          when {
            options != null && options.hasKey("parity") ->
              when (options.getString("parity")) {
                "odd" -> UsbSerialPort.PARITY_ODD
                "even" -> UsbSerialPort.PARITY_EVEN
                "mark" -> UsbSerialPort.PARITY_MARK
                "space" -> UsbSerialPort.PARITY_SPACE
                else -> UsbSerialPort.PARITY_NONE
              }
            else -> UsbSerialPort.PARITY_NONE
          }

        try {
          port.setParameters(baudRate, dataBits, stopBits, parity)
        } catch (error: Exception) {
          Log.w(TAG, "setParameters failed; using driver defaults", error)
        }

        // Abort if a newer connect/disconnect raced us.
        if (generation != connectionGeneration.get()) {
          try {
            port.close()
          } catch (_: Exception) {
            // Ignore.
          }
          try {
            connection.close()
          } catch (_: Exception) {
            // Ignore.
          }
          promise.reject("CONNECT_ABORTED", "Connect was superseded by another session")
          return@execute
        }

        usbConnectionRef.set(connection)
        serialPortRef.set(port)
        connectedDeviceIdRef.set(deviceId)
        resetLineParser()
        isConnected.set(true)

        val listener =
          object : SerialInputOutputManager.Listener {
            override fun onNewData(data: ByteArray) {
              if (!isConnected.get() || generation != connectionGeneration.get()) {
                return
              }
              try {
                ingestBytes(data, data.size)
              } catch (error: Exception) {
                Log.e(TAG, "ingestBytes failed", error)
                emitError("PARSE_ERROR", error.message ?: "Failed to parse serial data")
              }
            }

            override fun onRunError(e: Exception) {
              Log.e(TAG, "Serial IO error", e)
              // Never tear down on the IO manager thread — schedule cleanup.
              readExecutor.execute {
                if (generation == connectionGeneration.get()) {
                  emitError("READ_ERROR", e.message ?: "Serial connection lost")
                  safeDisconnect(emitState = true, reason = "READ_ERROR")
                }
              }
            }
          }

        val ioManager = SerialInputOutputManager(port, listener)
        ioManager.readBufferSize = READ_BUFFER_SIZE
        ioManagerRef.set(ioManager)

        try {
          ioManager.start()
        } catch (error: Exception) {
          safeDisconnect(emitState = false, reason = "IO_START_FAILED")
          throw error
        }

        emitConnectionState(true, deviceId, baudRate)
        promise.resolve(null)
      } catch (error: Exception) {
        Log.e(TAG, "connect failed", error)
        safeDisconnect(emitState = false, reason = "CONNECT_FAILED")
        promise.reject("CONNECT_FAILED", error.message ?: "Failed to connect", error)
      } finally {
        isConnecting.set(false)
      }
    }
  }

  @ReactMethod
  fun sendCommand(command: String, promise: Promise) {
    readExecutor.execute {
      try {
        val port = serialPortRef.get()
        if (!isConnected.get() || port == null || isTearingDown.get()) {
          promise.reject("NOT_CONNECTED", "Serial port is not connected")
          return@execute
        }

        // PhoneScan accepts \n or \r; bootloader entry is documented as bootloader\r\n.
        val payload = "$command\r\n".toByteArray(Charsets.UTF_8)
        port.write(payload, WRITE_TIMEOUT_MS)
        promise.resolve(null)
      } catch (error: Exception) {
        Log.e(TAG, "sendCommand failed", error)
        // Soft-fail: keep session unless the port is clearly dead.
        val message = error.message ?: "Failed to send command"
        if (message.contains("closed", ignoreCase = true) ||
          message.contains("not open", ignoreCase = true)
        ) {
          safeDisconnect(emitState = true, reason = "WRITE_FAILED")
        }
        promise.reject("SEND_FAILED", message, error)
      }
    }
  }

  @ReactMethod
  fun disconnect(promise: Promise) {
    readExecutor.execute {
      try {
        safeDisconnect(emitState = true, reason = "USER_DISCONNECT")
        promise.resolve(null)
      } catch (error: Exception) {
        Log.e(TAG, "disconnect failed", error)
        promise.reject("DISCONNECT_FAILED", error.message ?: "Failed to disconnect", error)
      }
    }
  }

  /** Required by NativeEventEmitter on newer React Native. */
  @ReactMethod
  fun addListener(eventName: String) {
    // No-op — subscriptions are tracked on the JS side.
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // No-op — subscriptions are tracked on the JS side.
  }

  private fun safeDisconnect(emitState: Boolean, reason: String) {
    if (!isTearingDown.compareAndSet(false, true)) {
      return
    }

    try {
      connectionGeneration.incrementAndGet()
      val wasConnected = isConnected.getAndSet(false)
      connectedDeviceIdRef.set(null)

      val ioManager = ioManagerRef.getAndSet(null)
      if (ioManager != null) {
        try {
          ioManager.stop()
        } catch (error: Exception) {
          Log.w(TAG, "ioManager.stop failed ($reason)", error)
        }
      }

      val port = serialPortRef.getAndSet(null)
      if (port != null) {
        try {
          port.close()
        } catch (error: Exception) {
          Log.w(TAG, "port.close failed ($reason)", error)
        }
      }

      val connection = usbConnectionRef.getAndSet(null)
      if (connection != null) {
        try {
          connection.close()
        } catch (error: Exception) {
          Log.w(TAG, "usbConnection.close failed ($reason)", error)
        }
      }

      resetLineParser()

      if (emitState && wasConnected) {
        emitConnectionState(false, null, null)
        if (reason == "DEVICE_DETACHED" || reason == "READ_ERROR") {
          emitError(reason, "USB serial connection lost ($reason). Reconnect to continue.")
        }
      }
    } finally {
      isTearingDown.set(false)
    }
  }

  private fun resetLineParser() {
    synchronized(parserLock) {
      lineLength = 0
      awaitingBarcode = false
      skipLeadingCrLf = false
    }
  }

  private fun ingestBytes(data: ByteArray, length: Int) {
    synchronized(parserLock) {
      var index = 0
      while (index < length) {
        val byte = data[index]
        index++

        if (byte == '\r'.code.toByte() || byte == '\n'.code.toByte()) {
          if (skipLeadingCrLf && lineLength == 0) {
            continue
          }
          skipLeadingCrLf = byte == '\r'.code.toByte()
          flushLineLocked()
          continue
        }

        skipLeadingCrLf = false

        if (lineLength >= LINE_BUFFER_CAPACITY) {
          flushLineAsScanOverflowLocked()
        }

        lineBytes[lineLength] = byte
        lineLength++
      }
    }
  }

  private fun flushLineLocked() {
    if (lineLength == 0) {
      return
    }

    val line = String(lineBytes, 0, lineLength, Charsets.UTF_8)
    lineLength = 0
    processSerialLine(line)
  }

  private fun flushLineAsScanOverflowLocked() {
    if (lineLength == 0) {
      return
    }

    val line = String(lineBytes, 0, lineLength, Charsets.UTF_8).trim()
    lineLength = 0
    awaitingBarcode = false

    if (line.isNotEmpty() && !isControlResponse(line)) {
      emitScan(line)
    }
  }

  private fun processSerialLine(rawLine: String) {
    val line = rawLine.trim()
    if (line.isEmpty()) {
      return
    }

    val timestamp = System.currentTimeMillis()

    when {
      isScanSignal(line) -> {
        awaitingBarcode = true
        emitScanSignal(timestamp)
      }
      awaitingBarcode -> {
        awaitingBarcode = false
        if (!isControlResponse(line)) {
          emitScan(line, timestamp)
        } else {
          emitSerialLine(line, timestamp)
        }
      }
      isControlResponse(line) -> {
        emitSerialLine(line, timestamp)
      }
      else -> {
        emitScan(line, timestamp)
      }
    }
  }

  private fun isScanSignal(line: String): Boolean {
    return line.equals(SCAN_SIGNAL, ignoreCase = true) ||
      line.contains(SCAN_SIGNAL, ignoreCase = true)
  }

  private fun isControlResponse(line: String): Boolean {
    val lower = line.lowercase()
    return lower.startsWith("[ err ]") ||
      lower.startsWith("[ mode ]") ||
      lower.startsWith("+") ||
      lower.startsWith("|") ||
      lower.contains("type 'help'") ||
      lower.contains("unknown:") ||
      lower == "help"
  }

  private fun findDevice(deviceId: Int): UsbDevice? {
    return try {
      usbManager.deviceList.values.firstOrNull { it.deviceId == deviceId }
    } catch (error: Exception) {
      Log.e(TAG, "findDevice failed", error)
      null
    }
  }

  private fun findDriver(device: UsbDevice): UsbSerialDriver? {
    return try {
      UsbSerialProber.getDefaultProber().findAllDrivers(usbManager)
        .firstOrNull { it.device.deviceId == device.deviceId }
    } catch (error: Exception) {
      Log.e(TAG, "findDriver failed", error)
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
      Log.w(TAG, "USB permission timed out")
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

  private fun registerReceivers() {
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

  private fun unregisterReceivers() {
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

  private fun emitScan(value: String, timestamp: Long = System.currentTimeMillis()) {
    val payload = Arguments.createMap()
    payload.putString("data", value)
    payload.putDouble("timestamp", timestamp.toDouble())
    payload.putInt("length", value.length)
    sendEvent(EVENT_SCAN, payload)
  }

  private fun emitSerialLine(value: String, timestamp: Long) {
    val payload = Arguments.createMap()
    payload.putString("line", value)
    payload.putDouble("timestamp", timestamp.toDouble())
    sendEvent(EVENT_SERIAL_LINE, payload)
  }

  private fun emitScanSignal(timestamp: Long) {
    val payload = Arguments.createMap()
    payload.putDouble("timestamp", timestamp.toDouble())
    sendEvent(EVENT_SCAN_SIGNAL, payload)
  }

  private fun emitConnectionState(connected: Boolean, deviceId: Int?, baudRate: Int?) {
    val payload = Arguments.createMap()
    payload.putBoolean("connected", connected)
    if (deviceId != null) {
      payload.putInt("deviceId", deviceId)
    }
    if (baudRate != null) {
      payload.putInt("baudRate", baudRate)
    }
    sendEvent(EVENT_STATE, payload)
  }

  private fun emitError(code: String, message: String) {
    val payload = Arguments.createMap()
    payload.putString("code", code)
    payload.putString("message", message)
    sendEvent(EVENT_ERROR, payload)
  }

  private fun sendEvent(eventName: String, params: WritableMap) {
    try {
      if (!reactContext.hasActiveReactInstance()) {
        return
      }
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(eventName, params)
    } catch (error: Exception) {
      Log.w(TAG, "Failed to emit $eventName", error)
    }
  }
}
