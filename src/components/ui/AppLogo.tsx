/** IG Curator mark: a 3×3 feed grid with the slot being planned left open. */
export function AppLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  const cells = []
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const x = 14 + c * 13
      const y = 14 + r * 13
      cells.push(
        r === 1 && c === 1 ? (
          <rect key={`${r}${c}`} x={x + 0.75} y={y + 0.75} width="8.5" height="8.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        ) : (
          <rect key={`${r}${c}`} x={x} y={y} width="10" height="10" rx="2" fill="currentColor" />
        ),
      )
    }
  }
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className={`shrink-0 text-white ${className}`}>
      <rect width="64" height="64" rx="14" fill="#0a0a0a" />
      {cells}
    </svg>
  )
}
