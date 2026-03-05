import { useState } from 'react';
import { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { createReminderService } from '../services/reminder/reminderService';
import { validateReminder, ReminderValidationError } from '../domain/reminderValidator';
import {
  Reminder,
  ReminderStatus,
  SyncStatus,
  Frequency,
  RecurrenceRule,
} from '../domain/reminder';
import { formatDate, formatTime } from '../utils/dateFormat';
import { FieldErrors, RecurrenceUI } from '../domain/reminderUI';
import { Logger } from '../services/logger/logger';

const MODULE = 'REMINDER_EDITOR_HOOK';

function mapValidationErrors(errors: ReminderValidationError[]): FieldErrors {
  const result: FieldErrors = {};

  for (const error of errors) {
    if (
      error.field === 'title' ||
      error.field === 'message' ||
      error.field === 'startDate' ||
      error.field === 'time'
    ) {
      result[error.field] = error.message;
    } else if (error.field.startsWith('recurrence')) {
      result.recurrence = error.message;
    }
  }

  return result;
}

export function useReminderEditor(onBack: () => void) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [startDate, setStartDate] = useState('2026-01-01');
  const [time, setTime] = useState('08:00');

  const [errors, setErrors] = useState<FieldErrors>({});

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showUntilPicker, setShowUntilPicker] = useState(false);

  const [recurrenceUI, setRecurrenceUI] = useState<RecurrenceUI>({
    enabled: false,
    frequency: Frequency.DAILY,
    interval: '1',
    byWeekday: [],
    byMonthDay: [],
    endMode: 'NEVER',
    until: undefined,
    count: undefined,
  });

  function onDateChange(
      _: DateTimePickerEvent,
      selected?: Date,
    ) {
    setShowDatePicker(false);
  
    if (selected) {
      setStartDate(formatDate(selected));
      if (errors.startDate) {
        setErrors(prev => ({ ...prev, startDate: undefined }));
      }
      Logger.debug(MODULE, 'DATE_SELECTED', { startDate: formatDate(selected) });
    }
  }

  function onTimeChange(
      _: DateTimePickerEvent,
      selected?: Date,
    ) {
    setShowTimePicker(false);
  
    if (selected) {
      setTime(formatTime(selected));
      if (errors.time) {
        setErrors(prev => ({ ...prev, time: undefined }));
      }
      Logger.debug(MODULE, 'TIME_SELECTED', { time: formatTime(selected) });
    }
  }

  function buildRecurrence(): RecurrenceRule | undefined {
    if (!recurrenceUI.enabled) return undefined;

    const interval = Number(recurrenceUI.interval);
    if (!Number.isInteger(interval) || interval < 1) return undefined;

    const rule: RecurrenceRule = {
      frequency: recurrenceUI.frequency,
      interval,
      count: null,
      until: null,
      byWeekday: [],
      byMonthDay: [],
    };

    if (recurrenceUI.endMode === 'COUNT' && recurrenceUI.count) {
      const count = Number(recurrenceUI.count);
      if (Number.isInteger(count) && count > 0) {
        rule.count = count;
      }
    }

    if (recurrenceUI.endMode === 'UNTIL' && recurrenceUI.until) {
      rule.until = recurrenceUI.until;
    }

    if (recurrenceUI.frequency === Frequency.WEEKLY) {
      rule.byWeekday = recurrenceUI.byWeekday;
    }

    if (recurrenceUI.frequency === Frequency.MONTHLY) {
      rule.byMonthDay = recurrenceUI.byMonthDay;
    }

    Logger.trace(MODULE, 'BUILD_RECURRENCE', { recurrenceRule: rule });
    return rule;
  }

  async function save() {
    Logger.trace(MODULE, 'SAVE_START', { title, message, startDate, time });

    const recurrence = buildRecurrence();

    const draft: Reminder = {
      reminderId: 'DRAFT',
      category: 'ACTIVITY',
      title,
      message,
      startDate,
      time,
      recurrence,
      audioHash:'',
      audioFile:'',
      status: ReminderStatus.DRAFT,
      syncStatus: SyncStatus.NOT_SENT,
      revision: 0,
      createdAt: '',
      updatedAt: '',
    };

    const validationErrors = validateReminder(draft);
    const mapped = mapValidationErrors(validationErrors);
    setErrors(mapped);

    if (validationErrors.length > 0) {
      Logger.warn(MODULE, 'VALIDATION_FAILED', { errors: mapped });
      return;
    }

    try {
      await createReminderService({
        category: 'ACTIVITY',
        title,
        message,
        startDate,
        time,
        recurrence,
      });
      Logger.info(MODULE, 'SAVE_SUCCESS', { title, startDate, time });
      onBack();
    } catch (e) {
      Logger.error(MODULE, 'SAVE_FAILED', { error: e });
    }
  }

  return {
    form: { title, message, startDate, time },
    recurrenceUI,
    errors,
    handlers: {
      setTitle,
      setMessage,
      setStartDate,
      setTime,
      setRecurrenceUI,
      clearError: (k: keyof FieldErrors) =>
        setErrors(prev => ({ ...prev, [k]: undefined })),
    },
    pickers: {
      showDatePicker,
      showTimePicker,
      showUntilPicker,
      setShowDatePicker,
      setShowTimePicker,
      setShowUntilPicker,
      onDateChange,
      onTimeChange,
    },
    save,
  };
}