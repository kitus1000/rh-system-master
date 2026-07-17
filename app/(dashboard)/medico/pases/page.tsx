'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Hospital, Plus, Plane, Building, FileText, Printer, Stethoscope, Users, CheckSquare } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

export default function PasesPage() {
    const { profile } = useAuth()
    const [pases, setPases] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [pacientes, setPacientes] = useState<any[]>([])
    const [clinicas, setClinicas] = useState<any[]>([])
    const [empleados, setEmpleados] = useState<any[]>([])

    const [formData, setFormData] = useState({
        id_paciente: '',
        id_clinica_origen: '',
        id_clinica_destino: '',
        motivo: '',
        requiere_hotel: false,
        hotel_nombre: '',
        fecha_salida: '',
        fecha_retorno: '',
        
        // New PDF Fields
        folio: '',
        urgencia: 'NO',
        parentesco: '',
        nombre_trabajador: '',
        edad: '',
        unidad_refiere: 'UNIDAD MEDICA BACIS',
        unidad_se_refiere: 'CONSULTORIO MEDICO INDUSTRIAL',
        servicio_se_envia: '',
        medico_acepta: '',
        acompanante: 'NO REQUIERE',
        
        // Vital signs
        sv_ta: '',
        sv_temp: '',
        sv_fr: '',
        sv_fc: '',
        sv_peso: '',
        sv_talla: '',
        
        // Diagnostics
        padecimiento_actual: '',
        estudios_paraclinicos: 'LOS NECESARIOS PARA SU PADECIMIENTO',
        impresion_diagnostica: '',
        comentarios: 'SE ENVIA PARA SEGUIMIENTO Y TRATAMIENTO',
        
        // Doctor & Travel details
        medico_refiere: '',
        cedula_refiere: '',
        fecha_salida_unidad: '',
        medio_transporte: 'VIA TERRESTRE',
        fecha_consulta: '',
        fecha_presento_consulta: '',
        medico_responsable_unidad: '',
        cedula_responsable_unidad: '',
        requiere_especialista: false,
        fecha_cita: '',
        
        // Visibilidad
        compartido_departamentos: false
    })

    useEffect(() => {
        fetchPases()
        fetchCatalogos()
    }, [])

    useEffect(() => {
        if (profile) {
            // Predeterminar clínica de origen y médico
            setFormData(prev => ({
                ...prev,
                id_clinica_origen: (profile as any).id_clinica || '',
                medico_refiere: profile.nombre_completo || '',
            }))
        }
    }, [profile])

    const fetchCatalogos = async () => {
        const { data: pData } = await supabase.from('pacientes').select('*').order('nombre_completo')
        if (pData) setPacientes(pData)

        const { data: cData } = await supabase.from('cat_clinicas').select('*').order('nombre')
        if (cData) setClinicas(cData)

        const { data: eData } = await supabase.from('empleados').select('*').order('nombre')
        if (eData) setEmpleados(eData)
    }

    const fetchPases = async () => {
        const { data, error } = await supabase.from('pases_medicos').select(`
            *,
            pacientes (nombre_completo, parentesco, es_poblacion_general, id_empleado),
            clinica_origen:cat_clinicas!pases_medicos_id_clinica_origen_fkey (nombre),
            clinica_destino:cat_clinicas!pases_medicos_id_clinica_destino_fkey (nombre)
        `).order('creado_el', { ascending: false })
        
        if (data) setPases(data)
        setLoading(false)
    }

    const handlePacienteChange = (pacId: string) => {
        const pac = pacientes.find(p => p.id_paciente === pacId)
        if (!pac) return

        // Calculate age
        let edadStr = ''
        if (pac.fecha_nacimiento) {
            const birth = new Date(pac.fecha_nacimiento)
            const today = new Date()
            let years = today.getFullYear() - birth.getFullYear()
            const m = today.getMonth() - birth.getMonth()
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
                years--
            }
            edadStr = `${years} AÑOS`
        }

        // Parentesco details
        const parentesco = pac.parentesco || (pac.es_poblacion_general ? 'PÚBLICO GENERAL' : 'ELLA MISMA')
        
        // Find worker name
        let workerName = ''
        if (pac.id_empleado) {
            const emp = empleados.find(e => e.id_empleado === pac.id_empleado)
            if (emp) {
                workerName = `${emp.nombre} ${emp.apellido_paterno}`.toUpperCase()
            }
        } else if (pac.es_poblacion_general) {
            workerName = 'PÚBLICO GENERAL'
        }

        setFormData(prev => ({
            ...prev,
            id_paciente: pacId,
            edad: edadStr,
            parentesco: parentesco.toUpperCase(),
            nombre_trabajador: parentesco.toUpperCase() === 'ELLA MISMA' ? pac.nombre_completo.toUpperCase() : workerName
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        // Find employee id from patient
        const pac = pacientes.find(p => p.id_paciente === formData.id_paciente)
        const employeeId = pac?.id_empleado || null

        const { error } = await supabase.from('pases_medicos').insert([{
            ...formData,
            id_empleado: employeeId,
            hotel_nombre: formData.requiere_hotel ? formData.hotel_nombre : null
        }])
        
        if (!error) {
            setShowForm(false)
            setFormData(prev => ({
                id_paciente: '', id_clinica_origen: prev.id_clinica_origen, id_clinica_destino: '',
                motivo: '', requiere_hotel: false, hotel_nombre: '',
                fecha_salida: '', fecha_retorno: '',
                folio: '', urgencia: 'NO', parentesco: '', nombre_trabajador: '', edad: '',
                unidad_refiere: 'UNIDAD MEDICA BACIS', unidad_se_refiere: 'CONSULTORIO MEDICO INDUSTRIAL',
                servicio_se_envia: '', medico_acepta: '', acompanante: 'NO REQUIERE',
                sv_ta: '', sv_temp: '', sv_fr: '', sv_fc: '', sv_peso: '', sv_talla: '',
                padecimiento_actual: '', estudios_paraclinicos: 'LOS NECESARIOS PARA SU PADECIMIENTO',
                impresion_diagnostica: '', comentarios: 'SE ENVIA PARA SEGUIMIENTO Y TRATAMIENTO',
                medico_refiere: prev.medico_refiere, cedula_refiere: '', fecha_salida_unidad: '',
                medio_transporte: 'VIA TERRESTRE', fecha_consulta: '', fecha_presento_consulta: '',
                medico_responsable_unidad: '', cedula_responsable_unidad: '', requiere_especialista: false,
                fecha_cita: '', compartido_departamentos: false
            }))
            fetchPases()
        } else {
            console.error('Error saving medical pass:', error)
            alert('Error al guardar el pase médico: ' + error.message)
        }
    }

    const handlePrintPase = (pase: any) => {
        const printWindow = window.open('', '_blank', 'width=900,height=1200')
        if (!printWindow) return

        const formattedFecha = pase.fecha_salida ? new Date(pase.fecha_salida + 'T12:00:00').toLocaleDateString('es-ES', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        }) : ''

        const formattedFechaSalidaUnidad = pase.fecha_salida_unidad ? new Date(pase.fecha_salida_unidad + 'T12:00:00').toLocaleDateString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        }) : ''

        const formattedFechaConsulta = pase.fecha_consulta ? new Date(pase.fecha_consulta + 'T12:00:00').toLocaleDateString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        }) : ''

        printWindow.document.write(`
            <html>
                <head>
                    <title>Pase Médico - ${pase.pacientes?.nombre_completo || ''}</title>
                    <style>
                        @page {
                            size: letter;
                            margin: 0;
                        }
                        body {
                            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                            margin: 0;
                            padding: 0;
                            color: #000;
                            background: #fff;
                            font-size: 10px;
                            line-height: 1.3;
                        }
                        .page {
                            width: 216mm;
                            height: 279mm;
                            box-sizing: border-box;
                            padding: 15mm 20mm;
                            position: relative;
                            page-break-after: always;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-between;
                        }
                        
                        /* Layout elements */
                        .header-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 5px;
                        }
                        .header-logo {
                            width: 80px;
                            text-align: left;
                        }
                        .logo-img {
                            width: 65px;
                            height: auto;
                        }
                        .header-title {
                            text-align: center;
                            font-weight: bold;
                            font-size: 14px;
                            letter-spacing: 0.5px;
                        }
                        .header-subtitle {
                            font-size: 11px;
                            font-weight: bold;
                            margin-top: 2px;
                        }
                        .header-department {
                            font-size: 11px;
                            font-weight: bold;
                            margin-top: 2px;
                        }
                        .document-title {
                            text-align: center;
                            font-weight: bold;
                            font-size: 13px;
                            margin: 10px 0;
                            letter-spacing: 1px;
                            text-transform: uppercase;
                        }
                        
                        /* Folio block */
                        .folio-block {
                            text-align: right;
                            margin-bottom: 10px;
                        }
                        .folio-lbl {
                            color: red;
                            font-size: 13px;
                            font-weight: bold;
                        }
                        
                        /* Fields Grid styling */
                        .fields-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 8px;
                        }
                        .fields-table td {
                            padding: 4px 6px;
                            vertical-align: middle;
                            border: 1px solid #ddd;
                        }
                        .field-label {
                            font-weight: bold;
                            text-transform: uppercase;
                            font-size: 8.5px;
                            color: #333;
                            background-color: #fafafa;
                            width: 20%;
                        }
                        .field-value {
                            font-weight: bold;
                            color: blue;
                            font-size: 9.5px;
                            width: 30%;
                        }
                        
                        /* Block text areas */
                        .text-block-title {
                            font-weight: bold;
                            text-transform: uppercase;
                            font-size: 9px;
                            color: blue;
                            margin-top: 8px;
                            margin-bottom: 2px;
                        }
                        .text-block-box {
                            border: 1px solid #000;
                            min-height: 80px;
                            padding: 8px;
                            font-size: 9.5px;
                            font-weight: bold;
                            text-transform: uppercase;
                            margin-bottom: 10px;
                        }
                        .text-block-box-small {
                            border: 1px solid #000;
                            min-height: 25px;
                            padding: 5px;
                            font-size: 9.5px;
                            font-weight: bold;
                            text-transform: uppercase;
                            margin-bottom: 10px;
                        }
                        
                        /* Signatures */
                        .signature-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-top: 15px;
                        }
                        .signature-cell {
                            width: 50%;
                            text-align: center;
                            vertical-align: bottom;
                            padding-top: 40px;
                        }
                        .signature-line {
                            width: 80%;
                            margin: 0 auto;
                            border-top: 1px solid #000;
                            padding-top: 4px;
                            font-size: 9px;
                            font-weight: bold;
                        }
                        .signature-sub {
                            font-size: 8px;
                            color: #666;
                            margin-top: 2px;
                        }
                        
                        /* Page 2 Specific tables */
                        .p2-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 10px;
                        }
                        .p2-table th, .p2-table td {
                            border: 1px solid #000;
                            padding: 6px;
                            text-align: center;
                            font-weight: bold;
                        }
                        .p2-table th {
                            background-color: #f0f0f0;
                            font-size: 8.5px;
                        }
                    </style>
                </head>
                <body>
                    <!-- PAGE 1: HOJA DE REFERENCIA -->
                    <div class="page">
                        <div>
                            <table class="header-table">
                                <tr>
                                    <td class="header-logo">
                                        <div style="width:65px; height:65px; border:2px solid #000; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:24px; font-family:serif; background-color:#1a2b4c; color:#fff;">GB</div>
                                    </td>
                                    <td class="header-title">
                                        GRUPO MINERO BACIS
                                        <div class="header-subtitle">UNIDAD "EL HERRERO"</div>
                                        <div class="header-department">SERVICIOS MÉDICOS</div>
                                    </td>
                                    <td style="width: 80px;"></td>
                                </tr>
                            </table>
                            
                            <div class="document-title">Hoja de Referencia</div>
                            
                            <div class="folio-block">
                                <span class="folio-lbl">Folio &nbsp; ${pase.folio || ''}</span>
                                <div style="font-size:9px; font-weight:bold; margin-top:2px;">
                                    Num Expediente: <span style="text-decoration:underline;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                                </div>
                            </div>
                            
                            <table class="fields-table">
                                <tr>
                                    <td class="field-label">Fecha</td>
                                    <td class="field-value">${formattedFecha}</td>
                                    <td class="field-label">Urgencia</td>
                                    <td class="field-value">${pase.urgencia || 'NO'}</td>
                                </tr>
                                <tr>
                                    <td class="field-label">Nombre de Paciente</td>
                                    <td class="field-value" style="font-size:10px;">${(pase.pacientes?.nombre_completo || '').toUpperCase()}</td>
                                    <td class="field-label">Parentesco</td>
                                    <td class="field-value">${(pase.parentesco || '').toUpperCase()}</td>
                                </tr>
                                <tr>
                                    <td class="field-label">Nombre de Trabajador</td>
                                    <td class="field-value">${(pase.nombre_trabajador || '').toUpperCase()}</td>
                                    <td class="field-label">Salida</td>
                                    <td class="field-value">${formattedFecha}</td>
                                </tr>
                                <tr>
                                    <td class="field-label">Edad</td>
                                    <td class="field-value">${pase.edad || ''}</td>
                                    <td class="field-label">Unidad a la que se refiere</td>
                                    <td class="field-value">${(pase.unidad_se_refiere || '').toUpperCase()}</td>
                                </tr>
                                <tr>
                                    <td class="field-label">Unidad que refiere</td>
                                    <td class="field-value">${(pase.unidad_refiere || '').toUpperCase()}</td>
                                    <td class="field-label">Médico que acepta la referencia</td>
                                    <td class="field-value">${(pase.medico_acepta || '').toUpperCase()}</td>
                                </tr>
                                <tr>
                                    <td class="field-label">Servicio al que se envía</td>
                                    <td class="field-value" style="font-size:9px;">${(pase.servicio_se_envia || '').toUpperCase()}</td>
                                    <td class="field-label">Acompañante</td>
                                    <td class="field-value">${(pase.acompanante || '').toUpperCase()}</td>
                                </tr>
                            </table>
                            
                            <table class="fields-table" style="margin-top: 10px;">
                                <tr>
                                    <td class="field-label" style="width:10%">SV:</td>
                                    <td class="field-label" style="width:10%">TA:</td>
                                    <td class="field-value" style="width:15%">${pase.sv_ta || ''}</td>
                                    <td class="field-label" style="width:10%">Temp:</td>
                                    <td class="field-value" style="width:15%">${pase.sv_temp || ''} &deg;C</td>
                                    <td class="field-label" style="width:8%">FR:</td>
                                    <td class="field-value" style="width:12%">${pase.sv_fr || ''}</td>
                                    <td class="field-label" style="width:8%">FC:</td>
                                    <td class="field-value" style="width:12%">${pase.sv_fc || ''}</td>
                                    <td class="field-label" style="width:10%">Peso:</td>
                                    <td class="field-value" style="width:10%">${pase.sv_peso || ''} kg</td>
                                    <td class="field-label" style="width:10%">Talla:</td>
                                    <td class="field-value" style="width:10%">${pase.sv_talla || ''}</td>
                                </tr>
                            </table>
                            
                            <div class="text-block-title">Padecimiento actual:</div>
                            <div class="text-block-box">${pase.padecimiento_actual || ''}</div>
                            
                            <div class="text-block-title">Estudios paraclínicos:</div>
                            <div class="text-block-box-small">${pase.estudios_paraclinicos || ''}</div>
                            
                            <div class="text-block-title">Impresión diagnóstica:</div>
                            <div class="text-block-box-small">${pase.impresion_diagnostica || ''}</div>
                            
                            <div class="text-block-title">Comentarios:</div>
                            <div class="text-block-box-small">${pase.comentarios || ''}</div>
                        </div>
                        
                        <div>
                            <table class="signature-table">
                                <tr>
                                    <td class="signature-cell">
                                        <div class="signature-line">Nombre y firma de quien autoriza</div>
                                        <div class="signature-sub">Servicios Médicos El Herrero</div>
                                    </td>
                                    <td class="signature-cell">
                                        <div class="signature-line">${(pase.medico_refiere || '').toUpperCase()}</div>
                                        <div class="signature-sub">Nombre y firma del médico que refiere<br/>CÉDULA: ${pase.cedula_refiere || ''}</div>
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </div>
                    
                    <!-- PAGE 2: PASE MÉDICO / VIÁTICOS -->
                    <div class="page">
                        <div>
                            <table class="header-table">
                                <tr>
                                    <td class="header-logo">
                                        <div style="width:65px; height:65px; border:2px solid #000; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:24px; font-family:serif; background-color:#1a2b4c; color:#fff;">GB</div>
                                    </td>
                                    <td class="header-title">
                                        Grupo Minero Bacís S.A. de C.V.
                                        <div class="header-subtitle">Unidad "El Herrero"</div>
                                    </td>
                                    <td style="width: 80px; text-align: right; vertical-align: top;">
                                        <div style="border: 1px solid #000; padding: 4px 8px; font-weight: bold; color: red; font-size: 12px; display: inline-block;">${pase.folio || ''}</div>
                                    </td>
                                </tr>
                            </table>
                            
                            <div class="document-title" style="margin-top: 5px; margin-bottom: 15px;">Pase Médico y Registro de Viáticos</div>
                            
                            <table class="fields-table">
                                <tr>
                                    <td class="field-label" style="width: 25%;">Nombre del paciente</td>
                                    <td class="field-value" style="width: 45%;">${(pase.pacientes?.nombre_completo || '').toUpperCase()}</td>
                                    <td class="field-label" style="width: 15%;">Edad:</td>
                                    <td class="field-value" style="width: 15%;">${pase.edad || ''}</td>
                                </tr>
                                <tr>
                                    <td class="field-label">Nombre del trabajador</td>
                                    <td class="field-value" colspan="3">${(pase.nombre_trabajador || '').toUpperCase()}</td>
                                </tr>
                                <tr>
                                    <td class="field-label">Puesto:</td>
                                    <td class="field-value" style="font-size: 8.5px; color:#555;">${(pase.empleados?.puesto || '').toUpperCase()}</td>
                                    <td class="field-label">Departamento:</td>
                                    <td class="field-value" style="font-size: 8.5px; color:#555;">${pase.departamento_pasajero || ''}</td>
                                </tr>
                            </table>
                            
                            <table class="p2-table" style="margin-top: 15px;">
                                <thead>
                                    <tr>
                                        <th style="width: 50%;">Fecha de salida de la unidad</th>
                                        <th style="width: 50%;">Medio de transporte</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style="color: blue; padding: 8px; font-size: 11px;">${formattedFechaSalidaUnidad.toUpperCase()}</td>
                                        <td style="color: blue; padding: 8px; font-size: 11px;">${(pase.medio_transporte || 'VIA TERRESTRE').toUpperCase()}</td>
                                    </tr>
                                </tbody>
                            </table>
                            
                            <table class="p2-table" style="margin-top: 10px;">
                                <thead>
                                    <tr>
                                        <th style="width: 50%;">Fecha que debe presentarse a consulta</th>
                                        <th style="width: 50%;">Fecha en que se presentó a consulta</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style="color: blue; padding: 8px; font-size: 11px;">${formattedFechaConsulta.toUpperCase()}</td>
                                        <td style="padding: 8px; font-size: 11px; color: #ccc;">[ Campo para Firma Médica Externa ]</td>
                                    </tr>
                                </tbody>
                            </table>
                            
                            <table class="fields-table" style="margin-top: 15px;">
                                <tr>
                                    <td class="field-label" style="width: 40%;">Nombre Firma y cédula de Médico responsable de Unidad</td>
                                    <td class="field-value" style="width: 60%; font-size: 9.5px; color: blue;">${(pase.medico_responsable_unidad || '').toUpperCase()} CED. PROF. ${pase.cedula_responsable_unidad || ''}</td>
                                </tr>
                                <tr>
                                    <td class="field-label">Se requiere atención de especialista:</td>
                                    <td class="field-value" style="color: blue;">
                                        [ ${pase.requiere_especialista ? 'X' : '  '} ] Sí &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; [ ${!pase.requiere_especialista ? 'X' : '  '} ] No
                                    </td>
                                </tr>
                                <tr>
                                    <td class="field-label">Fecha de cita:</td>
                                    <td class="field-value">${pase.fecha_cita || ''}</td>
                                </tr>
                            </table>
                            
                            <div class="text-block-title" style="margin-top: 15px;">Firma y sello de Consultorio Médico Industrial:</div>
                            <div style="border: 1px solid #000; height: 60px; margin-bottom: 20px; display:flex; align-items:center; justify-content:center; color:#ccc; font-weight:bold;">Consultorio Médico Industrial Stamp Space</div>
                            
                            <div style="border-top: 2px dashed #000; margin: 20px 0; text-align: center; font-weight: bold; font-size: 9px; letter-spacing: 2px; color: #555;">USO EXCLUSIVO DE CONTABILIDAD Y R.H.</div>
                            
                            <table class="p2-table">
                                <thead>
                                    <tr>
                                        <th colspan="3">Viáticos proporcionados en Unidad el Herrero</th>
                                    </tr>
                                    <tr>
                                        <th>Días de viáticos</th>
                                        <th>Cantidad diaria</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style="height: 35px;">
                                        <td></td>
                                        <td></td>
                                        <td></td>
                                    </tr>
                                </tbody>
                            </table>
                            
                            <table class="signature-table" style="margin-top: 10px;">
                                <tr>
                                    <td class="signature-cell" style="padding-top: 25px;">
                                        <div class="signature-line">Nombre y firma de recibido</div>
                                    </td>
                                    <td class="signature-cell" style="padding-top: 25px;">
                                        <div class="signature-line">Autorizó</div>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="signature-cell" style="padding-top: 25px;">
                                        <div class="signature-line">Firma de Contraloría</div>
                                    </td>
                                    <td class="signature-cell" style="padding-top: 25px;">
                                        <div class="signature-line">Firma de Caja</div>
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </div>
                    
                    <script>
                        window.onload = function() {
                            window.print();
                            window.close();
                        }
                    </script>
                </body>
            </html>
        `)
        printWindow.document.close()
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-800 flex items-center gap-2">
                        <Hospital className="w-6 h-6 text-amber-500" />
                        Pases Médicos Oficiales
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1">Generación y exportación de pases de traslado y viáticos</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-zinc-900 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-zinc-800 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    {showForm ? 'Cancelar' : 'Generar Pase'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 space-y-6">
                    <h2 className="text-lg font-bold text-zinc-900 border-b pb-3 flex items-center gap-2">
                        <Plane className="w-5 h-5 text-zinc-400" />
                        Nuevo Registro de Referencia Médica y Traslado
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Paciente y Folio */}
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Paciente</label>
                            <select 
                                required className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold"
                                value={formData.id_paciente}
                                onChange={e => handlePacienteChange(e.target.value)}
                            >
                                <option value="">Seleccione paciente...</option>
                                {pacientes.map(p => (
                                    <option key={p.id_paciente} value={p.id_paciente}>
                                        {p.nombre_completo} {p.es_poblacion_general ? '(Público General)' : `(${p.parentesco || 'Trabajador'})`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Folio Pase (ej. A 04482)</label>
                            <input 
                                required type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold"
                                value={formData.folio}
                                onChange={e => setFormData({...formData, folio: e.target.value})}
                                placeholder="A 04482"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Urgencia</label>
                            <select 
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold"
                                value={formData.urgencia}
                                onChange={e => setFormData({...formData, urgencia: e.target.value})}
                            >
                                <option value="NO">NO</option>
                                <option value="SÍ">SÍ</option>
                            </select>
                        </div>

                        {/* Campos de la ficha del paciente auto-calculados */}
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Parentesco (Lectura)</label>
                            <input 
                                disabled type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-100 px-4 py-2.5 text-xs text-zinc-500"
                                value={formData.parentesco}
                            />
                        </div>
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Nombre Trabajador Relacionado (Lectura)</label>
                            <input 
                                disabled type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-100 px-4 py-2.5 text-xs text-zinc-500"
                                value={formData.nombre_trabajador}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Edad Calculada (Lectura)</label>
                            <input 
                                disabled type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-100 px-4 py-2.5 text-xs text-zinc-500"
                                value={formData.edad}
                            />
                        </div>

                        {/* Clínicas y Servicio */}
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">De: Clínica Origen</label>
                            <select 
                                required className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold"
                                value={formData.id_clinica_origen}
                                onChange={e => setFormData({...formData, id_clinica_origen: e.target.value})}
                            >
                                <option value="">Seleccione origen...</option>
                                {clinicas.filter(c => c.tipo === 'Interna').map(c => (
                                    <option key={c.id_clinica} value={c.id_clinica}>{c.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">A: Clínica Destino</label>
                            <select 
                                required className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold"
                                value={formData.id_clinica_destino}
                                onChange={e => setFormData({...formData, id_clinica_destino: e.target.value})}
                            >
                                <option value="">Seleccione destino...</option>
                                {clinicas.filter(c => c.tipo === 'Externa').map(c => (
                                    <option key={c.id_clinica} value={c.id_clinica}>{c.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Servicio Especialidad al que se envía</label>
                            <input 
                                required type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold"
                                value={formData.servicio_se_envia}
                                onChange={e => setFormData({...formData, servicio_se_envia: e.target.value})}
                                placeholder="Ej. GINECOLOGIA/CIRUGIA DE COLUMNA"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Médico que Acepta Referencia</label>
                            <input 
                                required type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold"
                                value={formData.medico_acepta}
                                onChange={e => setFormData({...formData, medico_acepta: e.target.value})}
                                placeholder="DR. ABEL PEREZ MARTINEZ"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Acompañante Médico</label>
                            <input 
                                type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold"
                                value={formData.acompanante}
                                onChange={e => setFormData({...formData, acompanante: e.target.value})}
                                placeholder="NO REQUIERE"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Fecha de Salida</label>
                            <input 
                                required type="date"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold"
                                value={formData.fecha_salida}
                                onChange={e => setFormData({...formData, fecha_salida: e.target.value, fecha_salida_unidad: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Fecha Estimada de Retorno</label>
                            <input 
                                type="date"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold"
                                value={formData.fecha_retorno}
                                onChange={e => setFormData({...formData, fecha_retorno: e.target.value})}
                            />
                        </div>
                    </div>

                    {/* Signos Vitales Block */}
                    <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-150 space-y-3">
                        <h3 className="text-xs font-black text-zinc-700 uppercase tracking-widest flex items-center gap-1">
                            <Stethoscope className="w-4 h-4 text-amber-500" /> Signos Vitales (SV)
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Tensión Art. (TA)</label>
                                <input type="text" className="w-full rounded-lg border-zinc-200 bg-white p-2 text-xs font-bold" value={formData.sv_ta} onChange={e => setFormData({...formData, sv_ta: e.target.value})} placeholder="100/60" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Temp (&deg;C)</label>
                                <input type="text" className="w-full rounded-lg border-zinc-200 bg-white p-2 text-xs font-bold" value={formData.sv_temp} onChange={e => setFormData({...formData, sv_temp: e.target.value})} placeholder="36.4" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">F. Resp. (FR)</label>
                                <input type="text" className="w-full rounded-lg border-zinc-200 bg-white p-2 text-xs font-bold" value={formData.sv_fr} onChange={e => setFormData({...formData, sv_fr: e.target.value})} placeholder="16" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">F. Card. (FC)</label>
                                <input type="text" className="w-full rounded-lg border-zinc-200 bg-white p-2 text-xs font-bold" value={formData.sv_fc} onChange={e => setFormData({...formData, sv_fc: e.target.value})} placeholder="84" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Peso (kg)</label>
                                <input type="text" className="w-full rounded-lg border-zinc-200 bg-white p-2 text-xs font-bold" value={formData.sv_peso} onChange={e => setFormData({...formData, sv_peso: e.target.value})} placeholder="0" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Talla</label>
                                <input type="text" className="w-full rounded-lg border-zinc-200 bg-white p-2 text-xs font-bold" value={formData.sv_talla} onChange={e => setFormData({...formData, sv_talla: e.target.value})} placeholder="2" />
                            </div>
                        </div>
                    </div>

                    {/* Diagnósticos y Antecedentes */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Padecimiento Actual / Antecedentes</label>
                            <textarea 
                                required rows={3}
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold"
                                value={formData.padecimiento_actual}
                                onChange={e => setFormData({...formData, padecimiento_actual: e.target.value})}
                                placeholder="Paciente femenino de 24 años, embarazo de 32.6 SDG. Antecedente de infección de vías urinarias..."
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Estudios Paraclínicos</label>
                                <input type="text" className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold" value={formData.estudios_paraclinicos} onChange={e => setFormData({...formData, estudios_paraclinicos: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Impresión Diagnóstica</label>
                                <input required type="text" className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold" value={formData.impresion_diagnostica} onChange={e => setFormData({...formData, impresion_diagnostica: e.target.value})} placeholder="EMBARAZO 32.6 SDG" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Comentarios</label>
                                <input type="text" className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold" value={formData.comentarios} onChange={e => setFormData({...formData, comentarios: e.target.value})} />
                            </div>
                        </div>
                    </div>

                    {/* Página 2: Datos de Control y Viáticos */}
                    <div className="bg-zinc-50/50 p-4 rounded-xl border border-zinc-150 space-y-4">
                        <h3 className="text-xs font-black text-zinc-700 uppercase tracking-widest flex items-center gap-1.5">
                            <Building className="w-4 h-4 text-emerald-600" /> Control y Viáticos de Traslado (Página 2 del PDF)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Médico que Refiere</label>
                                <input required type="text" className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold" value={formData.medico_refiere} onChange={e => setFormData({...formData, medico_refiere: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Cédula Médico que Refiere</label>
                                <input required type="text" className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold" value={formData.cedula_refiere} onChange={e => setFormData({...formData, cedula_refiere: e.target.value})} placeholder="Ej. CP 12204901" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Medio de Transporte</label>
                                <input required type="text" className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold" value={formData.medio_transporte} onChange={e => setFormData({...formData, medio_transporte: e.target.value})} />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Fecha de Consulta (En la ciudad)</label>
                                <input required type="date" className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold" value={formData.fecha_consulta} onChange={e => setFormData({...formData, fecha_consulta: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Médico Responsable de Unidad (Firma pág 2)</label>
                                <input required type="text" className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold" value={formData.medico_responsable_unidad} onChange={e => setFormData({...formData, medico_responsable_unidad: e.target.value})} placeholder="DR. JESUS DEL HOYO RAMIREZ" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Cédula Médico de Unidad</label>
                                <input required type="text" className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold" value={formData.cedula_responsable_unidad} onChange={e => setFormData({...formData, cedula_responsable_unidad: e.target.value})} placeholder="5474871 / 10341060" />
                            </div>

                            <div className="flex items-center mt-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                                        checked={formData.requiere_especialista}
                                        onChange={e => setFormData({...formData, requiere_especialista: e.target.checked})}
                                    />
                                    <span className="text-xs font-bold text-zinc-700 uppercase">¿Se requiere atención de especialista?</span>
                                </label>
                            </div>
                            {formData.requiere_especialista && (
                                <div>
                                    <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Fecha de Cita del Especialista</label>
                                    <input type="date" className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold" value={formData.fecha_cita} onChange={e => setFormData({...formData, fecha_cita: e.target.value})} />
                                </div>
                            )}

                            <div className="flex items-center mt-6 bg-amber-50 border border-amber-200/50 p-2.5 rounded-lg">
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500 w-4 h-4"
                                        checked={formData.compartido_departamentos}
                                        onChange={e => setFormData({...formData, compartido_departamentos: e.target.checked})}
                                    />
                                    <span className="text-xs font-black text-amber-900 uppercase">Tildar Nombre (Compartir con Departamentos)</span>
                                </label>
                            </div>
                        </div>

                        {/* Hotel check */}
                        <div className="pt-4 border-t border-zinc-200 flex flex-wrap gap-6 items-center">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox"
                                    className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                                    checked={formData.requiere_hotel}
                                    onChange={e => setFormData({...formData, requiere_hotel: e.target.checked})}
                                />
                                <span className="text-xs font-bold text-zinc-700 uppercase flex items-center gap-1">
                                    <Building className="w-4 h-4" /> Requiere Alojamiento de Hotel
                                </span>
                            </label>
                            {formData.requiere_hotel && (
                                <div className="flex-1 max-w-sm">
                                    <input 
                                        required type="text"
                                        className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2 text-xs font-bold"
                                        value={formData.hotel_nombre}
                                        onChange={e => setFormData({...formData, hotel_nombre: e.target.value})}
                                        placeholder="Nombre del hotel aprobado"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-zinc-100">
                        <button type="submit" className="bg-amber-500 text-black px-10 py-3 rounded-xl text-xs font-black hover:bg-amber-400 shadow-md">
                            Guardar y Registrar Pase Médico
                        </button>
                    </div>
                </form>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
                <div className="p-4 border-b border-zinc-100 bg-zinc-50">
                    <h3 className="font-semibold text-zinc-800">Directorio de Pases Registrados</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-55 bg-zinc-50 text-zinc-500 font-medium border-b border-zinc-100 text-xs">
                            <tr>
                                <th className="px-6 py-4">Folio</th>
                                <th className="px-6 py-4">Paciente</th>
                                <th className="px-6 py-4">Ruta Clínica</th>
                                <th className="px-6 py-4">Fechas</th>
                                <th className="px-6 py-4">Compartido</th>
                                <th className="px-6 py-4">Estatus</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {loading ? (
                                <tr><td colSpan={7} className="px-6 py-8 text-center text-zinc-500">Cargando pases médicos...</td></tr>
                            ) : pases.length === 0 ? (
                                <tr><td colSpan={7} className="px-6 py-8 text-center text-zinc-500">No hay pases generados</td></tr>
                            ) : (
                                pases.map(pase => (
                                    <tr key={pase.id_pase} className="hover:bg-zinc-50/50 transition-colors">
                                        <td className="px-6 py-4 font-mono font-bold text-amber-600">
                                            {pase.folio || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-zinc-800">{(pase.pacientes?.nombre_completo || '').toUpperCase()}</div>
                                            <div className="text-[10px] text-zinc-400 uppercase">{pase.parentesco || 'ELLA MISMA'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-xs">
                                            <span className="font-semibold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded">{pase.clinica_origen?.nombre}</span>
                                            <span className="mx-1 text-zinc-400">&rarr;</span>
                                            <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{pase.clinica_destino?.nombre}</span>
                                        </td>
                                        <td className="px-6 py-4 text-zinc-650 text-xs font-mono">
                                            <div>Salida: {pase.fecha_salida}</div>
                                            {pase.fecha_retorno && <div>Retorno: {pase.fecha_retorno}</div>}
                                        </td>
                                        <td className="px-6 py-4">
                                            {pase.compartido_departamentos ? (
                                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[9px] font-black uppercase">Compartido</span>
                                            ) : (
                                                <span className="text-zinc-400 text-xs">Privado</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2.5 py-1 bg-zinc-100 text-zinc-700 rounded-full text-xs font-semibold uppercase">
                                                {pase.estatus}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => handlePrintPase(pase)}
                                                className="bg-amber-500 hover:bg-amber-400 text-black font-black p-2 rounded-xl text-xs flex items-center gap-1.5 ml-auto transition-colors"
                                            >
                                                <Printer className="w-3.5 h-3.5" />
                                                <span>Imprimir PDF</span>
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
