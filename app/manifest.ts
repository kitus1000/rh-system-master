import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
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
}
