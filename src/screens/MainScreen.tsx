import React, { useState, useEffect, useCallback } from 'react';
import {
  Text,
  StyleSheet,
  useColorScheme,
  View,
  Alert,
} from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressBar } from '../components/ProgressBar';
import { ReminderList } from '../components/reminder/ReminderList';

import { useBlePermissions } from '../hooks/useBlePermissions';
import { BleService } from '../services/ble/bleService';
import { getColors, getStateColor, getEspColor, getBleColor } from '../utils/colors';
import { syncWithEsp } from '../services/ble/syncWithEsp';
import { markAllRemindersSending, markAllRemindersSynced } from '../services/reminder/reminderRepository';
import { Reminder } from '../domain/reminder';
import { EspStatusMessage } from '../domain/espStatus';

import {
  SystemSnapshot,
  createInitialSystemSnapshot,
  computeGlobalSystemState,
} from '../domain/systemStatus';

import { Logger } from "../services/logger/logger";
import { exportLogsZip } from '../services/logger/logWriter';

const ble = new BleService();
const MODULE = "MAIN_SCREEN";

type Props = {
  selectedTtsPath: string | null;
  onOpenFiles: () => void;
  onCreateReminder: () => void;
  onEditReminder: (reminder: Reminder) => void;
};

export function MainScreen({
  // selectedTtsPath,
  // onOpenFiles,
  onCreateReminder,
  onEditReminder,
}: Props) {

  useEffect(() => {
    Logger.trace(MODULE, "SCREEN_RENDERED");
  });

  useBlePermissions();

  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const [snapshot, setSnapshot] = useState<SystemSnapshot>(
    createInitialSystemSnapshot(),
  );
  const [progress, setProgress] = useState(0);
  const globalState = computeGlobalSystemState(snapshot);
  const [titleTapCount, setTitleTapCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {

    Logger.info(MODULE, "SCREEN_MOUNTED");

    return () => {
      Logger.info(MODULE, "SCREEN_UNMOUNTED");
    };

  }, []);

  useEffect(() => {

    Logger.debug(MODULE, "SYSTEM_STATE_UPDATED", {
      ble: snapshot.ble,
      espState: snapshot.espState,
      globalState,
      hasBleError: !!snapshot.bleError,
      hasEspError: !!snapshot.lastEspError
    });

  }, [snapshot, globalState]);

  const systemLabel: Record<typeof globalState, string> = {
    offline: 'Offline',
    booting: 'Démarrage...',
    busy: 'En cours...',
    ready: 'Prêt',
    degraded: 'Problème détecté',
    error: 'Erreur',
  };

  /**
   * Apply ESP runtime messages to the system snapshot.
   */
  const applyEspMessage = useCallback((msg: EspStatusMessage) => {

    Logger.trace(MODULE, "ESP_MESSAGE_RECEIVED", {
      type: msg.type
    });

    setSnapshot(prev => {

      switch (msg.type) {

        case 'state':

          Logger.debug(MODULE, "ESP_STATE_UPDATE", {
            state: msg.state
          });

          return {
            ...prev,
            espState: msg.state,
            lastEspError:
              msg.state === 'error' ? prev.lastEspError : null,
            updatedAt: Date.now(),
          };

        case 'error':

          Logger.error(MODULE, "ESP_RUNTIME_ERROR", {
            code: msg.code,
            message: msg.message
          });

          return {
            ...prev,
            lastEspError: msg,
            updatedAt: Date.now(),
          };

        case 'telemetry':

          Logger.trace(MODULE, "ESP_TELEMETRY_UPDATE");

          return {
            ...prev,
            telemetry: msg,
            updatedAt: Date.now(),
          };

        case 'progress':

          Logger.trace(MODULE, "ESP_PROGRESS_EVENT");

          return prev;

        default:

          Logger.warn(MODULE, "UNKNOWN_ESP_MESSAGE");

          return prev;
      }
    });
  }, []);

  /**
   * Automatic BLE connection.
   */
  const connectBle = useCallback(
    async (fromUser: boolean = false) => {

      Logger.info(MODULE, "BLE_CONNECT_REQUEST", {
        fromUser
      });

      const bleState = ble.getBluetoothState();

      Logger.debug(MODULE, "BLE_ADAPTER_STATE", {
        state: bleState
      });

      if (
        fromUser &&
        bleState === 'PoweredOff'
      ) {

        Logger.warn(MODULE, "BLE_POWERED_OFF");

        Alert.alert(
          'Bluetooth désactivé',
          'Veuillez activer le Bluetooth dans les paramètres Android.',
        );

        return;
      }

      if (await ble.isDeviceConnected()) {

        Logger.info(MODULE, "BLE_ALREADY_CONNECTED");

        setSnapshot(s => ({
          ...s,
          ble: 'connected',
          espState: 'ready',
          lastEspError: null,
          bleError: null,
          updatedAt: Date.now(),
        }));

        return;
      }

      if (snapshot.ble === 'connecting') {

        Logger.debug(MODULE, "BLE_ALREADY_CONNECTING");

        return;
      }

      Logger.info(MODULE, "BLE_CONNECTING");

      setSnapshot(s => ({
        ...s,
        ble: 'connecting',
        bleError: null,
        updatedAt: Date.now(),
      }));

      try {

        Logger.debug(MODULE, "BLE_SCAN_START");

        const device = await ble.scanAndConnect();

        if (!device) {

          Logger.warn(MODULE, "BLE_DEVICE_NOT_FOUND");

          setSnapshot(s => ({
            ...s,
            ble: 'disconnected',
            updatedAt: Date.now(),
          }));

          return;
        }

        Logger.info(MODULE, "BLE_CONNECTED", {
          deviceId: device.id,
          deviceName: device.name
        });

        setSnapshot(s => ({
          ...s,
          ble: 'connected',
          espState: 'ready',
          lastEspError: null,
          bleError: null,
          updatedAt: Date.now(),
        }));

      } catch (caught: unknown) {

        const message =
          caught instanceof Error ? caught.message : String(caught);

        Logger.error(MODULE, "BLE_CONNECTION_FAILED", {
          message
        });

        setSnapshot(s => ({
          ...s,
          ble: 'disconnected',
          bleError: {
            code: 'DISCONNECTED',
            fatal: false,
            message,
          },
          updatedAt: Date.now(),
        }));
      }
  }, [snapshot.ble]);

  /**
   * Auto BLE connection lifecycle
   */
  useEffect(() => {

    Logger.trace(MODULE, "BLE_AUTOCONNECT_EFFECT");

    ble.onBleReady = () => {

      Logger.debug(MODULE, "BLE_READY_CALLBACK");

      connectBle(false);
    };

    if (snapshot.ble === 'disconnected' && !snapshot.bleError) {

      Logger.info(MODULE, "BLE_AUTOCONNECT_TRIGGER");

      connectBle(false);
    }

    return () => {

      Logger.trace(MODULE, "BLE_AUTOCONNECT_CLEANUP");

      ble.onBleReady = undefined;
    };

  }, [snapshot.ble, snapshot.bleError, connectBle]);

  const handleExportLogs = async () => {
    Alert.alert(
      "Exporter les logs",
      "Télécharger tous les logs de diagnostic ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Exporter",
          onPress: async () => {

            Logger.info(MODULE, "LOG_EXPORT_REQUESTED");

            const path = await exportLogsZip();

            if (!path) {

              Logger.warn(MODULE, "LOG_EXPORT_FAILED");

              Alert.alert(
                "Erreur",
                "Impossible d'exporter les logs"
              );

              return;
            }

            Logger.info(MODULE, "LOG_EXPORT_SUCCESS", {
              path
            });

            Alert.alert(
              "Logs exportés",
              `Fichier sauvegardé dans Downloads:\n${path}`
            );
          }
        }
      ]
    );
  };

  const handleTitlePress = () => {
    const newCount = titleTapCount + 1;
    if (newCount >= 5) {
      setTitleTapCount(0);
      handleExportLogs();
    } else {
      setTitleTapCount(newCount);
    }
  };

  /**
   * Synchronization
   */
  const handleSyncWithEsp = async () => {

    Logger.info(MODULE, "SYNC_REQUESTED");

    if (!(await ble.isDeviceConnected())) {

      Logger.warn(MODULE, "SYNC_ABORT_DEVICE_NOT_CONNECTED");

      Alert.alert(
        'MEMO non connecté',
        'Veuillez connecter MEMO avant la synchronisation.',
      );

      return;
    }

    try {

      const start = Date.now();
      Logger.info(MODULE, "SYNC_START");

      setProgress(0);
      await markAllRemindersSending();
      setRefreshKey(v => v + 1);

      await syncWithEsp({
        ble,
        setProgress,
        onEspMessage: applyEspMessage,
      });

      await markAllRemindersSynced();
      setRefreshKey(v => v + 1);

      Logger.info(MODULE, "SYNC_COMPLETED", {
        durationMs: Date.now() - start
      });

      Alert.alert("Succès", "La synchronisation des Reminders vers MEMO s'est déroulée avec succès");

    } catch (error) {

      Logger.error(MODULE, "SYNC_FAILED", {
        message: String(error)
      });

      Alert.alert('Error', String(error));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text
          style={[styles.title, { color: colors.text }]}
          onPress={handleTitlePress}
        >
          Memo Controller
        </Text>

        {/* Global state badge */}
        <View
          style={[
            styles.stateBadge,
            { backgroundColor: getStateColor(globalState) },
          ]}
        >
          <Text style={styles.stateBadgeText}>
            {systemLabel[globalState]}
          </Text>
        </View>

        {/* Technical line */}
        <View style={styles.techContainer}>

          <View style={styles.techItem}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: getBleColor(snapshot.ble) },
              ]}
            />
            <Text style={[styles.techLabel, { color: colors.text }]}>
              BLUETOOTH
            </Text>
            <Text style={[styles.techValue, { color: colors.text }]}>
              {snapshot.ble.toUpperCase()}
            </Text>
          </View>

          <View style={styles.techItem}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: getEspColor(snapshot.espState) },
              ]}
            />
            <Text style={[styles.techLabel, { color: colors.text }]}>
              MEMO
            </Text>
            <Text style={[styles.techValue, { color: colors.text }]}>
              {(snapshot.espState ?? 'idle').toUpperCase()}
            </Text>
          </View>

          {/* Error indicator */}
          {/* {(snapshot.lastEspError || snapshot.bleError) && (
            <View style={styles.errorBadge}>
              <Text style={styles.errorBadgeText}>
                ERROR
              </Text>
            </View>
          )} */}

        </View>

        {/* Activity indicator */}
        {globalState === 'busy' && (
          <View style={styles.headerProgress}>
            <ProgressBar
              progress={progress}
              height={6}
              backgroundColor={colors.inputBorder}
              fillColor={colors.accent}
            />
          </View>
        )}
      </View>

      {/* LIST */}
      <View style={styles.listContainer}>
        <ReminderList
          refreshKey={refreshKey}
          onSelect={(r) => {
            Logger.info(MODULE, "USER_SELECT_REMINDER", {
              reminderId: r.reminderId
            });

            onEditReminder(r);
          }}
        />
      </View>

      {/* FOOTER */}
      <View style={styles.footer}>

        <PrimaryButton
          title="Créer un reminder"
          onPress={() => {

            Logger.info(MODULE, "USER_CREATE_REMINDER");

            onCreateReminder();
          }}
          color={colors.accent}
          textColor={colors.buttonText}
        />

        <PrimaryButton
          title="Synchroniser"
          onPress={handleSyncWithEsp}
          color={colors.accent}
          textColor={colors.buttonText}
        />

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  info: {
    marginTop: 6,
    fontSize: 16,
    textAlign: 'center',
  },
  listContainer: {
    flex: 1,
    marginVertical: 10,
  },
  footer: {
    marginTop: 10,
  },
  debug: {
    paddingTop: 12,
  },
  stateBadge: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  stateBadgeText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  techLine: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  techText: {
    fontSize: 13,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E74C3C',
  },
  headerProgress: {
    marginTop: 8,
  },
  techContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 12,
},

techItem: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 16,
  backgroundColor: 'rgba(0,0,0,0.05)',
},

statusDot: {
  width: 8,
  height: 8,
  borderRadius: 4,
  marginRight: 6,
},

techLabel: {
  fontSize: 12,
  fontWeight: '600',
  marginRight: 4,
},

techValue: {
  fontSize: 12,
  fontWeight: '500',
},

errorBadge: {
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 14,
  backgroundColor: '#E74C3C',
},

errorBadgeText: {
  color: '#FFFFFF',
  fontSize: 11,
  fontWeight: '700',
},
});