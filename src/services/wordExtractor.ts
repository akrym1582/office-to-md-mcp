import * as fs from "fs";
import { AppError, ErrorCode } from "../types/errors.js";
import { isDocxFile } from "./fileType.js";
import { logger } from "../utils/logger.js";

export interface WordExtractResult { text: string; markdown: string; }

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require("mammoth") as {
  extractRawText(opts: { buffer: Buffer }): Promise<{ value: string; messages: unknown[] }>;
  convertToMarkdown(opts: { buffer: Buffer }): Promise<{ value: string; messages: unknown[] }>;
};

export async function extractWordText(filePath: string): Promise<WordExtractResult> {
  logger.info("Extracting Word text", { filePath });
  if (!isDocxFile(filePath))
    throw new AppError(ErrorCode.UNSUPPORTED_FORMAT, `Only .docx files are supported for text extraction. Received: ${filePath}`);
  const buffer = await fs.promises.readFile(filePath);
  try {
    const [textResult, mdResult] = await Promise.all([
      mammoth.extractRawText({ buffer }),
      mammoth.convertToMarkdown({ buffer }),
    ]);
    return { text: textResult.value, markdown: mdResult.value };
  } catch (err) {
    throw new AppError(ErrorCode.WORD_TEXT_EXTRACTION_FAILED, `Failed to extract text from Word file: ${(err as Error).message}`, { filePath });
  }
}
