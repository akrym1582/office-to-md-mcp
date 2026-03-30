import * as fs from "fs";
import * as path from "path";

export async function ensureDir(dir: string): Promise<void> {
  await fs.promises.mkdir(dir, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readFileText(filePath: string): Promise<string> {
  return fs.promises.readFile(filePath, "utf8");
}

export async function listFiles(dir: string, ext?: string): Promise<string[]> {
  const entries = await fs.promises.readdir(dir);
  const files = entries
    .filter((e) => !ext || e.endsWith(ext))
    .map((e) => path.join(dir, e))
    .sort();
  return files;
}

export async function removeFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // ignore
  }
}

export async function removeDir(dir: string): Promise<void> {
  try {
    await fs.promises.rm(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

export function basename(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}
