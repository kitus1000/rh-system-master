export interface LockerExtendedMeta {
  deja_llave_rh?: 'Si' | 'No' | 'Ya Entregada' | 'Sin Definir'
  estatus_resguardo?: 'Pendiente Firma en RH' | 'Firmado' | 'Sin Resguardo'
  folio_resguardo?: string
  telefono_contacto?: string
  puesto_provisional?: string
  departamento_provisional?: string
  firma_trabajador?: string | null
  firma_rh?: string | null
  nombre_rh_firma?: string
  fecha_registro_qr?: string
  fecha_firma_resguardo?: string
  origen_registro?: 'QR Trabajador' | 'Panel RH' | 'Censo Movil'
}

const META_MARKER = '|||META_LOCKER:'

export function parseLockerObservaciones(rawObservaciones: string | null | undefined): {
  notasLimpias: string
  meta: LockerExtendedMeta
} {
  if (!rawObservaciones) {
    return {
      notasLimpias: '',
      meta: {
        deja_llave_rh: 'Sin Definir',
        estatus_resguardo: 'Sin Resguardo'
      }
    }
  }

  const markerIndex = rawObservaciones.indexOf(META_MARKER)
  if (markerIndex === -1) {
    return {
      notasLimpias: rawObservaciones.trim(),
      meta: {
        deja_llave_rh: 'Sin Definir',
        estatus_resguardo: 'Sin Resguardo'
      }
    }
  }

  const notasLimpias = rawObservaciones.slice(0, markerIndex).trim()
  const jsonPart = rawObservaciones.slice(markerIndex + META_MARKER.length).trim()

  try {
    const parsed = JSON.parse(jsonPart) as LockerExtendedMeta
    return {
      notasLimpias,
      meta: {
        deja_llave_rh: parsed.deja_llave_rh || 'Sin Definir',
        estatus_resguardo: parsed.estatus_resguardo || 'Sin Resguardo',
        ...parsed
      }
    }
  } catch {
    return {
      notasLimpias: rawObservaciones.trim(),
      meta: {
        deja_llave_rh: 'Sin Definir',
        estatus_resguardo: 'Sin Resguardo'
      }
    }
  }
}

export function serializeLockerObservaciones(
  notasLimpias: string | null | undefined,
  meta: LockerExtendedMeta
): string | null {
  const cleanText = (notasLimpias || '').trim()
  const hasMeaningfulMeta =
    (meta.deja_llave_rh && meta.deja_llave_rh !== 'Sin Definir') ||
    (meta.estatus_resguardo && meta.estatus_resguardo !== 'Sin Resguardo') ||
    Boolean(meta.folio_resguardo) ||
    Boolean(meta.telefono_contacto) ||
    Boolean(meta.puesto_provisional) ||
    Boolean(meta.firma_trabajador) ||
    Boolean(meta.firma_rh) ||
    Boolean(meta.fecha_registro_qr) ||
    Boolean(meta.fecha_firma_resguardo)

  if (!hasMeaningfulMeta) {
    return cleanText || null
  }

  const jsonStr = JSON.stringify(meta)
  return cleanText ? `${cleanText} ${META_MARKER}${jsonStr}` : `${META_MARKER}${jsonStr}`
}

export function generarFolioResguardo(codigoCasillero: string): string {
  const randomDigits = Math.floor(1000 + Math.random() * 9000)
  return `RES-${codigoCasillero.toUpperCase()}-${randomDigits}`
}

export function buildLockerQrUrl(baseUrl: string, codigoCasillero: string, area?: string): string {
  const cleanBase = (baseUrl || 'https://rh-system-master.vercel.app').replace(/\/+$/, '')
  const params = new URLSearchParams()
  params.set('locker', codigoCasillero.trim().toUpperCase())
  if (area && area.trim()) {
    params.set('area', area.trim())
  }
  return `${cleanBase}/registro-locker?${params.toString()}`
}

export interface AreaTheme {
  name: string
  icon: string
  badgeBg: string
  badgeText: string
  badgeBorder: string
  cardBorder: string
  accentBg: string
  accentText: string
  bannerGradient: string
  headerColor: string
}

export function getAreaTheme(areaName?: string | null): AreaTheme {
  const normalized = (areaName || '').trim().toLowerCase()

  if (normalized.includes('mina')) {
    return {
      name: areaName?.trim() || 'Mina',
      icon: '⛏️',
      badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
      badgeText: 'text-amber-400',
      badgeBorder: 'border-amber-500/30',
      cardBorder: 'border-amber-500/30 hover:border-amber-400',
      accentBg: 'bg-amber-500',
      accentText: 'text-amber-950',
      bannerGradient: 'from-amber-950/80 via-zinc-900 to-amber-950/40',
      headerColor: 'text-amber-400'
    }
  }

  if (normalized.includes('beneficio') || normalized.includes('planta')) {
    return {
      name: areaName?.trim() || 'Planta de Beneficio',
      icon: '🏭',
      badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
      badgeText: 'text-emerald-400',
      badgeBorder: 'border-emerald-500/30',
      cardBorder: 'border-emerald-500/30 hover:border-emerald-400',
      accentBg: 'bg-emerald-500',
      accentText: 'text-emerald-950',
      bannerGradient: 'from-emerald-950/80 via-zinc-900 to-emerald-950/40',
      headerColor: 'text-emerald-400'
    }
  }

  // Cualquier otra área creada dinámicamente (ej. Mantenimiento, Geología, Laboratorio, etc.)
  return {
    name: areaName?.trim() || 'General',
    icon: '🏢',
    badgeBg: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
    badgeText: 'text-sky-400',
    badgeBorder: 'border-sky-500/30',
    cardBorder: 'border-sky-500/30 hover:border-sky-400',
    accentBg: 'bg-sky-500',
    accentText: 'text-sky-950',
    bannerGradient: 'from-sky-950/80 via-zinc-900 to-sky-950/40',
    headerColor: 'text-sky-400'
  }
}
