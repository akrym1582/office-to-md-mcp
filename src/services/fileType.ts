import * as path from "path";
import { AppError, ErrorCode } from "../types/errors.js";

export type FileCategory = "excel" | "word" | "pdf";

const EXCEL_EXTS = new Set([".xlsx", ".xls", ".xlsm", ".xlsb"]);
const WORD_EXTS = new Set([".docx", ".doc", ".odt"]);
const PDF_EXTS = new Set([".pdf"]);

export function detectFileCategory(filePath: string): FileCategory {
  const ext = path.extname(filePath).toLowerCase();
  if (EXCEL_EXTS.has(ext)) return "excel";
  if (WORD_EXTS.has(ext)) return "word";
  if (PDF_EXTS.has(ext)) return "pdf";
  throw new AppError(
    ErrorCode.UNSUPPORTED_FORMAT,
    `Unsupported file format: ${ext}. Supported: ${[...EXCEL_EXTS, ...WORD_EXTS, ...PDF_EXTS].join(", ")}`
  );
}

export function isExcelFile(filePath: string): boolean {
  return EXCEL_EXTS.has(path.extname(filePath).toLowerCase());
}

export function isWordFile(filePath: string): boolean {
  return WORD_EXTS.has(path.extname(filePath).toLowerCase());
}

export function isPdfFile(filePath: string): boolean {
  return PDF_EXTS.has(path.extname(filePath).toLowerCase());
}

export function isDocxFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === ".docx";
}
