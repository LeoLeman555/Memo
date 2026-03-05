import RNFS from "react-native-fs";
import { Logger } from "../logger/logger";

const MODULE = "TTS_FILESYSTEM";

const TTS_DIR = `${RNFS.DocumentDirectoryPath}/tts`;

/**
 * Return the list of generated TTS audio files.
 * Supported formats: .wav, .mp3
 */
export async function listTtsAudioFiles(): Promise<string[]> {

  Logger.trace(MODULE, "LIST_TTS_FILES_REQUEST");

  try {

    const exists = await RNFS.exists(TTS_DIR);

    if (!exists) {

      Logger.debug(MODULE, "TTS_DIRECTORY_MISSING", {
        path: TTS_DIR
      });

      return [];
    }

    const files = await RNFS.readDir(TTS_DIR);

    const result = files
      .filter(
        f =>
          f.isFile() &&
          (f.name.endsWith(".wav") || f.name.endsWith(".mp3"))
      )
      .map(f => f.path)
      .sort();

    Logger.debug(MODULE, "TTS_FILES_LISTED", {
      count: result.length
    });

    return result;

  } catch (caught: unknown) {

    const message =
      caught instanceof Error ? caught.message : String(caught);

    Logger.error(MODULE, "LIST_TTS_FILES_FAILED", {
      message
    });

    throw caught;
  }
}

/**
 * Ensure TTS directory exists.
 */
export async function ensureTtsDir(): Promise<void> {

  Logger.trace(MODULE, "ENSURE_TTS_DIR");

  try {

    const exists = await RNFS.exists(TTS_DIR);

    if (!exists) {

      Logger.info(MODULE, "CREATE_TTS_DIRECTORY", {
        path: TTS_DIR
      });

      await RNFS.mkdir(TTS_DIR);
    }

  } catch (caught: unknown) {

    const message =
      caught instanceof Error ? caught.message : String(caught);

    Logger.error(MODULE, "CREATE_TTS_DIRECTORY_FAILED", {
      path: TTS_DIR,
      message
    });

    throw caught;
  }
}

/**
 * Build full path for a TTS file.
 */
export function buildTtsFilePath(
  audioHash: string,
  extension: ".wav" | ".mp3" = ".wav"
): string {

  const path = `${TTS_DIR}/${audioHash}${extension}`;

  Logger.trace(MODULE, "BUILD_TTS_FILE_PATH", {
    audioHash,
    extension
  });

  return path;
}