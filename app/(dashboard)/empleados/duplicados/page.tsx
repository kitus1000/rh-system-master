'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/utils/supabase/client'
import Link from 'next/link'
import {
  Users,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ArrowLeftRight,
  Link as LinkIcon,
  ShieldCheck,
  Heart,
  Sparkles,
  Building2,
  Wand2,
  Check,
  Layers,
  HardHat,
  Edit3,
  ArrowRight,
  Info,
} from 'lucide-react'
import {
  canonicalizeDepartment,
  cleanAsciiUpper,
  normalizeNameTokens,
  normalizePhoneticTokens,
  analyzeSingleEmployeeNameStructure,
  invertEmployeeNameFields,
  getEmployeeFullName,
} from '@/utils/dataNormalization'

interface DuplicatePersonGroup {
  key: string
  matchReason: string
  items: any[]
}

interface DepartmentCluster {
  canonicalKey: string
  officialName: string
  shortTag: string
  rawVariants: {
    rawName: string
    source: string
    count: number
    catId?: string
  }[]
  catRows: any[]
  employeeIds: string[]
  adscripcionIds: string[]
  perfilIds: string[]
  lockerModuloIds: string[]
  hasConflict: boolean
}

export default function CentroDepuracionDuplicadosPage() {
  const [activeTab, setActiveTab] = useState<'departamentos' | 'empleados' | 'invertidos' | 'pacientes'>('departamentos')

  // Datos crudos de Supabase
  const [empleados, setEmpleados] = useState<any[]>([])
  const [catDepartamentos, setCatDepartamentos] = useState<any[]>([])
  const [adscripciones, setAdscripciones] = useState<any[]>([])
  const [perfiles, setPerfiles] = useState<any[]>([])
  const [lockersModulos, setLockersModulos] = useState<any[]>([])
  const [pacientes, setPacientes] = useState<any[]>([])

  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Estado Pestaña Departamentos
  const [customOfficialDeptNames, setCustomOfficialDeptNames] = useState<Record<string, string>>({})
  const [showAllDepts, setShowAllDepts] = useState(false)
  const [manualDeptSource, setManualDeptSource] = useState('')
  const [manualDeptTarget, setManualDeptTarget] = useState('')

  // Estado Pestaña Empleados Duplicados
  const [personDuplicates, setPersonDuplicates] = useState<DuplicatePersonGroup[]>([])
  const [selectedMasterId, setSelectedMasterId] = useState<Record<string, string>>({})
  const [masterEdits, setMasterEdits] = useState<
    Record<
      string,
      {
        nombre: string
        apellido_paterno: string
        apellido_materno: string
        numero_empleado: string
        departamento: string
        puesto: string
      }
    >
  >({})

  // Simulador / Comparador Manual de 2 Empleados
  const [manualEmpA, setManualEmpA] = useState('')
  const [manualEmpB, setManualEmpB] = useState('')

  // Estado Pestaña Nombres Invertidos Individuales
  const [searchSingleEmp, setSearchSingleEmp] = useState('')
  const [onlyShowMalformed, setOnlyShowMalformed] = useState(true)
  const [singleRowEdits, setSingleRowEdits] = useState<
    Record<string, { nombre: string; apellido_paterno: string; apellido_materno: string; departamento: string }>
  >({})

  // Estado Pestaña Pacientes Duplicados
  const [patientDuplicates, setPatientDuplicates] = useState<DuplicatePersonGroup[]>([])
  const [selectedPatientMaster, setSelectedPatientMaster] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchAllSystemData()
  }, [])

  const fetchAllSystemData = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const [empRes, catDepRes, adsRes, perfRes, lockRes, pacRes] = await Promise.all([
        supabase.from('empleados').select('*').order('apellido_paterno', { ascending: true }),
        supabase.from('cat_departamentos').select('*').order('departamento', { ascending: true }),
        supabase.from('empleado_adscripciones').select('*, cat_departamentos(id_departamento, departamento)'),
        supabase.from('perfiles').select('id, nombre_completo, rol, id_departamento'),
        supabase.from('lockers_modulos').select('id_modulo, codigo_modulo, area, bateria'),
        supabase.from('pacientes').select('*, empleados(nombre, apellido_paterno, apellido_materno)').order('nombre_completo'),
      ])

      const empData = empRes.data || []
      const catData = catDepRes.data || []
      const adsData = adsRes.data || []
      const perfData = perfRes.data || []
      const lockData = lockRes.data || []
      const pacData = pacRes.data || []

      setEmpleados(empData)
      setCatDepartamentos(catData)
      setAdscripciones(adsData)
      setPerfiles(perfData)
      setLockersModulos(lockData)
      setPacientes(pacData)

      runEmployeeDuplicateDetection(empData)
      runPatientDuplicateDetection(pacData)
    } catch (err: any) {
      console.error('Error cargando datos para depuración:', err)
      setErrorMsg('Error al cargar datos: ' + (err.message || 'Verifica tu conexión'))
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // 1. ANÁLISIS DE DUPLICIDAD DE DEPARTAMENTOS (RH / recursos humanos / RECURSOS HUMANOS)
  // ============================================================================
  const departmentClusters = useMemo<DepartmentCluster[]>(() => {
    const clusterMap: Record<string, DepartmentCluster> = {}

    const ensureCluster = (rawName: string) => {
      const info = canonicalizeDepartment(rawName)
      if (!clusterMap[info.canonicalKey]) {
        clusterMap[info.canonicalKey] = {
          canonicalKey: info.canonicalKey,
          officialName: info.officialName,
          shortTag: info.shortTag,
          rawVariants: [],
          catRows: [],
          employeeIds: [],
          adscripcionIds: [],
          perfilIds: [],
          lockerModuloIds: [],
          hasConflict: false,
        }
      }
      return clusterMap[info.canonicalKey]
    }

    const addVariant = (cluster: DepartmentCluster, rawName: string, source: string, count = 1, catId?: string) => {
      const trimmed = (rawName || '').trim()
      if (!trimmed) return
      const existing = cluster.rawVariants.find((v) => v.rawName === trimmed && v.source === source)
      if (existing) {
        existing.count += count
      } else {
        cluster.rawVariants.push({ rawName: trimmed, source, count, catId })
      }
    }

    // A. Catálogo cat_departamentos (activos)
    const activeCatDepts = catDepartamentos.filter((d) => d.activo !== false)
    activeCatDepts.forEach((cat) => {
      if (!cat.departamento) return
      const cl = ensureCluster(cat.departamento)
      cl.catRows.push(cat)
      addVariant(cl, cat.departamento, 'Catálogo Oficial', 1, cat.id_departamento)
    })

    // Mapa rápido id_departamento -> nombre en catálogo
    const catIdToName: Record<string, string> = {}
    catDepartamentos.forEach((c) => {
      catIdToName[String(c.id_departamento)] = c.departamento || ''
    })

    // B. Empleados (campo texto `departamento`)
    empleados.forEach((emp) => {
      if (!emp.departamento) return
      const cl = ensureCluster(emp.departamento)
      cl.employeeIds.push(emp.id_empleado)
      addVariant(cl, emp.departamento, 'Padrón Empleados', 1)
    })

    // C. Adscripciones (`id_departamento`)
    adscripciones.forEach((ads) => {
      const depName = ads.cat_departamentos?.departamento || catIdToName[String(ads.id_departamento)]
      if (!depName) return
      const cl = ensureCluster(depName)
      cl.adscripcionIds.push(ads.id_adscripcion || ads.id_empleado)
      addVariant(cl, depName, 'Adscripciones', 1)
    })

    // D. Perfiles de usuario (`id_departamento`)
    perfiles.forEach((p) => {
      if (!p.id_departamento) return
      const depName = catIdToName[String(p.id_departamento)]
      if (!depName) return
      const cl = ensureCluster(depName)
      cl.perfilIds.push(p.id)
      addVariant(cl, depName, 'Usuarios Sistema', 1)
    })

    // E. Lockers (`area`)
    lockersModulos.forEach((lm) => {
      if (!lm.area) return
      const cl = ensureCluster(lm.area)
      cl.lockerModuloIds.push(lm.id_modulo)
      addVariant(cl, lm.area, 'Áreas Lockers', 1)
    })

    // Evaluar conflictos en cada cluster
    const list = Object.values(clusterMap).filter((c) => c.canonicalKey !== 'SIN_ASIGNAR')
    list.forEach((cl) => {
      const distinctRawNames = new Set(cl.rawVariants.map((v) => v.rawName))
      const hasNonCanonicalSpelling = Array.from(distinctRawNames).some((n) => n !== cl.officialName)
      // Hay conflicto si hay >1 fila activa en cat_departamentos, o >1 forma de escribirlo ("RH" vs "Recursos Humanos"), o si no coincide con el nombre oficial en mayúsculas
      cl.hasConflict = cl.catRows.length > 1 || distinctRawNames.size > 1 || hasNonCanonicalSpelling
    })

    return list.sort((a, b) => {
      if (a.hasConflict !== b.hasConflict) return a.hasConflict ? -1 : 1
      return a.officialName.localeCompare(b.officialName)
    })
  }, [catDepartamentos, empleados, adscripciones, perfiles, lockersModulos])

  const conflictingDeptClusters = useMemo(
    () => departmentClusters.filter((c) => c.hasConflict),
    [departmentClusters]
  )

  const handleUnifyDepartmentCluster = async (cluster: DepartmentCluster, silent = false) => {
    const targetName = (customOfficialDeptNames[cluster.canonicalKey] || cluster.officialName).trim().toUpperCase()
    if (!targetName) return

    if (!silent) {
      const variantsList = Array.from(new Set(cluster.rawVariants.map((v) => `"${v.rawName}"`))).join(', ')
      if (
        !confirm(
          `¿Unificar todas las variantes (${variantsList}) bajo el departamento oficial único "${targetName}"?\n\nEsto actualizará Catálogos, Empleados, Adscripciones, Usuarios y Lockers automáticamente.`
        )
      ) {
        return
      }
    }

    setProcessing(true)
    setErrorMsg('')
    if (!silent) setSuccessMsg('')

    try {
      // 1. Determinar o crear el registro Maestro en `cat_departamentos`
      let masterCatId: string | null = null
      const exactCat = cluster.catRows.find((r) => (r.departamento || '').trim() === targetName)
      const firstCat = exactCat || cluster.catRows[0]

      if (firstCat) {
        masterCatId = firstCat.id_departamento
        await supabase
          .from('cat_departamentos')
          .update({ departamento: targetName, activo: true })
          .eq('id_departamento', masterCatId)
      } else {
        const { data: insertedCat } = await supabase
          .from('cat_departamentos')
          .insert([{ departamento: targetName, activo: true }])
          .select()
          .single()
        if (insertedCat) masterCatId = insertedCat.id_departamento
      }

      // 2. Si había filas duplicadas en `cat_departamentos`, reasignar sus FKs al masterCatId y desactivarlas
      if (masterCatId && cluster.catRows.length > 1) {
        for (const dupCat of cluster.catRows) {
          if (String(dupCat.id_departamento) === String(masterCatId)) continue
          const dupId = dupCat.id_departamento

          await supabase
            .from('empleado_adscripciones')
            .update({ id_departamento: masterCatId })
            .eq('id_departamento', dupId)

          await supabase.from('perfiles').update({ id_departamento: masterCatId }).eq('id_departamento', dupId)

          try {
            await supabase
              .from('contratistas_solicitudes')
              .update({ id_departamento_objetivo: masterCatId, departamento_nombre: targetName })
              .eq('id_departamento_objetivo', dupId)
          } catch (_) {}

          await supabase.from('cat_departamentos').update({ activo: false }).eq('id_departamento', dupId)
        }
      }

      // 3. Actualizar empleados cuyo campo texto `departamento` pertenece a este cluster
      const empToUpdate = empleados.filter(
        (e) => e.departamento && canonicalizeDepartment(e.departamento).canonicalKey === cluster.canonicalKey
      )
      for (const emp of empToUpdate) {
        if (emp.departamento !== targetName) {
          await supabase.from('empleados').update({ departamento: targetName }).eq('id_empleado', emp.id_empleado)
        }
      }

      // 4. Actualizar lockers_modulos cuyo campo `area` pertenece a este cluster
      const lockersToUpdate = lockersModulos.filter(
        (l) => l.area && canonicalizeDepartment(l.area).canonicalKey === cluster.canonicalKey
      )
      for (const l of lockersToUpdate) {
        if (l.area !== targetName) {
          await supabase.from('lockers_modulos').update({ area: targetName }).eq('id_modulo', l.id_modulo)
        }
      }

      // 5. Actualizar vacantes y solicitudes contratistas por nombre
      const distinctVariantNames = Array.from(new Set(cluster.rawVariants.map((v) => v.rawName)))
      for (const rawVar of distinctVariantNames) {
        if (rawVar === targetName) continue
        try {
          await supabase.from('movimientos_vacantes').update({ departamento: targetName }).eq('departamento', rawVar)
        } catch (_) {}
        try {
          await supabase
            .from('contratistas_solicitudes')
            .update({ departamento_nombre: targetName })
            .eq('departamento_nombre', rawVar)
        } catch (_) {}
      }

      if (!silent) {
        setSuccessMsg(`¡Departamento "${targetName}" unificado correctamente en todo el sistema!`)
        await fetchAllSystemData()
      }
    } catch (err: any) {
      console.error('Error unificando departamento:', err)
      setErrorMsg('Error al unificar departamento: ' + err.message)
    } finally {
      if (!silent) setProcessing(false)
    }
  }

  const handleUnifyAllDepartments = async () => {
    if (conflictingDeptClusters.length === 0) return
    if (
      !confirm(
        `¿Unificar automáticamente los ${conflictingDeptClusters.length} grupos de departamentos con variaciones (ej. RH -> RECURSOS HUMANOS)?`
      )
    ) {
      return
    }
    setProcessing(true)
    setSuccessMsg('')
    try {
      for (const cluster of conflictingDeptClusters) {
        await handleUnifyDepartmentCluster(cluster, true)
      }
      setSuccessMsg(
        `¡Se normalizaron y unificaron ${conflictingDeptClusters.length} departamentos en todo el sistema!`
      )
      await fetchAllSystemData()
    } finally {
      setProcessing(false)
    }
  }

  const handleManualDeptMerge = async () => {
    if (!manualDeptSource || !manualDeptTarget || manualDeptSource === manualDeptTarget) {
      return alert('Selecciona el departamento origen y el departamento destino oficial.')
    }
    const targetName = manualDeptTarget.trim().toUpperCase()
    if (
      !confirm(
        `¿Mover todos los trabajadores, usuarios y registros de "${manualDeptSource}" hacia "${targetName}"?`
      )
    ) {
      return
    }
    setProcessing(true)
    try {
      const targetCat = catDepartamentos.find(
        (c) => c.activo !== false && cleanAsciiUpper(c.departamento) === cleanAsciiUpper(targetName)
      )
      const sourceCats = catDepartamentos.filter(
        (c) => c.activo !== false && cleanAsciiUpper(c.departamento) === cleanAsciiUpper(manualDeptSource)
      )

      if (targetCat && sourceCats.length > 0) {
        for (const sc of sourceCats) {
          if (sc.id_departamento === targetCat.id_departamento) continue
          await supabase
            .from('empleado_adscripciones')
            .update({ id_departamento: targetCat.id_departamento })
            .eq('id_departamento', sc.id_departamento)
          await supabase
            .from('perfiles')
            .update({ id_departamento: targetCat.id_departamento })
            .eq('id_departamento', sc.id_departamento)
          await supabase.from('cat_departamentos').update({ activo: false }).eq('id_departamento', sc.id_departamento)
        }
      }

      const emps = empleados.filter((e) => cleanAsciiUpper(e.departamento) === cleanAsciiUpper(manualDeptSource))
      for (const emp of emps) {
        await supabase.from('empleados').update({ departamento: targetName }).eq('id_empleado', emp.id_empleado)
      }

      setSuccessMsg(`Se fusionó "${manualDeptSource}" dentro de "${targetName}" exitosamente.`)
      setManualDeptSource('')
      await fetchAllSystemData()
    } catch (e: any) {
      setErrorMsg('Error en fusión manual: ' + e.message)
    } finally {
      setProcessing(false)
    }
  }

  // ============================================================================
  // 2. DETECCIÓN DE PERSONAS DUPLICADAS Y NOMBRES INVERTIDOS (Jose Arana Chavez <-> Arana Chavez Jose)
  // ============================================================================
  const runEmployeeDuplicateDetection = (empList: any[]) => {
    const tokenGroups: Record<string, any[]> = {}
    const phoneticGroups: Record<string, any[]> = {}
    const numEmpGroups: Record<string, any[]> = {}
    const curpGroups: Record<string, any[]> = {}

    empList.forEach((emp) => {
      const fullName = getEmployeeFullName(emp)
      const tokens = normalizeNameTokens(fullName)
      const phonetic = normalizePhoneticTokens(fullName)

      const enriched = { ...emp, _computedName: fullName, _tokens: tokens }

      if (tokens.length >= 2) {
        const tKey = tokens.join('|')
        if (!tokenGroups[tKey]) tokenGroups[tKey] = []
        tokenGroups[tKey].push(enriched)
      }

      if (phonetic.length >= 2) {
        const pKey = phonetic.join('|')
        if (!phoneticGroups[pKey]) phoneticGroups[pKey] = []
        phoneticGroups[pKey].push(enriched)
      }

      if (emp.numero_empleado) {
        const nKey = String(emp.numero_empleado).trim()
        if (!numEmpGroups[nKey]) numEmpGroups[nKey] = []
        numEmpGroups[nKey].push(enriched)
      }

      if (emp.curp && String(emp.curp).trim().length >= 10) {
        const cKey = cleanAsciiUpper(emp.curp)
        if (!curpGroups[cKey]) curpGroups[cKey] = []
        curpGroups[cKey].push(enriched)
      }
    })

    const finalGroups: DuplicatePersonGroup[] = []
    const pairedIds = new Set<string>()

    const registerGroup = (items: any[], reason: string, keyPrefix: string) => {
      // Filtrar items únicos por id_empleado
      const uniqueMap = new Map<string, any>()
      items.forEach((it) => uniqueMap.set(String(it.id_empleado), it))
      const uniqueItems = Array.from(uniqueMap.values())
      if (uniqueItems.length < 2) return

      const signature = uniqueItems
        .map((i) => i.id_empleado)
        .sort()
        .join('_')
      if (pairedIds.has(signature)) return
      pairedIds.add(signature)

      finalGroups.push({
        key: `${keyPrefix}_${signature}`,
        matchReason: reason,
        items: uniqueItems,
      })
    }

    // 1. Exact Token Set Match (detecta 100% "Jose Arana Chavez" vs "Arana Chavez Jose")
    Object.entries(tokenGroups).forEach(([tKey, group]) => {
      if (group.length > 1) {
        const distinctRawOrders = new Set(group.map((g) => cleanAsciiUpper(g._computedName)))
        const reason =
          distinctRawOrders.size > 1
            ? '🔄 NOMBRE INVERTIDO O PERMUTADO (Mismas palabras en distinto orden)'
            : '👥 NOMBRE EXACTAMENTE DUPLICADO'
        registerGroup(group, reason, `TOKEN_${tKey}`)
      }
    })

    // 2. Phonetic Match (detecta "Jose Arana Chavez" vs "Arana Chaves Jose")
    Object.entries(phoneticGroups).forEach(([pKey, group]) => {
      if (group.length > 1) {
        registerGroup(group, '≈ COINCIDENCIA FONÉTICA / ORTOGRÁFICA (Ej. S/Z, B/V, H)', `PHON_${pKey}`)
      }
    })

    // 3. Mismo Número de Empleado / Ficha
    Object.entries(numEmpGroups).forEach(([nKey, group]) => {
      if (group.length > 1) {
        registerGroup(group, `🔢 MISMO NÚMERO DE EMPLEADO / FICHA (#${nKey})`, `NUM_${nKey}`)
      }
    })

    // 4. Mismo CURP
    Object.entries(curpGroups).forEach(([cKey, group]) => {
      if (group.length > 1) {
        registerGroup(group, `🧬 MISMA CURP (${cKey})`, `CURP_${cKey}`)
      }
    })

    // 5. Similitud Parcial Jaccard (ej. "Jose Guadalupe Arana Chavez" vs "Arana Chavez Jose")
    const tokenKeys = Object.keys(tokenGroups)
    for (let i = 0; i < tokenKeys.length; i++) {
      const k1 = tokenKeys[i]
      const t1 = k1.split('|')
      for (let j = i + 1; j < tokenKeys.length; j++) {
        const k2 = tokenKeys[j]
        const t2 = k2.split('|')
        const set2 = new Set(t2)
        const intersection = t1.filter((t) => set2.has(t))
        const unionSize = new Set([...t1, ...t2]).size
        if (intersection.length >= 2 && intersection.length / unionSize >= 0.72) {
          registerGroup(
            [...tokenGroups[k1], ...tokenGroups[k2]],
            `🔍 ALTA SIMILITUD DE NOMBRE (${intersection.join(' ')})`,
            `FUZZY_${k1}`
          )
        }
      }
    }

    setPersonDuplicates(finalGroups)

    // Inicializar selección de Maestro y valores editables sugeridos
    const initMasters: Record<string, string> = {}
    const initEdits: typeof masterEdits = {}

    finalGroups.forEach((g) => {
      // Elegir como maestro por defecto el que tenga estructura de nombre correcta (no invertida)
      const bestCandidate =
        g.items.find((it) => !analyzeSingleEmployeeNameStructure(it).isMalformed) || g.items[0]
      initMasters[g.key] = bestCandidate.id_empleado

      const analysis = analyzeSingleEmployeeNameStructure(bestCandidate)
      const canDept = canonicalizeDepartment(bestCandidate.departamento)
      initEdits[g.key] = {
        nombre: analysis.isMalformed ? analysis.suggestedNombre : bestCandidate.nombre || '',
        apellido_paterno: analysis.isMalformed ? analysis.suggestedPaterno : bestCandidate.apellido_paterno || '',
        apellido_materno: analysis.isMalformed ? analysis.suggestedMaterno : bestCandidate.apellido_materno || '',
        numero_empleado: String(bestCandidate.numero_empleado || ''),
        departamento:
          canDept.canonicalKey !== 'SIN_ASIGNAR' ? canDept.officialName : bestCandidate.departamento || '',
        puesto: bestCandidate.puesto || '',
      }
    })

    setSelectedMasterId(initMasters)
    setMasterEdits(initEdits)
  }

  const handleSelectMasterForGroup = (group: DuplicatePersonGroup, emp: any) => {
    setSelectedMasterId((prev) => ({ ...prev, [group.key]: emp.id_empleado }))
    const analysis = analyzeSingleEmployeeNameStructure(emp)
    const canDept = canonicalizeDepartment(emp.departamento)
    setMasterEdits((prev) => ({
      ...prev,
      [group.key]: {
        nombre: analysis.isMalformed ? analysis.suggestedNombre : emp.nombre || '',
        apellido_paterno: analysis.isMalformed ? analysis.suggestedPaterno : emp.apellido_paterno || '',
        apellido_materno: analysis.isMalformed ? analysis.suggestedMaterno : emp.apellido_materno || '',
        numero_empleado: String(emp.numero_empleado || ''),
        departamento: canDept.canonicalKey !== 'SIN_ASIGNAR' ? canDept.officialName : emp.departamento || '',
        puesto: emp.puesto || '',
      },
    }))
  }

  const handleInvertMasterEdit = (groupKey: string) => {
    const current = masterEdits[groupKey]
    if (!current) return
    const swapped = invertEmployeeNameFields({
      nombre: current.nombre,
      apellido_paterno: current.apellido_paterno,
      apellido_materno: current.apellido_materno,
    })
    setMasterEdits((prev) => ({
      ...prev,
      [groupKey]: {
        ...current,
        ...swapped,
      },
    }))
  }

  /**
   * Fusión profunda y segura de expedientes duplicados:
   * 1. Actualiza el registro Maestro con el nombre/apellidos/departamento corregidos y rescata datos faltantes del duplicado.
   * 2. Re-vincula TODAS las tablas del sistema que apuntan al duplicado hacia el Maestro.
   * 3. Limpia tablas 1-a-1 del duplicado y elimina el registro duplicado.
   */
  const executeSafeEmployeeMerge = async (
    masterId: string,
    duplicateItems: any[],
    editedFields?: {
      nombre: string
      apellido_paterno: string
      apellido_materno: string
      numero_empleado: string
      departamento: string
      puesto: string
    }
  ) => {
    const masterRecord = empleados.find((e) => String(e.id_empleado) === String(masterId))
    if (!masterRecord) throw new Error('No se encontró el registro Maestro.')

    // 1. Consolidar datos del Maestro (rescatando CURP, NSS, RFC, teléfono, foto si el maestro los tenía vacíos)
    const firstWithVal = (field: string) =>
      masterRecord[field] || duplicateItems.find((d) => d[field])?.[field] || null

    const updatePayload: any = {
      nombre: (editedFields?.nombre ?? masterRecord.nombre ?? '').trim().toUpperCase(),
      apellido_paterno: (editedFields?.apellido_paterno ?? masterRecord.apellido_paterno ?? '').trim().toUpperCase(),
      apellido_materno: (editedFields?.apellido_materno ?? masterRecord.apellido_materno ?? '').trim().toUpperCase() || null,
      departamento: editedFields?.departamento
        ? canonicalizeDepartment(editedFields.departamento).officialName
        : masterRecord.departamento || firstWithVal('departamento'),
      puesto: editedFields?.puesto || masterRecord.puesto || firstWithVal('puesto'),
      curp: firstWithVal('curp'),
      rfc: firstWithVal('rfc'),
      nss: firstWithVal('nss'),
      telefono: firstWithVal('telefono'),
      correo_electronico: firstWithVal('correo_electronico'),
      foto_url: firstWithVal('foto_url'),
    }

    if (editedFields?.numero_empleado && !isNaN(parseInt(editedFields.numero_empleado))) {
      updatePayload.numero_empleado = parseInt(editedFields.numero_empleado)
    }

    await supabase.from('empleados').update(updatePayload).eq('id_empleado', masterId)

    // 2. Re-vincular todas las tablas satélites de cada duplicado hacia el Maestro
    const tablesWithIdEmpleado = [
      'pacientes',
      'pases_medicos',
      'consultas_medicas',
      'logistica_viajes_programados',
      'logistica_reportes_diarios',
      'campamento_camas',
      'lockers_casilleros',
      'comedor_registros',
      'empleado_incidencias',
      'empleado_roles',
      'empleado_turnos',
      'empleado_adscripciones',
      'seguridad_inducciones',
      'movimientos_postulaciones',
      'evaluaciones',
    ]

    for (const dup of duplicateItems) {
      const dupId = dup.id_empleado
      if (String(dupId) === String(masterId)) continue

      for (const table of tablesWithIdEmpleado) {
        try {
          await (supabase as any).from(table).update({ id_empleado: masterId }).eq('id_empleado', dupId)
        } catch (_) {}
      }

      // Solicitudes pueden usar id_empleado o id_empleado_objetivo
      try {
        await supabase.from('solicitudes').update({ id_empleado: masterId }).eq('id_empleado', dupId)
      } catch (_) {}
      try {
        await supabase
          .from('solicitudes')
          .update({ id_empleado_objetivo: masterId })
          .eq('id_empleado_objetivo', dupId)
      } catch (_) {}

      // Limpiar tablas 1-a-1 secundarias del duplicado para liberar FK antes de eliminar
      const oneToOneTables = ['empleado_domicilio', 'empleado_ingreso', 'empleado_banco', 'empleado_salarios']
      for (const t1 of oneToOneTables) {
        try {
          await (supabase as any).from(t1).delete().eq('id_empleado', dupId)
        } catch (_) {}
      }

      // Eliminar registro duplicado
      const { error: delErr } = await supabase.from('empleados').delete().eq('id_empleado', dupId)
      if (delErr) {
        // Si alguna restricción impide el borrado físico, lo marcamos como Baja Inactiva y limpiamos su nombre para que no duplique
        console.warn('Fallback soft-delete for duplicate employee:', delErr.message)
        await supabase
          .from('empleados')
          .update({
            estado_empleado: 'Baja',
            nombre: `[FUSIONADO->#${updatePayload.numero_empleado || masterId}]`,
            apellido_paterno: '',
            apellido_materno: '',
          })
          .eq('id_empleado', dupId)
      }
    }
  }

  const handleMergePersonGroup = async (group: DuplicatePersonGroup) => {
    const masterId = selectedMasterId[group.key]
    if (!masterId) return alert('Selecciona cuál será el registro Maestro.')
    const duplicateItems = group.items.filter((i) => String(i.id_empleado) !== String(masterId))
    if (duplicateItems.length === 0) return

    const edit = masterEdits[group.key]
    const finalDisplayName = edit
      ? `${edit.nombre} ${edit.apellido_paterno} ${edit.apellido_materno}`.trim()
      : 'Maestro'

    if (
      !confirm(
        `¿Confirmas unificar ${duplicateItems.length} expediente(s) duplicado(s) dentro del Registro Maestro "${finalDisplayName}"?\n\nTodo el historial (Vacaciones, Pases Médicos, Lockers, Campamento, Sindicato y Transporte) se conservará en el Maestro y el duplicado se eliminará.`
      )
    ) {
      return
    }

    setProcessing(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      await executeSafeEmployeeMerge(masterId, duplicateItems, edit)
      setSuccessMsg(`¡Expedientes unificados con éxito en "${finalDisplayName}"!`)
      await fetchAllSystemData()
    } catch (err: any) {
      setErrorMsg('Error al fusionar expedientes: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleManualPairMerge = async () => {
    if (!manualEmpA || !manualEmpB || manualEmpA === manualEmpB) {
      return alert('Selecciona dos empleados distintos para fusionar.')
    }
    const empMaster = empleados.find((e) => String(e.id_empleado) === String(manualEmpA))
    const empDup = empleados.find((e) => String(e.id_empleado) === String(manualEmpB))
    if (!empMaster || !empDup) return

    if (
      !confirm(
        `¿Fusionar el expediente duplicado "${getEmployeeFullName(empDup)}" (#${empDup.numero_empleado}) DENTRO del Maestro "${getEmployeeFullName(empMaster)}" (#${empMaster.numero_empleado})?`
      )
    ) {
      return
    }

    setProcessing(true)
    setErrorMsg('')
    try {
      await executeSafeEmployeeMerge(empMaster.id_empleado, [empDup])
      setSuccessMsg(
        `¡Se fusionó "${getEmployeeFullName(empDup)}" dentro de "${getEmployeeFullName(empMaster)}" correctamente!`
      )
      setManualEmpA('')
      setManualEmpB('')
      await fetchAllSystemData()
    } catch (e: any) {
      setErrorMsg('Error en fusión manual: ' + e.message)
    } finally {
      setProcessing(false)
    }
  }

  // ============================================================================
  // 3. PESTAÑA DE NOMBRES INVERTIDOS EN REGISTRO ÚNICO (Arana Chavez Jose -> Jose Arana Chavez)
  // ============================================================================
  const analyzedSingleEmployees = useMemo(() => {
    return empleados.map((emp) => {
      const analysis = analyzeSingleEmployeeNameStructure(emp)
      const deptInfo = canonicalizeDepartment(emp.departamento)
      return {
        emp,
        analysis,
        deptInfo,
      }
    })
  }, [empleados])

  const malformedEmployeesCount = useMemo(
    () => analyzedSingleEmployees.filter((item) => item.analysis.isMalformed).length,
    [analyzedSingleEmployees]
  )

  const filteredSingleEmployees = useMemo(() => {
    const q = cleanAsciiUpper(searchSingleEmp)
    return analyzedSingleEmployees.filter((item) => {
      if (onlyShowMalformed && !q && !item.analysis.isMalformed) return false
      if (!q) return true
      const full = cleanAsciiUpper(
        `${item.emp.nombre || ''} ${item.emp.apellido_paterno || ''} ${item.emp.apellido_materno || ''} ${item.emp.numero_empleado || ''} ${item.emp.departamento || ''}`
      )
      return q.split(' ').every((tok) => full.includes(tok))
    })
  }, [analyzedSingleEmployees, onlyShowMalformed, searchSingleEmp])

  const getSingleRowEdit = (item: { emp: any; analysis: any; deptInfo: any }) => {
    const id = item.emp.id_empleado
    if (singleRowEdits[id]) return singleRowEdits[id]
    return {
      nombre: item.analysis.isMalformed ? item.analysis.suggestedNombre : item.emp.nombre || '',
      apellido_paterno: item.analysis.isMalformed ? item.analysis.suggestedPaterno : item.emp.apellido_paterno || '',
      apellido_materno: item.analysis.isMalformed ? item.analysis.suggestedMaterno : item.emp.apellido_materno || '',
      departamento:
        item.deptInfo.canonicalKey !== 'SIN_ASIGNAR' ? item.deptInfo.officialName : item.emp.departamento || '',
    }
  }

  const handleInvertSingleRow = (item: { emp: any; analysis: any; deptInfo: any }) => {
    const current = getSingleRowEdit(item)
    const swapped = invertEmployeeNameFields(current)
    setSingleRowEdits((prev) => ({
      ...prev,
      [item.emp.id_empleado]: {
        ...current,
        ...swapped,
      },
    }))
  }

  const handleSaveSingleEmployeeFix = async (item: { emp: any; analysis: any; deptInfo: any }) => {
    const edit = getSingleRowEdit(item)
    setProcessing(true)
    setErrorMsg('')
    try {
      const canDept = canonicalizeDepartment(edit.departamento)
      const finalDept = canDept.canonicalKey !== 'SIN_ASIGNAR' ? canDept.officialName : edit.departamento
      await supabase
        .from('empleados')
        .update({
          nombre: edit.nombre.trim().toUpperCase(),
          apellido_paterno: edit.apellido_paterno.trim().toUpperCase(),
          apellido_materno: edit.apellido_materno.trim().toUpperCase() || null,
          departamento: finalDept || null,
        })
        .eq('id_empleado', item.emp.id_empleado)

      setSuccessMsg(
        `¡Registro #${item.emp.numero_empleado || ''} actualizado a: "${edit.nombre.toUpperCase()} ${edit.apellido_paterno.toUpperCase()} ${edit.apellido_materno.toUpperCase()}"!`
      )
      await fetchAllSystemData()
    } catch (e: any) {
      setErrorMsg('Error al guardar cambio: ' + e.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleFixAllMalformedNames = async () => {
    const malformed = analyzedSingleEmployees.filter((i) => i.analysis.isMalformed)
    if (malformed.length === 0) return
    if (
      !confirm(
        `¿Aplicar la corrección automática de Nombre y Apellidos a los ${malformed.length} trabajadores detectados con nombre invertido o sin separar?`
      )
    ) {
      return
    }
    setProcessing(true)
    try {
      for (const item of malformed) {
        const edit = getSingleRowEdit(item)
        await supabase
          .from('empleados')
          .update({
            nombre: edit.nombre.trim().toUpperCase(),
            apellido_paterno: edit.apellido_paterno.trim().toUpperCase(),
            apellido_materno: edit.apellido_materno.trim().toUpperCase() || null,
          })
          .eq('id_empleado', item.emp.id_empleado)
      }
      setSuccessMsg(`¡Se corrigieron ${malformed.length} nombres invertidos automáticamente!`)
      await fetchAllSystemData()
    } catch (e: any) {
      setErrorMsg('Error al corregir en lote: ' + e.message)
    } finally {
      setProcessing(false)
    }
  }

  // ============================================================================
  // 4. DETECCIÓN EN BENEFICIARIOS / PACIENTES
  // ============================================================================
  const runPatientDuplicateDetection = (pacList: any[]) => {
    const groupsMap: Record<string, any[]> = {}
    pacList.forEach((p) => {
      const fullName = (p.nombre_completo || '').trim()
      const tokens = normalizeNameTokens(fullName)
      if (tokens.length < 2) return
      const key = tokens.join('|')
      if (!groupsMap[key]) groupsMap[key] = []
      groupsMap[key].push({ ...p, _computedName: fullName })
    })

    const dupGroups: DuplicatePersonGroup[] = []
    Object.entries(groupsMap).forEach(([k, items]) => {
      if (items.length > 1) {
        dupGroups.push({
          key: k,
          matchReason: '🔄 NOMBRE DUPLICADO O INVERTIDO EN BENEFICIARIOS',
          items,
        })
      }
    })
    setPatientDuplicates(dupGroups)
    const initM: Record<string, string> = {}
    dupGroups.forEach((g) => {
      initM[g.key] = g.items[0].id_paciente
    })
    setSelectedPatientMaster(initM)
  }

  const handleMergePatientGroup = async (group: DuplicatePersonGroup) => {
    const masterId = selectedPatientMaster[group.key]
    if (!masterId) return
    const dups = group.items.filter((i) => String(i.id_paciente) !== String(masterId))
    if (!confirm(`¿Unificar ${dups.length} beneficiario(s) duplicado(s) en el registro Maestro seleccionado?`)) return

    setProcessing(true)
    try {
      for (const dup of dups) {
        await supabase.from('pases_medicos').update({ id_paciente: masterId }).eq('id_paciente', dup.id_paciente)
        await supabase.from('consultas_medicas').update({ id_paciente: masterId }).eq('id_paciente', dup.id_paciente)
        await supabase.from('pacientes').delete().eq('id_paciente', dup.id_paciente)
      }
      setSuccessMsg('¡Beneficiarios unificados correctamente!')
      await fetchAllSystemData()
    } catch (e: any) {
      setErrorMsg('Error unificando beneficiarios: ' + e.message)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] space-y-4 bg-white border border-zinc-200 rounded-3xl p-8 sm:p-12 shadow-xs">
        <RefreshCw className="w-10 h-10 text-amber-500 animate-spin" />
        <div className="text-center space-y-1">
          <h3 className="text-base font-black text-zinc-900 uppercase">
            Escaneando Departamentos, Empleados y Nombres Invertidos...
          </h3>
          <p className="text-xs text-zinc-500">
            Detectando variaciones como &quot;RH / recursos humanos / RECURSOS HUMANOS&quot; y &quot;Jose Arana Chavez / Arana Chavez Jose&quot;.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-20">
      {/* HEADER PRINCIPAL */}
      <div className="bg-zinc-950 text-white p-5 sm:p-7 rounded-3xl shadow-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 relative overflow-hidden border border-zinc-800">
        <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
          <Sparkles className="w-44 h-44 text-amber-400" />
        </div>
        <div className="flex items-start sm:items-center gap-4 relative z-10">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-amber-500 text-black rounded-2xl flex items-center justify-center font-black shrink-0 shadow-lg shadow-amber-500/20">
            <Wand2 className="w-7 h-7" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-wider mb-1">
              <span>Motor de Integridad y Limpieza de Base de Datos</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Centro de Depuración: Departamentos y Personas Duplicadas
            </h1>
            <p className="text-zinc-400 text-xs mt-0.5 max-w-2xl">
              Identifica y unifica departamentos repetidos (ej. <strong className="text-amber-300">RH / recursos humanos / RECURSOS HUMANOS</strong>) y trabajadores con doble registro o nombre al revés (ej. <strong className="text-amber-300">Jose Arana Chavez ↔ Arana Chavez Jose</strong>).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto relative z-10">
          <button
            onClick={fetchAllSystemData}
            disabled={processing}
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-black rounded-xl transition-colors border border-zinc-700 flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} />
            <span>Re-escanear Sistema</span>
          </button>
          <Link
            href="/empleados"
            className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-xs font-bold rounded-xl transition-colors border border-zinc-800 text-zinc-300"
          >
            &larr; Directorio Empleados
          </Link>
        </div>
      </div>

      {/* TARJETAS DE DIAGNÓSTICO RÁPIDO (4 PESTAÑAS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={() => setActiveTab('departamentos')}
          className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeTab === 'departamentos'
              ? 'bg-zinc-900 text-white border-amber-500 shadow-lg'
              : 'bg-white text-zinc-900 border-zinc-200 hover:border-zinc-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-500">
              1. Departamentos
            </span>
            <Building2 className="w-5 h-5 text-amber-500" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-black">{conflictingDeptClusters.length}</span>
            <span className="text-xs ml-1.5 opacity-80">con variantes (RH / Recursos...)</span>
          </div>
          <span className="text-[10px] font-bold opacity-70">
            {departmentClusters.length} áreas canónicas analizadas
          </span>
        </button>

        <button
          onClick={() => setActiveTab('empleados')}
          className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeTab === 'empleados'
              ? 'bg-zinc-900 text-white border-emerald-500 shadow-lg'
              : 'bg-white text-zinc-900 border-zinc-200 hover:border-zinc-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-500">
              2. Doble Persona
            </span>
            <Users className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-black">{personDuplicates.length}</span>
            <span className="text-xs ml-1.5 opacity-80">grupos duplicados / invertidos</span>
          </div>
          <span className="text-[10px] font-bold opacity-70">
            De {empleados.length} trabajadores en padrón
          </span>
        </button>

        <button
          onClick={() => setActiveTab('invertidos')}
          className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeTab === 'invertidos'
              ? 'bg-zinc-900 text-white border-blue-500 shadow-lg'
              : 'bg-white text-zinc-900 border-zinc-200 hover:border-zinc-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-500">
              3. Invertir Nombre ↔ Apellido
            </span>
            <ArrowLeftRight className="w-5 h-5 text-blue-500" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-black">{malformedEmployeesCount}</span>
            <span className="text-xs ml-1.5 opacity-80">capturados al revés o juntos</span>
          </div>
          <span className="text-[10px] font-bold opacity-70">
            Corrección individual o masiva en 1 clic
          </span>
        </button>

        <button
          onClick={() => setActiveTab('pacientes')}
          className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeTab === 'pacientes'
              ? 'bg-zinc-900 text-white border-rose-500 shadow-lg'
              : 'bg-white text-zinc-900 border-zinc-200 hover:border-zinc-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-rose-500">
              4. Beneficiarios / Clínica
            </span>
            <Heart className="w-5 h-5 text-rose-500" />
          </div>
          <div className="my-2">
            <span className="text-2xl font-black">{patientDuplicates.length}</span>
            <span className="text-xs ml-1.5 opacity-80">familias/pacientes repetidos</span>
          </div>
          <span className="text-[10px] font-bold opacity-70">
            De {pacientes.length} pacientes registrados
          </span>
        </button>
      </div>

      {/* MENSAJES DE RETROALIMENTACIÓN */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-400 text-emerald-950 rounded-2xl text-xs font-black flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 hover:underline text-[11px]">
            Cerrar
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border-2 border-rose-400 text-rose-950 rounded-2xl text-xs font-black flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-700 hover:underline text-[11px]">
            Cerrar
          </button>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 1: DUPLICIDAD DE DEPARTAMENTOS (RH / recursos humanos / RECURSOS HUMANOS)
         ===================================================================== */}
      {activeTab === 'departamentos' && (
        <div className="space-y-6">
          {/* Barra de Acción Masiva de Departamentos */}
          <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-base font-black text-zinc-900 uppercase flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-500" />
                <span>Unificador de Departamentos Duplicados (RH / recursos humanos / RECURSOS HUMANOS)</span>
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Agrupa automáticamente abreviaturas, minúsculas y mayúsculas para que todo el sistema use un único departamento oficial.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="text-xs font-bold text-zinc-600 flex items-center gap-1.5 cursor-pointer bg-zinc-100 px-3 py-2 rounded-xl">
                <input
                  type="checkbox"
                  checked={showAllDepts}
                  onChange={(e) => setShowAllDepts(e.target.checked)}
                  className="rounded text-amber-500"
                />
                <span>Ver también departamentos ya limpios ({departmentClusters.length})</span>
              </label>

              {conflictingDeptClusters.length > 0 && (
                <button
                  onClick={handleUnifyAllDepartments}
                  disabled={processing}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Wand2 className="w-4 h-4" />
                  <span>⚡ Unificar Todos los Departamentos ({conflictingDeptClusters.length}) en 1 Clic</span>
                </button>
              )}
            </div>
          </div>

          {/* Herramienta Manual para Fusionar 2 Departamentos Cualesquiera */}
          <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200 flex flex-col lg:flex-row items-stretch lg:items-end gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-black uppercase text-zinc-600 mb-1">
                Fusión Manual — Departamento Duplicado / Incorrecto (Origen):
              </label>
              <select
                value={manualDeptSource}
                onChange={(e) => setManualDeptSource(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-bold bg-white text-zinc-900"
              >
                <option value="">Seleccionar variante a absorber...</option>
                {Array.from(
                  new Set([
                    ...catDepartamentos.filter((c) => c.activo !== false).map((c) => c.departamento),
                    ...empleados.map((e) => e.departamento).filter(Boolean),
                  ])
                )
                  .sort()
                  .map((dName) => (
                    <option key={`src-${dName}`} value={dName}>
                      {dName}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-center justify-center py-1">
              <ArrowRight className="w-5 h-5 text-zinc-400 hidden lg:block" />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-black uppercase text-zinc-600 mb-1">
                Departamento Oficial donde se Unificará (Destino):
              </label>
              <input
                type="text"
                list="canonical-depts-list"
                value={manualDeptTarget}
                onChange={(e) => setManualDeptTarget(e.target.value)}
                placeholder="Ej. RECURSOS HUMANOS, MINA, PLANTA DE BENEFICIO..."
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-bold bg-white text-zinc-900 uppercase"
              />
              <datalist id="canonical-depts-list">
                {departmentClusters.map((c) => (
                  <option key={c.canonicalKey} value={c.officialName} />
                ))}
              </datalist>
            </div>
            <button
              onClick={handleManualDeptMerge}
              disabled={processing || !manualDeptSource || !manualDeptTarget}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white font-black text-xs rounded-xl transition-all cursor-pointer shrink-0"
            >
              🔗 Fusionar Manualmente
            </button>
          </div>

          {/* Lista de Clusters de Departamentos */}
          {(showAllDepts ? departmentClusters : conflictingDeptClusters).length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-3xl p-10 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl mx-auto flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-zinc-900 uppercase">
                ¡Todos los Departamentos están Unificados y Normalizados!
              </h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                No existen duplicidades como &quot;RH / recursos humanos / RECURSOS HUMANOS&quot;. Puedes marcar la casilla superior para ver todos los departamentos activos.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(showAllDepts ? departmentClusters : conflictingDeptClusters).map((cluster) => {
                const officialValue = customOfficialDeptNames[cluster.canonicalKey] ?? cluster.officialName
                return (
                  <div
                    key={cluster.canonicalKey}
                    className={`bg-white rounded-3xl p-5 border-2 shadow-xs flex flex-col justify-between gap-4 ${
                      cluster.hasConflict ? 'border-amber-300' : 'border-emerald-200'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2 border-b border-zinc-100 pb-3">
                        <div>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              cluster.hasConflict
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-900'
                            }`}
                          >
                            {cluster.hasConflict
                              ? `⚠️ Conflicto Detectado (${cluster.rawVariants.length} registros/variantes)`
                              : '✅ Departamento Unificado'}
                          </span>
                          <h3 className="text-base font-black text-zinc-900 mt-1.5 uppercase">
                            {cluster.officialName}
                          </h3>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-zinc-900 text-amber-400 font-mono text-xs font-black">
                          {cluster.shortTag}
                        </span>
                      </div>

                      {/* Variantes Encontradas */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                          Formas escritas encontradas en la base de datos:
                        </span>
                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                          {cluster.rawVariants.map((v, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-xs px-3 py-1.5 rounded-xl bg-zinc-50 border border-zinc-200/80"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono font-black text-zinc-900 truncate">
                                  &quot;{v.rawName}&quot;
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-200 text-zinc-700 font-bold shrink-0">
                                  {v.source}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-zinc-600 shrink-0">
                                {v.count} {v.count === 1 ? 'registro' : 'registros'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Selector de Nombre Oficial y Botón Unificar */}
                    <div className="pt-3 border-t border-zinc-100 space-y-2.5">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">
                          Nombre Oficial Único al que se convertirá todo:
                        </label>
                        <input
                          type="text"
                          value={officialValue}
                          onChange={(e) =>
                            setCustomOfficialDeptNames((prev) => ({
                              ...prev,
                              [cluster.canonicalKey]: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-black uppercase text-zinc-900 bg-zinc-50"
                        />
                      </div>

                      <button
                        onClick={() => handleUnifyDepartmentCluster(cluster)}
                        disabled={processing}
                        className={`w-full py-2.5 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          cluster.hasConflict
                            ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                        }`}
                      >
                        <LinkIcon className="w-4 h-4" />
                        <span>
                          {cluster.hasConflict
                            ? `🔗 Unificar Variantes en "${officialValue}"`
                            : `Re-sincronizar "${officialValue}"`}
                        </span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 2: DUPLICIDAD DE PERSONAS (Jose Arana Chavez <-> Arana Chavez Jose)
         ===================================================================== */}
      {activeTab === 'empleados' && (
        <div className="space-y-6">
          {/* Herramienta de Comparación y Fusión Manual entre 2 Empleados */}
          <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-zinc-900 uppercase flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>Unificador Manual de 2 Expedientes (Si deseas unir 2 personas específicas)</span>
                </h3>
                <p className="text-xs text-zinc-500">
                  Además del detector automático inferior, aquí puedes elegir cualquier par de trabajadores para fusionarlos en uno solo.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
              <div className="lg:col-span-5">
                <label className="block text-[10px] font-black uppercase text-emerald-700 mb-1">
                  🟢 Expediente Maestro (El que se conservará):
                </label>
                <select
                  value={manualEmpA}
                  onChange={(e) => setManualEmpA(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border-2 border-emerald-400 text-xs font-bold bg-white text-zinc-900"
                >
                  <option value="">Seleccionar Trabajador Maestro...</option>
                  {empleados.map((e) => (
                    <option key={`ma-${e.id_empleado}`} value={e.id_empleado}>
                      #{e.numero_empleado || 'S/N'} — {e.nombre} {e.apellido_paterno} {e.apellido_materno || ''} ({e.departamento || 'Sin Depto'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-5">
                <label className="block text-[10px] font-black uppercase text-rose-700 mb-1">
                  🔴 Expediente Duplicado (Se fusionará en el Maestro y se eliminará):
                </label>
                <select
                  value={manualEmpB}
                  onChange={(e) => setManualEmpB(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border-2 border-rose-300 text-xs font-bold bg-white text-zinc-900"
                >
                  <option value="">Seleccionar Trabajador Duplicado...</option>
                  {empleados.map((e) => (
                    <option key={`mb-${e.id_empleado}`} value={e.id_empleado}>
                      #{e.numero_empleado || 'S/N'} — {e.nombre} {e.apellido_paterno} {e.apellido_materno || ''} ({e.departamento || 'Sin Depto'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <button
                  onClick={handleManualPairMerge}
                  disabled={processing || !manualEmpA || !manualEmpB || manualEmpA === manualEmpB}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  🔗 Unir Par
                </button>
              </div>
            </div>
          </div>

          {/* Lista de Grupos Duplicados Detectados Automáticamente */}
          {personDuplicates.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-3xl p-12 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl mx-auto flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-zinc-900 uppercase">
                ¡Sin Empleados Duplicados en el Padrón!
              </h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                No se detectaron trabajadores repetidos ni pares como &quot;Jose Arana Chavez / Arana Chavez Jose&quot;. Si tienes un registro único con el nombre al revés, revisa la pestaña 3 (&quot;Invertir Nombre ↔ Apellido&quot;).
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {personDuplicates.map((group, idx) => {
                const currentMaster = selectedMasterId[group.key]
                const edit = masterEdits[group.key] || {
                  nombre: '',
                  apellido_paterno: '',
                  apellido_materno: '',
                  numero_empleado: '',
                  departamento: '',
                  puesto: '',
                }

                return (
                  <div
                    key={group.key}
                    className="bg-white border-2 border-amber-300 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5 relative overflow-hidden"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-xl bg-amber-500 text-zinc-950 font-black text-xs flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </span>
                        <div>
                          <span className="text-[11px] font-black uppercase text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                            {group.matchReason}
                          </span>
                          <h3 className="text-sm font-black text-zinc-900 uppercase mt-1">
                            Conflicto entre {group.items.length} Registros Encontrados
                          </h3>
                        </div>
                      </div>
                    </div>

                    {/* Comparativa de las tarjetas duplicadas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.items.map((item) => {
                        const isMaster = String(item.id_empleado) === String(currentMaster)
                        const structure = analyzeSingleEmployeeNameStructure(item)

                        return (
                          <div
                            key={item.id_empleado}
                            onClick={() => handleSelectMasterForGroup(group, item)}
                            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-3 relative ${
                              isMaster
                                ? 'bg-emerald-50/70 border-emerald-500 text-emerald-950 shadow-sm'
                                : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:border-zinc-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-black text-sm uppercase text-zinc-900">
                                  {item._computedName}
                                </div>
                                <div className="text-[11px] font-mono text-zinc-500 font-bold">
                                  Ficha #{item.numero_empleado || 'S/N'} · Estado: {item.estado_empleado || 'Activo'}
                                </div>
                              </div>
                              {isMaster ? (
                                <span className="text-[9px] font-black bg-emerald-600 text-white px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1 shrink-0">
                                  <CheckCircle2 className="w-3 h-3" /> MAESTRO
                                </span>
                              ) : (
                                <span className="text-[9px] font-black bg-rose-100 text-rose-800 px-2 py-1 rounded-lg uppercase shrink-0">
                                  DUPLICADO
                                </span>
                              )}
                            </div>

                            {/* Desglose exacto de columnas */}
                            <div className="grid grid-cols-3 gap-1.5 bg-white p-2.5 rounded-xl border border-zinc-200 text-[11px]">
                              <div>
                                <span className="text-[9px] font-black text-zinc-400 block uppercase">Nombre(s)</span>
                                <strong className="text-zinc-900 font-mono">{item.nombre || '—'}</strong>
                              </div>
                              <div>
                                <span className="text-[9px] font-black text-zinc-400 block uppercase">Ap. Paterno</span>
                                <strong className="text-zinc-900 font-mono">{item.apellido_paterno || '—'}</strong>
                              </div>
                              <div>
                                <span className="text-[9px] font-black text-zinc-400 block uppercase">Ap. Materno</span>
                                <strong className="text-zinc-900 font-mono">{item.apellido_materno || '—'}</strong>
                              </div>
                            </div>

                            {structure.isMalformed && (
                              <div className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2.5 py-1.5 rounded-lg border border-amber-300">
                                ⚠️ Detectado al revés/junto → Sugerido:{' '}
                                <strong>
                                  {structure.suggestedNombre} | {structure.suggestedPaterno} | {structure.suggestedMaterno}
                                </strong>
                              </div>
                            )}

                            <div className="text-[11px] font-mono text-zinc-600 flex flex-wrap justify-between gap-2">
                              <span>
                                Depto: <strong>{item.departamento || 'Sin asignar'}</strong>
                              </span>
                              <span>
                                Puesto: <strong>{item.puesto || 'General'}</strong>
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Editor en Vivo del Registro Maestro Resultante antes de Unificar */}
                    <div className="bg-zinc-900 text-white p-4 rounded-2xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
                          <Edit3 className="w-4 h-4" />
                          <span>Cómo quedará el Expediente Maestro Unificado (Puedes corregir o invertir aquí):</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleInvertMasterEdit(group.key)}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-[11px] rounded-lg flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                          <span>⇄ Invertir Nombre ↔ Apellidos</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">NOMBRE(S)</label>
                          <input
                            type="text"
                            value={edit.nombre}
                            onChange={(e) =>
                              setMasterEdits((prev) => ({
                                ...prev,
                                [group.key]: { ...edit, nombre: e.target.value },
                              }))
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg text-xs font-black uppercase"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">APELLIDO PATERNO</label>
                          <input
                            type="text"
                            value={edit.apellido_paterno}
                            onChange={(e) =>
                              setMasterEdits((prev) => ({
                                ...prev,
                                [group.key]: { ...edit, apellido_paterno: e.target.value },
                              }))
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg text-xs font-black uppercase"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">APELLIDO MATERNO</label>
                          <input
                            type="text"
                            value={edit.apellido_materno}
                            onChange={(e) =>
                              setMasterEdits((prev) => ({
                                ...prev,
                                [group.key]: { ...edit, apellido_materno: e.target.value },
                              }))
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg text-xs font-black uppercase"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">NO. FICHA / NÓMINA</label>
                          <input
                            type="text"
                            value={edit.numero_empleado}
                            onChange={(e) =>
                              setMasterEdits((prev) => ({
                                ...prev,
                                [group.key]: { ...edit, numero_empleado: e.target.value },
                              }))
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg text-xs font-black"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">DEPARTAMENTO OFICIAL</label>
                          <input
                            type="text"
                            list="canonical-depts-list"
                            value={edit.departamento}
                            onChange={(e) =>
                              setMasterEdits((prev) => ({
                                ...prev,
                                [group.key]: { ...edit, departamento: e.target.value },
                              }))
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg text-xs font-black uppercase"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleMergePersonGroup(group)}
                          disabled={processing}
                          className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <LinkIcon className="w-4 h-4" />
                          <span>🔗 Unificar Expedientes y Guardar Nombre Corregido</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 3: INVERTIR NOMBRE <-> APELLIDOS EN REGISTROS INDIVIDUALES
         ===================================================================== */}
      {activeTab === 'invertidos' && (
        <div className="space-y-5">
          <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h2 className="text-base font-black text-zinc-900 uppercase flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-blue-600" />
                  <span>Corrector de Nombres Invertidos (&quot;Arana Chavez Jose&quot; → &quot;Jose Arana Chavez&quot;)</span>
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Detecta trabajadores cuyos apellidos quedaron escritos en la columna de Nombre o que tienen todo el nombre junto en un solo campo.
                </p>
              </div>

              {malformedEmployeesCount > 0 && (
                <button
                  onClick={handleFixAllMalformedNames}
                  disabled={processing}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <Wand2 className="w-4 h-4" />
                  <span>✨ Corregir Todos los Invertidos Detectados ({malformedEmployeesCount})</span>
                </button>
              )}
            </div>

            {/* Buscador de cualquier empleado para invertirlo o corregirlo */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t border-zinc-100">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  value={searchSingleEmp}
                  onChange={(e) => setSearchSingleEmp(e.target.value)}
                  placeholder="Buscar cualquier empleado por nombre o apellido (ej. Jose Arana o Arana Jose)..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-300 text-xs font-bold"
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 bg-zinc-100 px-3.5 py-2 rounded-xl cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={onlyShowMalformed}
                  onChange={(e) => setOnlyShowMalformed(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Solo mostrar sospechosos de inversión ({malformedEmployeesCount})</span>
              </label>
            </div>
          </div>

          {filteredSingleEmployees.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-3xl p-10 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl mx-auto flex items-center justify-center">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-zinc-900 uppercase">
                No se encontraron registros con nombre invertido automático
              </h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Puedes desmarcar la casilla &quot;Solo mostrar sospechosos&quot; o escribir cualquier nombre en el buscador superior para invertir o editar manualmente cualquier trabajador.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSingleEmployees.slice(0, 60).map((item) => {
                const edit = getSingleRowEdit(item)
                return (
                  <div
                    key={item.emp.id_empleado}
                    className={`bg-white p-4 rounded-2xl border-2 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 ${
                      item.analysis.isMalformed ? 'border-blue-300' : 'border-zinc-200'
                    }`}
                  >
                    <div className="space-y-1 min-w-[240px]">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-zinc-900 text-amber-400 font-mono text-[10px] font-black">
                          #{item.emp.numero_empleado || 'S/N'}
                        </span>
                        <span className="text-xs font-black text-zinc-900 uppercase">
                          Actual: {item.emp.nombre} | {item.emp.apellido_paterno} | {item.emp.apellido_materno || '—'}
                        </span>
                      </div>
                      {item.analysis.isMalformed ? (
                        <p className="text-[11px] font-bold text-blue-700">{item.analysis.reason}</p>
                      ) : (
                        <p className="text-[11px] text-zinc-500">
                          Depto actual: <strong>{item.emp.departamento || 'Sin asignar'}</strong>
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 flex-1 w-full">
                      <div>
                        <label className="text-[9px] font-black text-zinc-400 block uppercase">Nombre(s)</label>
                        <input
                          type="text"
                          value={edit.nombre}
                          onChange={(e) =>
                            setSingleRowEdits((prev) => ({
                              ...prev,
                              [item.emp.id_empleado]: { ...edit, nombre: e.target.value },
                            }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 text-xs font-black uppercase"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-zinc-400 block uppercase">Apellido Paterno</label>
                        <input
                          type="text"
                          value={edit.apellido_paterno}
                          onChange={(e) =>
                            setSingleRowEdits((prev) => ({
                              ...prev,
                              [item.emp.id_empleado]: { ...edit, apellido_paterno: e.target.value },
                            }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 text-xs font-black uppercase"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-zinc-400 block uppercase">Apellido Materno</label>
                        <input
                          type="text"
                          value={edit.apellido_materno}
                          onChange={(e) =>
                            setSingleRowEdits((prev) => ({
                              ...prev,
                              [item.emp.id_empleado]: { ...edit, apellido_materno: e.target.value },
                            }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 text-xs font-black uppercase"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-zinc-400 block uppercase">Departamento</label>
                        <input
                          type="text"
                          list="canonical-depts-list"
                          value={edit.departamento}
                          onChange={(e) =>
                            setSingleRowEdits((prev) => ({
                              ...prev,
                              [item.emp.id_empleado]: { ...edit, departamento: e.target.value },
                            }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 text-xs font-black uppercase"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full lg:w-auto justify-end">
                      <button
                        type="button"
                        onClick={() => handleInvertSingleRow(item)}
                        className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-black text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                        title="Rotar Nombre <-> Apellidos"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>⇄ Invertir</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveSingleEmployeeFix(item)}
                        disabled={processing}
                        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-amber-400 font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Guardar</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 4: DUPLICADOS EN BENEFICIARIOS / PACIENTES
         ===================================================================== */}
      {activeTab === 'pacientes' && (
        <div className="space-y-4">
          {patientDuplicates.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-3xl p-12 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl mx-auto flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-zinc-800 uppercase">
                ¡No se encontraron beneficiarios duplicados!
              </h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                El padrón de pacientes y familiares de clínica médica está limpio.
              </p>
            </div>
          ) : (
            patientDuplicates.map((group, idx) => {
              const currentMaster = selectedPatientMaster[group.key]
              return (
                <div
                  key={group.key}
                  className="bg-white border-2 border-rose-200 rounded-3xl p-5 shadow-xs space-y-4"
                >
                  <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
                    <h3 className="text-sm font-black text-zinc-900 uppercase">
                      Grupo Beneficiario #{idx + 1} ({group.items.length} Registros)
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {group.items.map((item) => {
                      const isMaster = String(item.id_paciente) === String(currentMaster)
                      return (
                        <div
                          key={item.id_paciente}
                          onClick={() =>
                            setSelectedPatientMaster((prev) => ({ ...prev, [group.key]: item.id_paciente }))
                          }
                          className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                            isMaster ? 'bg-emerald-50 border-emerald-500' : 'bg-zinc-50 border-zinc-200'
                          }`}
                        >
                          <div className="font-black text-sm uppercase text-zinc-900">{item._computedName}</div>
                          <div className="text-xs text-zinc-600 mt-1">
                            Parentesco: <strong>{item.parentesco || 'Beneficiario'}</strong> · Titular:{' '}
                            <strong>
                              {item.empleados
                                ? `${item.empleados.nombre || ''} ${item.empleados.apellido_paterno || ''}`
                                : 'General'}
                            </strong>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => handleMergePatientGroup(group)}
                      disabled={processing}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl cursor-pointer"
                    >
                      🔗 Unificar Beneficiarios
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
