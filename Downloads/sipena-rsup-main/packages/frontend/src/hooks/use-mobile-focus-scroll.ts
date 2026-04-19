import type { FocusEvent } from "react"
import { useCallback } from "react"

const MOBILE_BREAKPOINT_QUERY = "(max-width: 1024px)"

function isEditableTarget(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.getAttribute("contenteditable") === "true" ||
    target.getAttribute("role") === "textbox"
  )
}

export function useMobileFocusScroll() {
  const handleFocusCapture = useCallback((event: FocusEvent<HTMLElement>) => {
    if (typeof window === "undefined") return

    if (!window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches) return

    const focusTarget = event.target

    if (!isEditableTarget(focusTarget)) return

    window.setTimeout(() => {
      focusTarget.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      })
    }, 120)
  }, [])

  return { handleFocusCapture }
}
