const path = require("path");
const { logger } = require("./utils/logger.js");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { detectCapabilities } = require("./services/capabilityDetector.js");
const { extractWordText } = require("./services/wordExtractor.js");
const {
  ConvertExcelToImagesSchema,
  ConvertPdfToImagesSchema,
  ConvertWordToImagesSchema,
  ExtractExcelTextSchema,
  ExtractWordTextSchema,
  GetCapabilitiesSchema,
} = require("./types/toolSchemas.js");
const { convertExcelToImages } = require("./tools/convertExcelToImages.js");
const { convertPdfToImages } = require("./tools/convertPdfToImages.js");
const { convertWordToImages } = require("./tools/convertWordToImages.js");
const { extractExcelText } = require("./tools/extractExcelText.js");

const SERVER_INFO = {
  name: "office-to-md-mcp",
  version: "1.0.0",
};

const UNO_HELPER_PATH = path.resolve(__dirname, "../python/excel_to_pdf_uno.py");

function toToolResult(data: unknown) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
    structuredContent: data,
  };
}

export function createServer() {
  const server = new McpServer(SERVER_INFO);

  server.registerTool(
    "convert_excel_to_images",
    {
      description: "Convert an Excel workbook into page images.",
      inputSchema: ConvertExcelToImagesSchema,
    },
    async (args: unknown) => toToolResult(await convertExcelToImages(args))
  );

  server.registerTool(
    "convert_word_to_images",
    {
      description: "Convert a Word document into page images.",
      inputSchema: ConvertWordToImagesSchema,
    },
    async (args: unknown) => toToolResult(await convertWordToImages(args))
  );

  server.registerTool(
    "convert_pdf_to_images",
    {
      description: "Render a PDF into page images.",
      inputSchema: ConvertPdfToImagesSchema,
    },
    async (args: unknown) => toToolResult(await convertPdfToImages(args))
  );

  server.registerTool(
    "extract_excel_text",
    {
      description: "Extract Markdown from an Excel workbook via image-based conversion (Excel → PDF → Image → Markdown). Handles shapes, images, and complex formatting.",
      inputSchema: ExtractExcelTextSchema,
    },
    async (args: unknown) => toToolResult(await extractExcelText(args))
  );

  server.registerTool(
    "extract_word_text",
    {
      description: "Extract text or Markdown from a .docx file.",
      inputSchema: ExtractWordTextSchema,
    },
    async ({ filePath, format }: { filePath: string; format: "text" | "markdown" }) => {
      const result = await extractWordText(filePath);
      return toToolResult({
        sourceType: "word",
        textFormat: format,
        content: format === "text" ? result.text : result.markdown,
      });
    }
  );

  server.registerTool(
    "get_capabilities",
    {
      description: "Detect runtime dependency availability for document conversion.",
      inputSchema: GetCapabilitiesSchema,
    },
    async () => toToolResult(await detectCapabilities(UNO_HELPER_PATH))
  );

  return server;
}

export async function runServer() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("office-to-md-mcp server is ready");
}

if (require.main === module) {
  void runServer().catch((error: unknown) => {
    logger.error("Failed to start office-to-md-mcp server", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  });
}
