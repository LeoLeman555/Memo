import { BleService } from './bleService';
import { sendFileViaBle } from '../ble/sendFileViaBle';
import { prepareSyncFiles } from './prepareSyncFiles';
import { delay } from '../../utils/delay';
import { EspStatusMessage } from '../../domain/espStatus';
import { Logger } from '../logger/logger';

const MODULE = "SYNC_WITH_ESP";

type SyncContext = {
  ble: BleService;
  setProgress: (v: number) => void;
  onEspMessage: (msg: EspStatusMessage) => void;
};

/**
 * Synchronize memo.json and all required audio files with ESP.
 */
export async function syncWithEsp({
  ble,
  setProgress,
  onEspMessage,
}: SyncContext): Promise<void> {

  Logger.info(MODULE, "SYNC_START");

  setProgress(0);

  const files = await prepareSyncFiles();

  Logger.debug(MODULE, "SYNC_FILES_PREPARED", {
    count: files.length
  });

  const totalFiles = files.length;
  let current = 0;

  for (const file of files) {

    current++;

    Logger.info(MODULE, "SYNC_FILE_START", {
      index: current,
      total: totalFiles,
      path: file.path
    });

    await sendFileViaBle({
      ble,
      filePath: file.path,
      setProgress: p => {

        const base = ((current - 1) / totalFiles) * 100;
        const part = p / totalFiles;

        setProgress(Math.floor(base + part));

      },
      onEspMessage,
    });

    Logger.info(MODULE, "SYNC_FILE_COMPLETED", {
      index: current,
      total: totalFiles
    });

    await delay(300);
  }

  setProgress(100);

  Logger.info(MODULE, "SYNC_COMPLETED");
}