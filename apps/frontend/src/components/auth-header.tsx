import { KeyRound } from "lucide-react";
import Image from "next/image";

type AuthHeaderProps = {
  title: string
  description?: string
  showRecoveryIcon?: boolean
  variant?: "banner" | "inline"
}

export default function AuthHeader({
  title,
  description,
  showRecoveryIcon = false,
  variant = "banner",
}: AuthHeaderProps) {
  if (variant === "inline") {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-1 text-center">
        <Image
          src="/images/logo-sipena-clean.png"
          alt="Logo SiPeNa"
          width={160}
          height={160}
          className="h-auto w-35 shrink-0 object-contain"
          priority
        />
        <div className="space-y-0">
          <h1 className="text-[18px] font-semibold leading-snug tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="text-sm leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-sm text-center">
      <div className="overflow-hidden rounded-4xl border border-white/70 bg-white/90 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm">
        <div className="border-b border-teal-100/70 bg-linear-to-r from-teal-50/80 via-white to-cyan-50/70 px-6 py-5">
          <Image
            src="/images/logo-sipena-clean.png"
            alt="Logo SiPeNa"
            width={180}
            height={101}
            className="mx-auto h-14 w-auto object-contain"
            priority
          />
        </div>
        <div className="space-y-2 px-6 py-5">
          <div className="flex items-center justify-center gap-2">
            {showRecoveryIcon ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                <KeyRound className="h-4 w-4" />
              </span>
            ) : null}
            <h1 className="text-2xl font-bold leading-tight text-foreground">{title}</h1>
          </div>
          {description ? (
            <p className="mx-auto max-w-xs text-sm leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
