'use client'

export type ExportFormat = 'pdf' | 'word' | 'excel'

export interface ExportTableOptions {
  title: string
  columns: string[]
  rows: Record<string, unknown>[]
  filePrefix?: string
}

const sanitizeValue = (value: unknown) => {
  if (value === undefined || value === null) return '-'
  if (typeof value === 'number') return value.toString()
  return String(value)
}

const buildHtml = (title: string, columns: string[], rows: Record<string, unknown>[]) => {
  const headerCells = columns.map((column) => `<th>${column}</th>`).join('')
  const bodyRows = rows
    .map((row) => {
      const cells = columns
        .map((column) => `<td>${sanitizeValue(row[column])}</td>`)
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            padding: 32px;
            color: #111827;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            font-size: 12px;
          }
          th, td {
            border: 1px solid #cbd5f5;
            padding: 8px 10px;
            text-align: left;
          }
          th {
            background: #f3f4f6;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <h2>${title}</h2>
        <table>
          <thead>
            <tr>${headerCells}</tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
        </table>
      </body>
    </html>
  `
}

export const downloadBlob = (blob: Blob, fileName: string) => {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = fileName
  link.click()
  URL.revokeObjectURL(link.href)
}

export async function exportTableData(format: ExportFormat, options: ExportTableOptions) {
  const { title, columns, rows, filePrefix } = options
  const slug = filePrefix || title.toLowerCase().replace(/\s+/g, '-')
  if (format === 'pdf') {
    const html = buildHtml(title, columns, rows)
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) return
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    void printWindow.print()
    return
  }

  const html = buildHtml(title, columns, rows)

  if (format === 'word') {
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    downloadBlob(blob, `${slug}.doc`)
    return
  }

  if (format === 'excel') {
    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    const sheet = workbook.addWorksheet(title)
    sheet.addRow(columns)
    rows.forEach((row) => {
      sheet.addRow(columns.map((column) => sanitizeValue(row[column])))
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    downloadBlob(blob, `${slug}.xlsx`)
  }
}

export interface MaintenanceHistoryExportEntry {
  inventoryType?: string
  assetName?: string
  assetCode?: string
  brandModel?: string
  requesterName?: string
  requesterNip?: string
  scheduledDate?: string
  technician?: string
  completionDate?: string
  cost?: string
  notes?: string
  status?: string
  validator?: string
  validationDate?: string
}

export interface MaintenanceHistoryExportOptions {
  title: string
  subtitle?: string
  entries: MaintenanceHistoryExportEntry[]
  filePrefix?: string
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')

export type SectionLine = {
  label: string
  value: string
}

export type DocumentSection = {
  title: string
  lines: SectionLine[]
}

export const appendLine = (lines: SectionLine[], label: string, value?: string) => {
  if (value === undefined) return
  lines.push({ label, value })
}

export type SectionBuilder<T> = (entry: T) => DocumentSection[]

const renderSectionHtml = (section: DocumentSection) => `
  <div class="section">
    <div class="section-title">${section.title}</div>
    ${section.lines
      .map((line) => `<p class="line"><span class="line-label">${line.label}:</span> ${escapeHtml(line.value)}</p>`)
      .join('')}
  </div>
`

const buildNarrativeEntryHtml = <T>(entry: T, index: number, total: number, buildSections: SectionBuilder<T>) => {
  const sections = buildSections(entry)
  if (!sections.length) return ''
  const separator = index < total - 1 ? '<div class="entry-separator"></div>' : ''
  return `
    <div class="entry">
      ${sections.map((section) => renderSectionHtml(section)).join('')}
      ${separator}
    </div>
  `
}

const buildNarrativeHtml = <T>(
  title: string,
  entries: T[],
  subtitle: string,
  buildSections: SectionBuilder<T>,
  emptyMessage: string
) => {
  const entryHtml =
    entries.length > 0
      ? entries.map((entry, index) => buildNarrativeEntryHtml(entry, index, entries.length, buildSections)).join('')
      : `<p class="muted">${escapeHtml(emptyMessage)}</p>`

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            padding: 36px;
            color: #0f172a;
            background: #fff;
          }
          h1 {
            font-size: 1.35rem;
            letter-spacing: 0.4em;
            text-transform: uppercase;
            margin: 0;
          }
          .subtitle {
            font-size: 0.95rem;
            letter-spacing: 0.3em;
            text-transform: uppercase;
            color: #475569;
            margin: 4px 0 24px;
          }
          .entry {
            margin-bottom: 20px;
          }
          .entry-separator {
            border-top: 1px dotted #cbd5f5;
            margin-top: 24px;
          }
          .section {
            margin-top: 18px;
          }
          .section-title {
            font-size: 0.75rem;
            letter-spacing: 0.25em;
            text-transform: uppercase;
            color: #475569;
            margin-bottom: 8px;
          }
          .line {
            margin: 2px 0;
            font-size: 0.95rem;
          }
          .line-label {
            font-weight: 600;
          }
          .muted {
            color: #6b7280;
            font-size: 0.95rem;
            margin-top: 8px;
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p class="subtitle">${subtitle}</p>
        ${entryHtml}
      </body>
    </html>
  `
}

const buildNarrativeRows = <T>(
  entries: T[],
  title: string,
  subtitle: string,
  buildSections: SectionBuilder<T>,
  emptyMessage: string
): string[] => {
  const rows: string[] = []
  rows.push(title)
  rows.push(subtitle)
  rows.push('')
  if (!entries.length) {
    rows.push(emptyMessage)
    return rows
  }

  entries.forEach((entry, index) => {
    const sections = buildSections(entry)
    if (!sections.length) return
    sections.forEach((section) => {
      rows.push(section.title)
      section.lines.forEach((line) => {
        rows.push(`${line.label}: ${line.value}`)
      })
      rows.push('')
    })
    if (index < entries.length - 1) {
      rows.push('')
    }
  })
  return rows
}

export interface NarrativeReportOptions<T> {
  title: string
  subtitle?: string
  entries: T[]
  filePrefix?: string
  buildSections: SectionBuilder<T>
  emptyMessage?: string
}

export async function exportNarrativeReport<T>(format: ExportFormat, options: NarrativeReportOptions<T>) {
  const {
    title,
    subtitle = 'LAPORAN TEKNIS UNIT MEDIS',
    entries,
    filePrefix,
    buildSections,
    emptyMessage = 'Tidak ada data yang dipilih.',
  } = options
  const slug = filePrefix || title.toLowerCase().replace(/\s+/g, '-')
  const html = buildNarrativeHtml(title, entries, subtitle, buildSections, emptyMessage)

  if (format === 'pdf') {
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) return
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    void printWindow.print()
    return
  }

  if (format === 'word') {
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    downloadBlob(blob, `${slug}.doc`)
    return
  }

  if (format === 'excel') {
    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    const sheet = workbook.addWorksheet(title)
    sheet.columns = [{ width: 80 }]
    const rows = buildNarrativeRows(entries, title, subtitle, buildSections, emptyMessage)
    rows.forEach((row) => sheet.addRow([row]))
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    downloadBlob(blob, `${slug}.xlsx`)
  }
}

const buildMaintenanceHistorySections = (entry: MaintenanceHistoryExportEntry): DocumentSection[] => {
  const identities: SectionLine[] = []
  appendLine(identities, 'Jenis Inventaris', entry.inventoryType)
  appendLine(identities, 'Nama Alat', entry.assetName)
  appendLine(identities, 'Kode Alat', entry.assetCode)
  appendLine(identities, 'Merek / Model', entry.brandModel)

  const administration: SectionLine[] = []
  appendLine(administration, 'Nama Pengirim', entry.requesterName)
  appendLine(administration, 'NIP Pengirim', entry.requesterNip)
  appendLine(administration, 'Jadwal Pemeliharaan', entry.scheduledDate)

  const execution: SectionLine[] = []
  appendLine(execution, 'Teknisi Pelaksana', entry.technician)
  appendLine(execution, 'Waktu Selesai', entry.completionDate)
  appendLine(execution, 'Biaya Pemeliharaan', entry.cost)
  appendLine(execution, 'Catatan (After)', entry.notes)

  const validation: SectionLine[] = []
  appendLine(validation, 'Status Pelaksanaan', entry.status)
  appendLine(validation, 'Validator', entry.validator)
  appendLine(validation, 'Waktu Validasi', entry.validationDate)

  const sections: DocumentSection[] = []
  if (identities.length) sections.push({ title: 'IDENTITAS ALAT', lines: identities })
  if (administration.length) sections.push({ title: 'DETAIL ADMINISTRASI', lines: administration })
  if (execution.length) sections.push({ title: 'PELAKSANAAN & BIAYA', lines: execution })
  if (validation.length) sections.push({ title: 'VALIDASI & STATUS AKHIR', lines: validation })
  return sections
}

export async function exportMaintenanceHistory(format: ExportFormat, options: MaintenanceHistoryExportOptions) {
  return exportNarrativeReport(format, {
    title: options.title,
    subtitle: options.subtitle,
    entries: options.entries,
    filePrefix: options.filePrefix,
    buildSections: buildMaintenanceHistorySections,
    emptyMessage: 'Tidak ada riwayat pemeliharaan yang dipilih.',
  })
}
