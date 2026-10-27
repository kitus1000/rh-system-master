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
