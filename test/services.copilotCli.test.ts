import { AppError, ErrorCode } from "../src/types/errors.js";

const readFileMock = jest.fn();
const approveAllMock = jest.fn();
const startMock = jest.fn();
const createSessionMock = jest.fn();
const stopMock = jest.fn();
const sendAndWaitMock = jest.fn();
const disconnectMock = jest.fn();
const copilotClientMock = jest.fn().mockImplementation(() => ({
  start: startMock,
  createSession: createSessionMock,
  stop: stopMock,
}));
const loggerInfoMock = jest.fn();

jest.mock("fs/promises", () => ({
  readFile: (...args: unknown[]) => readFileMock(...args),
}));

jest.mock("@github/copilot-sdk", () => ({
  CopilotClient: copilotClientMock,
  approveAll: approveAllMock,
}));

jest.mock("../src/utils/logger.js", () => ({
  logger: {
    info: (...args: unknown[]) => loggerInfoMock(...args),
  },
}));

describe("copilot cli service", () => {
  const originalGithubToken = process.env.GITHUB_TOKEN;
  const originalGithubTokenLower = process.env.github_token;
  const originalCopilotModel = process.env.COPILOT_MODEL;

  beforeEach(() => {
    jest.clearAllMocks();
    createSessionMock.mockResolvedValue({
      sendAndWait: sendAndWaitMock,
      disconnect: disconnectMock,
    });
    startMock.mockResolvedValue(undefined);
    stopMock.mockResolvedValue(undefined);
    disconnectMock.mockResolvedValue(undefined);
    process.env.GITHUB_TOKEN = "UPPER";
    delete process.env.github_token;
    delete process.env.COPILOT_MODEL;
  });

  afterEach(() => {
    process.env.GITHUB_TOKEN = originalGithubToken;
    process.env.github_token = originalGithubTokenLower;
    process.env.COPILOT_MODEL = originalCopilotModel;
  });

  it("reads github tokens from the environment", async () => {
    const { getGithubToken } = await import("../src/services/copilotCli.js");
    expect(getGithubToken()).toBe("UPPER");

    delete process.env.GITHUB_TOKEN;
    process.env.github_token = "lower";
    expect(getGithubToken()).toBe("lower");
  });

  it("sends image attachments to Copilot and returns trimmed markdown", async () => {
    process.env.COPILOT_MODEL = "custom-model";
    readFileMock.mockResolvedValue(Buffer.from("image-bytes"));
    sendAndWaitMock.mockResolvedValue({ data: { content: "  # Hello  " } });

    const { convertImageToMarkdown } = await import("../src/services/copilotCli.js");
    await expect(convertImageToMarkdown("/tmp/sample.jpg", "token", 1234)).resolves.toBe("# Hello");

    expect(copilotClientMock).toHaveBeenCalledWith({ githubToken: "token" });
    expect(createSessionMock).toHaveBeenCalledWith({
      model: "custom-model",
      onPermissionRequest: approveAllMock,
    });
    expect(sendAndWaitMock).toHaveBeenCalledWith(
      {
        prompt: expect.stringContaining("Convert this image to Markdown"),
        attachments: [
          expect.objectContaining({
            data: Buffer.from("image-bytes").toString("base64"),
            mimeType: "image/jpeg",
            displayName: "sample.jpg",
            type: "blob",
          }),
        ],
      },
      1234
    );
    expect(disconnectMock).toHaveBeenCalled();
    expect(stopMock).toHaveBeenCalled();
    expect(loggerInfoMock).toHaveBeenCalledWith("Converting image to Markdown with GitHub Copilot SDK", {
      imagePath: "/tmp/sample.jpg",
    });
  });

  it("maps missing files and empty or failed Copilot responses to AppErrors", async () => {
    readFileMock.mockRejectedValueOnce(new Error("missing"));

    const { convertImageToMarkdown } = await import("../src/services/copilotCli.js");
    await expect(convertImageToMarkdown("/tmp/missing.png", "token")).rejects.toMatchObject({
      code: ErrorCode.FILE_NOT_FOUND,
    } as Partial<AppError>);

    readFileMock.mockResolvedValue(Buffer.from("image"));
    sendAndWaitMock.mockResolvedValueOnce({ data: { content: "" } });
    await expect(convertImageToMarkdown("/tmp/empty.png", "token")).rejects.toMatchObject({
      code: ErrorCode.COPILOT_MARKDOWN_FAILED,
      message: "No Markdown content received from GitHub Copilot",
    } as Partial<AppError>);

    sendAndWaitMock.mockRejectedValueOnce(new Error("sdk broke"));
    await expect(convertImageToMarkdown("/tmp/error.png", "token")).rejects.toMatchObject({
      code: ErrorCode.COPILOT_MARKDOWN_FAILED,
      context: { message: "Error: sdk broke" },
    } as Partial<AppError>);
  });
});
