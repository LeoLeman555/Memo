import { BleManager, Device, Subscription, State } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import {
  parseEspStatus,
  EspStatusMessage,
} from '../../domain/espStatus'

import { Logger } from '../logger/logger';

const SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
const CHAR_START = '12345678-1234-5678-1234-56789abcdef1';
const CHAR_CHUNK = '12345678-1234-5678-1234-56789abcdef2';
const CHAR_STATUS = '12345678-1234-5678-1234-56789abcdef3';

const MODULE = "BLE_SERVICE";

export class BleService {
  public chunkSize = 480;
  private manager = new BleManager();
  private connected: Device | null = null;
  private bleState: State | null = null;
  public onBleReady?: () => void;

  constructor() {
    this.manager.onStateChange((state: State) => {

      this.bleState = state;

      Logger.debug(MODULE, "BLE_ADAPTER_STATE_CHANGED", {
        state
      });

      if (state === 'PoweredOn' && !this.connected) {

        Logger.info(MODULE, "BLE_ADAPTER_READY");

        this.onBleReady?.();
      }

    }, true);
  }

  isBluetoothEnabled(): boolean {
    return this.bleState === 'PoweredOn';
  }

  getBluetoothState(): State | null {
    return this.bleState;
  }

  async isDeviceConnected(): Promise<boolean> {

    if (!this.connected) {
      return false;
    }

    try {

      const connected = await this.connected.isConnected();

      if (!connected) {

        Logger.warn(MODULE, "BLE_GHOST_CONNECTION_CLEANUP");

        this.connected = null;
        return false;
      }

      return true;

    } catch {

      Logger.warn(MODULE, "BLE_CONNECTION_STATE_ERROR");

      this.connected = null;
      return false;
    }
  }

  async scanAndConnect(timeoutMs = 8000): Promise<Device | null> {

    if (this.connected) {

      const stillConnected =
        await this.connected.isConnected().catch(() => false);

      if (stillConnected) {

        Logger.info(MODULE, "BLE_ALREADY_CONNECTED");

        return this.connected;
      }

      Logger.warn(MODULE, "BLE_GHOST_CONNECTION_DETECTED");

      this.connected = null;
    }

    if (this.bleState !== 'PoweredOn') {

      Logger.error(MODULE, "BLE_SCAN_ABORT_BLUETOOTH_OFF");

      throw new Error('Bluetooth is OFF');
    }

    Logger.info(MODULE, "BLE_SCAN_START", {
      timeoutMs
    });

    return new Promise((resolve, reject) => {

      const timer = setTimeout(() => {

        this.manager.stopDeviceScan();

        Logger.warn(MODULE, "BLE_SCAN_TIMEOUT");

        reject(new Error('Scan timeout'));

      }, timeoutMs);

      this.manager.startDeviceScan(null, null, async (err, device) => {

        if (err) {

          clearTimeout(timer);

          Logger.error(MODULE, "BLE_SCAN_ERROR", {
            message: err.message
          });

          reject(err);
          return;
        }

        if (!device?.name) return;

        if (
          device.name.includes('ESP32') ||
          device.name.includes('BOX') ||
          device.name.includes('MEMO') ||
          device.name.includes('TALKING')
        ) {

          this.manager.stopDeviceScan();
          clearTimeout(timer);

          Logger.info(MODULE, "BLE_DEVICE_FOUND", {
            name: device.name,
            id: device.id
          });

          try {

            const d = await device.connect();

            Logger.debug(MODULE, "BLE_DEVICE_CONNECTING", {
              id: device.id
            });

            await d.discoverAllServicesAndCharacteristics();

            this.connected = d;

            d.onDisconnected(() => {

              Logger.warn(MODULE, "BLE_DEVICE_DISCONNECTED", {
                id: device.id
              });

              this.connected = null;
            });

            Logger.info(MODULE, "BLE_DEVICE_CONNECTED", {
              id: device.id,
              name: device.name
            });

            try {

              const mtuValue = Number(await d.requestMTU(512));

              if (!isNaN(mtuValue)) {

                this.chunkSize = Math.min(160, mtuValue - 23);

                Logger.debug(MODULE, "BLE_MTU_NEGOTIATED", {
                  mtu: mtuValue,
                  chunkSize: this.chunkSize
                });
              }

            } catch {

              Logger.warn(MODULE, "BLE_MTU_NEGOTIATION_FAILED", {
                fallbackChunkSize: this.chunkSize
              });
            }

            resolve(d);

          } catch (e: any) {

            Logger.error(MODULE, "BLE_CONNECTION_FAILED", {
              message: e.message
            });

            reject(e);
          }
        }
      });
    });
  }

  /** Send binary START frame with metadata. */
  async writeStartBinary(
    totalSize: number,
    sha256: string,
    filename: string,
    totalChunks?: number,
  ) {

    if (!this.connected) {
      Logger.error(MODULE, "BLE_WRITE_START_NOT_CONNECTED");
      throw new Error('Not connected');
    }

    if (!totalChunks) {
      totalChunks = Math.ceil(totalSize / this.chunkSize);
    }

    const shaShortHex = sha256.substring(0, 16);
    const shaBytes = Buffer.from(shaShortHex, 'hex');
    const filenameBytes = Buffer.from(filename, 'utf8');

    if (filenameBytes.length > 120) {

      Logger.error(MODULE, "BLE_FILENAME_TOO_LONG", {
        filename
      });

      throw new Error('Filename too long');
    }

    const headerLength =
      1 + 2 + 4 + 2 + 1 + filenameBytes.length + 8;

    const buf = Buffer.alloc(headerLength);

    let offset = 0;

    buf.writeUInt8(0x01, offset); offset += 1;
    buf.writeUInt16BE(totalChunks, offset); offset += 2;
    buf.writeUInt32BE(totalSize, offset); offset += 4;
    buf.writeUInt16BE(this.chunkSize, offset); offset += 2;

    buf.writeUInt8(filenameBytes.length, offset); offset += 1;
    filenameBytes.copy(buf, offset); offset += filenameBytes.length;

    shaBytes.copy(buf, offset);

    await this.connected.writeCharacteristicWithResponseForService(
      SERVICE_UUID,
      CHAR_START,
      buf.toString('base64'),
    );

    Logger.info(MODULE, "BLE_START_FRAME_SENT", {
      filename,
      totalChunks,
      totalSize,
      chunkSize: this.chunkSize,
      shaShortHex
    });
  }

  /** Send END frame. */
  async sendEnd() {

    if (!this.connected) {
      Logger.error(MODULE, "BLE_SEND_END_NOT_CONNECTED");
      throw new Error('Not connected');
    }

    const buf = Buffer.from([0x02]);

    await this.connected.writeCharacteristicWithResponseForService(
      SERVICE_UUID,
      CHAR_START,
      buf.toString('base64'),
    );

    Logger.debug(MODULE, "BLE_END_FRAME_SENT");
  }

  /** Send single chunk with sequence number. */
  async writeChunk(seq: number, payload: Uint8Array) {

    if (!this.connected) {
      Logger.error(MODULE, "BLE_WRITE_CHUNK_NOT_CONNECTED");
      throw new Error('Not connected');
    }

    const buf = Buffer.alloc(4 + payload.length);
    buf.writeUInt32BE(seq, 0);
    Buffer.from(payload).copy(buf, 4);

    await this.connected.writeCharacteristicWithResponseForService(
      SERVICE_UUID,
      CHAR_CHUNK,
      buf.toString('base64'),
    );

    Logger.trace(MODULE, "BLE_CHUNK_SENT", {
      seq,
      size: payload.length
    });
  }

  async subscribeStatus(
    cb: (msg: EspStatusMessage) => void,
  ): Promise<Subscription> {

    if (!this.connected) {
      Logger.error(MODULE, "BLE_SUBSCRIBE_NOT_CONNECTED");
      throw new Error('Not connected');
    }

    Logger.info(MODULE, "BLE_STATUS_SUBSCRIBE");

    return this.connected.monitorCharacteristicForService(
      SERVICE_UUID,
      CHAR_STATUS,
      (error, characteristic) => {

        if (error) {

          Logger.error(MODULE, "BLE_STATUS_STREAM_ERROR", {
            message: error.message
          });

          return;
        }

        if (!characteristic?.value) return;

        try {

          const decoded = Buffer
            .from(characteristic.value, 'base64')
            .toString('utf8');

          const raw = JSON.parse(decoded);
          const parsed = parseEspStatus(raw);

          if (parsed) {

            Logger.trace(MODULE, "BLE_STATUS_MESSAGE_RECEIVED", {
              type: parsed.type
            });

            cb(parsed);
          }

        } catch {

          Logger.warn(MODULE, "BLE_STATUS_FRAME_INVALID");
        }
      },
    );
  }

  async disconnect() {

    if (this.connected) {

      Logger.info(MODULE, "BLE_DISCONNECT_REQUEST");

      await this.connected.cancelConnection();

      this.connected = null;

      Logger.info(MODULE, "BLE_DISCONNECTED");
    }
  }
}