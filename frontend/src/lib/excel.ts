/** Shared Excel export — every analysis page builds sheets from its current
 *  results and calls downloadExcel(). exceljs is imported lazily so it ships
 *  as its own chunk and costs nothing until the user actually exports. */

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ExcelSheet {
  name: string;
  columns: ExcelColumn[];
  rows: Record<string, unknown>[];
}

/** Key–value pairs rendered as a "Report" cover sheet (what/when/where). */
export type ExcelSummary = Record<string, string | number | null | undefined>;

const HEADER_FILL = "FF273879"; // brand navy
const HEADER_FONT = "FFFFFFFF";

/** Excel sheet names: ≤31 chars, no []:*?/\ */
function sheetName(raw: string): string {
  return raw.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sheet";
}

export async function downloadExcel(
  filename: string,
  sheets: ExcelSheet[],
  summary?: ExcelSummary,
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "seodada";
  wb.created = new Date();

  if (summary) {
    const ws = wb.addWorksheet("Report");
    ws.columns = [{ width: 26 }, { width: 60 }];
    for (const [k, v] of Object.entries(summary)) {
      if (v === undefined) continue;
      const row = ws.addRow([k, v ?? "—"]);
      row.getCell(1).font = { bold: true };
    }
  }

  for (const sheet of sheets) {
    if (!sheet.rows.length) continue;
    const ws = wb.addWorksheet(sheetName(sheet.name));
    ws.columns = sheet.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width ?? Math.max(12, Math.min(40, c.header.length + 6)),
    }));
    for (const row of sheet.rows) ws.addRow(row);

    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: HEADER_FONT } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length },
    };
  }

  if (wb.worksheets.length === 0) return; // nothing to export

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
