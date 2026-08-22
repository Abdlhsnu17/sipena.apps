"use client"

import appSettingService, {
  BRANDING_UPDATED_EVENT,
  cacheBrandLogoUrl,
  DEFAULT_BRAND_LOGO,
  getCachedBrandLogoUrl,
  resolveBrandLogoUrl,
} from "@/services/app-setting.service"
import { cn } from "@/utils/cn"
import Image from "next/image"
import { useEffect, useState } from "react"

type BrandLogoProps = {
  width: number
  height: number
  className?: string
  priority?: boolean
}

export default function BrandLogo({ width, height, className, priority = false }: BrandLogoProps) {
  const [src, setSrc] = useState<string | null>(() => getCachedBrandLogoUrl())

  useEffect(() => {
    let active = true
    const load = async () => {
      const cachedLogoUrl = getCachedBrandLogoUrl()
      if (active && cachedLogoUrl) setSrc(cachedLogoUrl)

      try {
        const setting = await appSettingService.getBrandLogo()
        const logoUrl = resolveBrandLogoUrl(setting.value, setting.updatedAt ?? null)
        cacheBrandLogoUrl(logoUrl)
        if (active) setSrc(logoUrl)
      } catch {
        if (active && !cachedLogoUrl) setSrc(DEFAULT_BRAND_LOGO)
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
      src={src ?? DEFAULT_BRAND_LOGO}
      alt="Logo aplikasi"
      width={width}
      height={height}
      className={cn(className, !src && "opacity-0")}
      priority={priority}
      unoptimized
      onError={() => setSrc(DEFAULT_BRAND_LOGO)}
    />
  )
}
