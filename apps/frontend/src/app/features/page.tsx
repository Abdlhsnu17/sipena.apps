"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function FeaturesPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/")
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-lg">Mengalihkan ke dashboard...</p>
      </div>
    </div>
  )
}
