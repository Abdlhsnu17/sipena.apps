
"use client"

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/services/api.service";
import { getAuthToken, getCurrentUser } from "@/services/auth-utils";
import reportService, { type ReportUpload } from "@/services/report.service";
import type { User } from "@/types/auth-types";
import { Trash2, UploadCloud } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
type RawUpload = Record<string, unknown>
const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
])
const UPLOAD_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"

const getFileExtension = (filename: string): string => {
  const dotIndex = filename.lastIndexOf(".")
  if (dotIndex < 0) return ""
  return filename.slice(dotIndex).toLowerCase()
}

const toArray = <T,>(value: T[] | undefined | null): T[] => (Array.isArray(value) ? value : [])

const normalizeUpload = (upload: RawUpload): ReportUpload => {
  const uploadedAtSource = upload.uploadedAt ?? upload.uploaded_at
  const normalizedId = typeof upload.id === "number" ? upload.id : Number(upload.id ?? Date.now())
  const uploadedAt =
    uploadedAtSource instanceof Date
      ? uploadedAtSource.toISOString()
      : typeof uploadedAtSource === "string"
        ? uploadedAtSource
        : ""

  return {
    id: Number.isNaN(normalizedId) ? Date.now() : normalizedId,
    userId:
      upload.userId !== undefined
        ? (upload.userId as number | null)
        : upload.user_id !== undefined
          ? (upload.user_id as number | null)
          : null,
    filename: (upload.filename as string) ?? "Laporan tanpa nama",
    contentType:
      (upload.contentType as string) ?? (upload.content_type as string) ?? "application/octet-stream",
    sizeBytes: Number(upload.sizeBytes ?? upload.size_bytes ?? 0),
    storedPath: (upload.storedPath as string | null) ?? (upload.stored_path as string | null) ?? null,
    uploadedAt,
    notes: (upload.notes as string | null) ?? null,
    downloadPath: (upload.downloadPath as string) ?? (upload.download_path as string) ?? "",
    previewPath:
      (upload.previewPath as string) ??
      (upload.preview_path as string) ??
      (upload.downloadPath as string) ??
      (upload.download_path as string) ??
      "",
  }
}
const formatUploadDate = (value?: string | null) => {
  if (!value) return "Tanggal tidak tersedia"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "Tanggal tidak tersedia"
  return parsed.toLocaleString("id-ID")
}

const formatSize = (bytes?: number) => {
  if (!bytes || Number.isNaN(bytes)) return "0.00"
  return (bytes / 1024).toFixed(2)
}

const getPreviewUrl = (upload?: ReportUpload | null) => {
  if (!upload) return ""
  const path = upload.previewPath || upload.downloadPath
  if (!path) return ""
  return `${API_BASE_URL}${path}`
}

const getDownloadUrl = (upload?: ReportUpload | null) => {
  if (!upload?.downloadPath) return ""
  return `${API_BASE_URL}${upload.downloadPath}`
}


const sortUploads = (uploads: ReportUpload[]) => {
  const parseDate = (value: string) => {
    const timestamp = new Date(value).getTime()
    return Number.isNaN(timestamp) ? 0 : timestamp
  }
  return [...uploads].sort((a, b) => parseDate(b.uploadedAt) - parseDate(a.uploadedAt))
}

const TEXT_PREVIEW_PATTERNS = [
  "text/",
  "application/json",
  "application/xml",
  "application/javascript",
  "application/typescript",
  "application/ld+json",
  "application/x-javascript",
]

const matchesTextPreview = (mime: string): boolean => {
  if (!mime) return false
  const normalized = mime.toLowerCase()
  return TEXT_PREVIEW_PATTERNS.some((pattern) =>
    pattern.endsWith("/")
      ? normalized.startsWith(pattern)
      : normalized === pattern,
  )
}

export default function UnggahanPage() {
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const [uploadedReportName, setUploadedReportName] = useState<string | null>(null)
  const [uploadedReports, setUploadedReports] = useState<ReportUpload[]>([])
  const [previewReport, setPreviewReport] = useState<ReportUpload | null>(null)
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null)
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(null)
  const [textPreviewContent, setTextPreviewContent] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<User | null>(() => getCurrentUser())
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const canDeleteUploads = currentUser
    ? (currentUser.role ?? "").toLowerCase() === "admin"
    : false
  const totalUploads = uploadedReports.length
  const latestUploadLabel = uploadedReports[0] ? formatUploadDate(uploadedReports[0].uploadedAt) : "Belum ada unggahan"

  useEffect(() => {
    if (typeof window === "undefined") return
    const handler = () => setCurrentUser(getCurrentUser())
    window.addEventListener("auth-user-updated", handler)
    return () => window.removeEventListener("auth-user-updated", handler)
  }, [])

  useEffect(() => {
    const loadUploads = async () => {
      setIsLoading(true)
      try {
        const response = await reportService.getUploadedReports()
        if (response.success && response.data) {
          const normalized = toArray(response.data).map((upload) =>
            normalizeUpload(upload as unknown as RawUpload),
          )
          setUploadedReports(sortUploads(normalized))
        }
      } catch (error) {
        console.error("Failed to load uploaded reports:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadUploads()
  }, [])

  useEffect(() => {
    let objectUrl: string | null = null
    let isCancelled = false

    const resetPreview = () => {
      setPreviewObjectUrl(null)
      setTextPreviewContent(null)
      setPreviewError(null)
      setPreviewMimeType(null)
    }

    const loadPreview = async () => {
      if (!previewReport) {
        resetPreview()
        return
      }

      const previewUrl = getPreviewUrl(previewReport)
      if (!previewUrl) {
        resetPreview()
        if (!isCancelled) {
          setPreviewError("Tautan pratinjau tidak tersedia.")
        }
        return
      }

      setIsLoadingPreview(true)
      setPreviewError(null)

      try {
        const token = getAuthToken()
        const headers: Record<string, string> = {}
        if (token) {
          headers.Authorization = `Bearer ${token}`
        }
        const downloadUrl = getDownloadUrl(previewReport)

        let response = await fetch(previewUrl, { headers })

        // Fallback to download endpoint when preview route is unavailable.
        if (
          response.status === 404 &&
          downloadUrl &&
          downloadUrl !== previewUrl
        ) {
          response = await fetch(downloadUrl, { headers })
        }

        if (!response.ok) {
          const message =
            response.status === 404
              ? "File pratinjau tidak ditemukan."
              : `Pratinjau gagal dimuat (status ${response.status}).`
          if (!isCancelled) {
            setPreviewError(message)
            setPreviewObjectUrl(null)
            setTextPreviewContent(null)
          }
          return
        }

        const headerType = response.headers.get("content-type") ?? previewReport.contentType ?? ""
        const normalizedType = headerType.split(";")[0].trim().toLowerCase()
        if (!isCancelled) {
          setPreviewMimeType(normalizedType)
        }

        const isTextPreview = matchesTextPreview(normalizedType)

        if (isTextPreview) {
          const text = await response.text()
          if (!isCancelled) {
            setPreviewObjectUrl(null)
            setTextPreviewContent(text)
          }
          return
        }

        const blob = await response.blob()
        objectUrl = URL.createObjectURL(blob)
        if (!isCancelled) {
          setPreviewObjectUrl(objectUrl)
          setTextPreviewContent(null)
        }
      } catch {
        if (!isCancelled) {
          setPreviewError("Pratinjau tidak bisa dimuat.")
          setPreviewObjectUrl(null)
          setTextPreviewContent(null)
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingPreview(false)
        }
      }
    }

    void loadPreview()

    return () => {
      isCancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
      resetPreview()
    }
  }, [previewReport])

  const clearUploadSelection = () => {
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (folderInputRef.current) folderInputRef.current.value = ""
    setUploadedReportName(null)
  }

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files?.length) return

    try {
      const selectedFiles = Array.from(files)
      const hasFolderPath = selectedFiles.some((file) => Boolean(file.webkitRelativePath))
      const uploadResults: ReportUpload[] = []
      const invalidFiles = selectedFiles.filter((file) => !ALLOWED_UPLOAD_EXTENSIONS.has(getFileExtension(file.name)))
      const validFiles = selectedFiles.filter((file) => ALLOWED_UPLOAD_EXTENSIONS.has(getFileExtension(file.name)))

      if (invalidFiles.length > 0) {
        const invalidNames = invalidFiles
          .slice(0, 3)
          .map((file) => file.name)
          .join(", ")

        toast({
          title: "Beberapa file tidak didukung",
          description:
            invalidFiles.length > 3
              ? `${invalidNames}, dan lainnya diabaikan.`
              : `${invalidNames} diabaikan karena tipe file tidak didukung.`,
          variant: "destructive",
        })
      }

      if (validFiles.length === 0) {
        return
      }

      for (const file of validFiles) {
        const response = await reportService.uploadReport(file)
        if (response.success && response.data)
          uploadResults.push(normalizeUpload(response.data as unknown as RawUpload))
      }

      if (uploadResults.length > 0) {
        setUploadedReports((prev) => sortUploads([...uploadResults, ...prev]))
        if (hasFolderPath) {
          const folderName = selectedFiles[0]?.webkitRelativePath?.split("/")[0] || "folder"
          setUploadedReportName(`${folderName} (${selectedFiles.length} file)`)
        } else {
          setUploadedReportName(selectedFiles.length > 1 ? `${selectedFiles.length} file dipilih` : selectedFiles[0].name)
        }

        toast({
          title: "Unggahan berhasil disimpan",
          description:
            uploadResults.length === 1
              ? "1 file unggahan sudah tersimpan."
              : `${uploadResults.length} file unggahan sudah tersimpan.`,
        })
      }
    } catch (error) {
      console.error("Failed to upload reports:", error)
      const errorMessage = error instanceof Error ? error.message : "Gagal menyimpan file unggahan."
      toast({
        title: "Unggahan gagal",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      event.target.value = ""
    }
  }

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const openFolderPicker = () => {
    folderInputRef.current?.click()
  }

  const handleDeleteUpload = async (id: number) => {
    if (!canDeleteUploads) return
    const isConfirmed = await confirm({
      title: "Hapus unggahan",
      description: "Hapus unggahan ini?",
      confirmText: "Ya, hapus",
      destructive: true,
    })
    if (!isConfirmed) return
    try {
      setDeletingId(id)
      const response = await reportService.deleteUpload(id)
      if (response.success) {
        setUploadedReports((prev) => prev.filter((upload) => upload.id !== id))
        toast({
          title: "Unggahan berhasil dihapus",
          description: "Data unggahan sudah diperbarui.",
        })
      }
    } catch (error) {
      console.error("Failed to delete upload:", error)
      toast({
        title: "Gagal menghapus unggahan",
        description: "Terjadi kesalahan saat menghapus unggahan.",
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
    }
  }

  const handleDownload = async (report: ReportUpload) => {
    if (!report.downloadPath) {
      alert("Tautan unduhan tidak tersedia.")
      return
    }

    const downloadUrl = `${API_BASE_URL}${report.downloadPath}`

    try {
      setDownloadingId(report.id)
      const token = getAuthToken()
      const response = await fetch(downloadUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = report.filename || "laporan"
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to download report:", error)
      alert("Gagal mengunduh file. Silakan coba lagi.")
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="flex-1 bg-background">
      <main className="flex flex-col bg-linear-to-br from-slate-50 via-white to-teal-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/30">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 page-gutter md:gap-8">
          <section className="overflow-hidden rounded-4xl border border-white/60 bg-white/85 shadow-[0_30px_80px_rgba(14,165,233,0.14)] backdrop-blur-sm">
            <div className="bg-linear-to-r from-slate-900 via-cyan-800 to-teal-600 panel-gutter text-white">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl space-y-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/14 ring-1 ring-white/20 backdrop-blur">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">Unggahan</h1>
                    <p className="max-w-2xl text-sm leading-6 text-cyan-50/90">
                      Pusat arsip file dengan alur unggah yang lebih bersih, cepat, dan mudah dipantau.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge className="border-white/20 bg-white/14 px-3 py-1 text-white hover:bg-white/14">
                      {totalUploads} file tersimpan
                    </Badge>
                    <Badge className="border-white/20 bg-white/14 px-3 py-1 text-white hover:bg-white/14">
                      9 format didukung
                    </Badge>
                    <Badge className="border-white/20 bg-white/14 px-3 py-1 text-white hover:bg-white/14">
                      Update terakhir: {latestUploadLabel}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 panel-gutter md:grid-cols-[minmax(0,1fr)_220px]">
              <Card className="rounded-[28px] border border-slate-200/70 bg-white/90 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
                <CardContent className="space-y-5 p-5">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-foreground">Pilih sumber unggahan</h2>
                    <p className="text-sm text-muted-foreground">Unggah satu file atau satu folder arsip tanpa langkah tambahan.</p>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex h-auto items-center justify-between gap-3 rounded-2xl border-teal-100/80 bg-linear-to-r from-teal-50 to-cyan-50 px-4 py-4 text-left text-sm font-semibold text-teal-700 hover:border-teal-200 hover:bg-teal-50 dark:bg-slate-900/40 dark:text-teal-200"
                      onClick={openFilePicker}
                    >
                      <span className="truncate">
                        {uploadedReportName ? `Terpilih: ${uploadedReportName}` : "Pilih file laporan"}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-700">File</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex h-auto items-center justify-between gap-3 rounded-2xl border-cyan-100/80 bg-linear-to-r from-cyan-50 to-sky-50 px-4 py-4 text-left text-sm font-semibold text-cyan-700 hover:border-cyan-200 hover:bg-cyan-50 dark:bg-slate-900/40 dark:text-cyan-200"
                      onClick={openFolderPicker}
                    >
                      <span className="truncate">Pilih folder arsip</span>
                      <span className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-700">Folder</span>
                    </Button>
                  </div>

                  {uploadedReportName && (
                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground sm:w-auto sm:self-end" onClick={clearUploadSelection}>
                      Batal pilihan
                    </Button>
                  )}

                  <input ref={fileInputRef} id="report-upload" type="file" className="sr-only" onChange={handleFileUpload} multiple accept={UPLOAD_ACCEPT} />
                  <input
                    ref={folderInputRef}
                    type="file"
                    className="sr-only"
                    onChange={handleFileUpload}
                    multiple
                    accept={UPLOAD_ACCEPT}
                    {...({ webkitdirectory: "" } as Record<string, string>)}
                  />
                </CardContent>
              </Card>

              <div className="rounded-[28px] border border-cyan-100 bg-linear-to-br from-cyan-50 via-white to-teal-50/80 p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-cyan-700/70">Format</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">PDF, Word, Excel, dan gambar.</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Tipe yang didukung: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG, dan WEBP.
                </p>
              </div>
            </div>
          </section>

          <Card className="rounded-[28px] border border-white/60 bg-white/90 shadow-[0_24px_70px_rgba(15,23,42,0.12)] dark:bg-slate-950/70">
            <CardHeader className="flex flex-wrap items-center justify-between gap-3 pb-0">
              <div>
                <CardTitle className="text-2xl">Riwayat Unggahan</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Akses pratinjau dan unduhan file langsung dari satu daftar.
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
                {totalUploads} arsip
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
            {isLoading ? (
              <p className="text-xs text-muted-foreground">Memuat unggahan...</p>
            ) : uploadedReports.length === 0 ? (
              <p className="text-xs text-muted-foreground">Belum ada unggahan.</p>
            ) : (
              <div className="space-y-4">
                {uploadedReports.map((report) => (
                  <article
                    key={report.id}
                    className="space-y-3 rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-semibold text-foreground">{report.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatUploadDate(report.uploadedAt)} • {formatSize(report.sizeBytes)} KB
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <Badge variant="outline" className="border-teal-200 text-teal-600">Terunggah</Badge>
                        {report.contentType && (
                          <Badge variant="outline" className="text-slate-600 dark:text-slate-200">
                            {report.contentType}
                          </Badge>
                        )}
                        {report.previewPath && (
                          <Badge variant="outline" className="text-foreground">
                            Pratinjau siap
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setPreviewReport(report)}>
                          Lihat
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full sm:w-auto"
                          disabled={downloadingId === report.id}
                          onClick={() => handleDownload(report)}
                        >
                          {downloadingId === report.id ? "Mengunduh..." : "Unduh"}
                        </Button>
                      </div>
                      {canDeleteUploads && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="self-end text-red-600 hover:text-red-700 sm:self-auto"
                          onClick={() => handleDeleteUpload(report.id)}
                          disabled={deletingId === report.id}
                          aria-label="Hapus unggahan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!previewReport} onOpenChange={(open) => setPreviewReport(open ? previewReport : null)}>
          <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>{previewReport?.filename ?? "Pratinjau laporan"}</DialogTitle>
              <DialogDescription>Lihat unggahan langsung tanpa harus mengunduh terlebih dahulu.</DialogDescription>
            </DialogHeader>

            {previewReport ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>{formatUploadDate(previewReport.uploadedAt)}</span>
                  <span>{formatSize(previewReport.sizeBytes)} KB</span>
                  {previewReport.contentType && <span>{previewReport.contentType}</span>}
                </div>

                {(() => {
                  if (!previewReport) return null
                  const previewUrl = getPreviewUrl(previewReport)
                  const mime = previewMimeType ?? previewReport.contentType?.toLowerCase() ?? ""
                  const previewSource = previewObjectUrl || previewUrl

                  if (!previewUrl) {
                    return <p className="text-sm text-muted-foreground">Tautan pratinjau tidak tersedia.</p>
                  }

                  if (isLoadingPreview) {
                    return <p className="text-sm text-muted-foreground">Memuat pratinjau...</p>
                  }

                  if (previewError) {
                    return (
                      <div className="p-4 border rounded-lg bg-muted/40 text-sm text-muted-foreground space-y-2">
                        <p>{previewError}</p>
                        {previewReport.downloadPath && (
                          <Button onClick={() => handleDownload(previewReport)} disabled={downloadingId === previewReport.id}>
                            {downloadingId === previewReport.id ? "Mengunduh..." : "Unduh file"}
                          </Button>
                        )}
                      </div>
                    )
                  }

                  if (textPreviewContent) {
                    return (
                      <div className="rounded-lg border bg-muted/30 p-4">
                        <pre className="max-h-120 overflow-auto whitespace-pre-wrap text-sm text-muted-foreground">
                          {textPreviewContent}
                        </pre>
                      </div>
                    )
                  }

                  if (previewSource && mime.startsWith("image/")) {
                    return (
                      <div className="rounded-lg border overflow-hidden bg-muted/30">
                        <img
                          src={previewSource}
                          alt={previewReport.filename}
                          className="w-full h-auto max-h-120 object-contain bg-background"
                        />
                      </div>
                    )
                  }

                  if (previewSource) {
                    return (
                      <div className="rounded-lg border overflow-hidden bg-muted/30">
                        <iframe
                          src={previewSource}
                          className="w-full h-120"
                          title={`Pratinjau ${previewReport.filename}`}
                        />
                      </div>
                    )
                  }

                  return (
                    <div className="p-4 border rounded-lg bg-muted/40 text-sm text-muted-foreground space-y-2">
                      <p>Pratinjau langsung tidak tersedia untuk tipe file ini.</p>
                      {previewReport.downloadPath && (
                        <Button onClick={() => handleDownload(previewReport)} disabled={downloadingId === previewReport.id}>
                          {downloadingId === previewReport.id ? "Mengunduh..." : "Unduh file"}
                        </Button>
                      )}
                    </div>
                  )
                })()}

                <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setPreviewReport(null)}>
                    Tutup
                  </Button>
                  {previewReport.downloadPath && (
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => handleDownload(previewReport)}
                      disabled={downloadingId === previewReport.id}
                    >
                      {downloadingId === previewReport.id ? "Mengunduh..." : "Unduh"}
                    </Button>
                  )}
                </DialogFooter>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-[13px] text-muted-foreground">
            Sistem Inventaris  Peminjaman serta Pemeliharaan  sarana (SiPeNa)
          </p>
        </div>
      </div>
    </main>
  </div>
)
}
