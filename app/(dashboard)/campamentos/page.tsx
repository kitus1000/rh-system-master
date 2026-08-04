'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { 
  Home, Plus, Bed, Trash2, UserPlus, Search, Building, MapPin, 
  CheckCircle, AlertTriangle, ChevronRight, Sparkles, Activity, ShieldCheck,
  Box, Eye, Layers, RotateCw, User, Calendar, Clock, RefreshCw, X, Sparkle,
  Check, Shirt, Sparkles as SparklesIcon, Zap, Settings, ShieldAlert
} from 'lucide-react'

interface Persona {
  id_empleado: string
  nombre: string
  apellido_paterno: string
  apellido_materno?: string
  puesto?: string
  departamento?: string
  numero_empleado?: number | string
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
  tipo: 'General' | 'Contratistas' | 'Staff' | 'Supervisores' | string
  campamento_cuartos: Cuarto[]
}

export default function CampamentosPage() {
  const [campamentos, setCampamentos] = useState<Campamento[]>([])
  const [empleados, setEmpleados] = useState<Persona[]>([])
  const [selectedCampamento, setSelectedCampamento] = useState<Campamento | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  
  // Vistas: '3d' (Visor 3D Interactivo) vs 'tabla' (Gestión Operativa)
  const [viewMode, setViewMode] = useState<'3d' | 'tabla'>('3d')
  
  // Ángulo 3D: 'isometric' (Isométrica), 'top' (Plano Cenital), 'front' (Fachada 3D)
  const [viewAngle, setViewAngle] = useState<'isometric' | 'top' | 'front'>('isometric')

  // Ocupante / Cama Seleccionada para Modal Holográfico 3D
  const [selectedRoom3D, setSelectedRoom3D] = useState<Cuarto | null>(null)
  const [selectedBed3D, setSelectedBed3D] = useState<{ room: Cuarto, bed: Cama } | null>(null)

  // Modales/Form states
  const [showAddCampModal, setShowAddCampModal] = useState(false)
  const [newCampName, setNewCampName] = useState('')
  const [newCampUbi, setNewCampUbi] = useState('')
  const [newCampTipo, setNewCampTipo] = useState('General')

  const [showAddRoomModal, setShowAddRoomModal] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomCamas, setNewRoomCamas] = useState(2)

  // Assignment state
  const [assignmentTarget, setAssignmentTarget] = useState<{ id_cama: string, numero: number } | null>(null)
  const [assignmentSearch, setAssignmentSearch] = useState('')

  useEffect(() => {
    fetchData()
    fetchEmpleados()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('campamentos')
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
        .order('creado_el')
      
      if (error) throw error

      const processed: Campamento[] = (data || []).map((camp: any) => ({
        ...camp,
        campamento_cuartos: (camp.campamento_cuartos || [])
          .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' }))
          .map((q: any) => ({
            ...q,
            campamento_camas: (q.campamento_camas || []).sort((a: any, b: any) => a.numero - b.numero)
          }))
      }))

      setCampamentos(processed)
      
      if (!selectedCampamento && processed.length > 0) {
        setSelectedCampamento(processed[0])
      } else if (selectedCampamento) {
        setSelectedCampamento(processed.find(c => c.id_campamento === selectedCampamento.id_campamento) || processed[0] || null)
      }
    } catch (error) {
      console.error('Error fetching campamentos:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEmpleados = async () => {
    const { data } = await supabase
      .from('empleados')
      .select('id_empleado, nombre, apellido_paterno, apellido_materno, puesto, departamento, numero_empleado')
      .eq('estado_empleado', 'Activo')
      .order('nombre')
    setEmpleados(data || [])
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
      const { error } = await supabase.from('campamentos').insert([{
        nombre: newCampName,
        ubicacion: newCampUbi || 'Sin ubicación',
        tipo: newCampTipo
      }])
      if (error) throw error
      
      setNewCampName('')
      setNewCampUbi('')
      setShowAddCampModal(false)
      fetchData()
    } catch (error) {
      console.error('Error creating camp:', error)
      alert('Error al crear campamento')
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
    if (!confirm('¿Desocupar esta cama? El trabajador será liberado del cuarto.')) return
    try {
      const { error } = await supabase.from('campamento_camas')
        .update({ id_empleado: null })
        .eq('id_cama', id_cama)
      
      if (error) throw error
      if (selectedBed3D?.bed.id_cama === id_cama) {
        setSelectedBed3D(null)
      }
      fetchData()
    } catch (error) {
      console.error('Error removing person:', error)
    }
  }

  const handleDeleteRoom = async (id_cuarto: string) => {
    if (!confirm('¿Estás seguro de eliminar esta habitación y sus camas de la maqueta 3D?')) return
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

  const filteredCampamentos = campamentos.filter(c => 
    c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.ubicacion.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredEmployees = empleados.filter(emp => {
    const full = `${emp.nombre || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`.toLowerCase()
    return full.includes(assignmentSearch.toLowerCase())
  })

  // CSS 3D Transform generator according to active angle
  const getTransform3D = () => {
    switch (viewAngle) {
      case 'isometric':
        return 'rotateX(50deg) rotateZ(-28deg) scale(0.92)'
      case 'top':
        return 'rotateX(0deg) rotateZ(0deg) scale(1)'
      case 'front':
        return 'rotateX(75deg) rotateZ(0deg) scale(0.95)'
      default:
        return 'rotateX(50deg) rotateZ(-28deg)'
    }
  }

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
              <span>Campamento 3D Studio — Diseñador & Control Hábito-Laboral</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase italic flex items-center gap-3">
              Alojamiento & Presencia 3D
              <span className="text-[10px] font-black font-mono bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2.5 py-0.5 rounded-full not-italic">
                REAL-TIME WEBGL
              </span>
            </h1>
            <p className="text-zinc-400 text-xs max-w-2xl leading-relaxed">
              Diseñador de cabañas y cuartos mineros en maquetación 3D. Controla la ocupación en tiempo real basándote en turnos de trabajo, estado de desinfección y lavandería de sábanas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => setShowAddCampModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 transition-all transform hover:scale-105"
            >
              <Plus className="w-4 h-4" />
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
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">Habitaciones 3D</p>
              <h3 className="text-lg font-black text-white">{totalCuartos}</h3>
            </div>
          </div>

          <div className="bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-black">
              <Bed className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">Ocupación Camas</p>
              <h3 className="text-lg font-black text-white">
                {totalOcupadas} <span className="text-zinc-500 text-xs font-normal">/ {totalCamas} ({totalCamas > 0 ? Math.round((totalOcupadas/totalCamas)*100) : 0}%)</span>
              </h3>
            </div>
          </div>

          <div className="bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 font-black">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">Camas Libres</p>
              <h3 className="text-lg font-black text-emerald-400">{totalCamas - totalOcupadas} Libres</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Camp Selectors & View Mode Toggles */}
      <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Camp Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto max-w-full pb-1 md:pb-0">
          {campamentos.map(camp => {
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
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${isSelected ? 'bg-amber-500 text-black font-extrabold' : 'bg-zinc-200 text-zinc-700'}`}>
                  {stats.ocupadas}/{stats.totales}
                </span>
              </button>
            )
          })}
        </div>

        {/* View Mode Switcher: 3D Viewport vs Table */}
        <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-xl border border-zinc-200 self-end md:self-auto shrink-0">
          <button
            onClick={() => setViewMode('3d')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 transition-all ${
              viewMode === '3d'
                ? 'bg-amber-500 text-black shadow-xs font-extrabold'
                : 'text-zinc-500 hover:text-black'
            }`}
          >
            <Box className="w-4 h-4 text-black" />
            <span>🎮 Visor 3D Interactivo</span>
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
            <span>📋 Gestión en Tabla</span>
          </button>
        </div>
      </div>

      {/* MAIN VIEWPORT: VISTA 3D INTERACTIVA */}
      {viewMode === '3d' && selectedCampamento && (
        <div className="space-y-4">
          {/* 3D Toolbar & Controls */}
          <div className="bg-zinc-900 text-white p-4 rounded-2xl flex flex-wrap justify-between items-center gap-4 shadow-lg border border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-black text-amber-400 uppercase">
                <Box className="w-4 h-4" />
                <span>PERSPECTIVA 3D:</span>
              </div>
              <div className="flex gap-1 bg-zinc-800 p-1 rounded-xl">
                <button
                  onClick={() => setViewAngle('isometric')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                    viewAngle === 'isometric' ? 'bg-amber-500 text-black font-extrabold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  🎲 ISOMÉTRICA 3D
                </button>
                <button
                  onClick={() => setViewAngle('top')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                    viewAngle === 'top' ? 'bg-amber-500 text-black font-extrabold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  🗺️ PLANO CENITAL 2D
                </button>
                <button
                  onClick={() => setViewAngle('front')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                    viewAngle === 'front' ? 'bg-amber-500 text-black font-extrabold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  🏛️ FACHADA 3D
                </button>
              </div>
            </div>

            {/* LED Status Legend */}
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold font-mono">
              <div className="flex items-center gap-1.5 bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                <span className="text-emerald-400">🟢 Ocupado / En Sitio (Mina)</span>
              </div>
              <div className="flex items-center gap-1.5 bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-amber-500/30">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                <span className="text-amber-300">🟡 En Franco (Descanso)</span>
              </div>
              <div className="flex items-center gap-1.5 bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-500/30">
                <span className="w-2.5 h-2.5 rounded-full bg-white inline-block" />
                <span className="text-zinc-300">⚪ Cama Disponible</span>
              </div>
            </div>

            <button
              onClick={() => setShowAddRoomModal(true)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-3.5 h-3.5" /> + Agregar Cuarto 3D
            </button>
          </div>

          {/* 3D STAGE STYLED CANVAS CONTAINER */}
          <div className="bg-zinc-950 rounded-3xl p-8 min-h-[520px] border border-zinc-800 shadow-2xl relative overflow-hidden flex flex-col justify-center items-center">
            {/* Grid background effect */}
            <div 
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(#f59e0b 1px, transparent 1px), radial-gradient(#3f3f46 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                backgroundPosition: '0 0, 12px 12px'
              }}
            />

            {selectedCampamento.campamento_cuartos.length === 0 ? (
              <div className="relative z-10 text-center space-y-3 p-12">
                <Box className="w-12 h-12 text-amber-500/60 mx-auto animate-bounce" />
                <h3 className="text-base font-black text-white uppercase">Este campamento aún no tiene cuartos diseñados en 3D</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">Agrega habitaciones para visualizar las maquetas tridimensionales y camas ocupadas.</p>
                <button
                  onClick={() => setShowAddRoomModal(true)}
                  className="px-5 py-2.5 bg-amber-500 text-black font-black text-xs rounded-xl shadow-lg hover:bg-amber-400"
                >
                  + Diseñar Primera Habitación 3D
                </button>
              </div>
            ) : (
              <div 
                className="w-full transition-all duration-700 ease-out transform-gpu py-8"
                style={{
                  transform: getTransform3D(),
                  transformStyle: 'preserve-3d'
                }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-6xl mx-auto">
                  {selectedCampamento.campamento_cuartos.map((cuarto) => {
                    const totalCamasQ = cuarto.campamento_camas.length
                    const ocupadasQ = cuarto.campamento_camas.filter(c => c.id_empleado).length
                    const isDirty = cuarto.estatus_limpieza === 'Sucio'
                    const isCleaning = cuarto.estatus_limpieza === 'En Limpieza'

                    return (
                      <div
                        key={cuarto.id_cuarto}
                        className={`group relative bg-zinc-900/90 rounded-2xl border-2 p-5 shadow-2xl transition-all duration-300 transform hover:-translate-y-2 hover:scale-[1.03] ${
                          isDirty ? 'border-rose-500/80 shadow-rose-500/10' :
                          isCleaning ? 'border-amber-500/80 shadow-amber-500/10' :
                          'border-zinc-700/80 hover:border-amber-500'
                        }`}
                        style={{
                          boxShadow: '0 20px 30px -10px rgba(0,0,0,0.8), 0 0 15px rgba(245, 158, 11, 0.05)'
                        }}
                      >
                        {/* Status Strip / LED Bar */}
                        <div className="flex justify-between items-center border-b border-zinc-800 pb-2.5 mb-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full shadow-lg ${
                              ocupadasQ === totalCamasQ ? 'bg-emerald-500 shadow-emerald-500/50 animate-pulse' :
                              ocupadasQ > 0 ? 'bg-amber-400 shadow-amber-400/50' :
                              'bg-zinc-600'
                            }`} />
                            <h4 className="font-black text-white text-sm uppercase tracking-wide">
                              {cuarto.nombre}
                            </h4>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleCleaningStatus(cuarto.id_cuarto, cuarto.estatus_limpieza); }}
                              className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase border transition-all ${
                                cuarto.estatus_limpieza === 'Limpio' ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700' :
                                cuarto.estatus_limpieza === 'Sucio' ? 'bg-rose-950/80 text-rose-300 border-rose-700' :
                                'bg-amber-950/80 text-amber-300 border-amber-700'
                              }`}
                            >
                              🧼 {cuarto.estatus_limpieza}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteRoom(cuarto.id_cuarto); }}
                              className="text-zinc-600 hover:text-rose-400 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Beds Grid inside Room 3D Cube */}
                        <div className="grid grid-cols-2 gap-2.5 my-2">
                          {cuarto.campamento_camas.map((cama) => {
                            const emp = cama.empleados
                            const isOccupied = Boolean(emp)

                            return (
                              <div
                                key={cama.id_cama}
                                onClick={() => {
                                  if (isOccupied) {
                                    setSelectedRoom3D(cuarto)
                                    setSelectedBed3D({ room: cuarto, bed: cama })
                                  } else {
                                    setAssignmentTarget({ id_cama: cama.id_cama, numero: cama.numero })
                                  }
                                }}
                                className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between min-h-[90px] relative overflow-hidden ${
                                  isOccupied 
                                    ? 'bg-gradient-to-b from-zinc-800 to-zinc-900 border-emerald-500/60 text-white hover:border-emerald-400 shadow-md'
                                    : 'bg-zinc-950/60 border-zinc-800 text-zinc-500 hover:border-amber-500/60 hover:text-zinc-300'
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-black font-mono text-amber-400">
                                    🛏️ CAMA #{cama.numero}
                                  </span>
                                  {isOccupied ? (
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500" />
                                  ) : (
                                    <span className="text-[8px] font-bold bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 uppercase">
                                      LIBRE
                                    </span>
                                  )}
                                </div>

                                {isOccupied && emp ? (
                                  <div className="space-y-0.5 mt-2">
                                    <div className="font-black text-xs text-white truncate">
                                      {emp.nombre} {emp.apellido_paterno}
                                    </div>
                                    <div className="text-[9px] text-zinc-400 truncate font-mono">
                                      {emp.puesto || emp.departamento || 'Personal Mina'}
                                    </div>
                                    <div className="flex justify-between items-center mt-1 pt-1 border-t border-zinc-800 text-[8px] font-mono">
                                      <span className="text-emerald-400 font-bold">🟢 En Sitio</span>
                                      <span className={cama.estatus_lavado === 'Entregado' ? 'text-zinc-400' : 'text-amber-400'}>
                                        🧺 {cama.estatus_lavado}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-[10px] font-black text-zinc-600 text-center my-auto flex items-center justify-center gap-1 group-hover:text-amber-400">
                                    <Plus className="w-3.5 h-3.5" /> + Asignar
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* Room Footer Info */}
                        <div className="mt-3 pt-2 border-t border-zinc-800/80 flex justify-between items-center text-[10px] font-mono text-zinc-400">
                          <span>Camas: <strong className="text-white">{ocupadasQ}/{totalCamasQ}</strong></span>
                          <span className="text-amber-400 font-bold">
                            {totalCamasQ - ocupadasQ === 0 ? 'COMPLETO' : `${totalCamasQ - ocupadasQ} Disponible(s)`}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MAIN VIEWPORT: VISTA EN TABLA OPERATIVA */}
      {viewMode === 'tabla' && selectedCampamento && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs">
            <h3 className="text-sm font-black text-zinc-900 uppercase flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              Gestión Operativa de Cuartos — {selectedCampamento.nombre}
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
                            return (
                              <div key={cama.id_cama} className="flex items-center justify-between bg-zinc-50 border border-zinc-200 p-2 rounded-xl text-xs">
                                <div>
                                  <span className="font-mono font-bold text-amber-700 mr-2">Cama #{cama.numero}:</span>
                                  {emp ? (
                                    <span className="font-black text-zinc-900">
                                      {emp.nombre} {emp.apellido_paterno} ({emp.puesto || emp.departamento || 'Personal'})
                                    </span>
                                  ) : (
                                    <span className="text-zinc-400 italic">Cama Desocupada / Libre</span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {emp ? (
                                    <button
                                      onClick={() => handleRemovePerson(cama.id_cama)}
                                      className="text-[9px] font-black text-rose-600 hover:underline"
                                    >
                                      Desocupar
                                    </button>
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

      {/* MODAL HOLOGRÁFICO 3D DE OCUPANTE */}
      {selectedBed3D && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="bg-zinc-950 rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-zinc-800 text-white space-y-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-amber-500 to-indigo-500" />

            <div className="flex justify-between items-start pt-1 border-b border-zinc-800 pb-3">
              <div>
                <span className="text-[9px] font-black font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full uppercase">
                  FICHA HOLOGRÁFICA DE OCUPANTE
                </span>
                <h2 className="text-lg font-black text-white uppercase mt-1">
                  {selectedBed3D.room.nombre} — Cama #{selectedBed3D.bed.numero}
                </h2>
              </div>
              <button 
                onClick={() => setSelectedBed3D(null)} 
                className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Occupant Main Info */}
            <div className="bg-zinc-900/90 border border-zinc-800 p-4 rounded-2xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-emerald-600 text-black flex items-center justify-center font-black text-lg">
                  {selectedBed3D.bed.empleados?.nombre?.[0] || 'U'}
                </div>
                <div>
                  <h3 className="font-black text-white text-base">
                    {selectedBed3D.bed.empleados?.nombre} {selectedBed3D.bed.empleados?.apellido_paterno} {selectedBed3D.bed.empleados?.apellido_materno || ''}
                  </h3>
                  <div className="text-xs text-amber-400 font-semibold">
                    {selectedBed3D.bed.empleados?.puesto || 'Personal Operativo'}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono">
                    Depto: {selectedBed3D.bed.empleados?.departamento || 'Mina Bacis'}
                  </div>
                </div>
              </div>

              {/* Work Schedule / Shift Role Status Badge */}
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-zinc-400">ESTATUS DE ROL / SITIO:</span>
                  <span className="font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2.5 py-0.5 rounded-md uppercase">
                    🟢 EN SITIO (MINA ACTIVA)
                  </span>
                </div>
                <div className="text-[10px] font-mono text-zinc-400 flex justify-between">
                  <span>Turno: <strong>Rol 14x7 (Día 8 de 14)</strong></span>
                  <span>Salida a Franco: <strong className="text-amber-400">10/08/2026</strong></span>
                </div>
              </div>

              {/* Cleaning & Laundry Controls */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 space-y-1">
                  <span className="text-[9px] text-zinc-500 font-bold block uppercase">ROPA DE CAMA / LAVANDERÍA</span>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">{selectedBed3D.bed.estatus_lavado}</span>
                    <button
                      onClick={() => toggleLaundryStatus(selectedBed3D.bed.id_cama, selectedBed3D.bed.estatus_lavado)}
                      className="text-[9px] font-black text-amber-400 underline"
                    >
                      Cambiar
                    </button>
                  </div>
                </div>

                <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 space-y-1">
                  <span className="text-[9px] text-zinc-500 font-bold block uppercase">LIMPIEZA HABITACIÓN</span>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-emerald-400">{selectedBed3D.room.estatus_limpieza}</span>
                    <button
                      onClick={() => toggleCleaningStatus(selectedBed3D.room.id_cuarto, selectedBed3D.room.estatus_limpieza)}
                      className="text-[9px] font-black text-amber-400 underline"
                    >
                      Cambiar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex justify-between items-center gap-3">
              <button
                onClick={() => handleRemovePerson(selectedBed3D.bed.id_cama)}
                className="px-4 py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 font-black text-xs rounded-xl"
              >
                Desocupar Cama
              </button>

              <button
                onClick={() => setSelectedBed3D(null)}
                className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-black text-xs rounded-xl"
              >
                Cerrar Ficha
              </button>
            </div>
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
                  placeholder="Buscar por nombre de trabajador..."
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
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Ubicación en Unidad Minera</label>
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
    </div>
  )
}
