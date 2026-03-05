import React, { useState, useEffect } from 'react';
import { MainScreen } from './src/screens/MainScreen';
import { TtsFilesScreen } from './src/screens/TtsFilesScreen';
import { ReminderEditorScreen } from './src/screens/ReminderEditorScreen';
import { ReminderDetailScreen } from './src/screens/ReminderDetailScreen';
import { Reminder } from './src/domain/reminder';
import { Logger } from "./src/services/logger/logger";

export type AppRoute =
  | 'MAIN'
  | 'TTS_FILES'
  | 'REMINDER_EDITOR'
  | 'REMINDER_LIST'
  | 'REMINDER_DETAIL';

const MODULE = "APP_ROOT";

export default function App() {

  const [route, setRoute] = useState<AppRoute>('MAIN');
  const [selectedTtsPath, setSelectedTtsPath] = useState<string | null>(null);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);

  /** App bootstrap */
  useEffect(() => {

    Logger.info(MODULE, "APP_BOOTSTRAP_START");

    try {

      Logger.debug(MODULE, "APP_INITIAL_STATE", {
        route: "MAIN",
        selectedTtsPath: null,
        selectedReminder: null
      });

    } catch (error) {

      Logger.error(MODULE, "APP_BOOTSTRAP_LOG_ERROR", {
        message: error instanceof Error ? error.message : "unknown"
      });

    }

  }, []);

  /** Route change tracking */
  useEffect(() => {

    Logger.info(MODULE, "ROUTE_CHANGED", {
      route
    });

  }, [route]);

  /** TTS selection tracking */
  useEffect(() => {

    Logger.debug(MODULE, "TTS_SELECTION_UPDATED", {
      selectedTtsPath
    });

  }, [selectedTtsPath]);

  /** Reminder selection tracking */
  useEffect(() => {

    Logger.debug(MODULE, "REMINDER_SELECTION_UPDATED", {
      reminderId: selectedReminder?.reminderId ?? null
    });

  }, [selectedReminder]);

  /** Safe route setter with logs */
  const navigate = (nextRoute: AppRoute) => {

    Logger.trace(MODULE, "NAVIGATION_REQUESTED", {
      from: route,
      to: nextRoute
    });

    setRoute(nextRoute);

  };

  /** MAIN SCREEN */
  if (route === 'MAIN') {

    Logger.trace(MODULE, "RENDER_MAIN_SCREEN");

    return (
      <MainScreen
        selectedTtsPath={selectedTtsPath}

        onOpenFiles={() => {

          Logger.info(MODULE, "USER_OPEN_TTS_FILES");

          navigate('TTS_FILES');

        }}

        onCreateReminder={() => {

          Logger.info(MODULE, "USER_CREATE_REMINDER");

          navigate('REMINDER_EDITOR');

        }}

        onEditReminder={(r) => {

          Logger.info(MODULE, "USER_EDIT_REMINDER_REQUEST", {
            reminderId: r?.reminderId ?? null
          });

          if (!r) {

            Logger.warn(MODULE, "EDIT_REMINDER_NULL_OBJECT");

            return;
          }

          try {

            setSelectedReminder(r);

            Logger.debug(MODULE, "REMINDER_SELECTED_FOR_DETAIL", {
              reminderId: r.reminderId
            });

            navigate('REMINDER_DETAIL');

          } catch (error) {

            Logger.error(MODULE, "REMINDER_SELECTION_FAILED", {
              message: error instanceof Error ? error.message : "unknown"
            });

          }

        }}
      />
    );
  }

  /** REMINDER DETAIL SCREEN */
  if (route === 'REMINDER_DETAIL' && selectedReminder) {

    Logger.trace(MODULE, "RENDER_REMINDER_DETAIL_SCREEN", {
      reminderId: selectedReminder.reminderId
    });

    return (
      <ReminderDetailScreen
        reminder={selectedReminder}
        onBack={() => {

          Logger.info(MODULE, "USER_BACK_FROM_REMINDER_DETAIL", {
            reminderId: selectedReminder.reminderId
          });

          navigate('MAIN');

        }}
      />
    );
  }

  /** REMINDER DETAIL ERROR CASE */
  if (route === 'REMINDER_DETAIL' && !selectedReminder) {

    Logger.warn(MODULE, "REMINDER_DETAIL_WITH_NULL_REMINDER");

    navigate('MAIN');

  }

  /** REMINDER EDITOR SCREEN */
  if (route === 'REMINDER_EDITOR') {

    Logger.trace(MODULE, "RENDER_REMINDER_EDITOR_SCREEN");

    return (
      <ReminderEditorScreen
        onBack={() => {

          Logger.info(MODULE, "USER_EXIT_REMINDER_EDITOR");

          navigate('MAIN');

        }}
      />
    );
  }

  /** TTS FILES SCREEN (fallback route) */
  Logger.trace(MODULE, "RENDER_TTS_FILES_SCREEN");

  return (
    <TtsFilesScreen

      selectedTtsPath={selectedTtsPath}

      onSelectTts={(path) => {

        Logger.info(MODULE, "USER_SELECTED_TTS_FILE", {
          path
        });

        setSelectedTtsPath(path);

      }}

      onBack={() => {

        Logger.info(MODULE, "USER_BACK_FROM_TTS_FILES");

        navigate('MAIN');

      }}

    />
  );
}