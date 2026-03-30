import * as fs from "fs";
import * as path from "path";

describe("repository wiring", () => {
  const repoRoot = path.resolve(__dirname, "..");

  it("provides the missing src/server.ts entrypoint", () => {
    expect(fs.existsSync(path.join(repoRoot, "src/server.ts"))).toBe(true);
  });

  it("moves github instructions under .github", () => {
    expect(fs.existsSync(path.join(repoRoot, ".github/github-instruction.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "github-instruction.md"))).toBe(false);
  });

  it("uses a dev script that does not point at the missing ts-node entry", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")
    ) as { scripts: { dev: string } };

    expect(packageJson.scripts.dev).toBe("npm run build && node dist/server.js");
  });
});

describe("server module", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("registers the expected tools and formats tool results", () => {
    const registerTool = jest.fn();
    const connect = jest.fn();
    const mcpServerMock = jest.fn().mockImplementation(() => ({
      registerTool,
      connect,
    }));
    const transportMock = jest.fn();
    const convertExcelToImages = jest.fn().mockResolvedValue({ ok: "excel" });
    const convertWordToImages = jest.fn().mockResolvedValue({ ok: "word" });
    const convertPdfToImages = jest.fn().mockResolvedValue({ ok: "pdf" });
    const extractExcelText = jest.fn().mockResolvedValue({ ok: "extract-excel" });
    const extractWordText = jest.fn().mockResolvedValue({ text: "plain", markdown: "# md" });
    const detectCapabilities = jest.fn().mockResolvedValue({ libreOffice: true });

    jest.doMock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
      McpServer: mcpServerMock,
    }));
    jest.doMock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
      StdioServerTransport: transportMock,
    }));
    jest.doMock("../src/services/capabilityDetector.js", () => ({
      detectCapabilities,
    }));
    jest.doMock("../src/services/wordExtractor.js", () => ({
      extractWordText,
    }));
    jest.doMock("../src/types/toolSchemas.js", () => ({
      ConvertExcelToImagesSchema: { kind: "excel" },
      ConvertPdfToImagesSchema: { kind: "pdf" },
      ConvertWordToImagesSchema: { kind: "word" },
      ExtractExcelTextSchema: { kind: "extract-excel" },
      ExtractWordTextSchema: { kind: "extract-word" },
      GetCapabilitiesSchema: { kind: "caps" },
    }));
    jest.doMock("../src/tools/convertExcelToImages.js", () => ({
      convertExcelToImages,
    }));
    jest.doMock("../src/tools/convertPdfToImages.js", () => ({
      convertPdfToImages,
    }));
    jest.doMock("../src/tools/convertWordToImages.js", () => ({
      convertWordToImages,
    }));
    jest.doMock("../src/tools/extractExcelText.js", () => ({
      extractExcelText,
    }));
    jest.doMock("../src/utils/logger.js", () => ({
      logger: {
        info: jest.fn(),
        error: jest.fn(),
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createServer } = require("../src/server.ts");
    createServer();

    expect(mcpServerMock).toHaveBeenCalledWith({ name: "office-to-md-mcp", version: "1.0.0" });
    expect(registerTool).toHaveBeenCalledTimes(6);

    const handlers = Object.fromEntries(registerTool.mock.calls.map(([name, _config, handler]) => [name, handler]));
    return Promise.all([
      handlers.convert_excel_to_images({ filePath: "/tmp/book.xlsx" }),
      handlers.convert_word_to_images({ filePath: "/tmp/doc.docx" }),
      handlers.convert_pdf_to_images({ filePath: "/tmp/doc.pdf" }),
      handlers.extract_excel_text({ filePath: "/tmp/book.xlsx" }),
      handlers.extract_word_text({ filePath: "/tmp/doc.docx", format: "markdown" }),
      handlers.get_capabilities({}),
    ]).then((results) => {
      expect(results[0]).toEqual({
        content: [{ type: "text", text: JSON.stringify({ ok: "excel" }, null, 2) }],
        structuredContent: { ok: "excel" },
      });
      expect(results[4]).toEqual({
        content: [{ type: "text", text: JSON.stringify({ sourceType: "word", textFormat: "markdown", content: "# md" }, null, 2) }],
        structuredContent: { sourceType: "word", textFormat: "markdown", content: "# md" },
      });
      expect(detectCapabilities).toHaveBeenCalledWith(expect.stringContaining("python/excel_to_pdf_uno.py"));
    });
  });

  it("connects the stdio transport when runServer is invoked", async () => {
    const connect = jest.fn().mockResolvedValue(undefined);
    const registerTool = jest.fn();
    const transportInstance = {};
    const transportMock = jest.fn().mockImplementation(() => transportInstance);

    jest.doMock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
      McpServer: jest.fn().mockImplementation(() => ({
        registerTool,
        connect,
      })),
    }));
    jest.doMock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
      StdioServerTransport: transportMock,
    }));
    jest.doMock("../src/services/capabilityDetector.js", () => ({
      detectCapabilities: jest.fn(),
    }));
    jest.doMock("../src/services/wordExtractor.js", () => ({
      extractWordText: jest.fn(),
    }));
    jest.doMock("../src/types/toolSchemas.js", () => ({
      ConvertExcelToImagesSchema: {},
      ConvertPdfToImagesSchema: {},
      ConvertWordToImagesSchema: {},
      ExtractExcelTextSchema: {},
      ExtractWordTextSchema: {},
      GetCapabilitiesSchema: {},
    }));
    jest.doMock("../src/tools/convertExcelToImages.js", () => ({
      convertExcelToImages: jest.fn(),
    }));
    jest.doMock("../src/tools/convertPdfToImages.js", () => ({
      convertPdfToImages: jest.fn(),
    }));
    jest.doMock("../src/tools/convertWordToImages.js", () => ({
      convertWordToImages: jest.fn(),
    }));
    jest.doMock("../src/tools/extractExcelText.js", () => ({
      extractExcelText: jest.fn(),
    }));
    jest.doMock("../src/utils/logger.js", () => ({
      logger: {
        info: jest.fn(),
        error: jest.fn(),
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runServer } = require("../src/server.ts");
    await runServer();

    expect(transportMock).toHaveBeenCalled();
    expect(connect).toHaveBeenCalledWith(transportInstance);
  });
});
