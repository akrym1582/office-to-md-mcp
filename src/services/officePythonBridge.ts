import { execCommand } from "../utils/exec.js";
import { AppError, ErrorCode } from "../types/errors.js";
import { logger } from "../utils/logger.js";

export interface PythonBridgeResult {
  ok: boolean;
  pdfPath?: string;
  renderStrategy?: string;
  sheetCount?: number;
  error?: {
    code: string;
    message: string;
  };
}

export async function convertExcelToPdfViaPython(
  inputPath: string,
  outputPath: string,
  pythonPath: string,
  unoHelperPath: string,
  sheetNames?: string[],
  timeoutMs = 180_000
): Promise<PythonBridgeResult> {
  logger.info("Converting Excel to PDF via Python UNO helper", { inputPath, outputPath });

  const args = [unoHelperPath, "--input", inputPath, "--output", outputPath, "--json"];

  if (sheetNames && sheetNames.length > 0) {
    for (const name of sheetNames) {
      args.push("--sheet", name);
    }
  }

  const result = await execCommand(pythonPath, args, { timeoutMs }).catch((err) => {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new AppError(ErrorCode.PYTHON_NOT_FOUND, `Python interpreter not found: ${pythonPath}`);
    }
    throw err;
  });

  logger.debug("Python UNO helper output", { stdout: result.stdout, stderr: result.stderr });

  let parsed: PythonBridgeResult;
  try {
    parsed = JSON.parse(result.stdout.trim()) as PythonBridgeResult;
  } catch {
    throw new AppError(ErrorCode.LIBREOFFICE_UNO_CONVERSION_FAILED, "Python UNO helper returned invalid JSON", {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    });
  }

  if (!parsed.ok) {
    throw new AppError(
      ErrorCode.LIBREOFFICE_UNO_CONVERSION_FAILED,
      parsed.error?.message ?? "Python UNO conversion failed",
      { errorCode: parsed.error?.code }
    );
  }

  return parsed;
}
