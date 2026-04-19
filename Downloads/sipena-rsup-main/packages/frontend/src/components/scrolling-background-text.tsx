export default function ScrollingBackgroundText() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center opacity-5">
        <div className="whitespace-nowrap animate-scroll text-9xl font-bold text-foreground">
          SIPENA RS PERSAHABATAN
        </div>
      </div>
    </div>
  )
}
