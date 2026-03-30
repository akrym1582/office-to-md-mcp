import { AppError, ErrorCode } from "../src/types/errors.js";

const fileExistsMock = jest.fn();
const ensureDirMock = jest.fn();
const createTempDirMock = jest.fn();
const cleanupTempDirMock = jest.fn();
const detectCapabilitiesMock = jest.fn();
const convertToPdfWithLibreOfficeMock = jest.fn();
const renderPdfToImagesMock = jest.fn();
const convertExcelToImagesMock = jest.fn();
const convertImageToMarkdownMock = jest.fn();
const getGithubTokenMock = jest.fn();

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

jest.mock("../src/tools/convertExcelToImages.js", () => ({
  convertExcelToImages: (...args: unknown[]) => convertExcelToImagesMock(...args),
}));

jest.mock("../src/services/copilotCli.js", () => ({
  convertImageToMarkdown: (...args: unknown[]) => convertImageToMarkdownMock(...args),
  getGithubToken: (...args: unknown[]) => getGithubTokenMock(...args),
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

  it("extracts Excel text via image-based pipeline", async () => {
    getGithubTokenMock.mockReturnValue("test-token");
    convertExcelToImagesMock.mockResolvedValue({
      sourceType: "excel",
      images: ["/tmp/out/page-1.png", "/tmp/out/page-2.png"],
      pageCount: 2,
      renderStrategy: "libreoffice-cli",
    });
    convertImageToMarkdownMock
      .mockResolvedValueOnce("# Page 1 content")
      .mockResolvedValueOnce("# Page 2 content");

    const { extractExcelText } = await import("../src/tools/extractExcelText.js");
    const result = await extractExcelText({ filePath: "/tmp/book.xlsx" });

    expect(result).toEqual({
      sourceType: "excel",
      textFormat: "markdown",
      content: "## Page 1\n\n# Page 1 content\n\n## Page 2\n\n# Page 2 content",
      images: ["/tmp/out/page-1.png", "/tmp/out/page-2.png"],
      pageCount: 2,
    });
    expect(convertExcelToImagesMock).toHaveBeenCalledWith({
      filePath: "/tmp/book.xlsx",
      dpi: 150,
      sheetNames: undefined,
    });
    expect(convertImageToMarkdownMock).toHaveBeenCalledTimes(2);
  });

  it("extracts single-page Excel without page headings", async () => {
    getGithubTokenMock.mockReturnValue("test-token");
    convertExcelToImagesMock.mockResolvedValue({
      sourceType: "excel",
      images: ["/tmp/out/page-1.png"],
      pageCount: 1,
      renderStrategy: "libreoffice-cli",
    });
    convertImageToMarkdownMock.mockResolvedValueOnce("# Single page");

    const { extractExcelText } = await import("../src/tools/extractExcelText.js");
    const result = await extractExcelText({ filePath: "/tmp/book.xlsx" });

    expect(result.content).toBe("# Single page");
  });

  it("raises an error when GitHub token is missing for Excel text extraction", async () => {
    getGithubTokenMock.mockReturnValue(null);

    const { extractExcelText } = await import("../src/tools/extractExcelText.js");
    await expect(extractExcelText({ filePath: "/tmp/book.xlsx" })).rejects.toMatchObject({
      code: ErrorCode.GITHUB_TOKEN_MISSING,
    } as Partial<AppError>);
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
