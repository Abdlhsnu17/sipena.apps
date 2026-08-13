import { beforeEach, describe, expect, it, vi } from "vitest";

import { toIsoDateTimeString } from "../utils/date-input";

const getMock = vi.fn();
const postMock = vi.fn();
const patchMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("./api.service", () => ({
  default: {
    get: getMock,
    post: postMock,
    patch: patchMock,
    delete: deleteMock,
  },
}));

describe("borrowingService", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();

    getMock.mockResolvedValue({ success: true, message: "ok", data: [] });
    postMock.mockResolvedValue({
      success: true,
      message: "ok",
      data: { id: 1, borrowDate: "2026-08-14T09:30:00.000Z" },
    });
    patchMock.mockResolvedValue({
      success: true,
      message: "ok",
      data: { id: 1, borrowDate: "2026-08-14T09:30:00.000Z" },
    });
    deleteMock.mockResolvedValue({ success: true, message: "ok" });
  });

  it("mengubah datetime lokal menjadi ISO UTC saat create", async () => {
    const { borrowingService } = await import("./borrowing.service");

    await borrowingService.create({
      assetId: 11,
      borrowDate: "2026-08-14T09:30",
      dueDate: "2026-08-15T10:15",
      purpose: "Penggunaan ruang",
    });

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock.mock.calls[0][1]).toMatchObject({
      borrowDate: toIsoDateTimeString("2026-08-14T09:30"),
      dueDate: toIsoDateTimeString("2026-08-15T10:15"),
    });
  });

  it("mengubah datetime lokal menjadi ISO UTC saat update", async () => {
    const { borrowingService } = await import("./borrowing.service");

    await borrowingService.update(1, {
      borrowDate: "2026-08-14T09:30",
      dueDate: "2026-08-15T10:15",
      purpose: "Perpanjangan penggunaan",
    });

    expect(patchMock).toHaveBeenCalledTimes(1);
    expect(patchMock.mock.calls[0][1]).toMatchObject({
      borrowDate: toIsoDateTimeString("2026-08-14T09:30"),
      dueDate: toIsoDateTimeString("2026-08-15T10:15"),
    });
  });

  it("mengubah tanggal perpanjangan menjadi ISO UTC saat extend", async () => {
    const { borrowingService } = await import("./borrowing.service");

    await borrowingService.extend(1, "2026-08-16T11:45", "Perpanjangan masa pinjam");

    expect(patchMock).toHaveBeenCalledTimes(1);
    expect(patchMock.mock.calls[0][1]).toMatchObject({
      newDueDate: toIsoDateTimeString("2026-08-16T11:45"),
      extensionNotes: "Perpanjangan masa pinjam",
    });
  });
});
