import * as path from "path";
import { execCommand } from "../utils/exec.js";
import { fileExists, listFiles } from "../utils/fs.js";
import { AppError, ErrorCode } from "../types/errors.js";
import { logger } from "../utils/logger.js";

export async function convertToPdfWithLibreOffice(
  inputPath: string,
  outputDir: string,
  libreOfficePath = "soffice",
  timeoutMs = 120_000
): Promise<string> {
  logger.info("Converting document to PDF with LibreOffice", { inputPath, outputDir });

  const result = await execCommand(
    libreOfficePath,
    ["--headless", "--convert-to", "pdf", "--outdir", outputDir, inputPath],
    { timeoutMs }
  ).catch((err) => {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new AppError(ErrorCode.LIBREOFFICE_NOT_FOUND, "LibreOffice (soffice) not found on PATH");
    }
    throw err;
  });

  if (result.exitCode !== 0) {
    throw new AppError(ErrorCode.LIBREOFFICE_CLI_CONVERSION_FAILED, `LibreOffice conversion failed`, {
      stderr: result.stderr,
      exitCode: result.exitCode,
    });
  }

  const baseName = path.basename(inputPath, path.extname(inputPath));
  const pdfPath = path.join(outputDir, `${baseName}.pdf`);
  if (await fileExists(pdfPath)) {
    return pdfPath;
  }

  const pdfs = await listFiles(outputDir, ".pdf");
  if (pdfs.length > 0) {
    return pdfs[0];
  }

  throw new AppError(ErrorCode.LIBREOFFICE_CLI_CONVERSION_FAILED, "LibreOffice conversion completed but no PDF found", {
    outputDir,
    baseName,
  });
}
