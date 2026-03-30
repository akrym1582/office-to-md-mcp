import ExcelJS from "exceljs";
import { AppError, ErrorCode } from "../types/errors.js";
import { logger } from "../utils/logger.js";

export interface SheetData {
  name: string;
  rows: CellData[][];
  mergedCells?: string[];
}

export interface CellData {
  address: string;
  value: unknown;
  formula?: string;
  type: string;
}

export interface ExcelExtractResult {
  sheets: SheetData[];
  sheetCount: number;
}

export async function extractExcelData(
  filePath: string,
  includeFormulas = false,
  includeMergedCells = false
): Promise<ExcelExtractResult> {
  logger.info("Extracting Excel data", { filePath });
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(filePath);
  } catch (err) {
    throw new AppError(ErrorCode.EXCEL_TEXT_EXTRACTION_FAILED, `Failed to read Excel file: ${(err as Error).message}`, { filePath });
  }
  const sheets: SheetData[] = [];
  workbook.eachSheet((worksheet) => {
    const rows: CellData[][] = [];
    const mergedCells: string[] = [];
    if (includeMergedCells) {
      const model = worksheet.model as { merges?: string[] };
      if (model.merges) mergedCells.push(...model.merges);
    }
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const rowData: CellData[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        const cellData: CellData = {
          address: cell.address,
          value: cell.text ?? cell.value,
          type: cell.type ? String(cell.type) : "unknown",
        };
        if (includeFormulas) {
          const f = (cell as unknown as { formula?: string }).formula;
          if (f) cellData.formula = f;
        }
        rowData.push(cellData);
      });
      if (rowData.length > 0) rows.push(rowData);
    });
    sheets.push({ name: worksheet.name, rows, ...(includeMergedCells ? { mergedCells } : {}) });
  });
  return { sheets, sheetCount: sheets.length };
}

export function formatExcelAsMarkdown(data: ExcelExtractResult): string {
  const lines: string[] = [];
  for (const sheet of data.sheets) {
    lines.push(`## Sheet: ${sheet.name}\n`);
    if (sheet.rows.length === 0) { lines.push("_Empty sheet_\n"); continue; }
    const allAddresses = sheet.rows.flat().map((c) => c.address);
    const cols = getColumnsFromAddresses(allAddresses);
    const rowNums = getRowNumbersFromAddresses(allAddresses);
    if (cols.length === 0 || rowNums.length === 0) { lines.push("_Empty sheet_\n"); continue; }
    const cellMap = new Map<string, CellData>();
    for (const row of sheet.rows) for (const cell of row) cellMap.set(cell.address, cell);
    const firstRow = rowNums[0];
    lines.push("| " + cols.map((col) => formatCellValue(cellMap.get(`${col}${firstRow}`)) ?? "").join(" | ") + " |");
    lines.push("| " + cols.map(() => "---").join(" | ") + " |");
    for (const rowNum of rowNums.slice(1)) {
      lines.push("| " + cols.map((col) => formatCellValue(cellMap.get(`${col}${rowNum}`)) ?? "").join(" | ") + " |");
    }
    lines.push("");
    if (sheet.mergedCells && sheet.mergedCells.length > 0) lines.push(`_Merged cells: ${sheet.mergedCells.join(", ")}_\n`);
  }
  return lines.join("\n");
}

function formatCellValue(cell: CellData | undefined): string {
  if (!cell) return "";
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && v !== null && "result" in v) return String((v as { result: unknown }).result ?? "");
  return String(v);
}

function getColumnsFromAddresses(addresses: string[]): string[] {
  const cols = new Set<string>();
  for (const addr of addresses) cols.add(addr.replace(/[0-9]/g, ""));
  return [...cols].sort((a, b) => a.length !== b.length ? a.length - b.length : a.localeCompare(b));
}

function getRowNumbersFromAddresses(addresses: string[]): number[] {
  const rows = new Set<number>();
  for (const addr of addresses) { const r = parseInt(addr.replace(/[A-Z]/gi, ""), 10); if (!isNaN(r)) rows.add(r); }
  return [...rows].sort((a, b) => a - b);
}
