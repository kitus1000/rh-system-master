'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Hospital, Plus, Plane, Building, FileText, Printer, Stethoscope, Users, CheckSquare, FolderLock, Lock, Unlock, Eye, Search } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'


export default function PasesPage() {
    const { profile } = useAuth()
    const [pases, setPases] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editFolioManual, setEditFolioManual] = useState(false)

    const generateNextFolio = (existingPases: any[]) => {
        const currentYear = new Date().getFullYear()
        let maxNumber = 0
        
        if (existingPases && Array.isArray(existingPases)) {
            existingPases.forEach(p => {
                if (p.folio) {
                    const match = String(p.folio).match(/(\d+)$/)
                    if (match) {
                        const num = parseInt(match[1], 10)
                        if (!isNaN(num) && num > maxNumber) {
                            maxNumber = num
                        }
                    }
                }
            })
        }
        
        return `PM-${currentYear}-${String(maxNumber + 1).padStart(4, '0')}`
    }
    const [filterMode, setFilterMode] = useState<'todos' | 'compartidos' | 'solo_medicos'>('todos')
    const [pacientes, setPacientes] = useState<any[]>([])
    const [clinicas, setClinicas] = useState<any[]>([])
    const [empleados, setEmpleados] = useState<any[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [filterPatientName, setFilterPatientName] = useState('')

    const filteredPacientesForDropdown = pacientes.filter(p => 
        (p.nombre_completo || '').toLowerCase().includes(filterPatientName.toLowerCase())
    )


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
            clinica_origen:cat_clinicas!pases_medicos_id_clinica_origen_fkey (nombre, ubicacion),
            clinica_destino:cat_clinicas!pases_medicos_id_clinica_destino_fkey (nombre, ubicacion)
        `).order('creado_el', { ascending: false })
        
        if (data) {
            setPases(data)
            if (showForm && !formData.folio) {
                setFormData(prev => ({ ...prev, folio: generateNextFolio(data) }))
            }
        }
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

        // Clean all empty string date fields to null
        const sanitizedData = { ...formData }
        const dateFields = [
            'fecha_salida',
            'fecha_retorno',
            'fecha_salida_unidad',
            'fecha_consulta',
            'fecha_presento_consulta',
            'fecha_cita'
        ]
        dateFields.forEach(field => {
            if ((sanitizedData as any)[field] === '') {
                (sanitizedData as any)[field] = null;
            }
        });

        const { error } = await supabase.from('pases_medicos').insert([{
            ...sanitizedData,
            id_empleado: employeeId,
            hotel_nombre: formData.requiere_hotel ? formData.hotel_nombre : null
        }])
        
        if (!error) {
            setShowForm(false)
            setEditFolioManual(false)
            const updatedPases = [{ folio: formData.folio }, ...pases]
            const nextAutoFolio = generateNextFolio(updatedPases)
            setFormData(prev => ({
                id_paciente: '', id_clinica_origen: prev.id_clinica_origen, id_clinica_destino: '',
                motivo: '', requiere_hotel: false, hotel_nombre: '',
                fecha_salida: '', fecha_retorno: '',
                folio: nextAutoFolio, urgencia: 'NO', parentesco: '', nombre_trabajador: '', edad: '',
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

        const origenNombre = pase.clinica_origen?.nombre || ''
        const origenUbicacion = pase.clinica_origen?.ubicacion ? ` (${pase.clinica_origen.ubicacion})` : ''
        const unidadRefiereTexto = (pase.unidad_refiere && pase.unidad_refiere !== 'UNIDAD MEDICA BACIS')
            ? pase.unidad_refiere.toUpperCase()
            : (origenNombre ? `${origenNombre}${origenUbicacion}` : (pase.unidad_refiere || 'UNIDAD MÉDICA BACIS / MINA')).toUpperCase()

        const destinoNombre = pase.clinica_destino?.nombre || ''
        const destinoUbicacion = pase.clinica_destino?.ubicacion ? ` - ${pase.clinica_destino.ubicacion}` : ''
        const unidadSeRefiereTexto = (pase.unidad_se_refiere && pase.unidad_se_refiere !== 'CONSULTORIO MEDICO INDUSTRIAL')
            ? pase.unidad_se_refiere.toUpperCase()
            : (destinoNombre ? `${destinoNombre}${destinoUbicacion}` : (pase.unidad_se_refiere || 'CONSULTORIO MÉDICO INDUSTRIAL / DURANGO')).toUpperCase()

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
                                    <td class="field-value">${unidadSeRefiereTexto}</td>
                                </tr>
                                <tr>
                                    <td class="field-label">Unidad que refiere</td>
                                    <td class="field-value">${unidadRefiereTexto}</td>
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

    const handlePrintHotelPase = (pase: any) => {
        const printWindow = window.open('', '_blank', 'width=850,height=1100')
        if (!printWindow) return

        const pacienteNombre = (pase.pacientes?.nombre_completo || pase.nombre_trabajador || '').toUpperCase()
        const acompananteNombre = (pase.acompanante && pase.acompanante !== 'NO REQUIERE' && pase.acompanante !== 'SI' && pase.acompanante !== 'NO') 
            ? pase.acompanante.toUpperCase() 
            : (pase.acompanante === 'SI' ? 'REQUIERE ACOMPAÑANTE (VERIFICAR EN CLÍNICA)' : 'SIN ACOMPAÑANTE / NO REQUIERE')

        // Formato corto p. ej. 16/07/2026
        const fechaSalidaCorta = pase.fecha_salida ? new Date(pase.fecha_salida + 'T12:00:00').toLocaleDateString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        }) : new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })

        // Formato largo p. ej. jueves, 16 de julio de 2026
        const fechaSalidaLarga = pase.fecha_salida ? new Date(pase.fecha_salida + 'T12:00:00').toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        }) : new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

        const hotelNombre = (pase.hotel_nombre || 'HOTEL DEL CENTRO').toUpperCase()

        printWindow.document.write(`
            <html>
                <head>
                    <title>Pase de Hotel - ${pacienteNombre}</title>
                    <style>
                        @page {
                            size: letter portrait;
                            margin: 0;
                        }
                        body {
                            font-family: Arial, sans-serif;
                            margin: 0;
                            padding: 0;
                            color: #000;
                            background: #fff;
                            box-sizing: border-box;
                        }
                        .page-container {
                            width: 215.9mm;
                            height: 279.4mm;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-between;
                            box-sizing: border-box;
                            padding: 10mm 15mm;
                            position: relative;
                        }
                        .half-ticket {
                            height: 126mm;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-between;
                            box-sizing: border-box;
                            padding: 6mm 6mm;
                        }
                        .header-text {
                            text-align: center;
                            font-weight: bold;
                            font-size: 15px;
                            line-height: 1.4;
                            margin-bottom: 20px;
                            letter-spacing: 0.5px;
                        }
                        .sub-title {
                            text-align: center;
                            font-weight: bold;
                            font-size: 14px;
                            margin: 15px 0 25px 0;
                            text-decoration: underline;
                        }
                        .table-favor {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 25px;
                        }
                        .table-favor th {
                            text-align: left;
                            font-size: 13px;
                            font-weight: bold;
                            padding: 6px 10px;
                            width: 180px;
                        }
                        .table-favor td {
                            text-align: left;
                            font-size: 13px;
                            padding: 6px 10px;
                            border-bottom: 1px solid #000;
                            font-weight: normal;
                        }
                        .row-salida {
                            display: flex;
                            align-items: center;
                            margin-top: 15px;
                            margin-bottom: 35px;
                            font-size: 13px;
                            font-weight: bold;
                        }
                        .row-salida .salida-val {
                            flex-grow: 1;
                            max-width: 320px;
                            border-bottom: 1px solid #000;
                            text-align: center;
                            margin-left: 15px;
                            font-weight: normal;
                        }
                        .signatures {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-end;
                            margin-top: auto;
                            padding-top: 25px;
                        }
                        .sig-box {
                            width: 220px;
                            text-align: center;
                            font-size: 12px;
                            font-weight: bold;
                        }
                        .sig-line {
                            border-bottom: 1px solid #000;
                            height: 30px;
                            margin-bottom: 6px;
                        }
                        .cut-line {
                            border-top: 2px dashed #333;
                            margin: 0;
                            position: relative;
                            width: 100%;
                            text-align: center;
                        }
                        .cut-icon {
                            position: absolute;
                            top: -10px;
                            left: 50%;
                            transform: translateX(-50%);
                            background: #fff;
                            padding: 0 15px;
                            font-size: 11px;
                            color: #555;
                            font-weight: bold;
                            letter-spacing: 1px;
                        }
                    </style>
                </head>
                <body>
                    <div class="page-container">
                        <!-- PARTE SUPERIOR (ORIGINAL) -->
                        <div class="half-ticket">
                            <div>
                                <div class="header-text">
                                    GRUPO MINERO BACIS S.A. DE C.V.<br>
                                    UNIDAD "EL HERRERO"
                                </div>
                                <div class="sub-title">
                                    HOSPEDAJE EN ${hotelNombre}
                                </div>

                                <table class="table-favor">
                                    <tr>
                                        <th colspan="2">A FAVOR DE</th>
                                    </tr>
                                    <tr>
                                        <th>PASE MEDICO</th>
                                        <td>${pacienteNombre}</td>
                                    </tr>
                                    <tr>
                                        <th>ACOMPAÑANTE</th>
                                        <td>${acompananteNombre}</td>
                                    </tr>
                                </table>

                                <div class="row-salida">
                                    <span>SALIDA DE LA UNIDAD</span>
                                    <span class="salida-val">${fechaSalidaCorta}</span>
                                </div>
                            </div>

                            <div class="signatures">
                                <div class="sig-box">
                                    <div class="sig-line"></div>
                                    FIRMA TRABAJADOR
                                </div>
                                <div class="sig-box">
                                    <div class="sig-line"></div>
                                    FIRMA RH UNIDAD
                                </div>
                            </div>
                        </div>

                        <!-- LÍNEA DE CORTE -->
                        <div class="cut-line">
                            <span class="cut-icon">✂ -- CORTAR POR AQUÍ (COPIA Y ORIGINAL) -- ✂</span>
                        </div>

                        <!-- PARTE INFERIOR (COPIA) -->
                        <div class="half-ticket">
                            <div>
                                <div class="header-text">
                                    GRUPO MINERO BACIS S.A. DE C.V.<br>
                                    UNIDAD "EL HERRERO"
                                </div>
                                <div class="sub-title">
                                    HOSPEDAJE EN ${hotelNombre}
                                </div>

                                <table class="table-favor">
                                    <tr>
                                        <th colspan="2">A FAVOR DE</th>
                                    </tr>
                                    <tr>
                                        <th>PASE MEDICO</th>
                                        <td>${pacienteNombre}</td>
                                    </tr>
                                    <tr>
                                        <th>ACOMPAÑANTE</th>
                                        <td>${acompananteNombre}</td>
                                    </tr>
                                </table>

                                <div class="row-salida">
                                    <span>SALIDA DE LA UNIDAD</span>
                                    <span class="salida-val">${fechaSalidaLarga}</span>
                                </div>
                            </div>

                            <div class="signatures">
                                <div class="sig-box">
                                    <div class="sig-line"></div>
                                    FIRMA TRABAJADOR
                                </div>
                                <div class="sig-box">
                                    <div class="sig-line"></div>
                                    FIRMA RH UNIDAD
                                </div>
                            </div>
                        </div>
                    </div>
                    <script>
                        window.onload = function() {
                            window.print();
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
                    onClick={() => {
                        const nextShow = !showForm
                        setShowForm(nextShow)
                        if (nextShow) {
                            setEditFolioManual(false)
                            setFormData(prev => ({
                                ...prev,
                                folio: prev.folio || generateNextFolio(pases)
                            }))
                        }
                    }}
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
                        <div className="col-span-1 md:col-span-2 space-y-1.5">
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-0.5">Paciente (Filtrar por nombre)</label>
                            <input 
                                type="text"
                                placeholder="Escribe para buscar paciente en la lista..."
                                className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2 text-xs font-bold shadow-xs focus:ring-1 focus:ring-amber-500"
                                value={filterPatientName}
                                onChange={e => setFilterPatientName(e.target.value)}
                            />
                            <select 
                                required className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold"
                                value={formData.id_paciente}
                                onChange={e => handlePacienteChange(e.target.value)}
                            >
                                <option value="">Seleccione paciente ({filteredPacientesForDropdown.length} encontrados)...</option>
                                {filteredPacientesForDropdown.map(p => (
                                    <option key={p.id_paciente} value={p.id_paciente}>
                                        {p.nombre_completo} {p.es_poblacion_general ? '(Público General)' : `(${p.parentesco || 'Trabajador'})`}
                                    </option>
                                ))}
                            </select>
                        </div>


                        <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200/80 shadow-xs">
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-[11px] font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                                    <FolderLock className="w-3.5 h-3.5 text-amber-600" />
                                    Folio Pase (Consecutivo)
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setEditFolioManual(!editFolioManual)}
                                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1 ${
                                        editFolioManual 
                                            ? "bg-red-500 text-white border-red-600 shadow-xs hover:bg-red-600" 
                                            : "bg-white text-zinc-700 border-zinc-200 hover:border-amber-400"
                                    }`}
                                >
                                    {editFolioManual ? (
                                        <>
                                            <Lock className="w-3 h-3" /> Bloquear Folio
                                        </>
                                    ) : (
                                        <>
                                            <Unlock className="w-3 h-3" /> Editar Manual
                                        </>
                                    )}
                                </button>
                            </div>
                            <div className="relative">
                                <input 
                                    required
                                    type="text"
                                    disabled={!editFolioManual}
                                    className={`w-full rounded-xl px-3.5 py-2 text-xs font-mono font-black transition-all ${
                                        editFolioManual 
                                            ? "bg-white border-2 border-red-400 text-red-700 shadow-inner focus:outline-none focus:ring-2 focus:ring-red-500" 
                                            : "bg-zinc-100/90 border border-zinc-200 text-amber-900 cursor-not-allowed select-none"
                                    }`}
                                    value={formData.folio}
                                    onChange={e => setFormData({...formData, folio: e.target.value.toUpperCase()})}
                                    placeholder="PM-2026-0001"
                                />
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-1 font-medium leading-tight">
                                {editFolioManual 
                                    ? "⚠️ Modo manual: Puedes modificar o ingresar un número de folio personalizado." 
                                    : "✓ Folio generado en automático para historial cronológico inalterable."}
                            </p>
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
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">De: Clínica Origen (En la Mina/Unidad)</label>
                            <select 
                                required className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold"
                                value={formData.id_clinica_origen}
                                onChange={e => {
                                    const val = e.target.value
                                    const c = clinicas.find(x => x.id_clinica === val)
                                    const nuevoTexto = c ? `${c.nombre}${c.ubicacion ? ` (${c.ubicacion})` : ''}`.toUpperCase() : formData.unidad_refiere
                                    setFormData(prev => ({
                                        ...prev,
                                        id_clinica_origen: val,
                                        unidad_refiere: nuevoTexto
                                    }))
                                }}
                            >
                                <option value="">Seleccione clínica origen (ej. Sapiuris / Mina)...</option>
                                <optgroup label="Clínicas Internas / Mina Bacis">
                                    {clinicas.filter(c => (c.activo !== false || c.id_clinica === formData.id_clinica_origen) && (c.tipo === 'Interna' || (c.ubicacion && c.ubicacion.toUpperCase().includes('BACIS')))).map(c => (
                                        <option key={c.id_clinica} value={c.id_clinica}>{c.nombre} {c.ubicacion ? `(${c.ubicacion})` : ''}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Otras Clínicas Registradas">
                                    {clinicas.filter(c => (c.activo !== false || c.id_clinica === formData.id_clinica_origen) && !(c.tipo === 'Interna' || (c.ubicacion && c.ubicacion.toUpperCase().includes('BACIS')))).map(c => (
                                        <option key={c.id_clinica} value={c.id_clinica}>{c.nombre} {c.ubicacion ? `(${c.ubicacion})` : ''}</option>
                                    ))}
                                </optgroup>
                            </select>
                            <div className="mt-1.5">
                                <label className="block text-[10px] font-black text-amber-800 uppercase mb-0.5">Unidad que refiere (Impresión en Ficha):</label>
                                <input 
                                    type="text" required
                                    className="w-full rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-1.5 text-[11px] font-bold text-amber-950 shadow-inner"
                                    value={formData.unidad_refiere}
                                    onChange={e => setFormData({...formData, unidad_refiere: e.target.value.toUpperCase()})}
                                    placeholder="Ej. SAPIURIS - UNIDAD MINERA BACIS"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">A: Clínica Destino (Durango/Hospital)</label>
                            <select 
                                required className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold"
                                value={formData.id_clinica_destino}
                                onChange={e => {
                                    const val = e.target.value
                                    const c = clinicas.find(x => x.id_clinica === val)
                                    const nuevoTexto = c ? `${c.nombre}${c.ubicacion ? ` - ${c.ubicacion}` : ''}`.toUpperCase() : formData.unidad_se_refiere
                                    setFormData(prev => ({
                                        ...prev,
                                        id_clinica_destino: val,
                                        unidad_se_refiere: nuevoTexto
                                    }))
                                }}
                            >
                                <option value="">Seleccione clínica destino (ej. Durango)...</option>
                                <optgroup label="Clínicas Externas / Durango / Hospitales">
                                    {clinicas.filter(c => (c.activo !== false || c.id_clinica === formData.id_clinica_destino) && (c.tipo === 'Externa' || (c.ubicacion && !c.ubicacion.toUpperCase().includes('BACIS')))).map(c => (
                                        <option key={c.id_clinica} value={c.id_clinica}>{c.nombre} {c.ubicacion ? `(${c.ubicacion})` : ''}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Otras Clínicas / Internas">
                                    {clinicas.filter(c => (c.activo !== false || c.id_clinica === formData.id_clinica_destino) && !(c.tipo === 'Externa' || (c.ubicacion && !c.ubicacion.toUpperCase().includes('BACIS')))).map(c => (
                                        <option key={c.id_clinica} value={c.id_clinica}>{c.nombre} {c.ubicacion ? `(${c.ubicacion})` : ''}</option>
                                    ))}
                                </optgroup>
                            </select>
                            <div className="mt-1.5">
                                <label className="block text-[10px] font-black text-amber-800 uppercase mb-0.5">Unidad a la que se refiere (Impresión en Ficha):</label>
                                <input 
                                    type="text" required
                                    className="w-full rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-1.5 text-[11px] font-bold text-amber-950 shadow-inner"
                                    value={formData.unidad_se_refiere}
                                    onChange={e => setFormData({...formData, unidad_se_refiere: e.target.value.toUpperCase()})}
                                    placeholder="Ej. CLINICA CARDOS - DURANGO"
                                />
                            </div>
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
                <div className="p-4 border-b border-zinc-100 bg-zinc-50 flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-[280px]">
                        <h3 className="font-bold text-zinc-800 text-sm flex items-center gap-2 shrink-0">
                            <FileText className="w-4 h-4 text-amber-500" />
                            Directorio de Pases Registrados
                        </h3>
                        <div className="relative flex-1 max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <input 
                                type="text"
                                placeholder="Buscar por paciente o folio..."
                                className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-zinc-200 bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-1.5 bg-zinc-200/60 p-1 rounded-xl border border-zinc-200">
                        <span className="text-[9px] font-black text-zinc-500 uppercase px-2 flex items-center gap-1">
                            <Eye className="w-3 h-3 text-emerald-600" /> Vista:
                        </span>
                        <button
                            type="button"
                            onClick={() => setFilterMode('todos')}
                            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                                filterMode === 'todos' ? 'bg-zinc-900 text-white shadow-xs' : 'text-zinc-600 hover:text-black'
                            }`}
                        >
                            <span>📋 Todos</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterMode('compartidos')}
                            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 ${
                                filterMode === 'compartidos' ? 'bg-white text-emerald-800 shadow-xs border border-emerald-200' : 'text-zinc-600 hover:text-black'
                            }`}
                        >
                            <span>🏢 Compartidos con Depto</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterMode('solo_medicos')}
                            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 ${
                                filterMode === 'solo_medicos' ? 'bg-purple-600 text-white shadow-xs shadow-purple-500/20' : 'text-zinc-600 hover:text-black'
                            }`}
                        >
                            <FolderLock className="w-3 h-3" />
                            <span>🛡️ Privados (Sólo Médicos)</span>
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50 text-zinc-500 font-medium border-b border-zinc-100 text-xs">
                            <tr>
                                <th className="px-6 py-4">Folio</th>
                                <th className="px-6 py-4">Paciente</th>
                                <th className="px-6 py-4">Ruta Clínica</th>
                                <th className="px-6 py-4">Fechas</th>
                                <th className="px-6 py-4">Privacidad</th>
                                <th className="px-6 py-4">Estatus</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {loading ? (
                                <tr><td colSpan={7} className="px-6 py-8 text-center text-zinc-500">Cargando pases médicos...</td></tr>
                            ) : (() => {
                                const filteredPases = pases.filter(p => {
                                    const matchSearch = (p.pacientes?.nombre_completo || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                                                        (p.folio || '').toLowerCase().includes(searchQuery.toLowerCase());
                                    if (!matchSearch) return false

                                    if (filterMode === 'compartidos') return p.compartido_departamentos === true
                                    if (filterMode === 'solo_medicos') return !p.compartido_departamentos
                                    return true
                                })
                                if (filteredPases.length === 0) {
                                    return <tr><td colSpan={7} className="px-6 py-8 text-center text-zinc-500">No se encontraron pases en esta vista</td></tr>
                                }
                                return filteredPases.map(pase => (

                                    <tr key={pase.id_pase} className="hover:bg-zinc-50/50 transition-colors">
                                        <td className="px-6 py-4 font-mono font-bold text-amber-600">
                                            {pase.folio || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-zinc-800">{(pase.pacientes?.nombre_completo || '').toUpperCase()}</div>
                                            <div className="text-[10px] text-zinc-400 uppercase">{pase.parentesco || 'ELLA MISMA'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-xs">
                                            <span className="font-semibold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded">{pase.clinica_origen?.nombre || pase.unidad_refiere || 'Origen'}</span>
                                            <span className="mx-1 text-zinc-400">&rarr;</span>
                                            <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{pase.clinica_destino?.nombre || pase.unidad_se_refiere || 'Destino'}</span>
                                        </td>
                                        <td className="px-6 py-4 text-zinc-650 text-xs font-mono">
                                            <div>Salida: {pase.fecha_salida}</div>
                                            {pase.fecha_retorno && <div>Retorno: {pase.fecha_retorno}</div>}
                                        </td>
                                        <td className="px-6 py-4">
                                            {pase.compartido_departamentos ? (
                                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[9px] font-black uppercase">✓ Compartido Depto</span>
                                            ) : (
                                                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 border border-purple-200 rounded text-[9px] font-black uppercase flex items-center gap-1 w-fit"><FolderLock className="w-2.5 h-2.5" /> Confidencial (Sólo Médicos)</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2.5 py-1 bg-zinc-100 text-zinc-700 rounded-full text-xs font-semibold uppercase">
                                                {pase.estatus}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => handlePrintPase(pase)}
                                                    className="bg-amber-500 hover:bg-amber-400 text-black font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                                                    title="Imprimir Pase Médico"
                                                >
                                                    <Printer className="w-3.5 h-3.5" />
                                                    <span>Pase Médico</span>
                                                </button>
                                                <button 
                                                    onClick={() => handlePrintHotelPase(pase)}
                                                    className="bg-purple-600 hover:bg-purple-500 text-white font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                                                    title="Imprimir Pase de Hotel en 2 partes (Copia y Original)"
                                                >
                                                    <Building className="w-3.5 h-3.5" />
                                                    <span>Pase Hotel</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
