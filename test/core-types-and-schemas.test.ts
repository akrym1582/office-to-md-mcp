import {
  AppError,
  ErrorCode,
} from "../src/types/errors.js";
import {
  ConvertExcelToImagesSchema,
  ConvertPdfImagesToMarkdownSchema,
  ConvertPdfToImagesSchema,
  ConvertWordToImagesSchema,
  ExtractExcelTextSchema,
  ExtractWordTextSchema,
  GetCapabilitiesSchema,
  RenderDocumentSchema,
} from "../src/types/toolSchemas.js";
import {
  detectFileCategory,
  isDocxFile,
  isExcelFile,
  isPdfFile,
  isWordFile,
} from "../src/services/fileType.js";

describe("errors", () => {
  it("preserves code, message, and context on AppError", () => {
    const error = new AppError(ErrorCode.FILE_NOT_FOUND, "missing", { filePath: "/tmp/a.docx" });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AppError");
    expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
    expect(error.message).toBe("missing");
    expect(error.context).toEqual({ filePath: "/tmp/a.docx" });
  });
});

describe("file type detection", () => {
  it("classifies supported file types case-insensitively", () => {
    expect(detectFileCategory("/tmp/book.XLSX")).toBe("excel");
    expect(detectFileCategory("/tmp/doc.ODT")).toBe("word");
    expect(detectFileCategory("/tmp/file.PDF")).toBe("pdf");
  });

  it("exposes helper predicates", () => {
    expect(isExcelFile("sheet.xlsm")).toBe(true);
    expect(isWordFile("letter.doc")).toBe(true);
    expect(isPdfFile("paper.pdf")).toBe(true);
    expect(isDocxFile("paper.docx")).toBe(true);
    expect(isDocxFile("paper.doc")).toBe(false);
  });

  it("throws an AppError for unsupported formats", () => {
    expect(() => detectFileCategory("notes.txt")).toThrow(
      expect.objectContaining({
        code: ErrorCode.UNSUPPORTED_FORMAT,
      })
    );
  });
});

describe("tool schemas", () => {
  it("applies defaults for image conversion tools", () => {
    expect(ConvertExcelToImagesSchema.parse({ filePath: "book.xlsx" })).toEqual({
      filePath: "book.xlsx",
      outputDir: undefined,
      dpi: 150,
      sheetNames: undefined,
      keepPdf: false,
    });
    expect(ConvertWordToImagesSchema.parse({ filePath: "doc.docx" })).toEqual({
      filePath: "doc.docx",
      outputDir: undefined,
      dpi: 150,
      keepPdf: false,
    });
    expect(ConvertPdfToImagesSchema.parse({ filePath: "doc.pdf" })).toEqual({
      filePath: "doc.pdf",
      outputDir: undefined,
      dpi: 150,
    });
  });

  it("applies defaults for extraction and capability schemas", () => {
    expect(ExtractExcelTextSchema.parse({ filePath: "book.xlsx" })).toEqual({
      filePath: "book.xlsx",
      format: "markdown",
      includeFormulas: false,
      includeMergedCells: false,
    });
    expect(ExtractWordTextSchema.parse({ filePath: "doc.docx" })).toEqual({
      filePath: "doc.docx",
      format: "markdown",
    });
    expect(ConvertPdfImagesToMarkdownSchema.parse({ filePath: "doc.pdf" })).toEqual({
      filePath: "doc.pdf",
      dpi: 150,
      mergePages: true,
      preservePageHeadings: true,
    });
    expect(RenderDocumentSchema.parse({ filePath: "doc.pdf" })).toEqual({
      filePath: "doc.pdf",
      outputMode: "images",
      outputDir: undefined,
      dpi: 150,
    });
    expect(GetCapabilitiesSchema.parse({})).toEqual({});
  });
});
