import RNFS from 'react-native-fs';
import {
  getReminderById,
  deleteReminder,
  getRemindersByAudioHash,
} from './reminderRepository';
import { Logger } from '../logger/logger';

const MODULE = "DELETE_REMINDER_SERVICE";
const TTS_DIR = `${RNFS.DocumentDirectoryPath}/tts`;

/**
 * Delete a reminder safely.
 * Audio file is deleted only if no other reminder references it.
 */
export async function deleteReminderService(
  reminderId: string,
): Promise<void> {

  Logger.trace(MODULE, "DELETE_REQUEST", { reminderId });

  const reminder = await getReminderById(reminderId);

  if (!reminder) {
    Logger.warn(MODULE, "REMINDER_NOT_FOUND", { reminderId });
    throw new Error('[REMINDER][DELETE] Reminder not found');
  }

  Logger.debug(MODULE, "REMINDER_FOUND", { reminderId, audioHash: reminder.audioHash });

  // Delete reminder first
  await deleteReminder(reminderId);
  Logger.info(MODULE, "REMINDER_DELETED", { reminderId });

  // No audio → nothing else to do
  if (!reminder.audioHash || !reminder.audioFile) {
    Logger.trace(MODULE, "NO_AUDIO_TO_DELETE", { reminderId });
    return;
  }

  // Check if audio is still referenced by other reminders
  const remaining = await getRemindersByAudioHash(reminder.audioHash);

  if (remaining.length > 0) {
    Logger.trace(MODULE, "AUDIO_STILL_REFERENCED", { audioHash: reminder.audioHash, remainingCount: remaining.length });
    return;
  }

  // Delete orphan audio file
  const audioPath = `${TTS_DIR}/${reminder.audioFile}`;
  const exists = await RNFS.exists(audioPath);

  if (exists) {
    try {
      await RNFS.unlink(audioPath);
      Logger.info(MODULE, "AUDIO_FILE_DELETED", { audioFile: reminder.audioFile, audioHash: reminder.audioHash });
    } catch (error: any) {
      Logger.error(MODULE, "AUDIO_DELETE_FAILED", { audioFile: reminder.audioFile, message: error?.message ?? String(error) });
    }
  } else {
    Logger.trace(MODULE, "AUDIO_FILE_NOT_FOUND", { audioFile: reminder.audioFile });
  }
}