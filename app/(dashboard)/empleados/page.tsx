'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import {
  Plus,
  Search,
  FileDown,
  Upload,
  Sparkles,
  QrCode,
  ShieldCheck,
  Home,
  FolderLock,
  ArrowLeftRight,
  Building2,
  AlertTriangle,
  UserCheck,
  HardHat,
  X,
  ExternalLink,
  Award,
} from 'lucide-react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { useAuth } from '@/components/AuthProvider'
import { TrayectoriaMinaHistorial } from '@/components/TrayectoriaMinaHistorial'
import {
  canonicalizeDepartment,
  matchesFlexiblePersonSearch,
  analyzeSingleEmployeeNameStructure,
  invertEmployeeNameFields,
  normalizeNameTokens,
  getEmployeeFullName,
  getEmployeeRegimenClassification,
  isTitularPatient,
  isMergedGhostEmployee,
} from '@/utils/dataNormalization'

export default function EmpleadosPage() {
  const { profile: authProfile } = useAuth()
  const [empleados, setEmpleados] = useState<any[]>([])
  const [pacientes, setPacientes] = useState<any[]>([])
  const [trayectoriaItems, setTrayectoriaItems] = useState<any[]>([])
  const [postulacionesTrayectoria, setPostulacionesTrayectoria] = useState<any[]>([])
  const [trayectoriaModalEmp, setTrayectoriaModalEmp] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Activo') // 'Todos', 'Activo', 'Baja'
  const [deptFilter, setDeptFilter] = useState('TODOS')
  const [regimenFilter, setRegimenFilter] = useState<
    'TODOS' | 'SEMANAL_SINDICATO' | 'SEMANAL_CONFIANZA' | 'QUINCENAL_CONFIANZA' | 'CON_BENEFICIARIOS'
  >('TODOS')
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const [canManage, setCanManage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  const canEvaluateTrayectoria = useMemo(() => {
    const rolUpper = (authProfile?.rol || '').toUpperCase()
    const isLeaderOrRh =
      rolUpper.includes('JEFE') ||
      rolUpper.includes('SUPERINTENDENTE') ||
      rolUpper.includes('SUPERVISOR') ||
      rolUpper.includes('ADMIN') ||
      rolUpper.includes('RECURSOS') ||
      rolUpper.includes('RH') ||
      rolUpper.includes('SISTEMAS')
    return canManage || isLeaderOrRh
  }, [canManage, authProfile?.rol])

  useEffect(() => {
    checkPermissions()
    fetchEmpleados()
  }, [])

  async function checkPermissions() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('perfiles')
          .select('rol, cat_departamentos(departamento)')
          .eq('id', user.id)
          .single()

        if (profile) {
          const role = (profile.rol || '').toUpperCase()
          const isAdmin =
            role.includes('ADMIN') ||
            role.includes('SISTEMAS') ||
            role.includes('RECURSOS HUMANOS') ||
            role.includes('RH')

          const deptAny = profile.cat_departamentos as any
          const deptRaw =
            deptAny?.departamento || (Array.isArray(deptAny) ? deptAny[0]?.departamento : '') || ''
          const isHRDept = canonicalizeDepartment(deptRaw).canonicalKey === 'RECURSOS_HUMANOS'

          setCanManage(isAdmin || isHRDept)
        }
      }
    } catch (e) {
      console.error('Error in checkPermissions:', e)
      setCanManage(false)
    }
  }

  async function fetchEmpleados() {
    setLoading(true)
    try {
      let empList: any[] = []
      const [fullRes, pacRes, trayRes, postRes] = await Promise.all([
        supabase
          .from('empleados')
          .select(`
            *,
            empleado_roles (
              fecha_inicio,
              cat_tipos_rol (tipo_rol, dias_trabajo, dias_descanso)
            ),
            empleado_adscripciones (
              id_departamento,
              cat_departamentos (id_departamento, departamento),
              cat_puestos (puesto)
            )
          `)
          .order('apellido_paterno', { ascending: true }),
        supabase
          .from('pacientes')
          .select('id_paciente, id_empleado, nombre_completo, parentesco')
          .order('nombre_completo', { ascending: true }),
        supabase
          .from('movimientos_historial_estancia')
          .select('id_historial, id_empleado, numero_empleado, nombre_completo, puesto_asignado, departamento_asignado, calificacion, dictamen, activo_en_puesto, fecha_inicio')
          .order('fecha_inicio', { ascending: false }),
        supabase
          .from('movimientos_postulantes')
          .select('id_postulacion, id_empleado, numero_empleado, nombre_completo, puesto_postulado, estatus_movimiento, autorizado_rh_local, autorizado_rh_corporativo, respuesta_depto_origen, movimientos_vacantes:id_vacante(puesto_vacante, departamento_destino)'),
      ])

      if (pacRes.data) setPacientes(pacRes.data)
      if (!trayRes.error && trayRes.data) setTrayectoriaItems(trayRes.data)
      if (!postRes.error && postRes.data) setPostulacionesTrayectoria(postRes.data)

      if (fullRes.error) {
        const baseRes = await supabase
          .from('empleados')
          .select('*')
          .order('apellido_paterno', { ascending: true })
        if (baseRes.data) empList = baseRes.data
      } else if (fullRes.data) {
        empList = fullRes.data
      }

      if (empList.length === 0) {
        await seedChoferesDirect()
        const retry = await supabase
          .from('empleados')
          .select('*')
          .order('apellido_paterno', { ascending: true })
        if (retry.data) empList = retry.data
      }

      setEmpleados(empList.filter((e) => !isMergedGhostEmployee(e)))
    } catch (error) {
      console.error('Error fetching empleados:', error)
    } finally {
      setLoading(false)
    }
  }

  async function seedChoferesDirect() {
    const choferesData = [
      { numero_empleado: 101, nombre: 'ADALBERTO', apellido_paterno: 'PINALES', puesto: 'Chofer', departamento: 'MOVILIDAD', estado_empleado: 'Activo' },
      { numero_empleado: 102, nombre: 'RAMON', apellido_paterno: 'YAÑEZ', puesto: 'Chofer', departamento: 'MOVILIDAD', estado_empleado: 'Activo' },
      { numero_empleado: 103, nombre: 'OSCAR', apellido_paterno: 'VAZQUEZ', puesto: 'Chofer', departamento: 'MOVILIDAD', estado_empleado: 'Activo' },
      { numero_empleado: 104, nombre: 'ENRIQUE', apellido_paterno: 'LINARES', puesto: 'Chofer', departamento: 'MOVILIDAD', estado_empleado: 'Activo' },
      { numero_empleado: 105, nombre: 'SAMUEL', apellido_paterno: 'MADRILES', puesto: 'Chofer', departamento: 'MOVILIDAD', estado_empleado: 'Activo' },
      { numero_empleado: 106, nombre: 'JESUS', apellido_paterno: 'SAUCEDO', puesto: 'Chofer', departamento: 'MOVILIDAD', estado_empleado: 'Activo' },
    ]

    for (const c of choferesData) {
      try {
        await supabase.from('empleados').insert([c])
      } catch (_) {}
    }
  }

  const getResolvedDepartment = (emp: any) => {
    const adsDept = emp?.empleado_adscripciones?.[0]?.cat_departamentos?.departamento
    const raw = emp?.departamento || adsDept || ''
    return canonicalizeDepartment(raw)
  }

  const getResolvedPuesto = (emp: any) => {
    const adsPuesto = emp?.empleado_adscripciones?.[0]?.cat_puestos?.puesto
    return emp?.puesto || adsPuesto || 'General'
  }

  // Clasificador Oficial Bacís de Nómina (Semanal / Quincenal) y Pertenencia Sindical (Sección 45 / Confianza)
  const getEmployeeRegimen = (emp: any) => {
    return getEmployeeRegimenClassification({
      ...emp,
      puesto: getResolvedPuesto(emp),
      departamento: getResolvedDepartment(emp).officialName,
    })
  }

  const beneficiariosByEmpleado = useMemo(() => {
    const map = new Map<string, any[]>()
    pacientes.forEach((p) => {
      if (!p.id_empleado || isTitularPatient(p)) return
      const key = String(p.id_empleado)
      const list = map.get(key) || []
      list.push(p)
      map.set(key, list)
    })
    return map
  }, [pacientes])

  // Cruzar historial de trayectoria y movimientos autorizados por trabajador
  const trayectoriaByEmpleado = useMemo(() => {
    const map = new Map<
      string,
      { count: number; latestScore: number | null; hasPendingAuth: boolean; pendingPuesto: string }
    >()

    const histByEmpId = new Map<string, any[]>()
    const histByNum = new Map<string, any[]>()
    const histByNameKey = new Map<string, any[]>()

    trayectoriaItems.forEach((h) => {
      if (h.id_empleado) {
        const k = String(h.id_empleado)
        const arr = histByEmpId.get(k) || []
        arr.push(h)
        histByEmpId.set(k, arr)
      }
      if (h.numero_empleado) {
        const k = String(h.numero_empleado).trim()
        if (k) {
          const arr = histByNum.get(k) || []
          arr.push(h)
          histByNum.set(k, arr)
        }
      }
      if (h.nombre_completo) {
        const k = normalizeNameTokens(h.nombre_completo).join('|')
        if (k) {
          const arr = histByNameKey.get(k) || []
          arr.push(h)
          histByNameKey.set(k, arr)
        }
      }
    })

    const postByEmpId = new Map<string, any[]>()
    const postByNum = new Map<string, any[]>()
    const postByNameKey = new Map<string, any[]>()

    postulacionesTrayectoria.forEach((p) => {
      if (p.id_empleado) {
        const k = String(p.id_empleado)
        const arr = postByEmpId.get(k) || []
        arr.push(p)
        postByEmpId.set(k, arr)
      }
      if (p.numero_empleado) {
        const k = String(p.numero_empleado).trim()
        if (k) {
          const arr = postByNum.get(k) || []
          arr.push(p)
          postByNum.set(k, arr)
        }
      }
      if (p.nombre_completo) {
        const k = normalizeNameTokens(p.nombre_completo).join('|')
        if (k) {
          const arr = postByNameKey.get(k) || []
          arr.push(p)
          postByNameKey.set(k, arr)
        }
      }
    })

    empleados.forEach((emp) => {
      const empId = String(emp.id_empleado)
      const num = emp.numero_empleado ? String(emp.numero_empleado).trim() : ''
      const nameKey = normalizeNameTokens(getEmployeeFullName(emp)).join('|')

      const hMatchesMap = new Map<string, any>()
      const addH = (arr?: any[]) => {
        ;(arr || []).forEach((item) => hMatchesMap.set(String(item.id_historial), item))
      }
      addH(histByEmpId.get(empId))
      if (num) addH(histByNum.get(num))
      if (nameKey) addH(histByNameKey.get(nameKey))

      const matchedHist = Array.from(hMatchesMap.values())
      const scored = matchedHist.find((m) => m.calificacion !== null && m.calificacion !== undefined)

      const pMatchesMap = new Map<string, any>()
      const addP = (arr?: any[]) => {
        ;(arr || []).forEach((item) => pMatchesMap.set(String(item.id_postulacion), item))
      }
      addP(postByEmpId.get(empId))
      if (num) addP(postByNum.get(num))
      if (nameKey) addP(postByNameKey.get(nameKey))

      const currentPuestoNorm = getResolvedPuesto(emp).trim().toLowerCase()
      let pendingAuthItem: any = null
      for (const p of Array.from(pMatchesMap.values())) {
        const isAuth =
          p.estatus_movimiento === 'Confirmado para Mover (SÍ)' ||
          p.estatus_movimiento === 'Autorizado para Movimiento' ||
          (p.autorizado_rh_local && p.autorizado_rh_corporativo && p.respuesta_depto_origen === 'Autorizado (Sí)')
        const vacRaw: any = p.movimientos_vacantes
        const vac: any = Array.isArray(vacRaw) ? vacRaw[0] || {} : vacRaw || {}
        const vacPuesto = vac.puesto_vacante || p.puesto_postulado || ''
        if (isAuth && vacPuesto && vacPuesto.trim().toLowerCase() !== currentPuestoNorm) {
          pendingAuthItem = { ...p, vacPuesto }
          break
        }
      }

      map.set(empId, {
        count: matchedHist.length,
        latestScore: scored ? Number(scored.calificacion) : null,
        hasPendingAuth: Boolean(pendingAuthItem),
        pendingPuesto: pendingAuthItem ? pendingAuthItem.vacPuesto : '',
      })
    })

    return map
  }, [empleados, trayectoriaItems, postulacionesTrayectoria])

  // Lista única de departamentos canónicos para el filtro
  const availableCanonicalDepts = useMemo(() => {
    const map = new Map<string, { key: string; name: string; count: number }>()
    empleados.forEach((emp) => {
      const info = getResolvedDepartment(emp)
      if (info.canonicalKey === 'SIN_ASIGNAR') return
      const prev = map.get(info.canonicalKey)
      if (prev) {
        prev.count += 1
      } else {
        map.set(info.canonicalKey, { key: info.canonicalKey, name: info.officialName, count: 1 })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [empleados])

  // Conteo rápido de alertas de duplicidad o nombres invertidos
  const duplicateAlertsSummary = useMemo(() => {
    const tokenCounts: Record<string, number> = {}
    let invertedCount = 0
    const rawDeptSet = new Set<string>()
    const canDeptSet = new Set<string>()

    empleados.forEach((emp) => {
      const tokens = normalizeNameTokens(getEmployeeFullName(emp))
      if (tokens.length >= 2) {
        const k = tokens.join('|')
        tokenCounts[k] = (tokenCounts[k] || 0) + 1
      }
      if (analyzeSingleEmployeeNameStructure(emp).isMalformed) {
        invertedCount++
      }
      if (emp.departamento) {
        rawDeptSet.add(emp.departamento.trim())
        canDeptSet.add(canonicalizeDepartment(emp.departamento).canonicalKey)
      }
    })

    const dupPersonGroups = Object.values(tokenCounts).filter((c) => c > 1).length
    const extraDeptVariants = Math.max(0, rawDeptSet.size - canDeptSet.size)

    return {
      dupPersonGroups,
      invertedCount,
      extraDeptVariants,
      totalIssues: dupPersonGroups + invertedCount + extraDeptVariants,
    }
  }, [empleados])

  const handleQuickInvertSingle = async (emp: any) => {
    const swapped = invertEmployeeNameFields({
      nombre: emp.nombre || '',
      apellido_paterno: emp.apellido_paterno || '',
      apellido_materno: emp.apellido_materno || '',
    })
    if (
      !confirm(
        `¿Invertir nombre de "${emp.nombre || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}" a:\n\nNombre(s): ${swapped.nombre}\nApellido Paterno: ${swapped.apellido_paterno}\nApellido Materno: ${swapped.apellido_materno}?`
      )
    ) {
      return
    }
    const { error } = await supabase
      .from('empleados')
      .update({
        nombre: swapped.nombre.toUpperCase(),
        apellido_paterno: swapped.apellido_paterno.toUpperCase(),
        apellido_materno: swapped.apellido_materno ? swapped.apellido_materno.toUpperCase() : null,
      })
      .eq('id_empleado', emp.id_empleado)

    if (!error) fetchEmpleados()
  }

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const regimenSummaryCounts = useMemo(() => {
    let semanalSindicato = 0
    let semanalConfianza = 0
    let quincenal = 0
    let conBeneficiarios = 0
    empleados.forEach((emp) => {
      const reg = getEmployeeRegimen(emp)
      if (reg.code === 'SEMANAL_SINDICATO') semanalSindicato++
      else if (reg.code === 'SEMANAL_CONFIANZA') semanalConfianza++
      else quincenal++
      if ((beneficiariosByEmpleado.get(String(emp.id_empleado)) || []).length > 0) {
        conBeneficiarios++
      }
    })
    return { semanalSindicato, semanalConfianza, quincenal, conBeneficiarios }
  }, [empleados, beneficiariosByEmpleado])

  const filteredEmpleados = useMemo(() => {
    return empleados
      .filter((emp) => {
        const matchesSearch = matchesFlexiblePersonSearch(
          {
            ...emp,
            departamento: getResolvedDepartment(emp).officialName,
            puesto: getResolvedPuesto(emp),
          },
          searchTerm
        )

        const empStatusUpper = (emp.estado_empleado || 'Activo').toUpperCase()
        const matchesStatus =
          statusFilter === 'Todos'
            ? true
            : statusFilter.toUpperCase() === 'BAJA'
            ? empStatusUpper === 'BAJA' || empStatusUpper === 'INACTIVO'
            : empStatusUpper === statusFilter.toUpperCase()

        const matchesDept =
          deptFilter === 'TODOS' ? true : getResolvedDepartment(emp).canonicalKey === deptFilter

        const reg = getEmployeeRegimen(emp)
        const bens = beneficiariosByEmpleado.get(String(emp.id_empleado)) || []
        const matchesRegimen =
          regimenFilter === 'TODOS'
            ? true
            : regimenFilter === 'CON_BENEFICIARIOS'
            ? bens.length > 0
            : reg.code === regimenFilter

        return matchesSearch && matchesStatus && matchesDept && matchesRegimen
      })
      .sort((a, b) => {
        if (!sortConfig) return 0
        const { key, direction } = sortConfig
        let valA = a[key] || ''
        let valB = b[key] || ''
        if (typeof valA === 'string') valA = valA.toLowerCase()
        if (typeof valB === 'string') valB = valB.toLowerCase()
        if (valA < valB) return direction === 'asc' ? -1 : 1
        if (valA > valB) return direction === 'asc' ? 1 : -1
        return 0
      })
  }, [empleados, searchTerm, statusFilter, deptFilter, regimenFilter, sortConfig, beneficiariosByEmpleado])

  const headers = [
    'Número',
    'Nombre',
    'Paterno',
    'Materno',
    'Departamento',
    'Puesto',
    'Sexo',
    'Fecha Nacimiento',
    'CURP',
    'RFC',
    'NSS',
    'Teléfono',
    'Email',
    'Estado Civil',
    'Tipo Residencia',
    'Número de Hijos',
    'Estado',
    'Foto URL',
  ]

  const exportToExcel = () => {
    if (filteredEmpleados.length === 0) return

    const data = filteredEmpleados.map((emp) => [
      emp.numero_empleado,
      emp.nombre,
      emp.apellido_paterno,
      emp.apellido_materno || '',
      getResolvedDepartment(emp).officialName,
      getResolvedPuesto(emp),
      emp.sexo || '',
      emp.fecha_nacimiento || '',
      emp.curp || '',
      emp.rfc || '',
      emp.nss || '',
      emp.telefono || '',
      emp.correo_electronico || '',
      emp.estado_civil || '',
      emp.tipo_residencia || '',
      emp.hijos_numero || 0,
      emp.estado_empleado,
      emp.foto_url || '',
    ])

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Empleados')
    XLSX.writeFile(workbook, `Directorio_Empleados.xlsx`)
  }

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([headers])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla')
    XLSX.writeFile(workbook, `Plantilla_Empleados.xlsx`)
  }

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(firstSheet)

        if (jsonData.length === 0) throw new Error('El archivo está vacío')

        // Huellas existentes para evitar duplicar nombres invertidos al importar
        const existingTokens = new Set(
          empleados
            .map((emp) => normalizeNameTokens(getEmployeeFullName(emp)).join('|'))
            .filter(Boolean)
        )
        const existingNumbers = new Set(
          empleados.map((emp) => String(emp.numero_empleado || '')).filter(Boolean)
        )

        let skippedDuplicates = 0
        const nuevosEmpleados: any[] = []

        jsonData.forEach((row: any) => {
          const num = parseInt(row['Número'] || row['Numero'])
          const rawNom = String(row['Nombre'] || '').trim()
          const rawPat = String(row['Paterno'] || '').trim()
          const rawMat = String(row['Materno'] || '').trim()
          const rawDepto = String(row['Departamento'] || row['Área'] || row['Area'] || '').trim()
          const rawPuesto = String(row['Puesto'] || row['Categoría'] || '').trim()

          if (!num || !rawNom) return

          // Si metieron todo en Nombre o invertido, auto-analizar
          const analysis = analyzeSingleEmployeeNameStructure({
            nombre: rawNom,
            apellido_paterno: rawPat,
            apellido_materno: rawMat,
          })

          const finalNom = (analysis.isMalformed ? analysis.suggestedNombre : rawNom).toUpperCase()
          const finalPat = (analysis.isMalformed ? analysis.suggestedPaterno : rawPat).toUpperCase()
          const finalMat = (analysis.isMalformed ? analysis.suggestedMaterno : rawMat).toUpperCase() || null

          const tokenKey = normalizeNameTokens(`${finalNom} ${finalPat} ${finalMat || ''}`).join('|')
          if (existingNumbers.has(String(num)) || (tokenKey && existingTokens.has(tokenKey))) {
            skippedDuplicates++
            return
          }

          existingNumbers.add(String(num))
          if (tokenKey) existingTokens.add(tokenKey)

          const canDept = canonicalizeDepartment(rawDepto)

          nuevosEmpleados.push({
            numero_empleado: num,
            nombre: finalNom,
            apellido_paterno: finalPat,
            apellido_materno: finalMat,
            departamento: canDept.canonicalKey !== 'SIN_ASIGNAR' ? canDept.officialName : null,
            puesto: rawPuesto ? rawPuesto.toUpperCase() : null,
            sexo: row['Sexo'] || null,
            fecha_nacimiento:
              row['Fecha Nacimiento'] || row['Fecha de Nacimiento']
                ? new Date(row['Fecha Nacimiento'] || row['Fecha de Nacimiento']).toISOString().split('T')[0]
                : null,
            curp: row['CURP'] ? String(row['CURP']).toUpperCase() : null,
            rfc: row['RFC'] ? String(row['RFC']).toUpperCase() : null,
            nss: row['NSS'] ? String(row['NSS']) : null,
            telefono: row['Teléfono'] || row['Telefono'] || null,
            correo_electronico: row['Email'] || row['Correo'] || null,
            estado_civil: row['Estado Civil'] || null,
            tipo_residencia: row['Tipo Residencia'] || null,
            hijos_numero: parseInt(row['Número de Hijos'] || row['Hijos'] || '0'),
            estado_empleado: row['Estado'] || 'Activo',
            foto_url: row['Foto URL'] || null,
          })
        })

        if (nuevosEmpleados.length === 0) {
          throw new Error(
            skippedDuplicates > 0
              ? `No se importaron registros nuevos porque los ${skippedDuplicates} trabajadores del archivo ya existen en el padrón.`
              : 'No se encontraron registros válidos. Columnas obligatorias: Número, Nombre.'
          )
        }

        const { error } = await supabase.from('empleados').insert(nuevosEmpleados)
        if (error) throw error

        alert(
          `Se importaron ${nuevosEmpleados.length} empleados correctamente (con departamentos y nombres normalizados).${
            skippedDuplicates > 0 ? `\nSe omitieron ${skippedDuplicates} duplicados detectados.` : ''
          }`
        )
        fetchEmpleados()
      } catch (err: any) {
        alert('Error al importar: ' + err.message)
      } finally {
        setImporting(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-20">
      {/* HEADER RESPONSIVO UNIFORME */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">
            Directorio General de Empleados
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Padrón conectado con Trayectoria en Mina y Escalafón, Inducción, Campamentos, Lockers QR, Credenciales y Depuración de Duplicados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImportExcel}
          />
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center px-3 py-2 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-700 bg-white hover:bg-zinc-50 cursor-pointer"
            title="Descargar Plantilla Vacía"
          >
            Plantilla Excel
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {importing ? 'Importando...' : 'Importar Excel'}
          </button>
          <button
            onClick={exportToExcel}
            className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
          >
            <FileDown className="mr-1.5 h-4 w-4" />
            Exportar
          </button>
          <Link
            href="/empleados/credenciales"
            className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-black text-white bg-zinc-900 hover:bg-zinc-800"
          >
            <QrCode className="mr-1.5 h-4 w-4 text-amber-400" />
            Credenciales QR
          </Link>
          <Link
            href="/empleados/duplicados"
            className="inline-flex items-center px-3.5 py-2 border-2 border-amber-400 rounded-xl text-xs font-black text-zinc-950 bg-amber-400 hover:bg-amber-300 shadow-xs"
          >
            <Sparkles className="mr-1.5 h-4 w-4 text-zinc-950" />
            <span>Depurar Duplicados / Deptos</span>
            {duplicateAlertsSummary.totalIssues > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-zinc-950 text-amber-400 text-[10px]">
                {duplicateAlertsSummary.totalIssues}
              </span>
            )}
          </Link>
          <Link
            href="/empleados/nuevo"
            className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-black text-amber-400 bg-zinc-950 hover:bg-zinc-800 shadow-sm"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Nuevo Empleado
          </Link>
        </div>
      </div>

      {/* BANNER DE ALERTA SI HAY DEPARTAMENTOS O NOMBRES DUPLICADOS/INVERTIDOS */}
      {duplicateAlertsSummary.totalIssues > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500 text-zinc-950 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-xs">
              <p className="font-black text-zinc-900 uppercase">
                Atención: Se detectaron posibles duplicidades o nombres invertidos en el padrón
              </p>
              <p className="text-zinc-700 mt-0.5">
                {duplicateAlertsSummary.dupPersonGroups > 0 && (
                  <span className="mr-3">
                    • <strong>{duplicateAlertsSummary.dupPersonGroups}</strong> grupos de personas duplicadas (ej. Nombre Invertido)
                  </span>
                )}
                {duplicateAlertsSummary.invertedCount > 0 && (
                  <span className="mr-3">
                    • <strong>{duplicateAlertsSummary.invertedCount}</strong> registros con apellidos en campo Nombre
                  </span>
                )}
                {duplicateAlertsSummary.extraDeptVariants > 0 && (
                  <span>
                    • <strong>{duplicateAlertsSummary.extraDeptVariants}</strong> variantes de departamento (ej. RH / Recursos Humanos)
                  </span>
                )}
              </p>
            </div>
          </div>
          <Link
            href="/empleados/duplicados"
            className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-amber-400 font-black text-xs rounded-xl shrink-0"
          >
            Ir al Centro de Unificación &rarr;
          </Link>
        </div>
      )}

      {/* TARJETAS INTERACTIVAS DE RÉGIMEN: SEMANALES (SINDICATO), SEMANALES (CONFIANZA), QUINCENALES (CONFIANZA) Y BENEFICIARIOS */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setRegimenFilter('TODOS')}
          className={`card-interactive p-3.5 rounded-2xl border-2 text-left cursor-pointer transition-all ${
            regimenFilter === 'TODOS'
              ? 'bg-zinc-900 text-white border-amber-500 shadow-md'
              : 'bg-white text-zinc-900 border-zinc-200 hover:border-zinc-300'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-500 block">
            1. Padrón Total
          </span>
          <div className="text-2xl font-black mt-1">{empleados.length}</div>
          <span className="text-[11px] font-semibold opacity-75">Todos los trabajadores</span>
        </button>

        <button
          type="button"
          onClick={() => setRegimenFilter('SEMANAL_SINDICATO')}
          className={`card-interactive p-3.5 rounded-2xl border-2 text-left cursor-pointer transition-all ${
            regimenFilter === 'SEMANAL_SINDICATO'
              ? 'bg-zinc-900 text-white border-amber-500 shadow-md'
              : 'bg-white text-zinc-900 border-zinc-200 hover:border-amber-300'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 block">
            2. Semanal Sindicato
          </span>
          <div className="text-2xl font-black mt-1">{regimenSummaryCounts.semanalSindicato}</div>
          <span className="text-[11px] font-semibold opacity-75">🗓️ Secc. 45 / Operativos</span>
        </button>

        <button
          type="button"
          onClick={() => setRegimenFilter('SEMANAL_CONFIANZA')}
          className={`card-interactive p-3.5 rounded-2xl border-2 text-left cursor-pointer transition-all ${
            regimenFilter === 'SEMANAL_CONFIANZA'
              ? 'bg-zinc-900 text-white border-emerald-500 shadow-md'
              : 'bg-white text-zinc-900 border-zinc-200 hover:border-emerald-300'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block">
            3. Semanal Confianza
          </span>
          <div className="text-2xl font-black mt-1">{regimenSummaryCounts.semanalConfianza}</div>
          <span className="text-[11px] font-semibold opacity-75">🗓️ Confianza semanal</span>
        </button>

        <button
          type="button"
          onClick={() => setRegimenFilter('QUINCENAL_CONFIANZA')}
          className={`card-interactive p-3.5 rounded-2xl border-2 text-left cursor-pointer transition-all ${
            regimenFilter === 'QUINCENAL_CONFIANZA'
              ? 'bg-zinc-900 text-white border-indigo-500 shadow-md'
              : 'bg-white text-zinc-900 border-zinc-200 hover:border-indigo-300'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 block">
            4. Quincenal Confianza
          </span>
          <div className="text-2xl font-black mt-1">{regimenSummaryCounts.quincenal}</div>
          <span className="text-[11px] font-semibold opacity-75">📆 Directivos / Staff</span>
        </button>

        <button
          type="button"
          onClick={() => setRegimenFilter('CON_BENEFICIARIOS')}
          className={`card-interactive p-3.5 rounded-2xl border-2 text-left cursor-pointer transition-all ${
            regimenFilter === 'CON_BENEFICIARIOS'
              ? 'bg-zinc-900 text-white border-rose-500 shadow-md'
              : 'bg-white text-zinc-900 border-zinc-200 hover:border-rose-300'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 block">
            5. Con Beneficiarios
          </span>
          <div className="text-2xl font-black mt-1">{regimenSummaryCounts.conBeneficiarios}</div>
          <span className="text-[11px] font-semibold opacity-75">👨‍👩‍👧‍👦 En Clínica ({pacientes.length})</span>
        </button>
      </div>

      {/* BARRA DE BÚSQUEDA INTELIGENTE (ENCUENTRA NOMBRES INVERTIDOS) Y FILTROS */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs">
        <div className="md:col-span-6 relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-zinc-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 text-xs font-bold border border-zinc-300 rounded-xl focus:ring-amber-500 focus:border-amber-500"
            placeholder="Buscar por nombre o apellido en cualquier orden (ej. Jose Arana o Arana Jose), ficha, CURP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="md:col-span-4">
          <select
            className="block w-full px-3 py-2 text-xs font-bold border border-zinc-300 rounded-xl"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="TODOS">🏢 Todos los Departamentos (Unificados)</option>
            {availableCanonicalDepts.map((d) => (
              <option key={d.key} value={d.key}>
                {d.name} ({d.count})
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            className="block w-full px-3 py-2 text-xs font-bold border border-zinc-300 rounded-xl"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="Activo">🟢 Activos</option>
            <option value="Baja">🔴 Bajas</option>
            <option value="Todos">📋 Todos ({empleados.length})</option>
          </select>
        </div>
      </div>

      {/* TABLA RESPONSIVA DE EMPLEADOS */}
      <div className="rounded-2xl bg-white shadow-xs border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-zinc-500 cursor-pointer hover:bg-zinc-100"
                  onClick={() => handleSort('nombre')}
                >
                  Trabajador {sortConfig?.key === 'nombre' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-zinc-500"
                >
                  Departamento / Puesto
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-zinc-500"
                >
                  Régimen &amp; Beneficiarios
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-zinc-500"
                >
                  Estado
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-zinc-500"
                >
                  Flujo Conectado &amp; Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-xs font-bold text-zinc-500">
                    Cargando padrón de empleados...
                  </td>
                </tr>
              ) : filteredEmpleados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-xs font-bold text-zinc-500">
                    No se encontraron empleados con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredEmpleados.map((empleado) => {
                  const roles = empleado.empleado_roles || []
                  const activeRole = roles.sort(
                    (a: any, b: any) =>
                      new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime()
                  )[0]

                  const deptInfo = getResolvedDepartment(empleado)
                  const puestoName = getResolvedPuesto(empleado)
                  const regimenInfo = getEmployeeRegimen(empleado)
                  const empBeneficiarios = beneficiariosByEmpleado.get(String(empleado.id_empleado)) || []
                  const nameStructure = analyzeSingleEmployeeNameStructure(empleado)
                  const initial1 = (empleado.nombre || '?').charAt(0).toUpperCase()
                  const initial2 = (empleado.apellido_paterno || '').charAt(0).toUpperCase()

                  return (
                    <tr key={empleado.id_empleado} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 shrink-0 rounded-xl bg-zinc-900 text-amber-400 flex items-center justify-center font-black text-xs border border-zinc-700">
                            {initial1}
                            {initial2}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/empleados/${empleado.id_empleado}`}
                                className="text-xs font-black text-zinc-900 hover:text-amber-600 uppercase"
                              >
                                {empleado.nombre} {empleado.apellido_paterno} {empleado.apellido_materno || ''}
                              </Link>
                              {nameStructure.isMalformed && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickInvertSingle(empleado)}
                                  className="px-2 py-0.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                                  title={nameStructure.reason}
                                >
                                  <ArrowLeftRight className="w-3 h-3" />
                                  <span>⇄ Invertir</span>
                                </button>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-zinc-500 font-bold">
                              Ficha #{empleado.numero_empleado || 'S/N'}
                              {empleado.telefono ? ` · 📞 ${empleado.telefono}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-zinc-900 uppercase">
                            <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>{deptInfo.officialName}</span>
                          </span>
                          <span className="text-[11px] text-zinc-500 font-semibold">{puestoName}</span>
                          {(() => {
                            const tInfo = trayectoriaByEmpleado.get(String(empleado.id_empleado))
                            if (!tInfo) return null
                            if (tInfo.hasPendingAuth) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => setTrayectoriaModalEmp(empleado)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 cursor-pointer"
                                  title="Movimiento autorizado pendiente de aplicar al expediente"
                                >
                                  <span>🎉 Ascenso Autorizado: {tInfo.pendingPuesto}</span>
                                </button>
                              )
                            }
                            if (tInfo.count > 0) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => setTrayectoriaModalEmp(empleado)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 cursor-pointer"
                                  title="Ver trayectoria en mina y evaluaciones"
                                >
                                  <span>
                                    ♟️ {tInfo.count} {tInfo.count === 1 ? 'etapa' : 'etapas'}
                                  </span>
                                  {tInfo.latestScore !== null && (
                                    <span>· ⭐ {tInfo.latestScore.toFixed(1)}</span>
                                  )}
                                </button>
                              )
                            }
                            return null
                          })()}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black border ${regimenInfo.badgeClass}`}
                            >
                              {regimenInfo.label}
                            </span>
                            {activeRole?.cat_tipos_rol && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                {activeRole.cat_tipos_rol.tipo_rol}
                              </span>
                            )}
                          </div>
                          <Link
                            href="/medico/pacientes"
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors ${
                              empBeneficiarios.length > 0
                                ? 'bg-rose-50 text-rose-900 border-rose-200 hover:bg-rose-100'
                                : 'bg-zinc-50 text-zinc-400 border-zinc-200 hover:text-zinc-700'
                            }`}
                            title={
                              empBeneficiarios.length > 0
                                ? empBeneficiarios
                                    .map((b) => `${b.nombre_completo} (${b.parentesco || 'Familiar'})`)
                                    .join(', ')
                                : 'Vincular beneficiarios en Clínica Médica'
                            }
                          >
                            👨‍👩‍👧‍👦 {empBeneficiarios.length} Beneficiario(s)
                            {empBeneficiarios.length > 0
                              ? `: ${empBeneficiarios[0].nombre_completo.split(' ').slice(0, 2).join(' ')}${
                                  empBeneficiarios.length > 1 ? ` +${empBeneficiarios.length - 1}` : ''
                                }`
                              : ''}
                          </Link>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                            (empleado.estado_empleado || 'Activo').toUpperCase() === 'ACTIVO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {empleado.estado_empleado || 'Activo'}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <Link
                            href={`/empleados/${empleado.id_empleado}`}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-black"
                            title="Ver Expediente Completo"
                          >
                            Expediente
                          </Link>
                          <button
                            type="button"
                            onClick={() => setTrayectoriaModalEmp(empleado)}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[11px] font-black inline-flex items-center gap-1 cursor-pointer shadow-xs"
                            title="Ver o evaluar Trayectoria en Mina, Puestos y Escalafón"
                          >
                            <span>♟️ Trayectoria</span>
                          </button>
                          <Link
                            href={`/seguridad?emp=${empleado.id_empleado}`}
                            className="p-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200"
                            title="Enviar a Inducción de Seguridad Industrial"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </Link>
                          <Link
                            href={`/campamentos?emp=${empleado.id_empleado}`}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                            title="Asignar Cama en Campamento"
                          >
                            <Home className="w-3.5 h-3.5" />
                          </Link>
                          <Link
                            href={`/lockers?emp=${empleado.id_empleado}`}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
                            title="Asignar Casillero / Locker QR"
                          >
                            <FolderLock className="w-3.5 h-3.5" />
                          </Link>
                          <Link
                            href={`/empleados/credenciales?emp=${empleado.id_empleado}`}
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300"
                            title="Imprimir Credencial QR"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL DE TRAYECTORIA EN MINA DESDE DIRECTORIO DE EMPLEADOS            */}
      {/* ===================================================================== */}
      {trayectoriaModalEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white w-full max-w-5xl rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 bg-zinc-950 text-white border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500 text-zinc-950 shadow-sm">
                  <HardHat className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                    Directorio de Empleados · Historial y Escalafón
                  </span>
                  <h3 className="font-black text-base sm:text-lg uppercase">
                    {trayectoriaModalEmp.nombre} {trayectoriaModalEmp.apellido_paterno}{' '}
                    {trayectoriaModalEmp.apellido_materno || ''}
                  </h3>
                  <p className="text-xs text-zinc-400 font-semibold">
                    Ficha #{trayectoriaModalEmp.numero_empleado || 'S/N'} ·{' '}
                    {getResolvedDepartment(trayectoriaModalEmp).officialName} ·{' '}
                    {getResolvedPuesto(trayectoriaModalEmp)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Link
                  href={`/empleados/${trayectoriaModalEmp.id_empleado}?tab=trayectoria`}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs inline-flex items-center gap-1.5"
                >
                  <span>Abrir Expediente Completo</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => setTrayectoriaModalEmp(null)}
                  className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                  aria-label="Cerrar modal de trayectoria"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto flex-1">
              <TrayectoriaMinaHistorial
                viewerMode="admin"
                idEmpleado={trayectoriaModalEmp.id_empleado}
                numeroEmpleado={trayectoriaModalEmp.numero_empleado}
                nombreEmpleado={`${trayectoriaModalEmp.nombre} ${trayectoriaModalEmp.apellido_paterno} ${trayectoriaModalEmp.apellido_materno || ''}`.trim()}
                puestoActual={getResolvedPuesto(trayectoriaModalEmp)}
                departamentoActual={getResolvedDepartment(trayectoriaModalEmp).officialName}
                fechaIngreso={trayectoriaModalEmp.fecha_ingreso}
                canManage={canEvaluateTrayectoria}
                currentUserRole={authProfile?.rol || 'Recursos Humanos'}
                currentUserName={authProfile?.nombre_completo || 'Recursos Humanos'}
                onPuestoActualizado={(np, nd) => {
                  setTrayectoriaModalEmp((prev: any) => (prev ? { ...prev, puesto: np, departamento: nd } : prev))
                  fetchEmpleados()
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
