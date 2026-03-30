const execCommandMock = jest.fn();
const fileExistsMock = jest.fn();
const loggerDebugMock = jest.fn();

jest.mock("../src/utils/exec.js", () => ({
  execCommand: (...args: unknown[]) => execCommandMock(...args),
}));

jest.mock("../src/utils/fs.js", () => ({
  fileExists: (...args: unknown[]) => fileExistsMock(...args),
}));

jest.mock("../src/utils/logger.js", () => ({
  logger: {
    debug: (...args: unknown[]) => loggerDebugMock(...args),
  },
}));

describe("detectCapabilities", () => {
  const originalGithubToken = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GITHUB_TOKEN = "token";
  });

  afterEach(() => {
    process.env.GITHUB_TOKEN = originalGithubToken;
  });

  it("detects installed tools, python version, UNO helper, and github token", async () => {
    execCommandMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === "which" && args[0] === "soffice") return { stdout: "/usr/bin/soffice\n", stderr: "", exitCode: 0 };
      if (command === "which" && args[0] === "python3") return { stdout: "/usr/bin/python3\n", stderr: "", exitCode: 0 };
      if (command === "which" && args[0] === "pdftoppm") return { stdout: "/usr/bin/pdftoppm\n", stderr: "", exitCode: 0 };
      if (command === "which" && args[0] === "convert") return { stdout: "/usr/bin/convert\n", stderr: "", exitCode: 0 };
      if (command === "/usr/bin/python3" && args[0] === "--version") return { stdout: "", stderr: "Python 3.12.0", exitCode: 0 };
      throw new Error(`unexpected command ${command} ${args.join(" ")}`);
    });
    fileExistsMock.mockResolvedValue(true);

    const { detectCapabilities } = await import("../src/services/capabilityDetector.js");
    const caps = await detectCapabilities("/tmp/uno.py");

    expect(caps).toEqual({
      libreOffice: true,
      libreOfficePath: "/usr/bin/soffice",
      python: true,
      pythonPath: "/usr/bin/python3",
      pythonVersion: "Python 3.12.0",
      unoHelper: true,
      pdfRenderer: true,
      pdfRendererPath: "/usr/bin/pdftoppm",
      pdfRendererTool: "pdftoppm",
      githubToken: true,
    });
    expect(loggerDebugMock).toHaveBeenCalledWith("Detected capabilities", caps);
  });

  it("falls back cleanly when executables are missing", async () => {
    execCommandMock.mockRejectedValue(new Error("missing"));
    fileExistsMock.mockResolvedValue(false);
    delete process.env.GITHUB_TOKEN;

    const { detectCapabilities } = await import("../src/services/capabilityDetector.js");
    const caps = await detectCapabilities("/tmp/uno.py");

    expect(caps).toMatchObject({
      libreOffice: false,
      libreOfficePath: null,
      python: false,
      pythonPath: null,
      pythonVersion: null,
      unoHelper: false,
      pdfRenderer: false,
      pdfRendererPath: null,
      pdfRendererTool: null,
      githubToken: false,
    });
  });
});
