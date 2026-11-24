/**
 * Configuración Normativa de Recetas Médicas COFEPRIS / Reglamento de Insumos para la Salud
 * & Ley General de Salud (Art. 28 Bis — Emisores Autorizados).
 *
 * Formato 100% abierto (Grupo Minero Bacís no extiende recetas institucionales cerradas),
 * personalizable por el Dr. Principal (Jefe Médico) con adaptación uniforme en diseño e impresión.
 */

export type CofeprisEmisorCategoriaId = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI'

export interface CofeprisEmisorCategoria {
  id: CofeprisEmisorCategoriaId
  codigo: string
  label: string
  tituloLegal: string
}

export const COFEPRIS_EMISORES_AUTORIZADOS: CofeprisEmisorCategoria[] = [
  {
    id: 'I',
    codigo: 'I. Médicos',
    label: 'I. Médicos (Médico Cirujano / General / Especialista)',
    tituloLegal: 'Fracción I. Médico',
  },
  {
    id: 'II',
    codigo: 'II. Homeópatas',
    label: 'II. Homeópatas',
    tituloLegal: 'Fracción II. Homeópata',
  },
  {
    id: 'III',
    codigo: 'III. Cirujanos dentistas',
    label: 'III. Cirujanos dentistas (Odontólogos)',
    tituloLegal: 'Fracción III. Cirujano Dentista',
  },
  {
    id: 'IV',
    codigo: 'IV. Médicos veterinarios',
    label: 'IV. Médicos veterinarios, en el área de su competencia',
    tituloLegal: 'Fracción IV. Médico Veterinario (Área de competencia)',
  },
  {
    id: 'V',
    codigo: 'V. Pasantes en servicio social',
    label: 'V. Pasantes en servicio social, de cualquiera de las carreras anteriores',
    tituloLegal: 'Fracción V. Pasante en Servicio Social',
  },
  {
    id: 'VI',
    codigo: 'VI. Enfermeras y parteras',
    label: 'VI. Enfermeras y parteras',
    tituloLegal: 'Fracción VI. Enfermera / Partera',
  },
]

export const FORMAS_FARMACEUTICAS_COFEPRIS = [
  'Tableta',
  'Cápsula',
  'Gragea',
  'Comprimido',
  'Jarabe',
  'Suspensión Oral',
  'Solución Oral',
  'Solución Inyectable',
  'Gotas Oftálmicas',
  'Gotas Óticas',
  'Spray Nasal',
  'Crema / Pomada',
  'Gel Tópico',
  'Ungüento',
  'Supositorio',
  'Óvulo',
  'Parche Transdérmico',
  'Aerosol / Inhalador',
  'Polvo / Sobre',
]

export const VIAS_ADMINISTRACION_COFEPRIS = [
  'Oral (VO)',
  'Sublingual',
  'Intramuscular (IM)',
  'Intravenosa (IV)',
  'Subcutánea (SC)',
  'Tópica / Cutánea',
  'Oftálmica',
  'Ótica',
  'Nasal',
  'Inhalatoria',
  'Rectal',
  'Vaginal',
]

export interface CofeprisRecetaTemplateConfig {
  // Encabezado Abierto (Bacís no extiende recetas cerradas)
  modo_abierto_sin_membrete_empresa: boolean
  titulo_consultorio_abierto: string
  subtitulo_receta: string
  nota_abierta_pie: string

  // OBLIGATORIOS COFEPRIS (Médico + Tratamiento)
  ob_nombre_medico: boolean
  ob_categoria_emisor: boolean
  ob_cedula_profesional: boolean
  ob_institucion_titulo: boolean
  ob_fecha: boolean
  ob_domicilio_consultorio: boolean
  ob_telefono: boolean
  ob_firma_medico: boolean
  ob_nombre_generico: boolean
  ob_forma_farmaceutica: boolean
  ob_dosis: boolean
  ob_presentacion: boolean
  ob_frecuencia: boolean
  ob_via_administracion: boolean
  ob_duracion_tratamiento: boolean
  ob_indicaciones_uso: boolean

  // RECOMENDADOS COFEPRIS (Paciente + Signos Vitales + Diagnóstico)
  rec_nombre_paciente: boolean
  rec_edad: boolean
  rec_sexo: boolean
  rec_alergias: boolean
  rec_talla: boolean
  rec_peso: boolean
  rec_imc: boolean
  rec_temperatura: boolean
  rec_presion_arterial: boolean
  rec_diagnostico: boolean

  // Complementarios visuales
  mostrar_sello_medico: boolean
  mostrar_folio: boolean
  mostrar_especialidad: boolean
  actualizado_por?: string
  actualizado_el?: string
}

export const DEFAULT_COFEPRIS_CONFIG: CofeprisRecetaTemplateConfig = {
  modo_abierto_sin_membrete_empresa: true,
  titulo_consultorio_abierto: 'CONSULTORIO MÉDICO PARTICULAR / ATENCIÓN CLÍNICA',
  subtitulo_receta: 'RECETA MÉDICA — FORMATO ABIERTO NORMATIVA COFEPRIS',
  nota_abierta_pie:
    'Documento de prescripción clínica emitido bajo criterios de la Ley General de Salud y COFEPRIS. Surtido libre en farmacia.',

  // 16 Obligatorios
  ob_nombre_medico: true,
  ob_categoria_emisor: true,
  ob_cedula_profesional: true,
  ob_institucion_titulo: true,
  ob_fecha: true,
  ob_domicilio_consultorio: true,
  ob_telefono: true,
  ob_firma_medico: true,
  ob_nombre_generico: true,
  ob_forma_farmaceutica: true,
  ob_dosis: true,
  ob_presentacion: true,
  ob_frecuencia: true,
  ob_via_administracion: true,
  ob_duracion_tratamiento: true,
  ob_indicaciones_uso: true,

  // 10 Recomendados
  rec_nombre_paciente: true,
  rec_edad: true,
  rec_sexo: true,
  rec_alergias: true,
  rec_talla: true,
  rec_peso: true,
  rec_imc: true,
  rec_temperatura: true,
  rec_presion_arterial: true,
  rec_diagnostico: true,

  mostrar_sello_medico: true,
  mostrar_folio: true,
  mostrar_especialidad: true,
}

export type CofeprisFieldSwitchKey = keyof Pick<
  CofeprisRecetaTemplateConfig,
  | 'ob_nombre_medico'
  | 'ob_categoria_emisor'
  | 'ob_cedula_profesional'
  | 'ob_institucion_titulo'
  | 'ob_fecha'
  | 'ob_domicilio_consultorio'
  | 'ob_telefono'
  | 'ob_firma_medico'
  | 'ob_nombre_generico'
  | 'ob_forma_farmaceutica'
  | 'ob_dosis'
  | 'ob_presentacion'
  | 'ob_frecuencia'
  | 'ob_via_administracion'
  | 'ob_duracion_tratamiento'
  | 'ob_indicaciones_uso'
  | 'rec_nombre_paciente'
  | 'rec_edad'
  | 'rec_sexo'
  | 'rec_alergias'
  | 'rec_talla'
  | 'rec_peso'
  | 'rec_imc'
  | 'rec_temperatura'
  | 'rec_presion_arterial'
  | 'rec_diagnostico'
  | 'mostrar_sello_medico'
  | 'mostrar_folio'
  | 'mostrar_especialidad'
>

export const COFEPRIS_FIELD_CATALOG: {
  key: CofeprisFieldSwitchKey
  label: string
  grupo: 'OBLIGATORIOS_MEDICO' | 'OBLIGATORIOS_TRATAMIENTO' | 'RECOMENDADOS_PACIENTE' | 'VISUALES'
}[] = [
  // Obligatorios Médico
  { key: 'ob_nombre_medico', label: 'Nombre completo del médico que prescribe', grupo: 'OBLIGATORIOS_MEDICO' },
  { key: 'ob_categoria_emisor', label: 'Tipo de emisor autorizado (I–VI LGS/COFEPRIS)', grupo: 'OBLIGATORIOS_MEDICO' },
  { key: 'ob_cedula_profesional', label: 'Número de cédula profesional', grupo: 'OBLIGATORIOS_MEDICO' },
  { key: 'ob_institucion_titulo', label: 'Institución que emite el título', grupo: 'OBLIGATORIOS_MEDICO' },
  { key: 'ob_fecha', label: 'Fecha de prescripción', grupo: 'OBLIGATORIOS_MEDICO' },
  { key: 'ob_domicilio_consultorio', label: 'Domicilio completo del consultorio', grupo: 'OBLIGATORIOS_MEDICO' },
  { key: 'ob_telefono', label: 'Teléfono del consultorio', grupo: 'OBLIGATORIOS_MEDICO' },
  { key: 'ob_firma_medico', label: 'Firma autógrafa digital del médico', grupo: 'OBLIGATORIOS_MEDICO' },

  // Obligatorios Tratamiento
  { key: 'ob_nombre_generico', label: 'Nombre genérico del tratamiento', grupo: 'OBLIGATORIOS_TRATAMIENTO' },
  { key: 'ob_forma_farmaceutica', label: 'Forma farmacéutica', grupo: 'OBLIGATORIOS_TRATAMIENTO' },
  { key: 'ob_dosis', label: 'Dosis', grupo: 'OBLIGATORIOS_TRATAMIENTO' },
  { key: 'ob_presentacion', label: 'Presentación', grupo: 'OBLIGATORIOS_TRATAMIENTO' },
  { key: 'ob_frecuencia', label: 'Frecuencia', grupo: 'OBLIGATORIOS_TRATAMIENTO' },
  { key: 'ob_via_administracion', label: 'Vía de administración', grupo: 'OBLIGATORIOS_TRATAMIENTO' },
  { key: 'ob_duracion_tratamiento', label: 'Duración del tratamiento', grupo: 'OBLIGATORIOS_TRATAMIENTO' },
  { key: 'ob_indicaciones_uso', label: 'Indicaciones para el uso', grupo: 'OBLIGATORIOS_TRATAMIENTO' },

  // Recomendados Paciente y Signos Vitales
  { key: 'rec_nombre_paciente', label: 'Nombre completo del paciente', grupo: 'RECOMENDADOS_PACIENTE' },
  { key: 'rec_edad', label: 'Edad', grupo: 'RECOMENDADOS_PACIENTE' },
  { key: 'rec_sexo', label: 'Sexo', grupo: 'RECOMENDADOS_PACIENTE' },
  { key: 'rec_alergias', label: 'Alergias', grupo: 'RECOMENDADOS_PACIENTE' },
  { key: 'rec_talla', label: 'Talla', grupo: 'RECOMENDADOS_PACIENTE' },
  { key: 'rec_peso', label: 'Peso', grupo: 'RECOMENDADOS_PACIENTE' },
  { key: 'rec_imc', label: 'IMC (Índice de Masa Corporal)', grupo: 'RECOMENDADOS_PACIENTE' },
  { key: 'rec_temperatura', label: 'Temperatura', grupo: 'RECOMENDADOS_PACIENTE' },
  { key: 'rec_presion_arterial', label: 'Presión Arterial', grupo: 'RECOMENDADOS_PACIENTE' },
  { key: 'rec_diagnostico', label: 'Diagnóstico médico', grupo: 'RECOMENDADOS_PACIENTE' },

  // Visuales
  { key: 'mostrar_especialidad', label: 'Especialidad clínica / Área de competencia', grupo: 'VISUALES' },
  { key: 'mostrar_folio', label: 'Folio de receta', grupo: 'VISUALES' },
  { key: 'mostrar_sello_medico', label: 'Recuadro de sello médico / farmacia', grupo: 'VISUALES' },
]

const COFEPRIS_TEMPLATE_STORAGE_KEY = 'bacis_cofepris_receta_template_v1'
const DOCTOR_PROFILES_STORAGE_KEY = 'bacis_doctores_perfiles_v1'
const ACTIVE_DOCTOR_STORAGE_KEY = 'bacis_active_doctor_id_v1'
const CONSULTA_COFEPRIS_META_KEY = 'bacis_cofepris_recetas_meta_v1'

export function loadCofeprisRecetaConfig(): CofeprisRecetaTemplateConfig {
  if (typeof window === 'undefined') return DEFAULT_COFEPRIS_CONFIG
  try {
    const raw = localStorage.getItem(COFEPRIS_TEMPLATE_STORAGE_KEY)
    if (!raw) return DEFAULT_COFEPRIS_CONFIG
    return { ...DEFAULT_COFEPRIS_CONFIG, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_COFEPRIS_CONFIG
  }
}

export function saveCofeprisRecetaConfig(cfg: CofeprisRecetaTemplateConfig): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      COFEPRIS_TEMPLATE_STORAGE_KEY,
      JSON.stringify({
        ...cfg,
        actualizado_el: new Date().toISOString(),
      })
    )
  } catch {}
}

export function applyCofeprisPreset(
  current: CofeprisRecetaTemplateConfig,
  preset: 'COFEPRIS_COMPLETA' | 'SOLO_OBLIGATORIOS' | 'COMPACTA'
): CofeprisRecetaTemplateConfig {
  if (preset === 'COFEPRIS_COMPLETA') {
    return {
      ...current,
      ob_nombre_medico: true,
      ob_categoria_emisor: true,
      ob_cedula_profesional: true,
      ob_institucion_titulo: true,
      ob_fecha: true,
      ob_domicilio_consultorio: true,
      ob_telefono: true,
      ob_firma_medico: true,
      ob_nombre_generico: true,
      ob_forma_farmaceutica: true,
      ob_dosis: true,
      ob_presentacion: true,
      ob_frecuencia: true,
      ob_via_administracion: true,
      ob_duracion_tratamiento: true,
      ob_indicaciones_uso: true,
      rec_nombre_paciente: true,
      rec_edad: true,
      rec_sexo: true,
      rec_alergias: true,
      rec_talla: true,
      rec_peso: true,
      rec_imc: true,
      rec_temperatura: true,
      rec_presion_arterial: true,
      rec_diagnostico: true,
      mostrar_sello_medico: true,
      mostrar_folio: true,
      mostrar_especialidad: true,
    }
  }
  if (preset === 'SOLO_OBLIGATORIOS') {
    return {
      ...current,
      ob_nombre_medico: true,
      ob_categoria_emisor: true,
      ob_cedula_profesional: true,
      ob_institucion_titulo: true,
      ob_fecha: true,
      ob_domicilio_consultorio: true,
      ob_telefono: true,
      ob_firma_medico: true,
      ob_nombre_generico: true,
      ob_forma_farmaceutica: true,
      ob_dosis: true,
      ob_presentacion: true,
      ob_frecuencia: true,
      ob_via_administracion: true,
      ob_duracion_tratamiento: true,
      ob_indicaciones_uso: true,
      rec_nombre_paciente: true,
      rec_edad: false,
      rec_sexo: false,
      rec_alergias: false,
      rec_talla: false,
      rec_peso: false,
      rec_imc: false,
      rec_temperatura: false,
      rec_presion_arterial: false,
      rec_diagnostico: false,
    }
  }
  // COMPACTA
  return {
    ...current,
    ob_nombre_medico: true,
    ob_categoria_emisor: true,
    ob_cedula_profesional: true,
    ob_institucion_titulo: true,
    ob_fecha: true,
    ob_domicilio_consultorio: true,
    ob_telefono: true,
    ob_firma_medico: true,
    ob_nombre_generico: true,
    ob_forma_farmaceutica: true,
    ob_dosis: true,
    ob_presentacion: false,
    ob_frecuencia: true,
    ob_via_administracion: true,
    ob_duracion_tratamiento: true,
    ob_indicaciones_uso: true,
    rec_nombre_paciente: true,
    rec_edad: true,
    rec_sexo: false,
    rec_alergias: true,
    rec_talla: false,
    rec_peso: false,
    rec_imc: false,
    rec_temperatura: false,
    rec_presion_arterial: false,
    rec_diagnostico: true,
  }
}

export interface DoctorCofeprisProfile {
  id: string
  nombre_completo: string
  categoria_emisor: CofeprisEmisorCategoriaId
  cedula_profesional: string
  institucion_titulo: string
  especialidad: string
  domicilio_consultorio: string
  telefono_consultorio: string
  titulo_consultorio?: string
  firma_base64: string
  es_dr_principal?: boolean
}

export function loadDoctorProfiles(currentSessionProfile?: any): DoctorCofeprisProfile[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(DOCTOR_PROFILES_STORAGE_KEY)
    const list: DoctorCofeprisProfile[] = raw ? JSON.parse(raw) : []

    if (currentSessionProfile?.id) {
      const idx = list.findIndex((d) => d.id === currentSessionProfile.id)
      const isPrincipal = (currentSessionProfile.rol || '').toLowerCase().includes('jefe')
      const sessionDoc: DoctorCofeprisProfile = {
        id: currentSessionProfile.id,
        nombre_completo:
          idx >= 0 && list[idx].nombre_completo
            ? list[idx].nombre_completo
            : currentSessionProfile.nombre_completo || 'Médico Prescriptor',
        categoria_emisor: idx >= 0 ? list[idx].categoria_emisor : 'I',
        cedula_profesional:
          currentSessionProfile.cedula_profesional || (idx >= 0 ? list[idx].cedula_profesional : '') || '',
        institucion_titulo:
          currentSessionProfile.institucion_titulo || currentSessionProfile.universidad || (idx >= 0 ? list[idx].institucion_titulo : '') || '',
        especialidad:
          currentSessionProfile.especialidad || (idx >= 0 ? list[idx].especialidad : '') || 'Medicina General',
        domicilio_consultorio:
          currentSessionProfile.domicilio_consultorio ||
          (idx >= 0 ? list[idx].domicilio_consultorio : '') ||
          'Consultorio Médico Local, Durango, Méx.',
        telefono_consultorio:
          currentSessionProfile.telefono_consultorio || (idx >= 0 ? list[idx].telefono_consultorio : '') || '',
        titulo_consultorio: idx >= 0 ? list[idx].titulo_consultorio : undefined,
        firma_base64:
          currentSessionProfile.firma || (idx >= 0 && list[idx].firma_base64) || '',
        es_dr_principal: idx >= 0 ? Boolean(list[idx].es_dr_principal || isPrincipal) : isPrincipal,
      }
      if (idx >= 0) {
        list[idx] = sessionDoc
      } else {
        list.unshift(sessionDoc)
      }
    }

    if (list.length === 0) {
      list.push({
        id: 'dr-principal-default',
        nombre_completo: 'Dr. Médico Principal de Unidad',
        categoria_emisor: 'I',
        cedula_profesional: '',
        institucion_titulo: 'Universidad Juárez del Estado de Durango',
        especialidad: 'Medicina General y Ocupacional',
        domicilio_consultorio: 'Consultorio Médico de Atención Primaria, Durango, Dgo.',
        telefono_consultorio: '618-000-0000',
        firma_base64: '',
        es_dr_principal: true,
      })
    }

    return list
  } catch {
    return []
  }
}

export function saveDoctorProfile(doc: DoctorCofeprisProfile): DoctorCofeprisProfile[] {
  if (typeof window === 'undefined') return [doc]
  try {
    const raw = localStorage.getItem(DOCTOR_PROFILES_STORAGE_KEY)
    const list: DoctorCofeprisProfile[] = raw ? JSON.parse(raw) : []
    const idx = list.findIndex((d) => d.id === doc.id)
    if (idx >= 0) {
      list[idx] = doc
    } else {
      list.push(doc)
    }
    localStorage.setItem(DOCTOR_PROFILES_STORAGE_KEY, JSON.stringify(list))
    return list
  } catch {
    return [doc]
  }
}

export function deleteDoctorProfile(docId: string): DoctorCofeprisProfile[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(DOCTOR_PROFILES_STORAGE_KEY)
    const list: DoctorCofeprisProfile[] = raw ? JSON.parse(raw) : []
    const next = list.filter((d) => d.id !== docId)
    localStorage.setItem(DOCTOR_PROFILES_STORAGE_KEY, JSON.stringify(next))
    return next
  } catch {
    return []
  }
}

export function getActiveDoctorId(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(ACTIVE_DOCTOR_STORAGE_KEY) || ''
}

export function setActiveDoctorId(id: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACTIVE_DOCTOR_STORAGE_KEY, id)
}

export interface CofeprisMedicationItem {
  id_medicamento?: string
  nombre_generico: string
  nombre_comercial?: string
  forma_farmaceutica: string
  dosis: string
  presentacion: string
  frecuencia: string
  via_administracion: string
  duracion_tratamiento: string
  indicaciones_uso: string
  cantidad: number
  costo_unitario: number
}

export interface ConsultaCofeprisPayload {
  paciente_nombre_libre?: string
  edad?: string
  sexo?: string
  alergias?: string
  talla?: string
  peso?: string
  imc?: string
  temperatura?: string
  presion_arterial?: string
  diagnostico_limpio?: string
  doctor_snapshot?: DoctorCofeprisProfile | null
  medicamentos?: CofeprisMedicationItem[]
}

const META_MARKER_START = '[[COFEPRIS_META_V1:'
const META_MARKER_END = ':COFEPRIS_META_END]]'

export function encodeConsultaDiagnosticoWithCofepris(
  diagnosticoVisible: string,
  meta: ConsultaCofeprisPayload
): string {
  try {
    // Strip heavy base64 signature from DB text marker so DB row stays compact; full signature stays in doctor profile / localStorage
    const lightDoctor = meta.doctor_snapshot
      ? { ...meta.doctor_snapshot, firma_base64: meta.doctor_snapshot.firma_base64 ? '__HAS_SIG__' : '' }
      : null
    const compactMeta: ConsultaCofeprisPayload = { ...meta, doctor_snapshot: lightDoctor }
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(compactMeta))))
    return `${diagnosticoVisible}\n\n${META_MARKER_START}${b64}${META_MARKER_END}`
  } catch {
    return diagnosticoVisible
  }
}

export function decodeConsultaCofeprisMeta(
  idConsulta: string,
  diagnosticoRaw?: string | null
): { cleanDiagnostico: string; meta: ConsultaCofeprisPayload | null } {
  const raw = diagnosticoRaw || ''
  let cleanDiag = raw
    .split('[INDICACIONES RECETA]')[0]
    .split(META_MARKER_START)[0]
    .trim()

  let parsedMeta: ConsultaCofeprisPayload | null = null

  // 1. Check localStorage cache first (contains full snapshot)
  if (typeof window !== 'undefined' && idConsulta) {
    try {
      const store = JSON.parse(localStorage.getItem(CONSULTA_COFEPRIS_META_KEY) || '{}')
      if (store[idConsulta]) parsedMeta = store[idConsulta]
    } catch {}
  }

  // 2. Parse inline DB marker if present and not in localStorage
  if (!parsedMeta && raw.includes(META_MARKER_START) && raw.includes(META_MARKER_END)) {
    try {
      const start = raw.indexOf(META_MARKER_START) + META_MARKER_START.length
      const end = raw.indexOf(META_MARKER_END, start)
      const b64 = raw.slice(start, end)
      parsedMeta = JSON.parse(decodeURIComponent(escape(atob(b64))))
    } catch {}
  }

  if (parsedMeta?.diagnostico_limpio) {
    cleanDiag = parsedMeta.diagnostico_limpio
  }

  return { cleanDiagnostico: cleanDiag, meta: parsedMeta }
}

export function saveConsultaCofeprisMetaLocal(idConsulta: string, meta: ConsultaCofeprisPayload): void {
  if (typeof window === 'undefined' || !idConsulta) return
  try {
    const store = JSON.parse(localStorage.getItem(CONSULTA_COFEPRIS_META_KEY) || '{}')
    store[idConsulta] = meta
    // Keep last 150 prescriptions cleanly
    const keys = Object.keys(store)
    if (keys.length > 150) {
      delete store[keys[0]]
    }
    localStorage.setItem(CONSULTA_COFEPRIS_META_KEY, JSON.stringify(store))
  } catch {}
}

export function calcularIMC(pesoStr?: string, tallaStr?: string): string {
  const peso = parseFloat((pesoStr || '').replace(',', '.'))
  let talla = parseFloat((tallaStr || '').replace(',', '.'))
  if (!peso || !talla || peso <= 0 || talla <= 0) return ''
  // Si el usuario escribió en cm (ej. 172), convertir a metros (1.72)
  if (talla > 3) talla = talla / 100
  const imc = peso / (talla * talla)
  if (!isFinite(imc) || imc <= 0 || imc > 100) return ''
  return imc.toFixed(1)
}

export interface RenderCofeprisRecetaInput {
  cfg: CofeprisRecetaTemplateConfig
  doctor: DoctorCofeprisProfile
  folio?: string
  fechaTexto: string
  fechaCorta: string
  paciente: {
    nombre_completo: string
    categoria_etiqueta?: string
    acompanante?: string
    edad?: string
    sexo?: string
    alergias?: string
    talla?: string
    peso?: string
    imc?: string
    temperatura?: string
    presion_arterial?: string
    diagnostico?: string
  }
  medicamentos: CofeprisMedicationItem[]
  logoBase64?: string | null
  autoPrintScript?: boolean
}

function escapeHtml(text?: string | null): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Construye el HTML normativo COFEPRIS totalmente adaptable:
 * cualquier campo apagado por el Dr. Principal desaparece y el grid/tabla se reacomoda uniformemente.
 */
export function buildCofeprisRecetaHtml(input: RenderCofeprisRecetaInput): string {
  const { cfg, doctor, folio, fechaTexto, fechaCorta, paciente, medicamentos, logoBase64, autoPrintScript } = input

  const emisorCat =
    COFEPRIS_EMISORES_AUTORIZADOS.find((e) => e.id === doctor.categoria_emisor) || COFEPRIS_EMISORES_AUTORIZADOS[0]

  // 1. Metadata del Médico (Grid auto-adaptable)
  const doctorMetaCards: string[] = []
  if (cfg.ob_categoria_emisor) {
    doctorMetaCards.push(
      `<div class="meta-pill"><span>Personal Autorizado (COFEPRIS)</span><strong>${escapeHtml(emisorCat.codigo)}</strong></div>`
    )
  }
  if (cfg.ob_cedula_profesional) {
    doctorMetaCards.push(
      `<div class="meta-pill"><span>Cédula Profesional</span><strong>${escapeHtml(doctor.cedula_profesional || 'POR CAPTURAR')}</strong></div>`
    )
  }
  if (cfg.ob_institucion_titulo) {
    doctorMetaCards.push(
      `<div class="meta-pill"><span>Institución que Emite el Título</span><strong>${escapeHtml(doctor.institucion_titulo || 'POR CAPTURAR')}</strong></div>`
    )
  }
  if (cfg.ob_telefono) {
    doctorMetaCards.push(
      `<div class="meta-pill"><span>Teléfono</span><strong>${escapeHtml(doctor.telefono_consultorio || 'S/N')}</strong></div>`
    )
  }
  if (cfg.ob_domicilio_consultorio) {
    doctorMetaCards.push(
      `<div class="meta-pill meta-pill-wide"><span>Domicilio Completo del Consultorio</span><strong>${escapeHtml(doctor.domicilio_consultorio || 'POR CAPTURAR')}</strong></div>`
    )
  }

  // 2. Signos Vitales / Somatometría (Recomendados COFEPRIS) - Grid auto-fit uniforme
  const vitalCards: { label: string; value: string; alert?: boolean }[] = []
  if (cfg.rec_edad) vitalCards.push({ label: 'Edad', value: paciente.edad || '—' })
  if (cfg.rec_sexo) vitalCards.push({ label: 'Sexo', value: paciente.sexo || '—' })
  if (cfg.rec_peso) vitalCards.push({ label: 'Peso', value: paciente.peso ? `${paciente.peso} kg` : '—' })
  if (cfg.rec_talla) vitalCards.push({ label: 'Talla', value: paciente.talla ? `${paciente.talla}` : '—' })
  if (cfg.rec_imc) {
    const imcCalc = paciente.imc || calcularIMC(paciente.peso, paciente.talla)
    vitalCards.push({ label: 'IMC', value: imcCalc ? `${imcCalc} kg/m²` : '—' })
  }
  if (cfg.rec_temperatura) vitalCards.push({ label: 'Temperatura', value: paciente.temperatura ? `${paciente.temperatura} °C` : '—' })
  if (cfg.rec_presion_arterial) vitalCards.push({ label: 'Presión Arterial', value: paciente.presion_arterial ? `${paciente.presion_arterial} mmHg` : '—' })
  if (cfg.rec_alergias) {
    const alergTxt = paciente.alergias || 'Negadas / Sin registro'
    const isAlergAlert = Boolean(paciente.alergias && !paciente.alergias.toLowerCase().includes('negad') && !paciente.alergias.toLowerCase().includes('ningun'))
    vitalCards.push({ label: 'Alergias', value: alergTxt, alert: isAlergAlert })
  }

  const showPatientRow = cfg.rec_nombre_paciente || cfg.rec_diagnostico

  // 3. Columnas adaptables del Tratamiento (Obligatorios COFEPRIS)
  const medHasMainInfo =
    cfg.ob_nombre_generico || cfg.ob_forma_farmaceutica || cfg.ob_presentacion
  const medHasPosologia =
    cfg.ob_dosis || cfg.ob_frecuencia || cfg.ob_via_administracion || cfg.ob_duracion_tratamiento || cfg.ob_indicaciones_uso

  const medsHtml =
    medicamentos && medicamentos.length > 0
      ? medicamentos
          .map((m, idx) => {
            const specTags: string[] = []
            if (cfg.ob_forma_farmaceutica && m.forma_farmaceutica) {
              specTags.push(`<span><strong>Forma Farmacéutica:</strong> ${escapeHtml(m.forma_farmaceutica)}</span>`)
            }
            if (cfg.ob_presentacion && m.presentacion) {
              specTags.push(`<span><strong>Presentación:</strong> ${escapeHtml(m.presentacion)}</span>`)
            }
            if (cfg.ob_dosis && m.dosis) {
              specTags.push(`<span class="chip-hl"><strong>Dosis:</strong> ${escapeHtml(m.dosis)}</span>`)
            }
            if (cfg.ob_frecuencia && m.frecuencia) {
              specTags.push(`<span class="chip-hl"><strong>Frecuencia:</strong> ${escapeHtml(m.frecuencia)}</span>`)
            }
            if (cfg.ob_via_administracion && m.via_administracion) {
              specTags.push(`<span><strong>Vía:</strong> ${escapeHtml(m.via_administracion)}</span>`)
            }
            if (cfg.ob_duracion_tratamiento && m.duracion_tratamiento) {
              specTags.push(`<span class="chip-hl"><strong>Duración:</strong> ${escapeHtml(m.duracion_tratamiento)}</span>`)
            }

            return `
              <div class="med-card">
                <div class="med-index">${idx + 1}</div>
                <div class="med-content">
                  ${
                    medHasMainInfo
                      ? `
                    <div class="med-top">
                      ${
                        cfg.ob_nombre_generico
                          ? `<div>
                               <div class="med-generic">${escapeHtml(m.nombre_generico || 'TRATAMIENTO')}</div>
                               ${m.nombre_comercial ? `<div class="med-brand">Denominación distintiva: ${escapeHtml(m.nombre_comercial)}</div>` : ''}
                             </div>`
                          : ''
                      }
                      ${m.cantidad ? `<div class="med-qty">Cant.: ${m.cantidad}</div>` : ''}
                    </div>
                  `
                      : ''
                  }
                  ${specTags.length > 0 ? `<div class="med-specs-grid">${specTags.join('')}</div>` : ''}
                  ${
                    cfg.ob_indicaciones_uso && m.indicaciones_uso
                      ? `<div class="med-indications"><strong>Indicaciones para el uso:</strong> ${escapeHtml(m.indicaciones_uso)}</div>`
                      : ''
                  }
                </div>
              </div>
            `
          })
          .join('')
      : `<div class="med-empty">Valoración clínica y seguimiento sin prescripción farmacológica adicional en este formato.</div>`

  const openTitle =
    doctor.titulo_consultorio?.trim() || cfg.titulo_consultorio_abierto || 'CONSULTORIO MÉDICO · ATENCIÓN CLÍNICA'

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>Receta Médica COFEPRIS — ${escapeHtml(paciente.nombre_completo || 'Paciente')}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
          background: #eef2f7;
          color: #0f172a;
          padding: 20px;
          font-size: 12px;
          line-height: 1.45;
        }
        .rx-sheet {
          max-width: 840px;
          margin: 0 auto;
          background: #ffffff;
          border: 1.5px solid #cbd5e1;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 8px 30px rgba(15,23,42,0.10);
        }
        .rx-accent {
          height: 6px;
          background: linear-gradient(90deg, #0f172a 0%, #0369a1 50%, #d97706 100%);
        }
        .rx-header {
          padding: 20px 26px;
          background: #f8fafc;
          border-bottom: 2px solid #e2e8f0;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 16px;
        }
        .rx-header-left {
          flex: 1;
          min-width: 280px;
          display: flex;
          gap: 14px;
          align-items: flex-start;
        }
        .rx-logo-box {
          width: 68px;
          height: 68px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          flex-shrink: 0;
        }
        .rx-logo-box img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .rx-symbol {
          font-size: 26px;
          font-weight: 900;
          color: #0369a1;
          font-family: Georgia, serif;
        }
        .rx-clinic-title {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #0369a1;
          margin-bottom: 3px;
        }
        .rx-doc-name {
          font-size: 18px;
          font-weight: 900;
          color: #0f172a;
          text-transform: uppercase;
          line-height: 1.15;
        }
        .rx-doc-spec {
          font-size: 11px;
          font-weight: 700;
          color: #b45309;
          text-transform: uppercase;
          margin-top: 2px;
        }
        .rx-header-right {
          text-align: right;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-end;
          gap: 4px;
          min-width: 170px;
        }
        .rx-badge {
          background: #0f172a;
          color: #ffffff;
          font-size: 9px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.7px;
        }
        .rx-folio {
          font-family: 'Courier New', monospace;
          font-size: 15px;
          font-weight: 900;
          color: #0f172a;
        }
        .rx-fecha {
          font-size: 11px;
          font-weight: 700;
          color: #334155;
        }
        .doctor-meta-grid {
          padding: 12px 26px;
          background: #ffffff;
          border-bottom: 1.5px solid #e2e8f0;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(175px, 1fr));
          gap: 8px 14px;
        }
        .meta-pill {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 6px 10px;
        }
        .meta-pill-wide {
          grid-column: 1 / -1;
        }
        .meta-pill span {
          display: block;
          font-size: 8.5px;
          font-weight: 800;
          text-transform: uppercase;
          color: #64748b;
          letter-spacing: 0.4px;
        }
        .meta-pill strong {
          display: block;
          font-size: 11px;
          font-weight: 800;
          color: #0f172a;
          margin-top: 1px;
        }
        .rx-body {
          padding: 18px 26px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .patient-diag-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 12px;
        }
        .box-block {
          border: 1px solid #cbd5e1;
          border-left: 4px solid #0369a1;
          border-radius: 10px;
          padding: 10px 14px;
          background: #f8fafc;
        }
        .box-block.diag-block {
          border-left-color: #d97706;
        }
        .box-lbl {
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          color: #64748b;
          letter-spacing: 0.6px;
          margin-bottom: 3px;
        }
        .box-val-lg {
          font-size: 14px;
          font-weight: 900;
          color: #0f172a;
          text-transform: uppercase;
        }
        .box-val-md {
          font-size: 12px;
          font-weight: 700;
          color: #1e293b;
        }
        .vitals-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(105px, 1fr));
          gap: 8px;
        }
        .vital-card {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 7px 10px;
        }
        .vital-card.vital-alert {
          background: #fff1f2;
          border-color: #fda4af;
        }
        .vital-card span {
          display: block;
          font-size: 8.5px;
          font-weight: 800;
          text-transform: uppercase;
          color: #64748b;
        }
        .vital-card strong {
          display: block;
          font-size: 11.5px;
          font-weight: 900;
          color: #0f172a;
          margin-top: 1px;
        }
        .vital-card.vital-alert strong { color: #be123c; }
        .rx-section-head {
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 5px;
        }
        .rx-symbol-inline {
          font-family: Georgia, serif;
          font-size: 18px;
          font-weight: 900;
          color: #0369a1;
        }
        .rx-section-title {
          font-size: 11.5px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .med-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .med-card {
          display: flex;
          gap: 10px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 11px 13px;
          background: #ffffff;
          page-break-inside: avoid;
        }
        .med-index {
          width: 24px;
          height: 24px;
          border-radius: 7px;
          background: #0f172a;
          color: #fbbf24;
          font-weight: 900;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .med-content { flex: 1; display: flex; flex-direction: column; gap: 6px; }
        .med-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }
        .med-generic {
          font-size: 13.5px;
          font-weight: 900;
          color: #0f172a;
          text-transform: uppercase;
        }
        .med-brand {
          font-size: 10px;
          font-weight: 600;
          color: #64748b;
        }
        .med-qty {
          font-size: 10.5px;
          font-weight: 900;
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fde68a;
          padding: 2px 8px;
          border-radius: 6px;
          white-space: nowrap;
        }
        .med-specs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 5px 10px;
          font-size: 10.5px;
          color: #334155;
        }
        .med-specs-grid span {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 3px 8px;
        }
        .med-specs-grid span.chip-hl {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1e3a8a;
        }
        .med-indications {
          background: #fffbeb;
          border-left: 3px solid #f59e0b;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 11px;
          color: #78350f;
        }
        .med-empty {
          padding: 18px;
          border: 1px dashed #cbd5e1;
          border-radius: 10px;
          text-align: center;
          color: #64748b;
        }
        .rx-footer {
          padding: 16px 26px 20px;
          background: #f8fafc;
          border-top: 1.5px solid #e2e8f0;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          align-items: end;
        }
        .firma-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .firma-img-space {
          height: 62px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          margin-bottom: 4px;
        }
        .firma-img-space img {
          max-height: 58px;
          max-width: 190px;
          object-fit: contain;
        }
        .firma-rule {
          width: 210px;
          border-bottom: 2px solid #0f172a;
          margin-bottom: 4px;
        }
        .firma-doc {
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          color: #0f172a;
        }
        .firma-sub {
          font-size: 9px;
          font-weight: 700;
          color: #64748b;
        }
        .sello-box {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .sello-ring {
          width: 78px;
          height: 78px;
          border-radius: 50%;
          border: 2px dashed #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-size: 8px;
          font-weight: 800;
          color: #64748b;
          background: #ffffff;
          padding: 8px;
        }
        .legal-box {
          font-size: 9px;
          color: #475569;
          text-align: right;
        }
        @media print {
          body { background: #ffffff; padding: 0; }
          .rx-sheet { border: none; box-shadow: none; max-width: 100%; border-radius: 0; }
          @page { size: letter portrait; margin: 10mm; }
        }
      </style>
    </head>
    <body>
      <div class="rx-sheet">
        <div class="rx-accent"></div>

        <div class="rx-header">
          <div class="rx-header-left">
            <div class="rx-logo-box">
              ${
                !cfg.modo_abierto_sin_membrete_empresa && logoBase64
                  ? `<img src="${logoBase64}" alt="Logo" />`
                  : `<div class="rx-symbol">Rx</div>`
              }
            </div>
            <div>
              <div class="rx-clinic-title">${escapeHtml(openTitle)}</div>
              ${
                cfg.ob_nombre_medico
                  ? `<div class="rx-doc-name">${escapeHtml(doctor.nombre_completo || 'MÉDICO PRESCRIPTOR')}</div>`
                  : `<div class="rx-doc-name">PRESCRIPCIÓN MÉDICA</div>`
              }
              ${
                cfg.mostrar_especialidad && doctor.especialidad
                  ? `<div class="rx-doc-spec">${escapeHtml(doctor.especialidad)}</div>`
                  : ''
              }
            </div>
          </div>

          ${
            cfg.mostrar_folio || cfg.ob_fecha || cfg.subtitulo_receta
              ? `
            <div class="rx-header-right">
              <div class="rx-badge">${escapeHtml(cfg.subtitulo_receta || 'RECETA MÉDICA')}</div>
              ${cfg.mostrar_folio && folio ? `<div class="rx-folio">${escapeHtml(folio)}</div>` : ''}
              ${cfg.ob_fecha ? `<div class="rx-fecha">Fecha: ${escapeHtml(fechaCorta || fechaTexto)}</div>` : ''}
            </div>
          `
              : ''
          }
        </div>

        ${
          doctorMetaCards.length > 0
            ? `<div class="doctor-meta-grid">${doctorMetaCards.join('')}</div>`
            : ''
        }

        <div class="rx-body">
          ${
            showPatientRow
              ? `
            <div class="patient-diag-grid">
              ${
                cfg.rec_nombre_paciente
                  ? `
                <div class="box-block">
                  <div class="box-lbl">Nombre Completo del Paciente</div>
                  <div class="box-val-lg">${escapeHtml(paciente.nombre_completo || 'PACIENTE')}</div>
                  ${
                    paciente.categoria_etiqueta
                      ? `<div style="font-size:9.5px;font-weight:700;color:#475569;margin-top:3px;">${escapeHtml(paciente.categoria_etiqueta)}</div>`
                      : ''
                  }
                  ${
                    paciente.acompanante
                      ? `<div style="font-size:9.5px;font-weight:700;color:#475569;margin-top:2px;">Acompañante: ${escapeHtml(paciente.acompanante)}</div>`
                      : ''
                  }
                </div>
              `
                  : ''
              }
              ${
                cfg.rec_diagnostico
                  ? `
                <div class="box-block diag-block">
                  <div class="box-lbl">Diagnóstico Médico</div>
                  <div class="box-val-md">${escapeHtml(paciente.diagnostico || 'Valoración clínica general').replace(/\n/g, '<br/>')}</div>
                </div>
              `
                  : ''
              }
            </div>
          `
              : ''
          }

          ${
            vitalCards.length > 0
              ? `
            <div class="vitals-grid">
              ${vitalCards
                .map(
                  (v) => `
                <div class="vital-card ${v.alert ? 'vital-alert' : ''}">
                  <span>${escapeHtml(v.label)}</span>
                  <strong>${escapeHtml(v.value)}</strong>
                </div>
              `
                )
                .join('')}
            </div>
          `
              : ''
          }

          <div>
            <div class="rx-section-head">
              <span class="rx-symbol-inline">Rp/</span>
              <span class="rx-section-title">Tratamiento Prescrito e Indicaciones${medHasPosologia ? ' (COFEPRIS)' : ''}</span>
            </div>
            <div class="med-list" style="margin-top: 10px;">
              ${medsHtml}
            </div>
          </div>
        </div>

        <div class="rx-footer">
          ${
            cfg.ob_firma_medico
              ? `
            <div class="firma-box">
              <div class="firma-img-space">
                ${doctor.firma_base64 ? `<img src="${doctor.firma_base64}" alt="Firma del médico" />` : '<div style="font-size:9px;color:#94a3b8;">Espacio para firma autógrafa</div>'}
              </div>
              <div class="firma-rule"></div>
              <div class="firma-doc">${cfg.ob_nombre_medico ? escapeHtml(doctor.nombre_completo || '') : 'Médico Prescriptor'}</div>
              <div class="firma-sub">
                ${cfg.ob_categoria_emisor ? escapeHtml(emisorCat.tituloLegal) : 'Firma del Profesional'}
                ${cfg.ob_cedula_profesional && doctor.cedula_profesional ? ` · Céd. Prof. ${escapeHtml(doctor.cedula_profesional)}` : ''}
              </div>
            </div>
          `
              : ''
          }

          ${
            cfg.mostrar_sello_medico
              ? `
            <div class="sello-box">
              <div class="sello-ring">SELLO<br/>CONSULTORIO /<br/>FARMACIA</div>
            </div>
          `
              : ''
          }

          <div class="legal-box">
            <strong>Formato Abierto COFEPRIS</strong><br/>
            ${escapeHtml(cfg.nota_abierta_pie || '')}<br/>
            ${cfg.ob_fecha ? `Emitida el ${escapeHtml(fechaTexto)}` : ''}
          </div>
        </div>

        <div class="rx-accent"></div>
      </div>

      ${
        autoPrintScript
          ? `<script>
              window.onload = function () {
                setTimeout(function () {
                  window.print();
                }, 450);
              };
            </script>`
          : ''
      }
    </body>
    </html>
  `
}

