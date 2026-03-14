export default function ShiftsLoading() {
  return (
    <div style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1B2A4A 0%, #243660 100%)',
        padding: 'calc(env(safe-area-inset-top) + 48px) 20px 24px',
      }}>
        <Shimmer width="80px" height="26px" radius="6px" light />
        <div style={{ marginTop: '8px' }} />
        <Shimmer width="160px" height="14px" radius="6px" light opacity={0.4} />
        {/* Tab toggle */}
        <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
          <Shimmer width="90px" height="32px" radius="8px" light opacity={0.5} />
          <Shimmer width="70px" height="32px" radius="8px" light opacity={0.25} />
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Shimmer width="100%" height="160px" radius="16px" />
        <Shimmer width="100%" height="160px" radius="16px" />
        <Shimmer width="100%" height="160px" radius="16px" />
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
