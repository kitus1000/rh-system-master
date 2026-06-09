'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Camera, Car, CheckCircle, Droplet, FileSignature, FileText, Fuel, Upload, User, Save, Download, Truck, Calendar, History, Clock, MapPin, AlertTriangle } from 'lucide-react'
import SignatureCanvas from 'react-signature-canvas'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

interface Chofer {
  id_empleado: string
  nombre: string
  apellido_paterno: string
}

interface Viaje {
  id_viaje: string
  destino: string
  fecha_esperada: string
  hora_esperada: string
  estado: string
}

export default function ChoferesClient() {
  const [activeTab, setActiveTab] = useState<'reporte' | 'programar' | 'historial'>('reporte')
  
  const [choferes, setChoferes] = useState<Chofer[]>([])
  const [selectedChofer, setSelectedChofer] = useState('')
  const [camion, setCamion] = useState('')
  
  // Programar Viaje State
  const [nuevoDestino, setNuevoDestino] = useState('')
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevaHora, setNuevaHora] = useState('')
  const [misViajes, setMisViajes] = useState<Viaje[]>([])
  const [selectedViaje, setSelectedViaje] = useState('')
  const [miHistorial, setMiHistorial] = useState<any[]>([])
  
  // Checklist State
  const [checklist, setChecklist] = useState({
    frenos_ok: true, luces_ok: true, llantas_ok: true, niveles_aceite_ok: true,
    carroceria_ok: true, extintor_ok: true, botiquin_ok: true
  })
  const [comentariosVehiculo, setComentariosVehiculo] = useState('')
  
  // Gas & KMs
  const [kmInicial, setKmInicial] = useState('')
  const [kmFinal, setKmFinal] = useState('')
  const [gasInicio, setGasInicio] = useState('1/2')
  const [gasFin, setGasFin] = useState('1/2')
  const [litros, setLitros] = useState('')
  
  // Caseta / Recorrido
  const [caseta, setCaseta] = useState('')
  const [obsCaseta, setObsCaseta] = useState('')
  const [fotoBase64, setFotoBase64] = useState<string | null>(null)
  
  // Signatures Refs & Data
  const sigChoferRef = useRef<SignatureCanvas>(null)
  const sigGuardiaRef = useRef<SignatureCanvas>(null)
  const [firmaChoferData, setFirmaChoferData] = useState<string | null>(null)
  const [firmaGuardiaData, setFirmaGuardiaData] = useState<string | null>(null)

  // Loading state
  const [saving, setSaving] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  // ===============================
  // LOCAL STORAGE (AUTOGUARDADO)
  // ===============================
  useEffect(() => {
    const saved = localStorage.getItem('chofer_draft_v1')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        if (data.selectedChofer) setSelectedChofer(data.selectedChofer)
        if (data.camion) setCamion(data.camion)
        if (data.kmInicial) setKmInicial(data.kmInicial)
        if (data.kmFinal) setKmFinal(data.kmFinal)
        if (data.gasInicio) setGasInicio(data.gasInicio)
        if (data.gasFin) setGasFin(data.gasFin)
        if (data.litros) setLitros(data.litros)
        if (data.caseta) setCaseta(data.caseta)
        if (data.obsCaseta) setObsCaseta(data.obsCaseta)
        if (data.comentariosVehiculo) setComentariosVehiculo(data.comentariosVehiculo)
        if (data.checklist) setChecklist(data.checklist)
        if (data.fotoBase64) setFotoBase64(data.fotoBase64)
      } catch (e) {
        console.error("Error al recuperar borrador", e)
      }
    }
  }, [])

  useEffect(() => {
    // Guarda el borrador con cada cambio, excepto firmas (las firmas en base64 pueden saturar la memoria rápido si no tenemos cuidado, aunque es opcional. La foto se guarda).
    const draft = {
      selectedChofer, camion, kmInicial, kmFinal, gasInicio, gasFin, litros,
      caseta, obsCaseta, comentariosVehiculo, checklist, fotoBase64
    }
    localStorage.setItem('chofer_draft_v1', JSON.stringify(draft))
  }, [selectedChofer, camion, kmInicial, kmFinal, gasInicio, gasFin, litros, caseta, obsCaseta, comentariosVehiculo, checklist, fotoBase64])
  // ===============================

  useEffect(() => {
    // Fetch drivers
    const fetchChoferes = async () => {
      const { data } = await supabase.from('empleados').select('id_empleado, nombre, apellido_paterno').eq('estado_empleado', 'Activo')
      setChoferes(data || [])
    }
    fetchChoferes()
  }, [])

  useEffect(() => {
    if (!selectedChofer) return
    const fetchViajes = async () => {
      const { data } = await supabase.from('logistica_viajes_programados')
        .select('*')
        .eq('id_empleado', selectedChofer)
        .in('estado', ['Programado', 'Retrasado'])
        .order('fecha_esperada', { ascending: true })
      setMisViajes(data || [])
      
      const { data: hist } = await supabase.from('logistica_reportes_diarios')
        .select('*, logistica_viajes_programados(destino)')
        .eq('id_empleado', selectedChofer)
        .order('creado_el', { ascending: false })
        .limit(10)
      setMiHistorial(hist || [])
    }
    fetchViajes()
  }, [selectedChofer, activeTab])

  const handleProgramarViaje = async () => {
    if (!selectedChofer || !nuevoDestino || !nuevaFecha || !nuevaHora) return alert('Llena todos los campos')
    
    // Validar que no programe viajes en el pasado
    const limite = new Date(`${nuevaFecha}T${nuevaHora}`)
    if (limite < new Date()) {
        return alert('No puedes programar un viaje con hora en el pasado. El sistema de auditoría lo bloquea.')
    }

    setSaving(true)
    try {
        const { error } = await supabase.from('logistica_viajes_programados').insert([{
            id_empleado: selectedChofer,
            destino: nuevoDestino,
            fecha_esperada: nuevaFecha,
            hora_esperada: nuevaHora,
            estado: 'Programado'
        }])
        if (error) throw error
        alert('Viaje Programado Exitosamente')
        setNuevoDestino(''); setNuevaFecha(''); setNuevaHora('')
        setActiveTab('reporte')
    } catch (e) {
        console.error(e)
        alert('Error al programar (Asegúrate de haber corrido el nuevo SQL)')
    } finally {
        setSaving(false)
    }
  }

  // Image compression (medium res)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 500
        const scaleSize = MAX_WIDTH / img.width
        canvas.width = MAX_WIDTH
        canvas.height = img.height * scaleSize
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
        setFotoBase64(canvas.toDataURL('image/jpeg', 0.4)) // 40% quality para reducir peso
      }
    }
  }



  const handleSaveToDB = async () => {
      if(!selectedChofer || !camion) {
          alert('Por favor selecciona chofer y camión')
          return
      }
      setSaving(true)
      try {
          const payload = {
              id_empleado: selectedChofer,
              camion_numero: camion,
              id_viaje: selectedViaje || null,
              kilometraje_inicial: parseInt(kmInicial) || 0,
              kilometraje_final: parseInt(kmFinal) || 0,
              gasolina_inicio: gasInicio,
              gasolina_fin: gasFin,
              litros_cargados: parseFloat(litros) || 0,
              ...checklist,
              comentarios_vehiculo: comentariosVehiculo,
              ubicacion_caseta: caseta,
              foto_caseta_url: fotoBase64, // we save the base64 directly to the db for this presentation so it works immediately without bucket issues
              observaciones_recorrido: obsCaseta,
              firma_chofer_url: firmaChoferData,
              firma_guardia_url: firmaGuardiaData,
              firma_rh_url: null
          }

          const { error } = await supabase.from('logistica_reportes_diarios').insert([payload])
          if (error) throw error

          // Si seleccionó un viaje, actualizar su estado
          if (selectedViaje) {
              const viajeAsociado = misViajes.find(v => v.id_viaje === selectedViaje)
              if (viajeAsociado) {
                  const limite = new Date(`${viajeAsociado.fecha_esperada}T${viajeAsociado.hora_esperada}`)
                  const estatusFinal = new Date() > limite ? 'Completado con Retraso' : 'Completado'
                  await supabase.from('logistica_viajes_programados').update({ estado: estatusFinal }).eq('id_viaje', selectedViaje)
              }
          }
          
          alert('Reporte guardado con éxito en la nube.')
          localStorage.removeItem('chofer_draft_v1')
          setActiveTab('historial')
          // Reset signatures
          sigChoferRef.current?.clear(); setFirmaChoferData(null)
          sigGuardiaRef.current?.clear(); setFirmaGuardiaData(null)
          setFotoBase64(null)
      } catch (err) {
          console.error(err)
          alert('Asegúrate de haber ejecutado el archivo SQL en Supabase.')
      } finally {
          setSaving(false)
      }
  }

  const ChecklistItem = ({ label, field }: { label: string, field: keyof typeof checklist }) => (
    <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-200">
        <span className="text-sm font-bold text-zinc-700">{label}</span>
        <div className="flex gap-2">
            <button 
                onClick={() => setChecklist(p => ({...p, [field]: true}))}
                className={`px-4 py-1.5 rounded text-xs font-black uppercase transition-all ${checklist[field] ? 'bg-emerald-500 text-white shadow-md' : 'bg-zinc-200 text-zinc-500'}`}
            >OK</button>
            <button 
                onClick={() => setChecklist(p => ({...p, [field]: false}))}
                className={`px-4 py-1.5 rounded text-xs font-black uppercase transition-all ${!checklist[field] ? 'bg-rose-500 text-white shadow-md' : 'bg-zinc-200 text-zinc-500'}`}
            >Falla</button>
        </div>
    </div>
  )

  const clearSignature = (ref: React.RefObject<SignatureCanvas | null>, setter: (val: string | null) => void) => {
      ref.current?.clear()
      setter(null)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 font-sans">
        
        {/* Header Movil */}
        <div className="bg-zinc-950 p-6 rounded-2xl text-white shadow-xl relative overflow-hidden mb-4">
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <Truck className="w-32 h-32" />
            </div>
            <h1 className="text-2xl font-black italic tracking-tight relative z-10">Portal Chofer</h1>
            <p className="text-zinc-400 text-sm mt-1 relative z-10">Logística y Operaciones</p>
        </div>

        {/* Identificación Obligatoria */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4 mb-4">
            <label className="text-xs font-bold text-zinc-500 uppercase">¿Quién eres?</label>
            <select 
                value={selectedChofer} onChange={e => setSelectedChofer(e.target.value)}
                className="w-full mt-1 p-3 border border-zinc-200 rounded-lg text-sm bg-zinc-50 font-bold text-black"
            >
                <option value="">Selecciona tu perfil de chofer...</option>
                {choferes.map(c => (
                    <option key={c.id_empleado} value={c.id_empleado}>{c.nombre} {c.apellido_paterno}</option>
                ))}
            </select>
        </div>

        {/* Pestañas de Navegación */}
        {selectedChofer && (
            <div className="flex gap-2 p-1 bg-zinc-200 rounded-lg overflow-x-auto mb-4 hide-scrollbar">
                <button onClick={() => setActiveTab('programar')} className={`flex-1 min-w-[120px] py-2 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'programar' ? 'bg-white shadow-sm text-black' : 'text-zinc-500 hover:text-black'}`}>
                    <Calendar className="w-4 h-4" /> Programar Viaje
                </button>
                <button onClick={() => setActiveTab('reporte')} className={`flex-1 min-w-[120px] py-2 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'reporte' ? 'bg-white shadow-sm text-black' : 'text-zinc-500 hover:text-black'}`}>
                    <FileSignature className="w-4 h-4" /> Nuevo Reporte
                </button>
                <button onClick={() => setActiveTab('historial')} className={`flex-1 min-w-[120px] py-2 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'historial' ? 'bg-white shadow-sm text-black' : 'text-zinc-500 hover:text-black'}`}>
                    <History className="w-4 h-4" /> Historial
                </button>
            </div>
        )}

        {/* TAB: PROGRAMAR VIAJE */}
        {selectedChofer && activeTab === 'programar' && (
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4 sm:p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <h2 className="text-lg font-black text-zinc-800 flex items-center gap-2 border-b pb-2">
                    <MapPin className="w-5 h-5 text-amber-500" /> Declarar Próximo Viaje
                </h2>
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase">Lugar de Destino</label>
                    <input type="text" value={nuevoDestino} onChange={e => setNuevoDestino(e.target.value)} placeholder="Ej. Cedis Monterrey" className="w-full mt-1 p-3 border border-zinc-200 rounded-lg text-sm font-bold bg-zinc-50" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase">Fecha de Llegada Esperada</label>
                        <input type="date" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)} className="w-full mt-1 p-3 border border-zinc-200 rounded-lg text-sm bg-zinc-50" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase">Hora Límite</label>
                        <input type="time" value={nuevaHora} onChange={e => setNuevaHora(e.target.value)} className="w-full mt-1 p-3 border border-zinc-200 rounded-lg text-sm bg-zinc-50" />
                    </div>
                </div>
                <button onClick={handleProgramarViaje} disabled={saving} className="w-full bg-zinc-950 hover:bg-zinc-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all mt-4">
                    {saving ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <Save className="w-5 h-5" />}
                    Registrar Viaje
                </button>
            </div>
        )}

        {/* TAB: HISTORIAL */}
        {selectedChofer && activeTab === 'historial' && (
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4 sm:p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <h2 className="text-lg font-black text-zinc-800 flex items-center gap-2 border-b pb-2">
                    <History className="w-5 h-5 text-amber-500" /> Mis Últimos Reportes
                </h2>
                {miHistorial.length === 0 ? (
                    <div className="text-center p-8 text-zinc-400 font-bold">No tienes reportes guardados aún.</div>
                ) : (
                    <div className="space-y-3">
                        {miHistorial.map(h => (
                            <div key={h.id_reporte} className="border border-zinc-200 rounded-xl p-4 bg-zinc-50">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded">{new Date(h.creado_el).toLocaleDateString()}</span>
                                    <span className="text-xs font-black text-zinc-400">{new Date(h.creado_el).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-sm font-bold text-zinc-800">Camión: {h.camion_numero}</p>
                                <p className="text-xs text-zinc-600 mt-1">Ubicación reportada: <span className="font-bold">{h.ubicacion_caseta}</span></p>
                                {h.logistica_viajes_programados?.destino && (
                                    <p className="text-xs text-emerald-600 mt-1 font-bold">✓ Amarrado al viaje: {h.logistica_viajes_programados.destino}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* TAB: NUEVO REPORTE */}
        {selectedChofer && activeTab === 'reporte' && (
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4 sm:p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4">
            
            {/* 1. Datos Generales */}
            <section className="space-y-4">
                <h2 className="text-lg font-black text-zinc-800 flex items-center gap-2 border-b pb-2">
                    <Car className="w-5 h-5 text-amber-500" /> 1. Datos de Operación
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Vincular a Viaje Programado</label>
                        <select 
                            value={selectedViaje} onChange={e => setSelectedViaje(e.target.value)}
                            className="w-full mt-1 p-3 border border-amber-300 rounded-lg text-sm bg-amber-50 font-bold text-amber-900"
                        >
                            <option value="">-- Reporte Libre (Sin viaje programado) --</option>
                            {misViajes.map(v => (
                                <option key={v.id_viaje} value={v.id_viaje}>
                                    Destino: {v.destino} (Límite: {v.fecha_esperada} {v.hora_esperada}) - {v.estado}
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-zinc-400 mt-1">Si seleccionas un viaje, el sistema registrará automáticamente si llegaste a tiempo o con retraso.</p>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase">No. Económico Camión</label>
                        <input type="text" value={camion} onChange={e => setCamion(e.target.value)} placeholder="Ej. CAM-04" className="w-full mt-1 p-3 border border-zinc-200 rounded-lg text-sm font-bold bg-zinc-50" />
                    </div>
                </div>
            </section>

            {/* 2. Combustible y Kilometraje */}
            <section className="space-y-4">
                <h2 className="text-lg font-black text-zinc-800 flex items-center gap-2 border-b pb-2">
                    <Fuel className="w-5 h-5 text-amber-500" /> 2. Rendimiento
                </h2>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase">Km Inicial</label>
                        <input type="number" value={kmInicial} onChange={e => setKmInicial(e.target.value)} className="w-full mt-1 p-3 border border-zinc-200 rounded-lg text-sm bg-zinc-50" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase">Km Final</label>
                        <input type="number" value={kmFinal} onChange={e => setKmFinal(e.target.value)} className="w-full mt-1 p-3 border border-zinc-200 rounded-lg text-sm bg-zinc-50" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase">Gasolina Inicial</label>
                        <select value={gasInicio} onChange={e => setGasInicio(e.target.value)} className="w-full mt-1 p-3 border border-zinc-200 rounded-lg text-sm bg-zinc-50">
                            <option>Reserva</option><option>1/4</option><option>1/2</option><option>3/4</option><option>Lleno</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase">Gasolina Final</label>
                        <select value={gasFin} onChange={e => setGasFin(e.target.value)} className="w-full mt-1 p-3 border border-zinc-200 rounded-lg text-sm bg-zinc-50">
                            <option>Reserva</option><option>1/4</option><option>1/2</option><option>3/4</option><option>Lleno</option>
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Litros Cargados (Tickets)</label>
                        <input type="number" value={litros} onChange={e => setLitros(e.target.value)} placeholder="Ej. 40" className="w-full mt-1 p-3 border border-zinc-200 rounded-lg text-sm bg-zinc-50" />
                    </div>
                </div>
            </section>

            {/* 3. Checklist Vehicular */}
            <section className="space-y-4">
                <h2 className="text-lg font-black text-zinc-800 flex items-center gap-2 border-b pb-2">
                    <Car className="w-5 h-5 text-amber-500" /> 3. Inspección Física
                </h2>
                <div className="space-y-2">
                    <ChecklistItem label="Sistema de Frenos" field="frenos_ok" />
                    <ChecklistItem label="Luces (Faros, Intermitentes)" field="luces_ok" />
                    <ChecklistItem label="Estado de Llantas" field="llantas_ok" />
                    <ChecklistItem label="Niveles (Aceite, Agua)" field="niveles_aceite_ok" />
                    <ChecklistItem label="Daños Carrocería / Espejos" field="carroceria_ok" />
                    <ChecklistItem label="Extintor" field="extintor_ok" />
                    <ChecklistItem label="Botiquín de Primeros Auxilios" field="botiquin_ok" />
                </div>
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase">Comentarios para Mantenimiento</label>
                    <textarea 
                        rows={3} value={comentariosVehiculo} onChange={e => setComentariosVehiculo(e.target.value)}
                        placeholder="Si marcaste alguna falla, descríbela aquí..."
                        className="w-full mt-1 p-3 border border-zinc-200 rounded-lg text-sm bg-zinc-50"
                    />
                </div>
            </section>

            {/* 4. Evidencia Recorrido */}
            <section className="space-y-4">
                <h2 className="text-lg font-black text-zinc-800 flex items-center gap-2 border-b pb-2">
                    <Camera className="w-5 h-5 text-amber-500" /> 4. Evidencia de Destino
                </h2>
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase">Ubicación / Caseta de Llegada</label>
                    <input type="text" value={caseta} onChange={e => setCaseta(e.target.value)} placeholder="Ej. Caseta Durango Norte" className="w-full mt-1 p-3 border border-zinc-200 rounded-lg text-sm bg-zinc-50" />
                </div>
                
                <div className="mt-4 border-2 border-dashed border-zinc-300 rounded-xl p-6 text-center bg-zinc-50 relative overflow-hidden">
                    {fotoBase64 ? (
                        <div className="space-y-4">
                            <img src={fotoBase64} alt="Evidencia" className="mx-auto rounded-lg max-h-48 object-cover" />
                            <button onClick={() => setFotoBase64(null)} className="text-xs font-bold text-rose-500 underline">Tomar otra foto</button>
                        </div>
                    ) : (
                        <div>
                            <Camera className="w-10 h-10 text-zinc-400 mx-auto mb-2" />
                            <p className="text-sm font-bold text-zinc-600 mb-4">Capturar Evidencia Visual</p>
                            <label className="bg-amber-500 hover:bg-amber-600 text-black px-6 py-3 rounded-lg font-bold shadow-md cursor-pointer inline-flex items-center gap-2 transition-all">
                                <Upload className="w-4 h-4" />
                                Abrir Cámara
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                            </label>
                        </div>
                    )}
                </div>
            </section>

            {/* 5. Firmas */}
            <section className="space-y-6">
                <h2 className="text-lg font-black text-zinc-800 flex items-center gap-2 border-b pb-2">
                    <FileSignature className="w-5 h-5 text-amber-500" /> 5. Firmas de Autorización
                </h2>
                
                <div className="space-y-6">
                    {/* Firma Chofer */}
                    <div className="border border-zinc-200 rounded-xl overflow-hidden">
                        <div className="bg-zinc-100 px-4 py-2 flex justify-between items-center border-b border-zinc-200">
                            <span className="text-xs font-black uppercase text-zinc-700">Firma del Chofer</span>
                            <button onClick={() => clearSignature(sigChoferRef, setFirmaChoferData)} className="text-[10px] text-zinc-500 hover:text-rose-500 font-bold uppercase">Limpiar</button>
                        </div>
                        <SignatureCanvas 
                            ref={sigChoferRef} 
                            clearOnResize={false} 
                            onEnd={() => setFirmaChoferData(sigChoferRef.current?.toDataURL() || null)}
                            canvasProps={{className: 'w-full h-32 bg-white', style: { touchAction: 'none' }}} 
                        />
                    </div>

                    {/* Firma Guardia */}
                    <div className="border border-zinc-200 rounded-xl overflow-hidden">
                        <div className="bg-zinc-100 px-4 py-2 flex justify-between items-center border-b border-zinc-200">
                            <span className="text-xs font-black uppercase text-zinc-700">Firma Guardia / Receptor</span>
                            <button onClick={() => clearSignature(sigGuardiaRef, setFirmaGuardiaData)} className="text-[10px] text-zinc-500 hover:text-rose-500 font-bold uppercase">Limpiar</button>
                        </div>
                        <SignatureCanvas 
                            ref={sigGuardiaRef} 
                            clearOnResize={false} 
                            onEnd={() => setFirmaGuardiaData(sigGuardiaRef.current?.toDataURL() || null)}
                            canvasProps={{className: 'w-full h-32 bg-white', style: { touchAction: 'none' }}} 
                        />
                    </div>
                </div>
            </section>

            {/* Actions */}
            <div className="pt-6 border-t border-zinc-200 flex flex-col sm:flex-row gap-4">
                <button 
                    onClick={handleSaveToDB}
                    disabled={saving}
                    className="flex-1 bg-zinc-950 hover:bg-zinc-900 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                    {saving ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <Save className="w-5 h-5" />}
                    Enviar y Guardar en Base de Datos
                </button>
            </div>
        </div>
        )}




    </div>
  )
}
