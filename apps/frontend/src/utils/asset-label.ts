export interface AssetLabelData {
  noId: string
  assetName: string
  assetCode?: string
  serialNumber?: string
  location?: string
  condition?: string
  status?: string
  purchaseDate?: string
  nextMaintenance?: string
  sourceLabel?: string
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const hasValue = (value?: string): value is string => Boolean(value?.trim() && value.trim() !== "-")

export const sanitizeAssetFilename = (value: string): string =>
  value
    .trim()
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "aset"

const formatDateId = (value?: string): string => {
  if (!hasValue(value)) return ""
  const dateOnlyMatch = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("id-ID")
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("id-ID")
}

export const buildManualAssetLabelHtml = (data: AssetLabelData, autoPrint: boolean) => {
  const rows = [
    { label: "No ID", value: data.noId },
    { label: "Kode Inventaris", value: data.assetCode },
    { label: "Kategori", value: data.sourceLabel },
    { label: "No Seri", value: data.serialNumber },
    { label: "Lokasi", value: data.location },
    { label: "Kondisi", value: data.condition },
    { label: "Status", value: data.status },
    { label: "Tanggal Beli", value: formatDateId(data.purchaseDate) },
    {
      label: data.sourceLabel === "Medis" ? "Kalibrasi/Pemeliharaan" : "Pemeliharaan Berikutnya",
      value: formatDateId(data.nextMaintenance),
    },
  ]
    .filter((row) => hasValue(row.value))
    .map(
      (row) =>
        `<tr><td class="label">${escapeHtml(row.label)}</td><td class="value">${escapeHtml(String(row.value))}</td></tr>`,
    )
    .join("")

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Label Manual ${escapeHtml(data.noId || data.assetCode || data.assetName || "Aset")}</title>
    <style>
      * { box-sizing: border-box; }
      @page { size: 100mm 80mm; margin: 0; }
      html, body { margin: 0; padding: 0; }
      body { font-family: Arial, Helvetica, sans-serif; color: #111827; }
      .label-card {
        width: 100mm;
        min-height: 80mm;
        padding: 4mm;
        border: 0.3mm solid #111827;
      }
      .topline {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 3mm;
        border-bottom: 0.25mm solid #111827;
        padding-bottom: 1.5mm;
        margin-bottom: 2mm;
      }
      .brand { font-size: 7pt; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
      .type { border: 0.25mm solid #111827; padding: 0.8mm 1.5mm; font-size: 6pt; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
      .title { margin: 0 0 2mm; font-size: 10pt; font-weight: 800; line-height: 1.2; word-break: break-word; }
      table { width: 100%; border-collapse: collapse; font-size: 7pt; table-layout: fixed; }
      td { border-bottom: 0.15mm solid #d1d5db; padding: 0.7mm 0; vertical-align: top; line-height: 1.25; }
      td.label { width: 35%; color: #4b5563; text-transform: uppercase; font-size: 6pt; letter-spacing: 0.03em; }
      td.value { font-weight: 700; word-break: break-word; }
      .footer { margin-top: 2mm; display: flex; justify-content: space-between; gap: 2mm; color: #4b5563; font-size: 5.5pt; text-transform: uppercase; letter-spacing: 0.06em; }
    </style>
  </head>
  <body>
    <div class="label-card">
      <div class="topline">
        <div class="brand">SIPENA - Identitas Inventaris</div>
        <div class="type">${escapeHtml(data.sourceLabel || "Inventaris")}</div>
      </div>
      <p class="title">${escapeHtml(data.assetName || "Aset")}</p>
      <table>${rows}</table>
      <div class="footer">
        <span>Label manual</span>
        <span>Identitas inventaris</span>
      </div>
    </div>
    ${
      autoPrint
        ? `<script>
      window.onload = function () {
        window.focus();
        window.print();
        setTimeout(function () { window.close(); }, 300);
      };
    </script>`
        : ""
    }
  </body>
</html>`
}

export const downloadManualAssetLabel = (data: AssetLabelData) => {
  const html = buildManualAssetLabelHtml(data, false)
  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `LABEL-${sanitizeAssetFilename(data.noId || data.assetCode || data.assetName || "aset")}.html`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const printManualAssetLabel = (data: AssetLabelData) => {
  const printWindow = window.open("", "_blank", "width=720,height=640")
  if (!printWindow) return

  printWindow.document.write(buildManualAssetLabelHtml(data, true))
  printWindow.document.close()
}
