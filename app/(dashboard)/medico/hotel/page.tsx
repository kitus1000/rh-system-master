'use client'

import { useState, useEffect } from 'react'
import { Building, Printer, User, Calendar, Hotel, CheckSquare, ShieldX, Search, Heart } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { supabase } from '@/utils/supabase/client'

export default function PaseHotelPage() {
    const [pacientes, setPacientes] = useState<any[]>([])
    const [empleados, setEmpleados] = useState<any[]>([])
    const [selectedPacId, setSelectedPacId] = useState('')
    const [isWorkerBaja, setIsWorkerBaja] = useState(false)
    const [logoBase64, setLogoBase64] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        pase_medico: '',
        acompanante: '',
        fecha_salida: new Date().toISOString().split('T')[0],
        hotel_nombre: 'HOTEL DEL CENTRO',
        empresa: 'GRUPO MINERO BACIS S.A. DE C.V.',
        unidad: 'UNIDAD "EL HERRERO"'
    })

    useEffect(() => {
        const fetchInitialData = async () => {
            const { data: logoData } = await supabase.from('configuracion_empresa').select('logo_base64').single()
            if (logoData?.logo_base64) {
                setLogoBase64(logoData.logo_base64)
            }

            const { data: pData } = await supabase.from('pacientes').select('*, empleados(*)').order('nombre_completo')
            if (pData) setPacientes(pData)

            const { data: eData } = await supabase.from('empleados').select('*').order('nombre')
            if (eData) setEmpleados(eData)
        }
        fetchInitialData()
    }, [])

    const getEmpFullName = (emp: any) => {
        if (!emp) return ''
        return `${emp.nombre || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`.trim()
    }

    const handlePatientSelect = (pacId: string) => {
        setSelectedPacId(pacId)
        const pac = pacientes.find(p => p.id_paciente === pacId)
        if (!pac) {
            setIsWorkerBaja(false)
            return
        }

        let fullName = pac.nombre_completo || ''
        let isBaja = false
        let acompananteName = pac.acompanante || 'NO REQUIERE'

        if (pac.id_empleado) {
            const emp = empleados.find(e => e.id_empleado === pac.id_empleado) || pac.empleados
            if (emp) {
                if (!pac.parentesco || pac.parentesco.toUpperCase() === 'TITULAR (TRABAJADOR)' || pac.parentesco.toUpperCase() === 'TITULAR') {
                    fullName = getEmpFullName(emp)
                }
                if (emp.estado_empleado === 'BAJA' || emp.estado_empleado === 'INACTIVO') {
                    isBaja = true
                }
                if (!pac.acompanante) {
                    acompananteName = getEmpFullName(emp)
                }
            }
        }

        setIsWorkerBaja(isBaja)

        setFormData(prev => ({
            ...prev,
            pase_medico: fullName.toUpperCase(),
            acompanante: acompananteName.toUpperCase()
        }))
    }

    const exportHotelPassPDF = (pase?: any) => {
        const doc = new jsPDF()
        if (logoBase64) {
            const imgFormat = logoBase64.substring(logoBase64.indexOf('/') + 1, logoBase64.indexOf(';')).toUpperCase();
            doc.addImage(logoBase64, imgFormat === 'JPEG' ? 'JPEG' : imgFormat === 'PNG' ? 'PNG' : 'JPEG', 14, 10, 30, 15)
        }

        const pacienteNombre = formData.pase_medico.toUpperCase() || 'SIN ESPECIFICAR'
        const acompananteNombre = formData.acompanante.toUpperCase() || 'SIN ACOMPAÑANTE / NO REQUIERE'
        
        const fechaSalidaLarga = formData.fecha_salida ? new Date(formData.fecha_salida + 'T12:00:00').toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        }) : new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        
        doc.setFontSize(16)
        doc.text("Autorización de Hospedaje en Hotel", 105, 30, { align: 'center' })
        
        doc.setFontSize(12)
        doc.text(`Paciente / Trabajador: ${pacienteNombre}`, 14, 50)
        doc.text(`Acompañante: ${acompananteNombre}`, 14, 60)
        doc.text(`Hotel: ${formData.hotel_nombre.toUpperCase()}`, 14, 70)
        doc.text(`Fecha de Salida: ${fechaSalidaLarga}`, 14, 80)
        doc.text(`Estatus: ${isWorkerBaja ? 'DADO DE BAJA / SUSPENDIDO' : 'AUTORIZADO'}`, 14, 90)
        
        doc.line(70, 130, 140, 130)
        doc.text("Autorización de RH / Servicios Médicos", 105, 135, { align: 'center' })

        doc.save(`Pase_Hotel_${pacienteNombre}.pdf`)
    }

    const handlePrint = (e: React.FormEvent) => {
        e.preventDefault()
        const printWindow = window.open('', '_blank', 'width=850,height=1100')
        if (!printWindow) return

        const pacienteNombre = formData.pase_medico.toUpperCase() || 'SIN ESPECIFICAR'
        const acompananteNombre = formData.acompanante.toUpperCase() || 'SIN ACOMPAÑANTE / NO REQUIERE'

        const fechaSalidaLarga = formData.fecha_salida ? new Date(formData.fecha_salida + 'T12:00:00').toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        }) : new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

        const hotelNombre = formData.hotel_nombre.toUpperCase()
        const empresaNombre = formData.empresa.toUpperCase()
        const unidadNombre = formData.unidad.toUpperCase()

        printWindow.document.write(`
            <html>
                <head>
                    <title>Pase de Hotel - ${pacienteNombre}</title>
                    <style>
                        @page { size: letter portrait; margin: 0; }
                        body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #000; background: #fff; box-sizing: border-box; }
                        .page-container { width: 215.9mm; height: 279.4mm; margin: 0 auto; padding: 15mm 20mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; position: relative; }
                        .half-ticket { height: 120mm; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid #ccc; border-radius: 8px; padding: 15px; box-sizing: border-box; }
                        .header-text { text-align: center; font-size: 14px; font-weight: bold; line-height: 1.3; }
                        .sub-title { text-align: center; font-size: 13px; font-weight: bold; margin-top: 10px; text-decoration: underline; color: #4c1d95; }
                        .table-favor { width: 100%; margin-top: 15px; border-collapse: collapse; font-size: 11px; }
                        .table-favor th, .table-favor td { border: 1px solid #000; padding: 6px 8px; }
                        .table-favor th { background: #f3f4f6; text-align: left; }
                        .row-salida { margin-top: 15px; font-size: 12px; font-weight: bold; display: flex; justify-content: space-between; border-bottom: 1px solid #000; padding-bottom: 5px; }
                        .salida-val { color: #000; text-transform: capitalize; }
                        .signatures { display: flex; justify-content: space-around; margin-top: 20px; text-align: center; font-size: 10px; font-weight: bold; }
                        .sig-box { width: 40%; }
                        .sig-line { border-top: 1px solid #000; margin-bottom: 4px; }
                        .cut-line { text-align: center; border-top: 2px dashed #999; position: relative; margin: 10px 0; }
                        .cut-icon { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #fff; padding: 0 10px; font-size: 11px; color: #666; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="page-container">
                        <!-- PARTE SUPERIOR (ORIGINAL) -->
                        <div class="half-ticket">
                            <div>
                                <div class="header-text">${empresaNombre}<br>${unidadNombre}</div>
                                <div class="sub-title">HOSPEDAJE EN ${hotelNombre}</div>
                                <table class="table-favor">
                                    <tr><th colspan="2">A FAVOR DE</th></tr>
                                    <tr><th>PASE MEDICO / PACIENTE</th><td>${pacienteNombre}</td></tr>
                                    <tr><th>ACOMPAÑANTE</th><td>${acompananteNombre}</td></tr>
                                </table>
                                <div class="row-salida">
                                    <span>SALIDA DE LA UNIDAD</span>
                                    <span class="salida-val">${fechaSalidaLarga}</span>
                                </div>
                            </div>
                            <div class="signatures">
                                <div class="sig-box"><div class="sig-line"></div>FIRMA TRABAJADOR</div>
                                <div class="sig-box"><div class="sig-line"></div>FIRMA RH UNIDAD</div>
                            </div>
                        </div>

                        <!-- LÍNEA DE CORTE -->
                        <div class="cut-line">
                            <span class="cut-icon">✂ -- CORTAR POR AQUÍ (COPIA Y ORIGINAL) -- ✂</span>
                        </div>

                        <!-- PARTE INFERIOR (COPIA) -->
                        <div class="half-ticket">
                            <div>
                                <div class="header-text">${empresaNombre}<br>${unidadNombre}</div>
                                <div class="sub-title">HOSPEDAJE EN ${hotelNombre}</div>
                                <table class="table-favor">
                                    <tr><th colspan="2">A FAVOR DE</th></tr>
                                    <tr><th>PASE MEDICO / PACIENTE</th><td>${pacienteNombre}</td></tr>
                                    <tr><th>ACOMPAÑANTE</th><td>${acompananteNombre}</td></tr>
                                </table>
                                <div class="row-salida">
                                    <span>SALIDA DE LA UNIDAD</span>
                                    <span class="salida-val">${fechaSalidaLarga}</span>
                                </div>
                            </div>
                            <div class="signatures">
                                <div class="sig-box"><div class="sig-line"></div>FIRMA TRABAJADOR</div>
                                <div class="sig-box"><div class="sig-line"></div>FIRMA RH UNIDAD</div>
                            </div>
                        </div>
                    </div>
                    <script>window.onload = function() { window.print(); }</script>
                </body>
            </html>
        `)
        printWindow.document.close()
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-zinc-150">
                <div>
                    <h1 className="text-2xl font-black text-zinc-800 flex items-center gap-3">
                        <div className="bg-purple-100 text-purple-700 p-3 rounded-2xl">
                            <Building className="w-6 h-6" />
                        </div>
                        Pase de Hospedaje en Hotel (Hoja Dividida)
                    </h1>
                    <p className="text-zinc-500 text-xs mt-1">
                        Emisión rápida de pases de hotel para trabajadores, pacientes y acompañantes médicos en hoja dividida en dos mitades.
                    </p>
                </div>
            </div>

            {/* ALERT BANNER IF WORKER IS BAJA */}
            {isWorkerBaja && (
                <div className="bg-rose-600 text-white p-4 rounded-3xl shadow-md flex items-center gap-3 animate-in fade-in duration-150">
                    <ShieldX className="w-6 h-6 flex-shrink-0" />
                    <div>
                        <div className="font-black text-sm uppercase">⚠️ ATENCIÓN MÉDICA SUSPENDIDA</div>
                        <div className="text-xs font-semibold text-rose-100">
                            El trabajador seleccionado se encuentra DADO DE BAJA. No tiene permitida la emisión de hospedaje en hotel ni atención médica.
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Formulario */}
                <form onSubmit={handlePrint} className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-150 space-y-5">
                    <h2 className="text-sm font-black text-zinc-700 uppercase tracking-wider flex items-center gap-2 border-b border-zinc-100 pb-3">
                        <User className="w-4 h-4 text-purple-600" /> Selección de Paciente / Trabajador
                    </h2>

                    <div>
                        <label className="block text-xs font-black text-zinc-700 uppercase mb-1.5">SELECCIONAR DE PADRÓN DE PACIENTES O TRABAJADORES</label>
                        <select
                            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-bold text-zinc-800 outline-none focus:ring-2 focus:ring-purple-500"
                            value={selectedPacId}
                            onChange={e => handlePatientSelect(e.target.value)}
                        >
                            <option value="">Seleccionar paciente del padrón...</option>
                            {pacientes.map(p => {
                                const isBaja = p.empleados?.estado_empleado === 'BAJA'
                                return (
                                    <option key={p.id_paciente} value={p.id_paciente}>
                                        {p.nombre_completo} ({p.parentesco || 'Titular'}) {isBaja ? '🔴 DADO DE BAJA' : ''}
                                    </option>
                                )
                            })}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-zinc-700 uppercase mb-1.5">A FAVOR DE (PASE MÉDICO / PACIENTE)</label>
                        <input
                            type="text"
                            required
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800"
                            value={formData.pase_medico}
                            onChange={e => setFormData({ ...formData, pase_medico: e.target.value })}
                            placeholder="Nombre(s) Apellido Paterno Apellido Materno"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-zinc-700 uppercase mb-1.5">ACOMPAÑANTE</label>
                        <input
                            type="text"
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800"
                            value={formData.acompanante}
                            onChange={e => setFormData({ ...formData, acompanante: e.target.value })}
                            placeholder="Ej. LEYSI ALEJANDRA HERNANDEZ ROMERO o NO REQUIERE"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-zinc-700 uppercase mb-1.5">SALIDA DE LA UNIDAD (FECHA)</label>
                        <input
                            type="date"
                            required
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800"
                            value={formData.fecha_salida}
                            onChange={e => setFormData({ ...formData, fecha_salida: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-zinc-700 uppercase mb-1.5">NOMBRE DEL HOTEL / HOSPEDAJE</label>
                        <input
                            type="text"
                            required
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800"
                            value={formData.hotel_nombre}
                            onChange={e => setFormData({ ...formData, hotel_nombre: e.target.value })}
                            placeholder="HOTEL DEL CENTRO"
                        />
                    </div>

                    <div className="pt-4 border-t border-zinc-100 flex flex-col sm:flex-row gap-3 justify-end">
                        <button
                            type="button"
                            onClick={() => exportHotelPassPDF()}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-6 py-4 rounded-2xl text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-500/20 w-full justify-center sm:w-auto"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Exportar PDF</span>
                        </button>
                        <button
                            type="submit"
                            className="bg-purple-600 hover:bg-purple-500 text-white font-black px-8 py-4 rounded-2xl text-xs flex items-center gap-2 transition-all shadow-md shadow-purple-500/20 w-full justify-center sm:w-auto"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Imprimir Hoja Dividida en 2 Mitades</span>
                        </button>
                    </div>
                </form>

                {/* Vista Previa Visual */}
                <div className="bg-zinc-900 text-white p-6 rounded-3xl shadow-sm space-y-4 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                            <span className="text-xs font-black uppercase tracking-widest text-purple-400">Estilo Oficial Hoja Carta Dividida</span>
                            <span className="text-[10px] bg-zinc-800 px-2 py-1 rounded text-zinc-400">✂ Línea de Corte Medio</span>
                        </div>
                        
                        <div className="space-y-4 text-xs font-mono bg-white text-black p-4 rounded-xl shadow-inner border border-zinc-300">
                            <div className="text-center font-bold text-xs border-b border-zinc-200 pb-2">
                                GRUPO MINERO BACIS S.A. DE C.V.<br/>UNIDAD "EL HERRERO"<br/>
                                <span className="text-[10px] text-purple-700 font-black">HOSPEDAJE EN {formData.hotel_nombre}</span>
                            </div>
                            <div className="space-y-1 py-2 text-[11px]">
                                <div><strong className="text-zinc-500">PASE MEDICO:</strong> <span className="font-bold">{formData.pase_medico}</span></div>
                                <div><strong className="text-zinc-500">ACOMPAÑANTE:</strong> <span className="font-bold">{formData.acompanante || 'NO REQUIERE'}</span></div>
                                <div><strong className="text-zinc-500">SALIDA:</strong> <span className="font-bold">{formData.fecha_salida}</span></div>
                            </div>
                            <div className="border-t border-dashed border-zinc-400 pt-2 text-center text-[9px] text-zinc-400">
                                --- ✂ --- CORTAR POR AQUÍ / COPIA Y ORIGINAL --- ✂ ---
                            </div>
                            <div className="text-center font-bold text-xs border-b border-zinc-200 pb-1 text-zinc-700">
                                (MITAD INFERIOR - COPIA)
                            </div>
                        </div>
                    </div>

                    <div className="bg-purple-950/40 border border-purple-800/40 p-4 rounded-2xl text-xs text-purple-200 space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-purple-300">
                            <CheckSquare className="w-4 h-4 text-purple-400" /> Ventajas del Formato Dividido
                        </div>
                        <p className="text-[11px] leading-relaxed opacity-90">
                            Al hacer clic en Imprimir, se generará exactamente un documento en tamaño carta con 2 cupones idénticos y una línea punteada de corte central para que el hotel conserve el original y el trabajador o RH se queden con su acuse de recibo.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
