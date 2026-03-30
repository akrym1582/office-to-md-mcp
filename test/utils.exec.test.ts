import { EventEmitter } from "events";
import { AppError, ErrorCode } from "../src/types/errors.js";

const spawnMock = jest.fn();

jest.mock("child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

function createChildProcessMock() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: jest.Mock;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = jest.fn();
  return child;
}

describe("execCommand", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("spawns a process and captures stdout/stderr", async () => {
    const child = createChildProcessMock();
    spawnMock.mockReturnValue(child);

    const { execCommand } = await import("../src/utils/exec.js");
    const promise = execCommand("python3", ["--version"], { cwd: "/tmp/work", timeoutMs: 1000 });

    child.stdout.emit("data", Buffer.from("Python "));
    child.stderr.emit("data", Buffer.from("warning"));
    child.stdout.emit("data", Buffer.from("3.12"));
    child.emit("close", 0);

    await expect(promise).resolves.toEqual({
      stdout: "Python 3.12",
      stderr: "warning",
      exitCode: 0,
    });
    expect(spawnMock).toHaveBeenCalledWith(
      "python3",
      ["--version"],
      expect.objectContaining({
        cwd: "/tmp/work",
        stdio: ["ignore", "pipe", "pipe"],
      })
    );
  });

  it("rejects with a timeout AppError when the command exceeds timeoutMs", async () => {
    jest.useFakeTimers();
    const child = createChildProcessMock();
    spawnMock.mockReturnValue(child);

    const { execCommand } = await import("../src/utils/exec.js");
    const promise = execCommand("convert", ["input.pdf"], { timeoutMs: 5 });

    jest.advanceTimersByTime(5);
    child.emit("close", null);

    await expect(promise).rejects.toMatchObject({
      code: ErrorCode.PDF_RENDER_FAILED,
      message: expect.stringContaining("Command timed out after 5ms"),
    } as Partial<AppError>);
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
    jest.useRealTimers();
  });

  it("rejects when spawn emits an error", async () => {
    const child = createChildProcessMock();
    const spawnError = new Error("spawn failed");
    spawnMock.mockReturnValue(child);

    const { execCommand } = await import("../src/utils/exec.js");
    const promise = execCommand("bad-command", []);

    child.emit("error", spawnError);

    await expect(promise).rejects.toBe(spawnError);
  });
});
