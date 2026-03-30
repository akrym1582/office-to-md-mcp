import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  basename,
  ensureDir,
  fileExists,
  listFiles,
  readFileText,
  removeDir,
  removeFile,
} from "../src/utils/fs.js";
import {
  cleanupAll,
  cleanupFile,
  cleanupTempDir,
  createTempDir,
  trackFile,
} from "../src/services/tempFiles.js";

describe("fs helpers", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "office-to-md-fs-test-"));
  });

  afterEach(async () => {
    await fs.promises.rm(rootDir, { recursive: true, force: true });
    await cleanupAll();
  });

  it("creates directories, reads files, lists filtered files, and derives basenames", async () => {
    const nestedDir = path.join(rootDir, "nested");
    await ensureDir(nestedDir);
    await fs.promises.writeFile(path.join(nestedDir, "b.txt"), "bravo", "utf8");
    await fs.promises.writeFile(path.join(nestedDir, "a.txt"), "alpha", "utf8");
    await fs.promises.writeFile(path.join(nestedDir, "c.md"), "charlie", "utf8");

    await expect(fileExists(nestedDir)).resolves.toBe(true);
    await expect(readFileText(path.join(nestedDir, "a.txt"))).resolves.toBe("alpha");
    await expect(listFiles(nestedDir, ".txt")).resolves.toEqual([
      path.join(nestedDir, "a.txt"),
      path.join(nestedDir, "b.txt"),
    ]);
    expect(basename("/tmp/example.docx")).toBe("example");
  });

  it("removes files and directories without throwing when paths are missing", async () => {
    const nestedDir = path.join(rootDir, "to-remove");
    const filePath = path.join(rootDir, "sample.txt");
    await ensureDir(nestedDir);
    await fs.promises.writeFile(filePath, "sample", "utf8");

    await removeFile(filePath);
    await removeDir(nestedDir);
    await removeFile(filePath);
    await removeDir(nestedDir);

    await expect(fileExists(filePath)).resolves.toBe(false);
    await expect(fileExists(nestedDir)).resolves.toBe(false);
  });
});

describe("temp file helpers", () => {
  afterEach(async () => {
    await cleanupAll();
  });

  it("creates and cleans up tracked temp directories and files", async () => {
    const dir = await createTempDir("office-to-md-temp-");
    const filePath = path.join(dir, "tracked.txt");

    await fs.promises.writeFile(filePath, "tracked", "utf8");
    trackFile(filePath);

    await cleanupFile(filePath);
    await cleanupTempDir(dir);

    await expect(fileExists(filePath)).resolves.toBe(false);
    await expect(fileExists(dir)).resolves.toBe(false);
  });

  it("cleanupAll removes everything that is still tracked", async () => {
    const dir = await createTempDir("office-to-md-temp-all-");
    const filePath = path.join(dir, "tracked.txt");
    await fs.promises.writeFile(filePath, "tracked", "utf8");
    trackFile(filePath);

    await cleanupAll();

    await expect(fileExists(filePath)).resolves.toBe(false);
    await expect(fileExists(dir)).resolves.toBe(false);
  });
});

describe("logger", () => {
  const originalLogLevel = process.env.LOG_LEVEL;

  afterEach(() => {
    process.env.LOG_LEVEL = originalLogLevel;
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it("respects LOG_LEVEL and writes formatted messages to stderr", async () => {
    process.env.LOG_LEVEL = "warn";
    const stderrSpy = jest.spyOn(process.stderr, "write").mockReturnValue(true);
    jest.resetModules();

    const { logger } = await import("../src/utils/logger.js");

    logger.debug("hidden");
    logger.error("visible", { reason: "boom" });

    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(stderrSpy).toHaveBeenCalledWith('[ERROR] visible {"reason":"boom"}\n');
  });
});
