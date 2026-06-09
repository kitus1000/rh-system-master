'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { 
  Home, Plus, Bed, Trash2, UserPlus, Search, Building, MapPin, 
  CheckCircle, AlertTriangle, ChevronRight, Sparkles, Activity, ShieldCheck
} from 'lucide-react'

interface Persona {
  id_empleado: string
  nombre: string
  apellido_paterno: string
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
              empleados ( id_empleado, nombre, apellido_paterno )
            )
          )
        `)
        .order('creado_el')
      
      if (error) throw error

      // Sort cuartos and camas to display in order
      const processed: Campamento[] = (data || []).map((camp: any) => ({
        ...camp,
        campamento_cuartos: (camp.campamento_cuartos || [])
          .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre))
          .map((q: any) => ({
            ...q,
            campamento_camas: (q.campamento_camas || []).sort((a: any, b: any) => a.numero - b.numero)
          }))
      }))

      setCampamentos(processed)
      
      if (!selectedCampamento && processed.length > 0) {
        setSelectedCampamento(processed[0])
      } else if (selectedCampamento) {
        setSelectedCampamento(processed.find(c => c.id_campamento === selectedCampamento.id_campamento) || null)
      }
    } catch (error) {
      console.error('Error fetching campamentos:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEmpleados = async () => {
    const { data } = await supabase.from('empleados').select('id_empleado, nombre, apellido_paterno').eq('estado_empleado', 'Activo')
    setEmpleados(data || [])
  }

  // Calculations
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
      // 1. Create Room
      const { data: roomData, error: roomError } = await supabase.from('campamento_cuartos').insert([{
        id_campamento: selectedCampamento.id_campamento,
        nombre: newRoomName
      }]).select().single()

      if (roomError) throw roomError

      // 2. Create Beds
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
      fetchData()
    } catch (error) {
      console.error('Error assigning person:', error)
    }
  }

  const handleRemovePerson = async (id_cama: string) => {
    if (!confirm('¿Desocupar cama?')) return
    try {
      const { error } = await supabase.from('campamento_camas')
        .update({ id_empleado: null })
        .eq('id_cama', id_cama)
      
      if (error) throw error
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

  const filteredCampamentos = campamentos.filter(c => 
    c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.ubicacion.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredEmployees = empleados.filter(emp => 
    `${emp.nombre} ${emp.apellido_paterno}`.toLowerCase().includes(assignmentSearch.toLowerCase())
  )

  return (
    <div className="space-y-8 pb-16 font-mono text-zinc-850">
      {/* Header Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-zinc-950 p-8 text-white border border-zinc-900 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-zinc-950 to-zinc-950 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 text-amber-500 font-semibold mb-1">
              <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
              <span>Control de Campamentos Mineros v2</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">
              Alojamiento y Capacidad
            </h1>
            <p className="text-zinc-400 mt-1 max-w-xl">
              Administra cabañas, distribución de habitaciones, asignación de personal, servicio de lavado de ropa de cama y estatus de limpieza sincronizado con la base de datos real.
            </p>
          </div>
          <button 
            onClick={() => setShowAddCampModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold px-5 py-3 rounded-lg shadow-lg shadow-amber-500/20 transition-all duration-300 transform hover:scale-[1.02]"
          >
            <Plus className="w-5 h-5" />
            <span>Registrar Campamento</span>
          </button>
        </div>

        {/* Global Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8 pt-8 border-t border-zinc-900">
          <div className="flex items-center gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-850">
            <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Home className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Campamentos Activos</p>
              <h3 className="text-2xl font-black text-white">{campamentos.length}</h3>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-850">
            <div className="h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Habitaciones / Cabañas</p>
              <h3 className="text-2xl font-black text-white">{totalCuartos}</h3>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-850">
            <div className="h-12 w-12 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Bed className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Camas y Ocupación</p>
              <h3 className="text-2xl font-black text-white">
                {totalOcupadas} <span className="text-zinc-500 text-sm font-normal">/ {totalCamas} ({totalCamas > 0 ? Math.round((totalOcupadas/totalCamas)*100) : 0}%)</span>
              </h3>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Camps Cabin Cards */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-extrabold text-zinc-900 flex items-center gap-2">
                <Home className="w-5 h-5 text-amber-500" />
                <span>Campamentos Registrados</span>
              </h2>
              <span className="bg-zinc-200 text-zinc-800 text-xs px-2.5 py-1 rounded-full font-bold font-sans">
                {filteredCampamentos.length} total
              </span>
            </div>
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar campamentos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-850 shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {loading ? (
              <div className="p-8 text-center text-zinc-500 font-bold">Cargando campamentos...</div>
            ) : filteredCampamentos.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-zinc-500">
                <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                <p className="font-semibold">No se encontraron campamentos</p>
              </div>
            ) : (
              filteredCampamentos.map((camp) => {
                const { totales, ocupadas, libres } = getCamasStats(camp)
                const isSelected = selectedCampamento?.id_campamento === camp.id_campamento
                const percent = totales > 0 ? (ocupadas / totales) * 100 : 0
                
                return (
                  <div
                    key={camp.id_campamento}
                    onClick={() => setSelectedCampamento(camp)}
                    className={`relative rounded-xl border p-5 cursor-pointer transition-all duration-300 hover:shadow-md ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/20 ring-1 ring-amber-500/50'
                        : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md mb-2 ${
                          camp.tipo === 'Supervisores' ? 'bg-purple-100 text-purple-800' :
                          camp.tipo === 'Staff' ? 'bg-blue-100 text-blue-800' :
                          camp.tipo === 'Contratistas' ? 'bg-teal-100 text-teal-800' :
                          'bg-zinc-100 text-zinc-800'
                        }`}>
                          Campamento {camp.tipo}
                        </span>
                        <h3 className="font-extrabold text-zinc-900 text-base leading-tight font-sans">
                          {camp.nombre}
                        </h3>
                        <div className="flex items-center gap-1 text-zinc-500 text-xs mt-1">
                          <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{camp.ubicacion}</span>
                        </div>
                      </div>

                      <div className={`h-12 w-12 rounded-lg flex items-center justify-center border transition-all ${
                        isSelected 
                          ? 'bg-amber-500 text-black border-amber-500 shadow-md'
                          : 'bg-zinc-50 text-zinc-650 border-zinc-200'
                      }`}>
                        <div className="relative flex flex-col items-center">
                          <div className={`w-6 h-4 border-t-2 border-x-2 rounded-t-sm ${isSelected ? 'border-black' : 'border-zinc-650'}`} style={{ borderBottomWidth: 0 }} />
                          <div className={`w-8 h-4 border-2 rounded-sm -mt-0.5 flex justify-center items-center ${isSelected ? 'border-black bg-amber-400' : 'border-zinc-650 bg-zinc-200'}`}>
                            <div className={`w-2 h-2.5 rounded-t-xs -mb-1 ${isSelected ? 'bg-black' : 'bg-zinc-650'}`} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-zinc-500">Camas ocupadas</span>
                        <span className="text-zinc-850 font-bold">{ocupadas} de {totales} ({Math.round(percent)}%)</span>
                      </div>
                      <div className="w-full bg-zinc-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${
                            percent >= 90 ? 'bg-rose-500' :
                            percent >= 70 ? 'bg-amber-500' :
                            'bg-emerald-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-zinc-100 text-center text-xs">
                      <div>
                        <span className="text-zinc-400 block text-[10px] uppercase">Habitaciones</span>
                        <strong className="text-zinc-700 font-extrabold text-sm">{camp.campamento_cuartos.length}</strong>
                      </div>
                      <div>
                        <span className="text-zinc-400 block text-[10px] uppercase">Libres</span>
                        <strong className="text-emerald-600 font-extrabold text-sm">{libres}</strong>
                      </div>
                      <div className="flex items-center justify-end text-amber-600 font-bold group">
                        <span className="mr-1 group-hover:underline">Detalles</span>
                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Side: Camp detail & Room Visualizer */}
        <div className="lg:col-span-7">
          {selectedCampamento ? (
            <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden min-h-[600px] flex flex-col">
              
              {/* Detail Header */}
              <div className="bg-zinc-50 border-b border-zinc-200 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-100 text-amber-800 text-[10px] px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider">
                      Módulo Residencial Seleccionado
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-zinc-900 mt-1 uppercase italic font-sans leading-none">
                    {selectedCampamento.nombre}
                  </h2>
                  <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{selectedCampamento.ubicacion}</span>
                  </p>
                </div>
                <button
                  onClick={() => setShowAddRoomModal(true)}
                  className="flex items-center gap-2 bg-zinc-950 hover:bg-zinc-900 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow transition-all duration-200"
                >
                  <Plus className="w-4 h-4" />
                  <span>Añadir Cabaña / Cuarto</span>
                </button>
              </div>

              {/* Rooms Visualizer Grid */}
              <div className="p-6 flex-1 overflow-y-auto space-y-6 max-h-[600px]">
                {selectedCampamento.campamento_cuartos.length === 0 ? (
                  <div className="h-full flex flex-col justify-center items-center text-center p-12 text-zinc-400">
                    <div className="h-16 w-16 bg-zinc-100 rounded-full flex items-center justify-center mb-3">
                      <Bed className="w-8 h-8 text-zinc-400" />
                    </div>
                    <h3 className="font-bold text-zinc-700 text-lg">No hay cabañas ni cuartos</h3>
                  </div>
                ) : (
                  selectedCampamento.campamento_cuartos.map((cuarto) => {
                    const camasTotales = cuarto.campamento_camas.length
                    const camasOcupadas = cuarto.campamento_camas.filter(c => c.id_empleado).length
                    const porcOcupacion = camasTotales > 0 ? (camasOcupadas / camasTotales) * 100 : 0

                    return (
                      <div
                        key={cuarto.id_cuarto}
                        className="border border-zinc-200 rounded-xl bg-white overflow-hidden shadow-xs hover:border-zinc-300 transition-all"
                      >
                        {/* Room Header */}
                        <div className="bg-zinc-50 border-b border-zinc-100 px-5 py-3.5 flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded bg-amber-100 flex items-center justify-center text-amber-700">
                              <Home className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-extrabold text-zinc-900 text-sm font-sans">{cuarto.nombre}</h4>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                                <span className="text-[10px] text-zinc-500">
                                  {camasOcupadas}/{camasTotales} camas ({Math.round(porcOcupacion)}%)
                                </span>
                                
                                {/* Room Cleaning Interactive Badge */}
                                <button
                                  onClick={() => toggleCleaningStatus(cuarto.id_cuarto, cuarto.estatus_limpieza)}
                                  className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded border transition-colors ${
                                    cuarto.estatus_limpieza === 'Limpio' ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100' :
                                    cuarto.estatus_limpieza === 'Sucio' ? 'bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100 animate-pulse' :
                                    'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                                  }`}
                                  title="Haz clic para cambiar estatus de limpieza"
                                >
                                  {cuarto.estatus_limpieza === 'Limpio' && <CheckCircle className="w-3 h-3 text-emerald-600" />}
                                  {cuarto.estatus_limpieza === 'Sucio' && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                                  {cuarto.estatus_limpieza === 'En Limpieza' && <Activity className="w-3 h-3 text-amber-600 animate-spin" />}
                                  <span>{cuarto.estatus_limpieza}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDeleteRoom(cuarto.id_cuarto)}
                              className="p-1.5 text-zinc-400 hover:text-rose-600 rounded transition-colors"
                              title="Eliminar Habitación"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Beds Visual Cards Grid */}
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          {cuarto.campamento_camas.map((cama) => {
                            const isOcupada = !!cama.id_empleado
                            return (
                              <div
                                key={cama.id_cama}
                                className={`rounded-lg border p-4 flex flex-col justify-between min-h-[145px] transition-all ${
                                  isOcupada
                                    ? 'bg-zinc-50 border-zinc-200'
                                    : 'border-dashed border-zinc-300 bg-zinc-50/20 hover:bg-amber-50/20 hover:border-amber-400'
                                }`}
                              >
                                {/* Bed Label & Status */}
                                <div className="flex justify-between items-center mb-1">
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                    isOcupada ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                                  }`}>
                                    Cama #{cama.numero}
                                  </span>
                                  <Bed className={`w-3.5 h-3.5 ${isOcupada ? 'text-amber-500' : 'text-zinc-300'}`} />
                                </div>

                                {/* Bed Occupant or Empty */}
                                {isOcupada && cama.empleados ? (
                                  <div className="space-y-1 my-1.5">
                                    <h5 className="font-extrabold text-zinc-950 text-[11px] line-clamp-1 font-sans">
                                      {cama.empleados.nombre} {cama.empleados.apellido_paterno}
                                    </h5>
                                  </div>
                                ) : (
                                  <div className="text-center py-2 my-1">
                                    <span className="text-[10px] text-zinc-400 italic block">Disponible</span>
                                  </div>
                                )}

                                {/* Bed Services (Laundry status / toggle & occupy actions) */}
                                <div className="space-y-2 pt-2 border-t border-zinc-100">
                                  {/* Laundry Service Toggle Badge */}
                                  <div className="flex justify-between items-center">
                                    <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider">Lavandería:</span>
                                    <button
                                      onClick={() => toggleLaundryStatus(cama.id_cama, cama.estatus_lavado)}
                                      className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border transition-colors ${
                                        cama.estatus_lavado === 'Entregado'
                                          ? 'bg-emerald-50 border-emerald-250 text-emerald-700 hover:bg-emerald-100'
                                          : 'bg-indigo-50 border-indigo-250 text-indigo-700 hover:bg-indigo-100 animate-pulse'
                                      }`}
                                      title="Haz clic para cambiar estatus de lavado de sábanas"
                                    >
                                      {cama.estatus_lavado}
                                    </button>
                                  </div>

                                  <div className="flex justify-end pt-1">
                                    {isOcupada ? (
                                      <button
                                        onClick={() => handleRemovePerson(cama.id_cama)}
                                        className="text-[9px] text-rose-600 hover:text-rose-800 hover:underline font-bold"
                                      >
                                        Desocupar Cama
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => setAssignmentTarget({ id_cama: cama.id_cama, numero: cama.numero })}
                                        className="text-[9px] text-amber-600 hover:text-amber-700 hover:underline font-bold flex items-center gap-1"
                                      >
                                        <UserPlus className="w-3 h-3" />
                                        <span>Asignar</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Bottom footer overview */}
              <div className="bg-zinc-50 border-t border-zinc-200 p-4 px-6 flex justify-between items-center text-xs text-zinc-500">
                <span>* Servicio de limpieza de cuartos y lavado de blancos en tiempo real (Sincronizado con Supabase).</span>
                <span className="flex items-center gap-1 font-semibold text-emerald-600">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Módulo Activo en Nube</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center text-zinc-400 min-h-[600px] flex flex-col justify-center items-center">
              <Home className="w-16 h-16 text-zinc-300 mb-4" />
              <h3 className="font-extrabold text-zinc-700 text-lg">Selecciona un Campamento</h3>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Add Camp */}
      {showAddCampModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden border border-zinc-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-zinc-950 p-6 text-white relative">
              <h3 className="text-xl font-black uppercase italic tracking-tight">Registrar Nuevo Campamento</h3>
            </div>
            <form onSubmit={handleCreateCamp} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-widest mb-1.5">
                  Nombre del Campamento / Módulo
                </label>
                <input
                  type="text"
                  required
                  value={newCampName}
                  onChange={(e) => setNewCampName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-widest mb-1.5">
                  Ubicación Geográfica
                </label>
                <input
                  type="text"
                  value={newCampUbi}
                  onChange={(e) => setNewCampUbi(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-widest mb-1.5">
                  Tipo de Personal / Destino
                </label>
                <select
                  value={newCampTipo}
                  onChange={(e) => setNewCampTipo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="General">General (Trabajadores de Planta)</option>
                  <option value="Contratistas">Contratistas y Externos</option>
                  <option value="Staff">Personal Administrativo / Staff</option>
                  <option value="Supervisores">Supervisores e Ingenieros</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowAddCampModal(false)}
                  className="flex-1 px-4 py-2 border border-zinc-200 text-zinc-700 text-xs font-semibold rounded-lg hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs px-4 py-2 rounded-lg shadow-md"
                >
                  Guardar Campamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Room */}
      {showAddRoomModal && selectedCampamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden border border-zinc-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-zinc-950 p-6 text-white text-center">
              <h3 className="text-xl font-black uppercase italic tracking-tight">Añadir Cabaña</h3>
              <p className="text-zinc-400 text-xs mt-1">en {selectedCampamento.nombre}</p>
            </div>
            <form onSubmit={handleCreateRoom} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-widest mb-1.5">
                  Nombre de la Cabaña / Cuarto
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cabaña 101"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-widest mb-1.5">
                  Número de Camas
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  required
                  value={newRoomCamas}
                  onChange={(e) => setNewRoomCamas(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowAddRoomModal(false)}
                  className="flex-1 px-4 py-2 border border-zinc-200 text-zinc-700 text-xs font-semibold rounded-lg hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs px-4 py-2 rounded-lg shadow-md"
                >
                  Crear Cabaña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assign Person */}
      {assignmentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden border border-zinc-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="bg-amber-500 p-6 text-black flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tight leading-none">Asignar Personal</h3>
                <p className="text-amber-900 text-xs mt-1 font-bold">Cama #{assignmentTarget.numero}</p>
              </div>
              <button onClick={() => setAssignmentTarget(null)} className="text-black hover:bg-amber-600 p-1 rounded">
                <Trash2 className="w-5 h-5 opacity-0" /> {/* Ghost for spacing */}
                <span className="text-sm font-bold underline">Cerrar</span>
              </button>
            </div>
            
            <div className="p-6 border-b border-zinc-100">
              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar empleado por nombre o puesto..."
                  value={assignmentSearch}
                  onChange={(e) => setAssignmentSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-850 shadow-inner focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {filteredEmployees.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 text-sm">No se encontraron empleados.</div>
              ) : (
                <div className="space-y-1">
                  {filteredEmployees.map(emp => (
                    <div 
                      key={emp.id_empleado}
                      className="flex justify-between items-center p-3 hover:bg-zinc-50 rounded-lg border border-transparent hover:border-zinc-200 transition-colors group"
                    >
                      <div>
                        <h4 className="font-extrabold text-zinc-900 text-sm">{emp.nombre} {emp.apellido_paterno}</h4>
                      </div>
                      <button
                        onClick={() => handleAssignPerson(emp)}
                        className="bg-zinc-900 text-white hover:bg-black font-bold text-xs px-4 py-2 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                      >
                        Asignar aquí
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
