import { fileExists, ensureDir } from "../utils/fs.js";
import { AppError, ErrorCode } from "../types/errors.js";
import { createTempDir, cleanupTempDir } from "../services/tempFiles.js";
import { detectCapabilities } from "../services/capabilityDetector.js";
import { convertToPdfWithLibreOffice } from "../services/libreOfficeCli.js";
import { renderPdfToImages } from "../services/pdfRenderer.js";
import { resolveFilePathInput } from "../utils/toolInput.js";

export interface ConvertWordToImagesInput { filePath?: string; path?: string; outputDir?: string; dpi?: number; keepPdf?: boolean; }
export interface ConvertWordToImagesOutput { sourceType: "word"; pdfPath?: string; images: string[]; pageCount: number; }

export async function convertWordToImages(input: ConvertWordToImagesInput): Promise<ConvertWordToImagesOutput> {
  const filePath = resolveFilePathInput(input);
  const { dpi = 150, keepPdf = false } = input;
  if (!(await fileExists(filePath))) throw new AppError(ErrorCode.FILE_NOT_FOUND, `File not found: ${filePath}`);
  const caps = await detectCapabilities();
  if (!caps.libreOffice) throw new AppError(ErrorCode.LIBREOFFICE_NOT_FOUND, "LibreOffice not found.");
  if (!caps.pdfRenderer) throw new AppError(ErrorCode.PDF_RENDER_TOOL_NOT_FOUND, "No PDF rendering tool found.");
  const tempPdfDir = await createTempDir("word-pdf-");
  let tempImgDir: string | null = null;
  const outputDir = input.outputDir ?? (tempImgDir = await createTempDir("word-images-"));
  try {
    await ensureDir(outputDir);
    const pdfPath = await convertToPdfWithLibreOffice(filePath, tempPdfDir, caps.libreOfficePath ?? "soffice");
    const result = await renderPdfToImages(pdfPath, outputDir, dpi, caps.pdfRendererTool ?? "pdftoppm");
    if (!keepPdf) await cleanupTempDir(tempPdfDir);
    return { sourceType: "word", pdfPath: keepPdf ? pdfPath : undefined, images: result.images, pageCount: result.pageCount };
  } catch (err) {
    await cleanupTempDir(tempPdfDir);
    if (tempImgDir) await cleanupTempDir(tempImgDir);
    throw err;
  }
}
