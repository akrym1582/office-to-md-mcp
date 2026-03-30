import { fileExists, ensureDir } from "../utils/fs.js";
import { AppError, ErrorCode } from "../types/errors.js";
import { createTempDir, cleanupTempDir } from "../services/tempFiles.js";
import { detectCapabilities } from "../services/capabilityDetector.js";
import { renderPdfToImages } from "../services/pdfRenderer.js";
import {
  getGithubToken,
  convertPdfPagesToMarkdown,
  mergePageMarkdowns,
} from "../services/copilotCli.js";

export interface ConvertPdfToMarkdownInput {
  filePath: string;
  dpi?: number;
  mergePages?: boolean;
  preservePageHeadings?: boolean;
}

export interface ConvertPdfToMarkdownOutput {
  sourceType: "pdf";
  markdown: string;
  pages: string[];
  pageCount: number;
}

export async function convertPdfToMarkdown(
  input: ConvertPdfToMarkdownInput,
): Promise<ConvertPdfToMarkdownOutput> {
  const {
    filePath,
    dpi = 150,
    mergePages = true,
    preservePageHeadings = true,
  } = input;

  if (!(await fileExists(filePath))) {
    throw new AppError(ErrorCode.FILE_NOT_FOUND, `File not found: ${filePath}`);
  }

  const caps = await detectCapabilities();

  if (!caps.pdfRenderer) {
    throw new AppError(
      ErrorCode.PDF_RENDER_TOOL_NOT_FOUND,
      "No PDF rendering tool found. Install pdftoppm or ImageMagick.",
    );
  }

  if (!caps.copilotCli) {
    throw new AppError(
      ErrorCode.COPILOT_CLI_NOT_FOUND,
      "GitHub CLI (gh) not found. Install gh CLI to use Copilot-based conversion.",
    );
  }

  const token = getGithubToken();
  if (!token) {
    throw new AppError(
      ErrorCode.GITHUB_TOKEN_MISSING,
      "GITHUB_TOKEN is required for Copilot-based PDF to Markdown conversion.",
    );
  }

  // Render PDF pages to images
  const tempImgDir = await createTempDir("pdf-md-images-");

  try {
    await ensureDir(tempImgDir);

    const renderResult = await renderPdfToImages(
      filePath,
      tempImgDir,
      dpi,
      caps.pdfRendererTool ?? "pdftoppm",
    );

    // Convert each page image to Markdown via Copilot
    const pages = await convertPdfPagesToMarkdown(
      renderResult.images,
      caps.copilotCliPath ?? "gh",
      token,
    );

    const markdown = mergePages
      ? mergePageMarkdowns(pages, preservePageHeadings)
      : pages.join("\n\n");

    return {
      sourceType: "pdf",
      markdown,
      pages,
      pageCount: renderResult.pageCount,
    };
  } finally {
    await cleanupTempDir(tempImgDir);
  }
}
