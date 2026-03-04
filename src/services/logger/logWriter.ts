import RNFS from "react-native-fs";

const LOG_DIR = `${RNFS.DocumentDirectoryPath}/logs`;
const LOG_FILE = `${LOG_DIR}/app.log`;

let initialized = false;

/** Ensure the log directory and file exist */
async function ensureInitialized(): Promise<void> {

  if (initialized) {
    return;
  }

  try {

    const dirExists = await RNFS.exists(LOG_DIR);

    if (!dirExists) {
      await RNFS.mkdir(LOG_DIR);
    }

    const fileExists = await RNFS.exists(LOG_FILE);

    if (!fileExists) {
      await RNFS.writeFile(LOG_FILE, "", "utf8");
    }

    initialized = true;

  } catch {
    // Never propagate errors from logging
  }
}

/** Append a line to the log file */
export async function writeLog(line: string): Promise<void> {

  try {

    await ensureInitialized();

    await RNFS.appendFile(
      LOG_FILE,
      line + "\n",
      "utf8"
    );

  } catch {
    // Logging must never break the application
  }

}

/** Read the entire log file */
export async function readLogs(): Promise<string | null> {

  try {

    const exists = await RNFS.exists(LOG_FILE);

    if (!exists) {
      return null;
    }

    return await RNFS.readFile(LOG_FILE, "utf8");

  } catch {
    return null;
  }

}

/** Return log file path (useful for export) */
export function getLogFilePath(): string {
  return LOG_FILE;
}