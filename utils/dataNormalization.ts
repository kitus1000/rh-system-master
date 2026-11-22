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

export type RegimenLaboralCode =
  | 'SEMANAL_SINDICATO'
  | 'SEMANAL_CONFIANZA'
  | 'QUINCENAL_CONFIANZA'
  | 'QUINCENAL_SINDICATO'

export interface EmployeeRegimenInfo {
  code: RegimenLaboralCode
  tipoNomina: 'SEMANAL' | 'QUINCENAL'
  esSindicalizado: boolean
  label: string
  shortLabel: string
  badgeClass: string
  sindicatoNombre: string
}

/**
 * Clasificador oficial de Régimen de Nómina y Pertenencia Sindical
 * adaptado a la estructura de Grupo Minero Bacís (Sección 45 y Personal de Confianza).
 *
 * Reconoce:
 * 1. Semanales Sindicalizados (Sección 45) -> Operativos Mina / Planta / Mtto
 * 2. Semanales de Confianza -> Supervisores de cuadrilla / Administrativos semanales
 * 3. Quincenales de Confianza -> Superintendentes / Jefaturas / Contabilidad / Médicos
 * 4. Quincenales Sindicalizados -> Casos excepcionales escalafonados
 */
export function getEmployeeRegimenClassification(emp: any): EmployeeRegimenInfo {
  const rawNomina = String(emp?.tipo_nomina || '').toUpperCase().trim()
  const rawSind = emp?.es_sindicalizado
  const rawSindStr = String(emp?.sindicato || '').toUpperCase().trim()

  const puesto = String(
    emp?.puesto || emp?.empleado_adscripciones?.[0]?.cat_puestos?.puesto || ''
  ).toUpperCase().trim()

  const deptRaw =
    emp?.departamento ||
    emp?.empleado_adscripciones?.[0]?.cat_departamentos?.departamento ||
    ''
  const deptInfo = canonicalizeDepartment(deptRaw)
  const combined = `${puesto} ${deptInfo.officialName} ${deptRaw}`.toUpperCase()

  // 1. Determinar periodicidad de nómina
  let tipoNomina: 'SEMANAL' | 'QUINCENAL' = 'SEMANAL'
  if (rawNomina.includes('QUINCENAL')) {
    tipoNomina = 'QUINCENAL'
  } else if (rawNomina.includes('SEMANAL')) {
    tipoNomina = 'SEMANAL'
  } else {
    // Inferencia por puesto si no está explícito en BD
    const isQuincenalInferred =
      combined.includes('SUPERINTENDENTE') ||
      combined.includes('GERENTE') ||
      combined.includes('SUBDIRECTOR') ||
      combined.includes('DIRECTOR') ||
      combined.includes('CONTADOR') ||
      combined.includes('MEDICO') ||
      combined.includes('MÉDICO') ||
      combined.includes('RECURSOS HUMANOS CORPORATIVO')

    tipoNomina = isQuincenalInferred ? 'QUINCENAL' : 'SEMANAL'
  }

  // 2. Determinar pertenencia sindical vs confianza
  let esSindicalizado = true
  if (
    rawSind === false ||
    rawSind === 'false' ||
    rawSindStr === 'CONFIANZA' ||
    rawSindStr === 'NO' ||
    rawSindStr === 'NO_APLICA'
  ) {
    esSindicalizado = false
  } else if (
    rawSind === true ||
    rawSind === 'true' ||
    rawSindStr.includes('SECC') ||
    rawSindStr.includes('45') ||
    rawSindStr.includes('SINDICATO')
  ) {
    esSindicalizado = true
  } else {
    // Inferencia de confianza para personal técnico, jefaturas intermedias o semanal de confianza
    if (combined.includes('CONFIANZA')) {
      esSindicalizado = false
    } else if (
      tipoNomina === 'QUINCENAL' ||
      combined.includes('SUPERINTENDENTE') ||
      combined.includes('GERENTE') ||
      combined.includes('SUPERVISOR') ||
      combined.includes('COORDINADOR') ||
      combined.includes('JEFE') ||
      combined.includes('ADMINISTRATIV') ||
      combined.includes('SISTEMAS') ||
      combined.includes('CONTADOR') ||
      combined.includes('MEDICO') ||
      combined.includes('MÉDICO')
    ) {
      esSindicalizado = false
    } else {
      esSindicalizado = true
    }
  }

  if (tipoNomina === 'QUINCENAL') {
    if (esSindicalizado) {
      return {
        code: 'QUINCENAL_SINDICATO',
        tipoNomina: 'QUINCENAL',
        esSindicalizado: true,
        label: '📆 Quincenal · Sindicato Secc. 45',
        shortLabel: 'Quincenal Sindicato',
        badgeClass: 'bg-purple-100 text-purple-950 border-purple-300',
        sindicatoNombre: 'S.N.T.M.M.S.S.R.M. Secc. 45',
      }
    }
    return {
      code: 'QUINCENAL_CONFIANZA',
      tipoNomina: 'QUINCENAL',
      esSindicalizado: false,
      label: '📆 Quincenal · Confianza',
      shortLabel: 'Quincenal Confianza',
      badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300',
      sindicatoNombre: 'Personal de Confianza',
    }
  } else {
    if (esSindicalizado) {
      return {
        code: 'SEMANAL_SINDICATO',
        tipoNomina: 'SEMANAL',
        esSindicalizado: true,
        label: '🗓️ Semanal · Sindicato Secc. 45',
        shortLabel: 'Semanal Sindicato',
        badgeClass: 'bg-amber-100 text-amber-950 border-amber-300',
        sindicatoNombre: 'S.N.T.M.M.S.S.R.M. Secc. 45',
      }
    }
    return {
      code: 'SEMANAL_CONFIANZA',
      tipoNomina: 'SEMANAL',
      esSindicalizado: false,
      label: '🗓️ Semanal · Confianza',
      shortLabel: 'Semanal Confianza',
      badgeClass: 'bg-emerald-100 text-emerald-950 border-emerald-300',
      sindicatoNombre: 'Semanal de Confianza',
    }
  }
}

// ============================================================================
// DETECCIÓN UNIFICADA DE DUPLICIDADES (EMPLEADOS Y PACIENTES / BENEFICIARIOS)
// ============================================================================

const DEDUP_ABBREVIATIONS: Record<string, string> = {
  MA: 'MARIA',
  GPE: 'GUADALUPE',
  FCO: 'FRANCISCO',
  GLEZ: 'GONZALEZ',
  GDZ: 'GONZALEZ',
  HDZ: 'HERNANDEZ',
  MTZ: 'MARTINEZ',
  RDZ: 'RODRIGUEZ',
  RGUEZ: 'RODRIGUEZ',
  SCHZ: 'SANCHEZ',
  FDZ: 'FERNANDEZ',
  LPZ: 'LOPEZ',
  PZ: 'PEREZ',
}

/**
 * Expande abreviaturas frecuentes mexicanas (MA. -> MARIA, GPE -> GUADALUPE, MTZ -> MARTINEZ)
 * y devuelve tokens ordenados para comparar posibles duplicados.
 */
export function normalizeNameTokensForDedup(fullName?: string | null): string[] {
  const clean = cleanAsciiUpper(fullName)
  if (!clean) return []
  return clean
    .split(/\s+/)
    .map((w) => DEDUP_ABBREVIATIONS[w] || w)
    .filter((w) => w.length > 1 && !NAME_CONNECTORS.has(w))
    .sort()
}

/**
 * Indica si un registro de `empleados` corresponde a un residuo soft-delete "[FUSIONADO->...]"
 */
export function isMergedGhostEmployee(emp: any): boolean {
  const nom = cleanAsciiUpper(emp?.nombre)
  return nom.startsWith('FUSIONADO') || String(emp?.nombre || '').includes('[FUSIONADO')
}

/**
 * Determina de forma consistente en todo el sistema si un registro de `pacientes`
 * representa al propio trabajador Titular o a un Beneficiario / Familiar.
 */
export function isTitularPatient(pac: any): boolean {
  const par = cleanAsciiUpper(pac?.parentesco)
  if (
    par === 'TITULAR' ||
    par === 'TITULAR TRABAJADOR' ||
    par === 'TRABAJADOR' ||
    par === 'ELLA MISMA' ||
    par === 'EL MISMO' ||
    par === 'ELLO MISMO' ||
    par === 'MISMO TRABAJADOR'
  ) {
    return true
  }
  // Si el parentesco está vacío y coincide exactamente el nombre con su empleado titular vinculado
  if (!par && pac?.empleados) {
    const pTokens = normalizeNameTokens(pac.nombre_completo).join('|')
    const eTokens = normalizeNameTokens(getEmployeeFullName(pac.empleados)).join('|')
    if (pTokens && pTokens === eTokens) return true
  }
  return false
}

class UnionFind {
  private parent: number[]
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i)
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]]
      x = this.parent[x]
    }
    return x
  }
  union(a: number, b: number) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent[rb] = ra
  }
}

export interface UnifiedEmployeeDuplicateGroup {
  key: string
  matchReason: string
  items: any[]
}

/**
 * Motor unificado por componentes conexos (Union-Find) para agrupar empleados duplicados:
 * - Excluye registros fantasma "[FUSIONADO->" (reportados por separado para purga directa)
 * - Detecta duplicados por tokens exactos/invertidos, abreviaturas + fonética, ficha repetida,
 *   CURP repetida y similitud Jaccard (>= 0.72).
 * - Garantiza que cada persona repetida aparezca en UN SOLO grupo consolidado sin traslapes.
 */
export function detectEmployeeDuplicateGroups(empList: any[]): {
  groups: UnifiedEmployeeDuplicateGroup[]
  ghosts: any[]
} {
  const ghosts: any[] = []
  const activeEmps: any[] = []

  empList.forEach((emp) => {
    if (isMergedGhostEmployee(emp)) {
      ghosts.push(emp)
    } else {
      activeEmps.push({
        ...emp,
        _computedName: getEmployeeFullName(emp),
        _tokens: normalizeNameTokensForDedup(getEmployeeFullName(emp)),
      })
    }
  })

  const n = activeEmps.length
  const uf = new UnionFind(n)
  const reasonsByPair = new Map<number, Set<string>>()

  const linkGroup = (indices: number[], reason: string) => {
    if (indices.length < 2) return
    const first = indices[0]
    for (let k = 1; k < indices.length; k++) {
      uf.union(first, indices[k])
    }
    indices.forEach((idx) => {
      if (!reasonsByPair.has(idx)) reasonsByPair.set(idx, new Set())
      reasonsByPair.get(idx)!.add(reason)
    })
  }

  const tokenIdxMap = new Map<string, number[]>()
  const phonIdxMap = new Map<string, number[]>()
  const numIdxMap = new Map<string, number[]>()
  const curpIdxMap = new Map<string, number[]>()

  activeEmps.forEach((emp, i) => {
    const tList = emp._tokens as string[]
    if (tList.length >= 2) {
      const tk = tList.join('|')
      const arr = tokenIdxMap.get(tk) || []
      arr.push(i)
      tokenIdxMap.set(tk, arr)

      const pk = tList.map(phoneticSpanishToken).sort().join('|')
      const pArr = phonIdxMap.get(pk) || []
      pArr.push(i)
      phonIdxMap.set(pk, pArr)
    }

    if (emp.numero_empleado !== null && emp.numero_empleado !== undefined && String(emp.numero_empleado).trim() !== '') {
      const nk = String(emp.numero_empleado).trim()
      const arr = numIdxMap.get(nk) || []
      arr.push(i)
      numIdxMap.set(nk, arr)
    }

    if (emp.curp && String(emp.curp).trim().length >= 10) {
      const ck = cleanAsciiUpper(emp.curp)
      const arr = curpIdxMap.get(ck) || []
      arr.push(i)
      curpIdxMap.set(ck, arr)
    }
  })

  tokenIdxMap.forEach((indices) => {
    if (indices.length > 1) {
      const rawSet = new Set(indices.map((i) => cleanAsciiUpper(activeEmps[i]._computedName)))
      const reason =
        rawSet.size > 1
          ? '🔄 NOMBRE INVERTIDO O PERMUTADO (Mismas palabras en distinto orden)'
          : '👥 NOMBRE EXACTAMENTE DUPLICADO'
      linkGroup(indices, reason)
    }
  })

  phonIdxMap.forEach((indices) => {
    if (indices.length > 1) {
      linkGroup(indices, '≈ COINCIDENCIA FONÉTICA / ABREVIATURA (Ej. S/Z, B/V, H, MA./MARIA)')
    }
  })

  numIdxMap.forEach((indices, nk) => {
    if (indices.length > 1) {
      linkGroup(indices, `🔢 MISMO NÚMERO DE EMPLEADO / FICHA (#${nk})`)
    }
  })

  curpIdxMap.forEach((indices, ck) => {
    if (indices.length > 1) {
      linkGroup(indices, `🧬 MISMA CURP (${ck})`)
    }
  })

  // Jaccard >= 0.72 entre tokens únicos
  const tokenEntries = Array.from(tokenIdxMap.entries())
  for (let a = 0; a < tokenEntries.length; a++) {
    const [k1, idx1] = tokenEntries[a]
    const t1 = k1.split('|')
    for (let b = a + 1; b < tokenEntries.length; b++) {
      const [k2, idx2] = tokenEntries[b]
      const t2 = k2.split('|')
      const set2 = new Set(t2)
      const intersection = t1.filter((t) => set2.has(t))
      const unionSize = new Set([...t1, ...t2]).size
      if (intersection.length >= 2 && intersection.length / unionSize >= 0.72) {
        linkGroup([...idx1, ...idx2], `🔍 ALTA SIMILITUD DE NOMBRE (${intersection.join(' ')})`)
      }
    }
  }

  const componentMap = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const root = uf.find(i)
    const arr = componentMap.get(root) || []
    arr.push(i)
    componentMap.set(root, arr)
  }

  const groups: UnifiedEmployeeDuplicateGroup[] = []
  componentMap.forEach((indices) => {
    if (indices.length < 2) return
    const items = indices.map((i) => activeEmps[i])
    const reasonSet = new Set<string>()
    indices.forEach((i) => {
      reasonsByPair.get(i)?.forEach((r) => reasonSet.add(r))
    })
    const signature = items
      .map((it) => String(it.id_empleado))
      .sort()
      .join('_')
    groups.push({
      key: `EMP_GRP_${signature}`,
      matchReason: Array.from(reasonSet).slice(0, 2).join(' + ') || '👥 POSIBLE DUPLICADO',
      items,
    })
  })

  return { groups, ghosts }
}

export interface UnifiedPatientDuplicateGroup {
  key: string
  normalizedName: string
  matchReason: string
  groupType: 'BENEFICIARIOS' | 'TITULARES_CLINICA'
  items: any[]
  recommendedMasterId: string
}

/**
 * Motor único y compartido para detectar duplicidades en la tabla `pacientes`
 * (tanto en Módulo Médico -> Beneficiarios como en RH -> Depurar Duplicados).
 * - Nunca mezcla un Trabajador Titular con un Hijo/Esposa homónimo.
 * - Detecta duplicados exactos, nombres invertidos, errores fonéticos (S/Z, B/V, H),
 *   abreviaturas (MA. / GPE.), y nombres parciales bajo el mismo Trabajador Titular.
 * - También detecta si un trabajador tiene doble fila de Titular en `pacientes`.
 */
export function detectPatientDuplicateGroups(
  pacientesList: any[],
  consultasCountMap: Record<string, number> = {},
  pasesCountMap: Record<string, number> = {},
  options?: { includeTitularDuplicates?: boolean }
): UnifiedPatientDuplicateGroup[] {
  const includeTitularDuplicates = options?.includeTitularDuplicates ?? true

  const titularRows: any[] = []
  const beneficiaryRows: any[] = []

  pacientesList.forEach((p) => {
    const enriched = {
      ...p,
      _computedName: (p.nombre_completo || '').trim(),
      _tokens: normalizeNameTokensForDedup(p.nombre_completo),
    }
    if (isTitularPatient(p)) {
      titularRows.push(enriched)
    } else {
      beneficiaryRows.push(enriched)
    }
  })

  const buildGroupsForBucket = (
    rows: any[],
    groupType: 'BENEFICIARIOS' | 'TITULARES_CLINICA',
    checkSameWorkerSubset: boolean
  ): UnifiedPatientDuplicateGroup[] => {
    const m = rows.length
    if (m < 2) return []

    const uf = new UnionFind(m)
    const reasonsMap = new Map<number, Set<string>>()

    const link = (indices: number[], reason: string) => {
      if (indices.length < 2) return
      const first = indices[0]
      for (let k = 1; k < indices.length; k++) {
        uf.union(first, indices[k])
      }
      indices.forEach((idx) => {
        if (!reasonsMap.has(idx)) reasonsMap.set(idx, new Set())
        reasonsMap.get(idx)!.add(reason)
      })
    }

    const tokenMap = new Map<string, number[]>()
    const phonMap = new Map<string, number[]>()
    const workerGroups = new Map<string, number[]>()

    rows.forEach((r, idx) => {
      const tList = r._tokens as string[]
      if (tList.length >= 2) {
        const tk = tList.join('|')
        const arr = tokenMap.get(tk) || []
        arr.push(idx)
        tokenMap.set(tk, arr)

        const pk = tList.map(phoneticSpanishToken).sort().join('|')
        const pArr = phonMap.get(pk) || []
        pArr.push(idx)
        phonMap.set(pk, pArr)
      }

      if (r.id_empleado) {
        const ek = String(r.id_empleado)
        const wArr = workerGroups.get(ek) || []
        wArr.push(idx)
        workerGroups.set(ek, wArr)
      }
    })

    tokenMap.forEach((indices) => {
      if (indices.length > 1) {
        link(
          indices,
          groupType === 'TITULARES_CLINICA'
            ? '🔄 DOBLE REGISTRO DE TITULAR EN CLÍNICA'
            : '🔄 NOMBRE DUPLICADO O INVERTIDO EN BENEFICIARIOS'
        )
      }
    })

    phonMap.forEach((indices) => {
      if (indices.length > 1) {
        link(indices, '≈ COINCIDENCIA FONÉTICA / ABREVIATURA (Ej. MA./MARIA, CHAVEZ/CHAVES)')
      }
    })

    if (groupType === 'TITULARES_CLINICA') {
      // Mismo id_empleado no debe tener 2 filas TITULAR en pacientes
      workerGroups.forEach((indices) => {
        if (indices.length > 1) {
          link(indices, '🆔 MISMO TRABAJADOR TITULAR REGISTRADO DOS VECES EN PACIENTES')
        }
      })
    } else if (checkSameWorkerSubset) {
      // Bajo el mismo trabajador titular: detectar nombres parciales/abreviados ("MARIA ARANA" vs "MARIA GUADALUPE ARANA CHAVEZ")
      workerGroups.forEach((indices) => {
        if (indices.length < 2) return
        for (let a = 0; a < indices.length; a++) {
          const idxA = indices[a]
          const tokA = (rows[idxA]._tokens as string[]) || []
          if (tokA.length < 2) continue
          const setA = new Set(tokA)
          for (let b = a + 1; b < indices.length; b++) {
            const idxB = indices[b]
            const tokB = (rows[idxB]._tokens as string[]) || []
            if (tokB.length < 2) continue
            const setB = new Set(tokB)
            const intersection = tokA.filter((t) => setB.has(t))
            const minLen = Math.min(setA.size, setB.size)
            const unionLen = new Set([...tokA, ...tokB]).size
            const isSubset = intersection.length === minLen && minLen >= 2
            const highJaccard = intersection.length >= 2 && intersection.length / unionLen >= 0.65
            if (isSubset || highJaccard) {
              link(
                [idxA, idxB],
                `👨‍👩‍👧‍👦 MISMO TITULAR CON NOMBRE SIMILAR (${intersection.join(' ')})`
              )
            }
          }
        }
      })
    }

    const compMap = new Map<number, number[]>()
    for (let i = 0; i < m; i++) {
      const root = uf.find(i)
      const arr = compMap.get(root) || []
      arr.push(i)
      compMap.set(root, arr)
    }

    const result: UnifiedPatientDuplicateGroup[] = []
    compMap.forEach((indices) => {
      if (indices.length < 2) return
      const items = indices.map((i) => rows[i])

      // Seleccionar el mejor Maestro (mayor cantidad de consultas/pases, con id_empleado, datos completos)
      let bestItem = items[0]
      let bestScore = -1
      items.forEach((it) => {
        const cCount = consultasCountMap[it.id_paciente] || 0
        const pCount = pasesCountMap[it.id_paciente] || 0
        let score = cCount * 10 + pCount * 5
        if (it.id_empleado) score += 20
        if (it.parentesco && it.parentesco !== 'Población General') score += 5
        if (it.fecha_nacimiento) score += 4
        if (it.acompanante) score += 2
        if (score > bestScore) {
          bestScore = score
          bestItem = it
        }
      })

      const reasonSet = new Set<string>()
      indices.forEach((i) => {
        reasonsMap.get(i)?.forEach((r) => reasonSet.add(r))
      })

      const signature = items
        .map((i) => String(i.id_paciente))
        .sort()
        .join('_')

      result.push({
        key: `${groupType}_${signature}`,
        normalizedName: bestItem.nombre_completo || items[0].nombre_completo || 'SIN NOMBRE',
        matchReason: Array.from(reasonSet)[0] || '🔄 REGISTRO DUPLICADO',
        groupType,
        items,
        recommendedMasterId: bestItem.id_paciente,
      })
    })

    return result
  }

  const beneficiaryGroups = buildGroupsForBucket(beneficiaryRows, 'BENEFICIARIOS', true)
  const titularGroups = includeTitularDuplicates
    ? buildGroupsForBucket(titularRows, 'TITULARES_CLINICA', false)
    : []

  return [...beneficiaryGroups, ...titularGroups]
}


