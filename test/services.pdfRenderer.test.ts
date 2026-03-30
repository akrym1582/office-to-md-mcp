import { AppError, ErrorCode } from "../src/types/errors.js";

const execCommandMock = jest.fn();
const listFilesMock = jest.fn();
const loggerInfoMock = jest.fn();

jest.mock("../src/utils/exec.js", () => ({
  execCommand: (...args: unknown[]) => execCommandMock(...args),
}));

jest.mock("../src/utils/fs.js", () => ({
  listFiles: (...args: unknown[]) => listFilesMock(...args),
}));

jest.mock("../src/utils/logger.js", () => ({
  logger: {
    info: (...args: unknown[]) => loggerInfoMock(...args),
  },
}));

describe("renderPdfToImages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders with pdftoppm and returns image paths", async () => {
    execCommandMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    listFilesMock.mockResolvedValue(["/tmp/out/page-1.png", "/tmp/out/page-2.png"]);

    const { renderPdfToImages } = await import("../src/services/pdfRenderer.js");
    await expect(renderPdfToImages("/tmp/in.pdf", "/tmp/out")).resolves.toEqual({
      images: ["/tmp/out/page-1.png", "/tmp/out/page-2.png"],
      pageCount: 2,
    });
    expect(loggerInfoMock).toHaveBeenCalledWith("Rendering PDF to images", {
      pdfPath: "/tmp/in.pdf",
      outputDir: "/tmp/out",
      dpi: 150,
      tool: "pdftoppm",
    });
  });

  it("supports ImageMagick convert mode", async () => {
    execCommandMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    listFilesMock.mockResolvedValue(["/tmp/out/page-000.png"]);

    const { renderPdfToImages } = await import("../src/services/pdfRenderer.js");
    await expect(renderPdfToImages("/tmp/in.pdf", "/tmp/out", 200, "convert")).resolves.toEqual({
      images: ["/tmp/out/page-000.png"],
      pageCount: 1,
    });
    expect(execCommandMock).toHaveBeenCalledWith(
      "convert",
      ["-density", "200", "/tmp/in.pdf", "/tmp/out/page-%03d.png"],
      { timeoutMs: 300000 }
    );
  });

  it("maps missing renderer executables and failed renders to AppErrors", async () => {
    execCommandMock.mockRejectedValueOnce(Object.assign(new Error("missing"), { code: "ENOENT" }));

    const { renderPdfToImages } = await import("../src/services/pdfRenderer.js");
    await expect(renderPdfToImages("/tmp/in.pdf", "/tmp/out")).rejects.toMatchObject({
      code: ErrorCode.PDF_RENDER_TOOL_NOT_FOUND,
    } as Partial<AppError>);

    execCommandMock.mockResolvedValueOnce({ stdout: "", stderr: "boom", exitCode: 2 });
    await expect(renderPdfToImages("/tmp/in.pdf", "/tmp/out")).rejects.toMatchObject({
      code: ErrorCode.PDF_RENDER_FAILED,
      context: { stderr: "boom", exitCode: 2 },
    } as Partial<AppError>);
  });

  it("fails when no images are generated", async () => {
    execCommandMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    listFilesMock.mockResolvedValue([]);

    const { renderPdfToImages } = await import("../src/services/pdfRenderer.js");
    await expect(renderPdfToImages("/tmp/in.pdf", "/tmp/out")).rejects.toMatchObject({
      code: ErrorCode.PDF_RENDER_FAILED,
      message: "No images were generated from PDF",
    } as Partial<AppError>);
  });
});
