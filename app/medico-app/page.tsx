import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Médico Bacís — App Clínica Móvil & Tablet',
  description:
    'Aplicación clínica offline-first de Grupo Minero Bacís: pacientes, verificación de alta, recetas COFEPRIS, pases médicos, pases de hotel y sincronización con base de datos.',
  manifest: '/api/pwa-medico-manifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Médico Bacís',
  },
  icons: {
    icon: '/medico-icon-192.png',
    apple: '/medico-icon-512.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0b2559',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function MedicoAppPage() {
  return (
    <main className="fixed inset-0 w-screen h-[100dvh] bg-[#0b2559] overflow-hidden">
      <iframe
        src="/medico-app/index.html"
        title="Médico Bacís — Clínica Móvil y Tablet"
        className="w-full h-full border-0 block"
        allow="camera; microphone; fullscreen"
      />
    </main>
  )
}
