import { spawn } from "child_process";
import { AppError, ErrorCode } from "../types/errors.js";
import { logger } from "./logger.js";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ExecOptions {
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

export async function execCommand(
  command: string,
  args: string[],
  options: ExecOptions = {}
): Promise<ExecResult> {
  const { timeoutMs = 120_000, env, cwd } = options;

  return new Promise((resolve, reject) => {
    logger.debug(`Executing command: ${command}`, { args });

    const child = spawn(command, args, {
      env: env ?? process.env,
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(
          new AppError(
            ErrorCode.PDF_RENDER_FAILED,
            `Command timed out after ${timeoutMs}ms: ${command} ${args.join(" ")}`
          )
        );
        return;
      }
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
