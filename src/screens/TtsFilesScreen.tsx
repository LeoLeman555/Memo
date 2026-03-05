import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  useColorScheme,
} from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { getColors } from '../utils/colors';
import { listTtsAudioFiles } from '../services/tts/ttsFileSystem';
import { Logger } from '../services/logger/logger';

const MODULE = 'TTS_FILES_SCREEN';

type Props = {
  selectedTtsPath: string | null;
  onSelectTts: (path: string) => void;
  onBack: () => void;
};

export function TtsFilesScreen({
  selectedTtsPath,
  onSelectTts,
  onBack,
}: Props) {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    Logger.trace(MODULE, 'LOAD_TTS_FILES_START');
    listTtsAudioFiles()
      .then(f => {
        setFiles(f);
        Logger.info(MODULE, 'LOAD_TTS_FILES_SUCCESS', { count: f.length });
      })
      .catch(err => {
        Logger.error(MODULE, 'LOAD_TTS_FILES_FAILED', { error: err });
      });
  }, []);

  const handleSelect = (path: string) => {
    Logger.debug(MODULE, 'TTS_FILE_SELECTED', { path });
    onSelectTts(path);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        Fichiers TTS
      </Text>

      <FlatList
        data={files}
        keyExtractor={item => item}
        ListEmptyComponent={
          <Text style={{ color: colors.text, textAlign: 'center' }}>
            Aucun fichier audio généré
          </Text>
        }
        renderItem={({ item }) => {
          const name = item.split('/').pop() ?? item;
          const isSelected = selectedTtsPath === item;
          const isWav = name.endsWith('.wav');

          return (
            <Pressable
              onPress={() => handleSelect(item)}
              style={{
                padding: 14,
                borderRadius: 8,
                marginBottom: 8,
                backgroundColor: isSelected
                  ? colors.accent
                  : colors.inputBorder,
              }}
            >
              <Text
                style={{
                  color: isSelected
                    ? colors.buttonText
                    : colors.text,
                  fontWeight: isWav ? '700' : '500',
                }}
              >
                {name} {isWav ? '(WAV)' : '(MP3)'}
              </Text>
            </Pressable>
          );
        }}
      />

      <PrimaryButton
        title="Retour"
        onPress={onBack}
        color={colors.accent}
        textColor={colors.buttonText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
});