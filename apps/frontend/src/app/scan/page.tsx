"use client"

import { ScanChoiceButtons, type ScanChoice } from "@/components/scan-choice-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { buildLoginRedirectUrl, getCurrentUser } from "@/services/auth-utils"
import type { User } from "@/types/auth-types"
import { parseScanTargetFromSearchParams } from "@/utils/asset-scan-target"
import { ScanLine } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

export default function ScanPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.replace(buildLoginRedirectUrl())
    } else {
      setCurrentUser(user)
    }
  }, [router])

  if (!currentUser) return null

  const target = parseScanTargetFromSearchParams(searchParams)

  if (!target) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-3 p-6">
            <ScanLine className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-semibold">Kode QR tidak valid</p>
            <p className="text-xs text-muted-foreground">
              Aset tidak dapat dikenali dari kode ini. Silakan pindai ulang label aset.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const choice: ScanChoice = {
    query: target.detailId,
    source: target.type === "non_medis" ? "non-medical" : target.type === "medis" ? "medical" : "unknown",
    target,
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-4 p-6">
          <ScanLine className="h-8 w-8 text-teal-600" />
          <div className="text-center">
            <p className="text-base font-semibold">Aset terdeteksi</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pilih tindakan yang ingin dilakukan untuk aset hasil scan ini.
            </p>
          </div>
          <ScanChoiceButtons choice={choice} onNavigate={(url) => router.push(url)} />
        </CardContent>
      </Card>
    </div>
  )
}
