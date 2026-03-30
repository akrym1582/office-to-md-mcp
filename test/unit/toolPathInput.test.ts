import {
  ConvertExcelToImagesSchema,
  ConvertPdfImagesToMarkdownSchema,
  ConvertPdfToImagesSchema,
  ConvertWordToImagesSchema,
  ExtractExcelTextSchema,
  ExtractWordTextSchema,
  RenderDocumentSchema,
} from "../../src/types/toolSchemas";
import { AppError, ErrorCode } from "../../src/types/errors";
import { resolveFilePathInput } from "../../src/utils/toolInput";

const filePathSchemas = [
  ["convert_excel_to_images", ConvertExcelToImagesSchema, "/tmp/input.xlsx"],
  ["convert_word_to_images", ConvertWordToImagesSchema, "/tmp/input.docx"],
  ["convert_pdf_to_images", ConvertPdfToImagesSchema, "/tmp/input.pdf"],
  ["extract_excel_text", ExtractExcelTextSchema, "/tmp/input.xlsx"],
  ["extract_word_text", ExtractWordTextSchema, "/tmp/input.docx"],
  ["convert_pdf_images_to_markdown", ConvertPdfImagesToMarkdownSchema, "/tmp/input.pdf"],
  ["render_document", RenderDocumentSchema, "/tmp/input.xlsx"],
] as const;

describe.each(filePathSchemas)("%s schema", (_name, schema, samplePath) => {
  it("accepts path as an alias for filePath", () => {
    expect(schema.parse({ path: samplePath }).path).toBe(samplePath);
  });

  it("rejects missing filePath and path", () => {
    expect(() => schema.parse({})).toThrow("Either filePath or path must be provided");
  });
});

describe("resolveFilePathInput", () => {
  it("prefers filePath when both filePath and path are provided", () => {
    expect(resolveFilePathInput({ filePath: "/tmp/primary.pdf", path: "/tmp/fallback.pdf" })).toBe("/tmp/primary.pdf");
  });

  it("returns path when filePath is omitted", () => {
    expect(resolveFilePathInput({ path: "/tmp/input.pdf" })).toBe("/tmp/input.pdf");
  });

  it("throws an invalid input error when neither value is provided", () => {
    expect(() => resolveFilePathInput({})).toThrow(
      expect.objectContaining({
        code: ErrorCode.INVALID_TOOL_INPUT,
      })
    );
  });
});
