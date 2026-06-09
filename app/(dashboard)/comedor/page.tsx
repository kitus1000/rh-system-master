'use client'

import { useState } from 'react'
import { 
  Coffee, 
  Plus, 
  Users, 
  Clock, 
  CheckCircle, 
  UserCheck, 
  Search, 
  Calendar,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Utensils,
  DollarSign,
  ChefHat,
  Filter,
  Layers,
  FileSpreadsheet
} from 'lucide-react'

interface RegistroComida {
  id: string
  trabajadorId: string
  nombre: string
  puesto: string
  departamento: string
  servicio: 'Desayuno' | 'Comida' | 'Cena' | 'Colación'
  hora: string
  costo: number
  fecha: string // 'Hoy' or 'Esta Semana' to simulate
}

const MOCK_EMPLEADOS = [
  { id: 'EMP001', nombre: 'Juan Pérez Gómez', puesto: 'Operador de Excavadora', departamento: 'Operaciones Mina' },
  { id: 'EMP002', nombre: 'María Elena Silva', puesto: 'Ingeniera de Minas', departamento: 'Planificación' },
  { id: 'EMP003', nombre: 'Carlos Ruiz Díaz', puesto: 'Supervisor de Seguridad', departamento: 'Seguridad e Higiene' },
  { id: 'EMP004', nombre: 'Luis Fernando Meza', puesto: 'Técnico Electricista', departamento: 'Mantenimiento' },
  { id: 'EMP005', nombre: 'Ana Patricia Losa', puesto: 'Geóloga Senior', departamento: 'Exploración' },
  { id: 'EMP006', nombre: 'Pedro Infante Cruz', puesto: 'Operador de Volquete', departamento: 'Operaciones Mina' },
]

// Mock initial data spanning Today and earlier this week
const INITIAL_REGISTROS: RegistroComida[] = [
  { id: 'R-101', trabajadorId: 'EMP001', nombre: 'Juan Pérez Gómez', puesto: 'Operador de Excavadora', departamento: 'Operaciones Mina', servicio: 'Desayuno', hora: '06:15 AM', costo: 45, fecha: 'Hoy' },
  { id: 'R-102', trabajadorId: 'EMP003', nombre: 'Carlos Ruiz Díaz', puesto: 'Supervisor de Seguridad', departamento: 'Seguridad e Higiene', servicio: 'Desayuno', hora: '06:30 AM', costo: 45, fecha: 'Hoy' },
  { id: 'R-103', trabajadorId: 'EMP005', nombre: 'Ana Patricia Losa', puesto: 'Geóloga Senior', departamento: 'Exploración', servicio: 'Desayuno', hora: '06:45 AM', costo: 45, fecha: 'Hoy' },
  { id: 'R-104', trabajadorId: 'EMP002', nombre: 'María Elena Silva', puesto: 'Ingeniera de Minas', departamento: 'Planificación', servicio: 'Comida', hora: '01:10 PM', costo: 65, fecha: 'Hoy' },
  { id: 'R-105', trabajadorId: 'EMP004', nombre: 'Luis Fernando Meza', puesto: 'Técnico Electricista', departamento: 'Mantenimiento', servicio: 'Comida', hora: '01:25 PM', costo: 65, fecha: 'Hoy' },
  // Earlier in the week records
  { id: 'R-095', trabajadorId: 'EMP001', nombre: 'Juan Pérez Gómez', puesto: 'Operador de Excavadora', departamento: 'Operaciones Mina', servicio: 'Cena', hora: '07:30 PM', costo: 55, fecha: 'Esta Semana' },
  { id: 'R-096', trabajadorId: 'EMP002', nombre: 'María Elena Silva', puesto: 'Ingeniera de Minas', departamento: 'Planificación', servicio: 'Comida', hora: '01:15 PM', costo: 65, fecha: 'Esta Semana' },
  { id: 'R-097', trabajadorId: 'EMP006', nombre: 'Pedro Infante Cruz', puesto: 'Operador de Volquete', departamento: 'Operaciones Mina', servicio: 'Desayuno', hora: '06:10 AM', costo: 45, fecha: 'Esta Semana' },
  { id: 'R-098', trabajadorId: 'EMP005', nombre: 'Ana Patricia Losa', puesto: 'Geóloga Senior', departamento: 'Exploración', servicio: 'Desayuno', hora: '06:35 AM', costo: 45, fecha: 'Esta Semana' },
  { id: 'R-099', trabajadorId: 'EMP003', nombre: 'Carlos Ruiz Díaz', puesto: 'Supervisor de Seguridad', departamento: 'Seguridad e Higiene', servicio: 'Comida', hora: '02:00 PM', costo: 65, fecha: 'Esta Semana' },
]

export default function ComedorPage() {
  const [registros, setRegistros] = useState<RegistroComida[]>(INITIAL_REGISTROS)
  const [searchQuery, setSearchQuery] = useState('')
  const [workerSearch, setWorkerSearch] = useState('')
  const [selectedService, setSelectedService] = useState<'Desayuno' | 'Comida' | 'Cena' | 'Colación'>('Comida')

  // Price Configuration (Editable by user)
  const [priceDesayuno, setPriceDesayuno] = useState(45)
  const [priceComida, setPriceComida] = useState(65)
  const [priceCena, setPriceCena] = useState(55)
  const [priceColacion, setPriceColacion] = useState(30)
  const [isEditingPrices, setIsEditingPrices] = useState(false)

  // Chef Configuration (Editable by user)
  const [jefeCocinero, setJefeCocinero] = useState('Chef Don Carlos Méndez')
  const [isEditingChef, setIsEditingChef] = useState(false)

  // Filters
  const [deptFilter, setDeptFilter] = useState('Todos')

  // Get active price
  const getActivePrice = (serv: 'Desayuno' | 'Comida' | 'Cena' | 'Colación') => {
    if (serv === 'Desayuno') return priceDesayuno
    if (serv === 'Comida') return priceComida
    if (serv === 'Cena') return priceCena
    return priceColacion
  }

  // Stats Calculations
  const registrosHoy = registros.filter(r => r.fecha === 'Hoy')
  
  // Cost Calculations
  const costToday = registrosHoy.reduce((acc, curr) => acc + curr.costo, 0)
  const costWeek = registros.reduce((acc, curr) => acc + curr.costo, 0)
  
  // Count Calculations
  const countToday = registrosHoy.length
  const countWeek = registros.length

  const handleRegisterMeal = (empleado: typeof MOCK_EMPLEADOS[0]) => {
    const horaActual = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    const costoActual = getActivePrice(selectedService)

    const nuevoRegistro: RegistroComida = {
      id: `R-${Date.now()}`,
      trabajadorId: empleado.id,
      nombre: empleado.nombre,
      puesto: empleado.puesto,
      departamento: empleado.departamento,
      servicio: selectedService,
      hora: horaActual,
      costo: costoActual,
      fecha: 'Hoy'
    }

    setRegistros([nuevoRegistro, ...registros])
    setWorkerSearch('')
  }

  // Filter logic
  const filteredRegistros = registros.filter(r => {
    const matchesSearch = 
      r.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.trabajadorId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.servicio.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesDept = deptFilter === 'Todos' || r.departamento === deptFilter
    
    return matchesSearch && matchesDept
  })

  const filteredWorkers = MOCK_EMPLEADOS.filter(emp =>
    emp.nombre.toLowerCase().includes(workerSearch.toLowerCase()) ||
    emp.id.toLowerCase().includes(workerSearch.toLowerCase())
  )

  // Schedules config
  const HORARIOS = [
    { name: 'Desayuno', range: '05:30 AM - 08:30 AM', status: 'Cerrado', color: 'border-zinc-800 text-zinc-500' },
    { name: 'Comida', range: '12:00 PM - 03:30 PM', status: 'Abierto', color: 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5' },
    { name: 'Cena', range: '06:30 PM - 09:30 PM', status: 'Próximo', color: 'border-blue-500/20 text-blue-500' },
    { name: 'Colación Nocturna', range: '11:00 PM - 01:00 AM', status: 'Cerrado', color: 'border-zinc-800 text-zinc-500' }
  ]

  // Distinct departments for filter dropdown
  const DEPARTAMENTOS = ['Todos', 'Operaciones Mina', 'Planificación', 'Seguridad e Higiene', 'Mantenimiento', 'Exploración']

  return (
    <div className="space-y-8 pb-16 font-mono text-zinc-850">
      
      {/* Header Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-zinc-950 p-6 md:p-8 text-white border border-zinc-900 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-zinc-950 to-zinc-950 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 text-amber-500 font-semibold mb-1">
              <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
              <span>Consola de Servicios Alimenticios v2</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">
              COMEDOR INDUSTRIAL SAUCITO
            </h1>
            <p className="text-zinc-400 mt-1 max-w-xl">
              Controla consumos diarios, configura precios de comidas, filtra expedientes por departamento y supervisa la telemetría financiera semanal del comedor.
            </p>
          </div>

          {/* Chef Settings HUD Card */}
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-3 shrink-0">
            <div className="h-10 w-10 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-500 border border-amber-500/20">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[8px] text-zinc-500 uppercase block tracking-widest font-black">Jefe Cocinero de Turno</span>
              {isEditingChef ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <input
                    type="text"
                    value={jefeCocinero}
                    onChange={(e) => setJefeCocinero(e.target.value)}
                    onBlur={() => setIsEditingChef(false)}
                    className="bg-zinc-950 text-white text-xs px-2 py-0.5 rounded border border-zinc-700 outline-none"
                    autoFocus
                  />
                  <button onClick={() => setIsEditingChef(false)} className="text-[10px] text-emerald-400 font-bold hover:underline">Listo</button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <strong className="text-xs text-white">{jefeCocinero}</strong>
                  <button onClick={() => setIsEditingChef(true)} className="text-[9px] text-amber-500 hover:underline">Editar</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Telemetry Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-8 pt-8 border-t border-zinc-900">
          <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-850">
            <span className="text-[8px] text-zinc-500 uppercase block tracking-wider">Raciones Servidas Hoy</span>
            <h3 className="text-2xl font-black text-white mt-1">{countToday}</h3>
          </div>
          <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-850">
            <span className="text-[8px] text-zinc-500 uppercase block tracking-wider">Costo Consumo Hoy</span>
            <h3 className="text-2xl font-black text-emerald-400 mt-1">${costToday}.00 <span className="text-[10px] text-zinc-500">MXN</span></h3>
          </div>
          <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-850">
            <span className="text-[8px] text-zinc-500 uppercase block tracking-wider">Raciones Semanales</span>
            <h3 className="text-2xl font-black text-white mt-1">{countWeek}</h3>
          </div>
          <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-850">
            <span className="text-[8px] text-zinc-500 uppercase block tracking-wider">Costo Total Semanal</span>
            <h3 className="text-2xl font-black text-amber-500 mt-1">${costWeek}.00 <span className="text-[10px] text-zinc-500">MXN</span></h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Register Consumption Scanner & Meal Pricing settings */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Meal Pricing Configuration Widget */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
              <h2 className="text-sm font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4.5 h-4.5 text-amber-500" />
                <span>Precios de Comidas (MXN)</span>
              </h2>
              <button
                onClick={() => setIsEditingPrices(!isEditingPrices)}
                className="text-[10px] font-bold text-amber-600 hover:text-amber-700 hover:underline"
              >
                {isEditingPrices ? 'Guardar Cambios' : 'Configurar Tarifas'}
              </button>
            </div>

            {isEditingPrices ? (
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase mb-1">Desayuno</label>
                  <input
                    type="number"
                    value={priceDesayuno}
                    onChange={(e) => setPriceDesayuno(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-850 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase mb-1">Comida</label>
                  <input
                    type="number"
                    value={priceComida}
                    onChange={(e) => setPriceComida(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-850 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase mb-1">Cena</label>
                  <input
                    type="number"
                    value={priceCena}
                    onChange={(e) => setPriceCena(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-850 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase mb-1">Colación</label>
                  <input
                    type="number"
                    value={priceColacion}
                    onChange={(e) => setPriceColacion(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-850 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs font-mono">
                <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-150">
                  <span className="text-[8px] text-zinc-400 block uppercase font-black">Desayuno</span>
                  <strong className="text-zinc-800 text-sm mt-0.5 block">${priceDesayuno}</strong>
                </div>
                <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-150">
                  <span className="text-[8px] text-zinc-400 block uppercase font-black">Comida</span>
                  <strong className="text-emerald-600 text-sm mt-0.5 block">${priceComida}</strong>
                </div>
                <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-150">
                  <span className="text-[8px] text-zinc-400 block uppercase font-black">Cena</span>
                  <strong className="text-zinc-800 text-sm mt-0.5 block">${priceCena}</strong>
                </div>
                <div className="p-2.5 bg-zinc-50 rounded-xl border border-zinc-150">
                  <span className="text-[8px] text-zinc-400 block uppercase font-black">Colación</span>
                  <strong className="text-zinc-800 text-sm mt-0.5 block">${priceColacion}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Register Consumption Scanner */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-5">
            <h2 className="text-lg font-extrabold text-zinc-900 flex items-center gap-2 font-sans">
              <UserCheck className="w-5 h-5 text-amber-500" />
              <span>Escanear / Registrar Comensal</span>
            </h2>

            {/* Select Meal Type Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {(['Desayuno', 'Comida', 'Cena', 'Colación'] as const).map((serv) => {
                const isActive = selectedService === serv
                return (
                  <button
                    key={serv}
                    onClick={() => setSelectedService(serv)}
                    className={`py-2.5 text-center text-[10px] font-black uppercase rounded-lg border transition-all ${
                      isActive 
                        ? 'bg-amber-500 border-amber-500 text-black shadow-md shadow-amber-500/10'
                        : 'border-zinc-200 text-zinc-650 hover:bg-zinc-50'
                    }`}
                  >
                    {serv}
                  </button>
                )
              })}
            </div>

            {/* Search worker field */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Buscar por ID o Nombre</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="EMP001 o Juan..."
                  value={workerSearch}
                  onChange={(e) => setWorkerSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-850 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Results selection list */}
            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
              {workerSearch.length > 0 && (
                filteredWorkers.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-4">No se encontraron trabajadores.</p>
                ) : (
                  filteredWorkers.map((emp) => (
                    <div
                      key={emp.id}
                      onClick={() => handleRegisterMeal(emp)}
                      className="flex justify-between items-center p-3 border border-zinc-150 rounded-xl bg-zinc-50/50 hover:bg-amber-50/40 hover:border-amber-400 cursor-pointer transition-all duration-200"
                    >
                      <div>
                        <h5 className="font-extrabold text-zinc-900 text-xs font-sans">{emp.nombre}</h5>
                        <p className="text-[9px] text-zinc-500">{emp.puesto} | <span className="font-bold">{emp.departamento}</span></p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-zinc-400 font-mono">{emp.id}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                    </div>
                  ))
                )
              )}
              {workerSearch.length === 0 && (
                <div className="text-center py-8 text-zinc-400 text-xs border border-dashed border-zinc-200 rounded-xl">
                  <Coffee className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                  Escribe en el buscador superior para registrar consumo.
                </div>
              )}
            </div>
          </div>

          {/* Menu of the day HUD widget */}
          <div className="bg-zinc-950 border border-zinc-900 text-white rounded-2xl p-6 shadow-xl space-y-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-500/10 via-zinc-950 to-zinc-950 pointer-events-none" />
            <h2 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2 relative z-10">
              <Utensils className="w-4 h-4" />
              <span>Menú Geológico del Día</span>
            </h2>
            <div className="space-y-2 text-xs relative z-10">
              <div className="border-l-2 border-amber-500/50 pl-3">
                <span className="text-[9px] text-zinc-500 uppercase block font-bold">Plato Fuerte</span>
                <strong className="text-white text-sm">Caldo de Res con Verduras & Arroz Rojo</strong>
              </div>
              <div className="border-l-2 border-amber-500/20 pl-3">
                <span className="text-[9px] text-zinc-500 uppercase block font-bold">Acompañamiento</span>
                <p className="text-zinc-300">Tortillas de Maíz y Salsa de Molcajete</p>
              </div>
              <div className="border-l-2 border-amber-500/20 pl-3">
                <span className="text-[9px] text-zinc-500 uppercase block font-bold">Bebida / Postre</span>
                <p className="text-zinc-300">Agua de Horchata / Plátano Flameado</p>
              </div>
            </div>
            
            <div className="flex gap-2 pt-2 text-[9px] font-bold relative z-10">
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">ALTO EN PROTEÍNAS</span>
              <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">APTO DIABÉTICOS</span>
            </div>
          </div>
        </div>

        {/* Right Side: Consumption Live logs list & RICH Filters */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[580px]">
            
            {/* Logs Header with Rich Search/Filters controls */}
            <div className="bg-zinc-50 border-b border-zinc-200 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-lg font-extrabold text-zinc-900 flex items-center gap-2 font-sans">
                    <Utensils className="w-5 h-5 text-amber-500" />
                    <span>Quiénes Comieron (Consumos)</span>
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Control de registros por persona y filtrado departamental.</p>
                </div>
                
                {/* Export button */}
                <button
                  onClick={() => alert('Exportando bitácora completa del comedor a Excel/CSV...')}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-md transition-all self-stretch sm:self-auto justify-center"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Exportar Reporte</span>
                </button>
              </div>

              {/* Advanced Filter Inputs row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Filter 1: Persona search */}
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Filtrar por Persona / ID</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Nombre, ID, servicio..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-850 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Filter 2: Department dropdown */}
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Filtrar por Departamento</label>
                  <div className="relative">
                    <Filter className="absolute left-3 top-3 h-3.5 w-3.5 text-zinc-400" />
                    <select
                      value={deptFilter}
                      onChange={(e) => setDeptFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-850 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                    >
                      {DEPARTAMENTOS.map((dept, idx) => (
                        <option key={idx} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Logs Table list */}
            <div className="flex-1 overflow-y-auto max-h-[400px]">
              <table className="min-w-full divide-y divide-zinc-150 text-left text-xs font-mono">
                <thead className="bg-zinc-50 text-[9px] text-zinc-500 uppercase tracking-widest font-black">
                  <tr>
                    <th className="px-6 py-3">Fecha/Hora</th>
                    <th className="px-6 py-3">Empleado</th>
                    <th className="px-6 py-3">Departamento</th>
                    <th className="px-6 py-3">Servicio</th>
                    <th className="px-6 py-3 text-right">Porción</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-zinc-100 text-zinc-700">
                  {filteredRegistros.map((reg) => (
                    <tr key={reg.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-bold text-zinc-900 block">{reg.hora}</span>
                        <span className="text-[8px] text-zinc-400 block mt-0.5">{reg.fecha}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-zinc-900">{reg.nombre}</div>
                        <div className="text-[8px] text-zinc-400">ID: {reg.trabajadorId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-zinc-500">{reg.departamento}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-block text-[8px] font-black uppercase px-2 py-0.5 rounded border ${
                          reg.servicio === 'Desayuno' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                          reg.servicio === 'Comida' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                          reg.servicio === 'Cena' ? 'bg-blue-50 border-blue-200 text-blue-800' :
                          'bg-zinc-50 border-zinc-200 text-zinc-500'
                        }`}>
                          {reg.servicio}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-zinc-900">
                        ${reg.costo}.00
                      </td>
                    </tr>
                  ))}
                  {filteredRegistros.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-zinc-400">
                        No se encontraron registros de consumo con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Logs Footer overview */}
            <div className="bg-zinc-50 border-t border-zinc-200 p-4 px-6 flex justify-between items-center text-[10px] text-zinc-500">
              <span>* Los filtros departamentales ayudan a conciliar costos internos.</span>
              <span className="flex items-center gap-1 font-semibold text-emerald-600">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Sincronizado</span>
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
