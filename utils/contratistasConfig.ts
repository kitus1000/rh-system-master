export interface DocCatalogItem {
  code: string
  label: string
  description: string
  required: boolean
  hasExpiration: boolean
}

export const DOCS_EMPRESA_CATALOG: DocCatalogItem[] = [
  {
    code: 'OPINION_SAT',
    label: 'Opinión de Cumplimiento SAT (32-D)',
    description: 'Opinión positiva vigente emitida por el SAT (PDF)',
    required: true,
    hasExpiration: true,
  },
  {
    code: 'OPINION_IMSS',
    label: 'Opinión de Cumplimiento IMSS',
    description: 'Opinión positiva 32-D ante el IMSS vigente',
    required: true,
    hasExpiration: true,
  },
  {
    code: 'OPINION_INFONAVIT',
    label: 'Constancia INFONAVIT',
    description: 'Constancia de situación fiscal ante INFONAVIT sin adeudos',
    required: false,
    hasExpiration: true,
  },
  {
    code: 'CSF',
    label: 'Constancia de Situación Fiscal',
    description: 'CSF actualizada de la empresa contratista',
    required: true,
    hasExpiration: false,
  },
  {
    code: 'REPSE',
    label: 'Registro REPSE / STPS',
    description: 'Registro de Prestadoras de Servicios Especializados (si aplica)',
    required: false,
    hasExpiration: true,
  },
  {
    code: 'POLIZA_SEGURO',
    label: 'Póliza de Responsabilidad Civil / Contrato',
    description: 'Póliza de seguro o contrato / orden de servicio autorizada',
    required: false,
    hasExpiration: true,
  },
  {
    code: 'PERMISO_TRABAJO',
    label: 'Permiso de Trabajo / Análisis de Riesgo (AST)',
    description: 'Permiso especial de obra o análisis de seguridad en el trabajo',
    required: false,
    hasExpiration: true,
  },
]

export const DOCS_PERSONAL_CATALOG: DocCatalogItem[] = [
  {
    code: 'ALTA_IMSS',
    label: 'Alta del Seguro Social (IMSS / IDSE / SUA)',
    description: 'Comprobante oficial de alta vigente ante el IMSS',
    required: true,
    hasExpiration: false,
  },
  {
    code: 'CONSTANCIA_NSS',
    label: 'Constancia de NSS / Vigencia de Derechos',
    description: 'Documento oficial con Número de Seguridad Social (11 dígitos)',
    required: true,
    hasExpiration: true,
  },
  {
    code: 'INE',
    label: 'Identificación Oficial (INE / Pasaporte)',
    description: 'Identificación oficial vigente por ambos lados',
    required: true,
    hasExpiration: true,
  },
  {
    code: 'CERTIFICADO_MEDICO',
    label: 'Certificado Médico / Aptitud Mina',
    description: 'Certificado médico laboral vigente y/o antidoping',
    required: true,
    hasExpiration: true,
  },
  {
    code: 'DC3_INDUCCION',
    label: 'Constancia DC-3 / Inducción Seguridad',
    description: 'Constancias de habilidades laborales (alturas, eléctrico, mina)',
    required: false,
    hasExpiration: true,
  },
  {
    code: 'LICENCIA',
    label: 'Licencia de Conducir / Permiso Especial',
    description: 'Solo si operará vehículos o maquinaria dentro de unidad minera',
    required: false,
    hasExpiration: true,
  },
]

export function getDocLabel(code: string): string {
  const found = [...DOCS_EMPRESA_CATALOG, ...DOCS_PERSONAL_CATALOG].find(d => d.code === code)
  return found ? found.label : code
}

export function isSchemaMissingError(err: any): boolean {
  if (!err) return false
  const msg = (err.message || err.details || '').toLowerCase()
  return (
    err.code === '42P01' ||
    err.code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  )
}

export function formatShortDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  const clean = dateStr.split('T')[0]
  const parts = clean.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return clean
}

export function diffDaysInclusive(startStr?: string | null, endStr?: string | null): number {
  if (!startStr || !endStr) return 0
  const start = new Date(startStr.split('T')[0] + 'T00:00:00')
  const end = new Date(endStr.split('T')[0] + 'T00:00:00')
  const ms = end.getTime() - start.getTime()
  if (isNaN(ms)) return 0
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1)
}
