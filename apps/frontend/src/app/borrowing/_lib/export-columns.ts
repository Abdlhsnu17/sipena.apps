import { borrowingStatusLabel } from "@/utils/api-mappers";
import { formatBorrowingDuration, formatBorrowingPurposeType } from "@/utils/borrowing";
import { formatDayTimeLabel } from "@/utils/format";
import { formatNoId } from "@/utils/record-id";
import type { TableExportColumn } from "@/utils/export-table";
import type { Borrowing as ApiBorrowing } from "@/services/borrowing.service";

export type BorrowingExportColumn = TableExportColumn<ApiBorrowing> & {
  defaultSelected?: boolean
}

export const borrowingExportColumnDefinitions: BorrowingExportColumn[] = [
  {
    key: "noId",
    label: "No ID",
    getValue: (borrowing) => formatNoId("PMJ", borrowing.id, borrowing.borrowingCode),
    defaultSelected: true,
  },
  {
    key: "jenisInventaris",
    label: "Jenis Inventaris",
    getValue: (borrowing) =>
      borrowing.assetType === "medical"
        ? "Medis"
        : borrowing.assetType === "non_medical"
          ? "Non-Medis"
          : "-",
    defaultSelected: true,
  },
  {
    key: "namaAlat",
    label: "Nama Inventaris",
    getValue: (borrowing) => borrowing.assetDetailName || borrowing.assetName || "-",
    defaultSelected: true,
  },
  {
    key: "kode",
    label: "Kode",
    getValue: (borrowing) => borrowing.assetDetailCode || borrowing.assetCode || "-",
    defaultSelected: true,
  },
  {
    key: "merek",
    label: "Merek / Model",
    getValue: (borrowing) => borrowing.assetDetailName || borrowing.assetName || "-",
    defaultSelected: true,
  },
  {
    key: "ruanganAlat",
    label: "Nama Ruangan Inventaris",
    getValue: (borrowing) => borrowing.assetLocation || "-",
    defaultSelected: true,
  },
  {
    key: "peminjam",
    label: "Peminjam",
    getValue: (borrowing) => borrowing.userName || "-",
    defaultSelected: true,
  },
  {
    key: "jabatanPeminjam",
    label: "Jabatan Peminjam",
    getValue: (borrowing) => borrowing.borrowerPosition || "-",
    defaultSelected: true,
  },
  {
    key: "unitKerjaPeminjam",
    label: "Unit Kerja Peminjam",
    getValue: (borrowing) => borrowing.borrowerWorkUnit || "-",
    defaultSelected: true,
  },
  {
    key: "nip",
    label: "NIP",
    getValue: (borrowing) => borrowing.userNip || "-",
    defaultSelected: true,
  },
  {
    key: "tanggalPinjam",
    label: "Tanggal Pinjam",
    getValue: (borrowing) => formatDayTimeLabel(borrowing.borrowDate, { showWeekday: false }),
    defaultSelected: true,
  },
  {
    key: "tanggalKembali",
    label: "Batas Pengembalian",
    getValue: (borrowing) =>
      borrowing.dueDate ? formatDayTimeLabel(borrowing.dueDate, { showWeekday: false }) : "-",
    defaultSelected: true,
  },
  {
    key: "pemilikAlat",
    label: "Pemilik Inventaris",
    getValue: (borrowing) => borrowing.ownerName || "-",
    defaultSelected: true,
  },
  {
    key: "nipPemilikAlat",
    label: "NIP Pemilik Inventaris",
    getValue: (borrowing) => borrowing.ownerNip || "-",
    defaultSelected: true,
  },
  {
    key: "jabatanPemilikAlat",
    label: "Jabatan Pemilik Inventaris",
    getValue: (borrowing) => borrowing.ownerPosition || "-",
    defaultSelected: true,
  },
  {
    key: "unitPemilikAlat",
    label: "Unit Pemilik Inventaris",
    getValue: (borrowing) => borrowing.ownerWorkUnit || "-",
    defaultSelected: true,
  },
  {
    key: "jenisKeperluan",
    label: "Jenis Keperluan",
    getValue: (borrowing) => formatBorrowingPurposeType(borrowing.purposeType),
    defaultSelected: true,
  },
  {
    key: "keperluan",
    label: "Keperluan",
    getValue: (borrowing) => borrowing.purpose || "-",
    defaultSelected: true,
  },
  {
    key: "tujuan",
    label: "Ruang / Instalasi Tujuan",
    getValue: (borrowing) => borrowing.destinationRoom || "-",
    defaultSelected: true,
  },
  {
    key: "jumlah",
    label: "Jumlah",
    getValue: (borrowing) => String(borrowing.quantity || 1),
    defaultSelected: true,
  },
  {
    key: "durasi",
    label: "Lama Peminjaman",
    getValue: (borrowing) => formatBorrowingDuration(borrowing.loanDurationValue, borrowing.loanDurationUnit),
    defaultSelected: true,
  },
  {
    key: "catatan",
    label: "Catatan",
    getValue: (borrowing) => borrowing.notes || "-",
    defaultSelected: true,
  },
  {
    key: "status",
    label: "Status",
    getValue: (borrowing) => borrowingStatusLabel(borrowing.status),
    defaultSelected: true,
  },
]
