export const THEME_STORAGE_KEY = "theme"
export const THEME_DEFAULT_THEME = "light"
export const THEME_ATTRIBUTE = "class"
export const THEME_THEMES = ["light", "dark"] as const
export const THEME_ENABLE_SYSTEM = true
export const THEME_ENABLE_COLOR_SCHEME = true

export function createThemeScript() {
  return `(function(){var d=document.documentElement;var e=${JSON.stringify(
    THEME_ATTRIBUTE
  )};var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=${JSON.stringify(
    THEME_DEFAULT_THEME
  )};var s=${JSON.stringify(THEME_ENABLE_SYSTEM)};var c=${JSON.stringify(
    THEME_ENABLE_COLOR_SCHEME
  )};var h=${JSON.stringify([...THEME_THEMES])};var m=window.matchMedia("(prefers-color-scheme: dark)");var g=function(){return m.matches?"dark":"light"};var r;try{r=localStorage.getItem(k)||t}catch(_){r=t}var a=r==="system"&&s?g():r;if(e==="class"){d.classList.remove.apply(d.classList,h);d.classList.add(a)}else{d.setAttribute(e,a)}if(c&&h.indexOf(a)!==-1){d.style.colorScheme=a}})();`
}
