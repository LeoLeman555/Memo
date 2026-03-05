import RNFS from 'react-native-fs';
import { getAllReminders } from '../reminder/reminderRepository';
import { ReminderStatus } from '../../domain/reminder';
import { Logger } from '../logger/logger';

const MODULE = "MEMO_REPOSITORY";

/**
 * Structure sent to the ESP device.
 */
export interface MemoFile {
  version: number;
  generatedAt: string;
  deviceTimeZone: string;
  items: MemoItem[];
}

export interface MemoItem {
  memoId: string;
  title: string;
  message: string;
  startDate: string;
  time: string;
  recurrence: any | null;
  audioFile: string;
}

const STORAGE_DIR = `${RNFS.DocumentDirectoryPath}/storage`;
const MEMO_PATH = `${STORAGE_DIR}/memo.json`;
const TTS_DIR = `${RNFS.DocumentDirectoryPath}/tts`;
const MEMO_VERSION = 1;

/**
 * Builds memo structure from valid reminders.
 */
async function buildMemoFile(): Promise<MemoFile> {

  Logger.trace(MODULE, "BUILD_MEMO_REQUEST");

  const reminders = await getAllReminders();
  Logger.debug(MODULE, "TOTAL_REMINDERS_LOADED", { count: reminders.length });

  const validReminders = reminders.filter(r => r.status === ReminderStatus.VALID);
  Logger.debug(MODULE, "VALID_REMINDERS_FILTERED", { count: validReminders.length });

  const items: MemoItem[] = [];

  for (const r of validReminders) {
    const audioPath = `${TTS_DIR}/${r.audioFile}`;
    const exists = await RNFS.exists(audioPath);

    if (!exists) {
      Logger.error(MODULE, "AUDIO_FILE_MISSING", { reminderId: r.reminderId, audioFile: r.audioFile });
      throw new Error(`Audio file missing for reminder ${r.reminderId}`);
    }

    items.push({
      memoId: r.reminderId,
      title: r.title,
      message: r.message,
      startDate: r.startDate,
      time: r.time,
      recurrence: r.recurrence ?? null,
      audioFile: r.audioFile,
    });

    Logger.trace(MODULE, "MEMO_ITEM_ADDED", { reminderId: r.reminderId, audioFile: r.audioFile });
  }

  const memoFile: MemoFile = {
    version: MEMO_VERSION,
    generatedAt: new Date().toISOString(),
    deviceTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    items,
  };

  Logger.info(MODULE, "MEMO_FILE_BUILT", { itemCount: items.length });

  return memoFile;
}

/**
 * Generates memo.json on disk and returns its absolute path.
 */
export async function generateMemoFile(): Promise<string> {

  Logger.trace(MODULE, "GENERATE_MEMO_FILE_REQUEST");

  const memo = await buildMemoFile();

  const dirExists = await RNFS.exists(STORAGE_DIR);
  if (!dirExists) {
    await RNFS.mkdir(STORAGE_DIR);
    Logger.info(MODULE, "STORAGE_DIR_CREATED", { path: STORAGE_DIR });
  }

  await RNFS.writeFile(MEMO_PATH, JSON.stringify(memo, null, 2), 'utf8');

  Logger.info(MODULE, "MEMO_FILE_WRITTEN", { path: MEMO_PATH, itemsCount: memo.items.length });

  return MEMO_PATH;
}