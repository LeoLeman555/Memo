import React from 'react';
import { View, Text, StyleSheet, useColorScheme, FlatList } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { ReminderForm } from '../components/reminder/ReminderForm';
import { useReminderEditor } from '../hooks/useReminderEditor';
import { getColors } from '../utils/colors';
import { Logger } from '../services/logger/logger';

const MODULE = "REMINDER_EDITOR_SCREEN";

type Props = {
  onBack: () => void;
};

export function ReminderEditorScreen({ onBack }: Props) {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const editor = useReminderEditor(onBack);

  const handleSave = async () => {
    Logger.trace(MODULE, "SAVE_INITIATED");
    try {
      await editor.save();
      Logger.info(MODULE, "SAVE_SUCCESS");
    } catch (error) {
      Logger.error(MODULE, "SAVE_FAILED", { error });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        Nouveau reminder
      </Text>

      <FlatList
        data={[{ key: 'form' }]}
        keyExtractor={item => item.key}
        renderItem={() => (
          <ReminderForm
            colors={colors}
            form={editor.form}
            recurrenceUI={editor.recurrenceUI}
            errors={editor.errors}
            handlers={editor.handlers}
            pickers={editor.pickers}
          />
        )}
        contentContainerStyle={{ paddingBottom: 30 }}
      />

      <PrimaryButton
        title="Enregistrer"
        onPress={handleSave}
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
});