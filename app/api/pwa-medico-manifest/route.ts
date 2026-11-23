import { NextResponse } from 'next/server'

export async function GET() {
  const manifestData = {
    name: 'Médico Bacís — Clínica Móvil',
    short_name: 'Médico Bacís',
    description:
      'Aplicación clínica oficial de Grupo Minero Bacís: pacientes, estatus de alta, recetas COFEPRIS, pases médicos, pases de hotel y sincronización offline.',
    start_url: '/medico-app',
    id: '/medico-app',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0b2559',
    theme_color: '#0b2559',
    icons: [
      {
        src: '/medico-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/medico-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/medico-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }

  return new NextResponse(JSON.stringify(manifestData, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
