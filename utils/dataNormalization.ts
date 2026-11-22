/**
 * Motor Central de Normalización, Equivalencias de Departamentos y
 * Detección Inteligente de Duplicidades / Nombres Invertidos.
 * Grupo Minero Bacís S.A. de C.V. - El Expediente RH System
 */

export interface CanonicalDepartmentInfo {
  canonicalKey: string
  officialName: string
  shortTag: string
  aliases: string[]
}

const CANONICAL_DEPARTMENTS: CanonicalDepartmentInfo[] = [
  {
    canonicalKey: 'RECURSOS_HUMANOS',
    officialName: 'RECURSOS HUMANOS',
    shortTag: 'RH',
    aliases: [
      'RH',
      'R H',
      'R.H.',
      'R.H',
      'RECURSOS HUMANOS',
      'RECURSO HUMANO',
      'REC HUMANOS',
      'REC. HUMANOS',
      'CAPITAL HUMANO',
      'RELACIONES LABORALES',
      'RELACIONES INDUSTRIALES',
      'PERSONAL',
      'DEPTO RH',
      'DEPARTAMENTO DE RH',
      'DEPARTAMENTO DE RECURSOS HUMANOS',
      'OFICINA RH',
    ],
  },
  {
    canonicalKey: 'PLANTA_DE_BENEFICIO',
    officialName: 'PLANTA DE BENEFICIO',
    shortTag: 'PLANTA',
    aliases: [
      'PLANTA DE BENEFICIO',
      'PLANTA BENEFICIO',
      'BENEFICIO',
      'BENEFICIO GENERAL',
      'PLANTA',
      'PROCESOS PLANTA',
      'OPERACION PLANTA',
      'MOLINO',
      'MOLIENDA',
      'FLOTACION',
      'TRITURACION',
      'FILTROS',
    ],
  },
  {
    canonicalKey: 'MINA',
    officialName: 'MINA',
    shortTag: 'MINA',
    aliases: [
      'MINA',
      'MINA SUBTERRANEA',
      'OPERACION MINA',
      'INTERIOR MINA',
      'MINERIA',
      'PRODUCCION MINA',
      'DESARROLLO MINA',
      'ACARREO MINA',
    ],
  },
  {
    canonicalKey: 'MANTENIMIENTO',
    officialName: 'MANTENIMIENTO',
    shortTag: 'MTTO',
    aliases: [
      'MANTENIMIENTO',
      'MTTO',
      'MANTTO',
      'MANTENIMIENTO GENERAL',
      'MANTENIMIENTO MECANICO',
      'TALLER MECANICO',
      'MECANICA',
      'TALLER',
      'MTTO MINA',
      'MTTO PLANTA',
    ],
  },
  {
    canonicalKey: 'MANTENIMIENTO_ELECTRICO',
    officialName: 'MANTENIMIENTO ELÉCTRICO',
    shortTag: 'ELÉCTRICO',
    aliases: [
      'MANTENIMIENTO ELECTRICO',
      'MTTO ELECTRICO',
      'ELECTRICO',
      'ELECTRICISTAS',
      'TALLER ELECTRICO',
    ],
  },
  {
    canonicalKey: 'SEGURIDAD_INDUSTRIAL',
    officialName: 'SEGURIDAD INDUSTRIAL',
    shortTag: 'SEG. IND.',
    aliases: [
      'SEGURIDAD INDUSTRIAL',
      'SEGURIDAD',
      'SEG INDUSTRIAL',
      'SEG. INDUSTRIAL',
      'SEGURIDAD E HIGIENE',
      'SEGURIDAD Y MEDIO AMBIENTE',
      'HSE',
      'MEDIO AMBIENTE',
      'ECOLOGIA',
    ],
  },
  {
    canonicalKey: 'SEGURIDAD_PATRIMONIAL',
    officialName: 'SEGURIDAD PATRIMONIAL',
    shortTag: 'CASETA',
    aliases: [
      'SEGURIDAD PATRIMONIAL',
      'CASETA',
      'VIGILANCIA',
      'PROTECCION',
      'CONTROL DE ACCESO',
      'GUARDIAS',
    ],
  },
  {
    canonicalKey: 'SERVICIO_MEDICO',
    officialName: 'SERVICIO MÉDICO',
    shortTag: 'MÉDICO',
    aliases: [
      'SERVICIO MEDICO',
      'MEDICO',
      'CLINICA',
      'CLINICA MEDICA',
      'DEPARTAMENTO MEDICO',
      'CONSULTORIO',
      'ENFERMERIA',
      'SALUD',
      'SALUD OCUPACIONAL',
    ],
  },
  {
    canonicalKey: 'MOVILIDAD',
    officialName: 'MOVILIDAD',
    shortTag: 'MOVILIDAD',
    aliases: [
      'MOVILIDAD',
      'LOGISTICA',
      'TRANSPORTE',
      'CHOFERES',
      'MOVILIDAD Y LOGISTICA',
      'CONTROL DE FLOTA',
      'FLOTA',
      'TRAFICO',
    ],
  },
  {
    canonicalKey: 'CAMPAMENTO_Y_COMEDOR',
    officialName: 'CAMPAMENTO Y COMEDOR',
    shortTag: 'CAMPAMENTO',
    aliases: [
      'CAMPAMENTO Y COMEDOR',
      'CAMPAMENTOS',
      'CAMPAMENTO',
      'COMEDOR',
      'SERVICIOS GENERALES',
      'HOTELERIA',
    ],
  },
  {
    canonicalKey: 'GEOLOGIA',
    officialName: 'GEOLOGÍA',
    shortTag: 'GEOLOGÍA',
    aliases: [
      'GEOLOGIA',
      'EXPLORACION',
      'GEOLOGIA Y EXPLORACION',
      'MINA Y EXPLORACION',
      'TOPOGRAFIA',
    ],
  },
  {
    canonicalKey: 'LABORATORIO',
    officialName: 'LABORATORIO',
    shortTag: 'LAB',
    aliases: [
      'LABORATORIO',
      'LABORATORIO QUIMICO',
      'LAB QUIMICO',
      'LAB',
      'ENSAYE',
      'METALURGIA',
    ],
  },
  {
    canonicalKey: 'ALMACEN',
    officialName: 'ALMACÉN',
    shortTag: 'ALMACÉN',
    aliases: [
      'ALMACEN',
      'ALMACEN GENERAL',
      'COMPRAS',
      'SUMINISTROS',
      'ABASTECIMIENTOS',
      'BODEGA',
    ],
  },
  {
    canonicalKey: 'SISTEMAS',
    officialName: 'SISTEMAS',
    shortTag: 'SISTEMAS',
    aliases: [
      'SISTEMAS',
      'TI',
      'IT',
      'INFORMATICA',
      'TECNOLOGIAS DE LA INFORMACION',
      'SOPORTE TECNICO',
    ],
  },
  {
    canonicalKey: 'ADMINISTRACION',
    officialName: 'ADMINISTRACIÓN',
    shortTag: 'ADMIN',
    aliases: [
      'ADMINISTRACION',
      'ADMINISTRATIVO',
      'CONTABILIDAD',
      'FINANZAS',
      'CONTRALORIA',
      'DIRECCION',
      'GERENCIA',
    ],
  },
  {
    canonicalKey: 'SINDICATO',
    officialName: 'SINDICATO',
    shortTag: 'SINDICATO',
    aliases: [
      'SINDICATO',
      'SECCION 45',
      'SECC 45',
      'COMITE SINDICAL',
      'SNTMMSSRM',
    ],
  },
]

/**
 * Limpia acentos, signos de puntuación y espacios dobles, convirtiendo a MAYÚSCULAS.
 */
export function cleanAsciiUpper(str?: string | null): string {
  if (!str) return ''
  return String(str)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Resuelve cualquier variante de departamento ("RH", "recursos humanos", "RECURSOS HUMANOS")
 * a su identidad canónica oficial.
 */
export function canonicalizeDepartment(rawDept?: string | null): {
  canonicalKey: string
  officialName: string
  shortTag: string
  rawCleaned: string
} {
  const cleaned = cleanAsciiUpper(rawDept)
  if (!cleaned) {
    return {
      canonicalKey: 'SIN_ASIGNAR',
      officialName: 'SIN ASIGNAR',
      shortTag: 'S/A',
      rawCleaned: '',
    }
  }

  // 1. Coincidencia exacta con algún alias canónico
  for (const entry of CANONICAL_DEPARTMENTS) {
    if (entry.aliases.includes(cleaned) || cleanAsciiUpper(entry.officialName) === cleaned) {
      return {
        canonicalKey: entry.canonicalKey,
        officialName: entry.officialName,
        shortTag: entry.shortTag,
        rawCleaned: cleaned,
      }
    }
  }

  // 2. Coincidencia por prefijo/contenido específico seguro
  if (
    cleaned === 'RH' ||
    cleaned.startsWith('RH ') ||
    cleaned.endsWith(' RH') ||
    cleaned.includes('RECURSOS HUMANOS') ||
    cleaned.includes('CAPITAL HUMANO')
  ) {
    return {
      canonicalKey: 'RECURSOS_HUMANOS',
      officialName: 'RECURSOS HUMANOS',
      shortTag: 'RH',
      rawCleaned: cleaned,
    }
  }

  if (cleaned.includes('BENEFICIO') || cleaned === 'PLANTA') {
    return {
      canonicalKey: 'PLANTA_DE_BENEFICIO',
      officialName: 'PLANTA DE BENEFICIO',
      shortTag: 'PLANTA',
      rawCleaned: cleaned,
    }
  }

  if (cleaned.includes('SEGURIDAD INDUSTRIAL') || cleaned.includes('SEGURIDAD E HIGIENE')) {
    return {
      canonicalKey: 'SEGURIDAD_INDUSTRIAL',
      officialName: 'SEGURIDAD INDUSTRIAL',
      shortTag: 'SEG. IND.',
      rawCleaned: cleaned,
    }
  }

  if (cleaned.includes('PATRIMONIAL') || cleaned.includes('CASETA')) {
    return {
      canonicalKey: 'SEGURIDAD_PATRIMONIAL',
      officialName: 'SEGURIDAD PATRIMONIAL',
      shortTag: 'CASETA',
      rawCleaned: cleaned,
    }
  }

  // 3. Si es un departamento personalizado, generar clave canónica limpia
  return {
    canonicalKey: cleaned.replace(/\s+/g, '_'),
    officialName: (rawDept || '').trim().toUpperCase().replace(/\s+/g, ' '),
    shortTag: cleaned.slice(0, 10),
    rawCleaned: cleaned,
  }
}

/**
 * Compara si dos nombres de departamento son equivalentes
 * (por ejemplo "RH" === "recursos humanos" === "RECURSOS HUMANOS").
 */
export function areDepartmentsEquivalent(deptA?: string | null, deptB?: string | null): boolean {
  if (!deptA || !deptB) return false
  const canA = canonicalizeDepartment(deptA)
  const canB = canonicalizeDepartment(deptB)
  if (canA.canonicalKey === 'SIN_ASIGNAR' || canB.canonicalKey === 'SIN_ASIGNAR') return false
  if (canA.canonicalKey === canB.canonicalKey) return true
  if (canA.rawCleaned === canB.rawCleaned) return true
  if (
    canA.rawCleaned.length >= 4 &&
    canB.rawCleaned.length >= 4 &&
    (canA.rawCleaned.includes(canB.rawCleaned) || canB.rawCleaned.includes(canA.rawCleaned))
  ) {
    return true
  }
  return false
}

// ============================================================================
// MOTOR DE NORMALIZACIÓN Y DETECCIÓN DE PERSONAS / NOMBRES INVERTIDOS
// ============================================================================

const NAME_CONNECTORS = new Set([
  'DE',
  'DEL',
  'LA',
  'LAS',
  'LOS',
  'Y',
  'E',
  'VDA',
  'SAN',
  'SANTA',
  'EL',
  'JR',
  'SR',
  'II',
  'III',
])

/**
 * Diccionario de nombres de pila frecuentes en México para detectar cuando un registro
 * tiene los apellidos en el campo "nombre" y el nombre de pila en "apellido_paterno" o "apellido_materno"
 * (ej. nombre="Arana Chavez", apellido_paterno="Jose").
 */
const COMMON_GIVEN_NAMES = new Set([
  'JOSE', 'JUAN', 'JESUS', 'LUIS', 'CARLOS', 'MIGUEL', 'FRANCISCO', 'ANTONIO', 'PEDRO', 'MANUEL',
  'ALEJANDRO', 'RICARDO', 'FERNANDO', 'JORGE', 'ROBERTO', 'DANIEL', 'DAVID', 'EDUARDO', 'JAVIER',
  'RAUL', 'SERGIO', 'ARTURO', 'ALBERTO', 'GERARDO', 'MARIO', 'OSCAR', 'RAMON', 'ENRIQUE', 'SAMUEL',
  'ADALBERTO', 'GUADALUPE', 'ANGEL', 'VICTOR', 'HECTOR', 'MARTIN', 'RUBEN', 'MARCO', 'JAIME',
  'IGNACIO', 'ARMANDO', 'ALFREDO', 'SALVADOR', 'GABRIEL', 'GUSTAVO', 'ERNESTO', 'CESAR', 'HUMBERTO',
  'EDGAR', 'OMAR', 'IVAN', 'CRISTIAN', 'CHRISTIAN', 'JONATHAN', 'BRYAN', 'BRAYAN', 'KEVIN', 'ALAN',
  'ALEXIS', 'AXEL', 'DIEGO', 'EMILIANO', 'LEONARDO', 'MATEO', 'SANTIAGO', 'SEBASTIAN', 'MATIAS',
  'NICOLAS', 'EMMANUEL', 'ISRAEL', 'ISAAC', 'ABRAHAM', 'MOISES', 'NOE', 'SAUL', 'AARON', 'ELIAS',
  'URIEL', 'JOSUE', 'EZEQUIEL', 'BENJAMIN', 'JOEL', 'ABEL', 'ADAN', 'CAIN', 'GILBERTO', 'HERIBERTO',
  'RIGOBERTO', 'NORBERTO', 'DAGOBERTO', 'FILIBERTO', 'HUMBERTO', 'LAMBERTO', 'EDMUNDO', 'RAYMUNDO',
  'REYNALDO', 'ROLANDO', 'ORLANDO', 'ARNOLDO', 'LEOPOLDO', 'OSVALDO', 'OSWALDO', 'EVERARDO', 'ABELARDO',
  'BERNARDO', 'LEONARDO', 'MEDARDO', 'RICARDO', 'GERARDO', 'EDUARDO', 'LAZARO', 'GENARO', 'AMARO',
  'ALVARO', 'HOMERO', 'RAMIRO', 'CASIMIRO', 'VLADIMIR', 'VALENTIN', 'AGUSTIN', 'JOAQUIN', 'FERMIN',
  'EFRAIN', 'BENJAMIN', 'CRISPIN', 'SERAFIN', 'DELFIN', 'LORENZO', 'VICENTE', 'CLEMENTE', 'PRUDENCIO',
  'FIDENCIO', 'FLORENCIO', 'INOCENCIO', 'CRESCENCIO', 'VENANCIO', 'BONIFACIO', 'HORACIO', 'ANASTASIO',
  'EUSTAQUIO', 'EULALIO', 'BRAULIO', 'CORNELIO', 'AURELIO', 'ROGELIO', 'CECILIO', 'EMILIO', 'JULIO',
  'BASILIO', 'VIRGILIO', 'ATILIO', 'OVIDIO', 'ELPIDIO', ' PORFIRIO', 'GREGORIO', 'HONORIO', 'VICTORIO',
  'MARGARITO', 'HIPOLITO', 'BENITO', 'EXPEDITO', 'ERNESTO', 'MODESTO', 'FAUSTO', 'AUGUSTO', 'SIXTO',
  'CALIXTO', 'EVARISTO', 'TEODORO', 'ISIDORO', 'HELIODORO', 'ARTEMIO', 'EUSEBIO', 'TORIBIO', 'PATRICIO',
  'MAURICIO', 'FABRICIO', 'DIONISIO', 'APOLONIO', 'MACEDONIO', 'ANTONIO', 'EUGENIO', 'ARSENIO',
  // Nombres femeninos
  'MARIA', 'ANA', 'LAURA', 'PATRICIA', 'VERONICA', 'LETICIA', 'ROSA', 'CARMEN', 'ADRIANA', 'SILVIA',
  'CLAUDIA', 'SANDRA', 'MARTHA', 'MARTA', 'TERESA', 'GABRIELA', 'ALEJANDRA', 'ELIZABETH', 'YOLANDA',
  'MARGARITA', 'LUCIA', 'SOFIA', 'VALERIA', 'DANIELA', 'FERNANDA', 'PAOLA', 'KARLA', 'CARLA', 'MONICA',
  'BEATRIZ', 'IRMA', 'BLANCA', 'ESTHER', 'ALICIA', 'ELENA', 'RAQUEL', 'SUSANA', 'LORENA', 'NORMA',
  'GLORIA', 'ROCIO', 'ARACELI', 'LILIANA', 'MIRIAM', 'JUDITH', 'EDITH', 'NAYELI', 'YAZMIN', 'JASMIN',
  'ESMERALDA', 'PERLA', 'MARISOL', 'MAYRA', 'BRENDA', 'WENDY', 'KARINA', 'JESSICA', 'YESICA', 'DIANA',
  'ANDREA', 'NATALIA', 'CAMILA', 'MARIANA', 'VICTORIA', 'XIMENA', 'JIMENA', 'REGINA', 'RENATA',
  'PAULINA', 'CAROLINA', 'CATALINA', 'JOSEFINA', 'GUILLERMINA', 'ANGELICA', 'EVANGELINA', 'GRACIELA',
  'CONSUELO', 'SOCORRO', 'ROSARIO', 'DOLORES', 'MERCEDES', 'LOURDES', 'PILAR', 'CONCEPCION',
  'ASUNCION', 'ENCARNACION', 'ESPERANZA', 'AMPARO', 'REFUGIO', 'SOLEDAD', 'TRINIDAD', 'CARIDAD',
  'NATIVIDAD', 'FELICIDAD', 'VIRGINIA', 'EUGENIA', 'HORTENSIA', 'FLORENCIA', 'CLEMENCIA', 'LUCRECIA',
  'OFELIA', 'CELIA', 'AMELIA', 'NOELIA', 'AURELIA', 'DELIA', 'LIDIA', 'NADIA', 'SONIA', 'TANIA',
  'KENIA', 'Dalia', 'JULIA', 'EMILIA', 'CECILIA', 'OTILIA', 'ROSALIA', 'NATALIA', 'EULALIA',
])

/**
 * Extrae las palabras significativas de un nombre completo y las ordena alfabéticamente.
 * Así "Jose Arana Chavez" y "Arana Chavez Jose" producen exactamente ["ARANA", "CHAVEZ", "JOSE"].
 */
export function normalizeNameTokens(fullName?: string | null): string[] {
  const clean = cleanAsciiUpper(fullName)
  if (!clean) return []
  return clean
    .split(/\s+/)
    .filter((w) => w.length > 1 && !NAME_CONNECTORS.has(w))
    .sort()
}

/**
 * Genera huella fonética de una palabra en español para detectar errores ortográficos comunes
 * (ej. CHAVEZ === CHAVES, VAZQUEZ === VASQUES, GONZALEZ === GONSALES, HERNANDEZ === ERNANDES).
 */
export function phoneticSpanishToken(token: string): string {
  return cleanAsciiUpper(token)
    .replace(/^H/, '') // H muda al inicio
    .replace(/Z/g, 'S')
    .replace(/V/g, 'B')
    .replace(/CE/g, 'SE')
    .replace(/CI/g, 'SI')
    .replace(/QU/g, 'K')
    .replace(/C/g, 'K')
    .replace(/LL/g, 'Y')
    .replace(/GUE/g, 'GE')
    .replace(/GUI/g, 'GI')
    .replace(/(.)\1+/g, '$1') // Letras dobles
}

export function normalizePhoneticTokens(fullName?: string | null): string[] {
  const tokens = normalizeNameTokens(fullName)
  return tokens.map(phoneticSpanishToken).sort()
}

/**
 * Construye el nombre completo a partir de un objeto empleado.
 */
export function getEmployeeFullName(emp: any): string {
  if (!emp) return ''
  if (emp.nombre_completo && !emp.nombre) return String(emp.nombre_completo).trim()
  return `${emp.nombre || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Detecta si un solo registro de empleado tiene el nombre y los apellidos invertidos
 * o todo el nombre completo metido en una sola columna.
 * Ejemplo 1: nombre = "Arana Chavez", apellido_paterno = "Jose", apellido_materno = ""
 * Ejemplo 2: nombre = "Arana", apellido_paterno = "Chavez", apellido_materno = "Jose"
 * Ejemplo 3: nombre = "Jose Arana Chavez", apellido_paterno = "", apellido_materno = ""
 * Ejemplo 4: nombre = "Arana Chavez Jose", apellido_paterno = "", apellido_materno = ""
 */
export interface NameInversionAnalysis {
  id_empleado: string
  isMalformed: boolean
  issueType: 'INVERTIDO_EN_CAMPOS' | 'TODO_EN_UN_CAMPO' | 'ESPACIOS_O_FORMATO' | 'OK'
  reason: string
  currentNombre: string
  currentPaterno: string
  currentMaterno: string
  suggestedNombre: string
  suggestedPaterno: string
  suggestedMaterno: string
}

export function analyzeSingleEmployeeNameStructure(emp: any): NameInversionAnalysis {
  const currentNombre = String(emp?.nombre || '').replace(/\s+/g, ' ').trim()
  const currentPaterno = String(emp?.apellido_paterno || '').replace(/\s+/g, ' ').trim()
  const currentMaterno = String(emp?.apellido_materno || '').replace(/\s+/g, ' ').trim()

  const normNom = cleanAsciiUpper(currentNombre)
  const normPat = cleanAsciiUpper(currentPaterno)
  const normMat = cleanAsciiUpper(currentMaterno)

  const nomWords = normNom ? normNom.split(' ').filter(Boolean) : []
  const patWords = normPat ? normPat.split(' ').filter(Boolean) : []
  const matWords = normMat ? normMat.split(' ').filter(Boolean) : []

  // Caso A: Todo metido en `nombre` y `apellido_paterno` vacío
  if (!normPat && !normMat && nomWords.length >= 2) {
    const firstIsGiven = COMMON_GIVEN_NAMES.has(nomWords[0])
    const lastIsGiven = COMMON_GIVEN_NAMES.has(nomWords[nomWords.length - 1])

    let sugNom = ''
    let sugPat = ''
    let sugMat = ''

    if (!firstIsGiven && lastIsGiven && nomWords.length >= 3) {
      // Ej: "ARANA CHAVEZ JOSE" -> Nombre: JOSE, Paterno: ARANA, Materno: CHAVEZ
      sugPat = nomWords[0]
      sugMat = nomWords[1]
      sugNom = nomWords.slice(2).join(' ')
    } else if (!firstIsGiven && lastIsGiven && nomWords.length === 2) {
      // Ej: "ARANA JOSE" -> Nombre: JOSE, Paterno: ARANA
      sugPat = nomWords[0]
      sugNom = nomWords[1]
    } else if (nomWords.length === 3) {
      // Ej: "JOSE ARANA CHAVEZ"
      sugNom = nomWords[0]
      sugPat = nomWords[1]
      sugMat = nomWords[2]
    } else if (nomWords.length === 2) {
      sugNom = nomWords[0]
      sugPat = nomWords[1]
    } else {
      // 4 o más palabras: últimas 2 son apellidos
      sugNom = nomWords.slice(0, nomWords.length - 2).join(' ')
      sugPat = nomWords[nomWords.length - 2]
      sugMat = nomWords[nomWords.length - 1]
    }

    return {
      id_empleado: emp?.id_empleado,
      isMalformed: true,
      issueType: 'TODO_EN_UN_CAMPO',
      reason: 'El nombre completo está concentrado en el campo Nombre y faltan separar los apellidos.',
      currentNombre,
      currentPaterno,
      currentMaterno,
      suggestedNombre: sugNom,
      suggestedPaterno: sugPat,
      suggestedMaterno: sugMat,
    }
  }

  // Caso B: El campo `nombre` NO es un nombre de pila conocido, pero `apellido_paterno` o `apellido_materno` SÍ es un nombre de pila común
  const nomHasGiven = nomWords.some((w) => COMMON_GIVEN_NAMES.has(w))
  const patIsGiven = patWords.length > 0 && patWords.every((w) => COMMON_GIVEN_NAMES.has(w))
  const matIsGiven = matWords.length > 0 && matWords.every((w) => COMMON_GIVEN_NAMES.has(w))

  // Subcaso B1: nombre="Arana Chavez", apellido_paterno="Jose", apellido_materno=""
  if (!nomHasGiven && patIsGiven && !normMat && nomWords.length >= 1) {
    return {
      id_empleado: emp?.id_empleado,
      isMalformed: true,
      issueType: 'INVERTIDO_EN_CAMPOS',
      reason: `Apellidos colocados en Nombre ("${currentNombre}") y Nombre de pila en Apellido Paterno ("${currentPaterno}").`,
      currentNombre,
      currentPaterno,
      currentMaterno,
      suggestedNombre: normPat,
      suggestedPaterno: nomWords[0] || '',
      suggestedMaterno: nomWords.slice(1).join(' ') || '',
    }
  }

  // Subcaso B2: nombre="Arana", apellido_paterno="Chavez", apellido_materno="Jose"
  if (!nomHasGiven && !patIsGiven && matIsGiven && normNom && normPat) {
    return {
      id_empleado: emp?.id_empleado,
      isMalformed: true,
      issueType: 'INVERTIDO_EN_CAMPOS',
      reason: `Apellidos en Nombre/Paterno ("${currentNombre} ${currentPaterno}") y Nombre de pila en Materno ("${currentMaterno}").`,
      currentNombre,
      currentPaterno,
      currentMaterno,
      suggestedNombre: normMat,
      suggestedPaterno: normNom,
      suggestedMaterno: normPat,
    }
  }

  // Subcaso B3: nombre="Arana", apellido_paterno="Jose", apellido_materno="Chavez"
  if (!nomHasGiven && patIsGiven && !matIsGiven && normNom && normMat) {
    return {
      id_empleado: emp?.id_empleado,
      isMalformed: true,
      issueType: 'INVERTIDO_EN_CAMPOS',
      reason: `Nombre de pila ("${currentPaterno}") capturado en la columna de Apellido Paterno.`,
      currentNombre,
      currentPaterno,
      currentMaterno,
      suggestedNombre: normPat,
      suggestedPaterno: normNom,
      suggestedMaterno: normMat,
    }
  }

  return {
    id_empleado: emp?.id_empleado,
    isMalformed: false,
    issueType: 'OK',
    reason: '',
    currentNombre,
    currentPaterno,
    currentMaterno,
    suggestedNombre: normNom || currentNombre.toUpperCase(),
    suggestedPaterno: normPat || currentPaterno.toUpperCase(),
    suggestedMaterno: normMat || currentMaterno.toUpperCase(),
  }
}

/**
 * Invierte manualmente Nombre <-> Apellidos de un formulario o registro de empleado.
 * Ej: { nombre: "Arana Chavez", apellido_paterno: "Jose", apellido_materno: "" }
 *  -> { nombre: "Jose", apellido_paterno: "Arana", apellido_materno: "Chavez" }
 * Y si ya está en { nombre: "Jose", apellido_paterno: "Arana", apellido_materno: "Chavez" }
 * o { nombre: "Arana", apellido_paterno: "Chavez", apellido_materno: "Jose" }, rota inteligentemente.
 */
export function invertEmployeeNameFields(fields: {
  nombre: string
  apellido_paterno: string
  apellido_materno: string
}): {
  nombre: string
  apellido_paterno: string
  apellido_materno: string
} {
  const n = (fields.nombre || '').trim()
  const p = (fields.apellido_paterno || '').trim()
  const m = (fields.apellido_materno || '').trim()

  const nWords = n.split(/\s+/).filter(Boolean)

  // Si apellido_materno está vacío y nombre tiene 2 palabras (ej. nombre="Arana Chavez", paterno="Jose")
  if (!m && nWords.length >= 2 && p) {
    return {
      nombre: p,
      apellido_paterno: nWords[0],
      apellido_materno: nWords.slice(1).join(' '),
    }
  }

  // Si todo está en nombre (ej. nombre="Arana Chavez Jose", paterno="", materno="")
  if (!p && !m && nWords.length >= 3) {
    return {
      nombre: nWords.slice(2).join(' '),
      apellido_paterno: nWords[0],
      apellido_materno: nWords[1],
    }
  }

  // Si los 3 campos tienen valor (ej. nombre="Arana", paterno="Chavez", materno="Jose")
  if (n && p && m) {
    const mClean = cleanAsciiUpper(m)
    if (COMMON_GIVEN_NAMES.has(mClean)) {
      return {
        nombre: m,
        apellido_paterno: n,
        apellido_materno: p,
      }
    }
    return {
      nombre: p + (m ? ` ${m}` : ''),
      apellido_paterno: nWords[0] || '',
      apellido_materno: nWords.slice(1).join(' ') || '',
    }
  }

  // Caso simple de 2 campos: intercambiar nombre y apellido_paterno
  return {
    nombre: p,
    apellido_paterno: n,
    apellido_materno: m,
  }
}

/**
 * Buscador flexible multi-palabra e independiente del orden:
 * Si el usuario busca "Jose Arana" o "Arana Chavez Jose" o "105" o "RH",
 * encuentra al trabajador aunque el nombre esté invertido o tenga acentos.
 */
export function matchesFlexiblePersonSearch(emp: any, query: string): boolean {
  const qClean = cleanAsciiUpper(query)
  if (!qClean) return true

  const qTokens = qClean.split(/\s+/).filter(Boolean)
  const deptInfo = canonicalizeDepartment(emp?.departamento)

  const searchableText = cleanAsciiUpper(
    [
      emp?.nombre,
      emp?.apellido_paterno,
      emp?.apellido_materno,
      emp?.nombre_completo,
      emp?.numero_empleado,
      emp?.departamento,
      deptInfo.officialName,
      deptInfo.shortTag,
      emp?.puesto,
      emp?.curp,
      emp?.nss,
      emp?.rfc,
      emp?.correo_electronico,
      emp?.telefono,
    ]
      .filter(Boolean)
      .join(' ')
  )

  return qTokens.every((token) => searchableText.includes(token))
}
