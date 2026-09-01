import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  themeColor: '#10b981',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1
}

export const metadata: Metadata = {
  title: 'Portal de Choferes - Minas de Bacis',
  description: 'App móvil oficial para control de rutas mineras, checklist de unidades y escaneo de credenciales QR 100% offline.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Choferes Bacis'
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
        <meta name="application-name" content="Choferes Bacis" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Choferes Bacis" />
        <meta name="theme-color" content="#10b981" />
        <link rel="apple-touch-icon" href="/logo-bacis.png" />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
