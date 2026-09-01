import { NextResponse } from 'next/server'

export async function GET() {
  const manifestData = {
    name: 'Portal de Choferes - Minas de Bacis',
    short_name: 'Choferes Bacis',
    description: 'App móvil oficial para control de rutas mineras, checklist de unidades y escaneo de credenciales QR 100% offline.',
    start_url: '/chofer-app',
    id: '/chofer-app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#18181b',
    theme_color: '#10b981',
    icons: [
      {
        src: '/logo-bacis.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/logo-bacis.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/logo-bacis.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  }

  return new NextResponse(JSON.stringify(manifestData, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}
