/**
 * Catálogo Oficial de Niveles de Autorización para Modo Prueba y Auditoría Multi-Vista.
 * Grupo Minero Bacís S.A. de C.V. - Unidad El Herrero
 */

export type TestLevelBadgeColor =
  | 'amber'
  | 'indigo'
  | 'emerald'
  | 'blue'
  | 'cyan'
  | 'orange'
  | 'teal'
  | 'rose'
  | 'purple'

export interface TestAuthLevel {
  id: string
  order: number
  shortLabel: string
  title: string
  rol: string
  nombre_completo: string
  email: string
  departamento: string
  badgeColor: TestLevelBadgeColor
  canAuthorizeAll: boolean
  scopeDescription: string
  authorizesTags: string[]
  quickPath: string
}

export const TEST_AUTH_LEVELS: TestAuthLevel[] = [
  {
    id: 'REAL_SESSION',
    order: 0,
    shortLabel: '👑 Sesión Real / Super Admin',
    title: 'Vista Global (Sin Simulación — Sesión Autenticada)',
    rol: 'Administrativo',
    nombre_completo: 'Administrador General / RH',
    email: '',
    departamento: 'TODOS',
    badgeColor: 'amber',
    canAuthorizeAll: true,
    scopeDescription:
      'Operación con tu usuario real autenticado. Permite supervisar todos los niveles, contratar, configurar reglas y auditar todas las bandejas.',
    authorizesTags: ['Vista Completa', 'Configuración Global', 'Supervisión Multi-Nivel'],
    quickPath: '/autorizaciones',
  },
  {
    id: 'NIVEL_1_RH_UNIDAD',
    order: 1,
    shortLabel: '🏢 Nivel 1: Jefe RH Unidad',
    title: 'Jefe de Recursos Humanos Unidad El Herrero',
    rol: 'Jefe de RH Unidad',
    nombre_completo: 'Lic. Jefe de RH Unidad El Herrero (Modo Prueba)',
    email: 'jefe.rh.unidad@bacis.com',
    departamento: 'RECURSOS HUMANOS',
    badgeColor: 'amber',
    canAuthorizeAll: false,
    scopeDescription:
      'Autoriza Etapa 1 de Escalafón/Vacantes, Valida Documentación IMSS/SUA/SAT de Contratistas, Emite Credenciales QR, Aprueba Vacaciones/Permisos en 2da instancia RH y Aprueba Pases Médicos.',
    authorizesTags: ['Escalafón Paso 1', 'Contratistas RH/Docs', 'Vacaciones 2ª Firma', 'Aprobar Cuentas'],
    quickPath: '/autorizaciones',
  },
  {
    id: 'NIVEL_2_RH_CORPORATIVO',
    order: 2,
    shortLabel: '🏛️ Nivel 2: Supt. RH Corporativo',
    title: 'Superintendente de RH Corporativo Bacís',
    rol: 'Superintendente de RH Corporativo',
    nombre_completo: 'Ing. Supt. RH Corporativo (Modo Prueba)',
    email: 'supt.rh.corporativo@bacis.com',
    departamento: 'RECURSOS HUMANOS',
    badgeColor: 'indigo',
    canAuthorizeAll: false,
    scopeDescription:
      'Autoriza Etapa 2 Corporativa de Escalafón y Movimientos Sindicales, otorga Vo.Bo. Corporativo a solicitudes estratégicas y libera vacantes en el tablero.',
    authorizesTags: ['Escalafón Paso 2 Corp.', 'Vo.Bo. Corporativo', 'Autorizar Bajas / Cambios'],
    quickPath: '/autorizaciones',
  },
  {
    id: 'NIVEL_3A_JEFE_MINA',
    order: 3,
    shortLabel: '⛏️ Nivel 3A: Jefe de Mina',
    title: 'Superintendente / Jefe de Departamento Mina',
    rol: 'Jefe de Departamento',
    nombre_completo: 'Ing. Superintendente de Mina (Modo Prueba)',
    email: 'jefe.mina@bacis.com',
    departamento: 'MINA',
    badgeColor: 'emerald',
    canAuthorizeAll: false,
    scopeDescription:
      'Selecciona postulantes y fija plan/fecha en vacantes de Mina, autoriza salida SÍ/NO de personal de Mina, aprueba Contratistas y Prórrogas de Mina y firma Vacaciones de su plantilla.',
    authorizesTags: ['Plan Destino Mina', 'Liberación SÍ/NO Mina', 'Contratistas Mina', 'Vacaciones 1ª Firma'],
    quickPath: '/autorizaciones',
  },
  {
    id: 'NIVEL_3B_JEFE_PLANTA',
    order: 4,
    shortLabel: '⚙️ Nivel 3B: Jefe Planta Beneficio',
    title: 'Encargado / Jefe de Planta de Beneficio',
    rol: 'Jefe de Departamento',
    nombre_completo: 'Ing. Jefe de Planta de Beneficio (Modo Prueba)',
    email: 'jefe.planta.de@bacis.com',
    departamento: 'PLANTA DE BENEFICIO',
    badgeColor: 'blue',
    canAuthorizeAll: false,
    scopeDescription:
      'Responde SÍ o NO/Reprogramar cuando Mina solicita trabajadores de Planta en Escalafón, autoriza Contratistas de Planta y firma Vacaciones/Permisos de su personal.',
    authorizesTags: ['Liberación SÍ/NO Planta', 'Plan Destino Planta', 'Contratistas Planta', 'Vacaciones 1ª Firma'],
    quickPath: '/autorizaciones',
  },
  {
    id: 'NIVEL_3C_JEFE_MTTO',
    order: 5,
    shortLabel: '🔧 Nivel 3C: Jefe Mantenimiento',
    title: 'Jefe de Mantenimiento Mecánico y Eléctrico',
    rol: 'Jefe de Departamento',
    nombre_completo: 'Ing. Jefe de Mantenimiento (Modo Prueba)',
    email: 'jefe.mantenimiento@bacis.com',
    departamento: 'MANTENIMIENTO',
    badgeColor: 'cyan',
    canAuthorizeAll: false,
    scopeDescription:
      'Autoriza movimientos de Escalafón desde/hacia Mantenimiento, aprueba solicitudes y prórrogas de Contratistas de talleres/equipo pesado y firma Vacaciones de Mantenimiento.',
    authorizesTags: ['Escalafón Mtto', 'Contratistas Mtto', 'Prórrogas Mtto', 'Vacaciones 1ª Firma'],
    quickPath: '/autorizaciones',
  },
  {
    id: 'NIVEL_4_SEGURIDAD',
    order: 6,
    shortLabel: '🛡️ Nivel 4: Seguridad Industrial',
    title: 'Coordinador de Seguridad Industrial y Medio Ambiente (HSE)',
    rol: 'Seguridad Industrial',
    nombre_completo: 'Ing. Seguridad Industrial HSE (Modo Prueba)',
    email: 'seguridad@bacis.com',
    departamento: 'SEGURIDAD INDUSTRIAL',
    badgeColor: 'orange',
    canAuthorizeAll: false,
    scopeDescription:
      'Autoriza el Factor Seguridad Industrial (Inducción + DC-3 + EPP) en Contratistas Multi-Factor y aprueba inducciones de Seguridad para nuevos ingresos.',
    authorizesTags: ['Contratistas Factor Seguridad', 'Inducción HSE', 'Liberación DC-3'],
    quickPath: '/autorizaciones',
  },
  {
    id: 'NIVEL_5_CAMPAMENTO',
    order: 7,
    shortLabel: '🏕️ Nivel 5: Campamentos y Comedor',
    title: 'Encargado de Campamentos y Comedor',
    rol: 'Encargado de Campamento y Comedor',
    nombre_completo: 'Coord. Campamentos y Comedor (Modo Prueba)',
    email: 'campamentos@bacis.com',
    departamento: 'CAMPAMENTO Y COMEDOR',
    badgeColor: 'teal',
    canAuthorizeAll: false,
    scopeDescription:
      'Autoriza disponibilidad de hospedaje, confirma cupo y asigna camas en el Factor Campamentos de Contratistas y gestiona habitaciones 3D sin duplicados.',
    authorizesTags: ['Contratistas Factor Campamento', 'Confirmar Cupo / Camas', 'Gestión 3D'],
    quickPath: '/autorizaciones',
  },
  {
    id: 'NIVEL_6_MEDICO',
    order: 8,
    shortLabel: '🏥 Nivel 6: Jefe Médico / Clínica',
    title: 'Jefe Médico / Clínica Unidad Bacís',
    rol: 'Jefe Médico',
    nombre_completo: 'Dr. Jefe Médico Unidad (Modo Prueba)',
    email: 'medico@bacis.com',
    departamento: 'SERVICIO MÉDICO',
    badgeColor: 'rose',
    canAuthorizeAll: false,
    scopeDescription:
      'Autoriza Pases Médicos de traslado, Pases de Hotel en Durango/Externos, Aptitud Médica para vacantes y seguimiento de acompañantes.',
    authorizesTags: ['Pases Médicos', 'Pase de Hotel', 'Incapacidades / Aptitud'],
    quickPath: '/autorizaciones',
  },
  {
    id: 'NIVEL_7_SINDICATO',
    order: 9,
    shortLabel: '🤝 Nivel 7: Sindicato Secc. 45',
    title: 'Comité Ejecutivo Local S.N.T.M.M.S.S.R.M. Secc. 45',
    rol: 'Sindicato',
    nombre_completo: 'Delegado Sindical Secc. 45 (Modo Prueba)',
    email: 'sindicato@bacis.com',
    departamento: 'SINDICATO',
    badgeColor: 'purple',
    canAuthorizeAll: false,
    scopeDescription:
      'Inscribe trabajadores sindicalizados en convocatorias de 10 días (Art. 116 C.C.T.), revisa escalafón de antigüedad y da seguimiento al tablero de vacantes.',
    authorizesTags: ['Inscribir Postulantes', 'Escalafón Art. 116 C.C.T.', 'Auditoría Sindical'],
    quickPath: '/movimientos-sindicato',
  },
]

export function getTestAuthLevel(levelId?: string | null): TestAuthLevel {
  if (!levelId) return TEST_AUTH_LEVELS[0]
  return TEST_AUTH_LEVELS.find((l) => l.id === levelId) || TEST_AUTH_LEVELS[0]
}
