type CellShape = {
  address: string;
  value: unknown;
  text?: string;
  type?: string | number;
  formula?: string;
};

type WorksheetShape = {
  name: string;
  model?: { merges?: string[] };
  rows: CellShape[][];
};

const workbookState = {
  readFile: jest.fn(),
  sheets: [] as WorksheetShape[],
};

jest.mock("exceljs", () => {
  class Workbook {
    xlsx = {
      readFile: (...args: unknown[]) => workbookState.readFile(...args),
    };

    eachSheet(callback: (worksheet: WorksheetShape) => void) {
      for (const sheet of workbookState.sheets) {
        callback({
          ...sheet,
          eachRow: (
            _options: { includeEmpty: boolean },
            rowCallback: (row: { eachCell: (_cellOptions: { includeEmpty: boolean }, cellCallback: (cell: CellShape) => void) => void }) => void
          ) => {
            for (const row of sheet.rows) {
              rowCallback({
                eachCell: (_cellOptions, cellCallback) => {
                  for (const cell of row) {
                    cellCallback(cell);
                  }
                },
              });
            }
          },
        } as unknown as WorksheetShape);
      }
    }
  }

  return {
    __esModule: true,
    default: { Workbook },
  };
});

describe("excel extraction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    workbookState.sheets = [];
  });

  it("extracts sheet data, merged cells, and formulas", async () => {
    workbookState.readFile.mockResolvedValue(undefined);
    workbookState.sheets = [
      {
        name: "Summary",
        model: { merges: ["A1:B1"] },
        rows: [
          [
            { address: "A1", value: "Title", text: "Title", type: "String" },
            { address: "B1", value: { result: 3 }, type: "Formula", formula: "SUM(B2:B3)" },
          ],
          [
            { address: "A2", value: "Row 1", type: "String" },
            { address: "B2", value: 1, type: "Number" },
          ],
        ],
      },
      {
        name: "Empty",
        model: {},
        rows: [],
      },
    ];

    const { extractExcelData, formatExcelAsMarkdown } = await import("../src/services/excelExtractor.js");
    const result = await extractExcelData("/tmp/book.xlsx", true, true);

    expect(result.sheetCount).toBe(2);
    expect(result.sheets[0]).toEqual({
      name: "Summary",
      rows: [
        [
          { address: "A1", value: "Title", type: "String" },
          { address: "B1", value: { result: 3 }, type: "Formula", formula: "SUM(B2:B3)" },
        ],
        [
          { address: "A2", value: "Row 1", type: "String" },
          { address: "B2", value: 1, type: "Number" },
        ],
      ],
      mergedCells: ["A1:B1"],
    });
    expect(formatExcelAsMarkdown(result)).toContain("| Title | 3 |");
    expect(formatExcelAsMarkdown(result)).toContain("_Merged cells: A1:B1_");
    expect(formatExcelAsMarkdown(result)).toContain("## Sheet: Empty");
  });

  it("wraps read errors in an AppError", async () => {
    workbookState.readFile.mockRejectedValue(new Error("bad workbook"));

    const { extractExcelData } = await import("../src/services/excelExtractor.js");
    await expect(extractExcelData("/tmp/book.xlsx")).rejects.toMatchObject({
      code: "EXCEL_TEXT_EXTRACTION_FAILED",
      message: "Failed to read Excel file: bad workbook",
      context: { filePath: "/tmp/book.xlsx" },
    });
  });
});
