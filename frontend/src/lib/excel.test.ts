import { describe, expect, it, vi } from "vitest";

import { downloadExcel } from "@/lib/excel";

describe("downloadExcel", () => {
  it("builds a workbook with summary + data sheets and triggers a download", async () => {
    const clicks: string[] = [];
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:fake"),
      revokeObjectURL: vi.fn(),
    });
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === "a") el.click = () => clicks.push((el as HTMLAnchorElement).download);
      return el;
    });

    await downloadExcel(
      "test-report",
      [
        {
          name: "Results: with/bad*chars and a very long name over the limit",
          columns: [
            { header: "Keyword", key: "keyword" },
            { header: "Volume", key: "volume" },
          ],
          rows: [{ keyword: "pizza", volume: 1000 }],
        },
        { name: "Empty", columns: [{ header: "X", key: "x" }], rows: [] }, // skipped
      ],
      { Report: "Test", Generated: "now" },
    );

    expect(clicks).toEqual(["test-report.xlsx"]);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does nothing when every sheet is empty and no summary given", async () => {
    const create = vi.spyOn(document, "createElement");
    await downloadExcel("empty", [
      { name: "A", columns: [{ header: "X", key: "x" }], rows: [] },
    ]);
    expect(create).not.toHaveBeenCalledWith("a");
    vi.restoreAllMocks();
  });
});
