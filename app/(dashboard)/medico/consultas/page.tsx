'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { Heart, Plus, Search, Users, Trash2, Printer, Stethoscope, Pill, CheckCircle } from 'lucide-react'

export default function ConsultasPage() {
    const { profile } = useAuth()
    const [consultas, setConsultas] = useState<any[]>([])
    const [pacientes, setPacientes] = useState<any[]>([])
    const [medicamentosCat, setMedicamentosCat] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [filterPatientName, setFilterPatientName] = useState('')
    
    const [formData, setFormData] = useState({
        id_paciente: '',
        diagnostico: '',
        costo_consulta: 0,
        acompanante: '',
        medicamentos_recetados: [] as any[]
    })

    useEffect(() => {
        fetchConsultas()
        fetchCatalogos()
    }, [])

    const fetchCatalogos = async () => {
        const { data: pData } = await supabase.from('pacientes').select('*').order('nombre_completo')
        if (pData) setPacientes(pData)

        const { data: mData } = await supabase.from('cat_medicamentos').select('*').order('nombre')
        if (mData) setMedicamentosCat(mData)
    }

    const fetchConsultas = async () => {
        setLoading(true)
        let { data, error } = await supabase
            .from('consultas_medicas')
            .select(`
                *,
                pacientes (nombre_completo, es_poblacion_general, parentesco, acompanante)
            `)
            .order('fecha', { ascending: false })
        
        if (error) {
            console.warn("Attempting fallback fetch for consultas:", error);
            const fallback = await supabase
                .from('consultas_medicas')
                .select(`
                    *,
                    pacientes (nombre_completo, es_poblacion_general, parentesco)
                `)
                .order('fecha', { ascending: false })
            if (fallback.data) setConsultas(fallback.data);
        } else if (data) {
            setConsultas(data);
        }
        setLoading(false)
    }

    const handleAddMedicamento = () => {
        setFormData({
            ...formData,
            medicamentos_recetados: [...formData.medicamentos_recetados, { id_medicamento: '', cantidad: 1, costo_unitario: 0, dosis: '' }]
        })
    }

    const updateMedicamento = (index: number, field: string, value: any) => {
        const newMed = [...formData.medicamentos_recetados]
        newMed[index][field] = value
        
        if (field === 'id_medicamento') {
            const med = medicamentosCat.find(m => m.id_medicamento === value)
            const pac = pacientes.find(p => p.id_paciente === formData.id_paciente)
            if (med && pac?.es_poblacion_general) {
                newMed[index].costo_unitario = med.precio_venta || 0
            } else {
                newMed[index].costo_unitario = 0
            }
            if (med && !newMed[index].dosis) {
                newMed[index].dosis = med.descripcion || '1 TABLETA CADA 8 HORAS POR 5 DÍAS'
            }
        }
        
        setFormData({ ...formData, medicamentos_recetados: newMed })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        let diagFinal = formData.diagnostico
        if (formData.medicamentos_recetados.length > 0) {
            const notasReceta = formData.medicamentos_recetados.map(m => {
                const medInfo = medicamentosCat.find(c => c.id_medicamento === m.id_medicamento)
                return `• ${medInfo?.nombre || 'Medicina'} (${m.cantidad} pzs): ${m.dosis || 'Tomar según indicación médica.'}`
            }).join('\n')
            
            if (!diagFinal.includes('[INDICACIONES RECETA]')) {
                diagFinal = `${diagFinal}\n\n[INDICACIONES RECETA]:\n${notasReceta}`
            }
        }

        // 1. Insertar Consulta
        const { data: consultaData, error: consultaError } = await supabase.from('consultas_medicas').insert([{
            id_paciente: formData.id_paciente,
            diagnostico: diagFinal,
            costo_consulta: formData.costo_consulta,
            medico_id: profile?.id
        }]).select()

        if (consultaData && consultaData.length > 0) {
            // 2. Insertar Dispensacion
            if (formData.medicamentos_recetados.length > 0) {
                const dispPayload = formData.medicamentos_recetados.map(med => ({
                    id_consulta: consultaData[0].id_consulta,
                    id_medicamento: med.id_medicamento,
                    cantidad: med.cantidad,
                    costo_unitario: med.costo_unitario,
                    costo_total: med.cantidad * med.costo_unitario,
                    dosis: med.dosis ? med.dosis.toUpperCase() : null
                }))
                await supabase.from('dispensacion_medicamentos').insert(dispPayload)
            }

            // 3. Sync companion to patients table if modified
            if (formData.id_paciente && formData.acompanante) {
                await supabase.from('pacientes').update({
                    acompanante: formData.acompanante.toUpperCase()
                }).eq('id_paciente', formData.id_paciente)
            }
        }

        setShowForm(false)
        setFormData({ id_paciente: '', diagnostico: '', costo_consulta: 0, acompanante: '', medicamentos_recetados: [] })
        setFilterPatientName('')
        fetchConsultas()
        fetchCatalogos() // Reload companion changes
    }

    const handlePrintReceta = async (consulta: any) => {
        const { data: dispensacion } = await supabase
            .from('dispensacion_medicamentos')
            .select('*, cat_medicamentos(nombre, presentacion, sustancia_activa, descripcion)')
            .eq('id_consulta', consulta.id_consulta)

        // Fetch prescribing doctor profile details
        let doctorProfile = null
        if (consulta.medico_id) {
            const { data } = await supabase
                .from('perfiles')
                .select('*')
                .eq('id', consulta.medico_id)
                .single()
            if (data) doctorProfile = data
        }

        const printWindow = window.open('', '_blank', 'width=900,height=1150')
        if (!printWindow) return

        const formattedFecha = new Date(consulta.fecha || Date.now()).toLocaleDateString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        })

        const diagTexto = (consulta.diagnostico || '').split('[INDICACIONES RECETA]')[0].trim() || 'Valoración médica general'
        const pacienteNombre = (consulta.pacientes?.nombre_completo || 'PACIENTE REGISTRADO').toUpperCase()
        const categoriaPaciente = consulta.pacientes?.es_poblacion_general ? 'POBLACIÓN GENERAL / PARTICULAR' : 'TRABAJADOR / BENEFICIARIO BACIS'
        const companionName = (consulta.pacientes?.acompanante || '').toUpperCase()
        const folioReceta = `REC-${(consulta.id_consulta || '').toString().slice(0, 8).toUpperCase()}`

        const medsRows = (dispensacion && dispensacion.length > 0) ? dispensacion.map((item: any, idx: number) => {
            const m = item.cat_medicamentos || {}
            const dosisTexto = (item.dosis || item.descripcion || 'Tomar según prescripción médica.').toUpperCase()
            return `
                <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 800; font-size: 13px; width: 65px; color: #0f172a;">
                        ${item.cantidad || 1}
                    </td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
                        <div style="font-weight: 800; color: #0f172a; font-size: 13px; text-transform: uppercase;">${m.nombre || 'MEDICAMENTO PRESTABLECIDO'}</div>
                        ${m.sustancia_activa ? `<div style="font-size: 10px; font-weight: 700; color: #b45309; margin-top: 1px;">Sustancia Activa: ${m.sustancia_activa.toUpperCase()}</div>` : ''}
                        <div style="font-size: 10px; font-weight: 600; color: #64748b; margin-top: 2px;">Presentación: ${m.presentacion || 'Estándar'}</div>
                    </td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #334155; line-height: 1.4;">
                        <strong style="color: #0f172a; font-size: 10px; text-transform: uppercase;">Posología e indicaciones:</strong><br/>
                        ${dosisTexto}
                    </td>
                </tr>
            `
        }).join('') : `
            <tr>
                <td colspan="3" style="padding: 28px; text-align: center; color: #64748b; font-style: italic; font-size: 13px;">
                    Consulta de valoración y seguimiento clínico sin prescripción de fármacos en almacén para este episodio.
                </td>
            </tr>
        `

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receta Médica - ${pacienteNombre}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
                    body {
                        font-family: 'Plus Jakarta Sans', sans-serif;
                        margin: 0;
                        padding: 40px 50px;
                        color: #1e293b;
                        background: #ffffff;
                        line-height: 1.5;
                    }
                    .receta-container {
                        max-width: 800px;
                        margin: 0 auto;
                        border: 2px solid #0f172a;
                        padding: 40px;
                        position: relative;
                        box-sizing: border-box;
                        border-radius: 12px;
                    }
                    .header-table {
                        width: 100%;
                        border-collapse: collapse;
                        border-bottom: 2px solid #0f172a;
                        padding-bottom: 15px;
                        margin-bottom: 20px;
                    }
                    .logo-img {
                        height: 60px;
                        object-fit: contain;
                    }
                    .doctor-meta-block {
                        vertical-align: top;
                        padding-left: 20px;
                        line-height: 1.4;
                    }
                    .doctor-name-lbl {
                        font-size: 14px;
                        font-weight: 800;
                        color: #0f172a;
                        text-transform: uppercase;
                    }
                    .doctor-spec-lbl {
                        font-size: 9px;
                        font-weight: 700;
                        color: #b45309;
                        text-transform: uppercase;
                    }
                    .doctor-details-text {
                        font-size: 9px;
                        color: #64748b;
                        font-weight: 600;
                        text-transform: uppercase;
                        margin-top: 4px;
                    }
                    .header-right {
                        vertical-align: top;
                        text-align: right;
                        width: 200px;
                    }
                    .receta-badge {
                        background: #f59e0b;
                        color: #000;
                        padding: 4px 10px;
                        font-weight: 800;
                        font-size: 10px;
                        text-transform: uppercase;
                        border-radius: 4px;
                        display: inline-block;
                        margin-bottom: 4px;
                        letter-spacing: 0.5px;
                    }
                    .folio-text {
                        font-size: 15px;
                        font-weight: 850;
                        font-family: monospace;
                        color: #0f172a;
                    }
                    .fecha-text {
                        font-size: 9px;
                        font-weight: 600;
                        color: #64748b;
                        margin-top: 4px;
                        text-transform: capitalize;
                    }
                    .patient-box {
                        background: #f8fafc;
                        border: 1px solid #cbd5e1;
                        border-left: 6px solid #0f172a;
                        padding: 15px 20px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                        display: grid;
                        grid-template-columns: 2fr 1fr;
                        gap: 20px;
                    }
                    .patient-name {
                        font-size: 15px;
                        font-weight: 900;
                        color: #0f172a;
                        margin: 0 0 4px 0;
                    }
                    .patient-meta {
                        font-size: 9px;
                        font-weight: 800;
                        color: #ffffff;
                        background: #0f172a;
                        padding: 2px 8px;
                        border-radius: 4px;
                        display: inline-block;
                        text-transform: uppercase;
                    }
                    .diag-box {
                        border-left: 1px solid #cbd5e1;
                        padding-left: 20px;
                    }
                    .diag-label {
                        font-size: 9px;
                        font-weight: 800;
                        color: #64748b;
                        text-transform: uppercase;
                        margin: 0 0 2px 0;
                    }
                    .diag-text {
                        font-size: 11px;
                        font-weight: 700;
                        color: #1e293b;
                        line-height: 1.3;
                    }
                    .section-header {
                        font-size: 12px;
                        font-weight: 900;
                        color: #0f172a;
                        text-transform: uppercase;
                        border-bottom: 2px solid #0f172a;
                        padding-bottom: 6px;
                        margin: 20px 0 12px 0;
                    }
                    .med-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                        border: 1px solid #cbd5e1;
                        border-radius: 8px;
                        overflow: hidden;
                    }
                    .med-table th {
                        background: #0f172a;
                        color: #ffffff;
                        font-size: 10px;
                        font-weight: 800;
                        text-transform: uppercase;
                        padding: 10px;
                        text-align: left;
                    }
                    .recommendations-box {
                        background: #fffbeb;
                        border: 1px solid #fde68a;
                        padding: 15px;
                        border-radius: 8px;
                        font-size: 11px;
                        color: #92400e;
                        margin-bottom: 30px;
                    }
                    .recommendations-title {
                        font-weight: 800;
                        text-transform: uppercase;
                        margin-bottom: 6px;
                        color: #b45309;
                        font-size: 10px;
                    }
                    .footer-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 30px;
                        margin-top: 35px;
                        padding-top: 20px;
                        border-top: 1px dashed #cbd5e1;
                    }
                    .signature-box {
                        text-align: center;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: flex-end;
                    }
                    .signature-line {
                        width: 80%;
                        margin: 0 auto;
                        border-bottom: 1.5px solid #0f172a;
                        height: 10px;
                    }
                    .doctor-name {
                        font-size: 12px;
                        font-weight: 900;
                        color: #0f172a;
                        margin-top: 8px;
                    }
                    .doctor-cedula {
                        font-size: 10px;
                        font-weight: 600;
                        color: #64748b;
                        margin-top: 2px;
                    }
                    .seal-box {
                        text-align: center;
                        font-size: 9px;
                        color: #64748b;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        border: 1.5px dashed #cbd5e1;
                        padding: 12px;
                        border-radius: 8px;
                        background: #f8fafc;
                    }
                    .watermark {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%) rotate(-30deg);
                        font-size: 80px;
                        font-weight: 900;
                        color: rgba(15, 23, 42, 0.025);
                        pointer-events: none;
                        white-space: nowrap;
                    }
                    @media print {
                        body { padding: 0; }
                        .receta-container { border: none; max-width: 100%; padding: 15px; border-radius: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="receta-container">
                    <div class="watermark">MINERA BACIS</div>
                    
                    <table class="header-table">
                        <tr>
                            <td style="width: 140px; vertical-align: middle;">
                                <img src="/logo-bacis.png" class="logo-img" alt="Logo Bacis" />
                            </td>
                            <td class="doctor-meta-block">
                                <div class="doctor-name-lbl">${doctorProfile?.nombre_completo || 'MÉDICO GENERAL TRATANTE'}</div>
                                <div class="doctor-spec-lbl">${doctorProfile?.especialidad || 'SERVICIOS MÉDICOS Y SALUD OCUPACIONAL'}</div>
                                <div class="doctor-details-text">
                                    CÉDULA PROFESIONAL: ${doctorProfile?.cedula_profesional || 'REGISTRO PENDIENTE'}<br/>
                                    EMITIDA POR: ${doctorProfile?.universidad || 'UNIV EMISORA'}<br/>
                                    DOMICILIO: ${doctorProfile?.domicilio_consultorio || 'CONSTITUCION 145, UNIDAD EL HERRERO, DGO'}<br/>
                                    TELÉFONO: ${doctorProfile?.telefono_consultorio || 'S/T'}
                                </div>
                            </td>
                            <td class="header-right">
                                <div class="receta-badge">Receta Médica Oficial</div>
                                <div class="folio-text">${folioReceta}</div>
                                <div class="fecha-text">${formattedFecha}</div>
                            </td>
                        </tr>
                    </table>

                    <div class="patient-box">
                        <div>
                            <div style="font-size:9px; font-weight:800; color:#64748b; text-transform:uppercase;">Nombre del Paciente</div>
                            <h2 class="patient-name">${pacienteNombre}</h2>
                            <span class="patient-meta">${categoriaPaciente}</span>
                            ${companionName ? `<div style="font-size:9px; color:#475569; font-weight:bold; margin-top:5px;">Acompañante: ${companionName}</div>` : ''}
                        </div>
                        <div class="diag-box">
                            <div class="diag-label">Diagnóstico / Sintomatología</div>
                            <div class="diag-text">${diagTexto.replace(/\n/g, '<br/>')}</div>
                        </div>
                    </div>

                    <div class="section-header">
                        <span>💊 Prescripción Médica de Fármacos</span>
                    </div>

                    <table class="med-table">
                        <thead>
                            <tr>
                                <th style="width: 65px; text-align: center;">Cant.</th>
                                <th>Medicamento, Sustancia Activa y Forma</th>
                                <th>Dosis, Vía de Administración y Duración</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${medsRows}
                        </tbody>
                    </table>

                    <div class="recommendations-box">
                        <div class="recommendations-title">📋 Indicaciones Médicas de Salud y Cuidados</div>
                        <ul style="margin: 0; padding-left: 15px; line-height: 1.5; font-weight: 600;">
                            <li>Completar el tratamiento durante los días y horarios indicados puntualmente por el médico tratante.</li>
                            <li>Evitar la automedicación e ingerir abundante agua pura durante la jornada laboral o en domicilio.</li>
                            <li>En caso de presentar reacciones adversas, acudir al servicio de urgencias de la unidad de inmediato.</li>
                        </ul>
                    </div>

                    <div class="footer-grid">
                        <div class="signature-box">
                            ${doctorProfile?.firma ? `<img src="${doctorProfile.firma}" style="max-height: 55px; margin-bottom: 2px;" />` : '<div style="height:55px;"></div>'}
                            <div class="signature-line"></div>
                            <div class="doctor-name">${(doctorProfile?.nombre_completo || 'MÉDICO AUTORIZADO').toUpperCase()}</div>
                            <div class="doctor-cedula">Cédula: ${doctorProfile?.cedula_profesional || 'CP S/N'}</div>
                            <div class="doctor-cedula" style="font-size: 8.5px; font-weight: 700; color: #64748b; margin-top: 1px;">FIRMA DEL MÉDICO PRESCRIPTOR</div>
                        </div>
                        <div class="seal-box">
                            <strong style="color: #0f172a; font-size: 10px; margin-bottom: 4px; text-transform: uppercase;">SELLO DE FARMACIA / SERVICIOS MÉDICOS</strong>
                            <span style="font-weight: 600; font-size: 9px;">Documento clínico oficial para la dispensación en farmacia y justificación de tratamiento.</span>
                            <span style="margin-top:5px; font-weight:800; color: #f59e0b; background: #0f172a; padding: 2px 8px; border-radius: 4px; font-size: 8px;">VALIDEZ VIGENTE DURANTE EL TRATAMIENTO</span>
                        </div>
                    </div>
                </div>
                <script>
                    window.onload = () => {
                        setTimeout(() => {
                            window.print();
                            window.close();
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `)
        printWindow.document.close()
    }

    const handlePacienteChange = (val: string) => {
        const pac = pacientes.find(p => p.id_paciente === val)
        setFormData({
            ...formData,
            id_paciente: val,
            acompanante: pac?.acompanante || '',
            costo_consulta: pac?.es_poblacion_general ? 200 : 0
        })
    }

    const filteredPacientes = pacientes.filter(p => 
        (p.nombre_completo || '').toLowerCase().includes(filterPatientName.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-800 flex items-center gap-2">
                        <Stethoscope className="w-6 h-6 text-amber-500" />
                        Consultas y Recetas
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1">Registro de atención médica y dispensación de medicamentos</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-amber-500 text-black px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-amber-400 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Consulta
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 space-y-6">
                    <div className="flex items-center justify-between border-b pb-4">
                        <h2 className="text-lg font-bold text-zinc-800">Registrar Consulta Médica</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="block text-sm font-semibold text-zinc-700 mb-0.5">Paciente (Filtrar por nombre)</label>
                                <input 
                                    type="text"
                                    placeholder="Escribe para buscar paciente en la lista..."
                                    className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2 text-xs font-bold shadow-xs focus:ring-1 focus:ring-amber-500"
                                    value={filterPatientName}
                                    onChange={e => setFilterPatientName(e.target.value)}
                                />
                                <select 
                                    required
                                    className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold"
                                    value={formData.id_paciente}
                                    onChange={e => handlePacienteChange(e.target.value)}
                                >
                                    <option value="">Seleccione un paciente ({filteredPacientes.length} encontrados)...</option>
                                    {filteredPacientes.map(p => (
                                        <option key={p.id_paciente} value={p.id_paciente}>
                                            {p.nombre_completo} {p.es_poblacion_general ? '(Público)' : '(Trabajador/Benef)'}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-zinc-700 mb-1">Costo de Consulta ($)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">$</span>
                                        <input 
                                            type="number" step="0.01" min="0"
                                            className="w-full rounded-xl border-zinc-200 bg-zinc-50 pl-8 pr-4 py-2 text-xs font-bold"
                                            value={formData.costo_consulta}
                                            onChange={e => setFormData({...formData, costo_consulta: parseFloat(e.target.value) || 0})}
                                            readOnly={!pacientes.find(p => p.id_paciente === formData.id_paciente)?.es_poblacion_general}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-zinc-700 mb-1">Acompañante de Consulta</label>
                                    <input 
                                        type="text"
                                        placeholder="Ej. MARIA ARREOLA (MADRE)"
                                        className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold"
                                        value={formData.acompanante}
                                        onChange={e => setFormData({...formData, acompanante: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-1">Diagnóstico / Sintomatología</label>
                                <textarea 
                                    required rows={3}
                                    className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold resize-none"
                                    value={formData.diagnostico}
                                    onChange={e => setFormData({...formData, diagnostico: e.target.value})}
                                    placeholder="Describa el diagnóstico o motivo de la consulta..."
                                />
                            </div>
                        </div>

                        <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-zinc-800 flex items-center gap-2">
                                    <Pill className="w-4 h-4 text-amber-500" />
                                    Receta Médica
                                </h3>
                                <button type="button" onClick={handleAddMedicamento} className="text-sm font-bold text-amber-600 hover:text-amber-700">
                                    + Agregar Medicamento
                                </button>
                            </div>
                            
                            {formData.medicamentos_recetados.length === 0 ? (
                                <div className="text-center py-8 border-2 border-dashed border-zinc-200 rounded-xl bg-white/50">
                                    <Pill className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                                    <p className="text-xs font-bold text-zinc-500">No ha prescripto medicamentos en esta consulta</p>
                                    <p className="text-[11px] text-zinc-400 mt-1">Presione "+ Agregar Medicamento" para iniciar la receta</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                    {formData.medicamentos_recetados.map((med, idx) => (
                                        <div key={idx} className="flex flex-col gap-2 bg-white p-3 rounded-xl border border-zinc-200 shadow-xs">
                                            <div className="flex items-center gap-2">
                                                <select 
                                                    className="flex-1 rounded-lg border-zinc-200 text-xs font-bold py-1.5 text-zinc-800"
                                                    value={med.id_medicamento}
                                                    onChange={e => updateMedicamento(idx, 'id_medicamento', e.target.value)}
                                                    required
                                                >
                                                    <option value="">Seleccione medicamento...</option>
                                                    {medicamentosCat.map(m => (
                                                        <option key={m.id_medicamento} value={m.id_medicamento}>{m.nombre} {m.presentacion ? `(${m.presentacion})` : ''}</option>
                                                    ))}
                                                </select>
                                                <input 
                                                    type="number" min="1" placeholder="Cant."
                                                    className="w-16 rounded-lg border-zinc-200 text-xs font-bold py-1.5 text-center text-zinc-800"
                                                    value={med.cantidad}
                                                    onChange={e => updateMedicamento(idx, 'cantidad', parseInt(e.target.value) || 1)}
                                                    required
                                                />
                                                {med.costo_unitario > 0 && (
                                                    <span className="text-xs font-bold text-amber-600 w-16 text-right">
                                                        ${med.costo_unitario * med.cantidad}
                                                    </span>
                                                )}
                                                <button 
                                                    type="button" 
                                                    onClick={() => setFormData({...formData, medicamentos_recetados: formData.medicamentos_recetados.filter((_, i) => i !== idx)})}
                                                    className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg font-bold"
                                                    title="Quitar de la receta"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                            <div>
                                                <input 
                                                    type="text"
                                                    placeholder="Dosificación / Posología (Ej. 1 TABLETA CADA 8 HORAS POR 5 DÍAS)"
                                                    className="w-full rounded-lg border-amber-200/80 text-[11px] font-semibold py-1.5 px-3 bg-amber-50/50 text-amber-950 placeholder:text-zinc-400 focus:ring-1 focus:ring-amber-500"
                                                    value={med.dosis || ''}
                                                    onChange={e => updateMedicamento(idx, 'dosis', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {formData.medicamentos_recetados.some(m => m.costo_unitario > 0) && (
                                        <div className="text-right text-xs font-black text-zinc-800 pt-3 border-t border-zinc-200 mt-3">
                                            Total Farmacia: <span className="text-amber-600 ml-1">${formData.medicamentos_recetados.reduce((acc, m) => acc + (m.costo_unitario * m.cantidad), 0)}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
                        <button 
                            type="button" 
                            onClick={() => setShowForm(false)}
                            className="bg-zinc-100 text-zinc-700 px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-zinc-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button type="submit" className="bg-amber-500 text-black px-8 py-2.5 rounded-xl text-xs font-black hover:bg-amber-400 transition-colors shadow-sm flex items-center gap-1.5">
                            <CheckCircle className="w-4 h-4" />
                            Finalizar Consulta y Emitir Receta
                        </button>
                    </div>
                </form>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
                <div className="p-5 border-b border-zinc-100 bg-zinc-50/60 flex justify-between items-center">
                    <div>
                        <h3 className="font-black text-zinc-800 text-sm uppercase tracking-tight">Historial de Consultas y Recetas Emitidas</h3>
                        <p className="text-xs text-zinc-400 mt-0.5 font-medium">Consulte episodios previos o imprima recetas oficiales</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50 text-zinc-500 font-bold border-b border-zinc-100 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Fecha y Folio</th>
                                <th className="px-6 py-4">Paciente</th>
                                <th className="px-6 py-4">Diagnóstico / Motivo</th>
                                <th className="px-6 py-4">Costo Consulta</th>
                                <th className="px-6 py-4 text-right">Receta Médica</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-10 text-center text-zinc-500 font-medium">Cargando consultas...</td></tr>
                            ) : consultas.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-10 text-center text-zinc-500 font-medium">No hay consultas registradas</td></tr>
                            ) : (
                                consultas.map(c => (
                                    <tr key={c.id_consulta} className="hover:bg-zinc-50/50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-xs">
                                            <div className="font-bold text-zinc-800">{new Date(c.fecha || Date.now()).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                            <div className="text-[10px] text-amber-600 font-bold mt-0.5">#REC-{(c.id_consulta || '').toString().slice(0, 8).toUpperCase()}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-zinc-800 text-xs uppercase">{c.pacientes?.nombre_completo || 'PACIENTE ELIMINADO'}</div>
                                            <div className="text-[10px] font-bold text-zinc-400 uppercase mt-0.5">{c.pacientes?.es_poblacion_general ? 'Público General' : `Beneficiario (${c.pacientes?.parentesco || 'Titular'})`}</div>
                                        </td>
                                        <td className="px-6 py-4 text-zinc-650 text-xs max-w-xs" title={c.diagnostico}>
                                            <div className="font-medium line-clamp-2">{c.diagnostico}</div>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-mono">
                                            {c.costo_consulta > 0 ? (
                                                <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">${c.costo_consulta}</span>
                                            ) : (
                                                <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">Gratis (100%)</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => handlePrintReceta(c)}
                                                className="bg-amber-500 hover:bg-amber-400 text-black font-black px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 shadow-xs"
                                            >
                                                <Printer className="w-3.5 h-3.5" />
                                                <span>Imprimir Receta</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
