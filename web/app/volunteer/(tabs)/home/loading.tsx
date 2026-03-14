// Skeleton shown by Next.js Suspense while the Home server component loads
export default function HomeLoading() {
  return (
    <div style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      {/* Navy header skeleton */}
      <div style={{
        background: 'linear-gradient(135deg, #1B2A4A 0%, #243660 100%)',
        padding: 'calc(env(safe-area-inset-top) + 48px) 20px 28px',
      }}>
        <Shimmer width="120px" height="14px" radius="6px" light />
        <div style={{ marginTop: '6px' }} />
        <Shimmer width="180px" height="26px" radius="6px" light />
        <div style={{ marginTop: '16px' }} />
        <Shimmer width="100%" height="6px" radius="999px" light opacity={0.3} />
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Next shift card */}
        <Shimmer width="100%" height="100px" radius="14px" />
        {/* Credential warning */}
        <Shimmer width="100%" height="56px" radius="12px" />
        {/* Shift card */}
        <Shimmer width="100%" height="80px" radius="14px" />
        {/* Shift card */}
        <Shimmer width="100%" height="80px" radius="14px" />
      </div>
    </div>
  )
}

function Shimmer({
  width,
  height,
  radius = '8px',
  light = false,
  opacity = 0.5,
}: {
  width: string
  height: string
  radius?: string
  light?: boolean
  opacity?: number
}) {
  return (
    <div style={{
      width,
      height,
      borderRadius: radius,
      background: light
        ? `rgba(255,255,255,${opacity})`
        : '#e5e7eb',
      animation: 'pulse 1.6s ease-in-out infinite',
      flexShrink: 0,
    }}>
      <style suppressHydrationWarning>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  )
}
