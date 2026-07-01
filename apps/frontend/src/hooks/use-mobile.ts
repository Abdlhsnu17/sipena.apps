import * as React from 'react'

const MOBILE_BREAKPOINT = 768
const TOUCH_DEVICE_QUERY = '(hover: none) and (pointer: coarse)'

function isPhoneLikeViewport() {
  if (typeof window === 'undefined') {
    return false
  }

  const shortestSide = Math.min(window.innerWidth, window.innerHeight)

  return window.matchMedia(TOUCH_DEVICE_QUERY).matches && shortestSide < MOBILE_BREAKPOINT
}

function getIsMobileViewport() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.innerWidth < MOBILE_BREAKPOINT || isPhoneLikeViewport()
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const widthQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const touchQuery = window.matchMedia(TOUCH_DEVICE_QUERY)
    const onChange = () => {
      setIsMobile(getIsMobileViewport())
    }

    onChange()

    widthQuery.addEventListener('change', onChange)
    touchQuery.addEventListener('change', onChange)
    window.addEventListener('resize', onChange)
    screen.orientation?.addEventListener?.('change', onChange)

    return () => {
      widthQuery.removeEventListener('change', onChange)
      touchQuery.removeEventListener('change', onChange)
      window.removeEventListener('resize', onChange)
      screen.orientation?.removeEventListener?.('change', onChange)
    }
  }, [])

  return !!isMobile
}
