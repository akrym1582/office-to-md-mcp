import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { removeDir, removeFile } from "../utils/fs.js";
import { logger } from "../utils/logger.js";

const trackedDirs: Set<string> = new Set();
const trackedFiles: Set<string> = new Set();

export async function createTempDir(prefix = "office-to-md-"): Promise<string> {
  const base = os.tmpdir();
  const dir = await fs.promises.mkdtemp(path.join(base, prefix));
  trackedDirs.add(dir);
  return dir;
}

export function trackFile(filePath: string): void {
  trackedFiles.add(filePath);
}

export async function cleanupTempDir(dir: string): Promise<void> {
  trackedDirs.delete(dir);
  await removeDir(dir);
  logger.debug(`Cleaned up temp dir: ${dir}`);
}

export async function cleanupFile(filePath: string): Promise<void> {
  trackedFiles.delete(filePath);
  await removeFile(filePath);
}

export async function cleanupAll(): Promise<void> {
  for (const dir of trackedDirs) {
    await removeDir(dir);
  }
  trackedDirs.clear();
  for (const file of trackedFiles) {
    await removeFile(file);
  }
  trackedFiles.clear();
}
