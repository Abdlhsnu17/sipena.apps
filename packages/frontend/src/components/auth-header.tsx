import { KeyRound } from "lucide-react"
import Image from "next/image"

type AuthHeaderProps = {
  title: string
  description?: string
  showRecoveryIcon?: boolean
}

export default function AuthHeader({ title, description, showRecoveryIcon = false }: AuthHeaderProps) {
  return (
    <div className="mx-auto flex min-h-40 w-full max-w-sm flex-col items-center justify-center gap-3 text-center">
      <Image
        src="/images/logo-RS.png"
        alt="Logo RS Kemenkes Persahabatan"
        width={180}
        height={80}
        className="h-16 w-auto object-contain"
        priority
      />
      {showRecoveryIcon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100">
          <KeyRound className="h-5 w-5 text-teal-700" />
        </div>
      ) : null}
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
      {description ? <p className="text-sm leading-5 text-muted-foreground">{description}</p> : null}
    </div>
  )
}