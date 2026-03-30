import { AppError, ErrorCode } from "../src/types/errors.js";

const fileExistsMock = jest.fn();
const ensureDirMock = jest.fn();
const createTempDirMock = jest.fn();
const cleanupTempDirMock = jest.fn();
const detectCapabilitiesMock = jest.fn();
const convertToPdfWithLibreOfficeMock = jest.fn();
const renderPdfToImagesMock = jest.fn();
const extractExcelDataMock = jest.fn();
const formatExcelAsMarkdownMock = jest.fn();

jest.mock("../src/utils/fs.js", () => ({
  fileExists: (...args: unknown[]) => fileExistsMock(...args),
  ensureDir: (...args: unknown[]) => ensureDirMock(...args),
}));

jest.mock("../src/services/tempFiles.js", () => ({
  createTempDir: (...args: unknown[]) => createTempDirMock(...args),
  cleanupTempDir: (...args: unknown[]) => cleanupTempDirMock(...args),
}));

jest.mock("../src/services/capabilityDetector.js", () => ({
  detectCapabilities: (...args: unknown[]) => detectCapabilitiesMock(...args),
}));

jest.mock("../src/services/libreOfficeCli.js", () => ({
  convertToPdfWithLibreOffice: (...args: unknown[]) => convertToPdfWithLibreOfficeMock(...args),
}));

jest.mock("../src/services/pdfRenderer.js", () => ({
  renderPdfToImages: (...args: unknown[]) => renderPdfToImagesMock(...args),
}));

jest.mock("../src/services/excelExtractor.js", () => ({
  extractExcelData: (...args: unknown[]) => extractExcelDataMock(...args),
  formatExcelAsMarkdown: (...args: unknown[]) => formatExcelAsMarkdownMock(...args),
}));

describe("other tools", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fileExistsMock.mockResolvedValue(true);
    ensureDirMock.mockResolvedValue(undefined);
    cleanupTempDirMock.mockResolvedValue(undefined);
  });

  it("converts Word files to images and optionally keeps the PDF", async () => {
    detectCapabilitiesMock.mockResolvedValue({
      libreOffice: true,
      pdfRenderer: true,
      pdfRendererTool: "pdftoppm",
      libreOfficePath: "/usr/bin/soffice",
    });
    createTempDirMock.mockResolvedValueOnce("/tmp/pdf-dir");
    convertToPdfWithLibreOfficeMock.mockResolvedValue("/tmp/pdf-dir/output.pdf");
    renderPdfToImagesMock.mockResolvedValue({ images: ["/tmp/out/page-1.png"], pageCount: 1 });

    const { convertWordToImages } = await import("../src/tools/convertWordToImages.js");
    await expect(convertWordToImages({ filePath: "/tmp/doc.docx", outputDir: "/tmp/out", keepPdf: true })).resolves.toEqual({
      sourceType: "word",
      pdfPath: "/tmp/pdf-dir/output.pdf",
      images: ["/tmp/out/page-1.png"],
      pageCount: 1,
    });
  });

  it("converts PDFs to images using a temp output directory when needed", async () => {
    detectCapabilitiesMock.mockResolvedValue({
      pdfRenderer: true,
      pdfRendererTool: "convert",
    });
    createTempDirMock.mockResolvedValueOnce("/tmp/pdf-images");
    renderPdfToImagesMock.mockResolvedValue({ images: ["/tmp/pdf-images/page-1.png"], pageCount: 1 });

    const { convertPdfToImages } = await import("../src/tools/convertPdfToImages.js");
    await expect(convertPdfToImages({ filePath: "/tmp/doc.pdf" })).resolves.toEqual({
      sourceType: "pdf",
      images: ["/tmp/pdf-images/page-1.png"],
      pageCount: 1,
    });
  });

  it("extracts Excel text in json and markdown forms", async () => {
    const extracted = { sheets: [{ name: "Sheet1", rows: [] }], sheetCount: 1 };
    extractExcelDataMock.mockResolvedValue(extracted);
    formatExcelAsMarkdownMock.mockReturnValue("## Sheet: Sheet1");

    const { extractExcelText } = await import("../src/tools/extractExcelText.js");
    await expect(extractExcelText({ filePath: "/tmp/book.xlsx", format: "json" })).resolves.toEqual({
      sourceType: "excel",
      textFormat: "json",
      content: extracted,
    });
    await expect(extractExcelText({ filePath: "/tmp/book.xlsx" })).resolves.toEqual({
      sourceType: "excel",
      textFormat: "markdown",
      content: "## Sheet: Sheet1",
    });
  });

  it("raises file and capability errors from the tools", async () => {
    fileExistsMock.mockResolvedValue(false);

    const { convertPdfToImages } = await import("../src/tools/convertPdfToImages.js");
    await expect(convertPdfToImages({ filePath: "/tmp/missing.pdf" })).rejects.toMatchObject({
      code: ErrorCode.FILE_NOT_FOUND,
    } as Partial<AppError>);

    fileExistsMock.mockResolvedValue(true);
    detectCapabilitiesMock.mockResolvedValue({ libreOffice: false, pdfRenderer: false });

    const { convertWordToImages } = await import("../src/tools/convertWordToImages.js");
    await expect(convertWordToImages({ filePath: "/tmp/doc.docx" })).rejects.toMatchObject({
      code: ErrorCode.LIBREOFFICE_NOT_FOUND,
    } as Partial<AppError>);
  });
});
