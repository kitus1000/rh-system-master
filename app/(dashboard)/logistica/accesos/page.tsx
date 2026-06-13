'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Truck, Users, Key, PenTool, FileDown, Mail, ArrowRight, ArrowLeft, CheckCircle2, ShieldCheck, MapPin } from 'lucide-react'
import SignatureCanvas from 'react-signature-canvas'
import jsPDF from 'jspdf'

export default function AccesosVehiculosPage() {
    const [mounted, setMounted] = useState(false)
    const [step, setStep] = useState(1)
    
    // Catalogos
    const [camiones, setCamiones] = useState<any[]>([])
    const [empleados, setEmpleados] = useState<any[]>([])
    const [departamentos, setDepartamentos] = useState<any[]>([])
    
    // Formulario
    const [idCamion, setIdCamion] = useState('')
    const [tipoMovimiento, setTipoMovimiento] = useState('Entrada')
    const [idChofer, setIdChofer] = useState('')
    
    // Pasajeros
    const [pasajeros, setPasajeros] = useState<any[]>([])
    const [depSeleccionado, setDepSeleccionado] = useState('')
    const [empSeleccionado, setEmpSeleccionado] = useState('')

    // Firmas
    const [firmas, setFirmas] = useState<{[key: string]: string}>({})
    // Referencias a los canvas (un ref por departamento)
    const sigRefs = useRef<{[key: string]: any}>({})

    // Resultado
    const [codigoAcceso, setCodigoAcceso] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        setMounted(true)
        fetchData()
    }, [])

    const fetchData = async () => {
        const { data: cam } = await supabase.from('logistica_camiones').select('*').eq('activo', true)
        if (cam) setCamiones(cam)

        const { data: emp } = await supabase.from('empleados').select('id_empleado, nombre, apellido_paterno, apellido_materno')
        if (emp) setEmpleados(emp)

        const { data: dep } = await supabase.from('cat_departamentos').select('*').eq('activo', true)
        if (dep) setDepartamentos(dep)
    }

    const addPasajero = () => {
        if (!depSeleccionado || !empSeleccionado) return
        
        const emp = empleados.find(e => e.id_empleado === empSeleccionado)
        const dep = departamentos.find(d => d.id_departamento === depSeleccionado)
        
        // Evitar duplicados
        if (pasajeros.find(p => p.id_empleado === empSeleccionado)) return

        setPasajeros([...pasajeros, {
            id_empleado: emp.id_empleado,
            nombre: `${emp.nombre} ${emp.apellido_paterno}`,
            id_departamento: dep.id_departamento,
            departamento: dep.departamento
        }])
        setEmpSeleccionado('')
    }

    const getDepartamentosInvolucrados = () => {
        const deps = new Set(pasajeros.map(p => p.id_departamento))
        return Array.from(deps).map(id => departamentos.find(d => d.id_departamento === id))
    }

    const handleSaveSignature = (id_departamento: string) => {
        const canvas = sigRefs.current[id_departamento]
        if (canvas && !canvas.isEmpty()) {
            const base64 = canvas.getTrimmedCanvas().toDataURL('image/png')
            setFirmas(prev => ({ ...prev, [id_departamento]: base64 }))
        }
    }

    const clearSignature = (id_departamento: string) => {
        const canvas = sigRefs.current[id_departamento]
        if (canvas) canvas.clear()
        const newFirmas = { ...firmas }
        delete newFirmas[id_departamento]
        setFirmas(newFirmas)
    }

    const generarCodigo = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        let result = ''
        for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length))
        return `${tipoMovimiento === 'Entrada' ? 'ENT' : 'SAL'}-${result}`
    }

    const handleSubmit = async () => {
        setIsSaving(true)
        const codigo = generarCodigo()
        
        // 1. Crear Acceso
        const { data: accesoData, error: err1 } = await supabase.from('logistica_accesos').insert([{
            tipo_movimiento: tipoMovimiento,
            id_camion: idCamion,
            id_chofer: idChofer,
            estatus: 'Aprobado',
            codigo_acceso: codigo
        }]).select()

        if (accesoData && accesoData.length > 0) {
            const id_acceso = accesoData[0].id_acceso
            
            // 2. Guardar Pasajeros
            if (pasajeros.length > 0) {
                const pasPayload = pasajeros.map(p => ({
                    id_acceso,
                    id_empleado: p.id_empleado,
                    id_departamento: p.id_departamento
                }))
                await supabase.from('logistica_acceso_pasajeros').insert(pasPayload)
            }

            // 3. Guardar Firmas
            const depsInvolucrados = getDepartamentosInvolucrados()
            if (depsInvolucrados.length > 0) {
                const firmasPayload = depsInvolucrados.map(d => ({
                    id_acceso,
                    id_departamento: d.id_departamento,
                    firma_base64: firmas[d.id_departamento],
                    fecha_firma: new Date().toISOString()
                }))
                await supabase.from('logistica_acceso_firmas').insert(firmasPayload)
            }

            setCodigoAcceso(codigo)
            setStep(5) // Paso final
        }
        setIsSaving(false)
    }

    const generarPDF = () => {
        const doc = new jsPDF()
        const camionSelect = camiones.find(c => c.id_camion === idCamion)
        const choferSelect = empleados.find(e => e.id_empleado === idChofer)

        doc.setFontSize(22)
        doc.setTextColor(30, 41, 59)
        doc.text('Manifiesto de Autorización Vehicular', 20, 20)
        
        doc.setFontSize(12)
        doc.setTextColor(100, 116, 139)
        doc.text(`Código de Seguridad: ${codigoAcceso}`, 20, 30)
        doc.text(`Fecha: ${new Date().toLocaleString()}`, 20, 38)
        
        doc.setDrawColor(226, 232, 240)
        doc.line(20, 45, 190, 45)

        doc.setFontSize(14)
        doc.setTextColor(30, 41, 59)
        doc.text(`Movimiento: ${tipoMovimiento}`, 20, 55)
        doc.text(`Vehículo: ${camionSelect?.numero_economico} (Placas: ${camionSelect?.placas || 'S/N'})`, 20, 63)
        doc.text(`Chofer: ${choferSelect?.nombre} ${choferSelect?.apellido_paterno}`, 20, 71)

        doc.text('Pasajeros Autorizados:', 20, 85)
        doc.setFontSize(11)
        let y = 92
        pasajeros.forEach((p, idx) => {
            doc.text(`${idx + 1}. ${p.nombre} - [${p.departamento}]`, 25, y)
            y += 7
        })

        y += 10
        doc.setDrawColor(226, 232, 240)
        doc.line(20, y, 190, y)
        y += 15

        doc.setFontSize(14)
        doc.text('Firmas de Autorización por Departamento:', 20, y)
        y += 10

        const depsInvolucrados = getDepartamentosInvolucrados()
        depsInvolucrados.forEach(d => {
            if (y > 250) { doc.addPage(); y = 20; }
            doc.setFontSize(12)
            doc.text(`Depto: ${d.departamento}`, 20, y)
            if (firmas[d.id_departamento]) {
                doc.addImage(firmas[d.id_departamento], 'PNG', 20, y + 5, 50, 20)
            } else {
                doc.text('(Sin firma registrada)', 20, y + 15)
            }
            y += 35
        })

        doc.save(`Manifiesto_${codigoAcceso}.pdf`)
    }

    const simularEnvioCorreo = () => {
        generarPDF()
        alert('Simulación: El PDF se ha generado y adjuntado. Se abriría tu gestor de correo para enviarlo a la caseta o a los supervisores.')
    }

    if (!mounted) return null

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-800 flex items-center gap-2">
                        <ShieldCheck className="w-7 h-7 text-amber-500" />
                        Control de Accesos Vehiculares
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1">Manifiestos y autorizaciones de salida/entrada de la mina</p>
                </div>
                <div className="flex items-center gap-2">
                    {[1,2,3,4,5].map(s => (
                        <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step === s ? 'bg-amber-500 text-black' : step > s ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                            {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-8">
                
                {/* PASO 1: SELECCION DE CAMIONETA */}
                {step === 1 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <h2 className="text-xl font-bold text-zinc-800 flex items-center gap-2 border-b pb-4">
                            <Truck className="w-5 h-5 text-amber-500" />
                            Selecciona el Vehículo Designado
                        </h2>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {camiones.map(cam => (
                                <div 
                                    key={cam.id_camion}
                                    onClick={() => setIdCamion(cam.id_camion)}
                                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-3 ${idCamion === cam.id_camion ? 'border-amber-500 bg-amber-50 shadow-md shadow-amber-500/10' : 'border-zinc-100 hover:border-amber-200 hover:bg-zinc-50'}`}
                                >
                                    <Truck className={`w-10 h-10 ${idCamion === cam.id_camion ? 'text-amber-500' : 'text-zinc-400'}`} />
                                    <div className="text-center">
                                        <div className="font-bold text-zinc-800">{cam.numero_economico}</div>
                                        <div className="text-xs text-zinc-500">{cam.placas || 'Sin Placas'}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="flex justify-end pt-6 border-t">
                            <button 
                                disabled={!idCamion}
                                onClick={() => setStep(2)}
                                className="bg-zinc-900 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Siguiente <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* PASO 2: DIRECCION Y CHOFER */}
                {step === 2 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <h2 className="text-xl font-bold text-zinc-800 flex items-center gap-2 border-b pb-4">
                            <MapPin className="w-5 h-5 text-amber-500" />
                            Ruta y Conductor
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-3">Dirección del Viaje</label>
                                <div className="flex gap-4">
                                    <button 
                                        onClick={() => setTipoMovimiento('Entrada')}
                                        className={`flex-1 py-3 rounded-xl font-bold border-2 transition-all ${tipoMovimiento === 'Entrada' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                                    >
                                        Entrada a Mina
                                    </button>
                                    <button 
                                        onClick={() => setTipoMovimiento('Salida')}
                                        className={`flex-1 py-3 rounded-xl font-bold border-2 transition-all ${tipoMovimiento === 'Salida' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                                    >
                                        Salida a Ciudad
                                    </button>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-3">Chofer Asignado</label>
                                <select 
                                    className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-3 font-medium text-zinc-800"
                                    value={idChofer}
                                    onChange={e => setIdChofer(e.target.value)}
                                >
                                    <option value="">Selecciona al conductor...</option>
                                    {empleados.map(emp => (
                                        <option key={emp.id_empleado} value={emp.id_empleado}>
                                            {emp.nombre} {emp.apellido_paterno}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-between pt-6 border-t">
                            <button onClick={() => setStep(1)} className="text-zinc-500 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-zinc-100 transition-all">
                                <ArrowLeft className="w-4 h-4" /> Volver
                            </button>
                            <button 
                                disabled={!idChofer}
                                onClick={() => setStep(3)}
                                className="bg-zinc-900 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-zinc-800 disabled:opacity-50 transition-all"
                            >
                                Siguiente <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* PASO 3: PASAJEROS */}
                {step === 3 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <h2 className="text-xl font-bold text-zinc-800 flex items-center gap-2 border-b pb-4">
                            <Users className="w-5 h-5 text-amber-500" />
                            Pasajeros / Tripulación
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-1 bg-zinc-50 p-5 rounded-2xl border border-zinc-200 space-y-4">
                                <h3 className="font-bold text-zinc-800">Añadir Personal</h3>
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-500 mb-1">1. Departamento Superior</label>
                                    <select 
                                        className="w-full rounded-lg border-zinc-200 bg-white px-3 py-2 text-sm"
                                        value={depSeleccionado}
                                        onChange={e => setDepSeleccionado(e.target.value)}
                                    >
                                        <option value="">Selecciona área...</option>
                                        {departamentos.map(d => (
                                            <option key={d.id_departamento} value={d.id_departamento}>{d.departamento}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-500 mb-1">2. Seleccionar Empleado</label>
                                    <select 
                                        className="w-full rounded-lg border-zinc-200 bg-white px-3 py-2 text-sm"
                                        value={empSeleccionado}
                                        onChange={e => setEmpSeleccionado(e.target.value)}
                                        disabled={!depSeleccionado}
                                    >
                                        <option value="">Selecciona persona...</option>
                                        {empleados.map(e => (
                                            <option key={e.id_empleado} value={e.id_empleado}>{e.nombre} {e.apellido_paterno}</option>
                                        ))}
                                    </select>
                                </div>
                                <button 
                                    type="button"
                                    onClick={addPasajero}
                                    disabled={!empSeleccionado}
                                    className="w-full bg-amber-500 text-black py-2 rounded-lg font-bold text-sm hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    + Subir al Vehículo
                                </button>
                            </div>

                            <div className="md:col-span-2">
                                <h3 className="font-bold text-zinc-800 mb-4">Lista de Pasajeros ({pasajeros.length})</h3>
                                {pasajeros.length === 0 ? (
                                    <div className="h-40 border-2 border-dashed border-zinc-200 rounded-xl flex items-center justify-center text-zinc-400 font-medium">
                                        No hay pasajeros asignados aún
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {pasajeros.map(p => (
                                            <div key={p.id_empleado} className="flex justify-between items-center p-3 bg-white border border-zinc-200 rounded-xl shadow-sm">
                                                <div>
                                                    <div className="font-bold text-zinc-800">{p.nombre}</div>
                                                    <div className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded inline-block mt-1">
                                                        {p.departamento}
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => setPasajeros(pasajeros.filter(px => px.id_empleado !== p.id_empleado))}
                                                    className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg text-sm font-bold transition-colors"
                                                >
                                                    Remover
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-between pt-6 border-t">
                            <button onClick={() => setStep(2)} className="text-zinc-500 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-zinc-100 transition-all">
                                <ArrowLeft className="w-4 h-4" /> Volver
                            </button>
                            <button 
                                disabled={pasajeros.length === 0}
                                onClick={() => setStep(4)}
                                className="bg-zinc-900 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-zinc-800 disabled:opacity-50 transition-all"
                            >
                                Firmas y Autorización <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* PASO 4: FIRMAS */}
                {step === 4 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <h2 className="text-xl font-bold text-zinc-800 flex items-center gap-2 border-b pb-4">
                            <PenTool className="w-5 h-5 text-amber-500" />
                            Firmas de Autorización por Departamento
                        </h2>
                        
                        <p className="text-sm text-zinc-500 mb-4">
                            El sistema ha detectado personal de los siguientes departamentos. Se requiere la firma del superior para generar el código de salida.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {getDepartamentosInvolucrados().map(d => {
                                if (!d) return null
                                const isSigned = !!firmas[d.id_departamento]
                                
                                return (
                                    <div key={d.id_departamento} className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 flex flex-col">
                                        <div className="flex justify-between items-center mb-3">
                                            <h3 className="font-bold text-zinc-800">Depto: {d.departamento}</h3>
                                            {isSigned && <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded font-bold">FIRMADO</span>}
                                        </div>
                                        
                                        {!isSigned ? (
                                            <>
                                                <div className="border-2 border-dashed border-zinc-300 rounded-xl bg-white relative overflow-hidden h-40">
                                                    <SignatureCanvas 
                                                        ref={(ref) => { sigRefs.current[d.id_departamento] = ref }}
                                                        penColor="black"
                                                        canvasProps={{className: 'w-full h-full cursor-crosshair touch-none'}} 
                                                    />
                                                </div>
                                                <div className="flex justify-end gap-2 mt-3">
                                                    <button onClick={() => clearSignature(d.id_departamento)} className="text-xs font-bold text-zinc-500 hover:text-zinc-800 px-3 py-2">
                                                        Limpiar
                                                    </button>
                                                    <button onClick={() => handleSaveSignature(d.id_departamento)} className="bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-emerald-600">
                                                        Guardar Firma
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center flex-1 space-y-4">
                                                <img src={firmas[d.id_departamento]} alt="Firma" className="h-24 object-contain border-b border-zinc-200 pb-2" />
                                                <button onClick={() => clearSignature(d.id_departamento)} className="text-rose-500 text-xs font-bold hover:underline">
                                                    Volver a Firmar
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        <div className="flex justify-between pt-6 border-t mt-8">
                            <button onClick={() => setStep(3)} className="text-zinc-500 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-zinc-100 transition-all">
                                <ArrowLeft className="w-4 h-4" /> Volver
                            </button>
                            
                            <button 
                                disabled={getDepartamentosInvolucrados().length !== Object.keys(firmas).length || isSaving}
                                onClick={handleSubmit}
                                className="bg-amber-500 text-black px-8 py-2.5 rounded-xl font-black flex items-center gap-2 hover:bg-amber-400 disabled:opacity-50 transition-all shadow-lg shadow-amber-500/20"
                            >
                                {isSaving ? 'Procesando...' : 'Autorizar y Generar Código'}
                            </button>
                        </div>
                    </div>
                )}

                {/* PASO 5: EXITO Y PDF */}
                {step === 5 && (
                    <div className="animate-in zoom-in-95 duration-500 flex flex-col items-center justify-center py-10 space-y-6 text-center">
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
                            <ShieldCheck className="w-10 h-10 text-emerald-600" />
                        </div>
                        
                        <h2 className="text-3xl font-black text-zinc-800">¡Viaje Autorizado!</h2>
                        <p className="text-zinc-500 max-w-md">El manifiesto se ha firmado exitosamente y el vehículo cuenta con la autorización de los departamentos involucrados.</p>
                        
                        <div className="bg-zinc-900 p-6 rounded-2xl shadow-xl w-full max-w-sm mt-4 border border-zinc-800">
                            <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">Código de Caseta</p>
                            <p className="text-4xl font-black text-amber-500 font-mono tracking-widest">{codigoAcceso}</p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 mt-8 w-full max-w-md">
                            <button 
                                onClick={generarPDF}
                                className="flex-1 bg-white border-2 border-zinc-200 text-zinc-800 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-50 hover:border-zinc-300 transition-all"
                            >
                                <FileDown className="w-5 h-5" />
                                Descargar PDF
                            </button>
                            <button 
                                onClick={simularEnvioCorreo}
                                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                            >
                                <Mail className="w-5 h-5" />
                                Enviar por Correo
                            </button>
                        </div>
                        
                        <button 
                            onClick={() => window.location.reload()}
                            className="mt-8 text-zinc-400 font-semibold hover:text-zinc-600 underline"
                        >
                            Registrar nuevo acceso
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
