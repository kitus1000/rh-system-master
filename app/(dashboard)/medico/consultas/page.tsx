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
    const [logoBase64, setLogoBase64] = useState<string | null>(null)
    
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

        const { data: configData } = await supabase.from('configuracion_empresa').select('logo_base64').single()
        if (configData?.logo_base64) setLogoBase64(configData.logo_base64)
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
        let doctorProfile: any = null
        if (consulta.medico_id) {
            const { data } = await supabase
                .from('perfiles')
                .select('*')
                .eq('id', consulta.medico_id)
                .single()
            if (data) doctorProfile = data
        }

        // Fallback to current logged-in profile if no medico_id saved
        if (!doctorProfile && profile) {
            doctorProfile = profile
        }

        const printWindow = window.open('', '_blank', 'width=900,height=1200')
        if (!printWindow) return

        const formattedFecha = new Date(consulta.fecha || Date.now()).toLocaleDateString('es-MX', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        })
        const fechaCorta = new Date(consulta.fecha || Date.now()).toLocaleDateString('es-MX', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        })

        const diagTexto = (consulta.diagnostico || '').split('[INDICACIONES RECETA]')[0].trim() || 'Valoración médica general'
        const pacienteNombre = (consulta.pacientes?.nombre_completo || 'PACIENTE REGISTRADO').toUpperCase()
        const categoriaPaciente = consulta.pacientes?.es_poblacion_general ? 'POBLACIÓN GENERAL / PARTICULAR' : 'TRABAJADOR / BENEFICIARIO BACIS'
        const companionName = (consulta.pacientes?.acompanante || '').toUpperCase()
        const folioReceta = `REC-${(consulta.id_consulta || '').toString().slice(0, 8).toUpperCase()}`

        // Doctor data
        const doctorNombre = (doctorProfile?.nombre_completo || 'MÉDICO GENERAL TRATANTE').toUpperCase()
        const doctorEspecialidad = (doctorProfile?.especialidad || 'MEDICINA GENERAL Y SALUD OCUPACIONAL').toUpperCase()
        const doctorCedula = doctorProfile?.cedula_profesional || 'S/N'
        const doctorUniversidad = (doctorProfile?.universidad || '').toUpperCase()
        const doctorDomicilio = (doctorProfile?.domicilio_consultorio || 'UNIDAD MÉDICA EL HERRERO, DGO.').toUpperCase()
        const doctorTelefono = doctorProfile?.telefono_consultorio || ''
        const doctorFirma = doctorProfile?.firma || ''

        const logoTag = logoBase64
            ? `<img src="${logoBase64}" class="logo-img" alt="Logo Empresa" />`
            : `<div class="logo-placeholder">MINERA<br/>BACIS</div>`

        const medsRows = (dispensacion && dispensacion.length > 0) ? dispensacion.map((item: any, idx: number) => {
            const m = item.cat_medicamentos || {}
            const dosisTexto = (item.dosis || m.descripcion || 'Tomar según prescripción médica.').toUpperCase()
            const isEven = idx % 2 === 0
            return `
                <tr class="${isEven ? 'row-even' : 'row-odd'}">
                    <td class="td-num">
                        <div class="qty-badge">${item.cantidad || 1}</div>
                    </td>
                    <td class="td-med">
                        <div class="med-name">${m.nombre || 'MEDICAMENTO'}</div>
                        ${m.sustancia_activa ? `<div class="med-sustancia">Sustancia activa: ${m.sustancia_activa.toUpperCase()}</div>` : ''}
                        <div class="med-pres">${m.presentacion || 'Presentación estándar'}</div>
                    </td>
                    <td class="td-dosis">
                        <div class="dosis-label">POSOLOGÍA E INDICACIONES:</div>
                        <div class="dosis-text">${dosisTexto}</div>
                    </td>
                </tr>
            `
        }).join('') : `
            <tr>
                <td colspan="3" class="td-empty">
                    Consulta de valoración y seguimiento clínico.<br/>
                    <span style="font-style:italic; font-weight:500;">Sin prescripción de fármacos en almacén para este episodio.</span>
                </td>
            </tr>
        `

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Receta Médica Oficial — ${pacienteNombre}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

                    * { box-sizing: border-box; margin: 0; padding: 0; }

                    body {
                        font-family: 'Inter', 'Arial', sans-serif;
                        background: #f1f5f9;
                        color: #1e293b;
                        padding: 30px;
                        line-height: 1.5;
                        font-size: 13px;
                    }

                    .card {
                        max-width: 820px;
                        margin: 0 auto;
                        background: #ffffff;
                        border-radius: 16px;
                        overflow: hidden;
                        box-shadow: 0 4px 24px rgba(0,0,0,0.12);
                        position: relative;
                    }

                    .top-bar {
                        height: 6px;
                        background: linear-gradient(90deg, #92400e 0%, #d97706 40%, #f59e0b 70%, #fbbf24 100%);
                    }

                    .header {
                        background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #1a2744 100%);
                        padding: 28px 36px;
                        display: flex;
                        align-items: stretch;
                        gap: 0;
                        position: relative;
                        overflow: hidden;
                    }

                    .header::before {
                        content: '';
                        position: absolute;
                        top: 0; right: 0; bottom: 0;
                        width: 220px;
                        background: repeating-linear-gradient(
                            60deg, transparent, transparent 18px,
                            rgba(245,158,11,0.04) 18px, rgba(245,158,11,0.04) 19px
                        ), repeating-linear-gradient(
                            -60deg, transparent, transparent 18px,
                            rgba(245,158,11,0.04) 18px, rgba(245,158,11,0.04) 19px
                        );
                        pointer-events: none;
                    }

                    .header-logo-col {
                        width: 130px;
                        min-width: 130px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-right: 1px solid rgba(255,255,255,0.1);
                        padding-right: 24px;
                    }

                    .logo-img {
                        max-width: 120px;
                        max-height: 80px;
                        object-fit: contain;
                        filter: brightness(1) drop-shadow(0 2px 4px rgba(0,0,0,0.3));
                    }

                    .logo-placeholder {
                        font-size: 11px;
                        font-weight: 900;
                        color: #f59e0b;
                        letter-spacing: 2px;
                        text-transform: uppercase;
                        text-align: center;
                        line-height: 1.3;
                    }

                    .header-doctor-col {
                        flex: 1;
                        padding: 0 24px;
                        border-right: 1px solid rgba(255,255,255,0.1);
                    }

                    .doctor-badge {
                        display: inline-flex;
                        align-items: center;
                        gap: 5px;
                        background: rgba(245,158,11,0.15);
                        border: 1px solid rgba(245,158,11,0.3);
                        color: #fbbf24;
                        font-size: 8px;
                        font-weight: 800;
                        letter-spacing: 1.5px;
                        text-transform: uppercase;
                        padding: 3px 10px;
                        border-radius: 4px;
                        margin-bottom: 8px;
                    }

                    .doctor-name-h {
                        font-size: 17px;
                        font-weight: 900;
                        color: #ffffff;
                        letter-spacing: 0.5px;
                        line-height: 1.2;
                        margin-bottom: 3px;
                    }

                    .doctor-spec-h {
                        font-size: 10px;
                        font-weight: 700;
                        color: #f59e0b;
                        text-transform: uppercase;
                        letter-spacing: 0.8px;
                        margin-bottom: 10px;
                    }

                    .doctor-data-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 3px 16px;
                    }

                    .doctor-data-item {
                        font-size: 9px;
                        font-weight: 600;
                        color: #94a3b8;
                        line-height: 1.5;
                    }

                    .doctor-data-item strong {
                        color: #cbd5e1;
                        font-weight: 800;
                        text-transform: uppercase;
                        font-size: 8px;
                        letter-spacing: 0.5px;
                        display: block;
                    }

                    .header-folio-col {
                        min-width: 155px;
                        display: flex;
                        flex-direction: column;
                        align-items: flex-end;
                        justify-content: space-between;
                        padding-left: 24px;
                        text-align: right;
                    }

                    .receta-badge-h {
                        background: #f59e0b;
                        color: #000000;
                        font-size: 8px;
                        font-weight: 900;
                        letter-spacing: 1.5px;
                        text-transform: uppercase;
                        padding: 4px 12px;
                        border-radius: 4px;
                        display: inline-block;
                    }

                    .folio-h {
                        font-size: 20px;
                        font-weight: 900;
                        color: #ffffff;
                        font-family: 'Courier New', monospace;
                        letter-spacing: 1px;
                        margin: 6px 0;
                    }

                    .fecha-h {
                        font-size: 9px;
                        font-weight: 600;
                        color: #64748b;
                        text-transform: capitalize;
                        line-height: 1.4;
                    }

                    .accent-bar {
                        height: 3px;
                        background: linear-gradient(90deg, #f59e0b, #fcd34d, #f59e0b);
                    }

                    .body {
                        padding: 28px 36px;
                    }

                    .patient-section {
                        display: grid;
                        grid-template-columns: 1.5fr 1fr;
                        gap: 20px;
                        margin-bottom: 24px;
                        padding: 18px 22px;
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-left: 5px solid #0f172a;
                        border-radius: 10px;
                    }

                    .patient-label {
                        font-size: 8.5px;
                        font-weight: 800;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        margin-bottom: 5px;
                    }

                    .patient-name-h {
                        font-size: 16px;
                        font-weight: 900;
                        color: #0f172a;
                        margin-bottom: 6px;
                        line-height: 1.2;
                    }

                    .patient-tag {
                        display: inline-block;
                        background: #0f172a;
                        color: #f59e0b;
                        font-size: 8px;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: 0.8px;
                        padding: 3px 10px;
                        border-radius: 4px;
                    }

                    .companion-text {
                        font-size: 9.5px;
                        font-weight: 700;
                        color: #475569;
                        margin-top: 7px;
                    }

                    .diag-col {
                        border-left: 1px solid #e2e8f0;
                        padding-left: 20px;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                    }

                    .diag-label-h {
                        font-size: 8.5px;
                        font-weight: 800;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        margin-bottom: 5px;
                    }

                    .diag-text-h {
                        font-size: 12px;
                        font-weight: 700;
                        color: #1e293b;
                        line-height: 1.4;
                    }

                    .section-title {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        margin-bottom: 14px;
                    }

                    .section-title-icon {
                        width: 26px;
                        height: 26px;
                        background: #0f172a;
                        border-radius: 6px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 13px;
                    }

                    .section-title-text {
                        font-size: 11px;
                        font-weight: 900;
                        color: #0f172a;
                        text-transform: uppercase;
                        letter-spacing: 1.5px;
                        white-space: nowrap;
                    }

                    .section-title-line {
                        flex: 1;
                        height: 1px;
                        background: linear-gradient(90deg, #0f172a, transparent);
                    }

                    .med-table {
                        width: 100%;
                        border-collapse: collapse;
                        border-radius: 10px;
                        overflow: hidden;
                        border: 1px solid #e2e8f0;
                        margin-bottom: 22px;
                        box-shadow: 0 1px 4px rgba(0,0,0,0.05);
                    }

                    .med-table thead tr { background: #0f172a; }

                    .med-table thead th {
                        color: #f59e0b;
                        font-size: 9px;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        padding: 11px 14px;
                        text-align: left;
                    }

                    .med-table thead th:first-child {
                        text-align: center;
                        width: 70px;
                    }

                    .row-even { background: #ffffff; }
                    .row-odd  { background: #f8fafc; }

                    .td-num {
                        padding: 13px 10px;
                        text-align: center;
                        border-bottom: 1px solid #f1f5f9;
                        width: 70px;
                    }

                    .qty-badge {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 32px;
                        height: 32px;
                        background: #0f172a;
                        color: #f59e0b;
                        font-size: 14px;
                        font-weight: 900;
                        border-radius: 8px;
                    }

                    .td-med {
                        padding: 13px 14px;
                        border-bottom: 1px solid #f1f5f9;
                        border-left: 1px solid #f1f5f9;
                    }

                    .med-name {
                        font-size: 13px;
                        font-weight: 800;
                        color: #0f172a;
                        text-transform: uppercase;
                        margin-bottom: 2px;
                    }

                    .med-sustancia {
                        font-size: 9.5px;
                        font-weight: 700;
                        color: #b45309;
                        margin-top: 2px;
                    }

                    .med-pres {
                        font-size: 9px;
                        font-weight: 600;
                        color: #64748b;
                        margin-top: 1px;
                    }

                    .td-dosis {
                        padding: 13px 14px;
                        border-bottom: 1px solid #f1f5f9;
                        border-left: 1px solid #f1f5f9;
                    }

                    .dosis-label {
                        font-size: 8px;
                        font-weight: 800;
                        color: #94a3b8;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin-bottom: 3px;
                    }

                    .dosis-text {
                        font-size: 11px;
                        font-weight: 700;
                        color: #1e293b;
                        line-height: 1.45;
                    }

                    .td-empty {
                        padding: 28px;
                        text-align: center;
                        color: #94a3b8;
                        font-size: 12px;
                        font-weight: 600;
                        border-bottom: 1px solid #f1f5f9;
                    }

                    .indicaciones-box {
                        background: linear-gradient(135deg, #fffbeb, #fef3c7);
                        border: 1px solid #fde68a;
                        border-left: 4px solid #f59e0b;
                        padding: 16px 20px;
                        border-radius: 10px;
                        margin-bottom: 0;
                    }

                    .indicaciones-title {
                        font-size: 9px;
                        font-weight: 900;
                        color: #b45309;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        margin-bottom: 8px;
                    }

                    .indicaciones-list {
                        margin: 0;
                        padding-left: 16px;
                        color: #78350f;
                        font-size: 10.5px;
                        font-weight: 600;
                        line-height: 1.7;
                    }

                    .footer-strip {
                        background: #f8fafc;
                        border-top: 1px solid #e2e8f0;
                        padding: 22px 36px;
                        display: grid;
                        grid-template-columns: 1fr auto 1fr;
                        align-items: end;
                        gap: 20px;
                    }

                    .firma-col {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }

                    .firma-img-wrap {
                        height: 60px;
                        display: flex;
                        align-items: flex-end;
                        justify-content: center;
                        margin-bottom: 4px;
                    }

                    .firma-img-wrap img {
                        max-height: 55px;
                        max-width: 160px;
                        object-fit: contain;
                    }

                    .firma-line {
                        width: 180px;
                        height: 0;
                        border-bottom: 2px solid #0f172a;
                        margin-bottom: 6px;
                    }

                    .firma-name {
                        font-size: 11px;
                        font-weight: 900;
                        color: #0f172a;
                        text-align: center;
                        margin-bottom: 2px;
                    }

                    .firma-sub {
                        font-size: 8px;
                        font-weight: 600;
                        color: #64748b;
                        text-align: center;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }

                    .sello-col {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                    }

                    .sello-circle {
                        width: 88px;
                        height: 88px;
                        border: 2.5px dashed #cbd5e1;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        text-align: center;
                        flex-direction: column;
                        padding: 10px;
                        color: #94a3b8;
                        background: #ffffff;
                    }

                    .sello-text {
                        font-size: 7px;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        line-height: 1.4;
                    }

                    .legal-col { text-align: right; }

                    .legal-badge {
                        display: inline-block;
                        background: #0f172a;
                        color: #f59e0b;
                        font-size: 7.5px;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        padding: 4px 10px;
                        border-radius: 4px;
                        margin-bottom: 6px;
                    }

                    .legal-text {
                        font-size: 8px;
                        color: #94a3b8;
                        font-weight: 500;
                        line-height: 1.6;
                    }

                    .bottom-bar {
                        height: 4px;
                        background: linear-gradient(90deg, #f59e0b 0%, #d97706 50%, #92400e 100%);
                    }

                    .watermark {
                        position: fixed;
                        top: 50%; left: 50%;
                        transform: translate(-50%, -50%) rotate(-30deg);
                        font-size: 90px;
                        font-weight: 900;
                        color: rgba(15,23,42,0.022);
                        pointer-events: none;
                        white-space: nowrap;
                        z-index: 0;
                        letter-spacing: 10px;
                    }

                    @media print {
                        body { background: #fff; padding: 0; }
                        .card { box-shadow: none; border-radius: 0; max-width: 100%; }
                        .watermark { position: absolute; }
                    }
                </style>
            </head>
            <body>
                <div class="watermark">BACIS</div>
                <div class="card">
                    <div class="top-bar"></div>

                    <div class="header">
                        <div class="header-logo-col">
                            ${logoTag}
                        </div>

                        <div class="header-doctor-col">
                            <div class="doctor-badge">⚕ Médico Prescriptor</div>
                            <div class="doctor-name-h">${doctorNombre}</div>
                            <div class="doctor-spec-h">${doctorEspecialidad}</div>
                            <div class="doctor-data-grid">
                                <div class="doctor-data-item">
                                    <strong>Cédula Profesional:</strong>${doctorCedula}
                                </div>
                                ${doctorUniversidad ? `<div class="doctor-data-item"><strong>Institución Emisora:</strong>${doctorUniversidad}</div>` : `<div></div>`}
                                <div class="doctor-data-item">
                                    <strong>Domicilio Consultorio:</strong>${doctorDomicilio}
                                </div>
                                ${doctorTelefono ? `<div class="doctor-data-item"><strong>Teléfono:</strong>${doctorTelefono}</div>` : `<div></div>`}
                            </div>
                        </div>

                        <div class="header-folio-col">
                            <div class="receta-badge-h">Receta Médica Oficial</div>
                            <div class="folio-h">${folioReceta}</div>
                            <div class="fecha-h">${formattedFecha}</div>
                        </div>
                    </div>

                    <div class="accent-bar"></div>

                    <div class="body">
                        <!-- PACIENTE -->
                        <div class="patient-section">
                            <div>
                                <div class="patient-label">Nombre del Paciente</div>
                                <div class="patient-name-h">${pacienteNombre}</div>
                                <span class="patient-tag">${categoriaPaciente}</span>
                                ${companionName ? `<div class="companion-text">Acompañante: ${companionName}</div>` : ''}
                            </div>
                            <div class="diag-col">
                                <div class="diag-label-h">Diagnóstico / Motivo de Consulta</div>
                                <div class="diag-text-h">${diagTexto.replace(/\n/g, '<br/>')}</div>
                            </div>
                        </div>

                        <!-- PRESCRIPCIÓN -->
                        <div class="section-title">
                            <div class="section-title-icon">💊</div>
                            <div class="section-title-text">Prescripción Médica</div>
                            <div class="section-title-line"></div>
                        </div>

                        <table class="med-table">
                            <thead>
                                <tr>
                                    <th style="text-align:center;">Cant.</th>
                                    <th>Medicamento / Sustancia Activa / Forma Farmacéutica</th>
                                    <th>Dosis, Vía de Administración y Duración</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${medsRows}
                            </tbody>
                        </table>

                        <!-- INDICACIONES -->
                        <div class="indicaciones-box">
                            <div class="indicaciones-title">⚠ Indicaciones Médicas de Seguridad y Cuidados</div>
                            <ul class="indicaciones-list">
                                <li>Completar el tratamiento en los días y horarios indicados puntualmente por el médico tratante.</li>
                                <li>Evitar la automedicación. Ingerir abundante agua durante la jornada laboral o en domicilio.</li>
                                <li>En caso de presentar reacciones adversas, acudir al servicio de urgencias de la unidad médica de inmediato.</li>
                                <li>En área minera: conservar el medicamento en lugar fresco, seco y alejado de sustancias químicas del proceso.</li>
                            </ul>
                        </div>
                    </div>

                    <!-- FOOTER FIRMA Y SELLO -->
                    <div class="footer-strip">
                        <div class="firma-col">
                            <div class="firma-img-wrap">
                                ${doctorFirma ? `<img src="${doctorFirma}" alt="Firma del médico" />` : '<div style="height:55px;"></div>'}
                            </div>
                            <div class="firma-line"></div>
                            <div class="firma-name">${doctorNombre}</div>
                            <div class="firma-sub">Cédula: ${doctorCedula} · Firma del Médico Prescriptor</div>
                        </div>

                        <div class="sello-col">
                            <div class="sello-circle">
                                <div class="sello-text">SELLO<br/>FARMACIA<br/>/ MÉDICO</div>
                            </div>
                        </div>

                        <div class="legal-col">
                            <div class="legal-badge">Validez Vigente Durante el Tratamiento</div>
                            <div class="legal-text">
                                Documento clínico oficial para dispensación<br/>
                                en farmacia y justificación de tratamiento.<br/>
                                Folio: <strong>${folioReceta}</strong> · Fecha: <strong>${fechaCorta}</strong>
                            </div>
                        </div>
                    </div>

                    <div class="bottom-bar"></div>
                </div>

                <script>
                    window.onload = () => {
                        setTimeout(() => {
                            window.print();
                            window.close();
                        }, 600);
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
                                    <p className="text-[11px] text-zinc-400 mt-1">Presione &quot;+ Agregar Medicamento&quot; para iniciar la receta</p>
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
