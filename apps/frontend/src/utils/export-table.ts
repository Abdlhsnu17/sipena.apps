'use client'

import { getFeaturePresentation, isFeatureColumn } from '@/utils/feature-presentation'

export type ExportFormat = 'pdf' | 'pdf-f4' | 'word' | 'excel' | 'print' | 'print-f4'
export type ExportPaperSize = 'a4' | 'f4'

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

const getDistinctNarrativeSubtitle = (title: string, subtitle: string) => {
  const trimmedSubtitle = subtitle.trim()
  if (!trimmedSubtitle) return ''

  const toComparisonWords = (value: string) =>
    normalizeCapsText(value)
      .toLocaleLowerCase('id-ID')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)

  const genericWords = new Set(['dokumen', 'laporan', 'operasional'])
  const titleWords = new Set(toComparisonWords(title))
  const subtitleWords = toComparisonWords(trimmedSubtitle).filter((word) => !genericWords.has(word))

  if (subtitleWords.every((word) => titleWords.has(word))) {
    return ''
  }

  return normalizeCapsText(trimmedSubtitle)
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

const waitForDocumentImages = async (documentRef: Document) => {
  await Promise.all(
    Array.from(documentRef.images).map((image) => {
      if (image.complete) return Promise.resolve()
      return new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true })
        image.addEventListener('error', () => resolve(), { once: true })
      })
    })
  )
}

const applyPdfRenderStyles = (documentRef: Document) => {
  const style = documentRef.createElement('style')
  style.dataset.pdfRenderStyles = 'true'
  style.textContent = `
    html, body {
      background: #ffffff !important;
      margin: 0 !important;
      padding: 0 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .export-header, .export-footer {
      position: static !important;
      inset: auto !important;
    }
    .entry-card, .section-block, .signature-block, .f-section, .f-signature {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  `
  documentRef.head.appendChild(style)
}

const getPdfPageMargins = (html: string): [number, number, number, number] => {
  const pageMargin = html.match(/@page\s*\{[^}]*margin:\s*([\d.]+)mm(?:\s+([\d.]+)mm)?(?:\s+([\d.]+)mm)?(?:\s+([\d.]+)mm)?/i)
  if (!pageMargin) return [24, 24, 28, 24]

  const values = pageMargin.slice(1).filter(Boolean).map((value) => Number(value) * 2.83465)
  if (values.length === 1) return [values[0], values[0], values[0], values[0]]
  if (values.length === 2) return [values[0], values[1], values[0], values[1]]
  if (values.length === 3) return [values[0], values[1], values[2], values[1]]
  return [values[0], values[1], values[2], values[3]]
}

const getPdfPageFormat = (paperSize: ExportPaperSize): 'a4' | [number, number] =>
  paperSize === 'f4' ? [595.28, 935.43] : 'a4'

const renderHtmlAsPdf = async (html: string, paperSize: ExportPaperSize = 'a4') => {
  const margins = getPdfPageMargins(html)
  const a4WidthPoints = 595.28
  const contentWidthPoints = a4WidthPoints - margins[1] - margins[3]
  const contentWidthPixels = Math.round(contentWidthPoints * (96 / 72))
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '0'
  iframe.style.width = `${contentWidthPixels}px`
  iframe.style.height = '1123px'
  iframe.style.border = '0'
  iframe.style.pointerEvents = 'none'
  iframe.style.zIndex = '-1'
  document.body.appendChild(iframe)

  try {
    const iframeDocument = iframe.contentDocument
    if (!iframeDocument) throw new Error('Dokumen PDF tidak dapat disiapkan.')

    iframeDocument.open()
    iframeDocument.write(html)
    iframeDocument.close()
    applyPdfRenderStyles(iframeDocument)

    await iframeDocument.fonts?.ready
    await waitForDocumentImages(iframeDocument)

    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: getPdfPageFormat(paperSize), compress: true })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const availableHeightPixels = (pageHeight - margins[0] - margins[2]) * (96 / 72)
    const renderedHeight = iframeDocument.documentElement.scrollHeight
    const fitScale = renderedHeight > availableHeightPixels ? availableHeightPixels / renderedHeight : 1
    iframeDocument.body.style.zoom = String(fitScale)
    await pdf.html(iframeDocument.body, {
      margin: margins,
      autoPaging: 'slice',
      html2canvas: {
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
      },
      width: pageWidth - margins[1] - margins[3],
      windowWidth: contentWidthPixels,
    })
    return pdf
  } finally {
    iframe.remove()
  }
}

const downloadHtmlAsPdf = async (html: string, fileName: string, paperSize: ExportPaperSize = 'a4') => {
  const pdf = await renderHtmlAsPdf(html, paperSize)
  pdf.save(fileName)
}

const printHtmlAsPdf = async (html: string, paperSize: ExportPaperSize = 'a4') => {
  const printWindow = window.open('', '_blank', 'width=900,height=700')
  if (!printWindow) return
  printWindow.document.write('<!doctype html><title>Menyiapkan cetak...</title><p style="font-family:Arial,sans-serif;padding:24px">Menyiapkan dokumen cetak...</p>')
  printWindow.document.close()

  try {
    const pdf = await renderHtmlAsPdf(html, paperSize)
    pdf.autoPrint()
    const pdfUrl = URL.createObjectURL(pdf.output('blob'))
    printWindow.location.href = pdfUrl
    window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000)
  } catch (error) {
    printWindow.close()
    throw error
  }
}

export async function exportTableData(format: ExportFormat, options: ExportTableOptions) {
  const { title, columns, rows, filePrefix } = options
  const slug = filePrefix || title.toLowerCase().replace(/\s+/g, '-')
  const colorMode = pickExportColorMode()
  const paperSize: ExportPaperSize = format.endsWith('-f4') ? 'f4' : 'a4'
  if (format === 'pdf' || format === 'pdf-f4') {
    const html = buildHtml(title, columns, rows, colorMode)
    await downloadHtmlAsPdf(html, `${slug}.pdf`, paperSize)
    return
  }

  const html = buildHtml(title, columns, rows, colorMode)

  if (format === 'print' || format === 'print-f4') {
    await printHtmlAsPdf(html, paperSize)
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
  damagePhotoUrl?: string
  technician?: string
  completionDate?: string
  cost?: string
  notes?: string
  beforePhotoUrl?: string
  afterPhotoUrl?: string
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
    <div class="export-header__brand">${escapeHtml(EXPORT_BRAND_NAME)}</div>
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

const buildSectionHtml = (section: DocumentSection, index: number) => `
  <div class="section-block">
    <div class="section-block__heading"><span class="section-block__number">${toRomanNumeral(index + 1)}.</span> ${escapeHtml(normalizeCapsText(section.title))}</div>
    <div class="section-block__rows">
      ${section.lines
        .map(
          (line) => `
            <div class="section-block__row">
              <div class="section-block__label">${escapeHtml(normalizeCapsText(line.label))}</div>
              <div class="section-block__separator">:</div>
              <div class="section-block__value">${escapeHtml(line.value)}</div>
            </div>
          `
        )
        .join('')}
    </div>
  </div>
`

const toRomanNumeral = (value: number) => {
  const numerals = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ] as const
  let remaining = value
  return numerals.reduce((result, [amount, numeral]) => {
    while (remaining >= amount) {
      result += numeral
      remaining -= amount
    }
    return result
  }, '')
}

const getEntryText = (entry: unknown, keys: string[]) => {
  if (!entry || typeof entry !== 'object') return ''
  const values = entry as Record<string, unknown>
  for (const key of keys) {
    const value = values[key]
    if (typeof value === 'string' && value.trim() && value.trim() !== '-') return value.trim()
  }
  return ''
}

const buildNarrativeSignatureHtml = <T>(entry: T) => {
  const submitterName = getEntryText(entry, ['userName', 'operatorName', 'requesterName', 'createdByName']) || '................................'
  const submitterNip = getEntryText(entry, ['userNip', 'operatorNip', 'requesterNip'])
  const reviewerName = getEntryText(entry, ['ownerName', 'validatorName', 'technician', 'approvedByName', 'returnValidatorName']) || '................................'
  const reviewerNip = getEntryText(entry, ['ownerNip', 'validatorNip', 'technicianNip', 'approvedByNip', 'returnValidatorNip'])
  const submitterRole = getEntryText(entry, ['userName'])
    ? 'Peminjam / Pengguna'
    : getEntryText(entry, ['operatorName'])
      ? 'Pengguna Alat'
      : 'Yang Mengajukan'
  const reviewerRole = getEntryText(entry, ['ownerName'])
    ? 'Pemilik Alat'
    : getEntryText(entry, ['technician'])
      ? 'Teknisi / Petugas'
      : 'Mengetahui'

  return `
    <div class="signature-block">
      <div class="signature-block__date">Jakarta, ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</div>
      <div class="signature-block__columns">
        <div class="signature-block__column">
          <div class="signature-block__role">${escapeHtml(submitterRole)}</div>
          <div class="signature-block__space"></div>
          <div class="signature-block__name">${escapeHtml(submitterName)}</div>
          ${submitterNip ? `<div class="signature-block__nip">NIP. ${escapeHtml(submitterNip)}</div>` : ''}
        </div>
        <div class="signature-block__column">
          <div class="signature-block__role">${escapeHtml(reviewerRole)}</div>
          <div class="signature-block__space"></div>
          <div class="signature-block__name">${escapeHtml(reviewerName)}</div>
          ${reviewerNip ? `<div class="signature-block__nip">NIP. ${escapeHtml(reviewerNip)}</div>` : ''}
        </div>
      </div>
    </div>
  `
}

const buildNarrativeEntryHtml = <T>(
  entry: T,
  index: number,
  buildSections: SectionBuilder<T>,
  showEntryHeader: boolean
) => {
  const sections = buildSections(entry)
  if (!sections.length) return ''
  const entryHeader = showEntryHeader
    ? `<div class="entry-card__heading">${escapeHtml(buildEntryHeaderLabel(entry, index))}</div>`
    : ''
  return `
    <article class="entry-card">
      ${entryHeader}
      <div class="entry-card__body">
        ${sections.map((section, sectionIndex) => buildSectionHtml(section, sectionIndex)).join('')}
        ${buildNarrativeSignatureHtml(entry)}
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
  mode: ExportColorMode,
  showEntryHeader: boolean
) => {
  const displaySubtitle = getDistinctNarrativeSubtitle(title, subtitle)
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
          .map((entry, index) => buildNarrativeEntryHtml(entry, index, buildSections, showEntryHeader))
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
          h1.title-only {
            border-bottom: 1px solid ${sectionBorder};
            margin-bottom: 22px;
            padding-bottom: 12px;
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
            border: 0;
            border-left: 1px solid ${sectionBorder};
            border-right: 1px solid ${sectionBorder};
            border-radius: 0;
            box-shadow: none;
            padding: 0 26px 18px;
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
            margin-top: 18px;
          }
          .section-block__heading {
            background: ${sectionHeadingBg};
            border-bottom: 1px solid ${sectionBorder};
            color: #0f172a;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0;
            padding: 0 0 7px;
          }
          .section-block__number { margin-right: 3px; }
          .section-block__rows {
            padding: 0;
            display: block;
          }
          .section-block__row {
            display: flex;
            gap: 8px;
            padding: 5px 0;
            border-bottom: 0;
          }
          .section-block__row:last-child {
            border-bottom: 0;
          }
          .section-block__label {
            color: #64748b;
            flex: 0 0 32%;
            font-size: 13px;
            font-weight: 400;
            letter-spacing: 0;
            margin: 0;
            text-transform: none;
          }
          .section-block__separator {
            color: #0f172a;
            flex: 0 0 auto;
            font-size: 13px;
          }
          .section-block__value {
            border-bottom: 1px dashed #64748b;
            flex: 1;
            font-size: 14px;
            font-weight: 500;
            min-height: 20px;
            color: ${bodyColor};
            margin: 0;
            overflow-wrap: anywhere;
          }
          .signature-block {
            border-top: 1px solid ${sectionBorder};
            margin-top: 26px;
            padding-top: 12px;
            page-break-inside: avoid;
          }
          .signature-block__date {
            font-size: 12px;
            margin: 0 0 18px;
            text-align: right;
          }
          .signature-block__columns {
            display: table;
            table-layout: fixed;
            width: 100%;
          }
          .signature-block__column {
            display: table-cell;
            padding: 0 14px;
            text-align: center;
            vertical-align: top;
            width: 50%;
          }
          .signature-block__role { font-size: 12px; font-weight: 600; }
          .signature-block__space { height: 64px; }
          .signature-block__name { border-top: 1px solid #0f172a; font-size: 12px; font-weight: 700; padding-top: 4px; }
          .signature-block__nip { color: #475569; font-size: 10px; margin-top: 2px; }
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
        <h1${displaySubtitle ? '' : ' class="title-only"'}>${escapeHtml(normalizeCapsText(title))}</h1>
        ${displaySubtitle ? `<p class="subtitle">${escapeHtml(displaySubtitle)}</p>` : ''}
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
  emptyMessage: string,
  showEntryHeader: boolean
): [string, string][] => {
  const displaySubtitle = getDistinctNarrativeSubtitle(title, subtitle)
  const rows: [string, string][] = []
  rows.push([normalizeCapsText(title), ''])
  if (displaySubtitle) rows.push([displaySubtitle, ''])
  rows.push(['', ''])
  if (!entries.length) {
    rows.push([emptyMessage, ''])
    return rows
  }

  entries.forEach((entry, index) => {
    const sections = buildSections(entry)
    if (!sections.length) return
    if (showEntryHeader) {
      const headerLabel = buildEntryHeaderLabel(entry, index)
      const headerMeta = entries.length > 1 ? ` (${index + 1}/${entries.length})` : ''
      rows.push([`${headerLabel}${headerMeta}`, ''])
    }
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

const outputNarrativePdf = async <T>(
  title: string,
  subtitle: string,
  entries: T[],
  fileName: string,
  buildSections: SectionBuilder<T>,
  emptyMessage: string,
  showEntryHeader: boolean,
  paperSize: ExportPaperSize,
  shouldPrint: boolean
) => {
  const displaySubtitle = getDistinctNarrativeSubtitle(title, subtitle)
  const printWindow = shouldPrint ? window.open('', '_blank', 'width=900,height=700') : null
  if (shouldPrint && !printWindow) return
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: getPdfPageFormat(paperSize), compress: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const left = 40
  const right = 40
  const contentWidth = pageWidth - left - right
  const labelWidth = 165
  const separatorX = left + labelWidth
  const valueX = separatorX + 16
  const valueWidth = pageWidth - right - valueX
  const contentBottom = pageHeight - 62
  const estimatedContentHeight = Math.max(1, entries.reduce((total, entry) => {
    const sectionsHeight = buildSections(entry).reduce((sectionTotal, section) =>
      sectionTotal + 33 + section.lines.reduce((lineTotal, line) => lineTotal + Math.max(23, Math.ceil((line.value || '-').length / 68) * 23), 0), 0)
    return total + sectionsHeight + 142 + (showEntryHeader ? 24 : 0) + 20
  }, 0))
  const verticalScale = Math.min(1, (contentBottom - 118) / estimatedContentHeight)
  const scaled = (value: number) => value * verticalScale
  let y = 0

  const drawPageHeader = (includeTitle: boolean) => {
    pdf.setDrawColor(148, 163, 184)
    pdf.setLineWidth(0.6)
    pdf.line(left, 18, pageWidth - right, 18)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(100, 116, 139)
    pdf.text(EXPORT_BRAND_NAME, left, 31)
    if (!includeTitle) {
      y = 50
      return
    }
    pdf.setFontSize(20)
    pdf.setTextColor(15, 23, 42)
    pdf.text(normalizeCapsText(title), left, 60)
    if (displaySubtitle) {
      pdf.setFontSize(10)
      pdf.setTextColor(100, 116, 139)
      pdf.text(displaySubtitle.toUpperCase(), left, 84)
    }
    pdf.setDrawColor(219, 228, 240)
    const dividerY = displaySubtitle ? 96 : 76
    pdf.line(left, dividerY, pageWidth - right, dividerY)
    y = dividerY + 22
  }

  const drawSection = (section: DocumentSection, sectionIndex: number) => {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(Math.max(6, scaled(11.5)))
    pdf.setTextColor(15, 23, 42)
    pdf.text(`${toRomanNumeral(sectionIndex + 1)}. ${normalizeCapsText(section.title)}`, left + 10, y)
    pdf.setDrawColor(219, 228, 240)
    pdf.setLineWidth(0.6)
    pdf.line(left + 10, y + scaled(8), pageWidth - right, y + scaled(8))
    y += scaled(25)

    section.lines.forEach((line) => {
      const valueLines = pdf.splitTextToSize(line.value || '-', valueWidth) as string[]
      const rowHeight = scaled(Math.max(23, valueLines.length * 14 + 9))

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(Math.max(5.5, scaled(10.5)))
      pdf.setTextColor(100, 116, 139)
      pdf.text(normalizeCapsText(line.label), left + 10, y)
      pdf.setTextColor(15, 23, 42)
      pdf.text(':', separatorX, y)
      // Keep exported/printed field values consistent with the HTML document,
      // where values use a medium (non-bold) weight.
      pdf.setFont('helvetica', 'normal')
      pdf.text(valueLines, valueX, y)
      pdf.setDrawColor(100, 116, 139)
      pdf.setLineDashPattern([1.5, 1.5], 0)
      pdf.line(valueX, y + scaled(valueLines.length * 14 - 9), pageWidth - right, y + scaled(valueLines.length * 14 - 9))
      pdf.setLineDashPattern([], 0)
      y += rowHeight
    })
    y += scaled(8)
  }

  const drawSignature = (entry: T) => {
    const submitterName = getEntryText(entry, ['userName', 'operatorName', 'requesterName', 'createdByName']) || '................................'
    const submitterNip = getEntryText(entry, ['userNip', 'operatorNip', 'requesterNip'])
    const reviewerName = getEntryText(entry, ['ownerName', 'validatorName', 'technician', 'approvedByName', 'returnValidatorName']) || '................................'
    const reviewerNip = getEntryText(entry, ['ownerNip', 'validatorNip', 'technicianNip', 'approvedByNip', 'returnValidatorNip'])
    const submitterRole = getEntryText(entry, ['userName'])
      ? 'Peminjam / Pengguna'
      : getEntryText(entry, ['operatorName'])
        ? 'Pengguna Alat'
        : 'Yang Mengajukan'
    const reviewerRole = getEntryText(entry, ['ownerName'])
      ? 'Pemilik Alat'
      : getEntryText(entry, ['technician'])
        ? 'Teknisi / Petugas'
        : 'Mengetahui'
    const dateLabel = `Jakarta, ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}`
    const leftCenter = left + contentWidth * 0.25
    const rightCenter = left + contentWidth * 0.75

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(Math.max(6, scaled(10)))
    pdf.setTextColor(15, 23, 42)
    pdf.text(dateLabel, pageWidth - right, y, { align: 'right' })
    y += scaled(24)
    pdf.setFont('helvetica', 'bold')
    pdf.text(submitterRole, leftCenter, y, { align: 'center' })
    pdf.text(reviewerRole, rightCenter, y, { align: 'center' })
    y += scaled(58)
    pdf.setDrawColor(15, 23, 42)
    pdf.line(left + 28, y, left + contentWidth / 2 - 28, y)
    pdf.line(left + contentWidth / 2 + 28, y, pageWidth - right - 28, y)
    y += scaled(13)
    pdf.text(submitterName, leftCenter, y, { align: 'center' })
    pdf.text(reviewerName, rightCenter, y, { align: 'center' })
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(Math.max(5.5, scaled(8.5)))
    if (submitterNip) pdf.text(`NIP. ${submitterNip}`, leftCenter, y + 13, { align: 'center' })
    if (reviewerNip) pdf.text(`NIP. ${reviewerNip}`, rightCenter, y + 13, { align: 'center' })
    y += scaled(30)
  }

  drawPageHeader(true)
  if (!entries.length) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    pdf.setTextColor(100, 116, 139)
    pdf.text(emptyMessage, left, y)
  } else {
    entries.forEach((entry, entryIndex) => {
      if (entryIndex > 0) {
        pdf.setDrawColor(148, 163, 184)
        pdf.line(left, y, pageWidth - right, y)
        y += scaled(20)
      }
      if (showEntryHeader) {
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(Math.max(6, scaled(11)))
        pdf.setTextColor(15, 23, 42)
        pdf.text(buildEntryHeaderLabel(entry, entryIndex), left, y)
        y += scaled(24)
      }
      buildSections(entry).forEach(drawSection)
      drawSignature(entry)
    })
  }

  const pageCount = pdf.getNumberOfPages()
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    pdf.setPage(pageNumber)
    pdf.setDrawColor(219, 228, 240)
    pdf.line(left, pageHeight - 36, pageWidth - right, pageHeight - 36)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(100, 116, 139)
    pdf.text(EXPORT_SYSTEM_NAME, pageWidth / 2, pageHeight - 23, { align: 'center' })
  }

  if (shouldPrint && printWindow) {
    pdf.autoPrint()
    const pdfUrl = URL.createObjectURL(pdf.output('blob'))
    printWindow.location.href = pdfUrl
    window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000)
    return
  }
  pdf.save(fileName)
}

export interface NarrativeReportOptions<T> {
  title: string
  subtitle?: string
  entries: T[]
  filePrefix?: string
  buildSections: SectionBuilder<T>
  emptyMessage?: string
  showEntryHeader?: boolean
}

export async function exportNarrativeReport<T>(format: ExportFormat, options: NarrativeReportOptions<T>) {
  const {
    title,
    subtitle = 'Laporan Teknis Unit Medis',
    entries,
    filePrefix,
    buildSections,
    emptyMessage = 'Tidak ada data yang dipilih.',
    showEntryHeader = false,
  } = options
  const slug = filePrefix || title.toLowerCase().replace(/\s+/g, '-')
  const colorMode = pickExportColorMode()
  const html = buildNarrativeHtml(title, entries, subtitle, buildSections, emptyMessage, colorMode, showEntryHeader)
  const paperSize: ExportPaperSize = format.endsWith('-f4') ? 'f4' : 'a4'

  if (format === 'pdf' || format === 'pdf-f4') {
    await outputNarrativePdf(title, subtitle, entries, `${slug}.pdf`, buildSections, emptyMessage, showEntryHeader, paperSize, false)
    return
  }

  if (format === 'print' || format === 'print-f4') {
    await outputNarrativePdf(title, subtitle, entries, `${slug}.pdf`, buildSections, emptyMessage, showEntryHeader, paperSize, true)
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
    const rows = buildNarrativeRows(entries, title, subtitle, buildSections, emptyMessage, showEntryHeader)
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
  appendLine(administration, 'Bukti Kerusakan', entry.damagePhotoUrl)

  const execution: SectionLine[] = []
  appendLine(execution, 'Teknisi Pelaksana', entry.technician)
  appendLine(execution, 'Waktu Selesai', entry.completionDate)
  appendLine(execution, 'Biaya Pemeliharaan', entry.cost)
  appendLine(execution, 'Foto Sebelum', entry.beforePhotoUrl)
  appendLine(execution, 'Foto Sesudah', entry.afterPhotoUrl)
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
    showEntryHeader: false,
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
    <div class="f-brand">${escapeHtml(EXPORT_BRAND_NAME)}</div>
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
    .f-title { border-bottom: 1px solid #dbe4f0; font-size: 16pt; font-weight: bold; padding-bottom: 10px; text-align: left; margin-bottom: 4px; }
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
  const paperSize: ExportPaperSize = format.endsWith('-f4') ? 'f4' : 'a4'

  if (format === 'pdf' || format === 'pdf-f4') {
    await downloadHtmlAsPdf(html, `${filePrefix}.pdf`, paperSize)
    return
  }

  if (format === 'print' || format === 'print-f4') {
    await printHtmlAsPdf(html, paperSize)
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
      if (data.signatureLeft.nip) sheet.addRow(['NIP', data.signatureLeft.nip])
      sheet.addRow([data.signatureRight.title, data.signatureRight.name])
      if (data.signatureRight.nip) sheet.addRow(['NIP', data.signatureRight.nip])
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
