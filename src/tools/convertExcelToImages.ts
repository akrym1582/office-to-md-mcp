import * as path from "path";
import { fileExists, ensureDir } from "../utils/fs.js";
import { AppError, ErrorCode } from "../types/errors.js";
import { createTempDir, cleanupTempDir } from "../services/tempFiles.js";
import { detectCapabilities } from "../services/capabilityDetector.js";
import { convertExcelToPdfViaPython } from "../services/officePythonBridge.js";
import { convertToPdfWithLibreOffice } from "../services/libreOfficeCli.js";
import { renderPdfToImages } from "../services/pdfRenderer.js";
import { logger } from "../utils/logger.js";
import { resolveFilePathInput } from "../utils/toolInput.js";

export interface ConvertExcelToImagesInput { filePath?: string; path?: string; outputDir?: string; dpi?: number; sheetNames?: string[]; keepPdf?: boolean; }
export interface ConvertExcelToImagesOutput { sourceType: "excel"; pdfPath?: string; images: string[]; pageCount: number; renderStrategy: "libreoffice-uno-print-area" | "libreoffice-cli"; }

const UNO_HELPER_PATH = path.resolve(__dirname, "../../python/excel_to_pdf_uno.py");

export async function convertExcelToImages(input: ConvertExcelToImagesInput): Promise<ConvertExcelToImagesOutput> {
  const filePath = resolveFilePathInput(input);
  const { dpi = 150, keepPdf = false, sheetNames } = input;
  if (!(await fileExists(filePath))) throw new AppError(ErrorCode.FILE_NOT_FOUND, `File not found: ${filePath}`);
  const caps = await detectCapabilities(UNO_HELPER_PATH);
  if (!caps.libreOffice) throw new AppError(ErrorCode.LIBREOFFICE_NOT_FOUND, "LibreOffice not found.");
  if (!caps.pdfRenderer) throw new AppError(ErrorCode.PDF_RENDER_TOOL_NOT_FOUND, "No PDF rendering tool found.");
  const tempPdfDir = await createTempDir("excel-pdf-");
  let tempImgDir: string | null = null;
  const outputDir = input.outputDir ?? (tempImgDir = await createTempDir("excel-images-"));
  try {
    await ensureDir(outputDir);
    let pdfPath: string;
    let renderStrategy: "libreoffice-uno-print-area" | "libreoffice-cli";
    if (caps.python && caps.unoHelper) {
      const pdfOutputPath = path.join(tempPdfDir, "output.pdf");
      const bridgeResult = await convertExcelToPdfViaPython(filePath, pdfOutputPath, caps.pythonPath ?? "python3", UNO_HELPER_PATH, sheetNames);
      pdfPath = bridgeResult.pdfPath ?? pdfOutputPath;
      renderStrategy = "libreoffice-uno-print-area";
    } else {
      logger.warn("Python UNO helper not available, falling back to LibreOffice CLI");
      pdfPath = await convertToPdfWithLibreOffice(filePath, tempPdfDir, caps.libreOfficePath ?? "soffice");
      renderStrategy = "libreoffice-cli";
    }
    const result = await renderPdfToImages(pdfPath, outputDir, dpi, caps.pdfRendererTool ?? "pdftoppm");
    if (!keepPdf) await cleanupTempDir(tempPdfDir);
    return { sourceType: "excel", pdfPath: keepPdf ? pdfPath : undefined, images: result.images, pageCount: result.pageCount, renderStrategy };
  } catch (err) {
    await cleanupTempDir(tempPdfDir);
    if (tempImgDir) await cleanupTempDir(tempImgDir);
    throw err;
  }
}
