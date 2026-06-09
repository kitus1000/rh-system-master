'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { ClipboardList, Car, CheckCircle, AlertTriangle, Calendar, Clock, MapPin, Truck, X, Save, Download, FileSignature } from 'lucide-react'
import Image from 'next/image'
import SignatureCanvas from 'react-signature-canvas'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

interface Reporte {
    id_reporte: string
    id_empleado: string
    camion_numero: string
    id_viaje: string | null
    kilometraje_inicial: number
    kilometraje_final: number
    gasolina_inicio: string
    gasolina_fin: string
    litros_cargados: number
    frenos_ok: boolean
    luces_ok: boolean
    llantas_ok: boolean
    niveles_aceite_ok: boolean
    carroceria_ok: boolean
    extintor_ok: boolean
    botiquin_ok: boolean
    comentarios_vehiculo: string
    ubicacion_caseta: string
    foto_caseta_url: string
    observaciones_recorrido: string
    firma_chofer_url: string
    firma_guardia_url: string
    firma_rh_url: string
    firma_rh_nombre?: string // We'll add this optionally or derive it
    creado_el: string
    empleados: { nombre: string, apellido_paterno: string }
    logistica_viajes_programados: { destino: string, estado: string } | null
}

interface Empleado {
    id_empleado: string
    nombre: string
    apellido_paterno: string
}

export default function ReportesNubeAdmin() {
    const [reportes, setReportes] = useState<Reporte[]>([])
    const [empleadosRH, setEmpleadosRH] = useState<Empleado[]>([])
    const [loading, setLoading] = useState(true)
    
    // Modal & Signatures
    const [selectedReporte, setSelectedReporte] = useState<Reporte | null>(null)
    const [selectedRH, setSelectedRH] = useState('')
    const sigRHRef = useRef<SignatureCanvas>(null)
    const [firmaRHData, setFirmaRHData] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const reportRef = useRef<HTMLDivElement>(null)

    const fetchReportes = async () => {
        const { data, error } = await supabase
            .from('logistica_reportes_diarios')
            .select('*, empleados(nombre, apellido_paterno), logistica_viajes_programados(destino, estado)')
            .order('creado_el', { ascending: false })
        
        if (!error && data) {
            setReportes(data)
        }
        setLoading(false)
    }

    useEffect(() => {
        const init = async () => {
            await fetchReportes()
            // Fetch all active employees so Admin can choose who is signing
            const { data: emps } = await supabase.from('empleados')
                .select('id_empleado, nombre, apellido_paterno')
                .eq('estado_empleado', 'Activo')
            if (emps) setEmpleadosRH(emps)
        }
        init()
    }, [])

    const handleSignReport = async () => {
        if (!selectedRH) return alert('Selecciona quién está firmando.')
        if (!firmaRHData) return alert('Por favor, dibuja tu firma.')
        
        setSaving(true)
        const nameRH = empleadosRH.find(e => e.id_empleado === selectedRH)
        const fullNameRH = nameRH ? `${nameRH.nombre} ${nameRH.apellido_paterno}` : selectedRH

        try {
            // Update the DB
            const { error } = await supabase
                .from('logistica_reportes_diarios')
                .update({ 
                    firma_rh_url: firmaRHData,
                    firma_rh_nombre: fullNameRH // Si agregaste la columna a DB, de lo contrario esto se ignorará, lo mejor es guardar el id_empleado en otra columna o solo dejar la firma.
                })
                .eq('id_reporte', selectedReporte?.id_reporte)

            if (error) throw error
            
            // Actualizar localmente la vista
            setReportes(prev => prev.map(r => 
                r.id_reporte === selectedReporte?.id_reporte 
                ? { ...r, firma_rh_url: firmaRHData, firma_rh_nombre: fullNameRH } 
                : r
            ))
            
            alert('Firma guardada correctamente.')
            setSelectedReporte(null)
        } catch(e) {
            console.error(e)
            alert('Error guardando firma.')
        } finally {
            setSaving(false)
        }
    }

    const exportPDF = async (r: Reporte) => {
        // Para generar el PDF, necesitamos montar un div invisible temporalmente o usar el que ya tenemos
        setSelectedReporte(r)
        
        // Wait for state to update and DOM to mount the invisible report
        setTimeout(async () => {
            if (!reportRef.current) return
            setSaving(true)
            try {
                const canvas = await html2canvas(reportRef.current, { scale: 1.5, useCORS: true, logging: false })
                const imgData = canvas.toDataURL('image/jpeg', 0.8)
                
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4'
                })
                
                const pdfWidth = pdf.internal.pageSize.getWidth()
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width
                
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST')
                const choferName = r.empleados?.nombre || 'Chofer'
                pdf.save(`Reporte_Chofer_${choferName}_${r.camion_numero}_${new Date(r.creado_el).toLocaleDateString()}.pdf`)
            } catch (err: any) {
                console.error(err)
                alert('Error generando PDF: ' + (err?.message || 'Error desconocido'))
            } finally {
                setSaving(false)
                setSelectedReporte(null) // Close it back if we just wanted the PDF
            }
        }, 500)
    }

    if (loading) {
        return <div className="p-8 text-center text-zinc-500 animate-pulse font-bold">Cargando reportes de la nube...</div>
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                        <ClipboardList className="w-8 h-8 text-amber-500" /> 
                        Supervisión de Logística
                    </h1>
                    <p className="text-zinc-500 mt-1 font-medium">Historial completo de reportes, viajes y auditoría vehicular (Vista solo Administradores).</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-50 text-zinc-500 border-b border-zinc-200 uppercase text-[10px] font-black tracking-wider">
                            <tr>
                                <th className="p-4">Fecha / Hora</th>
                                <th className="p-4">Chofer</th>
                                <th className="p-4">Viaje / Destino</th>
                                <th className="p-4">Caseta</th>
                                <th className="p-4">Estatus Firma RH</th>
                                <th className="p-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                            {reportes.map(r => {
                                const fails = [
                                    !r.frenos_ok && 'Frenos', !r.luces_ok && 'Luces', !r.llantas_ok && 'Llantas', 
                                    !r.niveles_aceite_ok && 'Niveles', !r.carroceria_ok && 'Carrocería', 
                                    (!r.extintor_ok || !r.botiquin_ok) && 'Seguridad'
                                ].filter(Boolean)

                                return (
                                    <tr key={r.id_reporte} className="hover:bg-zinc-50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-zinc-900">{new Date(r.creado_el).toLocaleDateString()}</div>
                                            <div className="text-xs text-zinc-500">{new Date(r.creado_el).toLocaleTimeString()}</div>
                                        </td>
                                        <td className="p-4 font-bold text-amber-700">
                                            {r.empleados?.nombre} {r.empleados?.apellido_paterno}
                                            <div className="font-black text-zinc-700 text-xs mt-1">Camión: {r.camion_numero}</div>
                                        </td>
                                        <td className="p-4">
                                            {r.logistica_viajes_programados ? (
                                                <div>
                                                    <div className="font-bold text-zinc-800">{r.logistica_viajes_programados.destino}</div>
                                                    <div className={`text-xs font-black px-2 py-0.5 mt-1 inline-block rounded ${r.logistica_viajes_programados.estado.includes('Retraso') ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {r.logistica_viajes_programados.estado}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-zinc-400 font-bold italic">Reporte Libre</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className="font-bold text-zinc-700">{r.ubicacion_caseta}</span>
                                            {fails.length > 0 && (
                                                <div className="flex items-center gap-1 text-rose-600 mt-1 text-[10px] font-bold">
                                                    <AlertTriangle className="w-3 h-3" /> Falla Mecánica Reportada
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {r.firma_rh_url ? (
                                                <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-xs font-bold border border-emerald-100 inline-flex">
                                                    <CheckCircle className="w-3 h-3" /> Firmado
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-md text-xs font-bold border border-amber-100 inline-flex">
                                                    <Clock className="w-3 h-3" /> Pendiente
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right space-x-2">
                                            {!r.firma_rh_url ? (
                                                <button onClick={() => { setSelectedReporte(r); setFirmaRHData(null) }} className="bg-zinc-900 hover:bg-black text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm transition-all">
                                                    Revisar y Firmar
                                                </button>
                                            ) : (
                                                <button onClick={() => exportPDF(r)} disabled={saving} className="bg-gradient-to-r from-amber-500 to-amber-600 text-black text-xs font-bold px-3 py-2 rounded-lg shadow-sm transition-all inline-flex items-center gap-1">
                                                    <Download className="w-3 h-3" /> PDF
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                            {reportes.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-zinc-500">No hay reportes registrados.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL DE FIRMA */}
            {selectedReporte && !saving && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95">
                        <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50 rounded-t-2xl">
                            <h2 className="text-xl font-black text-zinc-800 flex items-center gap-2">
                                <FileSignature className="w-5 h-5 text-amber-500" /> Autorizar Viaje
                            </h2>
                            <button onClick={() => setSelectedReporte(null)} className="text-zinc-400 hover:text-black transition-colors"><X className="w-6 h-6" /></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="text-sm space-y-2 text-zinc-600">
                                <p><span className="font-bold text-zinc-900">Chofer:</span> {selectedReporte.empleados?.nombre} {selectedReporte.empleados?.apellido_paterno}</p>
                                <p><span className="font-bold text-zinc-900">Caseta:</span> {selectedReporte.ubicacion_caseta}</p>
                                <p><span className="font-bold text-zinc-900">Gasolina:</span> {selectedReporte.gasolina_inicio} {'->'} {selectedReporte.gasolina_fin} (+{selectedReporte.litros_cargados} Lts)</p>
                            </div>
                            
                            {selectedReporte.foto_caseta_url && (
                                <div className="border border-zinc-200 rounded-lg overflow-hidden">
                                    <img src={selectedReporte.foto_caseta_url} alt="Evidencia" className="w-full h-48 object-cover" />
                                </div>
                            )}

                            {!selectedReporte.firma_rh_url && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-zinc-500 uppercase">¿Quién Autoriza? (RH)</label>
                                        <select 
                                            value={selectedRH} onChange={e => setSelectedRH(e.target.value)}
                                            className="w-full mt-1 p-3 border border-zinc-200 rounded-lg text-sm font-bold bg-zinc-50 text-black"
                                        >
                                            <option value="">Selecciona tu nombre...</option>
                                            {empleadosRH.map(e => (
                                                <option key={e.id_empleado} value={e.id_empleado}>{e.nombre} {e.apellido_paterno}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="border border-zinc-200 rounded-xl overflow-hidden">
                                        <div className="bg-amber-100 px-4 py-2 flex justify-between items-center border-b border-amber-200">
                                            <span className="text-xs font-black uppercase text-amber-900">Tu Firma Digital</span>
                                            <button onClick={() => { sigRHRef.current?.clear(); setFirmaRHData(null) }} className="text-[10px] text-amber-700 hover:text-rose-500 font-bold uppercase">Limpiar</button>
                                        </div>
                                        <SignatureCanvas 
                                            ref={sigRHRef} 
                                            clearOnResize={false} 
                                            onEnd={() => setFirmaRHData(sigRHRef.current?.toDataURL() || null)}
                                            canvasProps={{className: 'w-full h-32 bg-white', style: { touchAction: 'none' }}} 
                                        />
                                    </div>
                                    <button onClick={handleSignReport} disabled={saving} className="w-full bg-zinc-950 hover:bg-zinc-900 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all mt-4">
                                        <Save className="w-5 h-5" /> Guardar Autorización
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================== */}
            {/* HIDDEN REPORT FOR PDF GENERATION */}
            {/* ========================================== */}
            {selectedReporte && (
            <div className="fixed top-0 -left-[9999px]">
                <div ref={reportRef} className="bg-white p-10 w-[800px] text-black font-sans">
                    <div style={{ borderBottom: '4px solid #f59e0b', paddingBottom: '1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h1 style={{ fontSize: '2.25rem', fontWeight: 900, fontStyle: 'italic', margin: 0, color: '#000000' }}>EL EXPEDIENTE</h1>
                            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0.25rem 0 0 0' }}>Control de Logística y Mantenimiento</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#000000' }}>REPORTE DIARIO DE OPERACIÓN</p>
                            <p style={{ color: '#71717a', margin: 0 }}>{new Date(selectedReporte.creado_el).toLocaleDateString()} - {new Date(selectedReporte.creado_el).toLocaleTimeString()}</p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                        <div>
                            <h3 style={{ backgroundColor: '#f4f4f5', fontWeight: 700, padding: '0.5rem', marginBottom: '0.5rem', textTransform: 'uppercase', fontSize: '0.75rem', color: '#000000' }}>Datos Generales</h3>
                            <p style={{ fontSize: '0.875rem', marginBottom: '0.25rem', color: '#000000' }}><span style={{ fontWeight: 700 }}>Chofer:</span> {selectedReporte.empleados?.nombre} {selectedReporte.empleados?.apellido_paterno}</p>
                            <p style={{ fontSize: '0.875rem', marginBottom: '0.25rem', color: '#000000' }}><span style={{ fontWeight: 700 }}>Camión Económico:</span> {selectedReporte.camion_numero}</p>
                            <p style={{ fontSize: '0.875rem', marginBottom: '0.25rem', color: '#000000' }}><span style={{ fontWeight: 700 }}>Ubicación / Caseta:</span> {selectedReporte.ubicacion_caseta}</p>
                            
                            <h3 style={{ backgroundColor: '#f4f4f5', fontWeight: 700, padding: '0.5rem', marginTop: '1.5rem', marginBottom: '0.5rem', textTransform: 'uppercase', fontSize: '0.75rem', color: '#000000' }}>Rendimiento</h3>
                            <p style={{ fontSize: '0.875rem', marginBottom: '0.25rem', color: '#000000' }}><span style={{ fontWeight: 700 }}>Kilometraje:</span> {selectedReporte.kilometraje_inicial} inicial - {selectedReporte.kilometraje_final} final</p>
                            <p style={{ fontSize: '0.875rem', marginBottom: '0.25rem', color: '#000000' }}><span style={{ fontWeight: 700 }}>Gasolina:</span> {selectedReporte.gasolina_inicio} inicial - {selectedReporte.gasolina_fin} final</p>
                            <p style={{ fontSize: '0.875rem', marginBottom: '0.25rem', color: '#000000' }}><span style={{ fontWeight: 700 }}>Carga de Litros:</span> {selectedReporte.litros_cargados} Lts</p>
                        </div>
                        
                        <div>
                            <h3 style={{ backgroundColor: '#f4f4f5', fontWeight: 700, padding: '0.5rem', marginBottom: '0.5rem', textTransform: 'uppercase', fontSize: '0.75rem', color: '#000000' }}>Checklist Vehicular</h3>
                            <ul style={{ fontSize: '0.875rem', listStyle: 'none', padding: 0, margin: 0, color: '#000000' }}>
                                <li style={{ marginBottom: '0.25rem' }}><span style={{ fontWeight: 700 }}>Frenos:</span> {selectedReporte.frenos_ok ? 'OK' : 'FALLA'}</li>
                                <li style={{ marginBottom: '0.25rem' }}><span style={{ fontWeight: 700 }}>Luces:</span> {selectedReporte.luces_ok ? 'OK' : 'FALLA'}</li>
                                <li style={{ marginBottom: '0.25rem' }}><span style={{ fontWeight: 700 }}>Llantas:</span> {selectedReporte.llantas_ok ? 'OK' : 'FALLA'}</li>
                                <li style={{ marginBottom: '0.25rem' }}><span style={{ fontWeight: 700 }}>Aceite/Niveles:</span> {selectedReporte.niveles_aceite_ok ? 'OK' : 'FALLA'}</li>
                                <li style={{ marginBottom: '0.25rem' }}><span style={{ fontWeight: 700 }}>Carrocería:</span> {selectedReporte.carroceria_ok ? 'OK' : 'FALLA'}</li>
                                <li style={{ marginBottom: '0.25rem' }}><span style={{ fontWeight: 700 }}>Extintor/Botiquín:</span> {selectedReporte.extintor_ok && selectedReporte.botiquin_ok ? 'OK' : 'FALTANTE'}</li>
                            </ul>
                            {selectedReporte.comentarios_vehiculo && (
                                <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '0.25rem' }}>
                                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9f1239', textTransform: 'uppercase', margin: 0 }}>Observaciones para Mantenimiento:</p>
                                    <p style={{ fontSize: '0.875rem', marginTop: '0.25rem', margin: 0, color: '#000000' }}>{selectedReporte.comentarios_vehiculo}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {selectedReporte.foto_caseta_url && (
                        <div style={{ marginBottom: '2rem', pageBreakInside: 'avoid' }}>
                            <h3 style={{ backgroundColor: '#f4f4f5', fontWeight: 700, padding: '0.5rem', marginBottom: '1rem', textTransform: 'uppercase', fontSize: '0.75rem', color: '#000000' }}>Evidencia Fotográfica</h3>
                            <img src={selectedReporte.foto_caseta_url} alt="Evidencia" style={{ maxHeight: '16rem', objectFit: 'contain', borderRadius: '0.5rem', border: '2px solid #e4e4e7', display: 'block', maxWidth: '100%' }} />
                        </div>
                    )}

                    <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #d4d4d8', pageBreakInside: 'avoid' }}>
                        <h3 style={{ textAlign: 'center', fontWeight: 900, textTransform: 'uppercase', fontSize: '1.125rem', marginBottom: '3rem', color: '#000000' }}>Cuadro de Firmas y Autorizaciones</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ height: '6rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', borderBottom: '1px solid #000000', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                                    {selectedReporte.firma_chofer_url && (
                                        <img src={selectedReporte.firma_chofer_url} alt="Firma Chofer" style={{ maxHeight: '5rem', maxWidth: '100%' }} />
                                    )}
                                </div>
                                <p style={{ fontWeight: 700, fontSize: '0.875rem', margin: 0, color: '#000000' }}>{selectedReporte.empleados?.nombre} {selectedReporte.empleados?.apellido_paterno}</p>
                                <p style={{ fontSize: '0.75rem', color: '#71717a', margin: 0 }}>Operador de la Unidad</p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ height: '6rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', borderBottom: '1px solid #000000', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                                    {selectedReporte.firma_guardia_url && (
                                        <img src={selectedReporte.firma_guardia_url} alt="Firma Guardia" style={{ maxHeight: '5rem', maxWidth: '100%' }} />
                                    )}
                                </div>
                                <p style={{ fontWeight: 700, fontSize: '0.875rem', margin: 0, color: '#000000' }}>Firma del Guardia</p>
                                <p style={{ fontSize: '0.75rem', color: '#71717a', margin: 0 }}>Receptor en Caseta</p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ height: '6rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', borderBottom: '1px solid #000000', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                                    {selectedReporte.firma_rh_url && (
                                        <img src={selectedReporte.firma_rh_url} alt="Firma RH" style={{ maxHeight: '5rem', maxWidth: '100%' }} />
                                    )}
                                </div>
                                <p style={{ fontWeight: 700, fontSize: '0.875rem', margin: 0, color: '#000000' }}>{selectedReporte.firma_rh_nombre || 'Visto Bueno RRHH'}</p>
                                <p style={{ fontSize: '0.75rem', color: '#71717a', margin: 0 }}>Superintendencia / RH</p>
                            </div>
                        </div>
                    </div>
                    
                    <div style={{ marginTop: '3rem', textAlign: 'center', fontSize: '0.75rem', color: '#a1a1aa' }}>
                        Documento generado automáticamente por El Expediente System V2. 
                        Las firmas digitales tienen validez para auditoría interna.
                    </div>
                </div>
            </div>
            )}

        </div>
    )
}
