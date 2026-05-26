import { KeyRound } from "lucide-react"
import Image from "next/image"

type AuthHeaderProps = {
  title: string
  description?: string
  showRecoveryIcon?: boolean
}

export default function AuthHeader({ title, description, showRecoveryIcon = false }: AuthHeaderProps) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 text-center">
      <div className="flex h-20 w-full max-w-64 items-center justify-center rounded-2xl border border-border/70 bg-white px-5 shadow-sm">
        <Image
          src="/images/logo-sipena-clean.png"
          alt="Logo SiPeNa"
          width={180}
          height={101}
          className="h-14 w-auto object-contain"
          priority
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2">
          {showRecoveryIcon ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
              <KeyRound className="h-4 w-4" />
            </span>
          ) : null}
          <h1 className="text-2xl font-bold leading-tight text-foreground">{title}</h1>
        </div>
        {description ? <p className="mx-auto max-w-xs text-sm leading-5 text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  )
}
