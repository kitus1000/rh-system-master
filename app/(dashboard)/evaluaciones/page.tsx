'use client'

import { useState } from 'react'
import { 
  Award, 
  Users, 
  Search, 
  Plus, 
  TrendingUp, 
  Star, 
  ShieldAlert, 
  ChevronRight, 
  Sparkles,
  FileText,
  Activity,
  CheckCircle,
  HelpCircle
} from 'lucide-react'

// Dynamic charting imports with SSR protection
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip
} from 'recharts'

interface Trabajador {
  id: string
  nombre: string
  puesto: string
  departamento: string
  foto?: string
}

interface EvaluacionMetricas {
  // RH Metrics
  puntualidad: number
  asistencia: number
  apegoNormas: number
  trabajoEquipo: number
  actitud: number
  // Dept Metrics
  productividad: number
  habilidadTecnica: number
  calidadTrabajo: number
  resolucionProblemas: number
  comunicacion: number
}

interface Evaluacion {
  id: string
  trabajadorId: string
  fecha: string
  evaluadorRH: string
  evaluadorDept: string
  comentarios: string
  metricas: EvaluacionMetricas
}

const MOCK_TRABAJADORES: Trabajador[] = [
  { id: 'EMP001', nombre: 'Juan Pérez Gómez', puesto: 'Operador de Excavadora', departamento: 'Operaciones Mina' },
  { id: 'EMP002', nombre: 'María Elena Silva', puesto: 'Ingeniera de Minas', departamento: 'Planificación' },
  { id: 'EMP003', nombre: 'Carlos Ruiz Díaz', puesto: 'Supervisor de Seguridad', departamento: 'Seguridad e Higiene' },
  { id: 'EMP004', nombre: 'Luis Fernando Meza', puesto: 'Técnico Electricista', departamento: 'Mantenimiento' },
  { id: 'EMP005', nombre: 'Ana Patricia Losa', puesto: 'Geóloga Senior', departamento: 'Exploración' },
]

const MOCK_EVALUACIONES: Record<string, Evaluacion[]> = {
  'EMP001': [
    {
      id: 'EV-101',
      trabajadorId: 'EMP001',
      fecha: '2026-05-15',
      evaluadorRH: 'Lic. Laura Fuentes',
      evaluadorDept: 'Ing. Marcos Lozano',
      comentarios: 'Juan demuestra excelente puntualidad y apego a las normas de seguridad de la mina. Se recomienda reforzar comunicación técnica.',
      metricas: {
        puntualidad: 5,
        asistencia: 5,
        apegoNormas: 5,
        trabajoEquipo: 4,
        actitud: 4,
        productividad: 4,
        habilidadTecnica: 3.5,
        calidadTrabajo: 4,
        resolucionProblemas: 3.8,
        comunicacion: 3.2
      }
    },
    {
      id: 'EV-100',
      trabajadorId: 'EMP001',
      fecha: '2026-02-10',
      evaluadorRH: 'Lic. Laura Fuentes',
      evaluadorDept: 'Ing. Marcos Lozano',
      comentarios: 'Buen desempeño general en su periodo de inducción inicial.',
      metricas: {
        puntualidad: 4.5,
        asistencia: 4,
        apegoNormas: 4.2,
        trabajoEquipo: 3.8,
        actitud: 4,
        productividad: 3.5,
        habilidadTecnica: 3.2,
        calidadTrabajo: 3.5,
        resolucionProblemas: 3,
        comunicacion: 3
      }
    }
  ],
  'EMP002': [
    {
      id: 'EV-201',
      trabajadorId: 'EMP002',
      fecha: '2026-05-20',
      evaluadorRH: 'Lic. Laura Fuentes',
      evaluadorDept: 'Ing. Alberto Ruiz',
      comentarios: 'María tiene un nivel técnico sobresaliente y gran capacidad analítica para planificar frentes de minado. Su actitud es impecable.',
      metricas: {
        puntualidad: 4.8,
        asistencia: 5,
        apegoNormas: 4.8,
        trabajoEquipo: 4.5,
        actitud: 5,
        productividad: 4.9,
        habilidadTecnica: 5,
        calidadTrabajo: 4.8,
        resolucionProblemas: 4.7,
        comunicacion: 4.5
      }
    }
  ],
  'EMP003': [
    {
      id: 'EV-301',
      trabajadorId: 'EMP003',
      fecha: '2026-05-18',
      evaluadorRH: 'Lic. Mariana Cruz',
      evaluadorDept: 'Ing. Roberto Sierra',
      comentarios: 'Excelente en el apego a normas de seguridad como es esperado en su rol. Podría mejorar la productividad en reportes finales.',
      metricas: {
        puntualidad: 4.5,
        asistencia: 4.7,
        apegoNormas: 5,
        trabajoEquipo: 4.2,
        actitud: 4.5,
        productividad: 3.5,
        habilidadTecnica: 4.5,
        calidadTrabajo: 4,
        resolucionProblemas: 4.2,
        comunicacion: 4
      }
    }
  ]
}

export default function EvaluacionesPage() {
  const [trabajadores] = useState<Trabajador[]>(MOCK_TRABAJADORES)
  const [selectedTrabajador, setSelectedTrabajador] = useState<Trabajador>(MOCK_TRABAJADORES[0])
  const [searchQuery, setSearchQuery] = useState('')
  const [evaluaciones, setEvaluaciones] = useState<Record<string, Evaluacion[]>>(MOCK_EVALUACIONES)
  const [selectedEvalIndex, setSelectedEvalIndex] = useState(0)

  // Form State for new evaluation
  const [showAddEvalModal, setShowAddEvalModal] = useState(false)
  const [newComentarios, setNewComentarios] = useState('')
  const [newRHName, setNewRHName] = useState('')
  const [newDeptName, setNewDeptName] = useState('')
  
  // Slider metrics states
  const [metPuntualidad, setMetPuntualidad] = useState(4)
  const [metAsistencia, setMetAsistencia] = useState(4)
  const [metApego, setMetApego] = useState(4)
  const [metEquipo, setMetEquipo] = useState(4)
  const [metActitud, setMetActitud] = useState(4)

  const [metProductividad, setMetProductividad] = useState(4)
  const [metTecnica, setMetTecnica] = useState(4)
  const [metCalidad, setMetCalidad] = useState(4)
  const [metResolucion, setMetResolucion] = useState(4)
  const [metComunicacion, setMetComunicacion] = useState(4)

  const currentTrabajadorEvals = evaluaciones[selectedTrabajador.id] || []
  const currentEval = currentTrabajadorEvals[selectedEvalIndex] || null

  // Chart Formatter
  const getRadarData = () => {
    if (!currentEval) return []
    const m = currentEval.metricas
    return [
      { subject: 'Puntualidad', 'Recursos Humanos': m.puntualidad, 'Departamento': m.productividad }, // Match indicators logically
      { subject: 'Asistencia / Prod', 'Recursos Humanos': m.asistencia, 'Departamento': m.productividad },
      { subject: 'Apego a Normas / Técn', 'Recursos Humanos': m.apegoNormas, 'Departamento': m.habilidadTecnica },
      { subject: 'Trabajo Equipo / Calid', 'Recursos Humanos': m.trabajoEquipo, 'Departamento': m.calidadTrabajo },
      { subject: 'Actitud / Resolución', 'Recursos Humanos': m.actitud, 'Departamento': m.resolucionProblemas },
      { subject: 'Comunicación', 'Recursos Humanos': m.trabajoEquipo, 'Departamento': m.comunicacion },
    ]
  }

  const radarData = getRadarData()

  // Calculate scores
  const getAverageScore = (evalObj: Evaluacion | null) => {
    if (!evalObj) return { rh: 0, dept: 0, global: 0 }
    const m = evalObj.metricas
    const rhAvg = (m.puntualidad + m.asistencia + m.apegoNormas + m.trabajoEquipo + m.actitud) / 5
    const deptAvg = (m.productividad + m.habilidadTecnica + m.calidadTrabajo + m.resolucionProblemas + m.comunicacion) / 5
    return {
      rh: Number(rhAvg.toFixed(1)),
      dept: Number(deptAvg.toFixed(1)),
      global: Number(((rhAvg + deptAvg) / 2).toFixed(1))
    }
  }

  const averages = getAverageScore(currentEval)

  const handleCreateEval = (e: React.FormEvent) => {
    e.preventDefault()
    const newEval: Evaluacion = {
      id: `EV-${Date.now()}`,
      trabajadorId: selectedTrabajador.id,
      fecha: new Date().toISOString().split('T')[0],
      evaluadorRH: newRHName || 'Lic. Recursos Humanos',
      evaluadorDept: newDeptName || 'Jefe de Departamento',
      comentarios: newComentarios || 'Desempeño general conforme a lo esperado.',
      metricas: {
        puntualidad: Number(metPuntualidad),
        asistencia: Number(metAsistencia),
        apegoNormas: Number(metApego),
        trabajoEquipo: Number(metEquipo),
        actitud: Number(metActitud),
        productividad: Number(metProductividad),
        habilidadTecnica: Number(metTecnica),
        calidadTrabajo: Number(metCalidad),
        resolucionProblemas: Number(metResolucion),
        comunicacion: Number(metComunicacion),
      }
    }

    const updatedEvals = { ...evaluaciones }
    if (!updatedEvals[selectedTrabajador.id]) {
      updatedEvals[selectedTrabajador.id] = []
    }
    // Prepend new evaluation
    updatedEvals[selectedTrabajador.id] = [newEval, ...updatedEvals[selectedTrabajador.id]]

    setEvaluaciones(updatedEvals)
    setSelectedEvalIndex(0)
    setShowAddEvalModal(false)

    // Reset Form
    setNewComentarios('')
    setNewRHName('')
    setNewDeptName('')
    setMetPuntualidad(4)
    setMetAsistencia(4)
    setMetApego(4)
    setMetEquipo(4)
    setMetActitud(4)
    setMetProductividad(4)
    setMetTecnica(4)
    setMetCalidad(4)
    setMetResolucion(4)
    setMetComunicacion(4)
  }

  const filteredTrabajadores = trabajadores.filter(t => 
    t.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.departamento.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-8 pb-16">
      {/* Header Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-zinc-950 p-8 text-white border border-zinc-800 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-zinc-950 to-zinc-950 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 text-amber-500 font-semibold mb-1">
              <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
              <span>Desempeño y Métricas Operativas</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">
              Evaluaciones de Desempeño
            </h1>
            <p className="text-zinc-400 mt-1 max-w-xl">
              Compara de manera interactiva las métricas internas de Recursos Humanos y el rendimiento técnico evaluado por el Jefe de Departamento.
            </p>
          </div>
          <button 
            onClick={() => setShowAddEvalModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold px-5 py-3 rounded-lg shadow-lg shadow-amber-500/20 transition-all duration-300 transform hover:scale-[1.02]"
          >
            <Plus className="w-5 h-5" />
            <span>Nueva Evaluación</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Employee List */}
        <div className="lg:col-span-4 space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-extrabold text-zinc-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-500" />
                <span>Colaboradores</span>
              </h2>
              <span className="bg-zinc-200 text-zinc-800 text-xs px-2.5 py-1 rounded-full font-bold">
                {filteredTrabajadores.length} listados
              </span>
            </div>
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar por Nombre, ID, Dept..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-lg text-zinc-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {filteredTrabajadores.map((trab) => {
              const isSelected = selectedTrabajador.id === trab.id
              const hasEvals = (evaluaciones[trab.id] || []).length > 0
              
              return (
                <div
                  key={trab.id}
                  onClick={() => {
                    setSelectedTrabajador(trab)
                    setSelectedEvalIndex(0)
                  }}
                  className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50/20 ring-1 ring-amber-500/35'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-zinc-600 border border-zinc-200 uppercase">
                    {trab.nombre.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-extrabold text-zinc-900 text-sm truncate">{trab.nombre}</h4>
                    <p className="text-xs text-zinc-500 truncate">{trab.puesto}</p>
                    <p className="text-[10px] text-zinc-400 font-medium">{trab.departamento}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] text-zinc-400 font-mono">{trab.id}</span>
                    {hasEvals ? (
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full">
                        {evaluaciones[trab.id].length} evals
                      </span>
                    ) : (
                      <span className="bg-zinc-100 text-zinc-400 text-[9px] font-bold px-2 py-0.5 rounded-full">
                        Sin evals
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Side: Charts & Analysis metrics */}
        <div className="lg:col-span-8 space-y-6">
          {/* Main Visualizer Container */}
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden min-h-[500px] flex flex-col">
            
            {/* Header info */}
            <div className="bg-zinc-50 border-b border-zinc-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-amber-100 text-amber-800 text-[10px] px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider">
                    Historial de Evaluación
                  </span>
                  <span className="text-zinc-400 text-xs font-mono">ID Colaborador: {selectedTrabajador.id}</span>
                </div>
                <h3 className="text-2xl font-black text-zinc-900 mt-1 uppercase italic leading-none">
                  {selectedTrabajador.nombre}
                </h3>
                <p className="text-xs text-zinc-500 mt-1">{selectedTrabajador.puesto} — {selectedTrabajador.departamento}</p>
              </div>

              {/* Select Evaluation Date dropdown */}
              {currentTrabajadorEvals.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Periodo:</label>
                  <select
                    value={selectedEvalIndex}
                    onChange={(e) => setSelectedEvalIndex(Number(e.target.value))}
                    className="px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {currentTrabajadorEvals.map((ev, i) => (
                      <option key={ev.id} value={i}>
                        {ev.fecha} ({i === 0 ? 'Reciente' : 'Anterior'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Content body */}
            {currentEval ? (
              <div className="p-6 space-y-8 flex-1">
                {/* Score indicators row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-xl text-center">
                    <span className="text-xs font-bold text-amber-800 uppercase block tracking-wider mb-1">Puntaje RH</span>
                    <strong className="text-3xl font-black text-amber-600">{averages.rh}</strong>
                    <span className="text-[10px] text-zinc-500 block mt-1">Puntualidad, Actitud, Normas</span>
                  </div>
                  <div className="bg-teal-500/10 border border-teal-500/20 p-5 rounded-xl text-center">
                    <span className="text-xs font-bold text-teal-800 uppercase block tracking-wider mb-1">Puntaje Dept</span>
                    <strong className="text-3xl font-black text-teal-600">{averages.dept}</strong>
                    <span className="text-[10px] text-zinc-500 block mt-1">Habilidad, Calidad, Prod</span>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl text-center text-white">
                    <span className="text-xs font-bold text-amber-400 uppercase block tracking-wider mb-1">Promedio Global</span>
                    <strong className="text-3xl font-black text-white">{averages.global}</strong>
                    <span className="text-[10px] text-zinc-400 block mt-1">Calificación de Desempeño</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                  {/* Radar Chart Visualizer (7 cols) */}
                  <div className="md:col-span-7 space-y-3">
                    <h4 className="font-extrabold text-zinc-800 text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-amber-500" />
                      <span>Gráfica de Desempeño Comparativa (Radar)</span>
                    </h4>
                    
                    <div className="h-[300px] w-full border border-zinc-150 rounded-xl bg-zinc-50/50 p-2 relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                          <PolarGrid stroke="#e4e4e7" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#71717a', fontSize: 10, fontWeight: 'bold' }} />
                          <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fill: '#71717a' }} />
                          
                          <Radar 
                            name="Recursos Humanos" 
                            dataKey="Recursos Humanos" 
                            stroke="#f59e0b" 
                            fill="#f59e0b" 
                            fillOpacity={0.4} 
                          />
                          <Radar 
                            name="Departamento" 
                            dataKey="Departamento" 
                            stroke="#0f766e" 
                            fill="#0f766e" 
                            fillOpacity={0.4} 
                          />
                          
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 'bold', paddingTop: 10 }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Summary & comments list (5 cols) */}
                  <div className="md:col-span-5 space-y-4">
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-zinc-800 text-sm">Resumen de Evaluadores</h4>
                      <p className="text-xs text-zinc-500">Evaluado el: <strong>{currentEval.fecha}</strong></p>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-lg">
                        <span className="text-[10px] font-bold text-amber-700 uppercase block">Representante de RH</span>
                        <strong className="text-zinc-800 block text-sm">{currentEval.evaluadorRH}</strong>
                      </div>
                      <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-lg">
                        <span className="text-[10px] font-bold text-teal-700 uppercase block">Jefe de Departamento</span>
                        <strong className="text-zinc-800 block text-sm">{currentEval.evaluadorDept}</strong>
                      </div>
                    </div>

                    <div className="p-4 bg-amber-50/30 border border-amber-500/20 rounded-xl space-y-1.5">
                      <h5 className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-500" />
                        <span>Comentarios y Recomendaciones</span>
                      </h5>
                      <p className="text-xs text-zinc-650 leading-relaxed italic">
                        "{currentEval.comentarios}"
                      </p>
                    </div>
                  </div>
                </div>

                {/* Score breakdown bar details */}
                <div className="pt-6 border-t border-zinc-100 space-y-4">
                  <h4 className="font-extrabold text-zinc-800 text-sm">Detalle de Calificaciones por Criterio</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* RH Column */}
                    <div className="space-y-3">
                      <h5 className="text-xs font-extrabold text-amber-600 uppercase tracking-widest border-b pb-1.5 flex justify-between items-center">
                        <span>Recursos Humanos (RH)</span>
                        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-bold">{averages.rh} / 5</span>
                      </h5>
                      <div className="space-y-2 text-xs">
                        {[
                          { label: 'Puntualidad', val: currentEval.metricas.puntualidad },
                          { label: 'Asistencia y Permanencia', val: currentEval.metricas.asistencia },
                          { label: 'Apego a Normas y Seguridad', val: currentEval.metricas.apegoNormas },
                          { label: 'Trabajo en Equipo', val: currentEval.metricas.trabajoEquipo },
                          { label: 'Actitud y Proactividad', val: currentEval.metricas.actitud }
                        ].map((item, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-zinc-600 font-semibold">{item.label}</span>
                              <strong className="text-zinc-850 font-bold">{item.val}</strong>
                            </div>
                            <div className="w-full bg-zinc-100 rounded-full h-1.5">
                              <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${(item.val / 5) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Department Column */}
                    <div className="space-y-3">
                      <h5 className="text-xs font-extrabold text-teal-700 uppercase tracking-widest border-b pb-1.5 flex justify-between items-center">
                        <span>Línea / Departamento</span>
                        <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded text-[10px] font-bold">{averages.dept} / 5</span>
                      </h5>
                      <div className="space-y-2 text-xs">
                        {[
                          { label: 'Productividad y Eficiencia', val: currentEval.metricas.productividad },
                          { label: 'Habilidad Técnica / Destreza', val: currentEval.metricas.habilidadTecnica },
                          { label: 'Calidad de Trabajo / Entregables', val: currentEval.metricas.calidadTrabajo },
                          { label: 'Resolución de Problemas', val: currentEval.metricas.resolucionProblemas },
                          { label: 'Comunicación Asertiva', val: currentEval.metricas.comunicacion }
                        ].map((item, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-zinc-600 font-semibold">{item.label}</span>
                              <strong className="text-zinc-850 font-bold">{item.val}</strong>
                            </div>
                            <div className="w-full bg-zinc-100 rounded-full h-1.5">
                              <div className="bg-teal-700 h-1.5 rounded-full" style={{ width: `${(item.val / 5) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center p-12 text-zinc-400">
                <ShieldAlert className="w-16 h-16 text-zinc-300 mb-4" />
                <h3 className="font-extrabold text-zinc-700 text-lg">Sin Evaluaciones</h3>
                <p className="text-sm text-zinc-400 mt-1 max-w-sm text-center">
                  Este colaborador no cuenta con evaluaciones registradas en el sistema todavía. Genera una evaluación haciendo clic en el botón superior.
                </p>
                <button
                  onClick={() => setShowAddEvalModal(true)}
                  className="mt-4 bg-amber-500 hover:bg-amber-600 text-black font-bold text-sm px-4 py-2.5 rounded-lg shadow"
                >
                  Registrar Primera Evaluación
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: New Evaluation Form */}
      {showAddEvalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden border border-zinc-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="bg-zinc-950 p-6 text-white flex justify-between items-start">
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tight">Nueva Evaluación de Desempeño</h3>
                <p className="text-xs text-zinc-400 mt-1">Colaborador a evaluar: <strong>{selectedTrabajador.nombre}</strong></p>
              </div>
              <button
                onClick={() => setShowAddEvalModal(false)}
                className="text-zinc-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateEval} className="p-6 space-y-6">
              {/* Evaluators credentials */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-widest mb-1">
                    Evaluador de Recursos Humanos
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nombre del evaluador de RH"
                    value={newRHName}
                    onChange={(e) => setNewRHName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-widest mb-1">
                    Jefe de Departamento / Línea
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nombre del Jefe directo"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Sliders Grid: RH & Department Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-zinc-100 pt-6">
                
                {/* RH Metrics (Amber color) */}
                <div className="space-y-4">
                  <h4 className="font-extrabold text-amber-600 text-xs uppercase tracking-widest border-b pb-1.5">
                    Métricas de Recursos Humanos (RH)
                  </h4>

                  {/* Slider: Puntualidad */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-600 font-semibold">Puntualidad</span>
                      <strong className="text-amber-600">{metPuntualidad} / 5</strong>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="0.5"
                      value={metPuntualidad}
                      onChange={(e) => setMetPuntualidad(Number(e.target.value))}
                      className="w-full h-2 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  {/* Slider: Asistencia */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-600 font-semibold">Asistencia y Permanencia</span>
                      <strong className="text-amber-600">{metAsistencia} / 5</strong>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="0.5"
                      value={metAsistencia}
                      onChange={(e) => setMetAsistencia(Number(e.target.value))}
                      className="w-full h-2 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  {/* Slider: Apego a normas */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-600 font-semibold">Apego a Normas / Seguridad</span>
                      <strong className="text-amber-600">{metApego} / 5</strong>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="0.5"
                      value={metApego}
                      onChange={(e) => setMetApego(Number(e.target.value))}
                      className="w-full h-2 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  {/* Slider: Trabajo en Equipo */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-600 font-semibold">Trabajo en Equipo</span>
                      <strong className="text-amber-600">{metEquipo} / 5</strong>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="0.5"
                      value={metEquipo}
                      onChange={(e) => setMetEquipo(Number(e.target.value))}
                      className="w-full h-2 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  {/* Slider: Actitud */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-600 font-semibold">Actitud y Proactividad</span>
                      <strong className="text-amber-600">{metActitud} / 5</strong>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="0.5"
                      value={metActitud}
                      onChange={(e) => setMetActitud(Number(e.target.value))}
                      className="w-full h-2 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                </div>

                {/* Dept Metrics (Teal color) */}
                <div className="space-y-4">
                  <h4 className="font-extrabold text-teal-700 text-xs uppercase tracking-widest border-b pb-1.5">
                    Métricas de Línea / Departamento
                  </h4>

                  {/* Slider: Productividad */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-600 font-semibold">Productividad y Desempeño</span>
                      <strong className="text-teal-700">{metProductividad} / 5</strong>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="0.5"
                      value={metProductividad}
                      onChange={(e) => setMetProductividad(Number(e.target.value))}
                      className="w-full h-2 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-teal-700"
                    />
                  </div>

                  {/* Slider: Habilidad Técnica */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-600 font-semibold">Habilidad Técnica / Destreza</span>
                      <strong className="text-teal-700">{metTecnica} / 5</strong>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="0.5"
                      value={metTecnica}
                      onChange={(e) => setMetTecnica(Number(e.target.value))}
                      className="w-full h-2 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-teal-700"
                    />
                  </div>

                  {/* Slider: Calidad de Trabajo */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-600 font-semibold">Calidad de Trabajo / Reportes</span>
                      <strong className="text-teal-700">{metCalidad} / 5</strong>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="0.5"
                      value={metCalidad}
                      onChange={(e) => setMetCalidad(Number(e.target.value))}
                      className="w-full h-2 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-teal-700"
                    />
                  </div>

                  {/* Slider: Resolucion de problemas */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-600 font-semibold">Resolución de Problemas</span>
                      <strong className="text-teal-700">{metResolucion} / 5</strong>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="0.5"
                      value={metResolucion}
                      onChange={(e) => setMetResolucion(Number(e.target.value))}
                      className="w-full h-2 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-teal-700"
                    />
                  </div>

                  {/* Slider: Comunicacion */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-600 font-semibold">Comunicación Asertiva</span>
                      <strong className="text-teal-700">{metComunicacion} / 5</strong>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="0.5"
                      value={metComunicacion}
                      onChange={(e) => setMetComunicacion(Number(e.target.value))}
                      className="w-full h-2 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-teal-700"
                    />
                  </div>

                </div>

              </div>

              {/* Textarea comments */}
              <div className="border-t border-zinc-100 pt-4">
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-widest mb-1.5">
                  Comentarios y Plan de Acción
                </label>
                <textarea
                  placeholder="Detalla los puntos fuertes del trabajador, brechas de desempeño encontradas, capacitaciones recomendadas y plan de acción de mejora..."
                  rows={3}
                  value={newComentarios}
                  onChange={(e) => setNewComentarios(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Form buttons */}
              <div className="flex gap-3 pt-4 border-t border-zinc-150 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddEvalModal(false)}
                  className="px-5 py-2.5 border border-zinc-200 text-zinc-700 text-sm font-semibold rounded-lg hover:bg-zinc-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-sm px-6 py-2.5 rounded-lg shadow-md transition-all"
                >
                  Registrar Evaluación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
