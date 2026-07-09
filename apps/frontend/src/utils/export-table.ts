'use client'

import { getFeaturePresentation, isFeatureColumn } from '@/utils/feature-presentation'

export type ExportFormat = 'pdf' | 'word' | 'excel'

export interface ExportTableOptions {
  title: string
  columns: string[]
  rows: Record<string, unknown>[]
  filePrefix?: string
}

type ExportColorMode = 'color' | 'monochrome'

const BASE_EXPORT_FONT_SIZE = 13
const HEADING_EXPORT_FONT_SIZE = 13
const EXPORT_BRAND_NAME = 'SiPeNa'
const EXPORT_SYSTEM_NAME = 'Sistem Inventaris Peminjaman serta Pemeliharaan sarana (SiPeNa)'

const getCellTextLength = (value: unknown) => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'string') return value.length
  if (typeof value === 'number') return String(value).length
  if (typeof value === 'object' && value && 'text' in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>).text ?? '').length
  }
  return String(value).length
}

const autoFitWorksheetColumns = (
  sheet: import('exceljs').Worksheet,
  options?: { minWidth?: number; maxWidth?: number; padding?: number }
) => {
  const minWidth = options?.minWidth ?? 8
  const maxWidth = options?.maxWidth ?? 34
  const padding = options?.padding ?? 2

  sheet.columns.forEach((column) => {
    let maxLength = 0
    if (typeof column.eachCell === 'function') {
      column.eachCell({ includeEmpty: false }, (cell) => {
        const cellLength = getCellTextLength(cell.value)
        if (cellLength > maxLength) maxLength = cellLength
      })
    }
    const calculatedWidth = Math.min(maxWidth, Math.max(minWidth, maxLength + padding))
    column.width = calculatedWidth
  })
}

const normalizeCapsText = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  if (trimmed !== trimmed.toUpperCase()) return trimmed
  return trimmed
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const pickExportColorMode = (): ExportColorMode => {
  return 'monochrome'
}

export type TableExportColumn<T> = {
  key: string
  label: string
  getValue: (entry: T) => string
}

export const buildTableExportRows = <T>(columns: TableExportColumn<T>[], entries: T[]) => {
  return entries.map((entry) => {
    const row: Record<string, unknown> = {}
    columns.forEach((column) => {
      row[column.label] = column.getValue(entry)
    })
    return row
  })
}

const sanitizeValue = (value: unknown) => {
  if (value === undefined || value === null) return '-'
  if (typeof value === 'number') return value.toString()
  return String(value)
}

const escapeTableHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')

const toExcelArgb = (value: string) => `FF${value.replace('#', '').toUpperCase()}`

const getFeatureCellStyle = (column: string, value: unknown) => {
  if (!isFeatureColumn(column)) return null
  const presentation = getFeaturePresentation(sanitizeValue(value))
  return {
    label: presentation.label,
    fillColor: toExcelArgb(presentation.backgroundColor),
    textColor: toExcelArgb(presentation.textColor),
    borderColor: toExcelArgb(presentation.borderColor),
    htmlStyle: [
      'display:inline-block',
      'padding:4px 10px',
      'border-radius:999px',
      `background:${presentation.backgroundColor}`,
      `color:${presentation.textColor}`,
      `border:1px solid ${presentation.borderColor}`,
      'font-weight:600',
      'line-height:1.3',
    ].join(';'),
  }
}

const renderTableCellHtml = (column: string, value: unknown, mode: ExportColorMode) => {
  const featureStyle = getFeatureCellStyle(column, value)
  if (!featureStyle || mode === 'monochrome') {
    return `<td>${escapeTableHtml(sanitizeValue(value))}</td>`
  }

  return `<td><span style="${featureStyle.htmlStyle}">${escapeTableHtml(featureStyle.label)}</span></td>`
}

const buildExportHeaderHtml = () => `
  <header class="export-header">
    <div class="export-header__brand">${escapeTableHtml(EXPORT_BRAND_NAME)}</div>
  </header>
`

const buildExportFooterHtml = () => `
  <footer class="export-footer">
    ${escapeTableHtml(EXPORT_SYSTEM_NAME)}
  </footer>
`

const buildHtml = (
  title: string,
  columns: string[],
  rows: Record<string, unknown>[],
  mode: ExportColorMode
) => {
  const headerCells = columns.map((column) => `<th>${escapeTableHtml(normalizeCapsText(column))}</th>`).join('')
  const bodyRows = rows
    .map((row) => {
      const cells = columns
        .map((column) => renderTableCellHtml(column, row[column], mode))
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')

  const isMonochrome = mode === 'monochrome'
  const bodyColor = isMonochrome ? '#111111' : '#111827'
  const borderColor = isMonochrome ? '#333333' : '#cbd5f5'
  const headerBg = isMonochrome ? '#ffffff' : '#f3f4f6'

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeTableHtml(title)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 32px;
            color: ${bodyColor};
            font-size: ${BASE_EXPORT_FONT_SIZE}px;
          }
          .export-header {
            border-bottom: 1px solid ${borderColor};
            margin: 0 0 22px;
            padding: 0 0 10px;
          }
          .export-header__brand {
            font-size: 16px;
            font-weight: 700;
            color: ${bodyColor};
          }
          .export-footer {
            border-top: 1px solid ${borderColor};
            color: ${isMonochrome ? '#555555' : '#64748b'};
            font-size: 11px;
            margin: 28px 0 0;
            padding: 10px 0 0;
            text-align: center;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            font-size: ${BASE_EXPORT_FONT_SIZE}px;
          }
          th, td {
            border: 1px solid ${borderColor};
            padding: 8px 10px;
            text-align: left;
          }
          th {
            background: ${headerBg};
            font-weight: 600;
          }
          @media print {
            @page {
              margin: 24mm 14mm 20mm;
            }
            body {
              padding: 0;
            }
            .export-header {
              position: fixed;
              top: -16mm;
              left: 0;
              right: 0;
              margin: 0;
            }
            .export-footer {
              position: fixed;
              bottom: -13mm;
              left: 0;
              right: 0;
              margin: 0;
            }
          }
        </style>
      </head>
      <body>
        ${buildExportHeaderHtml()}
        <h2>${escapeTableHtml(title)}</h2>
        <table>
          <thead>
            <tr>${headerCells}</tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
        </table>
        ${buildExportFooterHtml()}
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
  const colorMode = pickExportColorMode()
  if (format === 'pdf') {
    const html = buildHtml(title, columns, rows, colorMode)
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) return
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    void printWindow.print()
    return
  }

  const html = buildHtml(title, columns, rows, colorMode)

  if (format === 'word') {
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    downloadBlob(blob, `${slug}.doc`)
    return
  }

  if (format === 'excel') {
    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    const sheet = workbook.addWorksheet(title)
    const headerRow = sheet.addRow(columns.map((column) => normalizeCapsText(column)))
    headerRow.font = { name: 'Arial', bold: true, size: HEADING_EXPORT_FONT_SIZE }
    if (colorMode === 'color') {
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEFF6FF' },
      }
    }
    rows.forEach((row) => {
      sheet.addRow(columns.map((column) => sanitizeValue(row[column])))
    })

    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.font = { name: 'Arial', ...(cell.font || {}), size: BASE_EXPORT_FONT_SIZE }
        cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF666666' } },
          left: { style: 'thin', color: { argb: 'FF666666' } },
          bottom: { style: 'thin', color: { argb: 'FF666666' } },
          right: { style: 'thin', color: { argb: 'FF666666' } },
        }
      })
    })

    columns.forEach((column, columnIndex) => {
      if (!isFeatureColumn(column)) return

      for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
        const cell = sheet.getCell(rowIndex, columnIndex + 1)
        const featureStyle = getFeatureCellStyle(column, cell.value)
        if (!featureStyle) continue

        cell.value = featureStyle.label
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: featureStyle.fillColor },
        }
        cell.font = {
          name: 'Arial',
          ...(cell.font || {}),
          size: BASE_EXPORT_FONT_SIZE,
          bold: true,
          color: { argb: featureStyle.textColor },
        }
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
        cell.border = {
          top: { style: 'thin', color: { argb: featureStyle.borderColor } },
          left: { style: 'thin', color: { argb: featureStyle.borderColor } },
          bottom: { style: 'thin', color: { argb: featureStyle.borderColor } },
          right: { style: 'thin', color: { argb: featureStyle.borderColor } },
        }
      }
    })

    autoFitWorksheetColumns(sheet)

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    downloadBlob(blob, `${slug}.xlsx`)
  }
}

export interface MaintenanceHistoryExportEntry {
  noId?: string
  inventoryType?: string
  maintenanceType?: string
  assetName?: string
  assetCode?: string
  assetRoom?: string
  brandModel?: string
  requesterName?: string
  requesterNip?: string
  scheduledDate?: string
  technician?: string
  completionDate?: string
  cost?: string
  notes?: string
  registrationNotes?: string
  status?: string
  validationDate?: string
  validator?: string
  validatorName?: string
  validatorNip?: string
  cancellationReason?: string
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

const buildNarrativeExportHeaderHtml = () => `
  <header class="export-header">
    <div class="export-header__brand">${escapeHtml(EXPORT_BRAND_NAME)} · DOKUMEN OPERASIONAL</div>
  </header>
`

const buildNarrativeExportFooterHtml = () => `
  <footer class="export-footer">
    ${escapeHtml(EXPORT_SYSTEM_NAME)}
  </footer>
`

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

const buildSectionHtml = (section: DocumentSection) => `
  <div class="section-block">
    <div class="section-block__heading">${escapeHtml(normalizeCapsText(section.title))}</div>
    <div class="section-block__rows">
      ${section.lines
        .map(
          (line) => `
            <div class="section-block__row">
              <div class="section-block__label">${escapeHtml(normalizeCapsText(line.label))}</div>
              <div class="section-block__value">${escapeHtml(line.value)}</div>
            </div>
          `
        )
        .join('')}
    </div>
  </div>
`

const buildNarrativeEntryHtml = <T>(entry: T, index: number, total: number, buildSections: SectionBuilder<T>) => {
  const sections = buildSections(entry)
  if (!sections.length) return ''
  const entryHeader = `<div class="entry-card__heading">${escapeHtml(buildEntryHeaderLabel(entry, index))}</div>`
  return `
    <article class="entry-card">
      ${entryHeader}
      <div class="entry-card__body">
        ${sections.map((section) => buildSectionHtml(section)).join('')}
      </div>
    </article>
  `
}

const buildNarrativeHtml = <T>(
  title: string,
  entries: T[],
  subtitle: string,
  buildSections: SectionBuilder<T>,
  emptyMessage: string,
  mode: ExportColorMode
) => {
  const isMonochrome = mode === 'monochrome'
  const pageBg = '#ffffff'
  const bodyColor = '#0f172a'
  const subtitleColor = '#64748b'
  const cardBg = '#ffffff'
  const sectionBg = '#ffffff'
  const sectionBorder = '#dbe4f0'
  const sectionHeadingBg = '#ffffff'

  const entriesHtml =
    entries.length > 0
      ? `<div class="entries">${entries
          .map((entry, index) => buildNarrativeEntryHtml(entry, index, entries.length, buildSections))
          .join('')}</div>`
      : `<p class="muted">${escapeHtml(emptyMessage)}</p>`

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          @page {
            margin: 24mm 14mm 20mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            padding: 0;
            color: ${bodyColor};
            background: ${pageBg};
            font-size: ${BASE_EXPORT_FONT_SIZE}px;
            line-height: 1.25;
          }
          .export-header {
            border: 0;
            margin: 0 0 8px;
            padding: 0;
          }
          .export-header__brand {
            font-size: 12px;
            font-weight: 700;
            color: #64748b;
            letter-spacing: .16em;
          }
          .export-footer {
            border-top: 1px solid ${sectionBorder};
            color: ${isMonochrome ? '#555555' : '#64748b'};
            font-size: 11px;
            margin: 24px 0 0;
            padding: 8px 0 0;
            text-align: center;
          }
          h1 {
            font-size: 25px;
            font-weight: 700;
            letter-spacing: -.02em;
            margin: 0 0 10px;
          }
          .subtitle {
            border-bottom: 1px solid ${sectionBorder};
            color: ${subtitleColor};
            font-size: 12px;
            font-weight: 600;
            letter-spacing: .08em;
            margin: 0 0 22px;
            padding: 0 0 12px;
            text-transform: uppercase;
          }
          .entries {
            display: block;
          }
          .entry-card {
            background: ${cardBg};
            border: 1px solid ${sectionBorder};
            border-radius: 16px;
            box-shadow: none;
            padding: 18px 20px;
            page-break-inside: avoid;
            margin: 0 0 16px;
          }
          .entry-card + .entry-card {
            page-break-before: always;
          }
          .entry-card__heading {
            border: 1px solid #c7d5e8;
            border-radius: 999px;
            color: #334155;
            display: inline-block;
            float: right;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: .07em;
            margin: 0 0 12px 12px;
            padding: 6px 10px;
            text-transform: uppercase;
          }
          .entry-card__body {
            display: block;
            clear: both;
            padding: 0;
          }
          .section-block {
            background: ${sectionBg};
            border: 0;
            overflow: hidden;
            margin: 0;
            page-break-inside: avoid;
          }
          .section-block + .section-block {
            margin-top: 16px;
          }
          .section-block__heading {
            background: ${sectionHeadingBg};
            border-bottom: 1px solid ${sectionBorder};
            color: #64748b;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: .12em;
            padding: 0 0 8px;
          }
          .section-block__rows {
            padding: 0;
            display: block;
          }
          .section-block__row {
            display: flex;
            gap: 16px;
            padding: 10px 0;
            border-bottom: 1px solid ${sectionBorder};
          }
          .section-block__row:last-child {
            border-bottom: 0;
          }
          .section-block__label {
            color: #64748b;
            flex: 0 0 31%;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: .1em;
            margin: 0;
            text-transform: uppercase;
          }
          .section-block__value {
            font-size: 14px;
            font-weight: 500;
            color: ${bodyColor};
            margin: 0;
            overflow-wrap: anywhere;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .entry-card {
              page-break-inside: avoid;
            }
            .export-header {
              position: fixed;
              top: -16mm;
              left: 0;
              right: 0;
              margin: 0;
            }
            .export-footer {
              position: fixed;
              bottom: -13mm;
              left: 0;
              right: 0;
              margin: 0;
            }
          }
        </style>
      </head>
      <body>
        ${buildNarrativeExportHeaderHtml()}
        <h1>${escapeHtml(normalizeCapsText(title))}</h1>
        <p class="subtitle">${escapeHtml(normalizeCapsText(subtitle))}</p>
        ${entriesHtml}
        ${buildNarrativeExportFooterHtml()}
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
): [string, string][] => {
  const rows: [string, string][] = []
  rows.push([normalizeCapsText(title), ''])
  rows.push([normalizeCapsText(subtitle), ''])
  rows.push(['', ''])
  if (!entries.length) {
    rows.push([emptyMessage, ''])
    return rows
  }

  entries.forEach((entry, index) => {
    const sections = buildSections(entry)
    if (!sections.length) return
    const headerLabel = buildEntryHeaderLabel(entry, index)
    const headerMeta = entries.length > 1 ? ` (${index + 1}/${entries.length})` : ''
    rows.push([`${headerLabel}${headerMeta}`, ''])
    sections.forEach((section) => {
      rows.push([normalizeCapsText(section.title), ''])
      section.lines.forEach((line) => {
        rows.push([normalizeCapsText(line.label), line.value])
      })
      rows.push(['', ''])
    })
    if (index < entries.length - 1) {
      rows.push(['', ''])
    }
  })
  return rows
}

const buildEntryHeaderLabel = <T>(entry: T, fallbackIndex: number) => {
  if (entry && typeof entry === 'object') {
    const obj = entry as Record<string, unknown>
    if (typeof obj.noId === 'string' && obj.noId.trim()) return obj.noId.trim()
    if (typeof obj.id === 'number' || typeof obj.id === 'string') {
      return `Data ${obj.id}`
    }
  }
  return `Data ${fallbackIndex + 1}`
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
    subtitle = 'Laporan Teknis Unit Medis',
    entries,
    filePrefix,
    buildSections,
    emptyMessage = 'Tidak ada data yang dipilih.',
  } = options
  const slug = filePrefix || title.toLowerCase().replace(/\s+/g, '-')
  const colorMode = pickExportColorMode()
  const html = buildNarrativeHtml(title, entries, subtitle, buildSections, emptyMessage, colorMode)

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
    sheet.columns = [{}, {}]
    const rows = buildNarrativeRows(entries, title, subtitle, buildSections, emptyMessage)
    rows.forEach((row) => sheet.addRow(row))

    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        const isTitleRow = rowNumber <= 2
        cell.font = {
          name: 'Arial',
          ...(cell.font || {}),
          size: isTitleRow ? HEADING_EXPORT_FONT_SIZE : BASE_EXPORT_FONT_SIZE,
          bold: isTitleRow || cell.font?.bold,
          color: { argb: 'FF111111' },
        }
        cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF666666' } },
          left: { style: 'thin', color: { argb: 'FF666666' } },
          bottom: { style: 'thin', color: { argb: 'FF666666' } },
          right: { style: 'thin', color: { argb: 'FF666666' } },
        }
        if (colorMode === 'color' && isTitleRow) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFEFF6FF' },
          }
        }
      })
    })

    autoFitWorksheetColumns(sheet, { minWidth: 10, maxWidth: 32 })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    downloadBlob(blob, `${slug}.xlsx`)
  }
}

const buildMaintenanceHistorySections = (entry: MaintenanceHistoryExportEntry): DocumentSection[] => {
  const identities: SectionLine[] = []
  appendLine(identities, 'No ID', entry.noId)
  appendLine(identities, 'Jenis Inventaris', entry.inventoryType)
  appendLine(identities, 'Tipe Layanan', entry.maintenanceType)
  appendLine(identities, 'Nama Alat', entry.assetName)
  appendLine(identities, 'Kode Alat', entry.assetCode)
  appendLine(identities, 'Nama Ruangan Alat', entry.assetRoom)
  appendLine(identities, 'Merek / Model', entry.brandModel)

  const administration: SectionLine[] = []
  appendLine(administration, 'Nama Pengirim', entry.requesterName)
  appendLine(administration, 'NIP Pengirim', entry.requesterNip)
  appendLine(administration, 'Jadwal Pemeliharaan', entry.scheduledDate)
  appendLine(administration, 'Catatan Pendaftaran', entry.registrationNotes)

  const execution: SectionLine[] = []
  appendLine(execution, 'Teknisi Pelaksana', entry.technician)
  appendLine(execution, 'Waktu Selesai', entry.completionDate)
  appendLine(execution, 'Biaya Pemeliharaan', entry.cost)
  appendLine(execution, 'Catatan (After)', entry.notes)
  appendLine(execution, 'Alasan Pembatalan', entry.cancellationReason)

  const validationLines: SectionLine[] = []
  if (entry.validatorName) {
    appendLine(validationLines, 'Validator', entry.validatorName)
  }
  if (entry.validatorNip) {
    appendLine(validationLines, 'NIP Validator', entry.validatorNip)
  }
  if (!entry.validatorName && !entry.validatorNip && entry.validator) {
    appendLine(validationLines, 'Validator', entry.validator)
  }
  if (entry.validationDate) {
    appendLine(validationLines, 'Waktu Validasi', entry.validationDate)
  }

  const statusLines: SectionLine[] = []
  if (entry.status) {
    appendLine(statusLines, 'Status Pelaksanaan', entry.status)
  }

  const sections: DocumentSection[] = []
  if (identities.length) sections.push({ title: 'IDENTITAS ALAT', lines: identities })
  if (administration.length) sections.push({ title: 'DETAIL ADMINISTRASI', lines: administration })
  if (execution.length) sections.push({ title: 'PELAKSANAAN & BIAYA', lines: execution })
  if (validationLines.length) sections.push({ title: 'VALIDASI', lines: validationLines })
  if (statusLines.length) sections.push({ title: 'STATUS AKHIR', lines: statusLines })
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

// ===== FORMULIR RESMI ALAT MEDIS =====

export interface FormularField {
  label: string
  value: string
}

export interface FormularSection {
  numeral: string
  title: string
  fields: FormularField[]
}

export interface FormularAssetItem {
  name: string
  spec?: string
  brand?: string
  qty: string
}

export interface FormularSignatureCol {
  title: string
  name: string
  nip?: string
}

export interface FormularData {
  formTitle: string
  formNo?: string
  introText?: string
  sections: FormularSection[]
  assetsNumeral?: string
  assetsTitle?: string
  assets?: FormularAssetItem[]
  signatureDate?: string
  signatureLeft: FormularSignatureCol
  signatureRight: FormularSignatureCol
  approverLabel?: string
  approverLeft?: FormularSignatureCol
  approverRight?: FormularSignatureCol
  notes?: string[]
}

export interface FormularReportOptions<T> {
  entries: T[]
  filePrefix?: string
  buildFormular: (entry: T) => FormularData
}

const buildSigColHtml = (col: FormularSignatureCol) => `
  <td class="f-sig-col">
    <div class="f-sig-role">${escapeHtml(col.title)}</div>
    <div class="f-sig-space"></div>
    <div class="f-sig-name">${escapeHtml(col.name)}</div>
    ${col.nip ? `<div class="f-sig-nip">NIP. ${escapeHtml(col.nip)}</div>` : ''}
  </td>`

const buildFormularEntryHtml = (data: FormularData): string => {
  const sectionsHtml = data.sections.map(section => {
    const fieldsHtml = section.fields.map(field => `
      <div class="f-field-row">
        <span class="f-field-label">${escapeHtml(field.label)}</span>
        <span class="f-field-sep">:</span>
        <span class="f-field-value">${escapeHtml(field.value)}</span>
      </div>`).join('')
    return `
    <div class="f-section">
      <div class="f-section-header">${escapeHtml(section.numeral)}. ${escapeHtml(section.title)}</div>
      <div class="f-section-fields">${fieldsHtml}</div>
    </div>`
  }).join('')

  let assetsHtml = ''
  if (data.assets && data.assets.length > 0) {
    const nextNumeral = data.assetsNumeral || ['I','II','III','IV','V','VI'][data.sections.length] || 'V'
    const assetsTitle = data.assetsTitle || 'Alat Yang Dipinjam/Digunakan'
    const itemsHtml = data.assets.map((asset, i) => {
      const subItems = [
        { label: 'a) Nama Alat', value: asset.name },
        { label: 'b) Spesifikasi / Kode', value: asset.spec || '-' },
        { label: 'c) Merk / Nomer Seri', value: asset.brand || '-' },
        { label: 'd) Jumlah', value: asset.qty },
      ].map(sub => `
        <div class="f-field-row" style="padding-left:32px">
          <span class="f-field-label">${escapeHtml(sub.label)}</span>
          <span class="f-field-sep">:</span>
          <span class="f-field-value">${escapeHtml(sub.value)}</span>
        </div>`).join('')
      return `
      <div class="f-asset-item">
        <div class="f-asset-num">${i + 1}.</div>
        ${subItems}
      </div>`
    }).join('')
    assetsHtml = `
    <div class="f-section">
      <div class="f-section-header">${escapeHtml(nextNumeral)}. ${escapeHtml(assetsTitle)}</div>
      ${itemsHtml}
    </div>`
  }

  const dateStr = data.signatureDate || 'Jakarta, ..................... 20.....'
  let approverHtml = ''
  if (data.approverLeft && data.approverRight) {
    const label = data.approverLabel || 'MENGETAHUI'
    approverHtml = `
    <div class="f-approver">
      <div class="f-approver-label">${escapeHtml(label)}</div>
      <table class="f-sig-table"><tr>
        ${buildSigColHtml(data.approverLeft)}
        ${buildSigColHtml(data.approverRight)}
      </tr></table>
    </div>`
  }

  const notesHtml = data.notes && data.notes.length
    ? `<div class="f-notes">${data.notes.map(n => `<div class="f-note">* ${escapeHtml(n)}</div>`).join('')}</div>`
    : ''

  return `
  <div class="f-form">
    <div class="f-brand">${escapeHtml(EXPORT_BRAND_NAME)} · DOKUMEN OPERASIONAL</div>
    <div class="f-title">${escapeHtml(data.formTitle)}</div>
    ${data.formNo ? `<div class="f-no">Nomor: ${escapeHtml(data.formNo)}</div>` : '<div class="f-no">&nbsp;</div>'}
    ${data.introText ? `<div class="f-intro">${escapeHtml(data.introText)}</div>` : ''}
    ${sectionsHtml}
    ${assetsHtml}
    <div class="f-signature">
      <div class="f-sig-date">${escapeHtml(dateStr)}</div>
      <table class="f-sig-table"><tr>
        ${buildSigColHtml(data.signatureLeft)}
        ${buildSigColHtml(data.signatureRight)}
      </tr></table>
      ${approverHtml}
    </div>
    ${notesHtml}
  </div>`
}

const buildFormularPageHtml = <T>(entries: T[], buildFormular: (entry: T) => FormularData): string => {
  const formsHtml = entries
    .map((entry, i) => {
      const formHtml = buildFormularEntryHtml(buildFormular(entry))
      return i > 0 ? `<div class="f-page-break"></div>${formHtml}` : formHtml
    })
    .join('')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Formulir Alat Medis</title>
  <style>
    @page { margin: 25mm 20mm 20mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12pt; line-height: 1.55; color: #0f172a; background: #fff; }
    .f-page-break { page-break-after: always; height: 0; }
    .f-form { max-width: 680px; margin: 0 auto; border: 1px solid #dbe4f0; border-radius: 16px; padding: 22px 26px; }
    .f-brand { color: #64748b; font-size: 9pt; font-weight: 700; letter-spacing: .14em; margin-bottom: 8px; }
    .f-title { border-bottom: 1px solid #dbe4f0; font-size: 16pt; font-weight: bold; padding-bottom: 10px; text-align: left; text-transform: uppercase; margin-bottom: 4px; }
    .f-no { color: #64748b; font-size: 10pt; margin-bottom: 20px; text-align: left; }
    .f-footer { border-top: 1px solid #dbe4f0; color: #64748b; font-size: 9pt; margin: 24px auto 0; max-width: 680px; padding-top: 8px; text-align: center; }
    .f-intro { margin-bottom: 14px; }
    .f-section { margin-bottom: 10px; }
    .f-section-header { font-weight: bold; margin-bottom: 4px; }
    .f-section-fields { padding-left: 16px; }
    .f-field-row { display: flex; align-items: baseline; margin-bottom: 4px; padding-left: 16px; }
    .f-field-label { width: 190px; flex-shrink: 0; }
    .f-field-sep { margin: 0 6px; flex-shrink: 0; }
    .f-field-value { flex: 1; border-bottom: 1px dotted #555; min-height: 18px; padding-bottom: 1px; }
    .f-asset-item { margin-bottom: 6px; }
    .f-asset-num { font-weight: bold; padding-left: 16px; margin-bottom: 2px; }
    .f-signature { margin-top: 28px; }
    .f-sig-date { text-align: right; margin-bottom: 18px; }
    .f-sig-table { width: 100%; border-collapse: collapse; }
    .f-sig-col { width: 50%; text-align: center; vertical-align: top; padding: 0 12px; }
    .f-sig-role { margin-bottom: 2px; }
    .f-sig-space { height: 64px; }
    .f-sig-name { border-top: 1px solid #000; padding-top: 4px; font-weight: bold; }
    .f-sig-nip { font-size: 10pt; }
    .f-approver { margin-top: 22px; }
    .f-approver-label { text-align: center; font-weight: bold; margin-bottom: 10px; }
    .f-notes { margin-top: 18px; border-top: 1px solid #ccc; padding-top: 8px; }
    .f-note { font-size: 10pt; line-height: 1.4; color: #444; }
    @media print {
      .f-page-break { page-break-after: always; }
      .f-footer { position: fixed; bottom: -13mm; left: 0; right: 0; }
    }
  </style>
</head>
<body>${formsHtml}<footer class="f-footer">${escapeHtml(EXPORT_SYSTEM_NAME)}</footer></body>
</html>`
}

export async function exportFormularReport<T>(format: ExportFormat, options: FormularReportOptions<T>) {
  const { entries, filePrefix = 'formulir', buildFormular } = options
  if (!entries.length) return

  const html = buildFormularPageHtml(entries, buildFormular)

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
    const blob = new Blob(['﻿', html], { type: 'application/msword' })
    downloadBlob(blob, `${filePrefix}.doc`)
    return
  }

  if (format === 'excel') {
    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    entries.forEach((entry, idx) => {
      const data = buildFormular(entry)
      const sheetName = `Formulir ${idx + 1}`.substring(0, 31)
      const sheet = workbook.addWorksheet(sheetName)
      sheet.columns = [{ width: 28 }, { width: 50 }]
      sheet.addRow([data.formTitle])
      if (data.formNo) sheet.addRow([`Nomor: ${data.formNo}`])
      sheet.addRow([])
      data.sections.forEach(section => {
        sheet.addRow([`${section.numeral}. ${section.title}`])
        section.fields.forEach(field => sheet.addRow([field.label, field.value]))
        sheet.addRow([])
      })
      if (data.assets && data.assets.length) {
        sheet.addRow([`${data.assetsNumeral || ''}. ${data.assetsTitle || 'Alat'}`])
        data.assets.forEach((asset, i) => {
          sheet.addRow([`${i + 1}. Nama Alat`, asset.name])
          sheet.addRow(['   Spesifikasi / Kode', asset.spec || '-'])
          sheet.addRow(['   Merk / Nomer Seri', asset.brand || '-'])
          sheet.addRow(['   Jumlah', asset.qty])
        })
        sheet.addRow([])
      }
      sheet.addRow(['Tanggal', data.signatureDate || ''])
      sheet.addRow([data.signatureLeft.title, data.signatureLeft.name])
      sheet.addRow([data.signatureRight.title, data.signatureRight.name])
      sheet.eachRow(row => {
        row.eachCell(cell => {
          cell.font = { name: 'Arial', size: BASE_EXPORT_FONT_SIZE, color: { argb: 'FF111111' } }
          cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
        })
      })
      autoFitWorksheetColumns(sheet, { minWidth: 10, maxWidth: 40 })
    })
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    downloadBlob(blob, `${filePrefix}.xlsx`)
  }
}
