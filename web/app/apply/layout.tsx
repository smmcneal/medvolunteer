export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Volunteer Application — MedVolunteer</title>
        <style suppressHydrationWarning>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Figtree:wght@400;500;600&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Figtree', sans-serif; background: #f8fafc; color: #1e293b; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
