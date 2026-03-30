import { AppError, ErrorCode } from "../src/types/errors.js";

const execCommandMock = jest.fn();
const fileExistsMock = jest.fn();
const listFilesMock = jest.fn();
const loggerInfoMock = jest.fn();

jest.mock("../src/utils/exec.js", () => ({
  execCommand: (...args: unknown[]) => execCommandMock(...args),
}));

jest.mock("../src/utils/fs.js", () => ({
  fileExists: (...args: unknown[]) => fileExistsMock(...args),
  listFiles: (...args: unknown[]) => listFilesMock(...args),
}));

jest.mock("../src/utils/logger.js", () => ({
  logger: {
    info: (...args: unknown[]) => loggerInfoMock(...args),
  },
}));

describe("convertToPdfWithLibreOffice", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the expected PDF path when LibreOffice generates it", async () => {
    execCommandMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    fileExistsMock.mockResolvedValue(true);

    const { convertToPdfWithLibreOffice } = await import("../src/services/libreOfficeCli.js");
    await expect(convertToPdfWithLibreOffice("/tmp/input.docx", "/tmp/out")).resolves.toBe("/tmp/out/input.pdf");
    expect(loggerInfoMock).toHaveBeenCalledWith("Converting document to PDF with LibreOffice", {
      inputPath: "/tmp/input.docx",
      outputDir: "/tmp/out",
    });
  });

  it("falls back to the first discovered PDF when the base name differs", async () => {
    execCommandMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    fileExistsMock.mockResolvedValue(false);
    listFilesMock.mockResolvedValue(["/tmp/out/renamed.pdf"]);

    const { convertToPdfWithLibreOffice } = await import("../src/services/libreOfficeCli.js");
    await expect(convertToPdfWithLibreOffice("/tmp/input.docx", "/tmp/out")).resolves.toBe("/tmp/out/renamed.pdf");
  });

  it("maps ENOENT to LIBREOFFICE_NOT_FOUND", async () => {
    const error = Object.assign(new Error("missing"), { code: "ENOENT" });
    execCommandMock.mockRejectedValue(error);

    const { convertToPdfWithLibreOffice } = await import("../src/services/libreOfficeCli.js");
    await expect(convertToPdfWithLibreOffice("/tmp/input.docx", "/tmp/out")).rejects.toMatchObject({
      code: ErrorCode.LIBREOFFICE_NOT_FOUND,
    } as Partial<AppError>);
  });

  it("raises conversion errors when LibreOffice exits unsuccessfully or generates nothing", async () => {
    execCommandMock.mockResolvedValueOnce({ stdout: "", stderr: "boom", exitCode: 1 });

    const { convertToPdfWithLibreOffice } = await import("../src/services/libreOfficeCli.js");
    await expect(convertToPdfWithLibreOffice("/tmp/input.docx", "/tmp/out")).rejects.toMatchObject({
      code: ErrorCode.LIBREOFFICE_CLI_CONVERSION_FAILED,
      context: { stderr: "boom", exitCode: 1 },
    } as Partial<AppError>);

    execCommandMock.mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });
    fileExistsMock.mockResolvedValue(false);
    listFilesMock.mockResolvedValue([]);

    await expect(convertToPdfWithLibreOffice("/tmp/input.docx", "/tmp/out")).rejects.toMatchObject({
      code: ErrorCode.LIBREOFFICE_CLI_CONVERSION_FAILED,
      context: { outputDir: "/tmp/out", baseName: "input" },
    } as Partial<AppError>);
  });
});
