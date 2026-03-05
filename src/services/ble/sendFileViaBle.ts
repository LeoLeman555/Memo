import RNFS from 'react-native-fs';
import CryptoJS from 'crypto-js';
import { Buffer } from 'buffer';

import { BleService } from './bleService';
import { delay } from '../../utils/delay';
import { EspStatusMessage } from '../../domain/espStatus';
import { Logger } from '../logger/logger';

const MODULE = "BLE_FILE_TRANSFER";

type SendFileContext = {
  ble: BleService;
  filePath: string;
  setProgress: (v: number) => void;
  onEspMessage: (msg: EspStatusMessage) => void;
};

export async function computeMeta(path: string, payloadSize: number) {

  Logger.trace(MODULE, "COMPUTE_FILE_METADATA", {
    path,
    payloadSize
  });

  const stat = await RNFS.stat(path);
  const size = Number(stat.size);

  const b64 = await RNFS.readFile(path, 'base64');
  const w = CryptoJS.enc.Base64.parse(b64);
  const sha256 = CryptoJS.SHA256(w).toString(CryptoJS.enc.Hex);

  const totalChunks = Math.ceil(size / payloadSize);

  Logger.debug(MODULE, "FILE_METADATA_READY", {
    size,
    totalChunks
  });

  return {
    size,
    sha256,
    totalChunks,
    filename: path.split('/').pop() || 'file.mp3',
  };
}

export async function* chunkFile(filePath: string, chunkSize: number) {

  Logger.trace(MODULE, "CHUNK_FILE_START", {
    filePath,
    chunkSize
  });

  const base64 = await RNFS.readFile(filePath, 'base64');
  const buffer = Buffer.from(base64, 'base64');

  let seq = 0;

  for (let offset = 0; offset < buffer.length; offset += chunkSize) {

    const end = Math.min(offset + chunkSize, buffer.length);
    const payload = buffer.slice(offset, end);

    yield { seq, payload };

    seq++;
  }

  Logger.trace(MODULE, "CHUNK_FILE_COMPLETED", {
    totalChunks: seq
  });
}

export async function sendFileViaBle({
  ble,
  filePath,
  setProgress,
  onEspMessage,
}: SendFileContext): Promise<void> {

  const filename = filePath.split('/').pop();

  if (!filename) {

    Logger.error(MODULE, "INVALID_FILE_PATH", {
      filePath
    });

    throw new Error('Invalid file path');
  }

  Logger.info(MODULE, "TRANSFER_START", {
    filename
  });

  const meta = await computeMeta(filePath, ble.chunkSize);

  Logger.debug(MODULE, "TRANSFER_METADATA_READY", {
    filename,
    size: meta.size,
    totalChunks: meta.totalChunks
  });

  let espState: string | null = null;
  let failed = false;

  await ble.subscribeStatus((msg: EspStatusMessage) => {

    onEspMessage(msg);

    Logger.trace(MODULE, "ESP_STATUS_MESSAGE", {
      type: msg.type
    });

    switch (msg.type) {

      case 'state':

        espState = msg.state;

        Logger.debug(MODULE, "ESP_STATE_UPDATE", {
          state: msg.state
        });

        if (msg.state === 'ready') {
          setProgress(100);
        }

        if (msg.state === 'error') {
          failed = true;
        }

        break;

      case 'progress':

        if (msg.subsystem === 'storage') {

          const percent = Math.floor(
            (msg.current / msg.total) * 100,
          );

          setProgress(percent);

          Logger.trace(MODULE, "ESP_STORAGE_PROGRESS", {
            percent,
            current: msg.current,
            total: msg.total
          });
        }

        break;

      case 'error':

        Logger.error(MODULE, "ESP_RUNTIME_ERROR", {
          code: msg.code,
          fatal: msg.fatal,
          message: msg.message
        });

        failed = msg.fatal;
        break;

      case 'telemetry':
        break;
    }
  });

  await ble.writeStartBinary(
    meta.size,
    meta.sha256,
    filename,
    meta.totalChunks,
  );

  Logger.debug(MODULE, "START_FRAME_SENT", {
    filename
  });

  const startTimeout = Date.now();

  while (espState !== 'receiving') {

    if (failed) {

      Logger.error(MODULE, "TRANSFER_ABORTED_BY_ESP");

      throw new Error('ESP error');
    }

    if (Date.now() - startTimeout > 5000) {

      Logger.error(MODULE, "START_TIMEOUT", {
        filename
      });

      throw new Error('START timeout');
    }

    await delay(50);
  }

  Logger.info(MODULE, "ESP_READY_TO_RECEIVE", {
    filename
  });

  for await (const { seq, payload } of chunkFile(
    filePath,
    ble.chunkSize,
  )) {

    if (failed) {

      Logger.error(MODULE, "TRANSFER_ABORTED");

      throw new Error('Transfer aborted');
    }

    await ble.writeChunk(seq, payload);
  }

  Logger.debug(MODULE, "ALL_CHUNKS_SENT", {
    filename
  });

  await ble.sendEnd();

  Logger.debug(MODULE, "END_FRAME_SENT", {
    filename
  });

  const finalTimeout = Date.now();

  while (espState !== 'ready') {

    if (failed) {

      Logger.error(MODULE, "ESP_FINALIZATION_FAILED");

      throw new Error('ESP failed');
    }

    if (Date.now() - finalTimeout > 15000) {

      Logger.error(MODULE, "FINALIZE_TIMEOUT", {
        filename
      });

      throw new Error('Finalize timeout');
    }

    await delay(100);
  }

  Logger.info(MODULE, "TRANSFER_COMPLETED", {
    filename
  });
}