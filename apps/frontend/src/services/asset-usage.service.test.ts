import { beforeEach, describe, expect, it, vi } from "vitest";

import { toIsoDateTimeString } from "../utils/date-input";

const postMock = vi.fn();
const patchMock = vi.fn();

vi.mock("./api.service", () => ({
  default: {
    post: postMock,
    patch: patchMock,
  },
}));

describe("assetUsageService", () => {
  beforeEach(() => {
    postMock.mockReset();
    patchMock.mockReset();
    postMock.mockResolvedValue({ success: true, message: "ok", data: { id: 1, startedAt: "2026-08-14T09:30:00.000Z" } });
    patchMock.mockResolvedValue({ success: true, message: "ok", data: { id: 1, startedAt: "2026-08-14T09:30:00.000Z" } });
  });

  it("mengubah datetime lokal menjadi ISO UTC saat create", async () => {
    const { assetUsageService } = await import("./asset-usage.service");

    await assetUsageService.create({
      assetId: 11,
      assetType: "medical",
      roomName: "Ruang UGD",
      startedAt: "2026-08-14T09:30",
      endedAt: "2026-08-14T10:15",
    });

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock.mock.calls[0][1]).toMatchObject({
      startedAt: toIsoDateTimeString("2026-08-14T09:30"),
      endedAt: toIsoDateTimeString("2026-08-14T10:15"),
    });
  });

  it("mengubah datetime lokal menjadi ISO UTC saat update", async () => {
    const { assetUsageService } = await import("./asset-usage.service");

    await assetUsageService.update(1, {
      startedAt: "2026-08-14T09:30",
      endedAt: "2026-08-14T10:15",
    });

    expect(patchMock).toHaveBeenCalledTimes(1);
    expect(patchMock.mock.calls[0][1]).toMatchObject({
      startedAt: toIsoDateTimeString("2026-08-14T09:30"),
      endedAt: toIsoDateTimeString("2026-08-14T10:15"),
    });
  });
});
