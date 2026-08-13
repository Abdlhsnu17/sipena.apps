import { beforeEach, describe, expect, it, vi } from "vitest";

import { toIsoDateTimeString } from "../utils/date-input";

const getMock = vi.fn();
const postMock = vi.fn();
const putMock = vi.fn();

vi.mock("./api.service", () => ({
  default: {
    get: getMock,
    post: postMock,
    put: putMock,
  },
}));

describe("maintenanceService", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    getMock.mockResolvedValue({ success: true, message: "ok", data: [] });
    postMock.mockResolvedValue({ success: true, message: "ok", data: { id: 1, scheduledDate: "2026-08-14T09:30:00.000Z" } });
    putMock.mockResolvedValue({ success: true, message: "ok", data: { id: 1, scheduledDate: "2026-08-14T09:30:00.000Z" } });
  });

  it("mengubah datetime lokal menjadi ISO UTC saat create", async () => {
    const { maintenanceService } = await import("./maintenance.service");

    await maintenanceService.create({
      assetId: 11,
      type: "preventive",
      scheduledDate: "2026-08-14T09:30",
      dueAt: "2026-08-14T10:30",
      startedAt: "2026-08-14T09:45",
      completedDate: "2026-08-14T10:15",
      actualStartAt: "2026-08-14T09:45",
      actualEndAt: "2026-08-14T10:15",
      warrantyUntil: "2026-09-01",
      nextMaintenanceDate: "2026-09-15",
      createdBy: 7,
    });

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock.mock.calls[0][1]).toMatchObject({
      scheduledDate: toIsoDateTimeString("2026-08-14T09:30"),
      dueAt: toIsoDateTimeString("2026-08-14T10:30"),
      startedAt: toIsoDateTimeString("2026-08-14T09:45"),
      completedDate: toIsoDateTimeString("2026-08-14T10:15"),
      actualStartAt: toIsoDateTimeString("2026-08-14T09:45"),
      actualEndAt: toIsoDateTimeString("2026-08-14T10:15"),
      warrantyUntil: toIsoDateTimeString("2026-09-01"),
      nextMaintenanceDate: toIsoDateTimeString("2026-09-15"),
    });
  });

  it("mengubah datetime lokal menjadi ISO UTC saat update", async () => {
    const { maintenanceService } = await import("./maintenance.service");

    await maintenanceService.update(1, {
      scheduledDate: "2026-08-14T09:30",
      dueAt: "2026-08-14T10:30",
      startedAt: "2026-08-14T09:45",
      completedDate: "2026-08-14T10:15",
      actualStartAt: "2026-08-14T09:45",
      actualEndAt: "2026-08-14T10:15",
      warrantyUntil: "2026-09-01",
      nextMaintenanceDate: "2026-09-15",
    });

    expect(putMock).toHaveBeenCalledTimes(1);
    expect(putMock.mock.calls[0][1]).toMatchObject({
      scheduledDate: toIsoDateTimeString("2026-08-14T09:30"),
      dueAt: toIsoDateTimeString("2026-08-14T10:30"),
      startedAt: toIsoDateTimeString("2026-08-14T09:45"),
      completedDate: toIsoDateTimeString("2026-08-14T10:15"),
      actualStartAt: toIsoDateTimeString("2026-08-14T09:45"),
      actualEndAt: toIsoDateTimeString("2026-08-14T10:15"),
      warrantyUntil: toIsoDateTimeString("2026-09-01"),
      nextMaintenanceDate: toIsoDateTimeString("2026-09-15"),
    });
  });
});
