export default function LearnLoading() {
  return (
    <div style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <div style={{
        background: 'linear-gradient(135deg, #1B2A4A 0%, #243660 100%)',
        padding: 'calc(env(safe-area-inset-top) + 48px) 20px 28px',
      }}>
        <Shimmer width="60px" height="26px" radius="6px" light />
        <div style={{ marginTop: '6px' }} />
        <Shimmer width="180px" height="14px" radius="6px" light opacity={0.4} />
        <div style={{ marginTop: '16px' }} />
        <Shimmer width="100%" height="6px" radius="999px" light opacity={0.3} />
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[120, 96, 120].map((h, i) => (
          <Shimmer key={i} width="100%" height={`${h}px`} radius="14px" />
        ))}
      </div>
    </div>
  )
}

function Shimmer({ width, height, radius = '8px', light = false, opacity = 0.5 }: {
  width: string; height: string; radius?: string; light?: boolean; opacity?: number
}) {
  return (
    <div style={{
      width, height, borderRadius: radius, flexShrink: 0,
      background: light ? `rgba(255,255,255,${opacity})` : '#e5e7eb',
      animation: 'pulse 1.6s ease-in-out infinite',
    }}>
      <style suppressHydrationWarning>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
    </div>
  )
}
