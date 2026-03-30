import * as fs from "fs";
import { AppError, ErrorCode } from "../src/types/errors.js";

const extractRawTextMock = jest.fn();
const convertToMarkdownMock = jest.fn();
const loggerInfoMock = jest.fn();

jest.mock("mammoth", () => ({
  extractRawText: (...args: unknown[]) => extractRawTextMock(...args),
  convertToMarkdown: (...args: unknown[]) => convertToMarkdownMock(...args),
}));

jest.mock("../src/utils/logger.js", () => ({
  logger: {
    info: (...args: unknown[]) => loggerInfoMock(...args),
  },
}));

describe("extractWordText", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("extracts raw text and markdown from docx files", async () => {
    jest.spyOn(fs.promises, "readFile").mockResolvedValue(Buffer.from("docx"));
    extractRawTextMock.mockResolvedValue({ value: "plain text", messages: [] });
    convertToMarkdownMock.mockResolvedValue({ value: "# markdown", messages: [] });

    const { extractWordText } = await import("../src/services/wordExtractor.js");
    await expect(extractWordText("/tmp/sample.docx")).resolves.toEqual({
      text: "plain text",
      markdown: "# markdown",
    });
    expect(loggerInfoMock).toHaveBeenCalledWith("Extracting Word text", { filePath: "/tmp/sample.docx" });
  });

  it("rejects non-docx files and mammoth failures with AppErrors", async () => {
    const { extractWordText } = await import("../src/services/wordExtractor.js");

    await expect(extractWordText("/tmp/sample.doc")).rejects.toMatchObject({
      code: ErrorCode.UNSUPPORTED_FORMAT,
    } as Partial<AppError>);

    jest.spyOn(fs.promises, "readFile").mockResolvedValue(Buffer.from("docx"));
    extractRawTextMock.mockRejectedValue(new Error("bad doc"));

    await expect(extractWordText("/tmp/sample.docx")).rejects.toMatchObject({
      code: ErrorCode.WORD_TEXT_EXTRACTION_FAILED,
      message: "Failed to extract text from Word file: bad doc",
      context: { filePath: "/tmp/sample.docx" },
    } as Partial<AppError>);
  });
});
