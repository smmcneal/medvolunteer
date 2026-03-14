export default function MessagesLoading() {
  return (
    <div style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <div style={{
        background: 'linear-gradient(135deg, #1B2A4A 0%, #243660 100%)',
        padding: 'calc(env(safe-area-inset-top) + 48px) 20px 24px',
        display: 'flex',
        alignItems: 'flex-end',
        gap: '10px',
      }}>
        <Shimmer width="100px" height="26px" radius="6px" light />
      </div>

      <div style={{ background: 'white' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{
            padding: '16px',
            borderBottom: '1px solid #f3f4f6',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
          }}>
            <Shimmer width="8px" height="8px" radius="50%" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Shimmer width="60%" height="14px" radius="6px" />
                <Shimmer width="40px" height="12px" radius="6px" />
              </div>
              <Shimmer width="80%" height="12px" radius="6px" />
            </div>
          </div>
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
