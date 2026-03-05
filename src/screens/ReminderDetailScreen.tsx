import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  ScrollView,
  Alert,
  Pressable,
} from 'react-native';
import RNFS from 'react-native-fs';

import { Reminder } from '../domain/reminder';
import { PrimaryButton } from '../components/PrimaryButton';
import { getColors } from '../utils/colors';
import { formatDateHuman } from '../utils/dateFormat';
import { formatRecurrenceHuman, formatSyncStatus } from '../utils/recurrenceFormat';
import { deleteReminderService } from '../services/reminder/reminderDeletionService';
import { TtsService } from '../services/tts/ttsService';
import { Logger } from '../services/logger/logger';

const MODULE = "REMINDER_DETAIL_SCREEN";

type Props = {
  reminder: Reminder;
  onBack: () => void;
};

export function ReminderDetailScreen({ reminder, onBack }: Props) {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const handleDeleteReminder = (): void => {
    Logger.trace(MODULE, "DELETE_REQUEST_INITIATED", { reminderId: reminder.reminderId });

    Alert.alert(
      'Supprimer le reminder',
      'Cette action est définitive.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteReminderService(reminder.reminderId);
              Logger.info(MODULE, "REMINDER_DELETED", { reminderId: reminder.reminderId });
              onBack();
            } catch (error) {
              Logger.error(MODULE, "DELETE_FAILED", { reminderId: reminder.reminderId, error });
              Alert.alert(
                'Erreur',
                'Impossible de supprimer le reminder.',
              );
            }
          },
        },
      ],
    );
  };

  const handlePlayAudio = async (): Promise<void> => {
    if (!reminder.audioFile) {
      Logger.warn(MODULE, "PLAY_AUDIO_UNAVAILABLE", { reminderId: reminder.reminderId });
      Alert.alert('Audio indisponible', 'Aucun audio associé à ce reminder.');
      return;
    }

    const audioPath = `${RNFS.DocumentDirectoryPath}/tts/${reminder.audioFile}`;

    Logger.debug(MODULE, "PLAY_AUDIO_REQUEST", { reminderId: reminder.reminderId, path: audioPath });

    try {
      await TtsService.play(audioPath);
      Logger.info(MODULE, "AUDIO_PLAY_STARTED", { reminderId: reminder.reminderId });
    } catch (error) {
      Logger.error(MODULE, "PLAY_AUDIO_ERROR", { reminderId: reminder.reminderId, error });
      Alert.alert('Erreur audio', 'Impossible de lire le message.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.text }]}>
            {reminder.title}
          </Text>
          <View
            style={[
              styles.titleUnderline,
              { backgroundColor: colors.accent },
            ]}
          />
        </View>


        {/* Date & Time */}
        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: colors.text }]}>
            {reminder.startDate}
          </Text>
          <Text style={[styles.metaSeparator, { color: colors.text }]}>•</Text>
          <Text style={[styles.metaText, { color: colors.text }]}>
            {reminder.time}
          </Text>
        </View>

        {/* Recurrence */}
        <View style={[styles.card, { borderColor: colors.inputBorder }]}>
          <Text style={[styles.cardLabel, { color: colors.text }]}>
            Répétition
          </Text>
          <Text style={[styles.cardValue, { color: colors.text }]}>
            {reminder.recurrence
              ? formatRecurrenceHuman(reminder.recurrence)
              : 'Une seule fois'}
          </Text>
        </View>

        {/* Message */}
        <Pressable
          onPress={reminder.audioFile ? handlePlayAudio : undefined}
          style={({ pressed }) => [
            { opacity: pressed ? 0.96 : 1 },
          ]}
        >
          <View style={[styles.card, { borderColor: colors.inputBorder }]}>
            <Text style={[styles.cardLabel, { color: colors.text }]}>
              Message
            </Text>

            <Text style={[styles.message, { color: colors.text }]}>
              {reminder.message}
            </Text>

            {reminder.audioFile && (
              <Text style={[styles.audioHint, { color: colors.accent }]}>
                ▶︎
              </Text>
            )}
          </View>
        </Pressable>




        {/* Secondary info */}
        <View style={[styles.card, { borderColor: colors.inputBorder }]}>
          <Text style={[styles.cardLabel, { color: colors.text }]}>
            Informations
          </Text>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.text }]}>
              Catégorie
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {reminder.category}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.text }]}>
              Synchronisation
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {formatSyncStatus(reminder.syncStatus)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.text }]}>
              Créé le
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {formatDateHuman(reminder.createdAt)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.text }]}>
              Modifié le
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {formatDateHuman(reminder.updatedAt)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <PrimaryButton
          title="Supprimer"
          onPress={handleDeleteReminder}
          color={colors.accent}
          textColor={colors.buttonText}
        />

        <PrimaryButton
          title="Retour"
          onPress={onBack}
          color={colors.inputBorder}
          textColor={colors.text}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  content: {
    padding: 20,
    paddingBottom: 10,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },

  metaText: {
    fontSize: 25,
    fontWeight: '500',
  },

  metaSeparator: {
    marginHorizontal: 8,
    opacity: 0.6,
  },

  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },

  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.7,
    marginBottom: 8,
  },

  cardValue: {
    fontSize: 16,
    fontWeight: '500',
  },

  message: {
    fontSize: 16,
    lineHeight: 22,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  infoLabel: {
    fontSize: 14,
    opacity: 0.7,
  },

  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },

  footer: {
    padding: 20,
    paddingTop: 0,
  },

    titleContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },

  titleUnderline: {
    height: 3,
    width: 100,
    borderRadius: 2,
  },
  audioHint: {
    position: 'absolute',
    bottom: 8,
    right: 10,
    fontSize: 50,
  },

});