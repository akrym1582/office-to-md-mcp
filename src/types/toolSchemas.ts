import { z } from "zod";

function createPathInputSchema(description: string) {
  return {
    filePath: z.string().optional().describe(description),
    path: z.string().optional().describe(`Alias of filePath. ${description}`),
  };
}

function requirePath<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).refine(
    (input) => typeof input.filePath === "string" || typeof input.path === "string",
    { message: "Either filePath or path must be provided", path: ["filePath"] }
  );
}

export const ConvertExcelToImagesSchema = requirePath({
  ...createPathInputSchema("Path to the Excel file (.xlsx, .xls)"),
  outputDir: z.string().optional().describe("Output directory for images"),
  dpi: z.number().int().min(72).max(600).optional().default(150).describe("Rendering DPI"),
  sheetNames: z.array(z.string()).optional().describe("Specific sheet names to render"),
  keepPdf: z.boolean().optional().default(false).describe("Keep intermediate PDF"),
});

export const ConvertWordToImagesSchema = requirePath({
  ...createPathInputSchema("Path to the Word file (.docx, .doc)"),
  outputDir: z.string().optional().describe("Output directory for images"),
  dpi: z.number().int().min(72).max(600).optional().default(150).describe("Rendering DPI"),
  keepPdf: z.boolean().optional().default(false).describe("Keep intermediate PDF"),
});

export const ConvertPdfToImagesSchema = requirePath({
  ...createPathInputSchema("Path to the PDF file"),
  outputDir: z.string().optional().describe("Output directory for images"),
  dpi: z.number().int().min(72).max(600).optional().default(150).describe("Rendering DPI"),
});

export const ExtractExcelTextSchema = requirePath({
  ...createPathInputSchema("Path to the Excel file (.xlsx, .xls)"),
  format: z.enum(["markdown", "json"]).default("markdown").describe("Output format"),
  includeFormulas: z.boolean().optional().default(false).describe("Include cell formulas"),
  includeMergedCells: z.boolean().optional().default(false).describe("Include merged cell metadata"),
});

export const ExtractWordTextSchema = requirePath({
  ...createPathInputSchema("Path to the Word file (.docx)"),
  format: z.enum(["text", "markdown"]).default("markdown").describe("Output format"),
});

export const ConvertPdfImagesToMarkdownSchema = requirePath({
  ...createPathInputSchema("Path to the PDF file"),
  dpi: z.number().int().min(72).max(600).optional().default(150).describe("Rendering DPI"),
  mergePages: z.boolean().optional().default(true).describe("Merge all page Markdowns"),
  preservePageHeadings: z.boolean().optional().default(true).describe("Add page headings"),
});

export const RenderDocumentSchema = requirePath({
  ...createPathInputSchema("Path to the document file"),
  outputMode: z.enum(["images", "text", "markdown", "all"]).default("images").describe("Output mode"),
  outputDir: z.string().optional().describe("Output directory for images"),
  dpi: z.number().int().min(72).max(600).optional().default(150).describe("Rendering DPI"),
});

export const GetCapabilitiesSchema = z.object({});
