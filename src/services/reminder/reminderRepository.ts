import RNFS from 'react-native-fs';
import { Reminder, SyncStatus } from '../../domain/reminder';
import { Logger } from '../logger/logger';

const MODULE = "REMINDER_REPOSITORY";

/**
 * Internal structure of the reminders storage file.
 */
interface ReminderStorage {
  version: number;
  items: Reminder[];
}

const STORAGE_VERSION = 1;
const STORAGE_DIR = `${RNFS.DocumentDirectoryPath}/storage`;
const REMINDERS_PATH = `${STORAGE_DIR}/reminders.json`;

/**
 * Ensures that the storage directory and file exist.
 */
async function ensureStorageExists(): Promise<void> {
  const dirExists = await RNFS.exists(STORAGE_DIR);
  if (!dirExists) {
    Logger.debug(MODULE, "STORAGE_DIR_MISSING", { path: STORAGE_DIR });
    await RNFS.mkdir(STORAGE_DIR);
    Logger.info(MODULE, "STORAGE_DIR_CREATED", { path: STORAGE_DIR });
  }

  const fileExists = await RNFS.exists(REMINDERS_PATH);
  if (!fileExists) {
    const initialData: ReminderStorage = {
      version: STORAGE_VERSION,
      items: [],
    };

    await RNFS.writeFile(
      REMINDERS_PATH,
      JSON.stringify(initialData, null, 2),
      'utf8',
    );

    Logger.info(MODULE, "REMINDERS_FILE_CREATED", { path: REMINDERS_PATH });
  }
}

/**
 * Loads and parses the reminders storage file.
 */
async function loadStorage(): Promise<ReminderStorage> {
  await ensureStorageExists();

  const content = await RNFS.readFile(REMINDERS_PATH, 'utf8');

  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error: any) {
    Logger.error(MODULE, "STORAGE_PARSE_ERROR", { message: error?.message ?? String(error) });
    throw new Error('Reminders storage is corrupted (invalid JSON).');
  }

  const storage = parsed as ReminderStorage;

  if (storage.version !== STORAGE_VERSION) {
    Logger.error(MODULE, "STORAGE_VERSION_MISMATCH", { version: storage.version });
    throw new Error(`Unsupported reminders storage version: ${storage.version}`);
  }

  if (!Array.isArray(storage.items)) {
    Logger.error(MODULE, "STORAGE_ITEMS_INVALID");
    throw new Error('Reminders storage format is invalid.');
  }

  Logger.debug(MODULE, "STORAGE_LOADED", { count: storage.items.length });

  return storage;
}

/**
 * Persists the full reminders storage atomically.
 */
async function saveStorage(data: ReminderStorage): Promise<void> {
  await RNFS.writeFile(
    REMINDERS_PATH,
    JSON.stringify(data, null, 2),
    'utf8',
  );
  Logger.debug(MODULE, "STORAGE_SAVED", { count: data.items.length });
}

/**
 * Returns all reminders.
 */
export async function getAllReminders(): Promise<Reminder[]> {
  const storage = await loadStorage();
  Logger.trace(MODULE, "GET_ALL_REMINDERS", { count: storage.items.length });
  return [...storage.items];
}

/**
 * Returns a reminder by its identifier.
 */
export async function getReminderById(
  reminderId: string,
): Promise<Reminder | null> {
  const storage = await loadStorage();
  const found = storage.items.find(r => r.reminderId === reminderId) ?? null;
  Logger.trace(MODULE, "GET_REMINDER_BY_ID", { reminderId, found: !!found });
  return found;
}

export async function markAllRemindersSending(): Promise<void> {
  const storage = await loadStorage();

  storage.items = storage.items.map(r => ({
    ...r,
    syncStatus: SyncStatus.SENDING,
  }));

  await saveStorage(storage);

  Logger.info(MODULE, "ALL_REMINDERS_MARKED_SENDING", {
    count: storage.items.length
  });
}

export async function markAllRemindersSynced(): Promise<void> {
  const storage = await loadStorage();

  storage.items = storage.items.map(r => ({
    ...r,
    syncStatus: SyncStatus.SYNCED,
  }));

  await saveStorage(storage);

  Logger.info(MODULE, "ALL_REMINDERS_MARKED_SYNCED", {
    count: storage.items.length
  });
}

/**
 * Persists a new reminder.
 */
export async function createReminder(reminder: Reminder): Promise<void> {
  const storage = await loadStorage();
  const exists = storage.items.some(r => r.reminderId === reminder.reminderId);

  if (exists) {
    Logger.error(MODULE, "CREATE_REMINDER_EXISTS", { reminderId: reminder.reminderId });
    throw new Error(`Reminder already exists: ${reminder.reminderId}`);
  }

  storage.items.push(reminder);
  await saveStorage(storage);

  Logger.info(MODULE, "REMINDER_CREATED", { reminderId: reminder.reminderId });
}

/**
 * Updates an existing reminder.
 */
export async function updateReminder(reminder: Reminder): Promise<void> {
  const storage = await loadStorage();
  const index = storage.items.findIndex(r => r.reminderId === reminder.reminderId);

  if (index === -1) {
    Logger.error(MODULE, "UPDATE_REMINDER_NOT_FOUND", { reminderId: reminder.reminderId });
    throw new Error(`Reminder not found: ${reminder.reminderId}`);
  }

  storage.items[index] = reminder;
  await saveStorage(storage);

  Logger.info(MODULE, "REMINDER_UPDATED", { reminderId: reminder.reminderId });
}

/**
 * Deletes a reminder by its identifier.
 */
export async function deleteReminder(reminderId: string): Promise<void> {
  const storage = await loadStorage();
  const initialLength = storage.items.length;

  storage.items = storage.items.filter(r => r.reminderId !== reminderId);

  if (storage.items.length === initialLength) {
    Logger.warn(MODULE, "DELETE_REMINDER_NOT_FOUND", { reminderId });
    throw new Error(`Reminder not found: ${reminderId}`);
  }

  await saveStorage(storage);

  Logger.info(MODULE, "REMINDER_DELETED", { reminderId });
}

/**
 * Returns all reminders matching an audio hash.
 */
export async function getRemindersByAudioHash(
  audioHash: string,
): Promise<Reminder[]> {
  const reminders = await getAllReminders();
  const filtered = reminders.filter(r => r.audioHash === audioHash);
  Logger.trace(MODULE, "GET_REMINDERS_BY_AUDIO_HASH", { audioHash, count: filtered.length });
  return filtered;
}