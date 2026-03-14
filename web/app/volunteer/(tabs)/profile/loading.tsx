export default function ProfileLoading() {
  return (
    <div style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      {/* Navy header with avatar */}
      <div style={{
        background: 'linear-gradient(135deg, #1B2A4A 0%, #243660 100%)',
        padding: 'calc(env(safe-area-inset-top) + 48px) 20px 28px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
      }}>
        <Shimmer width="72px" height="72px" radius="50%" light opacity={0.3} />
        <Shimmer width="140px" height="22px" radius="6px" light />
        <Shimmer width="80px" height="20px" radius="999px" light opacity={0.4} />
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Contact card */}
        <Shimmer width="100%" height="96px" radius="14px" />
        {/* Credentials section */}
        <Shimmer width="100%" height="140px" radius="14px" />
        {/* Documents section */}
        <Shimmer width="100%" height="96px" radius="14px" />
        {/* Background check */}
        <Shimmer width="100%" height="72px" radius="14px" />
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
