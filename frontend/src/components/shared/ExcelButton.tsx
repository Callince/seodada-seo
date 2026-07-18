import { FileSpreadsheet } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { downloadExcel, type ExcelSheet, type ExcelSummary } from "@/lib/excel";
import { toast } from "@/store/toast";

/** "Export Excel" for analysis pages. `build` returns the workbook content
 *  from the page's current results, or null when there's nothing to export. */
export function ExcelButton({
  filename,
  build,
  disabled,
}: {
  filename: string;
  build: () => { sheets: ExcelSheet[]; summary?: ExcelSummary } | null;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    const spec = build();
    if (!spec || spec.sheets.every((s) => !s.rows.length)) {
      toast.error("Nothing to export yet — run an analysis first.");
      return;
    }
    setBusy(true);
    try {
      await downloadExcel(filename, spec.sheets, spec.summary);
      toast.success("Excel report downloaded");
    } catch {
      toast.error("Export failed — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="secondary" size="sm" onClick={onClick} loading={busy} disabled={disabled}>
      {!busy && <FileSpreadsheet size={15} />} Excel
    </Button>
  );
}
