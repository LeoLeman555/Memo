import { NativeModules, Platform } from "react-native";
import { Logger } from "../logger/logger";

const { AndroidTts } = NativeModules;

const MODULE = "TTS_SERVICE";

/**
 * Result returned by native Android TTS generation.
 */
export interface TtsAudioResult {
  path: string;
  filename: string;
  format: "wav" | "mp3";
  size: number;
}

/**
 * TTS service (JS facade).
 *
 * Responsibilities:
 * - Validate JS-side inputs.
 * - Call native AndroidTts module.
 * - Provide structured logs for debugging.
 *
 * Limitations:
 * - Android only.
 */
export class TtsService {

  private static ensureAndroid(): void {

    if (Platform.OS !== "android") {

      Logger.error(MODULE, "PLATFORM_NOT_SUPPORTED", {
        platform: Platform.OS
      });

      throw new Error("[TTS][PLATFORM_ERROR] Only Android supported");
    }

    if (!AndroidTts) {

      Logger.fatal(MODULE, "NATIVE_MODULE_MISSING");

      throw new Error("[TTS][MODULE_MISSING] AndroidTts module not available");
    }
  }

  /**
   * Generate an audio file from text using native Android TTS.
   */
  static async generate(
    text: string,
    filename: string
  ): Promise<TtsAudioResult> {

    this.ensureAndroid();

    Logger.info(MODULE, "TTS_GENERATE_REQUEST", {
      filename,
      textLength: text?.length ?? 0
    });

    if (!text || text.trim().length === 0) {

      Logger.warn(MODULE, "INVALID_TEXT_INPUT");

      throw new Error("[TTS][INVALID_TEXT] Text is empty");
    }

    if (!filename.endsWith(".wav") && !filename.endsWith(".mp3")) {

      Logger.warn(MODULE, "INVALID_FILENAME_EXTENSION", {
        filename
      });

      throw new Error("[TTS][INVALID_FILENAME] Must end with .wav or .mp3");
    }

    const start = Date.now();

    try {

      Logger.debug(MODULE, "NATIVE_TTS_CALL");

      const result: TtsAudioResult =
        await AndroidTts.generate(text, filename);

      if (!result?.path || !result?.format) {

        Logger.error(MODULE, "INVALID_NATIVE_RESULT");

        throw new Error("[TTS][INVALID_NATIVE_RESULT]");
      }

      if (!filename.endsWith(`.${result.format}`)) {

        Logger.error(MODULE, "FORMAT_MISMATCH", {
          filename,
          returnedFormat: result.format
        });

        throw new Error(
          `[TTS][FORMAT_MISMATCH] expected ${filename} but got .${result.format}`
        );
      }

      Logger.info(MODULE, "TTS_GENERATE_SUCCESS", {
        filename: result.filename,
        format: result.format,
        size: result.size,
        durationMs: Date.now() - start
      });

      return result;

    } catch (caught: unknown) {

      const message =
        caught instanceof Error ? caught.message : String(caught);

      Logger.error(MODULE, "TTS_GENERATE_FAILED", {
        filename,
        message
      });

      throw caught;
    }
  }

  /**
   * Play a local audio file (debug only).
   */
  static async play(internalPath: string): Promise<void> {

    this.ensureAndroid();

    Logger.info(MODULE, "TTS_PLAY_REQUEST", {
      path: internalPath
    });

    if (!internalPath || internalPath.length === 0) {

      Logger.warn(MODULE, "INVALID_AUDIO_PATH");

      throw new Error("[TTS][INVALID_PATH]");
    }

    try {

      await AndroidTts.play(internalPath);

      Logger.debug(MODULE, "TTS_PLAY_STARTED", {
        path: internalPath
      });

    } catch (caught: unknown) {

      const message =
        caught instanceof Error ? caught.message : String(caught);

      Logger.error(MODULE, "TTS_PLAY_FAILED", {
        path: internalPath,
        message
      });

      throw caught;
    }
  }

  /**
   * Export a local audio file to public Music directory.
   */
  static async exportToMusic(
    internalPath: string,
    publicFilename: string
  ): Promise<string> {

    this.ensureAndroid();

    Logger.info(MODULE, "TTS_EXPORT_REQUEST", {
      filename: publicFilename
    });

    if (
      !publicFilename.endsWith(".wav") &&
      !publicFilename.endsWith(".mp3")
    ) {

      Logger.warn(MODULE, "INVALID_EXPORT_FILENAME", {
        filename: publicFilename
      });

      throw new Error("[TTS][INVALID_FILENAME] Must end with .wav or .mp3");
    }

    const start = Date.now();

    try {

      const uri: string =
        await AndroidTts.exportToMusic(internalPath, publicFilename);

      Logger.info(MODULE, "TTS_EXPORT_SUCCESS", {
        filename: publicFilename,
        uri,
        durationMs: Date.now() - start
      });

      return uri;

    } catch (caught: unknown) {

      const message =
        caught instanceof Error ? caught.message : String(caught);

      Logger.error(MODULE, "TTS_EXPORT_FAILED", {
        filename: publicFilename,
        message
      });

      throw caught;
    }
  }
}