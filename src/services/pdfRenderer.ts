import * as path from "path";
import { execCommand } from "../utils/exec.js";
import { listFiles } from "../utils/fs.js";
import { AppError, ErrorCode } from "../types/errors.js";
import { logger } from "../utils/logger.js";

export interface RenderPdfResult {
  images: string[];
  pageCount: number;
}

export async function renderPdfToImages(
  pdfPath: string,
  outputDir: string,
  dpi = 150,
  tool: "pdftoppm" | "convert" = "pdftoppm",
  timeoutMs = 300_000
): Promise<RenderPdfResult> {
  logger.info("Rendering PDF to images", { pdfPath, outputDir, dpi, tool });

  const prefix = path.join(outputDir, "page");

  if (tool === "pdftoppm") {
    const result = await execCommand(
      "pdftoppm",
      ["-png", "-r", String(dpi), pdfPath, prefix],
      { timeoutMs }
    ).catch((err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new AppError(ErrorCode.PDF_RENDER_TOOL_NOT_FOUND, "pdftoppm not found on PATH");
      }
      throw err;
    });

    if (result.exitCode !== 0) {
      throw new AppError(ErrorCode.PDF_RENDER_FAILED, "pdftoppm failed to render PDF", {
        stderr: result.stderr,
        exitCode: result.exitCode,
      });
    }
  } else {
    const result = await execCommand(
      "convert",
      ["-density", String(dpi), pdfPath, `${prefix}-%03d.png`],
      { timeoutMs }
    ).catch((err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new AppError(ErrorCode.PDF_RENDER_TOOL_NOT_FOUND, "ImageMagick convert not found on PATH");
      }
      throw err;
    });

    if (result.exitCode !== 0) {
      throw new AppError(ErrorCode.PDF_RENDER_FAILED, "ImageMagick convert failed to render PDF", {
        stderr: result.stderr,
      });
    }
  }

  const images = await listFiles(outputDir, ".png");
  if (images.length === 0) {
    throw new AppError(ErrorCode.PDF_RENDER_FAILED, "No images were generated from PDF");
  }

  return { images, pageCount: images.length };
}
