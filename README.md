# office-to-md-mcp

A TypeScript **Model Context Protocol (MCP) server** that converts Excel, Word, and PDF documents into PNG page images, structured text, and Markdown — optimised for LLM consumption.

---

## Features

| Tool | Input | Output |
|---|---|---|
| `convert_excel_to_images` | `.xlsx` / `.xls` | PNG images per page |
| `convert_word_to_images` | `.docx` / `.doc` | PNG images per page |
| `convert_pdf_to_images` | `.pdf` | PNG images per page |
| `extract_excel_text` | `.xlsx` / `.xls` | Markdown table or JSON |
| `extract_word_text` | `.docx` | Plain text or Markdown |
| `convert_pdf_images_to_markdown` | `.pdf` | Markdown via GitHub Copilot SDK |
| `render_document` | any above | Images + text/Markdown unified |
| `get_capabilities` | — | Runtime dependency status |

---

## Prerequisites

| Dependency | Purpose | Required |
|---|---|---|
| [Node.js](https://nodejs.org/) ≥ 18 | Runtime | ✅ |
| [LibreOffice](https://www.libreoffice.org/) (`soffice`) | Excel/Word → PDF | For image conversion |
| [poppler-utils](https://poppler.freedesktop.org/) (`pdftoppm`) | PDF → PNG | For image conversion |
| Python 3 | Excel UNO helper | For best Excel rendering |
| `GITHUB_TOKEN` env var | Copilot SDK auth | Optional |

### Install system dependencies (Ubuntu/Debian)

```bash
sudo apt-get install -y libreoffice poppler-utils python3
```

### Install system dependencies (macOS)

```bash
brew install libreoffice poppler python3
```

---

## Installation

```bash
npm install
npm run build
```

---

## Running the server

```bash
npm start
```

The server communicates over **stdio** using the MCP protocol.

### Environment variables

| Variable | Description |
|---|---|
| `GITHUB_TOKEN` | GitHub personal access token for Copilot SDK Markdown conversion |
| `COPILOT_MODEL` | Copilot model to use for image-to-Markdown conversion (default: `gpt-5.4-mini`) |
| `LOG_LEVEL` | Log verbosity: `debug` \| `info` (default) \| `warn` \| `error` |

---

## MCP Tool Reference

### `convert_excel_to_images`

Converts an Excel workbook to PNG page images.  
Uses the Python UNO helper (`python/excel_to_pdf_uno.py`) for accurate print-area handling when Python is available; falls back to LibreOffice CLI otherwise.

```json
{
  "filePath": "/path/to/file.xlsx",
  "outputDir": "/tmp/output",
  "dpi": 150,
  "sheetNames": ["Sheet1"],
  "keepPdf": false
}
```

Response:
```json
{
  "sourceType": "excel",
  "images": ["/tmp/output/page-1.png"],
  "pageCount": 1,
  "renderStrategy": "libreoffice-uno-print-area"
}
```

---

### `convert_word_to_images`

Converts a Word document to PNG page images via LibreOffice.

```json
{
  "filePath": "/path/to/file.docx",
  "outputDir": "/tmp/output",
  "dpi": 150,
  "keepPdf": false
}
```

---

### `convert_pdf_to_images`

Renders each PDF page as a PNG image.

```json
{
  "filePath": "/path/to/file.pdf",
  "outputDir": "/tmp/output",
  "dpi": 150
}
```

---

### `extract_excel_text`

Extracts cell data from an Excel workbook.

```json
{
  "filePath": "/path/to/file.xlsx",
  "format": "markdown",
  "includeFormulas": false,
  "includeMergedCells": false
}
```

Response:
```json
{
  "sourceType": "excel",
  "textFormat": "markdown",
  "content": "## Sheet: Sheet1\n\n| Name | Age |\n| --- | --- |\n| Alice | 30 |"
}
```

---

### `extract_word_text`

Extracts text from a `.docx` file using [mammoth](https://github.com/mwilliamson/mammoth.js).

```json
{
  "filePath": "/path/to/file.docx",
  "format": "markdown"
}
```

---

### `convert_pdf_images_to_markdown`

Converts PDF pages to Markdown using the GitHub Copilot SDK (requires `GITHUB_TOKEN`).

```json
{
  "filePath": "/path/to/file.pdf",
  "dpi": 150,
  "mergePages": true,
  "preservePageHeadings": true
}
```

Response:
```json
{
  "sourceType": "pdf",
  "markdown": "## Page 1\n\n...",
  "provider": "github-copilot-sdk"
}
```

If the token is unavailable, `provider` will be `"unavailable"` and no error is thrown.

---

### `render_document`

Unified tool that auto-detects file type and routes to the appropriate pipeline.

```json
{
  "filePath": "/path/to/file.xlsx",
  "outputMode": "all",
  "dpi": 150
}
```

`outputMode` options: `"images"` | `"text"` | `"markdown"` | `"all"`

---

### `get_capabilities`

Returns the runtime status of all system dependencies.

```json
{}
```

Example response:
```json
{
  "libreOffice": true,
  "libreOfficePath": "/usr/bin/soffice",
  "python": true,
  "pythonPath": "/usr/bin/python3",
  "pythonVersion": "Python 3.12.3",
  "unoHelper": true,
  "pdfRenderer": true,
  "pdfRendererTool": "pdftoppm",
  "githubToken": false
}
```

---

## Project Structure

```
.
├── src/
│   ├── server.ts                      # MCP server entry point
│   ├── tools/                         # MCP tool implementations
│   │   ├── convertExcelToImages.ts
│   │   ├── convertWordToImages.ts
│   │   ├── convertPdfToImages.ts
│   │   ├── extractExcelText.ts
│   │   ├── extractWordText.ts
│   │   ├── convertPdfImagesToMarkdown.ts
│   │   └── renderDocument.ts
│   ├── services/                      # Business logic / external integrations
│   │   ├── capabilityDetector.ts
│   │   ├── copilotCli.ts
│   │   ├── excelExtractor.ts
│   │   ├── fileType.ts
│   │   ├── libreOfficeCli.ts
│   │   ├── officePythonBridge.ts
│   │   ├── pdfRenderer.ts
│   │   ├── tempFiles.ts
│   │   └── wordExtractor.ts
│   ├── types/
│   │   ├── errors.ts                  # AppError + ErrorCode enum
│   │   └── toolSchemas.ts             # Zod schemas for all tools
│   └── utils/
│       ├── exec.ts                    # Subprocess wrapper with timeouts
│       ├── fs.ts                      # File system helpers
│       └── logger.ts                  # Stderr logger
├── python/
│   └── excel_to_pdf_uno.py            # LibreOffice UNO helper for Excel→PDF
├── test/
│   ├── fixtures/                      # Sample .xlsx, .docx, .pdf files
│   └── unit/                          # Unit tests
├── package.json
├── tsconfig.json
└── jest.config.js
```

---

## Development

```bash
# Type-check without emitting
npm run typecheck

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint
```

---

## Error Codes

| Code | Meaning |
|---|---|
| `FILE_NOT_FOUND` | Input file does not exist |
| `UNSUPPORTED_FORMAT` | File extension not supported |
| `LIBREOFFICE_NOT_FOUND` | `soffice` not on PATH |
| `PYTHON_NOT_FOUND` | Python interpreter not found |
| `LIBREOFFICE_UNO_CONVERSION_FAILED` | Python UNO helper failed |
| `LIBREOFFICE_CLI_CONVERSION_FAILED` | LibreOffice CLI conversion failed |
| `PDF_RENDER_TOOL_NOT_FOUND` | `pdftoppm`/`convert` not on PATH |
| `PDF_RENDER_FAILED` | PDF rendering failed |
| `EXCEL_TEXT_EXTRACTION_FAILED` | ExcelJS read failure |
| `WORD_TEXT_EXTRACTION_FAILED` | mammoth extraction failure |
| `GITHUB_TOKEN_MISSING` | `GITHUB_TOKEN` env var not set |
| `COPILOT_MARKDOWN_FAILED` | Copilot CLI returned an error |
| `INVALID_TOOL_INPUT` | Zod schema validation failed |

---

## Troubleshooting

**LibreOffice not found**  
Install LibreOffice and ensure `soffice` is on your `PATH`.

**pdftoppm not found**  
Install `poppler-utils` (`apt-get install poppler-utils` or `brew install poppler`).

**Copilot SDK unavailable**  
Set `GITHUB_TOKEN` in your environment. The model used can be customised via the `COPILOT_MODEL` environment variable (default: `gpt-5.4-mini`).

**Excel conversion uses LibreOffice CLI instead of UNO**  
Python 3 must be on `PATH` and `python/excel_to_pdf_uno.py` must exist alongside the server. Run `get_capabilities` to confirm.

---

## License

MIT