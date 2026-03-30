import { fileExists } from "../utils/fs.js";
import { AppError, ErrorCode } from "../types/errors.js";
import { extractExcelData, formatExcelAsMarkdown } from "../services/excelExtractor.js";
import { resolveFilePathInput } from "../utils/toolInput.js";

export interface ExtractExcelTextInput {
  filePath?: string;
  path?: string;
  format?: "markdown" | "json";
  includeFormulas?: boolean;
  includeMergedCells?: boolean;
}

export interface ExtractExcelTextOutput {
  sourceType: "excel";
  textFormat: "markdown" | "json";
  content: string | object;
}

export async function extractExcelText(input: ExtractExcelTextInput): Promise<ExtractExcelTextOutput> {
  const filePath = resolveFilePathInput(input);
  const { format = "markdown", includeFormulas = false, includeMergedCells = false } = input;

  if (!(await fileExists(filePath))) {
    throw new AppError(ErrorCode.FILE_NOT_FOUND, `File not found: ${filePath}`);
  }

  const data = await extractExcelData(filePath, includeFormulas, includeMergedCells);

  if (format === "json") {
    return {
      sourceType: "excel",
      textFormat: "json",
      content: data,
    };
  }

  const markdown = formatExcelAsMarkdown(data);
  return {
    sourceType: "excel",
    textFormat: "markdown",
    content: markdown,
  };
}
