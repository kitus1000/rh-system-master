'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { 
  Home, Plus, Bed, Trash2, UserPlus, Search, Building, MapPin, 
  CheckCircle, AlertTriangle, ChevronRight, Sparkles, Activity, ShieldCheck,
  Box, Eye, Layers, RotateCw, User, Calendar, Clock, RefreshCw, X,
  Shirt, Sparkles as SparklesIcon, Zap, Settings, ShieldAlert, Move, ZoomIn, Info,
  BarChart3, ChevronLeft, ArrowRight, CheckCircle2, Sliders, CalendarDays,
  HardHat, UserCheck, Repeat, UserPlus2
} from 'lucide-react'

interface Persona {
  id_empleado: string
  nombre: string
  apellido_paterno: string
  apellido_materno?: string
  puesto?: string
  departamento?: string
  numero_empleado?: number | string
  rol_tipo?: string // '20x10', '14x7', '10x5', '6x1', 'Contratista'
  fecha_inicio_rol?: string
  es_contratista?: boolean
  dias_estadia?: number
}

interface Cama {
  id_cama: string
  numero: number
  id_empleado: string | null
  estatus_lavado: 'Entregado' | 'En Lavandería'
  empleados: Persona | null
}

interface Cuarto {
  id_cuarto: string
  nombre: string
  estatus_limpieza: 'Limpio' | 'Sucio' | 'En Limpieza'
  campamento_camas: Cama[]
}

interface Campamento {
  id_campamento: string
  nombre: string
  ubicacion: string
  zona?: 'Parajes' | 'Zona Norte' | string
  tipo: 'General' | 'Contratistas' | 'Staff' | 'Supervisores' | string
  campamento_cuartos: Cuarto[]
}

export default function CampamentosPage() {
  const [campamentos, setCampamentos] = useState<Campamento[]>([])
  const [empleados, setEmpleados] = useState<Persona[]>([])
  const [contratistasHistorial, setContratistasHistorial] = useState<Persona[]>([])
  const [selectedCampamento, setSelectedCampamento] = useState<Campamento | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  
  // Filtro por Zona Minera: 'TODAS' | 'Parajes' | 'Zona Norte'
  const [selectedZona, setSelectedZona] = useState<'TODAS' | 'Parajes' | 'Zona Norte'>('TODAS')

  // Vistas: '3d' (Visor WebGL 3D Real), 'gantt' (Diagrama de Gantt / Cronograma), 'tabla' (Gestión Operativa), 'contratistas' (Historial Contratistas)
  const [viewMode, setViewMode] = useState<'3d' | 'gantt' | 'tabla' | 'contratistas'>('3d')

  // Gantt Timeline Selected Month & Year
  const [ganttDate, setGanttDate] = useState<Date>(new Date(2026, 7, 1)) // August 2026

  // Incidencias (Incapacidad, Vacaciones, Permisos, Faltas)
  const [incidencias, setIncidencias] = useState<any[]>([])
  const [tiposIncidencia, setTiposIncidencia] = useState<any[]>([])
  const [showIncidenciaModal, setShowIncidenciaModal] = useState(false)
  const [incidenciaForm, setIncidenciaForm] = useState({
    id_empleado: '',
    id_tipo_incidencia: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    dias: 1,
    comentarios: ''
  })
  const [savingIncidencia, setSavingIncidencia] = useState(false)

  // Ocupante / Cuarto Seleccionado para Modal Holográfico 3D
  const [selectedRoom3D, setSelectedRoom3D] = useState<Cuarto | null>(null)
  const [selectedBed3D, setSelectedBed3D] = useState<{ room: Cuarto, bed?: Cama } | null>(null)

  // Modales/Form states
  const [showAddCampModal, setShowAddCampModal] = useState(false)
  const [newCampName, setNewCampName] = useState('')
  const [newCampUbi, setNewCampUbi] = useState('')
  const [newCampZona, setNewCampZona] = useState<'Parajes' | 'Zona Norte'>('Parajes')
  const [newCampTipo, setNewCampTipo] = useState('General')

  // Edit Campamento state
  const [editingCamp, setEditingCamp] = useState<Campamento | null>(null)
  const [editingCampForm, setEditingCampForm] = useState({
    nombre: '',
    ubicacion: '',
    zona: 'Parajes' as 'Parajes' | 'Zona Norte',
    tipo: 'General'
  })
  const [savingEditCamp, setSavingEditCamp] = useState(false)

  const [showAddRoomModal, setShowAddRoomModal] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomCamas, setNewRoomCamas] = useState(2)

  // Modal para alta directa de contratista
  const [showAddContratistaModal, setShowAddContratistaModal] = useState(false)
  const [contratistaForm, setContratistaForm] = useState({
    nombre: '',
    apellido_paterno: '',
    apellido_materno: '',
    empresa_puesto: 'Contratista Minero',
    dias_estadia: 3,
    fecha_llegada: new Date().toISOString().split('T')[0],
    id_campamento: '',
    id_cuarto: '',
    id_cama: ''
  })
  const [savingContratista, setSavingContratista] = useState(false)

  // Modal para asignar cama a un contratista existente
  const [assigningBedContractor, setAssigningBedContractor] = useState<Persona | null>(null)
  const [quickAssignCampId, setQuickAssignCampId] = useState('')
  const [quickAssignRoomId, setQuickAssignRoomId] = useState('')
  const [quickAssignBedId, setQuickAssignBedId] = useState('')

  // Modal para configurar rol de trabajador
  const [editingRoleWorker, setEditingRoleWorker] = useState<Persona | null>(null)
  const [roleForm, setRoleForm] = useState({
    rol_tipo: '20x10',
    fecha_inicio_rol: new Date().toISOString().split('T')[0]
  })
  const [savingRole, setSavingRole] = useState(false)

  // Assignment state
  const [assignmentTarget, setAssignmentTarget] = useState<{ id_cama: string, numero: number } | null>(null)
  const [assignmentSearch, setAssignmentSearch] = useState('')

  // Canvas 3D Ref
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchData()
    fetchEmpleados()
    fetchIncidencias()
  }, [])

  // LocalStorage helpers for worker shift roles when DB columns are absent
  const saveWorkerRoleToLocal = (id_empleado: string, rol_tipo: string, fecha_inicio_rol: string) => {
    try {
      const stored = JSON.parse(localStorage.getItem('minera_roles_storage') || '{}')
      stored[id_empleado] = { rol_tipo, fecha_inicio_rol }
      localStorage.setItem('minera_roles_storage', JSON.stringify(stored))
    } catch (e) {
      console.warn('LocalStorage error:', e)
    }
  }

  const getWorkerRoleFromLocal = (id_empleado: string) => {
    try {
      const stored = JSON.parse(localStorage.getItem('minera_roles_storage') || '{}')
      return stored[id_empleado]
    } catch (e) {
      return null
    }
  }

  const getMergedWorkerInfo = (emp: any) => {
    if (!emp) return null
    const localRole = getWorkerRoleFromLocal(emp.id_empleado)
    return {
      ...emp,
      rol_tipo: localRole?.rol_tipo || emp.rol_tipo || '20x10',
      fecha_inicio_rol: localRole?.fecha_inicio_rol || emp.fecha_inicio_rol || '2026-08-01',
      es_contratista: Boolean(
        localRole?.rol_tipo === 'Contratista' || 
        emp.es_contratista || 
        (emp.departamento || '').toLowerCase().includes('contratista') || 
        (emp.puesto || '').toLowerCase().includes('contratista')
      )
    }
  }

  // Helper to detect zone from campamento data
  const detectZona = (camp: any): string => {
    const textToSearch = `${camp.nombre || ''} ${camp.ubicacion || ''}`.toLowerCase()
    if (textToSearch.includes('norte')) return 'Zona Norte'
    if (textToSearch.includes('paraje')) return 'Parajes'
    if (camp.zona && (camp.zona === 'Zona Norte' || camp.zona === 'Parajes')) return camp.zona
    return 'Parajes' // default
  }

  const processCampamentos = (rawData: any[]): Campamento[] => {
    return rawData.map((camp: any) => ({
      ...camp,
      zona: detectZona(camp),
      campamento_cuartos: (camp.campamento_cuartos || [])
        .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' }))
        .map((q: any) => ({
          ...q,
          campamento_camas: (q.campamento_camas || [])
            .sort((a: any, b: any) => a.numero - b.numero)
            .map((cama: any) => ({
              ...cama,
              empleados: getMergedWorkerInfo(cama.empleados)
            }))
        }))
    }))
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      let rawData: any[] = []
      
      // Query campamentos with base empleados columns (guaranteed not to throw 400 on missing optional columns)
      const fullQuery = await (supabase.from('campamentos') as any)
        .select(`
          id_campamento, nombre, ubicacion, zona, tipo,
          campamento_cuartos (
            id_cuarto, nombre, estatus_limpieza,
            campamento_camas (
              id_cama, numero, estatus_lavado, id_empleado,
              empleados ( id_empleado, nombre, apellido_paterno, apellido_materno, puesto, departamento, numero_empleado )
            )
          )
        `)
        .order('id_campamento')

      if (fullQuery.error) {
        console.warn('Full query failed, fallback without zona:', fullQuery.error.message)
        const fallback = await (supabase.from('campamentos') as any)
          .select(`
            id_campamento, nombre, ubicacion, tipo,
            campamento_cuartos (
              id_cuarto, nombre, estatus_limpieza,
              campamento_camas (
                id_cama, numero, estatus_lavado, id_empleado,
                empleados ( id_empleado, nombre, apellido_paterno, apellido_materno, puesto, departamento, numero_empleado )
              )
            )
          `)
          .order('id_campamento')

        if (fallback.error) throw fallback.error
        rawData = fallback.data || []
      } else {
        rawData = fullQuery.data || []
      }

      const processed = processCampamentos(rawData)
      setCampamentos(processed)
      
      if (processed.length > 0) {
        setSelectedCampamento(prev => {
          const stillExists = processed.find((c: Campamento) => c.id_campamento === prev?.id_campamento)
          return stillExists || processed[0]
        })
      }
    } catch (err: any) {
      console.error('Error fetching campamentos:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchEmpleados = async () => {
    try {
      // First try fetching with extended columns
      const fullRes = await supabase
        .from('empleados')
        .select('id_empleado, nombre, apellido_paterno, apellido_materno, puesto, departamento, numero_empleado, rol_tipo, fecha_inicio_rol, es_contratista')
        .eq('estado_empleado', 'Activo')
        .order('nombre')

      let allEmps: any[] = []

      if (fullRes.error) {
        console.warn('Extended empleados select failed, fallback to base columns:', fullRes.error.message)
        // Fallback to base columns guaranteed to exist
        const baseRes = await supabase
          .from('empleados')
          .select('id_empleado, nombre, apellido_paterno, apellido_materno, puesto, departamento, numero_empleado')
          .eq('estado_empleado', 'Activo')
          .order('nombre')

        if (baseRes.error) throw baseRes.error
        allEmps = (baseRes.data || []).map((e: any) => getMergedWorkerInfo(e))
      } else {
        allEmps = (fullRes.data || []).map((e: any) => getMergedWorkerInfo(e))
      }

      setEmpleados(allEmps)

      const contratistas = allEmps.filter(e => e.es_contratista || (e.departamento || '').toLowerCase().includes('contratista') || (e.puesto || '').toLowerCase().includes('contratista') || e.rol_tipo === 'Contratista')
      setContratistasHistorial(contratistas)
    } catch (err: any) {
      console.error('Error fetching empleados:', err)
    }
  }

  const fetchIncidencias = async () => {
    try {
      const { data: incData, error: incErr } = await supabase
        .from('empleado_incidencias')
        .select(`
          *,
          cat_tipos_incidencia ( id_tipo_incidencia, tipo_incidencia )
        `)
        .order('fecha_inicio', { ascending: false })

      if (incData) {
        setIncidencias(incData)
      } else if (incErr) {
        console.warn('empleado_incidencias query note:', incErr.message)
      }

      const { data: tiposData } = await supabase
        .from('cat_tipos_incidencia')
        .select('*')
        .eq('activo', true)
        .order('tipo_incidencia')

      if (tiposData) {
        setTiposIncidencia(tiposData)
      }
    } catch (err: any) {
      console.error('Error fetching incidencias:', err)
    }
  }

  const getIncidenciaForEmpAndDay = (idEmpleado?: string, day?: Date) => {
    if (!idEmpleado || !day) return null
    const y = day.getFullYear()
    const m = String(day.getMonth() + 1).padStart(2, '0')
    const d = String(day.getDate()).padStart(2, '0')
    const dayStr = `${y}-${m}-${d}`

    return incidencias.find(inc => {
      if (inc.id_empleado !== idEmpleado) return false
      const ini = inc.fecha_inicio ? inc.fecha_inicio.split('T')[0] : ''
      const fin = inc.fecha_fin ? inc.fecha_fin.split('T')[0] : ini
      return dayStr >= ini && dayStr <= fin
    })
  }

  const getIncidenciaMeta = (inc: any) => {
    if (!inc) return null
    const tipoStr = (inc.cat_tipos_incidencia?.tipo_incidencia || inc.tipo || '').toLowerCase()

    if (tipoStr.includes('incapacidad') || tipoStr.includes('salud') || tipoStr.includes('accidente') || tipoStr.includes('médic')) {
      return {
        code: 'INC',
        label: 'Incapacidad Médica',
        bgClass: 'bg-rose-500 text-white border border-rose-600 font-black',
        icon: '🩹'
      }
    }
    if (tipoStr.includes('vacacio') || tipoStr.includes('vacaciones')) {
      return {
        code: 'VAC',
        label: 'Vacaciones',
        bgClass: 'bg-sky-500 text-white border border-sky-600 font-black',
        icon: '🏖️'
      }
    }
    if (tipoStr.includes('permiso') || tipoStr.includes('salida') || tipoStr.includes('personal')) {
      return {
        code: 'PER',
        label: 'Permiso / Salida',
        bgClass: 'bg-purple-600 text-white border border-purple-700 font-black',
        icon: '📄'
      }
    }
    if (tipoStr.includes('descanso') || tipoStr.includes('franco especial') || tipoStr.includes('goce')) {
      return {
        code: 'DES',
        label: 'Descanso Especial',
        bgClass: 'bg-amber-500 text-black border border-amber-600 font-black',
        icon: '🛌'
      }
    }
    if (tipoStr.includes('falta') || tipoStr.includes('inasistencia') || tipoStr.includes('ausencia')) {
      return {
        code: 'FAL',
        label: 'Falta / Ausencia',
        bgClass: 'bg-red-800 text-white border border-red-900 font-black',
        icon: '❌'
      }
    }

    return {
      code: 'INC',
      label: inc.cat_tipos_incidencia?.tipo_incidencia || 'Incidencia',
      bgClass: 'bg-indigo-600 text-white border border-indigo-700 font-black',
      icon: '📌'
    }
  }

  const handleSaveIncidencia = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!incidenciaForm.id_empleado) return alert('Seleccione un empleado')
    if (!incidenciaForm.fecha_inicio) return alert('Seleccione la fecha de inicio')

    setSavingIncidencia(true)
    try {
      const startDate = new Date(incidenciaForm.fecha_inicio + 'T00:00:00')
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + (Math.max(1, incidenciaForm.dias) - 1))

      const y = endDate.getFullYear()
      const m = String(endDate.getMonth() + 1).padStart(2, '0')
      const d = String(endDate.getDate()).padStart(2, '0')
      const fechaFinStr = `${y}-${m}-${d}`

      let tipoId = incidenciaForm.id_tipo_incidencia
      if (!tipoId && tiposIncidencia.length > 0) {
        tipoId = tiposIncidencia[0].id_tipo_incidencia
      }

      const payload: any = {
        id_empleado: incidenciaForm.id_empleado,
        fecha_inicio: incidenciaForm.fecha_inicio,
        fecha_fin: fechaFinStr,
        comentarios: incidenciaForm.comentarios || null
      }

      if (tipoId && tipoId.length > 20) {
        payload.id_tipo_incidencia = tipoId
      }

      const { error } = await supabase.from('empleado_incidencias').insert([payload])

      if (error) {
        delete payload.id_tipo_incidencia
        const { error: err2 } = await supabase.from('empleado_incidencias').insert([payload])
        if (err2) throw err2
      }

      alert('Incidencia registrada exitosamente')
      setShowIncidenciaModal(false)
      setIncidenciaForm({
        id_empleado: '',
        id_tipo_incidencia: '',
        fecha_inicio: new Date().toISOString().split('T')[0],
        dias: 1,
        comentarios: ''
      })
      fetchIncidencias()
    } catch (err: any) {
      console.error('Error guardando incidencia:', err)
      alert('Error al guardar la incidencia: ' + (err.message || 'Intente nuevamente'))
    } finally {
      setSavingIncidencia(false)
    }
  }

  const handleDeleteIncidencia = async (idIncidencia: string) => {
    if (!confirm('¿Eliminar esta incidencia registrada?')) return
    try {
      const { error } = await supabase.from('empleado_incidencias').delete().eq('id_incidencia', idIncidencia)
      if (error) throw error
      fetchIncidencias()
    } catch (err: any) {
      alert('Error al eliminar incidencia: ' + err.message)
    }
  }

  // Filtered Campamentos by Zone — checks both camp.zona and the embedded zone in name e.g. "Cabaña 1 (Parajes)"
  const filteredCampamentosByZona = campamentos.filter(c => {
    const zonaValue = c.zona || detectZona(c)
    const matchesZona = selectedZona === 'TODAS' || zonaValue === selectedZona
    const matchesSearch = !searchQuery || c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || (c.ubicacion || '').toLowerCase().includes(searchQuery.toLowerCase())
    return matchesZona && matchesSearch
  })

  // Auto select active campamento when zone changes
  useEffect(() => {
    if (filteredCampamentosByZona.length > 0) {
      if (!selectedCampamento || !filteredCampamentosByZona.some(c => c.id_campamento === selectedCampamento.id_campamento)) {
        setSelectedCampamento(filteredCampamentosByZona[0])
      }
    } else if (campamentos.length > 0 && filteredCampamentosByZona.length === 0) {
      setSelectedCampamento(null)
    }
  }, [selectedZona, campamentos])

  // Shift Role Projection Engine
  const calculateShiftProjection = (emp?: Persona | null, targetDate: Date = new Date()) => {
    if (!emp) return { isWorkDay: false, statusLabel: 'Desocupado', isFranco: false }

    const rolStr = emp.rol_tipo || '20x10'
    const estadiaDays = emp.dias_estadia || 3

    if (rolStr.toUpperCase().includes('CONTRATISTA') || rolStr === '3DIAS') {
      const startDateStr = emp.fecha_inicio_rol || '2026-08-01'
      const startDate = new Date(startDateStr + 'T00:00:00')
      const diffTime = targetDate.getTime() - startDate.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 3600 * 24))

      const isWorkDay = diffDays >= 0 && diffDays < estadiaDays

      return {
        isWorkDay,
        isFranco: !isWorkDay,
        statusLabel: isWorkDay ? `👷🏼‍♂️ Contratista (En Sitio - ${estadiaDays} Días)` : '✈️ Retirado',
        periodName: isWorkDay ? `Estadía Corta (Día ${diffDays + 1} de ${estadiaDays})` : 'Concluido (Disponible Reactivación)',
        daysLeft: isWorkDay ? (estadiaDays - diffDays) : 0,
        nextChangeFormatted: '',
        nextChangeText: isWorkDay ? `Concluye estadía en ${estadiaDays - diffDays} días` : 'Listo para Re-asignación'
      }
    }

    let workDays = 20
    let restDays = 10

    if (rolStr === '20x10') { workDays = 20; restDays = 10; }
    else if (rolStr === '14x7') { workDays = 14; restDays = 7; }
    else if (rolStr === '10x5') { workDays = 10; restDays = 5; }
    else if (rolStr === '6x1') { workDays = 6; restDays = 1; }

    const cycleDays = workDays + restDays
    const startDateStr = emp.fecha_inicio_rol || '2026-08-01'
    const startDate = new Date(startDateStr + 'T00:00:00')

    const diffTime = targetDate.getTime() - startDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 3600 * 24))

    let dayInCycle = diffDays % cycleDays
    if (dayInCycle < 0) dayInCycle += cycleDays

    const isWorkDay = dayInCycle < workDays
    const daysLeftInPeriod = isWorkDay ? (workDays - dayInCycle) : (cycleDays - dayInCycle)

    const nextChangeDate = new Date(targetDate)
    nextChangeDate.setDate(nextChangeDate.getDate() + daysLeftInPeriod)

    const nextChangeFormatted = `${String(nextChangeDate.getDate()).padStart(2, '0')}/${String(nextChangeDate.getMonth() + 1).padStart(2, '0')}/${nextChangeDate.getFullYear()}`

    if (isWorkDay) {
      return {
        isWorkDay: true,
        isFranco: false,
        statusLabel: '🟢 En Sitio (Mina)',
        periodName: `Rol ${rolStr} (Día ${dayInCycle + 1} de ${workDays})`,
        daysLeft: daysLeftInPeriod,
        nextChangeFormatted,
        nextChangeText: `Salida a Franco: ${nextChangeFormatted}`
      }
    } else {
      return {
        isWorkDay: false,
        isFranco: true,
        statusLabel: '🟡 En Franco (Descanso)',
        periodName: `Rol ${rolStr} (Día ${dayInCycle - workDays + 1} de ${restDays} de Descanso)`,
        daysLeft: daysLeftInPeriod,
        nextChangeFormatted,
        nextChangeText: `Retorno a Mina: ${nextChangeFormatted}`
      }
    }
  }

  // THREE.JS REAL-TIME 3D VOLUMETRIC SCENE ENGINE
  useEffect(() => {
    if (viewMode !== '3d' || !mountRef.current || !selectedCampamento) return

    let isDisposed = false
    let animationFrameId: number
    let cleanupEvents: (() => void) | undefined

    const init3D = async () => {
      const THREE = await import('three')
      if (isDisposed || !mountRef.current) return

      const container = mountRef.current
      const width = container.clientWidth || 800
      const height = container.clientHeight || 500

      // 1. Scene setup
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x0c0d10)
      scene.fog = new THREE.FogExp2(0x0c0d10, 0.012)

      // 2. Camera setup
      const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000)
      camera.position.set(24, 24, 30)
      camera.lookAt(0, 1, 0)

      // 3. Renderer setup
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap

      while (container.firstChild) {
        container.removeChild(container.firstChild)
      }
      container.appendChild(renderer.domElement)

      // 4. Lighting setup
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
      scene.add(ambientLight)

      const dirLight = new THREE.DirectionalLight(0xfff5ea, 1.4)
      dirLight.position.set(25, 45, 25)
      dirLight.castShadow = true
      dirLight.shadow.mapSize.width = 2048
      dirLight.shadow.mapSize.height = 2048
      scene.add(dirLight)

      const pointLight = new THREE.PointLight(0xf59e0b, 1.2, 60)
      pointLight.position.set(0, 18, 0)
      scene.add(pointLight)

      // 5. Ground / Terrain Grid 3D
      const gridHelper = new THREE.GridHelper(70, 35, 0xf59e0b, 0x27272a)
      gridHelper.position.y = -0.01
      scene.add(gridHelper)

      const groundGeo = new THREE.PlaneGeometry(90, 90)
      const groundMat = new THREE.MeshStandardMaterial({ color: 0x141519, roughness: 0.8, metalness: 0.2 })
      const groundMesh = new THREE.Mesh(groundGeo, groundMat)
      groundMesh.rotation.x = -Math.PI / 2
      groundMesh.receiveShadow = true
      scene.add(groundMesh)

      // 6. Build 3D Volumetric Realistic Room Cubes
      const rooms = selectedCampamento.campamento_cuartos || []
      const roomsPerRow = 4
      const roomSpacingX = 9.0
      const roomSpacingZ = 9.0

      const roomObjectsMap = new Map<any, { room: Cuarto, bed?: Cama }>()

      rooms.forEach((cuarto, idx) => {
        const row = Math.floor(idx / roomsPerRow)
        const col = idx % roomsPerRow
        const xPos = (col - (Math.min(rooms.length, roomsPerRow) - 1) / 2) * roomSpacingX
        const zPos = (row - (Math.ceil(rooms.length / roomsPerRow) - 1) / 2) * roomSpacingZ

        const roomGroup = new THREE.Group()
        roomGroup.position.set(xPos, 0, zPos)

        // Room Floor 3D
        const floorGeo = new THREE.BoxGeometry(7.2, 0.2, 7.2)
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.6 })
        const floorMesh = new THREE.Mesh(floorGeo, floorMat)
        floorMesh.position.y = 0.1
        floorMesh.receiveShadow = true
        roomGroup.add(floorMesh)

        // Realistic Cabin Walls
        const isDirty = cuarto.estatus_limpieza === 'Sucio'
        const isCleaning = cuarto.estatus_limpieza === 'En Limpieza'
        const wallAccentColor = isDirty ? 0xef4444 : isCleaning ? 0xf59e0b : 0x10b981

        // Back Wall 3D
        const backWallGeo = new THREE.BoxGeometry(7.2, 3.2, 0.3)
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.7 })
        const backWallMesh = new THREE.Mesh(backWallGeo, wallMat)
        backWallMesh.position.set(0, 1.7, -3.45)
        backWallMesh.castShadow = true
        roomGroup.add(backWallMesh)

        // Side Walls 3D
        const sideWallGeo = new THREE.BoxGeometry(0.3, 3.2, 7.2)
        const leftWallMesh = new THREE.Mesh(sideWallGeo, wallMat)
        leftWallMesh.position.set(-3.45, 1.7, 0)
        leftWallMesh.castShadow = true
        roomGroup.add(leftWallMesh)

        const rightWallMesh = new THREE.Mesh(sideWallGeo, wallMat)
        rightWallMesh.position.set(3.45, 1.7, 0)
        rightWallMesh.castShadow = true
        roomGroup.add(rightWallMesh)

        // Front Door Frame 3D
        const doorFrameGeo = new THREE.BoxGeometry(1.8, 2.8, 0.3)
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x18181b })
        const doorMesh = new THREE.Mesh(doorFrameGeo, doorMat)
        doorMesh.position.set(-2.0, 1.5, 3.45)
        roomGroup.add(doorMesh)

        // Room LED Border Accent Light 3D
        const borderGeo = new THREE.BoxGeometry(7.3, 0.1, 7.3)
        const borderMat = new THREE.MeshBasicMaterial({ color: wallAccentColor })
        const borderMesh = new THREE.Mesh(borderGeo, borderMat)
        borderMesh.position.y = 3.3
        roomGroup.add(borderMesh)

        // 3D Beds inside the room
        const camas = cuarto.campamento_camas || []
        camas.forEach((cama, cIdx) => {
          const bedGroup = new THREE.Group()
          const bedOffsetX = (cIdx % 2 === 0 ? -1.9 : 1.9)
          const bedOffsetZ = (cIdx < 2 ? -1.6 : 1.6)
          bedGroup.position.set(bedOffsetX, 0.2, bedOffsetZ)

          // 3D Wooden Bed Frame & Headboard
          const bedFrameGeo = new THREE.BoxGeometry(2.1, 0.4, 2.9)
          const bedFrameMat = new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.5 })
          const bedFrameMesh = new THREE.Mesh(bedFrameGeo, bedFrameMat)
          bedFrameMesh.position.y = 0.2
          bedFrameMesh.castShadow = true
          bedGroup.add(bedFrameMesh)

          const headboardGeo = new THREE.BoxGeometry(2.1, 1.0, 0.2)
          const headboardMesh = new THREE.Mesh(headboardGeo, bedFrameMat)
          headboardMesh.position.set(0, 0.7, -1.35)
          bedGroup.add(headboardMesh)

          // 3D Nightstand / Buró next to bed
          const buroGeo = new THREE.BoxGeometry(0.8, 0.7, 0.8)
          const buroMat = new THREE.MeshStandardMaterial({ color: 0x27272a })
          const buroMesh = new THREE.Mesh(buroGeo, buroMat)
          buroMesh.position.set(cIdx % 2 === 0 ? -1.3 : 1.3, 0.35, -1.0)
          bedGroup.add(buroMesh)

          // 3D Mattress & Sheet
          const isOccupied = Boolean(cama.id_empleado)
          const proj = calculateShiftProjection(cama.empleados)
          const sheetColor = isOccupied ? (proj.isFranco ? 0xf59e0b : 0x10b981) : 0xe4e4e7

          const matGeo = new THREE.BoxGeometry(1.9, 0.3, 2.7)
          const matMaterial = new THREE.MeshStandardMaterial({ color: sheetColor, roughness: 0.7 })
          const matMesh = new THREE.Mesh(matGeo, matMaterial)
          matMesh.position.y = 0.55
          matMesh.castShadow = true
          bedGroup.add(matMesh)

          // 3D Pillow
          const pillowGeo = new THREE.BoxGeometry(1.5, 0.2, 0.7)
          const pillowMat = new THREE.MeshStandardMaterial({ color: 0xffffff })
          const pillowMesh = new THREE.Mesh(pillowGeo, pillowMat)
          pillowMesh.position.set(0, 0.75, -0.9)
          bedGroup.add(pillowMesh)

          // 3D PERSON FIGURE / AVATAR (If Occupied)
          if (isOccupied && cama.empleados) {
            const personGroup = new THREE.Group()
            personGroup.position.set(0, 0.7, 0)

            // Torso (Shirt) 3D
            const shirtColor = proj.isFranco ? 0xd97706 : 0x059669
            const torsoGeo = new THREE.CylinderGeometry(0.42, 0.38, 0.95, 12)
            const torsoMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.3 })
            const torsoMesh = new THREE.Mesh(torsoGeo, torsoMat)
            torsoMesh.position.y = 0.5
            torsoMesh.castShadow = true
            personGroup.add(torsoMesh)

            // Head 3D
            const headGeo = new THREE.SphereGeometry(0.34, 16, 16)
            const headMat = new THREE.MeshStandardMaterial({ color: 0xfbd5a5, roughness: 0.6 })
            const headMesh = new THREE.Mesh(headGeo, headMat)
            headMesh.position.y = 1.2
            headMesh.castShadow = true
            personGroup.add(headMesh)

            // Helmet 3D (Minero)
            const helmetGeo = new THREE.SphereGeometry(0.37, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2)
            const helmetMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.2, metalness: 0.4 })
            const helmetMesh = new THREE.Mesh(helmetGeo, helmetMat)
            helmetMesh.position.y = 1.3
            personGroup.add(helmetMesh)

            bedGroup.add(personGroup)
          }

          roomObjectsMap.set(bedGroup, { room: cuarto, bed: cama })
          roomObjectsMap.set(matMesh, { room: cuarto, bed: cama })
          roomGroup.add(bedGroup)
        })

        roomObjectsMap.set(roomGroup, { room: cuarto })
        roomObjectsMap.set(floorMesh, { room: cuarto })
        roomObjectsMap.set(backWallMesh, { room: cuarto })
        roomObjectsMap.set(leftWallMesh, { room: cuarto })
        roomObjectsMap.set(rightWallMesh, { room: cuarto })

        scene.add(roomGroup)
      })

      // 7. Interactive Mouse Orbit & Raycasting
      let isDragging = false
      let previousMousePosition = { x: 0, y: 0 }
      let cameraAngleX = 45 * (Math.PI / 180)
      let cameraAngleY = 45 * (Math.PI / 180)
      let cameraRadius = 38

      const updateCameraPosition = () => {
        camera.position.x = cameraRadius * Math.sin(cameraAngleY) * Math.cos(cameraAngleX)
        camera.position.y = cameraRadius * Math.sin(cameraAngleX)
        camera.position.z = cameraRadius * Math.cos(cameraAngleY) * Math.cos(cameraAngleX)
        camera.lookAt(0, 1.5, 0)
      }

      const onMouseDown = (e: MouseEvent) => {
        isDragging = true
        previousMousePosition = { x: e.clientX, y: e.clientY }
      }

      const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return
        const deltaX = e.clientX - previousMousePosition.x
        const deltaY = e.clientY - previousMousePosition.y

        cameraAngleY -= deltaX * 0.008
        cameraAngleX = Math.max(0.1, Math.min(Math.PI / 2.2, cameraAngleX + deltaY * 0.008))

        previousMousePosition = { x: e.clientX, y: e.clientY }
        updateCameraPosition()
      }

      const onMouseUp = () => {
        isDragging = false
      }

      const onWheel = (e: WheelEvent) => {
        e.preventDefault()
        cameraRadius = Math.max(12, Math.min(90, cameraRadius + e.deltaY * 0.03))
        updateCameraPosition()
      }

      const raycaster = new THREE.Raycaster()
      const mouse = new THREE.Vector2()

      const onClick = (e: MouseEvent) => {
        const rect = renderer.domElement.getBoundingClientRect()
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(mouse, camera)
        const intersects = raycaster.intersectObjects(scene.children, true)

        if (intersects.length > 0) {
          for (const intersect of intersects) {
            let current: any = intersect.object
            while (current) {
              if (roomObjectsMap.has(current)) {
                const matched = roomObjectsMap.get(current)!
                setSelectedRoom3D(matched.room)
                if (matched.bed) {
                  setSelectedBed3D({ room: matched.room, bed: matched.bed })
                } else {
                  const firstBed = matched.room.campamento_camas[0]
                  setSelectedBed3D({ room: matched.room, bed: firstBed })
                }
                return
              }
              current = current.parent
            }
          }
        }
      }

      const domElement = renderer.domElement
      domElement.addEventListener('mousedown', onMouseDown)
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
      domElement.addEventListener('wheel', onWheel, { passive: false })
      domElement.addEventListener('click', onClick)

      updateCameraPosition()

      // 8. Animation Loop
      const animate = () => {
        if (isDisposed) return
        animationFrameId = requestAnimationFrame(animate)
        renderer.render(scene, camera)
      }
      animate()

      cleanupEvents = () => {
        domElement.removeEventListener('mousedown', onMouseDown)
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        domElement.removeEventListener('wheel', onWheel)
        domElement.removeEventListener('click', onClick)
        if (container.contains(domElement)) {
          container.removeChild(domElement)
        }
        renderer.dispose()
      }
    }

    init3D()

    return () => {
      isDisposed = true
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
      if (cleanupEvents) cleanupEvents()
    }
  }, [viewMode, selectedCampamento])

  // Save Worker Shift Role
  const handleSaveShiftRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRoleWorker) return
    setSavingRole(true)
    try {
      saveWorkerRoleToLocal(editingRoleWorker.id_empleado, roleForm.rol_tipo, roleForm.fecha_inicio_rol)

      // Try updating DB silently in case schema supports it
      const { error } = await supabase
        .from('empleados')
        .update({
          rol_tipo: roleForm.rol_tipo,
          fecha_inicio_rol: roleForm.fecha_inicio_rol
        })
        .eq('id_empleado', editingRoleWorker.id_empleado)

      if (error) {
        console.warn('DB shift role update skipped (column absent):', error.message)
      }

      alert(`Rol ${roleForm.rol_tipo} (Fecha Inicio: ${roleForm.fecha_inicio_rol}) guardado con éxito para ${editingRoleWorker.nombre}. Proyección de turnos en Gantt actualizada.`)
      setEditingRoleWorker(null)
      await fetchData()
      await fetchEmpleados()
    } catch (err: any) {
      console.error('Error saving role:', err)
    } finally {
      setSavingRole(false)
    }
  }

  // Handle Create and Assign Contractor directly
  const handleCreateAndAssignContratista = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contratistaForm.nombre || !contratistaForm.apellido_paterno) return
    setSavingContratista(true)

    try {
      // 1. Insert new Contractor into empleados
      const { data: newEmp, error: empErr } = await supabase.from('empleados').insert([{
        nombre: contratistaForm.nombre,
        apellido_paterno: contratistaForm.apellido_paterno,
        apellido_materno: contratistaForm.apellido_materno,
        puesto: contratistaForm.empresa_puesto,
        departamento: 'Contratistas',
        rol_tipo: 'Contratista',
        fecha_inicio_rol: contratistaForm.fecha_llegada,
        es_contratista: true,
        estado_empleado: 'Activo'
      }]).select().single()

      if (empErr) throw empErr

      // 2. Assign bed if selected
      if (contratistaForm.id_cama) {
        const { error: bedErr } = await supabase.from('campamento_camas')
          .update({ id_empleado: newEmp.id_empleado })
          .eq('id_cama', contratistaForm.id_cama)

        if (bedErr) throw bedErr
      }

      alert(`Contratista "${contratistaForm.nombre} ${contratistaForm.apellido_paterno}" registrado y hospedado correctamente por ${contratistaForm.dias_estadia} días.`)
      setShowAddContratistaModal(false)
      setContratistaForm({
        nombre: '',
        apellido_paterno: '',
        apellido_materno: '',
        empresa_puesto: 'Contratista Minero',
        dias_estadia: 3,
        fecha_llegada: new Date().toISOString().split('T')[0],
        id_campamento: '',
        id_cuarto: '',
        id_cama: ''
      })
      fetchData()
      fetchEmpleados()
    } catch (err: any) {
      alert('Error al registrar contratista: ' + err.message)
    } finally {
      setSavingContratista(false)
    }
  }

  // Handle Quick Bed Assignment for existing Contractor
  const handleQuickAssignBedContractor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assigningBedContractor || !quickAssignBedId) return

    try {
      const { error } = await supabase.from('campamento_camas')
        .update({ id_empleado: assigningBedContractor.id_empleado })
        .eq('id_cama', quickAssignBedId)

      if (error) throw error

      alert(`Cama asignada correctamente a ${assigningBedContractor.nombre} ${assigningBedContractor.apellido_paterno}.`)
      setAssigningBedContractor(null)
      setQuickAssignCampId('')
      setQuickAssignRoomId('')
      setQuickAssignBedId('')
      fetchData()
      fetchEmpleados()
    } catch (err: any) {
      alert('Error al asignar cama: ' + err.message)
    }
  }

  // Calculated Stats
  const getCamasStats = (camp: Campamento) => {
    let totales = 0
    let ocupadas = 0
    camp.campamento_cuartos.forEach(c => {
      c.campamento_camas.forEach(ca => {
        totales++
        if (ca.id_empleado) ocupadas++
      })
    })
    return { totales, ocupadas, libres: totales - ocupadas }
  }

  const getGlobalStats = () => {
    let totalCamas = 0
    let totalOcupadas = 0
    let totalCuartos = 0
    campamentos.forEach(camp => {
      camp.campamento_cuartos.forEach(c => {
        totalCuartos++
        c.campamento_camas.forEach(ca => {
          totalCamas++
          if (ca.id_empleado) totalOcupadas++
        })
      })
    })
    return { totalCamas, totalOcupadas, totalCuartos }
  }

  const { totalCamas, totalOcupadas, totalCuartos } = getGlobalStats()

  // Actions
  const handleCreateCamp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCampName) return
    try {
      const formattedName = newCampName
      const formattedUbi = newCampUbi ? `${newCampUbi} (${newCampZona})` : newCampZona

      // 1. Try inserting with zona column
      const { data, error } = await supabase.from('campamentos').insert([{
        nombre: formattedName,
        ubicacion: formattedUbi,
        zona: newCampZona,
        tipo: newCampTipo
      }]).select().single()

      if (error) {
        console.warn('Handling fallback without zona column:', error.message)
        // 2. Fallback if 'zona' column does not exist in Supabase schema
        const { data: fallbackData, error: fallbackErr } = await supabase.from('campamentos').insert([{
          nombre: formattedName,
          ubicacion: formattedUbi,
          tipo: newCampTipo
        }]).select().single()

        if (fallbackErr) throw fallbackErr
        if (fallbackData) {
          setSelectedCampamento({ ...fallbackData, zona: newCampZona, campamento_cuartos: [] })
        }
      } else if (data) {
        setSelectedCampamento({ ...data, zona: newCampZona, campamento_cuartos: [] })
      }
      
      setNewCampName('')
      setNewCampUbi('')
      setShowAddCampModal(false)
      await fetchData()
      alert(`Campamento "${newCampName}" guardado y listo en ${newCampZona}.`)
    } catch (error: any) {
      console.error('Error creating camp:', error)
      alert('Error al crear campamento: ' + (error.message || error))
    }
  }

  const handleStartEditCamp = (camp: Campamento) => {
    setEditingCamp(camp)
    setEditingCampForm({
      nombre: camp.nombre,
      ubicacion: camp.ubicacion || '',
      zona: (camp.zona === 'Zona Norte' ? 'Zona Norte' : 'Parajes') as 'Parajes' | 'Zona Norte',
      tipo: camp.tipo || 'General'
    })
  }

  const handleSaveEditCamp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCamp || !editingCampForm.nombre) return

    setSavingEditCamp(true)
    try {
      const formattedName = editingCampForm.nombre
      const formattedUbi = editingCampForm.ubicacion ? `${editingCampForm.ubicacion} (${editingCampForm.zona})` : editingCampForm.zona

      // 1. Try updating with zona column
      const { error } = await supabase
        .from('campamentos')
        .update({
          nombre: formattedName,
          ubicacion: formattedUbi,
          zona: editingCampForm.zona,
          tipo: editingCampForm.tipo
        })
        .eq('id_campamento', editingCamp.id_campamento)

      if (error) {
        console.warn('Fallback edit without zona column:', error.message)
        // Fallback update without zona column
        const { error: fallbackErr } = await supabase
          .from('campamentos')
          .update({
            nombre: formattedName,
            ubicacion: formattedUbi,
            tipo: editingCampForm.tipo
          })
          .eq('id_campamento', editingCamp.id_campamento)

        if (fallbackErr) throw fallbackErr
      }

      alert(`Campamento "${editingCampForm.nombre}" actualizado correctamente.`)
      setEditingCamp(null)
      await fetchData()
    } catch (err: any) {
      console.error('Error updating camp:', err)
      alert('Error al editar campamento: ' + (err.message || err))
    } finally {
      setSavingEditCamp(false)
    }
  }

  const handleDeleteCamp = async (camp: Campamento) => {
    if (!confirm(`¿Estás seguro de eliminar el campamento "${camp.nombre}" y todos sus cuartos y camas asociados? Esta acción no se puede deshacer.`)) return

    try {
      const roomIds = (camp.campamento_cuartos || []).map(q => q.id_cuarto)

      if (roomIds.length > 0) {
        // Delete camas
        await supabase.from('campamento_camas').delete().in('id_cuarto', roomIds)
        // Delete cuartos
        await supabase.from('campamento_cuartos').delete().in('id_cuarto', roomIds)
      }

      // Delete campamento
      const { error } = await supabase.from('campamentos').delete().eq('id_campamento', camp.id_campamento)
      if (error) throw error

      alert(`Campamento "${camp.nombre}" eliminado correctamente.`)

      if (selectedCampamento?.id_campamento === camp.id_campamento) {
        setSelectedCampamento(null)
      }
      await fetchData()
    } catch (err: any) {
      console.error('Error deleting camp:', err)
      alert('Error al eliminar el campamento: ' + (err.message || err))
    }
  }

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCampamento || !newRoomName) return

    try {
      const { data: roomData, error: roomError } = await supabase.from('campamento_cuartos').insert([{
        id_campamento: selectedCampamento.id_campamento,
        nombre: newRoomName
      }]).select().single()

      if (roomError) throw roomError

      const camasArray = Array.from({ length: Number(newRoomCamas) }, (_, i) => ({
        id_cuarto: roomData.id_cuarto,
        numero: i + 1
      }))

      const { error: bedsError } = await supabase.from('campamento_camas').insert(camasArray)
      if (bedsError) throw bedsError

      setNewRoomName('')
      setNewRoomCamas(2)
      setShowAddRoomModal(false)
      fetchData()
    } catch (error) {
      console.error('Error creating room:', error)
      alert('Error al crear habitación')
    }
  }

  const handleAssignPerson = async (persona: Persona) => {
    if (!assignmentTarget) return
    try {
      const { error } = await supabase.from('campamento_camas')
        .update({ id_empleado: persona.id_empleado })
        .eq('id_cama', assignmentTarget.id_cama)
      
      if (error) throw error
      setAssignmentTarget(null)
      setAssignmentSearch('')
      if (selectedBed3D) {
        setSelectedBed3D(null)
      }
      fetchData()
    } catch (error) {
      console.error('Error assigning person:', error)
    }
  }

  const handleRemovePerson = async (id_cama: string) => {
    if (!confirm('¿Desocupar esta cama? El trabajador quedará en el padrón listo para re-asignación.')) return
    try {
      const { error } = await supabase.from('campamento_camas')
        .update({ id_empleado: null })
        .eq('id_cama', id_cama)
      
      if (error) throw error
      if (selectedBed3D?.bed?.id_cama === id_cama) {
        setSelectedBed3D(null)
      }
      fetchData()
    } catch (error) {
      console.error('Error removing person:', error)
    }
  }

  const handleDeleteRoom = async (id_cuarto: string) => {
    if (!confirm('¿Estás seguro de eliminar esta habitación y sus camas?')) return
    try {
      const { error } = await supabase.from('campamento_cuartos').delete().eq('id_cuarto', id_cuarto)
      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error deleting room:', error)
    }
  }

  const toggleCleaningStatus = async (id_cuarto: string, current: string) => {
    const nextStatusMap: Record<string, string> = {
      'Limpio': 'Sucio',
      'Sucio': 'En Limpieza',
      'En Limpieza': 'Limpio'
    }
    const nextStatus = nextStatusMap[current] || 'Limpio'
    try {
      await supabase.from('campamento_cuartos').update({ estatus_limpieza: nextStatus }).eq('id_cuarto', id_cuarto)
      fetchData()
    } catch (error) {
      console.error('Error updating cleaning:', error)
    }
  }

  const toggleLaundryStatus = async (id_cama: string, current: string) => {
    const nextStatus = current === 'Entregado' ? 'En Lavandería' : 'Entregado'
    try {
      await supabase.from('campamento_camas').update({ estatus_lavado: nextStatus }).eq('id_cama', id_cama)
      fetchData()
    } catch (error) {
      console.error('Error updating laundry:', error)
    }
  }

  const filteredEmployees = empleados.filter(emp => {
    const full = `${emp.nombre || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`.toLowerCase()
    return full.includes(assignmentSearch.toLowerCase())
  })

  // Days array for current Gantt month view
  const getDaysInGanttMonth = () => {
    const year = ganttDate.getFullYear()
    const month = ganttDate.getMonth()
    const numDays = new Date(year, month + 1, 0).getDate()
    const days: Date[] = []
    for (let d = 1; d <= numDays; d++) {
      days.push(new Date(year, month, d))
    }
    return days
  }

  const ganttDays = getDaysInGanttMonth()
  const ganttMonthName = ganttDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()

  // Helper arrays for contractor room selection
  const selectedCampForContractor = campamentos.find(c => c.id_campamento === contratistaForm.id_campamento)
  const roomsForContractor = selectedCampForContractor?.campamento_cuartos || []
  const selectedRoomForContractor = roomsForContractor.find(r => r.id_cuarto === contratistaForm.id_cuarto)
  const bedsForContractor = selectedRoomForContractor?.campamento_camas || []

  // Quick assign helper arrays
  const quickAssignCamp = campamentos.find(c => c.id_campamento === quickAssignCampId)
  const quickAssignRooms = quickAssignCamp?.campamento_cuartos || []
  const quickAssignRoom = quickAssignRooms.find(r => r.id_cuarto === quickAssignRoomId)
  const quickAssignBeds = quickAssignRoom?.campamento_camas || []

  return (
    <div className="space-y-6 pb-20 font-sans text-zinc-900">
      {/* Header Studio 3D */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 p-6 md:p-8 text-white border border-zinc-800 shadow-2xl">
        <div className="absolute top-0 right-0 p-12 opacity-15 pointer-events-none">
          <Box className="w-64 h-64 text-amber-500" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-widest">
              <SparklesIcon className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>Unidad Minera Bacis — Zonas Parajes & Zona Norte</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase italic flex items-center gap-3">
              Control de Campamentos & Roles
              <span className="text-[10px] font-black font-mono bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2.5 py-0.5 rounded-full not-italic animate-pulse">
                ROLES: 20x10 / 14x7 / 10x5 / 6x1
              </span>
            </h1>
            <p className="text-zinc-400 text-xs max-w-2xl leading-relaxed">
              Zonificación en Parajes y Zona Norte. Controla la ocupación en tiempo real, maquetas 3D realistas, historial de contratistas y proyecciones en Diagrama de Gantt.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowAddContratistaModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-black font-black text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 transition-all transform hover:scale-105"
            >
              <UserPlus2 className="w-4 h-4" />
              <span>+ Registrar Contratista</span>
            </button>

            <button 
              onClick={() => setShowAddCampModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-zinc-800 to-zinc-700 hover:from-zinc-700 hover:to-zinc-600 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl border border-zinc-700 shadow-md transition-all"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>+ Nuevo Campamento</span>
            </button>
          </div>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-zinc-800/80">
          <div className="bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-black">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">Campamentos</p>
              <h3 className="text-lg font-black text-white">{campamentos.length}</h3>
            </div>
          </div>

          <div className="bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-black">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">Cuartos 3D</p>
              <h3 className="text-lg font-black text-white">{totalCuartos}</h3>
            </div>
          </div>

          <div className="bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-black">
              <Bed className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">Camas Ocupadas</p>
              <h3 className="text-lg font-black text-white">
                {totalOcupadas} <span className="text-zinc-500 text-xs font-normal">/ {totalCamas}</span>
              </h3>
            </div>
          </div>

          <div className="bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 font-black">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">Disponibles</p>
              <h3 className="text-lg font-black text-emerald-400">{totalCamas - totalOcupadas} Camas</h3>
            </div>
          </div>
        </div>
      </div>

      {/* ZONE SELECTOR (PARAJES VS ZONA NORTE) */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-850 to-zinc-900 text-white p-4 rounded-2xl border border-zinc-800 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-amber-400" />
          <div>
            <div className="text-[10px] font-black uppercase text-amber-400 tracking-wider">DIVISIÓN GEOGRÁFICA MINERA</div>
            <div className="text-sm font-black uppercase">Filtrar Campamentos por Zona</div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800 w-full md:w-auto">
          <button
            onClick={() => setSelectedZona('TODAS')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${
              selectedZona === 'TODAS' ? 'bg-amber-500 text-black shadow-xs font-extrabold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            ⛰️ TODAS LAS ZONAS
          </button>
          <button
            onClick={() => setSelectedZona('Parajes')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${
              selectedZona === 'Parajes' ? 'bg-amber-500 text-black shadow-xs font-extrabold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            📍 ZONA PARAJES
          </button>
          <button
            onClick={() => setSelectedZona('Zona Norte')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${
              selectedZona === 'Zona Norte' ? 'bg-amber-500 text-black shadow-xs font-extrabold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            📍 ZONA NORTE
          </button>
        </div>
      </div>

      {/* Camp Selectors & View Mode Toggles */}
      <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto max-w-full pb-1 md:pb-0">
          {filteredCampamentosByZona.length === 0 ? (
            <span className="text-xs font-bold text-zinc-400 italic">No hay campamentos en esta zona.</span>
          ) : (
            filteredCampamentosByZona.map(camp => {
              const isSelected = selectedCampamento?.id_campamento === camp.id_campamento
              const stats = getCamasStats(camp)
              return (
                <button
                  key={camp.id_campamento}
                  onClick={() => setSelectedCampamento(camp)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${
                    isSelected 
                      ? 'bg-zinc-900 text-white shadow-md' 
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  <Home className="w-3.5 h-3.5 text-amber-400" />
                  <span>{camp.nombre}</span>
                  <span className="text-[9px] font-mono text-zinc-400 bg-zinc-800/20 px-1.5 py-0.5 rounded uppercase">
                    {camp.zona || 'Parajes'}
                  </span>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${isSelected ? 'bg-amber-500 text-black font-extrabold' : 'bg-zinc-200 text-zinc-700'}`}>
                    {stats.ocupadas}/{stats.totales}
                  </span>
                </button>
              )
            })
          )}
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-xl border border-zinc-200 shrink-0">
          <button
            onClick={() => setViewMode('3d')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 transition-all ${
              viewMode === '3d'
                ? 'bg-amber-500 text-black shadow-xs font-extrabold'
                : 'text-zinc-500 hover:text-black'
            }`}
          >
            <Box className="w-4 h-4 text-black" />
            <span>🎮 Maqueta 3D Realista</span>
          </button>

          <button
            onClick={() => setViewMode('gantt')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 transition-all ${
              viewMode === 'gantt'
                ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                : 'text-zinc-500 hover:text-black'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>📊 Diagrama de Gantt</span>
          </button>

          <button
            onClick={() => setViewMode('contratistas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 transition-all ${
              viewMode === 'contratistas'
                ? 'bg-amber-600 text-white shadow-xs font-extrabold'
                : 'text-zinc-500 hover:text-black'
            }`}
          >
            <HardHat className="w-4 h-4" />
            <span>👷🏼‍♂️ Contratistas</span>
          </button>

          <button
            onClick={() => setViewMode('tabla')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 transition-all ${
              viewMode === 'tabla'
                ? 'bg-zinc-900 text-white shadow-xs font-extrabold'
                : 'text-zinc-500 hover:text-black'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>📋 Tabla Operativa</span>
          </button>
        </div>
      </div>

      {/* ACTIVE SELECTED CAMPAMENTO MANAGEMENT BAR */}
      {selectedCampamento && (
        <div className="bg-gradient-to-r from-zinc-900 to-zinc-950 text-white px-5 py-3 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <Home className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-[10px] font-black uppercase text-amber-400 tracking-wider">CAMPAMENTO SELECCIONADO</div>
              <div className="text-sm font-black uppercase flex flex-wrap items-center gap-2">
                {selectedCampamento.nombre}
                <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/30">
                  {selectedCampamento.zona || 'Parajes'}
                </span>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-md">
                  {selectedCampamento.tipo || 'General'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleStartEditCamp(selectedCampamento)}
              className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 border border-zinc-700 shadow-sm transition-all"
            >
              <span>✏️ Editar Campamento</span>
            </button>

            <button
              onClick={() => handleDeleteCamp(selectedCampamento)}
              className="px-3.5 py-1.5 bg-red-900/40 hover:bg-red-800 text-red-300 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 border border-red-800/80 shadow-sm transition-all"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>Eliminar Campamento</span>
            </button>
          </div>
        </div>
      )}

      {/* FALLBACK EMPTY STATE WHEN NO CAMPAMENTO IN ZONE */}
      {viewMode !== 'contratistas' && !selectedCampamento && (
        <div className="bg-white rounded-3xl border border-zinc-200 p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center mx-auto">
            <Home className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-lg font-black text-zinc-900 uppercase">Sin Campamentos en {selectedZona}</h3>
            <p className="text-xs text-zinc-500">
              No hay campamentos o cabañas registradas aún en esta zona minera. Presiona el botón a continuación para dar de alta el primer campamento.
            </p>
          </div>
          <button
            onClick={() => {
              setNewCampZona(selectedZona === 'TODAS' ? 'Parajes' : selectedZona)
              setShowAddCampModal(true)
            }}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-black text-xs rounded-xl shadow-md"
          >
            + Registrar Primer Campamento en {selectedZona}
          </button>
        </div>
      )}

      {/* MAIN VIEWPORT 1: THREE.JS WEBGL 3D REALISTIC ENGINE */}
      {viewMode === '3d' && selectedCampamento && (
        <div className="space-y-4">
          <div className="bg-zinc-900 text-white p-4 rounded-2xl flex flex-wrap justify-between items-center gap-4 shadow-lg border border-zinc-800">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-amber-400 uppercase flex items-center gap-1.5">
                <Move className="w-4 h-4" /> INSTRUCCIONES 3D:
              </span>
              <span className="text-xs text-zinc-300 font-mono">
                <strong>Arrastrar mouse:</strong> Rotar 360° | <strong>Rueda mouse:</strong> Zoom | <strong>Clic en cualquier parte del cuarto 3D:</strong> Ver Ocupantes
              </span>
            </div>

            <button
              onClick={() => setShowAddRoomModal(true)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-3.5 h-3.5" /> + Diseñar Cuarto 3D
            </button>
          </div>

          {/* THREE.JS CANVAS CONTAINER */}
          <div className="relative bg-zinc-950 rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden min-h-[580px]">
            <div ref={mountRef} className="w-full h-[580px] cursor-grab active:cursor-grabbing" />

            <div className="absolute bottom-4 left-4 bg-zinc-900/90 backdrop-blur-md p-3.5 rounded-2xl border border-zinc-800 text-white text-[10px] font-mono space-y-1.5 shadow-xl pointer-events-none">
              <div className="font-black text-amber-400 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> MAQUETA DE CABAÑAS 3D — {selectedCampamento.zona || 'Zona Parajes'}
              </div>
              <div className="text-zinc-300">
                🟢 Muñeco Verde = Trabajador en Mina (En Sitio) | 🟡 Muñeco Naranja = Trabajador en Franco Descanso
              </div>
              <div className="text-zinc-400">
                🟩 Luz de Pared Verde = Limpio | 🟧 Luz Amarilla = En Limpieza | 🟥 Luz Roja = Sucio
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN VIEWPORT 2: DIAGRAMA DE GANTT / CRONOGRAMA DE ROLES Y OCUPACIÓN FUTURA */}
      {viewMode === 'gantt' && selectedCampamento && (
        <div className="space-y-4">
          {/* Gantt Header Controls */}
          <div className="bg-zinc-900 text-white p-5 rounded-3xl shadow-lg border border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5" /> PROYECCIÓN MENSUAL DE ROLES EN {selectedCampamento.zona || 'ZONA PARAJES'}
              </span>
              <h2 className="text-xl font-black uppercase tracking-tight text-white mt-0.5">
                Diagrama de Gantt — {ganttMonthName}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  setIncidenciaForm(prev => ({
                    ...prev,
                    fecha_inicio: ganttDate.toISOString().split('T')[0]
                  }))
                  setShowIncidenciaModal(true)
                }}
                className="flex items-center gap-2 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-md transition-all transform hover:scale-105"
              >
                <AlertTriangle className="w-4 h-4 text-white" />
                <span>+ Registrar Incidencia</span>
              </button>

              {/* Month Navigator */}
              <div className="flex items-center gap-3 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800">
                <button
                  onClick={() => setGanttDate(new Date(ganttDate.getFullYear(), ganttDate.getMonth() - 1, 1))}
                  className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-300 hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="text-xs font-black text-amber-400 font-mono px-3">
                  {ganttMonthName}
                </span>

                <button
                  onClick={() => setGanttDate(new Date(ganttDate.getFullYear(), ganttDate.getMonth() + 1, 1))}
                  className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-300 hover:text-white"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Gantt Legend */}
          <div className="bg-white p-3.5 rounded-2xl border border-zinc-200 flex flex-wrap items-center justify-between gap-4 text-xs font-bold shadow-xs">
            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-emerald-500 inline-block shadow-xs" />
                <span className="text-emerald-950">🟢 M: Sitio</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-amber-400 inline-block shadow-xs" />
                <span className="text-amber-950">🟡 F: Franco</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-rose-500 inline-block shadow-xs" />
                <span className="text-rose-950">🔴 INC: Incapacidad</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-sky-500 inline-block shadow-xs" />
                <span className="text-sky-950">🔵 VAC: Vacaciones</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-purple-600 inline-block shadow-xs" />
                <span className="text-purple-950">🟣 PER: Permiso</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-amber-500 border border-amber-600 inline-block shadow-xs" />
                <span className="text-amber-950">🟠 DES: Descanso Esp.</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-red-900 inline-block shadow-xs" />
                <span className="text-red-950">❌ FAL: Inasistencia</span>
              </div>
            </div>

            <button
              onClick={() => setShowIncidenciaModal(true)}
              className="text-[11px] font-black text-rose-700 hover:text-rose-800 bg-rose-50 px-3 py-1 rounded-lg border border-rose-200 transition-colors"
            >
              📋 Incidencias ({incidencias.length})
            </button>
          </div>

          {/* GANTT TIMELINE TABLE CHART */}
          <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-zinc-900 text-white text-[10px] font-mono font-black uppercase">
                    <th className="px-4 py-3 border-r border-zinc-800 min-w-[240px] sticky left-0 bg-zinc-900 z-10">
                      Habitación & Ocupante
                    </th>
                    <th className="px-3 py-3 border-r border-zinc-800 text-center min-w-[90px]">
                      Rol
                    </th>
                    {ganttDays.map(day => (
                      <th 
                        key={day.toISOString()} 
                        className={`py-3 text-center border-r border-zinc-800 text-[9px] ${
                          day.getDay() === 0 || day.getDay() === 6 ? 'bg-zinc-800 text-amber-400 font-bold' : ''
                        }`}
                      >
                        <div>{day.getDate()}</div>
                        <div className="text-[7px] text-zinc-400">
                          {['D','L','M','M','J','V','S'][day.getDay()]}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 text-xs font-semibold">
                  {selectedCampamento.campamento_cuartos.length === 0 ? (
                    <tr>
                      <td colSpan={ganttDays.length + 2} className="px-6 py-12 text-center text-zinc-400 font-bold">
                        No hay cuartos registrados para mostrar el cronograma Gantt.
                      </td>
                    </tr>
                  ) : (
                    selectedCampamento.campamento_cuartos.flatMap(cuarto => {
                      return cuarto.campamento_camas.map(cama => {
                        const emp = cama.empleados
                        return (
                          <tr key={cama.id_cama} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-4 py-3 border-r border-zinc-200 sticky left-0 bg-white shadow-xs z-10">
                              <div className="font-black text-zinc-900 text-xs flex items-center justify-between">
                                <span className="truncate">{cuarto.nombre} — Cama #{cama.numero}</span>
                              </div>
                              {emp ? (
                                <div className="flex items-center justify-between gap-1 mt-0.5">
                                  <div className="text-[11px] font-extrabold text-emerald-800 truncate">
                                    {emp.nombre} {emp.apellido_paterno}
                                  </div>
                                  <button
                                    onClick={() => {
                                      setIncidenciaForm({
                                        id_empleado: emp.id_empleado,
                                        id_tipo_incidencia: '',
                                        fecha_inicio: ganttDate.toISOString().split('T')[0],
                                        dias: 1,
                                        comentarios: ''
                                      })
                                      setShowIncidenciaModal(true)
                                    }}
                                    className="text-[9px] font-black text-rose-700 bg-rose-50 hover:bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200 shrink-0"
                                    title="Registrar incidencia para este trabajador"
                                  >
                                    + Incidencia
                                  </button>
                                </div>
                              ) : (
                                <div className="text-[10px] text-zinc-400 italic">Desocupada / Disponible</div>
                              )}
                            </td>

                            <td className="px-3 py-3 border-r border-zinc-200 text-center font-mono text-[10px]">
                              {emp ? (
                                <button
                                  onClick={() => {
                                    setEditingRoleWorker(emp)
                                    setRoleForm({
                                      rol_tipo: emp.rol_tipo || '20x10',
                                      fecha_inicio_rol: emp.fecha_inicio_rol || '2026-08-01'
                                    })
                                  }}
                                  className="px-2 py-0.5 bg-zinc-100 hover:bg-amber-100 text-zinc-800 font-bold rounded border border-zinc-300 transition-colors"
                                >
                                  {emp.rol_tipo || '20x10'} ✏️
                                </button>
                              ) : (
                                <span className="text-zinc-400">-</span>
                              )}
                            </td>

                            {ganttDays.map(day => {
                              if (!emp) {
                                return (
                                  <td key={day.toISOString()} className="border-r border-zinc-200 p-1 text-center bg-zinc-50/50">
                                    <span className="block w-full h-5 rounded bg-zinc-100" />
                                  </td>
                                )
                              }

                              const inc = getIncidenciaForEmpAndDay(emp.id_empleado, day)
                              const incMeta = getIncidenciaMeta(inc)
                              const proj = calculateShiftProjection(emp, day)

                              if (incMeta && inc) {
                                const incLabel = inc.cat_tipos_incidencia?.tipo_incidencia || incMeta.label
                                const detailTooltip = `${emp.nombre} ${emp.apellido_paterno}: [${incMeta.code}] ${incLabel}\n` +
                                  `Fechas: ${inc.fecha_inicio} al ${inc.fecha_fin}\n` +
                                  `Comentarios: ${inc.comentarios || 'Sin detalles'}`

                                return (
                                  <td 
                                    key={day.toISOString()} 
                                    className="border-r border-zinc-200 p-0.5 text-center cursor-pointer hover:opacity-80 transition-opacity"
                                    title={detailTooltip}
                                    onClick={() => {
                                      if (confirm(`Incidencia de ${emp.nombre}:\n${incLabel} (${inc.fecha_inicio} al ${inc.fecha_fin})\n${inc.comentarios || ''}\n\n¿Desea eliminar esta incidencia?`)) {
                                        handleDeleteIncidencia(inc.id_incidencia)
                                      }
                                    }}
                                  >
                                    <div 
                                      className={`w-full h-5 rounded flex items-center justify-center text-[7px] font-black font-mono shadow-2xs ${incMeta.bgClass}`}
                                    >
                                      {incMeta.code}
                                    </div>
                                  </td>
                                )
                              }

                              return (
                                <td 
                                  key={day.toISOString()} 
                                  className="border-r border-zinc-200 p-0.5 text-center cursor-pointer hover:opacity-90 transition-opacity"
                                  title={`${emp.nombre}: ${proj.statusLabel} (${proj.periodName})\n(Haz clic para registrar incidencia)`}
                                  onClick={() => {
                                    const y = day.getFullYear()
                                    const m = String(day.getMonth() + 1).padStart(2, '0')
                                    const d = String(day.getDate()).padStart(2, '0')
                                    setIncidenciaForm({
                                      id_empleado: emp.id_empleado,
                                      id_tipo_incidencia: '',
                                      fecha_inicio: `${y}-${m}-${d}`,
                                      dias: 1,
                                      comentarios: ''
                                    })
                                    setShowIncidenciaModal(true)
                                  }}
                                >
                                  <div 
                                    className={`w-full h-5 rounded flex items-center justify-center text-[7px] font-black text-black font-mono shadow-2xs ${
                                      proj.isWorkDay ? 'bg-emerald-400 border border-emerald-500' : 'bg-amber-400 border border-amber-500'
                                    }`}
                                  >
                                    {proj.isWorkDay ? 'M' : 'F'}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MAIN VIEWPORT 3: HISTORIAL & REACTIVACIÓN RÁPIDA DE CONTRATISTAS */}
      {viewMode === 'contratistas' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-amber-900 via-zinc-900 to-zinc-950 text-white p-6 rounded-3xl shadow-lg border border-amber-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                <HardHat className="w-4 h-4 text-amber-400" /> PADRÓN & ALTA DE CONTRATISTAS (CORTA ESTADÍA)
              </span>
              <h2 className="text-xl font-black uppercase tracking-tight text-white mt-1">
                Gestión Directa y Asignación de Hospedaje a Contratistas
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Registra nuevos contratistas definiendo sus días de permanencia y asignándoles cama de inmediato en cualquier zona minera.
              </p>
            </div>

            <button
              onClick={() => setShowAddContratistaModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-black font-black text-xs px-5 py-3 rounded-2xl shadow-xl transition-all transform hover:scale-105 shrink-0"
            >
              <UserPlus2 className="w-5 h-5" />
              <span>+ Registrar Nuevo Contratista</span>
            </button>
          </div>

          <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Contratista / Empresa</th>
                  <th className="px-6 py-4">Puesto / Especialidad</th>
                  <th className="px-6 py-4">Permanencia (Días)</th>
                  <th className="px-6 py-4">Acción de Hospedaje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-xs font-semibold">
                {contratistasHistorial.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-zinc-400 font-bold">
                      No hay contratistas registrados en el padrón. Presiona <strong>+ Registrar Nuevo Contratista</strong> para ingresar al primero.
                    </td>
                  </tr>
                ) : (
                  contratistasHistorial.map(emp => (
                    <tr key={emp.id_empleado} className="hover:bg-amber-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-black text-zinc-900 text-sm">
                          {emp.nombre} {emp.apellido_paterno} {emp.apellido_materno || ''}
                        </div>
                        <div className="text-[10px] text-amber-700 font-mono font-bold mt-0.5">
                          ID: {emp.id_empleado}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-bold text-zinc-800">{emp.puesto || 'Contratista Eventual'}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">{emp.departamento || 'Contratistas Bacis'}</div>
                      </td>

                      <td className="px-6 py-4 font-mono text-xs">
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-lg font-black uppercase">
                          ⏱️ {emp.dias_estadia || 3} Días de Estadía
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <button
                          onClick={() => setAssigningBedContractor(emp)}
                          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
                        >
                          <Bed className="w-4 h-4" />
                          <span>🏨 Asignar / Cambiar Cama</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MAIN VIEWPORT 4: VISTA EN TABLA OPERATIVA */}
      {viewMode === 'tabla' && selectedCampamento && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs">
            <h3 className="text-sm font-black text-zinc-900 uppercase flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              Gestión Operativa de Cuartos — {selectedCampamento.nombre} ({selectedCampamento.zona || 'Zona Parajes'})
            </h3>
            <button
              onClick={() => setShowAddRoomModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Agregar Habitación
            </button>
          </div>

          <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Habitación / Cabaña</th>
                  <th className="px-6 py-4">Estatus Limpieza</th>
                  <th className="px-6 py-4">Camas & Ocupantes Actuales</th>
                  <th className="px-6 py-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-xs font-semibold">
                {selectedCampamento.campamento_cuartos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-zinc-400">
                      No hay habitaciones en este campamento.
                    </td>
                  </tr>
                ) : (
                  selectedCampamento.campamento_cuartos.map(cuarto => (
                    <tr key={cuarto.id_cuarto} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-black text-zinc-900 text-sm">{cuarto.nombre}</div>
                        <div className="text-[10px] text-zinc-400 font-mono">
                          Total Camas: {cuarto.campamento_camas.length}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleCleaningStatus(cuarto.id_cuarto, cuarto.estatus_limpieza)}
                          className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase border transition-all ${
                            cuarto.estatus_limpieza === 'Limpio' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                            cuarto.estatus_limpieza === 'Sucio' ? 'bg-rose-100 text-rose-900 border-rose-300' :
                            'bg-amber-100 text-amber-900 border-amber-300'
                          }`}
                        >
                          🧼 {cuarto.estatus_limpieza}
                        </button>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          {cuarto.campamento_camas.map(cama => {
                            const emp = cama.empleados
                            const proj = calculateShiftProjection(emp)
                            return (
                              <div key={cama.id_cama} className="flex items-center justify-between bg-zinc-50 border border-zinc-200 p-2 rounded-xl text-xs">
                                <div>
                                  <span className="font-mono font-bold text-amber-700 mr-2">Cama #{cama.numero}:</span>
                                  {emp ? (
                                    <span className="font-black text-zinc-900">
                                      {emp.nombre} {emp.apellido_paterno} ({emp.puesto || emp.departamento || 'Personal'})
                                      <span className="text-[10px] ml-2 text-emerald-700 font-mono">[{proj.statusLabel}]</span>
                                    </span>
                                  ) : (
                                    <span className="text-zinc-400 italic">Cama Desocupada / Libre</span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {emp ? (
                                    <>
                                      <button
                                        onClick={() => {
                                          setEditingRoleWorker(emp)
                                          setRoleForm({
                                            rol_tipo: emp.rol_tipo || '20x10',
                                            fecha_inicio_rol: emp.fecha_inicio_rol || '2026-08-01'
                                          })
                                        }}
                                        className="text-[9px] font-black bg-zinc-200 hover:bg-amber-200 text-zinc-900 px-2 py-0.5 rounded border border-zinc-300 transition-colors"
                                      >
                                        ⚙️ Rol ({emp.rol_tipo || '20x10'})
                                      </button>

                                      <button
                                        onClick={() => handleRemovePerson(cama.id_cama)}
                                        className="text-[9px] font-black text-rose-600 hover:underline"
                                      >
                                        Desocupar
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => setAssignmentTarget({ id_cama: cama.id_cama, numero: cama.numero })}
                                      className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300"
                                    >
                                      + Asignar
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDeleteRoom(cuarto.id_cuarto)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl font-bold"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR NUEVO CONTRATISTA (ALTA DIRECTA CON ESTADÍA Y CAMA) */}
      {showAddContratistaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-zinc-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <h3 className="text-base font-black text-zinc-900 uppercase flex items-center gap-2">
                <HardHat className="w-5 h-5 text-amber-500" />
                Registrar Nuevo Contratista (Estadía Corta)
              </h3>
              <button onClick={() => setShowAddContratistaModal(false)} className="text-zinc-400 hover:text-zinc-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateAndAssignContratista} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Nombre(s) *</label>
                  <input
                    type="text"
                    required
                    value={contratistaForm.nombre}
                    onChange={e => setContratistaForm({ ...contratistaForm, nombre: e.target.value })}
                    placeholder="Ej. Carlos Juan"
                    className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Primer Apellido *</label>
                  <input
                    type="text"
                    required
                    value={contratistaForm.apellido_paterno}
                    onChange={e => setContratistaForm({ ...contratistaForm, apellido_paterno: e.target.value })}
                    placeholder="Ej. Gómez"
                    className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Empresa / Puesto u Servicio</label>
                <input
                  type="text"
                  value={contratistaForm.empresa_puesto}
                  onChange={e => setContratistaForm({ ...contratistaForm, empresa_puesto: e.target.value })}
                  placeholder="Ej. Mantenimiento Eléctrico - Contratistas Bacis"
                  className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Días de Permanencia</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={contratistaForm.dias_estadia}
                    onChange={e => setContratistaForm({ ...contratistaForm, dias_estadia: Number(e.target.value) })}
                    className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Fecha de Llegada</label>
                  <input
                    type="date"
                    required
                    value={contratistaForm.fecha_llegada}
                    onChange={e => setContratistaForm({ ...contratistaForm, fecha_llegada: e.target.value })}
                    className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                  />
                </div>
              </div>

              {/* DIRECT BED ASSIGNMENT */}
              <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 space-y-3">
                <span className="text-xs font-black text-amber-900 uppercase flex items-center gap-1.5">
                  <Bed className="w-4 h-4 text-amber-600" /> ASIGNACIÓN INMEDIATA DE CAMA EN CAMPAMENTO
                </span>

                <div>
                  <label className="block text-[11px] font-bold text-amber-950 mb-1">1. Seleccionar Campamento</label>
                  <select
                    value={contratistaForm.id_campamento}
                    onChange={e => setContratistaForm({ ...contratistaForm, id_campamento: e.target.value, id_cuarto: '', id_cama: '' })}
                    className="w-full text-xs font-bold border-amber-300 rounded-xl p-2 bg-white"
                  >
                    <option value="">-- Seleccionar Campamento --</option>
                    {campamentos.map(c => (
                      <option key={c.id_campamento} value={c.id_campamento}>
                        {c.nombre} ({c.zona || 'Parajes'})
                      </option>
                    ))}
                  </select>
                </div>

                {contratistaForm.id_campamento && (
                  <div>
                    <label className="block text-[11px] font-bold text-amber-950 mb-1">2. Seleccionar Cuarto</label>
                    <select
                      value={contratistaForm.id_cuarto}
                      onChange={e => setContratistaForm({ ...contratistaForm, id_cuarto: e.target.value, id_cama: '' })}
                      className="w-full text-xs font-bold border-amber-300 rounded-xl p-2 bg-white"
                    >
                      <option value="">-- Seleccionar Cuarto --</option>
                      {roomsForContractor.map(r => (
                        <option key={r.id_cuarto} value={r.id_cuarto}>
                          {r.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {contratistaForm.id_cuarto && (
                  <div>
                    <label className="block text-[11px] font-bold text-amber-950 mb-1">3. Seleccionar Cama Disponible</label>
                    <select
                      value={contratistaForm.id_cama}
                      onChange={e => setContratistaForm({ ...contratistaForm, id_cama: e.target.value })}
                      className="w-full text-xs font-bold border-amber-300 rounded-xl p-2 bg-white"
                    >
                      <option value="">-- Seleccionar Cama --</option>
                      {bedsForContractor.map(b => (
                        <option key={b.id_cama} value={b.id_cama} disabled={Boolean(b.id_empleado)}>
                          Cama #{b.numero} {b.id_empleado ? '(Ocupada)' : '(Libre)'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddContratistaModal(false)}
                  className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingContratista}
                  className="px-5 py-2.5 text-xs font-black bg-amber-500 hover:bg-amber-600 text-black rounded-xl shadow-md disabled:opacity-50"
                >
                  {savingContratista ? 'Guardando...' : 'Guardar y Asignar Cama'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ASIGNAR CAMA A CONTRATISTA EXISTENTE */}
      {assigningBedContractor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-zinc-200 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <h3 className="text-base font-black text-zinc-900 uppercase flex items-center gap-2">
                <Bed className="w-5 h-5 text-amber-500" />
                Asignar Cama a Contratista
              </h3>
              <button onClick={() => setAssigningBedContractor(null)} className="text-zinc-400 hover:text-zinc-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleQuickAssignBedContractor} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Contratista</label>
                <div className="text-sm font-black text-zinc-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  {assigningBedContractor.nombre} {assigningBedContractor.apellido_paterno}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">1. Seleccionar Campamento</label>
                <select
                  required
                  value={quickAssignCampId}
                  onChange={e => {
                    setQuickAssignCampId(e.target.value)
                    setQuickAssignRoomId('')
                    setQuickAssignBedId('')
                  }}
                  className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                >
                  <option value="">-- Seleccionar Campamento --</option>
                  {campamentos.map(c => (
                    <option key={c.id_campamento} value={c.id_campamento}>
                      {c.nombre} ({c.zona || 'Parajes'})
                    </option>
                  ))}
                </select>
              </div>

              {quickAssignCampId && (
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">2. Seleccionar Cuarto</label>
                  <select
                    required
                    value={quickAssignRoomId}
                    onChange={e => {
                      setQuickAssignRoomId(e.target.value)
                      setQuickAssignBedId('')
                    }}
                    className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                  >
                    <option value="">-- Seleccionar Cuarto --</option>
                    {quickAssignRooms.map(r => (
                      <option key={r.id_cuarto} value={r.id_cuarto}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {quickAssignRoomId && (
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">3. Seleccionar Cama Disponible</label>
                  <select
                    required
                    value={quickAssignBedId}
                    onChange={e => setQuickAssignBedId(e.target.value)}
                    className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                  >
                    <option value="">-- Seleccionar Cama --</option>
                    {quickAssignBeds.map(b => (
                      <option key={b.id_cama} value={b.id_cama} disabled={Boolean(b.id_empleado)}>
                        Cama #{b.numero} {b.id_empleado ? '(Ocupada)' : '(Libre)'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssigningBedContractor(null)}
                  className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!quickAssignBedId}
                  className="px-5 py-2 text-xs font-black bg-amber-500 hover:bg-amber-600 text-black rounded-xl shadow-md disabled:opacity-50"
                >
                  Asignar Cama
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HOLOGRÁFICO 3D DE HABITACIÓN Y OCUPANTES */}
      {selectedRoom3D && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-zinc-950 rounded-3xl shadow-2xl max-w-xl w-full p-6 border border-zinc-800 text-white space-y-5 relative overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-amber-500 to-indigo-500" />

            <div className="flex justify-between items-start pt-1 border-b border-zinc-800 pb-3">
              <div>
                <span className="text-[9px] font-black font-mono bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded-full uppercase">
                  FICHA DE HABITACIÓN Y OCUPANTES 3D
                </span>
                <h2 className="text-xl font-black text-white uppercase mt-1">
                  {selectedRoom3D.nombre}
                </h2>
                <div className="text-xs text-zinc-400 font-mono">
                  Estatus Limpieza: <strong className="text-emerald-400">{selectedRoom3D.estatus_limpieza}</strong>
                </div>
              </div>
              <button 
                onClick={() => { setSelectedRoom3D(null); setSelectedBed3D(null); }} 
                className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold"
              >
                ✕
              </button>
            </div>

            {/* List of Beds and Workers in Room */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider">
                🛏️ Camas Asignadas ({selectedRoom3D.campamento_camas.filter(c => c.id_empleado).length} de {selectedRoom3D.campamento_camas.length} Ocupadas)
              </h3>

              {selectedRoom3D.campamento_camas.map(cama => {
                const emp = cama.empleados
                const proj = calculateShiftProjection(emp)

                return (
                  <div key={cama.id_cama} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-2">
                    <div className="flex justify-between items-center border-b border-zinc-800/80 pb-2">
                      <span className="text-xs font-black font-mono text-amber-400">CAMA #{cama.numero}</span>
                      {emp ? (
                        <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded uppercase">
                          {proj.statusLabel}
                        </span>
                      ) : (
                        <span className="text-[10px] font-black bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded uppercase">
                          LIBRE / DISPONIBLE
                        </span>
                      )}
                    </div>

                    {emp ? (
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-black text-sm text-white">
                              {emp.nombre} {emp.apellido_paterno} {emp.apellido_materno || ''}
                            </div>
                            <div className="text-xs text-amber-400 font-medium">
                              {emp.puesto || 'Personal Operativo'} ({emp.departamento || 'Mina'})
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setEditingRoleWorker(emp)
                              setRoleForm({
                                rol_tipo: emp.rol_tipo || '20x10',
                                fecha_inicio_rol: emp.fecha_inicio_rol || '2026-08-01'
                              })
                            }}
                            className="text-[10px] font-black bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded border border-zinc-700"
                          >
                            ⚙️ Editar Rol ({emp.rol_tipo || '20x10'})
                          </button>
                        </div>

                        {/* Shift Role Status Banner */}
                        <div className="bg-zinc-950 p-2.5 rounded-xl text-[11px] font-mono space-y-1 border border-zinc-800/80">
                          <div>Periodo Actual: <strong>{proj.periodName}</strong></div>
                          {proj.nextChangeText && <div className="text-amber-400 font-bold">✈️ {proj.nextChangeText}</div>}
                        </div>

                        <div className="flex justify-between items-center text-[10px] font-mono pt-1">
                          <button
                            onClick={() => toggleLaundryStatus(cama.id_cama, cama.estatus_lavado)}
                            className="text-zinc-400 hover:text-white"
                          >
                            🧺 Lavandería: <strong className="text-amber-400">{cama.estatus_lavado}</strong> (Cambiar)
                          </button>

                          <button
                            onClick={() => handleRemovePerson(cama.id_cama)}
                            className="text-rose-400 hover:underline font-bold"
                          >
                            Desocupar Cama
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center py-1">
                        <span className="text-xs text-zinc-500 italic">Esta cama se encuentra desocupada.</span>
                        <button
                          onClick={() => setAssignmentTarget({ id_cama: cama.id_cama, numero: cama.numero })}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black"
                        >
                          + Asignar Trabajador
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => { setSelectedRoom3D(null); setSelectedBed3D(null); }}
                className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-black text-xs rounded-xl"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAR ROL DE TRABAJADOR */}
      {editingRoleWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-zinc-200 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-black text-zinc-900 uppercase flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                Configurar Rol de Trabajo y Descanso
              </h3>
              <button onClick={() => setEditingRoleWorker(null)} className="text-zinc-400 hover:text-zinc-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveShiftRole} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Trabajador / Contratista</label>
                <div className="text-sm font-black text-zinc-800 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200">
                  {editingRoleWorker.nombre} {editingRoleWorker.apellido_paterno}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Esquema de Rol (Trabajo x Descanso)</label>
                <select
                  value={roleForm.rol_tipo}
                  onChange={e => setRoleForm({ ...roleForm, rol_tipo: e.target.value })}
                  className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                >
                  <option value="20x10">20x10 (20 Días Trabajo / 10 Días Descanso)</option>
                  <option value="14x7">14x7 (14 Días Trabajo / 7 Días Descanso)</option>
                  <option value="10x5">10x5 (10 Días Trabajo / 5 Días Descanso)</option>
                  <option value="6x1">6x1 (6 Días Trabajo / 1 Día Descanso)</option>
                  <option value="Contratista">Contratista (Estadía Corta 3 Días)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Fecha del Primer Día de Trabajo / Inicio</label>
                <input
                  type="date"
                  required
                  value={roleForm.fecha_inicio_rol}
                  onChange={e => setRoleForm({ ...roleForm, fecha_inicio_rol: e.target.value })}
                  className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRoleWorker(null)}
                  className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingRole}
                  className="px-5 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md disabled:opacity-50"
                >
                  {savingRole ? 'Guardando...' : 'Guardar y Recalcular'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ASIGNAR PERSONAL A CAMA */}
      {assignmentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-zinc-200 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-black text-zinc-900 uppercase flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                Asignar Trabajador a Cama #{assignmentTarget.numero}
              </h3>
              <button onClick={() => setAssignmentTarget(null)} className="text-zinc-400 hover:text-zinc-700 font-bold">✕</button>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por nombre de trabajador o contratista..."
                  value={assignmentSearch}
                  onChange={e => setAssignmentSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800"
                />
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-zinc-100 border border-zinc-200 rounded-2xl">
                {filteredEmployees.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-400 font-bold">
                    No se encontraron trabajadores activos.
                  </div>
                ) : (
                  filteredEmployees.map(emp => (
                    <div
                      key={emp.id_empleado}
                      onClick={() => handleAssignPerson(emp)}
                      className="p-3 hover:bg-emerald-50 cursor-pointer transition-colors flex justify-between items-center"
                    >
                      <div>
                        <div className="font-black text-xs text-zinc-900">
                          {emp.nombre} {emp.apellido_paterno} {emp.apellido_materno || ''}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {emp.puesto || emp.departamento || 'General'}
                        </div>
                      </div>
                      <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                        Asignar
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setAssignmentTarget(null)}
                className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR NUEVO CAMPAMENTO */}
      {showAddCampModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-zinc-200 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <h3 className="text-base font-black text-zinc-900 uppercase flex items-center gap-2">
                <Home className="w-5 h-5 text-amber-500" />
                Registrar Nuevo Campamento Minero
              </h3>
              <button onClick={() => setShowAddCampModal(false)} className="text-zinc-400 hover:text-zinc-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateCamp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Nombre del Campamento / Cabaña</label>
                <input
                  type="text"
                  required
                  value={newCampName}
                  onChange={e => setNewCampName(e.target.value)}
                  placeholder="Ej. Cabaña 1 - Supervisores Bacis"
                  className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Zona Minera Destinada</label>
                <select
                  value={newCampZona}
                  onChange={e => setNewCampZona(e.target.value as any)}
                  className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                >
                  <option value="Parajes">📍 Zona Parajes</option>
                  <option value="Zona Norte">📍 Zona Norte</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Ubicación Específica</label>
                <input
                  type="text"
                  value={newCampUbi}
                  onChange={e => setNewCampUbi(e.target.value)}
                  placeholder="Ej. Zona Alta El Herrero"
                  className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Tipo de Personal Destinado</label>
                <select
                  value={newCampTipo}
                  onChange={e => setNewCampTipo(e.target.value)}
                  className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                >
                  <option value="General">General / Personal Operativo</option>
                  <option value="Supervisores">Supervisores & Ingenieros</option>
                  <option value="Staff">Staff / Administración</option>
                  <option value="Contratistas">Contratistas</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCampModal(false)}
                  className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-amber-500 hover:bg-amber-600 text-black rounded-xl shadow-md"
                >
                  Guardar Campamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR HABITACIÓN 3D */}
      {showAddRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-zinc-200 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <h3 className="text-base font-black text-zinc-900 uppercase flex items-center gap-2">
                <Box className="w-5 h-5 text-amber-500" />
                Diseñar Nueva Habitación 3D
              </h3>
              <button onClick={() => setShowAddRoomModal(false)} className="text-zinc-400 hover:text-zinc-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Nombre / Identificador de Cuarto</label>
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  placeholder="Ej. Cuarto 101"
                  className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Número de Camas a Instalar</label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={newRoomCamas}
                  onChange={e => setNewRoomCamas(Number(e.target.value))}
                  className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddRoomModal(false)}
                  className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md"
                >
                  Generar Cuarto 3D
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR CAMPAMENTO */}
      {editingCamp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-zinc-200 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <h3 className="text-base font-black text-zinc-900 uppercase flex items-center gap-2">
                <Home className="w-5 h-5 text-amber-500" />
                Editar Campamento Minero
              </h3>
              <button onClick={() => setEditingCamp(null)} className="text-zinc-400 hover:text-zinc-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveEditCamp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Nombre del Campamento / Cabaña</label>
                <input
                  type="text"
                  required
                  value={editingCampForm.nombre}
                  onChange={e => setEditingCampForm({ ...editingCampForm, nombre: e.target.value })}
                  className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Zona Minera Destinada</label>
                <select
                  value={editingCampForm.zona}
                  onChange={e => setEditingCampForm({ ...editingCampForm, zona: e.target.value as any })}
                  className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                >
                  <option value="Parajes">📍 Zona Parajes</option>
                  <option value="Zona Norte">📍 Zona Norte</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Ubicación Específica</label>
                <input
                  type="text"
                  value={editingCampForm.ubicacion}
                  onChange={e => setEditingCampForm({ ...editingCampForm, ubicacion: e.target.value })}
                  placeholder="Ej. Planta Alta - Sector Norte"
                  className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Tipo de Personal Destinado</label>
                <select
                  value={editingCampForm.tipo}
                  onChange={e => setEditingCampForm({ ...editingCampForm, tipo: e.target.value })}
                  className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                >
                  <option value="General">General / Personal Operativo</option>
                  <option value="Supervisores">Supervisores & Ingenieros</option>
                  <option value="Staff">Staff / Administración</option>
                  <option value="Contratistas">Contratistas</option>
                </select>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (editingCamp) handleDeleteCamp(editingCamp)
                    setEditingCamp(null)
                  }}
                  className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-1 border border-red-200"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCamp(null)}
                    className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingEditCamp}
                    className="px-5 py-2 text-xs font-black bg-amber-500 hover:bg-amber-600 text-black rounded-xl shadow-md"
                  >
                    {savingEditCamp ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </div>
            </form>
      {/* MODAL REGISTRAR INCIDENCIA DE PERSONAL */}
      {showIncidenciaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-zinc-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-rose-600 tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> REGISTRO DE INCIDENCIAS
                </span>
                <h3 className="text-base font-black text-zinc-900 uppercase">
                  Registrar Incidencia / Ausencia de Personal
                </h3>
              </div>
              <button onClick={() => setShowIncidenciaModal(false)} className="text-zinc-400 hover:text-zinc-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveIncidencia} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Seleccionar Empleado / Personal</label>
                <select
                  required
                  value={incidenciaForm.id_empleado}
                  onChange={e => setIncidenciaForm({ ...incidenciaForm, id_empleado: e.target.value })}
                  className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5 bg-zinc-50 focus:bg-white"
                >
                  <option value="">-- Seleccionar Trabajador --</option>
                  {empleados.map(e => (
                    <option key={e.id_empleado} value={e.id_empleado}>
                      {e.nombre} {e.apellido_paterno} {e.apellido_materno || ''} ({e.puesto || e.departamento || 'Personal'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Tipo de Incidencia</label>
                <select
                  value={incidenciaForm.id_tipo_incidencia}
                  onChange={e => setIncidenciaForm({ ...incidenciaForm, id_tipo_incidencia: e.target.value })}
                  className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5 bg-zinc-50 focus:bg-white"
                >
                  <option value="">-- Seleccionar Tipo --</option>
                  {tiposIncidencia.length > 0 ? (
                    tiposIncidencia.map(t => (
                      <option key={t.id_tipo_incidencia} value={t.id_tipo_incidencia}>
                        {t.tipo_incidencia}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="incapacidad">🩹 Incapacidad Médica / IMSS</option>
                      <option value="vacaciones">🏖️ Vacaciones Programadas</option>
                      <option value="permiso">📄 Permiso Especial / Salida Anticipada</option>
                      <option value="descanso">🛌 Descanso Especial</option>
                      <option value="falta">❌ Falta / Inasistencia Sin Justificar</option>
                    </>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Fecha de Inicio</label>
                  <input
                    type="date"
                    required
                    value={incidenciaForm.fecha_inicio}
                    onChange={e => setIncidenciaForm({ ...incidenciaForm, fecha_inicio: e.target.value })}
                    className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Duración (Días)</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    required
                    value={incidenciaForm.dias}
                    onChange={e => setIncidenciaForm({ ...incidenciaForm, dias: Number(e.target.value) })}
                    className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Motivo / Comentarios Específicos</label>
                <textarea
                  rows={2}
                  value={incidenciaForm.comentarios}
                  onChange={e => setIncidenciaForm({ ...incidenciaForm, comentarios: e.target.value })}
                  placeholder="Ej. Incapacidad por consulta médica en clínica Bacis / Se retiró anticipadamente por asunto familiar"
                  className="w-full text-xs font-bold border-zinc-300 rounded-xl p-2.5 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowIncidenciaModal(false)}
                  className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingIncidencia}
                  className="px-5 py-2 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{savingIncidencia ? 'Guardando...' : 'Registrar Incidencia'}</span>
                </button>
              </div>
            </form>

            {/* HISTORIAL / LISTA DE INCIDENCIAS ACTIVAS */}
            {incidencias.length > 0 && (
              <div className="pt-4 border-t border-zinc-200">
                <h4 className="text-xs font-black uppercase text-zinc-800 mb-2">Incidencias Recientes Registradas</h4>
                <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                  {incidencias.slice(0, 10).map(inc => {
                    const empFound = empleados.find(e => e.id_empleado === inc.id_empleado)
                    const incMeta = getIncidenciaMeta(inc)
                    return (
                      <div key={inc.id_incidencia} className="flex items-center justify-between bg-zinc-50 border border-zinc-200 p-2.5 rounded-xl text-xs">
                        <div>
                          <div className="font-black text-zinc-900 flex items-center gap-1.5">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${incMeta?.bgClass}`}>
                              {incMeta?.code}
                            </span>
                            <span>{empFound ? `${empFound.nombre} ${empFound.apellido_paterno}` : `ID: ${inc.id_empleado}`}</span>
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                            {inc.fecha_inicio} al {inc.fecha_fin} {inc.comentarios ? `• ${inc.comentarios}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteIncidencia(inc.id_incidencia)}
                          className="text-rose-600 hover:bg-rose-50 p-1 rounded-lg text-xs font-bold"
                          title="Eliminar Incidencia"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
