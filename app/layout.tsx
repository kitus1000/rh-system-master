import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  themeColor: '#1d4ed8',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1
}

export const metadata: Metadata = {
  title: 'PORTAL BACIS | Grupo Minero Bacís S.A. de C.V.',
  description: 'PORTAL BACIS — Plataforma operativa integral de Grupo Minero Bacís S.A. de C.V. Unidad El Herrero: Recursos Humanos, Contratistas, Seguridad Industrial, Clínica Médica, Campamentos y Logística.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PORTAL BACIS'
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="application-name" content="PORTAL BACIS" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="PORTAL BACIS" />
        <meta name="theme-color" content="#1d4ed8" />
        <link rel="apple-touch-icon" href="/app-icon.png" />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
