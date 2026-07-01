import * as React from "react"

export type Orientation = "portrait" | "landscape"

function getOrientation(): Orientation {
  if (typeof window === "undefined") {
    return "portrait"
  }

  return window.innerWidth > window.innerHeight ? "landscape" : "portrait"
}

export function useOrientation() {
  const [orientation, setOrientation] = React.useState<Orientation>("portrait")

  React.useEffect(() => {
    const checkOrientation = () => {
      setOrientation(getOrientation())
    }

    checkOrientation()
    window.addEventListener("resize", checkOrientation)
    screen.orientation?.addEventListener?.("change", checkOrientation)

    return () => {
      window.removeEventListener("resize", checkOrientation)
      screen.orientation?.removeEventListener?.("change", checkOrientation)
    }
  }, [])

  return orientation
}
