import { AppError, ErrorCode } from "../src/types/errors.js";

const execCommandMock = jest.fn();
const loggerInfoMock = jest.fn();
const loggerDebugMock = jest.fn();

jest.mock("../src/utils/exec.js", () => ({
  execCommand: (...args: unknown[]) => execCommandMock(...args),
}));

jest.mock("../src/utils/logger.js", () => ({
  logger: {
    info: (...args: unknown[]) => loggerInfoMock(...args),
    debug: (...args: unknown[]) => loggerDebugMock(...args),
  },
}));

describe("convertExcelToPdfViaPython", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes sheet names through and returns parsed JSON output", async () => {
    execCommandMock.mockResolvedValue({
      stdout: JSON.stringify({ ok: true, pdfPath: "/tmp/out.pdf", renderStrategy: "uno", sheetCount: 2 }),
      stderr: "",
      exitCode: 0,
    });

    const { convertExcelToPdfViaPython } = await import("../src/services/officePythonBridge.js");
    await expect(
      convertExcelToPdfViaPython("/tmp/in.xlsx", "/tmp/out.pdf", "python3", "/tmp/helper.py", ["A", "B"])
    ).resolves.toEqual({
      ok: true,
      pdfPath: "/tmp/out.pdf",
      renderStrategy: "uno",
      sheetCount: 2,
    });
    expect(execCommandMock).toHaveBeenCalledWith(
      "python3",
      ["/tmp/helper.py", "--input", "/tmp/in.xlsx", "--output", "/tmp/out.pdf", "--json", "--sheet", "A", "--sheet", "B"],
      { timeoutMs: 180000 }
    );
    expect(loggerDebugMock).toHaveBeenCalled();
  });

  it("maps missing python, invalid json, and failed helper results to AppErrors", async () => {
    execCommandMock.mockRejectedValueOnce(Object.assign(new Error("missing"), { code: "ENOENT" }));

    const { convertExcelToPdfViaPython } = await import("../src/services/officePythonBridge.js");
    await expect(
      convertExcelToPdfViaPython("/tmp/in.xlsx", "/tmp/out.pdf", "python3", "/tmp/helper.py")
    ).rejects.toMatchObject({
      code: ErrorCode.PYTHON_NOT_FOUND,
    } as Partial<AppError>);

    execCommandMock.mockResolvedValueOnce({ stdout: "not-json", stderr: "boom", exitCode: 1 });
    await expect(
      convertExcelToPdfViaPython("/tmp/in.xlsx", "/tmp/out.pdf", "python3", "/tmp/helper.py")
    ).rejects.toMatchObject({
      code: ErrorCode.LIBREOFFICE_UNO_CONVERSION_FAILED,
      context: { stdout: "not-json", stderr: "boom", exitCode: 1 },
    } as Partial<AppError>);

    execCommandMock.mockResolvedValueOnce({
      stdout: JSON.stringify({ ok: false, error: { code: "UNO", message: "failed" } }),
      stderr: "",
      exitCode: 0,
    });
    await expect(
      convertExcelToPdfViaPython("/tmp/in.xlsx", "/tmp/out.pdf", "python3", "/tmp/helper.py")
    ).rejects.toMatchObject({
      code: ErrorCode.LIBREOFFICE_UNO_CONVERSION_FAILED,
      message: "failed",
      context: { errorCode: "UNO" },
    } as Partial<AppError>);
  });
});
