import RNFS from 'react-native-fs';
import { TtsService } from '../tts/ttsService';
import { computeAudioHash } from '../../utils/audioHash';
import { Logger } from '../logger/logger';

const MODULE = "REMINDER_AUDIO";
const TTS_DIR = `${RNFS.DocumentDirectoryPath}/tts`;

export interface GeneratedAudio {
  audioHash: string;
  audioFile: string;
}

/**
 * Generate (or reuse) a TTS audio file for a reminder message.
 */
export async function generateReminderAudio(
  message: string,
): Promise<GeneratedAudio> {

  Logger.trace(MODULE, "GENERATE_AUDIO_REQUEST", { messageLength: message.length });

  if (!message || message.trim().length === 0) {
    Logger.error(MODULE, "INVALID_MESSAGE", { message });
    throw new Error('[AUDIO][INVALID_MESSAGE]');
  }

  const audioHash = computeAudioHash(message);
  const audioFile = `${audioHash}.wav`;
  const audioPath = `${TTS_DIR}/${audioFile}`;

  Logger.debug(MODULE, "COMPUTED_AUDIO_HASH", { audioHash, audioFile });

  try {
    const exists = await RNFS.exists(audioPath);

    if (exists) {
      Logger.info(MODULE, "AUDIO_ALREADY_EXISTS", { audioFile });
      return { audioHash, audioFile };
    }

    Logger.debug(MODULE, "AUDIO_NOT_FOUND_CREATING", { audioFile });

    const dirExists = await RNFS.exists(TTS_DIR);
    if (!dirExists) {
      await RNFS.mkdir(TTS_DIR);
      Logger.info(MODULE, "TTS_DIR_CREATED", { path: TTS_DIR });
    }

    const ttsResult = await TtsService.generate(message, audioFile);

    Logger.info(MODULE, "AUDIO_GENERATED", {
      ttsPath: ttsResult.path,
      format: ttsResult.format,
      size: ttsResult.size,
    });

    if (ttsResult.path !== audioPath) {
      await RNFS.moveFile(ttsResult.path, audioPath);
      Logger.debug(MODULE, "AUDIO_MOVED_TO_TTS_DIR", { targetPath: audioPath });
    }

    return { audioHash, audioFile };

  } catch (error: any) {
    Logger.error(MODULE, "AUDIO_GENERATION_FAILED", { message: error?.message ?? String(error) });
    throw error;
  }
}