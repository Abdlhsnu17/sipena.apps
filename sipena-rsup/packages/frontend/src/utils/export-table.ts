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
  return 'color'
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
        </style>
      </head>
      <body>
        <h2>${escapeTableHtml(title)}</h2>
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
  return `
    <article class="entry-card">
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
  const pageBg = isMonochrome ? '#ffffff' : '#f5f7ff'
  const bodyColor = isMonochrome ? '#111111' : '#0f172a'
  const subtitleColor = isMonochrome ? '#111111' : '#1d4ed8'
  const cardBg = '#ffffff'
  const sectionBg = isMonochrome ? '#ffffff' : '#f5f7ff'
  const sectionBorder = isMonochrome ? '#333333' : '#d8e2ff'
  const sectionHeadingBg = isMonochrome ? '#111111' : '#1d4ed8'

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
          body {
            font-family: Arial, sans-serif;
            padding: 36px;
            color: ${bodyColor};
            background: ${pageBg};
            font-size: ${BASE_EXPORT_FONT_SIZE}px;
          }
          h1 {
            font-size: ${HEADING_EXPORT_FONT_SIZE}px;
            font-weight: 700;
            margin: 0;
          }
          .subtitle {
            font-size: ${BASE_EXPORT_FONT_SIZE}px;
            color: ${subtitleColor};
            margin: 4px 0 28px;
          }
          .entries {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .entry-card {
            border-radius: 32px;
            background: ${cardBg};
            box-shadow: ${isMonochrome ? 'none' : '0 30px 60px rgba(15, 23, 42, 0.15)'};
            padding: 0;
            page-break-inside: avoid;
            border: 1px solid ${isMonochrome ? '#333333' : 'transparent'};
          }
          .entry-card__body {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 1.25rem;
            padding: 2rem;
          }
          .section-block {
            background: ${sectionBg};
            border-radius: 28px;
            border: 1px solid ${sectionBorder};
            overflow: hidden;
          }
          .section-block__heading {
            background: ${sectionHeadingBg};
            color: #fff;
            font-size: ${HEADING_EXPORT_FONT_SIZE}px;
            font-weight: 600;
            padding: 0.65rem 1rem;
          }
          .section-block__rows {
            padding: 0.65rem 1rem 0.8rem;
            display: flex;
            flex-direction: column;
            gap: 0;
          }
          .section-block__row {
            display: grid;
            grid-template-columns: 0.9fr 1.2fr;
            gap: 0.75rem;
            align-items: center;
            padding: 0.5rem 0;
            border-bottom: 1px solid ${sectionBorder};
          }
          .section-block__row:last-child {
            border-bottom: 0;
          }
          .section-block__label {
            font-size: ${BASE_EXPORT_FONT_SIZE}px;
            font-weight: 400;
            color: ${isMonochrome ? '#111111' : '#374151'};
          }
          .section-block__value {
            font-size: ${BASE_EXPORT_FONT_SIZE}px;
            font-weight: 400;
            color: ${bodyColor};
          }
          @media print {
            .entry-card {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(normalizeCapsText(title))}</h1>
        <p class="subtitle">${escapeHtml(normalizeCapsText(subtitle))}</p>
        ${entriesHtml}
        <script>
          document.querySelectorAll('.entry-card__toggle').forEach((button) => {
            button.addEventListener('click', () => {
              const card = button.closest('.entry-card')
              if (!card) return
              const collapsed = card.classList.toggle('is-collapsed')
              button.textContent = collapsed ? 'Perluas' : 'Sederhanakan'
              button.setAttribute('aria-expanded', String(!collapsed))
            })
          })
        </script>
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
  appendLine(identities, 'Jenis Inventaris', entry.inventoryType)
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
