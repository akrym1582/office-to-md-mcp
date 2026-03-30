/**
 * Integration tests for document rendering and text extraction.
 *
 * These tests exercise the real conversion pipeline using system tools:
 *   - LibreOffice (soffice) for document → PDF conversion
 *   - poppler-utils (pdftoppm) for PDF → image rendering
 *   - mammoth for Word text extraction
 *   - ExcelJS for Excel text extraction
 *
 * Tests that depend on external tools are automatically skipped when those
 * tools are not installed, so the suite is safe to run locally without
 * LibreOffice.
 */

import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { execSync } from "child_process";
import ExcelJS from "exceljs";

import { detectCapabilities } from "../../src/services/capabilityDetector.js";
import { convertToPdfWithLibreOffice } from "../../src/services/libreOfficeCli.js";
import { renderPdfToImages } from "../../src/services/pdfRenderer.js";
import {
  extractExcelData,
  formatExcelAsMarkdown,
} from "../../src/services/excelExtractor.js";
import { extractWordText } from "../../src/services/wordExtractor.js";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const HAS_LIBREOFFICE = commandExists("soffice");
const HAS_PDFTOPPM = commandExists("pdftoppm");

let tempDir: string;

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "office-to-md-integration-"));
});

afterAll(() => {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

/** Create a small .xlsx workbook with known content. */
async function createTestXlsx(filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("TestSheet");
  sheet.addRow(["Name", "Age", "City"]);
  sheet.addRow(["Alice", 30, "Tokyo"]);
  sheet.addRow(["Bob", 25, "Osaka"]);
  await workbook.xlsx.writeFile(filePath);
}

/**
 * Create a plain-text file and convert it to .docx using LibreOffice.
 * Returns the path to the generated .docx.
 */
function createTestDocx(dir: string): string {
  const txtPath = path.join(dir, "sample.txt");
  fs.writeFileSync(
    txtPath,
    "Hello World\nThis is a test document.\nThird line of text.",
  );
  execSync(
    `soffice --headless --convert-to docx --outdir "${dir}" "${txtPath}"`,
    { timeout: 60_000 },
  );
  const docxPath = path.join(dir, "sample.docx");
  if (!fs.existsSync(docxPath)) {
    throw new Error(`LibreOffice did not produce ${docxPath}`);
  }
  return docxPath;
}

/* ================================================================== */
/*  1. Capability Detection                                            */
/* ================================================================== */

describe("Integration: capabilityDetector", () => {
  (HAS_LIBREOFFICE ? it : it.skip)(
    "detects real soffice path on the system",
    async () => {
      const caps = await detectCapabilities();
      expect(caps.libreOffice).toBe(true);
      expect(caps.libreOfficePath).toBeTruthy();
    },
  );

  (HAS_PDFTOPPM ? it : it.skip)(
    "detects real pdftoppm path on the system",
    async () => {
      const caps = await detectCapabilities();
      expect(caps.pdfRenderer).toBe(true);
      expect(caps.pdfRendererTool).toBe("pdftoppm");
      expect(caps.pdfRendererPath).toBeTruthy();
    },
  );
});

/* ================================================================== */
/*  2. LibreOffice CLI – document → PDF                                */
/* ================================================================== */

(HAS_LIBREOFFICE ? describe : describe.skip)(
  "Integration: libreOfficeCli",
  () => {
    it(
      "converts an .xlsx file to PDF",
      async () => {
        const xlsxPath = path.join(tempDir, "lo-test.xlsx");
        await createTestXlsx(xlsxPath);

        const outDir = path.join(tempDir, "lo-xlsx-out");
        fs.mkdirSync(outDir, { recursive: true });

        const pdfPath = await convertToPdfWithLibreOffice(xlsxPath, outDir);

        expect(fs.existsSync(pdfPath)).toBe(true);
        expect(fs.statSync(pdfPath).size).toBeGreaterThan(0);
        expect(pdfPath.endsWith(".pdf")).toBe(true);
      },
      120_000,
    );

    it(
      "converts a .docx file to PDF",
      async () => {
        const docxDir = path.join(tempDir, "lo-docx-src");
        fs.mkdirSync(docxDir, { recursive: true });
        const docxPath = createTestDocx(docxDir);

        const outDir = path.join(tempDir, "lo-docx-out");
        fs.mkdirSync(outDir, { recursive: true });

        const pdfPath = await convertToPdfWithLibreOffice(docxPath, outDir);

        expect(fs.existsSync(pdfPath)).toBe(true);
        expect(fs.statSync(pdfPath).size).toBeGreaterThan(0);
        expect(pdfPath.endsWith(".pdf")).toBe(true);
      },
      120_000,
    );
  },
);

/* ================================================================== */
/*  3. PDF Renderer – PDF → images                                     */
/* ================================================================== */

(HAS_LIBREOFFICE && HAS_PDFTOPPM ? describe : describe.skip)(
  "Integration: pdfRenderer",
  () => {
    it(
      "renders PDF pages to PNG images with pdftoppm",
      async () => {
        // Create a PDF from a text file via LibreOffice
        const srcDir = path.join(tempDir, "pdf-src");
        fs.mkdirSync(srcDir, { recursive: true });
        const txtPath = path.join(srcDir, "render-test.txt");
        fs.writeFileSync(txtPath, "Page content for PDF rendering test.");
        execSync(
          `soffice --headless --convert-to pdf --outdir "${srcDir}" "${txtPath}"`,
          { timeout: 60_000 },
        );
        const pdfPath = path.join(srcDir, "render-test.pdf");
        expect(fs.existsSync(pdfPath)).toBe(true);

        // Render the PDF to images
        const imgDir = path.join(tempDir, "pdf-images");
        fs.mkdirSync(imgDir, { recursive: true });

        const result = await renderPdfToImages(pdfPath, imgDir, 150, "pdftoppm");

        expect(result.images.length).toBeGreaterThan(0);
        expect(result.pageCount).toBeGreaterThan(0);

        for (const img of result.images) {
          expect(fs.existsSync(img)).toBe(true);
          expect(fs.statSync(img).size).toBeGreaterThan(0);
          // Verify PNG magic bytes: 0x89 0x50 0x4E 0x47
          const header = Buffer.alloc(4);
          const fd = fs.openSync(img, "r");
          fs.readSync(fd, header, 0, 4, 0);
          fs.closeSync(fd);
          expect(header[0]).toBe(0x89);
          expect(header[1]).toBe(0x50);
          expect(header[2]).toBe(0x4e);
          expect(header[3]).toBe(0x47);
        }
      },
      120_000,
    );
  },
);

/* ================================================================== */
/*  4. Excel Extractor – .xlsx → structured data                       */
/* ================================================================== */

describe("Integration: excelExtractor", () => {
  it("extracts real data from an .xlsx file", async () => {
    const xlsxPath = path.join(tempDir, "excel-extract.xlsx");
    await createTestXlsx(xlsxPath);

    const data = await extractExcelData(xlsxPath);

    expect(data.sheetCount).toBe(1);
    expect(data.sheets.length).toBe(1);
    expect(data.sheets[0].name).toBe("TestSheet");
    expect(data.sheets[0].rows.length).toBe(3);

    // Verify first row (header)
    const headerValues = data.sheets[0].rows[0].map((c) => c.value);
    expect(headerValues).toEqual(["Name", "Age", "City"]);

    // Verify data rows
    const row1Values = data.sheets[0].rows[1].map((c) => c.value);
    expect(row1Values).toContain("Alice");

    const row2Values = data.sheets[0].rows[2].map((c) => c.value);
    expect(row2Values).toContain("Bob");
  });

  it("formats extracted data as Markdown table", async () => {
    const xlsxPath = path.join(tempDir, "excel-md.xlsx");
    await createTestXlsx(xlsxPath);

    const data = await extractExcelData(xlsxPath);
    const md = formatExcelAsMarkdown(data);

    expect(md).toContain("TestSheet");
    expect(md).toContain("Name");
    expect(md).toContain("Alice");
    expect(md).toContain("Tokyo");
    expect(md).toContain("Bob");
    expect(md).toContain("Osaka");
    // Markdown table should contain pipe separators
    expect(md).toContain("|");
    expect(md).toContain("---");
  });
});

/* ================================================================== */
/*  5. Word Extractor – .docx → text                                   */
/* ================================================================== */

(HAS_LIBREOFFICE ? describe : describe.skip)(
  "Integration: wordExtractor",
  () => {
    it(
      "extracts text from a real .docx file",
      async () => {
        const docxDir = path.join(tempDir, "word-extract");
        fs.mkdirSync(docxDir, { recursive: true });
        const docxPath = createTestDocx(docxDir);

        const result = await extractWordText(docxPath);

        expect(result.text).toContain("Hello World");
        expect(result.text).toContain("test document");
        expect(typeof result.markdown).toBe("string");
        expect(result.markdown.length).toBeGreaterThan(0);
      },
      120_000,
    );
  },
);

/* ================================================================== */
/*  6. Full Pipeline: .xlsx → PDF → images                             */
/* ================================================================== */

(HAS_LIBREOFFICE && HAS_PDFTOPPM ? describe : describe.skip)(
  "Integration: full pipeline (xlsx → PDF → images)",
  () => {
    it(
      "converts an Excel file end-to-end to PNG images",
      async () => {
        // 1. Create an .xlsx fixture
        const xlsxPath = path.join(tempDir, "pipeline.xlsx");
        await createTestXlsx(xlsxPath);

        // 2. Excel → PDF via LibreOffice
        const pdfDir = path.join(tempDir, "pipeline-pdf");
        fs.mkdirSync(pdfDir, { recursive: true });
        const pdfPath = await convertToPdfWithLibreOffice(xlsxPath, pdfDir);
        expect(fs.existsSync(pdfPath)).toBe(true);
        expect(fs.statSync(pdfPath).size).toBeGreaterThan(0);

        // 3. PDF → images via pdftoppm
        const imgDir = path.join(tempDir, "pipeline-images");
        fs.mkdirSync(imgDir, { recursive: true });
        const result = await renderPdfToImages(pdfPath, imgDir, 150, "pdftoppm");
        expect(result.images.length).toBeGreaterThan(0);
        expect(result.pageCount).toBeGreaterThan(0);

        // 4. Verify output images are valid PNGs
        for (const img of result.images) {
          expect(fs.existsSync(img)).toBe(true);
          const stat = fs.statSync(img);
          expect(stat.size).toBeGreaterThan(0);
        }
      },
      180_000,
    );
  },
);
