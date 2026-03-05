import { Reminder, ReminderStatus, SyncStatus, RecurrenceRule } from '../../domain/reminder';
import {
  validateReminder,
  ReminderValidationError,
  doesReminderImpactMemos,
} from '../../domain/reminderValidator';
import {
  createReminder,
  updateReminder,
  getReminderById,
} from './reminderRepository';
import { generateReminderAudio } from '../reminder/generateReminderAudio';
import { Logger } from '../logger/logger';

const MODULE = "REMINDER_SERVICE";

/**
 * Raw input coming from the UI.
 * This is NOT a Reminder.
 */
export interface CreateReminderInput {
  category: string;
  title: string;
  message: string;
  note?: string;
  startDate: string;
  time: string;
  recurrence?: RecurrenceRule;
}

/**
 * Result returned by reminder services.
 */
export interface ReminderServiceResult {
  reminder?: Reminder;
  errors?: ReminderValidationError[];
}

/**
 * UUID v4 generator without crypto dependency.
 * Sufficient for app-level identifiers.
 */
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Creates and persists a new reminder.
 */
export async function createReminderService(
  input: CreateReminderInput,
): Promise<ReminderServiceResult> {

  Logger.info(MODULE, "CREATE_REMINDER_REQUEST", {
    input: {
      category: input.category,
      title: input.title,
      startDate: input.startDate,
      time: input.time,
    }
  });

  const now = new Date().toISOString();
  let audioHash: string;
  let audioFile: string;

  try {
    const audio = await generateReminderAudio(input.message);
    audioHash = audio.audioHash;
    audioFile = audio.audioFile;

    Logger.debug(MODULE, "AUDIO_GENERATED", {
      audioHash,
      audioFile
    });

  } catch (error: any) {

    Logger.error(MODULE, "AUDIO_GENERATION_FAILED", {
      message: error?.message ?? String(error)
    });

    return {
      errors: [{ field: 'message', message: 'Failed to generate audio.' }],
    };
  }

  const reminder: Reminder = {
    reminderId: generateUuid(),

    category: input.category,
    title: input.title,
    message: input.message,
    note: input.note,

    startDate: input.startDate,
    time: input.time,
    recurrence: input.recurrence,

    audioHash,
    audioFile,

    status: ReminderStatus.VALID,
    syncStatus: SyncStatus.NOT_SENT,
    revision: 0,

    createdAt: now,
    updatedAt: now,
  };

  const errors = validateReminder(reminder);

  if (errors.length > 0) {

    Logger.warn(MODULE, "VALIDATION_FAILED", {
      reminderId: reminder.reminderId,
      errors
    });

    return { errors };
  }

  await createReminder(reminder);

  Logger.info(MODULE, "REMINDER_CREATED", {
    reminderId: reminder.reminderId
  });

  return { reminder };
}

/**
 * Updates an existing reminder.
 * Handles revision and sync status properly.
 */
export async function updateReminderService(
  reminderId: string,
  input: Partial<CreateReminderInput>,
): Promise<ReminderServiceResult> {

  Logger.info(MODULE, "UPDATE_REMINDER_REQUEST", {
    reminderId,
    input
  });

  const existing = await getReminderById(reminderId);

  if (!existing) {

    Logger.warn(MODULE, "UPDATE_REMINDER_NOT_FOUND", {
      reminderId
    });

    return {
      errors: [{ field: 'reminderId', message: 'Reminder not found.' }],
    };
  }

  const candidate: Reminder = {
    ...existing,

    category: input.category ?? existing.category,
    title: input.title ?? existing.title,
    message: input.message ?? existing.message,
    note: input.note ?? existing.note,

    startDate: input.startDate ?? existing.startDate,
    time: input.time ?? existing.time,
    recurrence:
      input.recurrence !== undefined
        ? input.recurrence
        : existing.recurrence,

    updatedAt: new Date().toISOString(),
  };

  const errors = validateReminder(candidate);

  if (errors.length > 0) {

    Logger.warn(MODULE, "UPDATE_VALIDATION_FAILED", {
      reminderId,
      errors
    });

    return { errors };
  }

  const impactsMemos = doesReminderImpactMemos(existing, candidate);

  const updated: Reminder = {
    ...candidate,
    revision: impactsMemos ? existing.revision + 1 : existing.revision,
    syncStatus: impactsMemos
      ? SyncStatus.NOT_SENT
      : existing.syncStatus,
  };

  await updateReminder(updated);

  Logger.info(MODULE, "REMINDER_UPDATED", {
    reminderId: updated.reminderId,
    revision: updated.revision,
    syncStatus: updated.syncStatus
  });

  return { reminder: updated };
}