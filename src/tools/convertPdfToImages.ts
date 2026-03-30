import { fileExists, ensureDir } from "../utils/fs.js";
import { AppError, ErrorCode } from "../types/errors.js";
import { createTempDir, cleanupTempDir } from "../services/tempFiles.js";
import { detectCapabilities } from "../services/capabilityDetector.js";
import { renderPdfToImages } from "../services/pdfRenderer.js";
import { resolveFilePathInput } from "../utils/toolInput.js";

export interface ConvertPdfToImagesInput { filePath?: string; path?: string; outputDir?: string; dpi?: number; }
export interface ConvertPdfToImagesOutput { sourceType: "pdf"; images: string[]; pageCount: number; }

export async function convertPdfToImages(input: ConvertPdfToImagesInput): Promise<ConvertPdfToImagesOutput> {
  const filePath = resolveFilePathInput(input);
  const { dpi = 150 } = input;
  if (!(await fileExists(filePath))) throw new AppError(ErrorCode.FILE_NOT_FOUND, `File not found: ${filePath}`);
  const caps = await detectCapabilities();
  if (!caps.pdfRenderer) throw new AppError(ErrorCode.PDF_RENDER_TOOL_NOT_FOUND, "No PDF rendering tool found.");
  let tempDir: string | null = null;
  const outputDir = input.outputDir ?? (tempDir = await createTempDir("pdf-images-"));
  await ensureDir(outputDir);
  try {
    const result = await renderPdfToImages(filePath, outputDir, dpi, caps.pdfRendererTool ?? "pdftoppm");
    return { sourceType: "pdf", images: result.images, pageCount: result.pageCount };
  } catch (err) {
    if (tempDir) await cleanupTempDir(tempDir);
    throw err;
  }
}
