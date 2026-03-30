import { AppError, ErrorCode } from "../src/types/errors.js";

const fileExistsMock = jest.fn();
const ensureDirMock = jest.fn();
const createTempDirMock = jest.fn();
const cleanupTempDirMock = jest.fn();
const detectCapabilitiesMock = jest.fn();
const convertExcelToPdfViaPythonMock = jest.fn();
const convertToPdfWithLibreOfficeMock = jest.fn();
const renderPdfToImagesMock = jest.fn();
const loggerWarnMock = jest.fn();

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

jest.mock("../src/services/officePythonBridge.js", () => ({
  convertExcelToPdfViaPython: (...args: unknown[]) => convertExcelToPdfViaPythonMock(...args),
}));

jest.mock("../src/services/libreOfficeCli.js", () => ({
  convertToPdfWithLibreOffice: (...args: unknown[]) => convertToPdfWithLibreOfficeMock(...args),
}));

jest.mock("../src/services/pdfRenderer.js", () => ({
  renderPdfToImages: (...args: unknown[]) => renderPdfToImagesMock(...args),
}));

jest.mock("../src/utils/logger.js", () => ({
  logger: {
    warn: (...args: unknown[]) => loggerWarnMock(...args),
  },
}));

describe("convertExcelToImages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fileExistsMock.mockResolvedValue(true);
    ensureDirMock.mockResolvedValue(undefined);
    cleanupTempDirMock.mockResolvedValue(undefined);
  });

  it("uses the python UNO bridge when available", async () => {
    detectCapabilitiesMock.mockResolvedValue({
      libreOffice: true,
      pdfRenderer: true,
      pdfRendererTool: "pdftoppm",
      python: true,
      unoHelper: true,
      pythonPath: "/usr/bin/python3",
    });
    createTempDirMock.mockResolvedValueOnce("/tmp/pdf-dir");
    convertExcelToPdfViaPythonMock.mockResolvedValue({ ok: true, pdfPath: "/tmp/generated.pdf" });
    renderPdfToImagesMock.mockResolvedValue({ images: ["/tmp/out/page-1.png"], pageCount: 1 });

    const { convertExcelToImages } = await import("../src/tools/convertExcelToImages.js");
    await expect(convertExcelToImages({ filePath: "/tmp/book.xlsx", outputDir: "/tmp/out", sheetNames: ["Summary"] })).resolves.toEqual({
      sourceType: "excel",
      pdfPath: undefined,
      images: ["/tmp/out/page-1.png"],
      pageCount: 1,
      renderStrategy: "libreoffice-uno-print-area",
    });
    expect(convertExcelToPdfViaPythonMock).toHaveBeenCalled();
    expect(cleanupTempDirMock).toHaveBeenCalledWith("/tmp/pdf-dir");
  });

  it("falls back to LibreOffice CLI and cleans up temp directories on failure", async () => {
    detectCapabilitiesMock.mockResolvedValue({
      libreOffice: true,
      pdfRenderer: true,
      pdfRendererTool: "convert",
      python: false,
      unoHelper: false,
      libreOfficePath: "/usr/bin/soffice",
    });
    createTempDirMock.mockResolvedValueOnce("/tmp/pdf-dir").mockResolvedValueOnce("/tmp/img-dir");
    convertToPdfWithLibreOfficeMock.mockResolvedValue("/tmp/pdf-dir/output.pdf");
    renderPdfToImagesMock.mockRejectedValue(new Error("render failed"));

    const { convertExcelToImages } = await import("../src/tools/convertExcelToImages.js");
    await expect(convertExcelToImages({ filePath: "/tmp/book.xlsx" })).rejects.toThrow("render failed");
    expect(loggerWarnMock).toHaveBeenCalledWith("Python UNO helper not available, falling back to LibreOffice CLI");
    expect(cleanupTempDirMock).toHaveBeenNthCalledWith(1, "/tmp/pdf-dir");
    expect(cleanupTempDirMock).toHaveBeenNthCalledWith(2, "/tmp/img-dir");
  });

  it("fails early when required dependencies are missing", async () => {
    fileExistsMock.mockResolvedValue(false);

    const { convertExcelToImages } = await import("../src/tools/convertExcelToImages.js");
    await expect(convertExcelToImages({ filePath: "/tmp/book.xlsx" })).rejects.toMatchObject({
      code: ErrorCode.FILE_NOT_FOUND,
    } as Partial<AppError>);
  });
});
