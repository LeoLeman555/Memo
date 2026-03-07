import RNFS from "react-native-fs";
import { zip } from "react-native-zip-archive";

const LOG_DIR = `${RNFS.DocumentDirectoryPath}/logs`;

let initialized = false;

/** Return log filename for current day */
function getTodayLogFile(): string {

  const today = new Date().toISOString().slice(0, 10);
  return `${LOG_DIR}/app-${today}.log`;

}

/** Ensure the log directory exists */
async function ensureInitialized(): Promise<void> {

  if (initialized) {
    return;
  }

  try {

    const dirExists = await RNFS.exists(LOG_DIR);

    if (!dirExists) {
      await RNFS.mkdir(LOG_DIR);
    }

    initialized = true;

  } catch {
    // Never propagate errors from logging
  }
}

/** Append a line to today's log file */
export async function writeLog(line: string): Promise<void> {

  try {

    await ensureInitialized();

    const file = getTodayLogFile();

    const exists = await RNFS.exists(file);

    if (!exists) {
      await RNFS.writeFile(file, "", "utf8");
    }

    await RNFS.appendFile(
      file,
      line + "\n",
      "utf8"
    );

  } catch {
    // Logging must never break the application
  }

}

/** Read today's logs */
export async function readTodayLogs(): Promise<string | null> {

  try {

    const file = getTodayLogFile();

    const exists = await RNFS.exists(file);

    if (!exists) {
      return null;
    }

    return await RNFS.readFile(file, "utf8");

  } catch {
    return null;
  }

}

/** Read all logs across all days */
export async function readAllLogs(): Promise<string | null> {

  try {

    await ensureInitialized();

    const files = await RNFS.readDir(LOG_DIR);

    let combined = "";

    for (const file of files) {

      if (file.name.endsWith(".log")) {

        const content = await RNFS.readFile(file.path, "utf8");

        combined += content + "\n";

      }

    }

    return combined || null;

  } catch {
    return null;
  }

}

/** Export all logs to a single file */
export async function exportLogs(): Promise<string | null> {

  try {

    const logs = await readAllLogs();

    if (!logs) {
      return null;
    }

    const exportPath = `${LOG_DIR}/export_logs.txt`;

    await RNFS.writeFile(
      exportPath,
      logs,
      "utf8"
    );

    return exportPath;

  } catch {
    return null;
  }

}

/** Return all log files paths */
export async function getAllLogFiles(): Promise<string[]> {

  try {

    await ensureInitialized();

    const files = await RNFS.readDir(LOG_DIR);

    return files
      .filter(f => f.name.endsWith(".log"))
      .map(f => f.path);

  } catch {

    return [];
  }

}

/** Export all logs into a zip file inside the user Download folder */
export async function exportLogsZip(): Promise<string | null> {
  
  try {
    const EXPORT_NAME = `memo_logs_${Date.now()}.zip`;
    const logDir = getLogsDirectory();
    const logFiles = await getAllLogFiles();

    if (logFiles.length === 0) {
      return null;
    }

    const tempZipPath = `${RNFS.CachesDirectoryPath}/${EXPORT_NAME}`;
    await zip(logDir, tempZipPath);
    const downloadPath = `${RNFS.DownloadDirectoryPath}/${EXPORT_NAME}`;
    await RNFS.copyFile(tempZipPath, downloadPath);

    return downloadPath;

  } catch {
    return null;
  }
}

/** Return logs directory path */
export function getLogsDirectory(): string {
  return LOG_DIR;
}