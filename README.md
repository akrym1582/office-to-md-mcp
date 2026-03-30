# office-to-md-mcp

A TypeScript **Model Context Protocol (MCP) server** that converts Excel, Word, and PDF documents into PNG page images, structured text, and Markdown — optimised for LLM consumption.

---

## Features

| Tool | Input | Output |
|---|---|---|
| `convert_excel_to_images` | `.xlsx` / `.xls` | PNG images per page |
| `convert_word_to_images` | `.docx` / `.doc` | PNG images per page |
| `convert_pdf_to_images` | `.pdf` | PNG images per page |
| `extract_excel_text` | `.xlsx` / `.xls` | Markdown (via image-based conversion) |
| `extract_word_text` | `.docx` | Plain text or Markdown |
| `get_capabilities` | — | Runtime dependency status |

### `extract_excel_text` Conversion Pipeline

`extract_excel_text` converts Excel files to Markdown through the following image-based pipeline:

```
Excel (.xlsx/.xls)
  → Adjust print area and convert to PDF (Python UNO / LibreOffice)
    → Render PDF pages as PNG images (pdftoppm / ImageMagick)
      → Convert images to Markdown (GitHub Copilot SDK — gpt-5.4-mini)
```

This approach preserves not only cell data but also shapes, embedded images, and complex layouts with high fidelity.

> **⚠️ GitHub Copilot Premium Requests**
>
> `extract_excel_text` uses GitHub Copilot SDK's **gpt-5.4-mini** model for image-to-Markdown conversion.
> Each tool invocation consumes **GitHub Copilot Premium Requests**.
> The number of requests increases with the number of pages in the workbook.

---

## Prerequisites

| Dependency | Purpose | Required |
|---|---|---|
| [Node.js](https://nodejs.org/) ≥ 18 | Runtime | ✅ |
| [LibreOffice](https://www.libreoffice.org/) (`soffice`) | Excel/Word → PDF | For image conversion |
| [poppler-utils](https://poppler.freedesktop.org/) (`pdftoppm`) | PDF → PNG | For image conversion |
| Python 3 | Excel UNO helper | For best Excel rendering |
| [GitHub CLI](https://cli.github.com/) (`gh`) with GitHub Copilot CLI access | Required by the GitHub Copilot SDK integration | Required for `extract_excel_text` |
| `GITHUB_TOKEN` env var | Copilot SDK auth | Required for `extract_excel_text` |

### Install system dependencies (Ubuntu/Debian)

```bash
sudo apt-get install -y libreoffice poppler-utils python3 gh
```

### Install system dependencies (macOS)

```bash
brew install libreoffice poppler python3 gh
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

Converts an Excel workbook to Markdown via an image-based pipeline (Excel → print-area adjustment → PDF → images → Markdown). Handles shapes, embedded images, and complex layouts. Requires `GITHUB_TOKEN`.

```json
{
  "filePath": "/path/to/file.xlsx",
  "dpi": 150,
  "sheetNames": ["Sheet1"]
}
```

Response:
```json
{
  "sourceType": "excel",
  "textFormat": "markdown",
  "content": "## Page 1\n\n| Name | Age |\n| --- | --- |\n| Alice | 30 |",
  "images": ["/tmp/excel-images-xxx/page-1.png"],
  "pageCount": 1
}
```

> Image-to-Markdown conversion uses GitHub Copilot SDK (default model: `gpt-5.4-mini`) and consumes Premium Requests.

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
│   │   └── extractExcelText.ts
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
