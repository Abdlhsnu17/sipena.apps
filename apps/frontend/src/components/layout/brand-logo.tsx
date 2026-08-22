"use client"

import appSettingService, {
  BRANDING_UPDATED_EVENT,
  DEFAULT_BRAND_LOGO,
  resolveBrandLogoUrl,
} from "@/services/app-setting.service"
import Image from "next/image"
import { useEffect, useState } from "react"

type BrandLogoProps = {
  width: number
  height: number
  className?: string
  priority?: boolean
}

export default function BrandLogo({ width, height, className, priority = false }: BrandLogoProps) {
  const [src, setSrc] = useState(DEFAULT_BRAND_LOGO)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const setting = await appSettingService.getBrandLogo()
        if (active) setSrc(resolveBrandLogoUrl(setting.value, setting.updatedAt ?? null))
      } catch {
        if (active) setSrc(DEFAULT_BRAND_LOGO)
      }
    }

    const handleUpdate = () => void load()
    void load()
    window.addEventListener(BRANDING_UPDATED_EVENT, handleUpdate)
    return () => {
      active = false
      window.removeEventListener(BRANDING_UPDATED_EVENT, handleUpdate)
    }
  }, [])

  return (
    <Image
      src={src}
      alt="Logo aplikasi"
      width={width}
      height={height}
      className={className}
      priority={priority}
      unoptimized
      onError={() => setSrc(DEFAULT_BRAND_LOGO)}
    />
  )
}
