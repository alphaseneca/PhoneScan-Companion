package com.phonescan.reactnative

import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.util.Log

/**
 * CH55x ISP bootloader protocol (ported from ch55xduino bootloaderWebtool/ch55xbl.js).
 *
 * Speaks vendor-class bulk USB (not CDC). PhoneScan enters this mode after the
 * ASCII `bootloader` serial command; the device re-enumerates as VID 0x4348 / PID 0x55E0.
 */
class Ch55xBootloaderProgrammer(
  private val connection: UsbDeviceConnection,
  private val usbInterface: UsbInterface,
  private val endpointIn: UsbEndpoint,
  private val endpointOut: UsbEndpoint,
) {
  data class DetectInfo(
    val deviceIdByte: Int,
    val bootloaderVersion: String,
    val chipId: List<Int>,
  )

  fun interface ProgressListener {
    fun onProgress(phase: String, current: Int, total: Int, message: String)
  }

  companion object {
    private const val TAG = "Ch55xBootloader"
    const val BOOTLOADER_VID = 0x4348
    const val BOOTLOADER_PID = 0x55E0
    const val MAX_FIRMWARE_BYTES = 63 * 1024
    private const val TRANSFER_TIMEOUT_MS = 2000
    private const val PACKET_DATA = 56

    private val DETECT_CMD =
      byteArrayOf(
        0xA1.toByte(),
        0x12,
        0x00,
        0x00,
        0x11,
        0x4D,
        0x43,
        0x55,
        0x20,
        0x49,
        0x53,
        0x50,
        0x20,
        0x26,
        0x20,
        0x57,
        0x43,
        0x48,
        0x2E,
        0x43,
        0x4E,
      )
    private val ID_CMD = byteArrayOf(0xA7.toByte(), 0x02, 0x00, 0x1F, 0x00)
    private val INIT_CMD =
      byteArrayOf(
        0xA8.toByte(),
        0x0E,
        0x00,
        0x07,
        0x00,
        0xFF.toByte(),
        0xFF.toByte(),
        0xFF.toByte(),
        0xFF.toByte(),
        0x03,
        0x00,
        0x00,
        0x00,
        0xFF.toByte(),
        0x52,
        0x00,
        0x00,
      )
    private val ADDRESS_CMD =
      ByteArray(33).also {
        it[0] = 0xA3.toByte()
        it[1] = 0x1E
      }
    private val ERASE_CMD = byteArrayOf(0xA4.toByte(), 0x01, 0x00, 0x08)
    // Last byte 0x01 = run app after reset.
    private val RESET_CMD = byteArrayOf(0xA2.toByte(), 0x01, 0x00, 0x01)

    private val SUPPORTED_MCU_IDS = setOf(0x51, 0x52, 0x54, 0x58, 0x59)

    fun isBootloaderDevice(device: UsbDevice): Boolean {
      return device.vendorId == BOOTLOADER_VID && device.productId == BOOTLOADER_PID
    }

    fun findBootloaderDevices(usbManager: UsbManager): List<UsbDevice> {
      return usbManager.deviceList.values.filter { isBootloaderDevice(it) }
    }

    /**
     * Locate the last vendor-class (0xFF) interface with bulk IN + OUT endpoints.
     * Matches the WebUSB tool's "last matching interface wins" behavior.
     */
    fun open(
      usbManager: UsbManager,
      device: UsbDevice,
    ): Ch55xBootloaderProgrammer {
      if (!isBootloaderDevice(device)) {
        throw IllegalArgumentException(
          "Not a CH55x bootloader (expected VID ${BOOTLOADER_VID.toString(16)} / " +
            "PID ${BOOTLOADER_PID.toString(16)})",
        )
      }
      if (!usbManager.hasPermission(device)) {
        throw SecurityException("USB permission not granted for bootloader device")
      }

      val connection =
        usbManager.openDevice(device)
          ?: throw IllegalStateException("Could not open CH55x bootloader USB device")

      var chosenInterface: UsbInterface? = null
      var endpointIn: UsbEndpoint? = null
      var endpointOut: UsbEndpoint? = null

      for (i in 0 until device.interfaceCount) {
        val intf = device.getInterface(i)
        if (intf.interfaceClass != UsbConstants.USB_CLASS_VENDOR_SPEC) {
          continue
        }
        var inEp: UsbEndpoint? = null
        var outEp: UsbEndpoint? = null
        for (e in 0 until intf.endpointCount) {
          val ep = intf.getEndpoint(e)
          if (ep.type != UsbConstants.USB_ENDPOINT_XFER_BULK) {
            continue
          }
          if (ep.direction == UsbConstants.USB_DIR_IN) {
            inEp = ep
          } else if (ep.direction == UsbConstants.USB_DIR_OUT) {
            outEp = ep
          }
        }
        if (inEp != null && outEp != null) {
          chosenInterface = intf
          endpointIn = inEp
          endpointOut = outEp
        }
      }

      if (chosenInterface == null || endpointIn == null || endpointOut == null) {
        connection.close()
        throw IllegalStateException("No vendor bulk interface found on CH55x bootloader")
      }

      if (!connection.claimInterface(chosenInterface, true)) {
        connection.close()
        throw IllegalStateException("Failed to claim CH55x bootloader interface")
      }

      return Ch55xBootloaderProgrammer(connection, chosenInterface, endpointIn, endpointOut)
    }
  }

  private var xorMask = ByteArray(8)
  private var mcuId: Int = 0

  fun close() {
    try {
      connection.releaseInterface(usbInterface)
    } catch (error: Exception) {
      Log.w(TAG, "releaseInterface failed", error)
    }
    try {
      connection.close()
    } catch (error: Exception) {
      Log.w(TAG, "connection.close failed", error)
    }
  }

  fun detect(): DetectInfo {
    val detectResp = transact(DETECT_CMD)
    mcuId = detectResp[4].toInt() and 0xFF
    val family = detectResp[5].toInt() and 0xFF
    if (family != 0x11) {
      throw IllegalStateException("MCU family not supported (got 0x${family.toString(16)})")
    }
    if (mcuId !in SUPPORTED_MCU_IDS) {
      throw IllegalStateException("Device not supported (MCU id 0x${mcuId.toString(16)})")
    }

    val idResp = transact(ID_CMD)
    val major = idResp[19].toInt() and 0xFF
    val minor = idResp[20].toInt() and 0xFF
    val patch = idResp[21].toInt() and 0xFF
    val versionNumber = major * 100 + minor * 10 + patch
    if (versionNumber < 231 || versionNumber > 250) {
      throw IllegalStateException("Bootloader version not supported: $major.$minor.$patch")
    }

    val chipId =
      listOf(
        idResp[22].toInt() and 0xFF,
        idResp[23].toInt() and 0xFF,
        idResp[24].toInt() and 0xFF,
        idResp[25].toInt() and 0xFF,
      )

    val idSum = (chipId[0] + chipId[1] + chipId[2] + chipId[3]) and 0xFF
    xorMask = ByteArray(8) { idSum.toByte() }
    xorMask[7] = ((xorMask[7].toInt() and 0xFF) + mcuId).toByte()

    return DetectInfo(
      deviceIdByte = mcuId,
      bootloaderVersion = "$major.$minor.$patch",
      chipId = chipId,
    )
  }

  /**
   * Erase, write, verify, and reset. [firmware] is raw flash image (from .bin or parsed .hex).
   */
  fun flash(firmware: ByteArray, listener: ProgressListener? = null) {
    if (firmware.isEmpty()) {
      throw IllegalArgumentException("Firmware is empty")
    }
    if (firmware.size > MAX_FIRMWARE_BYTES) {
      throw IllegalArgumentException(
        "Firmware too large (${firmware.size} > $MAX_FIRMWARE_BYTES bytes)",
      )
    }

    listener?.onProgress("init", 0, 1, "Initializing bootloader")
    transact(INIT_CMD)
    transact(ID_CMD)
    transact(ADDRESS_CMD)
    listener?.onProgress("erase", 0, 1, "Erasing flash")
    transact(ERASE_CMD)

    val writeSize = firmware.size
    val totalPackets = (writeSize + PACKET_DATA - 1) / PACKET_DATA
    var lastPacketSize = writeSize % PACKET_DATA
    // Pad last packet length to a multiple of 8 (protocol requirement).
    lastPacketSize = ((lastPacketSize + 7) / 8) * 8
    if (lastPacketSize == 0) {
      lastPacketSize = PACKET_DATA
    }

    for (i in 0 until totalPackets) {
      val cmd = buildDataPacket(0xA5, firmware, i, totalPackets, lastPacketSize)
      transact(cmd)
      listener?.onProgress(
        "write",
        i + 1,
        totalPackets,
        "Writing packet ${i + 1} / $totalPackets",
      )
    }

    for (i in 0 until totalPackets) {
      val cmd = buildDataPacket(0xA6, firmware, i, totalPackets, lastPacketSize)
      val result = transact(cmd)
      val statusLo = result[4].toInt() and 0xFF
      val statusHi = result[5].toInt() and 0xFF
      if (statusLo != 0 || statusHi != 0) {
        throw IllegalStateException("Verify failed on packet $i")
      }
      listener?.onProgress(
        "verify",
        i + 1,
        totalPackets,
        "Verifying packet ${i + 1} / $totalPackets",
      )
    }

    // Reset may not return a full response if the device reboots immediately.
    try {
      connection.bulkTransfer(endpointOut, RESET_CMD, RESET_CMD.size, TRANSFER_TIMEOUT_MS)
    } catch (error: Exception) {
      Log.i(TAG, "Reset transfer ended (device likely rebooting): ${error.message}")
    }
    listener?.onProgress("done", 1, 1, "Flash finished")
  }

  private fun buildDataPacket(
    opcode: Int,
    firmware: ByteArray,
    packetIndex: Int,
    totalPackets: Int,
    lastPacketSize: Int,
  ): ByteArray {
    val cmd = ByteArray(64)
    cmd[0] = opcode.toByte()
    cmd[1] = 0x3D

    for (j in 0 until PACKET_DATA) {
      val src = packetIndex * PACKET_DATA + j
      cmd[8 + j] = if (src < firmware.size) firmware[src] else 0
    }

    // XOR each 8-byte block with the chip-id mask (same as WebUSB tool).
    for (j in 0 until 7) {
      for (ii in 0 until 8) {
        val idx = 8 + j * 8 + ii
        cmd[idx] = (cmd[idx].toInt() xor (xorMask[ii].toInt() and 0xFF)).toByte()
      }
    }

    val address = packetIndex * PACKET_DATA
    val payloadLen =
      if (packetIndex < totalPackets - 1) {
        61
      } else {
        61 - (PACKET_DATA - lastPacketSize)
      }
    cmd[1] = payloadLen.toByte()
    cmd[3] = (address and 0xFF).toByte()
    cmd[4] = ((address shr 8) and 0xFF).toByte()

    return cmd.copyOf(payloadLen + 3)
  }

  private fun transact(command: ByteArray): ByteArray {
    val written =
      connection.bulkTransfer(endpointOut, command, command.size, TRANSFER_TIMEOUT_MS)
    if (written < 0) {
      throw IllegalStateException("USB OUT transfer failed")
    }

    val buffer = ByteArray(64)
    val read = connection.bulkTransfer(endpointIn, buffer, buffer.size, TRANSFER_TIMEOUT_MS)
    if (read < 0) {
      throw IllegalStateException("USB IN transfer failed")
    }
    return buffer.copyOf(read.coerceAtLeast(6))
  }
}
