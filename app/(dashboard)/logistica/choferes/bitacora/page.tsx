'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/utils/supabase/client'
import { 
  Bus, Users, QrCode, Search, Filter, Calendar, 
  Download, Printer, RefreshCw, FileText, CheckCircle2, 
  MapPin, Clock, Truck, HardHat, ChevronRight, User, X,
  ShieldCheck, AlertCircle, ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useAuth } from '@/components/AuthProvider'

interface PasajeroManifest {
  id: string
  nombre: string
  puesto: string
  hora: string
  metodo: string
}

interface ViajeBitacora {
  id_bitacora: string
  id_chofer?: string
  chofer_nombre: string
  camion_numero: string
  tipo_vehiculo: string
  punto_a: string
  punto_b: string
  hora_salida_a: string
  hora_llegada_b: string
  pasajeros_total: number
  pasajeros_lista: PasajeroManifest[]
  fecha: string
  creado_el: string
}

const CHOFERES_OFICIALES = [
  'Adalberto Pinales',
  'Ramon Yañez',
  'Oscar Vazquez',
  'Enrique Linares',
  'Samuel Madriles',
  'Jesus Saucedo'
]

export default function BitacoraChoferesPage() {
  const { profile } = useAuth()
  const [viajes, setViajes] = useState<ViajeBitacora[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Filtros
  const [selectedDriverFilter, setSelectedDriverFilter] = useState<string>('Todos')
  const [dateFilter, setDateFilter] = useState<'hoy' | 'semana' | 'mes' | 'todos'>('todos')
  const [searchTerm, setSearchTerm] = useState('')

  // Modal de Manifiesto
  const [selectedViajeModal, setSelectedViajeModal] = useState<ViajeBitacora | null>(null)

  // Consulta en tiempo real de Supabase
  const fetchViajes = async () => {
    try {
      const { data, error } = await supabase
        .from('logistica_reportes_diarios')
        .select(`
          id_reporte,
          id_empleado,
          fecha,
          camion_numero,
          tipo_vehiculo,
          comentarios_vehiculo,
          observaciones_recorrido,
          ubicacion_caseta,
          creado_el,
          empleados:id_empleado (id_empleado, nombre, apellido_paterno, apellido_materno)
        `)
        .order('creado_el', { ascending: false })

      if (!error && data) {
        const parsedViajes: ViajeBitacora[] = []

        data.forEach((rep: any) => {
          const com = rep.comentarios_vehiculo || ''
          let puntoA = 'Mina Bacis'
          let puntoB = rep.ubicacion_caseta || 'Parajes'
          let choferNombre = 'Chofer Operador'

          if (rep.empleados) {
            choferNombre = `${rep.empleados.nombre} ${rep.empleados.apellido_paterno || ''}`.trim()
          }

          if (com.includes('Ruta:')) {
            const rPart = com.split('Ruta:')[1]?.split('|')[0]?.trim() || ''
            const parts = rPart.split(/\s+a\s+|\s+➔\s+|\s+->\s+/i)
            if (parts.length >= 2) {
              puntoA = parts[0].trim()
              puntoB = parts[1].trim()
            } else if (rPart) {
              puntoA = rPart
            }
          }

          if (com.includes('Chofer:')) {
            const chPart = com.split('Chofer:')[1]?.split('|')[0]?.trim() || ''
            if (chPart) choferNombre = chPart
          }

          let listaPasajeros: PasajeroManifest[] = []
          try {
            if (rep.observaciones_recorrido && rep.observaciones_recorrido !== '[]') {
              const raw = JSON.parse(rep.observaciones_recorrido)
              if (Array.isArray(raw)) {
                listaPasajeros = raw.map((p: any) => ({
                  id: p.id || p.id_empleado || p.id_manual || 'ID',
                  nombre: p.nombre || p.nombre_completo || 'Trabajador',
                  puesto: p.puesto || p.puesto_depto || 'Personal Mina Bacis',
                  hora: p.hora || (p.hora_subida ? new Date(p.hora_subida).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'N/A'),
                  metodo: p.metodo || p.metodo_registro || 'QR'
                }))
              }
            }
          } catch (_) {}

          let countFromComment = 0
          if (com.includes('Pasajeros:')) {
            const pMatch = com.match(/Pasajeros:\s*(\d+)/i)
            if (pMatch) countFromComment = parseInt(pMatch[1]) || 0
          }
          const totalPasajeros = listaPasajeros.length > 0 ? listaPasajeros.length : countFromComment

          let horaSalida = rep.creado_el ? new Date(rep.creado_el).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'N/A'
          let horaLlegada = 'Completado'
          if (com.includes('Salida:')) {
            const sPart = com.split('Salida:')[1]?.split('|')[0]?.trim()
            if (sPart) horaSalida = sPart
          }
          if (com.includes('Llegada:')) {
            const lPart = com.split('Llegada:')[1]?.split('|')[0]?.trim()
            if (lPart) horaLlegada = lPart
          }

          parsedViajes.push({
            id_bitacora: rep.id_reporte,
            id_chofer: rep.id_empleado,
            chofer_nombre: choferNombre,
            camion_numero: rep.camion_numero || 'CAM-01',
            tipo_vehiculo: rep.tipo_vehiculo || 'Camioneta',
            punto_a: puntoA,
            punto_b: puntoB,
            hora_salida_a: horaSalida,
            hora_llegada_b: horaLlegada,
            pasajeros_total: totalPasajeros,
            pasajeros_lista: listaPasajeros,
            fecha: rep.fecha ? rep.fecha.toString() : (rep.creado_el ? rep.creado_el.split('T')[0] : new Date().toISOString().split('T')[0]),
            creado_el: rep.creado_el || new Date().toISOString()
          })
        })

        // Deduplicar si el ID es idéntico
        const unique = parsedViajes.filter((v, i, a) => 
          a.findIndex(t => t.id_bitacora === v.id_bitacora) === i
        )

        setViajes(unique)
        setLastUpdated(new Date())
      }
    } catch (e) {
      console.error('Error cargando bitácora:', e)
    } finally {
      setLoading(false)
    }
  }

  // Polling cada 8 segundos
  useEffect(() => {
    fetchViajes()
    const interval = setInterval(fetchViajes, 8000)
    return () => clearInterval(interval)
  }, [])

  // Filtrado
  const filteredViajes = useMemo(() => {
    return viajes.filter(v => {
      if (selectedDriverFilter !== 'Todos') {
        if (!v.chofer_nombre.toLowerCase().includes(selectedDriverFilter.toLowerCase())) return false
      }

      if (dateFilter === 'hoy') {
        const hoy = new Date().toISOString().split('T')[0]
        if (v.fecha !== hoy) return false
      } else if (dateFilter === 'semana') {
        const sieteDiasAtras = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0]
        if (v.fecha < sieteDiasAtras) return false
      } else if (dateFilter === 'mes') {
        const mesActual = new Date().toISOString().slice(0, 7)
        if (!v.fecha.startsWith(mesActual)) return false
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim()
        const matchRuta = v.punto_a.toLowerCase().includes(term) || v.punto_b.toLowerCase().includes(term)
        const matchChofer = v.chofer_nombre.toLowerCase().includes(term)
        const matchCamion = v.camion_numero.toLowerCase().includes(term)
        const matchPasajero = v.pasajeros_lista.some(p => p.nombre.toLowerCase().includes(term))
        if (!matchRuta && !matchChofer && !matchCamion && !matchPasajero) return false
      }

      return true
    })
  }, [viajes, selectedDriverFilter, dateFilter, searchTerm])

  // Estadísticas
  const stats = useMemo(() => {
    const totalViajes = filteredViajes.length
    const totalPasajeros = filteredViajes.reduce((acc, v) => acc + v.pasajeros_total, 0)
    const choferesActivos = new Set(filteredViajes.map(v => v.chofer_nombre)).size
    return { totalViajes, totalPasajeros, choferesActivos }
  }, [filteredViajes])

  // Exportar Manifiesto PDF Oficial
  const exportPDF = (v: ViajeBitacora) => {
    const doc = new jsPDF()

    // Encabezado
    doc.setFillColor(15, 23, 42) // Slate 900
    doc.rect(0, 0, 210, 35, 'F')
    
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('MINAS DE BACIS S.A. DE C.V.', 14, 15)
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('CONTROL DE TRANSPORTE Y MANIFIESTO NOMINAL DE PERSONAL', 14, 23)
    doc.text(`FOLIO: MAN-${v.id_bitacora.slice(0, 8).toUpperCase()}`, 140, 23)

    // Datos del Viaje
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('DATOS DE LA RUTA Y VEHÍCULO:', 14, 45)

    doc.setFont('helvetica', 'normal')
    doc.text(`Chofer Operador: ${v.chofer_nombre}`, 14, 52)
    doc.text(`Unidad: ${v.camion_numero} (${v.tipo_vehiculo})`, 14, 58)
    doc.text(`Ruta: ${v.punto_a} ➔ ${v.punto_b}`, 14, 64)

    doc.text(`Fecha: ${v.fecha}`, 120, 52)
    doc.text(`Hora Salida: ${v.hora_salida_a}`, 120, 58)
    doc.text(`Hora Llegada: ${v.hora_llegada_b}`, 120, 64)
    doc.text(`Total a Bordo: ${v.pasajeros_total} trabajadores`, 120, 70)

    // Tabla de Pasajeros
    const tableData = v.pasajeros_lista.length > 0 
      ? v.pasajeros_lista.map((p, idx) => [
          idx + 1,
          p.nombre,
          p.puesto,
          p.hora,
          p.metodo === 'QR' ? 'Credencial QR' : 'Registro Manual'
        ])
      : [['-', 'Sin registro detallado de pasajeros', '-', '-', '-']]

    autoTable(doc, {
      startY: 76,
      head: [['#', 'Nombre del Trabajador', 'Puesto / Depto', 'Hora Abordaje', 'Método']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 70 },
        2: { cellWidth: 60 },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 25, halign: 'center' }
      }
    })

    // Firmas
    const finalY = (doc as any).lastAutoTable.finalY + 25
    if (finalY < 260) {
      doc.setFontSize(8)
      doc.text('_____________________________', 30, finalY)
      doc.text(`Firma del Chofer: ${v.chofer_nombre}`, 30, finalY + 5)

      doc.text('_____________________________', 130, finalY)
      doc.text('Visto Bueno: Recursos Humanos / Caseta', 130, finalY + 5)
    }

    doc.save(`Manifiesto_${v.fecha}_${v.chofer_nombre.replace(/\s+/g, '_')}.pdf`)
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-zinc-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase text-emerald-600 tracking-wider">
            <Bus className="w-4 h-4" /> Bitácora Oficial de Rutas y Pasajeros
          </div>
          <h1 className="text-2xl font-black text-zinc-900 mt-1">
            Manifiestos de Traslado de Personal
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2">
            <span>Sincronización en vivo con la app de los choferes</span>
            <span>•</span>
            <span className="text-emerald-700 font-bold">
              Última actualización: {lastUpdated.toLocaleTimeString()}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={fetchViajes}
            disabled={loading}
            className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
          
          <Link
            href="/logistica/choferes"
            className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all"
          >
            <Truck className="w-4 h-4 text-emerald-400" />
            <span>Panel de Choferes</span>
          </Link>
        </div>
      </div>

      {/* Tarjetas de Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Bus className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-zinc-500 uppercase">Viajes Registrados</span>
            <div className="text-2xl font-black text-zinc-900">{stats.totalViajes}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-zinc-500 uppercase">Trabajadores Transportados</span>
            <div className="text-2xl font-black text-zinc-900">{stats.totalPasajeros}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <HardHat className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-zinc-500 uppercase">Choferes con Rutas</span>
            <div className="text-2xl font-black text-zinc-900">{stats.choferesActivos}</div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          {/* Búsqueda */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por chofer, ruta o trabajador..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Filtro por Chofer */}
          <div className="relative">
            <select
              value={selectedDriverFilter}
              onChange={e => setSelectedDriverFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-emerald-500"
            >
              <option value="Todos">👤 Todos los Choferes</option>
              {CHOFERES_OFICIALES.map(ch => (
                <option key={ch} value={ch}>👤 {ch}</option>
              ))}
            </select>
          </div>

          {/* Filtro de Fecha */}
          <div className="flex gap-1.5 p-1 bg-zinc-100 rounded-2xl">
            {(['todos', 'hoy', 'semana', 'mes'] as const).map(df => (
              <button
                key={df}
                onClick={() => setDateFilter(df)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${
                  dateFilter === df 
                    ? 'bg-white text-zinc-900 shadow-xs' 
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {df === 'todos' ? 'Todos' : (df === 'hoy' ? 'Hoy' : (df === 'semana' ? '7 Días' : 'Este Mes'))}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla de Manifiestos */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-xs overflow-hidden">
        {filteredViajes.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Bus className="w-12 h-12 text-zinc-300 mx-auto" />
            <div className="font-black text-zinc-700 text-sm">No se encontraron viajes con los filtros seleccionados.</div>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Inicia un recorrido desde la app móvil o haz clic en actualizar para recargar los datos.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Chofer & Unidad</th>
                  <th className="py-3.5 px-4">Ruta Minera</th>
                  <th className="py-3.5 px-4">Fecha y Horarios</th>
                  <th className="py-3.5 px-4 text-center">Personal a Bordo</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredViajes.map((v) => (
                  <tr key={v.id_bitacora} className="hover:bg-zinc-50/80 transition-all">
                    <td className="py-3.5 px-4">
                      <div className="font-black text-zinc-900 text-sm">{v.chofer_nombre}</div>
                      <div className="text-[11px] text-zinc-500 font-mono">{v.camion_numero} • {v.tipo_vehiculo}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-black text-zinc-900 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{v.punto_a} ➔ {v.punto_b}</span>
                      </div>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-md font-bold text-[10px] uppercase">
                        ✓ Concluido
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-zinc-800">{v.fecha}</div>
                      <div className="text-[11px] text-zinc-500 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-zinc-400" />
                        <span>{v.hora_salida_a} ➔ {v.hora_llegada_b}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200/60 font-black text-xs">
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{v.pasajeros_total} trabajadores</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedViajeModal(v)}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Ver Manifiesto</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => exportPDF(v)}
                          className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl border border-zinc-200 transition-all"
                          title="Descargar Formato PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE MANIFIESTO NOMINAL */}
      {selectedViajeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-zinc-200">
            
            {/* Header del Modal */}
            <div className="p-6 border-b border-zinc-100 flex justify-between items-start bg-slate-900 text-white">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> MANIFIESTO OFICIAL DE TRASLADO
                </span>
                <h3 className="text-lg font-black mt-1">
                  🚌 {selectedViajeModal.punto_a} ➔ {selectedViajeModal.punto_b}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Chofer: <strong>{selectedViajeModal.chofer_nombre}</strong> • Unidad: <strong>{selectedViajeModal.camion_numero}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedViajeModal(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Resumen del Viaje */}
            <div className="grid grid-cols-3 gap-2 p-4 bg-zinc-50 border-b border-zinc-100 text-xs">
              <div>
                <span className="text-zinc-400 text-[10px] block font-bold uppercase">Fecha</span>
                <strong className="text-zinc-900">{selectedViajeModal.fecha}</strong>
              </div>
              <div>
                <span className="text-zinc-400 text-[10px] block font-bold uppercase">Horario</span>
                <strong className="text-zinc-900">{selectedViajeModal.hora_salida_a} ➔ {selectedViajeModal.hora_llegada_b}</strong>
              </div>
              <div className="text-right">
                <span className="text-zinc-400 text-[10px] block font-bold uppercase">Total Pasajeros</span>
                <strong className="text-emerald-700 font-black text-sm">{selectedViajeModal.pasajeros_total} personas</strong>
              </div>
            </div>

            {/* Lista Nominal de Trabajadores */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-zinc-700">
                Lista de Trabajadores Registrados:
              </h4>

              {selectedViajeModal.pasajeros_lista.length === 0 ? (
                <div className="text-center py-8 text-zinc-400 text-xs font-bold border border-dashed rounded-2xl">
                  Sin registro nominal detallado de pasajeros para este viaje.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedViajeModal.pasajeros_lista.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-zinc-50 rounded-2xl border border-zinc-200/80 flex justify-between items-center text-xs hover:bg-emerald-50/40 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-black text-[11px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-black text-zinc-900 text-xs">{p.nombre}</div>
                          <div className="text-[11px] text-zinc-500">{p.puesto}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded bg-zinc-200/70 text-zinc-700 text-[10px] font-bold">
                          {p.metodo}
                        </span>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{p.hora}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer del Modal */}
            <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex gap-3">
              <button
                onClick={() => setSelectedViajeModal(null)}
                className="flex-1 py-3 bg-white hover:bg-zinc-100 text-zinc-800 font-bold rounded-2xl text-xs border border-zinc-200"
              >
                Cerrar
              </button>

              <button
                onClick={() => exportPDF(selectedViajeModal)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>Descargar PDF Oficial</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
