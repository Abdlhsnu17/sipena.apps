import { beforeEach, describe, expect, it, vi } from "vitest";

import { toIsoDateTimeString } from "../utils/date-input";

const getMock = vi.fn();
const postMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("./api.service", () => ({
  default: {
    get: getMock,
    post: postMock,
    delete: deleteMock,
  },
}));

describe("reportService", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    deleteMock.mockReset();

    getMock.mockResolvedValue({ success: true, message: "ok", data: [] });
    postMock.mockResolvedValue({ success: true, message: "ok", data: { id: 1 } });
    deleteMock.mockResolvedValue({ success: true, message: "ok" });
  });

  it("mengubah retentionUntil menjadi ISO UTC saat upload", async () => {
    const { reportService } = await import("./report.service");
    const file = new File(["dummy"], "laporan.pdf", { type: "application/pdf" });

    await reportService.uploadReport(file, {
      notes: "Arsip",
      category: "umum",
      relatedModule: "maintenance",
      retentionUntil: "2026-08-14",
    });

    expect(postMock).toHaveBeenCalledTimes(1);
    const formData = postMock.mock.calls[0][1] as FormData;
    expect(Array.from(formData.entries())).toEqual(
      expect.arrayContaining([
        ["notes", "Arsip"],
        ["category", "umum"],
        ["relatedModule", "maintenance"],
        ["retentionUntil", toIsoDateTimeString("2026-08-14")],
      ]),
    );
  });
});
