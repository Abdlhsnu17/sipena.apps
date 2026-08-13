import { beforeEach, describe, expect, it, vi } from "vitest";

import { toIsoDateTimeString } from "../utils/date-input";

const getMock = vi.fn();
const postMock = vi.fn();
const putMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("./api.service", () => ({
  default: {
    get: getMock,
    post: postMock,
    put: putMock,
    delete: deleteMock,
  },
}));

describe("assetService", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();

    getMock.mockResolvedValue({ success: true, message: "ok", data: [] });
    postMock.mockResolvedValue({ success: true, message: "ok", data: { id: 1 } });
    putMock.mockResolvedValue({ success: true, message: "ok", data: { id: 1 } });
    deleteMock.mockResolvedValue({ success: true, message: "ok" });
  });

  it("mengubah tanggal aset menjadi ISO UTC saat create", async () => {
    const { assetService } = await import("./asset.service");

    await assetService.create({
      name: "Bed",
      category: "Perawatan",
      type: "medical",
      status: "available",
      condition: "good",
      purchaseDate: "2026-08-14",
      warrantyExpiry: "2027-08-14",
    });

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock.mock.calls[0][1]).toMatchObject({
      purchaseDate: toIsoDateTimeString("2026-08-14"),
      warrantyExpiry: toIsoDateTimeString("2027-08-14"),
    });
  });

  it("mengubah tanggal aset menjadi ISO UTC saat update", async () => {
    const { assetService } = await import("./asset.service");

    await assetService.update(1, {
      purchaseDate: "2026-08-14",
      warrantyExpiry: "2027-08-14",
    });

    expect(putMock).toHaveBeenCalledTimes(1);
    expect(putMock.mock.calls[0][1]).toMatchObject({
      purchaseDate: toIsoDateTimeString("2026-08-14"),
      warrantyExpiry: toIsoDateTimeString("2027-08-14"),
    });
  });
});
