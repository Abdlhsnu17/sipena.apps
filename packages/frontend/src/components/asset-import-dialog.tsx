"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { API_BASE_URL } from "@/services/api.service"
import { getAuthToken } from "@/services/auth-utils"
import { AlertCircle, CheckCircle, Download, FileSpreadsheet, Upload } from "lucide-react"
import { useRef, useState } from "react"

interface ImportResult {
  success: number
  failed: number
  errors: { row: number; message: string }[]
  inserted: number[]
}

interface AssetImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetType: "medical" | "non_medical"
  onSuccess?: () => void
}

export function AssetImportDialog({ open, onOpenChange, assetType, onSuccess }: AssetImportDialogProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const typeLabel = assetType === "medical" ? "Medis" : "Non-Medis"

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setSelectedFile(file)
    setResult(null)
  }

  const handleDownloadTemplate = async () => {
    try {
      const token = getAuthToken()
      const res = await fetch(`${API_BASE_URL}/assets/import/template?type=${assetType}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error("Gagal mengunduh template")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `template-import-${assetType}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast({ title: "Gagal mengunduh template", variant: "destructive" })
    }
  }

  const handleImport = async () => {
    if (!selectedFile) {
      toast({ title: "Pilih file Excel terlebih dahulu", variant: "destructive" })
      return
    }

    setImporting(true)
    setResult(null)

    try {
      const token = getAuthToken()
      const formData = new FormData()
      formData.append("file", selectedFile)

      const res = await fetch(`${API_BASE_URL}/assets/import?type=${assetType}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      const data = await res.json()

      if (data.success) {
        setResult(data.data)
        if (data.data.success > 0) {
          toast({
            title: `Import berhasil: ${data.data.success} aset ditambahkan`,
            description: data.data.failed > 0 ? `${data.data.failed} baris gagal` : undefined,
          })
          onSuccess?.()
        }
      } else {
        toast({ title: data.message || "Gagal mengimpor", variant: "destructive" })
      }
    } catch {
      toast({ title: "Terjadi kesalahan saat mengimpor", variant: "destructive" })
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    if (importing) return
    setSelectedFile(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Import Aset {typeLabel} dari Excel
          </DialogTitle>
          <DialogDescription>
            Unggah file Excel (.xlsx) untuk menambahkan banyak aset sekaligus.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-md border bg-muted/50">
            <div className="text-sm">
              <p className="font-medium">Unduh Template Excel</p>
              <p className="text-muted-foreground text-xs">Format kolom yang benar untuk import</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-1" /> Template
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="import-file">File Excel *</Label>
            <div
              className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              {selectedFile ? (
                <div>
                  <p className="font-medium text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground">Klik untuk pilih file .xlsx</p>
                  <p className="text-xs text-muted-foreground">Maks 10 MB</p>
                </div>
              )}
            </div>
            <input
              id="import-file"
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {result && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1 text-center p-3 rounded-md bg-green-50 dark:bg-green-950">
                  <p className="text-2xl font-bold text-green-600">{result.success}</p>
                  <p className="text-xs text-muted-foreground">Berhasil</p>
                </div>
                <div className="flex-1 text-center p-3 rounded-md bg-red-50 dark:bg-red-950">
                  <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                  <p className="text-xs text-muted-foreground">Gagal</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-1">Baris yang gagal:</p>
                    <ul className="text-xs space-y-0.5 max-h-32 overflow-y-auto">
                      {result.errors.map((e) => (
                        <li key={e.row}>Baris {e.row}: {e.message}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              {result.success > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    {result.success} aset berhasil ditambahkan ke inventaris.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            {result ? "Tutup" : "Batal"}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={!selectedFile || importing}>
              {importing ? "Mengimpor..." : (
                <>
                  <Upload className="h-4 w-4 mr-1" /> Import
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
