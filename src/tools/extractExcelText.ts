import { AppError, ErrorCode } from "../types/errors.js";
import { convertExcelToImages } from "./convertExcelToImages.js";
import { convertImageToMarkdown, getGithubToken } from "../services/copilotCli.js";
import { logger } from "../utils/logger.js";

export interface ExtractExcelTextInput {
  filePath: string;
  dpi?: number;
  sheetNames?: string[];
}

export interface ExtractExcelTextOutput {
  sourceType: "excel";
  textFormat: "markdown";
  content: string;
  images: string[];
  pageCount: number;
}

export async function extractExcelText(input: ExtractExcelTextInput): Promise<ExtractExcelTextOutput> {
  const { filePath, dpi = 150, sheetNames } = input;

  const token = getGithubToken();
  if (!token) {
    throw new AppError(ErrorCode.GITHUB_TOKEN_MISSING, "GitHub token is required for image-to-Markdown conversion");
  }

  logger.info("Extracting Excel text via image-based pipeline", { filePath });

  const imageResult = await convertExcelToImages({
    filePath,
    dpi,
    sheetNames,
  });

  const markdowns: string[] = [];
  for (const imagePath of imageResult.images) {
    const md = await convertImageToMarkdown(imagePath, token);
    markdowns.push(md);
  }

  const content = markdowns.length === 1
    ? markdowns[0]
    : markdowns.map((md, i) => `## Page ${i + 1}\n\n${md}`).join("\n\n");

  return {
    sourceType: "excel",
    textFormat: "markdown",
    content,
    images: imageResult.images,
    pageCount: imageResult.pageCount,
  };
}
