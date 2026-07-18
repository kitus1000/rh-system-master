'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { 
    Hospital, Plus, Search, Users, Trash2, ShieldAlert,
    Printer, Plane, Stethoscope, Building, Lock, Unlock, FolderLock
} from 'lucide-react'

// Helper function to normalize parentesco and extract worker name if input is like "hijo de ..."
const parseRelationAndWorker = (parentescoStr: string, defaultWorkerName: string) => {
    let cleanParentesco = 'TRABAJADOR';
    let cleanWorker = defaultWorkerName || '';
    
    if (parentescoStr) {
        const raw = parentescoStr.toUpperCase().trim();
        if (raw.includes(' DE ')) {
            const parts = raw.split(' DE ');
            const rel = parts[0].trim();
            const worker = parts.slice(1).join(' DE ').trim();
            
            if (rel.includes('HIJO')) cleanParentesco = 'HIJO';
            else if (rel.includes('HIJA')) cleanParentesco = 'HIJA';
            else if (rel.includes('ESPOSA')) cleanParentesco = 'ESPOSA';
            else if (rel.includes('ESPOSO')) cleanParentesco = 'ESPOSO';
            else if (rel.includes('MADRE') || rel.includes('MAMA')) cleanParentesco = 'MADRE';
            else if (rel.includes('PADRE') || rel.includes('PAPA')) cleanParentesco = 'PADRE';
            else cleanParentesco = rel;
            
            if (!cleanWorker) {
                cleanWorker = worker;
            }
        } else {
            if (raw.includes('HIJO')) cleanParentesco = 'HIJO';
            else if (raw.includes('HIJA')) cleanParentesco = 'HIJA';
            else if (raw.includes('ESPOSA')) cleanParentesco = 'ESPOSA';
            else if (raw.includes('ESPOSO')) cleanParentesco = 'ESPOSO';
            else if (raw.includes('MADRE') || raw.includes('MAMA')) cleanParentesco = 'MADRE';
            else if (raw.includes('PADRE') || raw.includes('PAPA')) cleanParentesco = 'PADRE';
            else if (raw === 'ELLA MISMA' || raw === 'ELLO MISMO' || raw === 'TRABAJADOR') cleanParentesco = 'TRABAJADOR';
            else cleanParentesco = raw;
        }
    }
    
    return { parentesco: cleanParentesco, nombre_trabajador: cleanWorker };
}

// Calculate age helper
const calculateAge = (dateStr: string) => {
    if (!dateStr) return '';
    const birth = new Date(dateStr);
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        years--;
    }
    return `${years} AÑOS`;
}

export default function PasesPage() {
    const { profile } = useAuth()
    const [pases, setPases] = useState<any[]>([])
    const [pacientes, setPacientes] = useState<any[]>([])
    const [clinicas, setClinicas] = useState<any[]>([])
    const [empleados, setEmpleados] = useState<any[]>([])
    const [medicos, setMedicos] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editFolioManual, setEditFolioManual] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterPatientName, setFilterPatientName] = useState('')
    const [filterMode, setFilterMode] = useState<'todos' | 'compartidos' | 'solo_medicos'>('todos')

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
        
        // Custom UI helpers (we strip these before insert)
        fecha_nacimiento_trabajador: '',
        edad_trabajador: '',
        antiguedad: '',
        
        // Visibility
        compartido_departamentos: false
    })

    useEffect(() => {
        fetchPases()
        fetchCatalogos()
    }, [])

    useEffect(() => {
        if (profile) {
            setFormData(prev => ({
                ...prev,
                id_clinica_origen: (profile as any).id_clinica || '',
                medico_refiere: profile.nombre_completo || '',
                cedula_refiere: (profile as any).cedula_profesional || ''
            }))
        }
    }, [profile])

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

    const fetchCatalogos = async () => {
        const { data: pData } = await supabase.from('pacientes').select('*').order('nombre_completo')
        if (pData) setPacientes(pData)

        const { data: cData } = await supabase.from('cat_clinicas').select('*').order('nombre')
        if (cData) setClinicas(cData)

        const { data: eData } = await supabase.from('empleados').select('*').order('nombre')
        if (eData) setEmpleados(eData)

        const { data: mData } = await supabase.from('perfiles').select('*').order('nombre_completo')
        if (mData) setMedicos(mData.filter((u: any) => u.rol === 'Médico'))
    }

    const fetchPases = async () => {
        setLoading(true)
        let { data, error } = await supabase.from('pases_medicos').select(`
            *,
            pacientes (nombre_completo, parentesco, es_poblacion_general, id_empleado, acompanante),
            clinica_origen:cat_clinicas!pases_medicos_id_clinica_origen_fkey (nombre, ubicacion),
            clinica_destino:cat_clinicas!pases_medicos_id_clinica_destino_fkey (nombre, ubicacion)
        `).order('creado_el', { ascending: false })
        
        if (error) {
            console.warn("Attempting fallback fetch for pases:", error);
            const fallback = await supabase.from('pases_medicos').select(`
                *,
                pacientes (nombre_completo, parentesco, es_poblacion_general, id_empleado),
                clinica_origen:cat_clinicas!pases_medicos_id_clinica_origen_fkey (nombre, ubicacion),
                clinica_destino:cat_clinicas!pases_medicos_id_clinica_destino_fkey (nombre, ubicacion)
            `).order('creado_el', { ascending: false })
            
            if (fallback.data) {
                setPases(fallback.data)
                if (showForm && !formData.folio) {
                    setFormData(prev => ({ ...prev, folio: generateNextFolio(fallback.data) }))
                }
            }
        } else if (data) {
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

        let edadStr = ''
        if (pac.fecha_nacimiento) {
            edadStr = calculateAge(pac.fecha_nacimiento)
        }

        const parentesco = pac.parentesco || (pac.es_poblacion_general ? 'PÚBLICO GENERAL' : 'ELLA MISMA')
        
        let workerName = ''
        let workerBirth = ''
        let workerAge = ''
        if (pac.id_empleado) {
            const emp = empleados.find(e => e.id_empleado === pac.id_empleado)
            if (emp) {
                workerName = `${emp.nombre} ${emp.apellido_paterno}`.toUpperCase()
                workerBirth = emp.fecha_nacimiento || ''
                if (emp.fecha_nacimiento) {
                    workerAge = calculateAge(emp.fecha_nacimiento)
                }
            }
        } else if (pac.es_poblacion_general) {
            workerName = 'PÚBLICO GENERAL'
        }

        const parsed = parseRelationAndWorker(parentesco, workerName)

        setFormData(prev => ({
            ...prev,
            id_paciente: pacId,
            edad: edadStr,
            parentesco: parsed.parentesco,
            nombre_trabajador: parsed.nombre_trabajador,
            fecha_nacimiento_trabajador: workerBirth,
            edad_trabajador: workerAge,
            acompanante: pac.acompanante || prev.acompanante || 'NO REQUIERE',
            antiguedad: ''
        }))
    }

    const handleDoctorRefiereSelect = (docName: string) => {
        const doc = medicos.find(m => m.nombre_completo === docName)
        setFormData(prev => ({
            ...prev,
            medico_refiere: docName,
            cedula_refiere: doc ? doc.cedula_profesional || '' : ''
        }))
    }

    const handleDoctorResponsableSelect = (docName: string) => {
        const doc = medicos.find(m => m.nombre_completo === docName)
        setFormData(prev => ({
            ...prev,
            medico_responsable_unidad: docName,
            cedula_responsable_unidad: doc ? doc.cedula_profesional || '' : ''
        }))
    }

    const handleWorkerBirthdateChange = (dateVal: string) => {
        const pac = pacientes.find(p => p.id_paciente === formData.id_paciente)
        const ageVal = calculateAge(dateVal)
        setFormData(prev => ({
            ...prev,
            fecha_nacimiento_trabajador: dateVal,
            edad_trabajador: ageVal
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const pac = pacientes.find(p => p.id_paciente === formData.id_paciente)
        const employeeId = pac?.id_empleado || null

        // Save worker birthdate back to DB
        if (employeeId && formData.fecha_nacimiento_trabajador) {
            await supabase
                .from('empleados')
                .update({ fecha_nacimiento: formData.fecha_nacimiento_trabajador })
                .eq('id_empleado', employeeId)
        }

        const sanitizedData = { ...formData } as any
        const dateFields = ['fecha_salida', 'fecha_retorno', 'fecha_salida_unidad', 'fecha_consulta', 'fecha_presento_consulta', 'fecha_cita']
        dateFields.forEach(field => {
            if (sanitizedData[field] === '') {
                sanitizedData[field] = null
            }
        })

        // Delete UI-only attributes
        delete sanitizedData.fecha_nacimiento_trabajador
        delete sanitizedData.edad_trabajador

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
                medico_refiere: prev.medico_refiere, cedula_refiere: prev.cedula_refiere, fecha_salida_unidad: '',
                medio_transporte: 'VIA TERRESTRE', fecha_consulta: '', fecha_presento_consulta: '',
                medico_responsable_unidad: '', cedula_responsable_unidad: '', requiere_especialista: false,
                fecha_cita: '', compartido_departamentos: false,
                fecha_nacimiento_trabajador: '', edad_trabajador: '', antiguedad: ''
            }))
            fetchPases()
        } else {
            console.error('Error saving medical pass:', error)
            alert('Error al guardar el pase médico: ' + error.message)
        }
    }

    const deletePase = async (id: string, folio: string) => {
        if (!confirm(`¿Seguro que desea eliminar el pase médico folio ${folio}?`)) return
        const { error } = await supabase.from('pases_medicos').delete().eq('id_pase', id)
        if (!error) {
            fetchPases()
        } else {
            alert('Error al eliminar pase médico: ' + error.message)
        }
    }

    const handlePrintPase = async (pase: any) => {
        // Fetch full doctor profiles to retrieve signatures
        let doctorRefiereProfile = null
        let doctorRespProfile = null

        const drRef = medicos.find(m => m.nombre_completo === pase.medico_refiere)
        if (drRef) doctorRefiereProfile = drRef
        
        const drResp = medicos.find(m => m.nombre_completo === pase.medico_responsable_unidad)
        if (drResp) doctorRespProfile = drResp

        const printWindow = window.open('', '_blank', 'width=900,height=1200')
        if (!printWindow) return

        const formattedFecha = pase.fecha_salida ? new Date(pase.fecha_salida + 'T12:00:00').toLocaleDateString('es-ES', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        }) : ''

        const formattedFechaSalidaUnidad = pase.fecha_salida_unidad ? new Date(pase.fecha_salida_unidad + 'T12:00:00').toLocaleDateString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        }) : 'NO REGISTRADA'

        const formattedFechaConsulta = pase.fecha_consulta ? new Date(pase.fecha_consulta + 'T12:00:00').toLocaleDateString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        }) : 'NO REGISTRADA'

        const formattedFechaPresentoConsulta = pase.fecha_presento_consulta ? new Date(pase.fecha_presento_consulta + 'T12:00:00').toLocaleDateString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        }) : 'NO REGISTRADA'

        const formattedFechaCita = pase.fecha_cita ? new Date(pase.fecha_cita + 'T12:00:00').toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        }) : ''

        const origenNombre = pase.clinica_origen?.nombre || ''
        const origenUbicacion = pase.clinica_origen?.ubicacion ? ' (' + pase.clinica_origen.ubicacion + ')' : ''
        const unidadRefiereTexto = (pase.unidad_refiere && pase.unidad_refiere !== 'UNIDAD MEDICA BACIS')
            ? pase.unidad_refiere.toUpperCase()
            : (origenNombre ? (origenNombre + origenUbicacion) : (pase.unidad_refiere || 'UNIDAD MÉDICA BACIS / MINA')).toUpperCase()

        const destinoNombre = pase.clinica_destino?.nombre || ''
        const destinoUbicacion = pase.clinica_destino?.ubicacion ? ' - ' + pase.clinica_destino.ubicacion : ''
        const unidadSeRefiereTexto = (pase.unidad_se_refiere && pase.unidad_se_refiere !== 'CONSULTORIO MEDICO INDUSTRIAL')
            ? pase.unidad_se_refiere.toUpperCase()
            : (destinoNombre ? (destinoNombre + destinoUbicacion) : (pase.unidad_se_refiere || 'CONSULTORIO MÉDICO INDUSTRIAL / DURANGO')).toUpperCase()

        // Safely extract signature HTML
        const sigRefiereHTML = doctorRefiereProfile?.firma ? '<img src="' + doctorRefiereProfile.firma + '" class="signature-image" /><br/>' : '<div style="height:45px;"></div>';
        const sigRespHTML = doctorRespProfile?.firma ? '<img src="' + doctorRespProfile.firma + '" class="signature-image" /><br/>' : '<div style="height:45px;"></div>';
        const sigRespP2HTML = doctorRespProfile?.firma ? '<img src="' + doctorRespProfile.firma + '" class="signature-image" style="max-height: 32px;" />' : '';
        const sigRefP2PresentoHTML = pase.fecha_presento_consulta && doctorRefiereProfile?.firma ? '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.85; pointer-events: none;"><img src="' + doctorRefiereProfile.firma + '" style="max-height: 38px;" /></div>' : '';

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
                            height: 55px;
                            max-width: 140px;
                            object-fit: contain;
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
                        
                        /* P1 Fields Table (Underlines, no boxes) */
                        .p1-fields-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 8px;
                        }
                        .p1-fields-table td {
                            padding: 4px 6px;
                            vertical-align: middle;
                            border: none;
                        }
                        .p1-field-label {
                            font-weight: bold;
                            text-transform: uppercase;
                            font-size: 8.5px;
                            color: #000;
                        }
                        .p1-field-value {
                            font-weight: bold;
                            color: blue;
                            font-size: 9.5px;
                            border-bottom: 1.5px solid #000 !important;
                            text-transform: uppercase;
                        }
                        
                        /* P2 Fields Table (Borders, boxes) */
                        .fields-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 8px;
                        }
                        .fields-table td {
                            padding: 4px 6px;
                            vertical-align: middle;
                            border: 1px solid #000;
                        }
                        .field-label {
                            font-weight: bold;
                            text-transform: uppercase;
                            font-size: 8.5px;
                            color: #000;
                            background-color: #fff;
                        }
                        .field-value {
                            font-weight: bold;
                            color: blue;
                            font-size: 9.5px;
                        }
                        
                        /* Block text areas */
                        .text-block-title {
                            font-weight: bold;
                            text-transform: uppercase;
                            font-size: 9px;
                            color: #000;
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
                            text-align: center;
                            vertical-align: bottom;
                            padding-top: 15px;
                        }
                        .signature-line {
                            width: 80%;
                            margin: 0 auto;
                            border-top: 1.5px solid #000;
                            padding-top: 4px;
                            font-size: 9px;
                            font-weight: bold;
                        }
                        .signature-sub {
                            font-size: 8px;
                            color: #000;
                            margin-top: 2px;
                            font-weight: bold;
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
                            background-color: #fff;
                            font-size: 8.5px;
                        }
                        .signature-image {
                            max-height: 45px;
                            object-fit: contain;
                            margin-bottom: -5px;
                            background: transparent;
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
                                        <img src="/logo-bacis.png" class="logo-img" alt="Logo Bacis" />
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
                            
                            <div class="folio-block" style="display:flex; justify-content:space-between; align-items:flex-end;">
                                <div style="font-size:9.5px; font-weight:bold; text-align:left;">
                                    Num Expediente: <span style="text-decoration:underline; font-weight:bold;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                                </div>
                                <div style="text-align:right;">
                                    <span class="folio-lbl">Folio &nbsp; ${pase.folio || ''}</span>
                                </div>
                            </div>
                            
                            <table class="p1-fields-table">
                                <tr>
                                    <td class="p1-field-label" style="width: 15%;">Fecha</td>
                                    <td class="p1-field-value" style="width: 35%;">${formattedFecha}</td>
                                    <td class="p1-field-label" style="width: 15%; padding-left:20px;">Urgencia</td>
                                    <td style="width: 35%; vertical-align: middle;">
                                        <span style="background-color: #4b5563; color: #fff; padding: 2px 10px; font-weight: bold; border-radius: 2px; font-size: 10px;">${(pase.urgencia || 'NO').toUpperCase()}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="p1-field-label">Nombre de Paciente</td>
                                    <td class="p1-field-value" style="font-size:10px;">${(pase.pacientes?.nombre_completo || '').toUpperCase()}</td>
                                    <td class="p1-field-label" style="padding-left:20px;">Parentesco</td>
                                    <td class="p1-field-value">${(pase.parentesco || '').toUpperCase()}</td>
                                </tr>
                                <tr>
                                    <td class="p1-field-label">Nombre de Trabajador</td>
                                    <td class="p1-field-value">${(pase.nombre_trabajador || '').toUpperCase()}</td>
                                    <td class="p1-field-label" style="padding-left:20px;">Salida</td>
                                    <td class="p1-field-value">${formattedFecha}</td>
                                </tr>
                                <tr>
                                    <td class="p1-field-label">Edad</td>
                                    <td class="p1-field-value">${(pase.edad || '').toUpperCase()}</td>
                                    <td class="p1-field-label" style="padding-left:20px;">Unidad a la que se refiere</td>
                                    <td class="p1-field-value">${unidadSeRefiereTexto}</td>
                                </tr>
                                <tr>
                                    <td class="p1-field-label">Unidad que refiere</td>
                                    <td class="p1-field-value">${unidadRefiereTexto}</td>
                                    <td class="p1-field-label" style="padding-left:20px;">Médico que acepta la referencia</td>
                                    <td class="p1-field-value">${(pase.medico_acepta || '').toUpperCase()}</td>
                                </tr>
                                <tr>
                                    <td class="p1-field-label">Servicio al que se envía</td>
                                    <td class="p1-field-value">${(pase.servicio_se_envia || '').toUpperCase()}</td>
                                    <td class="p1-field-label" style="padding-left:20px;">Acompañante</td>
                                    <td class="p1-field-value">${(pase.acompanante || '').toUpperCase()}</td>
                                </tr>
                            </table>
                            
                            <table style="width: 100%; border-collapse: collapse; margin-top: 10px; border-bottom: 2.5px solid #000; border-top: 2.5px solid #000; padding: 5px 0; margin-bottom: 12px;">
                                <tr>
                                    <td style="font-weight: bold; font-size: 10px; padding: 6px 0; letter-spacing: 0.5px;">
                                        <span style="font-weight: 900; margin-right: 15px;">SV:</span>
                                        TA: <span style="border-bottom: 1.5px solid #000; padding: 0 20px; color: blue; font-weight: bold; font-size: 10.5px;">${pase.sv_ta || '90/50'}</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                        Temp: <span style="border-bottom: 1.5px solid #000; padding: 0 20px; color: blue; font-weight: bold; font-size: 10.5px;">${pase.sv_temp || '0'}</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                        FR: <span style="border-bottom: 1.5px solid #000; padding: 0 20px; color: blue; font-weight: bold; font-size: 10.5px;">${pase.sv_fr || '0'}</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                        FC: <span style="border-bottom: 1.5px solid #000; padding: 0 20px; color: blue; font-weight: bold; font-size: 10.5px;">${pase.sv_fc || '106'}</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                        PESO <span style="border-bottom: 1.5px solid #000; padding: 0 20px; color: blue; font-weight: bold; font-size: 10.5px;">${pase.sv_peso || '53'}</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                        TALLA <span style="border-bottom: 1.5px solid #000; padding: 0 20px; color: blue; font-weight: bold; font-size: 10.5px;">${pase.sv_talla || '0'}</span>
                                    </td>
                                </tr>
                            </table>
                            
                            <div class="text-block-title">Padecimiento actual:</div>
                            <div class="text-block-box">${(pase.padecimiento_actual || '').toUpperCase()}</div>
                            
                            <div class="text-block-title">Estudios paraclínicos:</div>
                            <div class="text-block-box-small">${(pase.estudios_paraclinicos || 'LOS NECESARIOS PARA EL PADECIMIENTO').toUpperCase()}</div>
                            
                            <div class="text-block-title">Impresión diagnóstica:</div>
                            <div class="text-block-box-small" style="color: blue; font-weight: bold;">${(pase.impresion_diagnostica || '').toUpperCase()}</div>
                            
                            <div class="text-block-title">Comentarios:</div>
                            <div class="text-block-box-small">${(pase.comentarios || '').toUpperCase()}</div>
                        </div>
                        
                        <div>
                            <table class="signature-table">
                                <tr>
                                    <td class="signature-cell" style="width: 50%;">
                                        ${sigRespHTML}
                                        <div class="signature-line">Nombre y firma de quien autoriza</div>
                                        <div class="signature-sub">Servicios Médicos El Herrero</div>
                                    </td>
                                    <td class="signature-cell" style="width: 50%;">
                                        ${sigRefiereHTML}
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
                                        <img src="/logo-bacis.png" class="logo-img" alt="Logo Bacis" />
                                    </td>
                                    <td class="header-title" style="text-align: left; padding-left: 15px;">
                                        Grupo Minero Bacís S.A. de C.V.
                                        <div class="header-subtitle">Unidad "El Herrero"</div>
                                    </td>
                                    <td style="vertical-align: top; text-align: right; width: 120px;">
                                        <div style="border: 1.5px solid #000; padding: 4px 15px; font-weight: bold; font-size: 11px; display: inline-block; text-align: center;">
                                            ${pase.folio || ''}
                                        </div>
                                    </td>
                                </tr>
                            </table>
                            
                            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                                <tr>
                                    <td style="border: 1px solid #000; padding: 5px; width: 75%;">
                                        <div style="font-size: 7.5px; font-weight: bold; color: #555; text-transform: uppercase;">Nombre del paciente</div>
                                        <div style="font-size: 10px; color: blue; font-weight: 800; text-transform: uppercase; margin-top: 1px;">${(pase.pacientes?.nombre_completo || '').toUpperCase()}</div>
                                    </td>
                                    <td style="border: 1px solid #000; padding: 5px; width: 25%;">
                                        <div style="font-size: 7.5px; font-weight: bold; color: #555; text-transform: uppercase;">Edad:</div>
                                        <div style="font-size: 10px; color: blue; font-weight: 800; text-transform: uppercase; margin-top: 1px;">${(pase.edad || '').toUpperCase()}</div>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="border: 1px solid #000; padding: 5px;">
                                        <div style="font-size: 7.5px; font-weight: bold; color: #555; text-transform: uppercase;">Nombre del trabajador</div>
                                        <div style="font-size: 10px; color: blue; font-weight: 800; text-transform: uppercase; margin-top: 1px;">${(pase.nombre_trabajador || '').toUpperCase()}</div>
                                    </td>
                                    <td style="border: 1px solid #000; padding: 5px;">
                                        <div style="font-size: 7.5px; font-weight: bold; color: #555; text-transform: uppercase;">Edad:</div>
                                        <div style="font-size: 10px; color: blue; font-weight: 800; text-transform: uppercase; margin-top: 1px;">&nbsp;</div>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="border: 1px solid #000; padding: 5px;" colspan="2">
                                        <table style="width: 100%; border-collapse: collapse; border: none;">
                                            <tr>
                                                <td style="border: none; padding: 0; width: 33%; font-size: 9px; font-weight: bold;">
                                                    <span style="color: #555; font-size: 8px; text-transform: uppercase;">Puesto:</span> 
                                                    <span style="color: blue; font-size: 9px; font-weight: 800; margin-left: 5px; text-transform: uppercase;">${(pase.empleados?.puesto || '').toUpperCase()}</span>
                                                </td>
                                                <td style="border: none; padding: 0; width: 33%; font-size: 9px; font-weight: bold;">
                                                    <span style="color: #555; font-size: 8px; text-transform: uppercase;">Departamento:</span> 
                                                    <span style="color: blue; font-size: 9px; font-weight: 800; margin-left: 5px; text-transform: uppercase;">${(pase.departamento_pasajero || '').toUpperCase()}</span>
                                                </td>
                                                <td style="border: none; padding: 0; width: 34%; font-size: 9px; font-weight: bold;">
                                                    <span style="color: #555; font-size: 8px; text-transform: uppercase;">Antigüedad:</span> 
                                                    <span style="color: blue; font-size: 9px; font-weight: 800; margin-left: 5px; text-transform: uppercase;">${(pase.antiguedad || '').toUpperCase()}</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <table class="p2-table" style="margin-top: 12px; width: 100%;">
                                <thead>
                                    <tr>
                                        <th style="width: 50%; font-size: 8.5px; border: 1.2px solid #000;">Fecha de salida de la unidad</th>
                                        <th style="width: 50%; font-size: 8.5px; border: 1.2px solid #000;">Medio de transporte</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style="color: blue; padding: 6px; font-size: 10px; border: 1.2px solid #000;">${formattedFechaSalidaUnidad.toUpperCase()}</td>
                                        <td style="color: blue; padding: 6px; font-size: 10px; border: 1.2px solid #000;">${(pase.medio_transporte || 'VIA TERRESTRE').toUpperCase()}</td>
                                    </tr>
                                </tbody>
                            </table>
                            
                            <table class="p2-table" style="margin-top: 8px; width: 100%;">
                                <thead>
                                    <tr>
                                        <th style="width: 50%; font-size: 8.5px; border: 1.2px solid #000;">Fecha que debe presentarse a consulta</th>
                                        <th style="width: 50%; font-size: 8.5px; border: 1.2px solid #000;">Fecha en que se presentó a consulta</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style="color: blue; padding: 6px; font-size: 10px; border: 1.2px solid #000;">${formattedFechaConsulta.toUpperCase()}</td>
                                        <td style="color: blue; padding: 6px; font-size: 10px; border: 1.2px solid #000; position: relative; height: 35px;">
                                            ${sigRefP2PresentoHTML}
                                            ${pase.fecha_presento_consulta ? formattedFechaPresentoConsulta.toUpperCase() : '&nbsp;'}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            
                            <table style="width: 100%; border-collapse: collapse; margin-top: 12px; border: 1px solid #000;">
                                <tr>
                                    <td style="border: 1px solid #000; padding: 5px; width: 40%; font-weight: bold; font-size: 9px;">Nombre Firma y cédula de Médico responsable de Unidad</td>
                                    <td style="border: 1px solid #000; padding: 5px; width: 60%; font-size: 9.5px; color: blue; font-weight: bold;">
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <span>${(pase.medico_responsable_unidad || '').toUpperCase()} CED. PROF. ${pase.cedula_responsable_unidad || ''}</span>
                                            ${sigRespP2HTML}
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="border: 1px solid #000; padding: 5px; font-weight: bold; font-size: 9px;">Se requiere atención de especialista:</td>
                                    <td style="border: 1px solid #000; padding: 5px; font-size: 9.5px; color: blue; font-weight: bold;">
                                        Si &nbsp; <span style="font-size: 12px; font-family: sans-serif; font-weight: normal;">${pase.requiere_especialista ? '❶' : '◯'}</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; No &nbsp; <span style="font-size: 12px; font-family: sans-serif; font-weight: normal;">${!pase.requiere_especialista ? '❶' : '◯'}</span>
                                    </td>
                                </tr>
                            </table>

                            <div style="border: 1px solid #000; border-top: none; padding: 6px; font-weight: bold; font-size: 9px;">
                                Fecha de cita:
                                <div style="min-height: 55px; color: blue; font-size: 10px; padding: 4px 0; font-weight: bold;">
                                    ${formattedFechaCita.toUpperCase()}
                                    <div style="color: blue; font-size: 9.5px; font-weight: normal; margin-top: 4px;">
                                        ${(pase.comentarios || '').toUpperCase()}
                                    </div>
                                </div>
                            </div>

                            <div style="border: 1px solid #000; border-top: none; padding: 6px; font-weight: bold; font-size: 9px;">
                                Firma y sello de Consultorio Médico Industrial:
                                <div style="min-height: 55px; display: flex; align-items: center; justify-content: center; color: #777; font-size: 9.5px; font-weight: bold; border: 1px dashed #ccc; margin-top: 4px;">
                                    [ CONSULTORIO MÉDICO INDUSTRIAL SANTA MARÍA - FIRMA Y SELLO ]
                                </div>
                            </div>
                        </div>
                        
                        <!-- SECCIÓN EXCLUSIVA - MEJORADA Y COMPLETADA -->
                        <div>
                            <div style="border-top: 2px dashed #000; margin: 12px 0 5px 0; text-align: center; font-weight: bold; font-size: 9px; letter-spacing: 2px; color: #000;">USO EXCLUSIVO DE CONTABILIDAD Y R.H.</div>
                            
                            <table class="p2-table" style="margin-top: 5px; width: 100%; border: 1px solid #000;">
                                <thead>
                                    <tr>
                                        <th colspan="4" style="background-color: #f3f4f6; font-size: 9px; padding: 4px; border: 1px solid #000; font-weight: bold; text-transform: uppercase;">Viáticos proporcionados en Unidad el Herrero</th>
                                    </tr>
                                    <tr>
                                        <th style="width: 25%; font-size: 8px; padding: 4px; border: 1px solid #000; text-transform: uppercase;">Días de viáticos</th>
                                        <th style="width: 25%; font-size: 8px; padding: 4px; border: 1px solid #000; text-transform: uppercase;">Cantidad diaria</th>
                                        <th style="width: 35%; font-size: 8px; padding: 4px; border: 1px solid #000; text-transform: uppercase;"></th>
                                        <th style="width: 15%; font-size: 8px; padding: 4px; border: 1px solid #000; text-transform: uppercase;">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style="height: 35px;">
                                        <td style="border: 1px solid #000;"></td>
                                        <td style="border: 1px solid #000;"></td>
                                        <td style="border: 1px solid #000;"></td>
                                        <td style="border: 1px solid #000;"></td>
                                    </tr>
                                </tbody>
                            </table>
                            
                            <table style="width: 100%; border-collapse: collapse; margin-top: 5px;">
                                <tr>
                                    <td class="signature-cell" style="width: 50%; padding-top: 15px;">
                                        <div class="signature-line" style="width: 80%;">Nombre y firma de recibido</div>
                                    </td>
                                    <td class="signature-cell" style="width: 50%; padding-top: 15px;">
                                        &nbsp;
                                    </td>
                                </tr>
                                <tr>
                                    <td class="signature-cell" style="width: 50%; padding-top: 15px;">
                                        <div class="signature-line" style="width: 80%;">Nombre y firma de recibido</div>
                                    </td>
                                    <td class="signature-cell" style="width: 50%; padding-top: 15px;">
                                        <div class="signature-line" style="width: 80%;">Autorizó</div>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="signature-cell" style="width: 33%; padding-top: 20px;">
                                        <div class="signature-line" style="width: 85%;">Firma de Contraloría</div>
                                    </td>
                                    <td class="signature-cell" style="width: 33%; padding-top: 20px;">
                                        <div class="signature-line" style="width: 85%;">Firma de Caja</div>
                                    </td>
                                    <td class="signature-cell" style="width: 34%; padding-top: 20px;">
                                        <div class="signature-line" style="width: 85%;">Centro de Costo</div>
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
        `);
        printWindow.document.close()
    }
    const handlePrintHotelPase = (pase: any) => {
        const printWindow = window.open('', '_blank', 'width=850,height=1100')
        if (!printWindow) return

        const pacienteNombre = (pase.pacientes?.nombre_completo || pase.nombre_trabajador || '').toUpperCase()
        const acompananteNombre = (pase.acompanante && pase.acompanante !== 'NO REQUIERE' && pase.acompanante !== 'SI' && pase.acompanante !== 'NO') 
            ? pase.acompanante.toUpperCase() 
            : (pase.acompanante === 'SI' ? 'REQUIERE ACOMPAÑANTE (VERIFICAR EN CLÍNICA)' : 'SIN ACOMPAÑANTE / NO REQUIERE')

        const fechaSalidaCorta = pase.fecha_salida ? new Date(pase.fecha_salida + 'T12:00:00').toLocaleDateString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        }) : new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })

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
                            height: 120mm;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-between;
                            box-sizing: border-box;
                            padding: 4mm 6mm;
                        }
                        .header-box {
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            border-bottom: 2px solid #000;
                            padding-bottom: 6px;
                            margin-bottom: 12px;
                        }
                        .header-text {
                            font-weight: bold;
                            font-size: 13px;
                            line-height: 1.3;
                        }
                        .header-logo-img {
                            height: 35px;
                            object-fit: contain;
                        }
                        .sub-title {
                            text-align: center;
                            font-weight: bold;
                            font-size: 13px;
                            margin: 8px 0 15px 0;
                            text-decoration: underline;
                        }
                        .table-favor {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 15px;
                        }
                        .table-favor th {
                            text-align: left;
                            font-size: 12px;
                            font-weight: bold;
                            padding: 5px 8px;
                            width: 150px;
                        }
                        .table-favor td {
                            text-align: left;
                            font-size: 12px;
                            padding: 5px 8px;
                            border-bottom: 1px solid #000;
                            font-weight: normal;
                        }
                        .row-salida {
                            display: flex;
                            align-items: center;
                            margin-top: 10px;
                            margin-bottom: 15px;
                            font-size: 12px;
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
                            padding-top: 10px;
                        }
                        .sig-box {
                            width: 220px;
                            text-align: center;
                            font-size: 11px;
                            font-weight: bold;
                        }
                        .sig-line {
                            border-bottom: 1px solid #000;
                            height: 25px;
                            margin-bottom: 4px;
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
                            font-size: 10px;
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
                                <div class="header-box">
                                    <div class="header-text">
                                        GRUPO MINERO BACIS S.A. DE C.V.<br>
                                        UNIDAD "EL HERRERO"
                                    </div>
                                    <img src="/logo-bacis.png" class="header-logo-img" />
                                </div>
                                <div class="sub-title">
                                    HOSPEDAJE EN ${hotelNombre}
                                </div>
                                <table class="table-favor">
                                    <tr>
                                        <th colspan="2" style="border-bottom: 1px solid #000; background:#f5f5f5; font-size:10px;">A FAVOR DE</th>
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
                                    <span class="salida-val">${fechaSalidaLarga.toUpperCase()}</span>
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
                                <div class="header-box">
                                    <div class="header-text">
                                        GRUPO MINERO BACIS S.A. DE C.V.<br>
                                        UNIDAD "EL HERRERO"
                                    </div>
                                    <img src="/logo-bacis.png" class="header-logo-img" />
                                </div>
                                <div class="sub-title">
                                    HOSPEDAJE EN ${hotelNombre}
                                </div>
                                <table class="table-favor">
                                    <tr>
                                        <th colspan="2" style="border-bottom: 1px solid #000; background:#f5f5f5; font-size:10px;">A FAVOR DE</th>
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
                                    <span class="salida-val">${fechaSalidaLarga.toUpperCase()}</span>
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
                            window.close();
                        }
                    </script>
                </body>
            </html>
        `)
        printWindow.document.close()
    }

    const filteredPases = pases.filter(p => {
        const query = searchQuery.toLowerCase()
        const matchText = (p.pacientes?.nombre_completo || '').toLowerCase().includes(query) ||
                          (p.folio || '').toLowerCase().includes(query)
        
        if (filterMode === 'compartidos') return matchText && p.compartido_departamentos === true
        if (filterMode === 'solo_medicos') return matchText && p.compartido_departamentos === false
        return matchText
    })

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
                                            <Lock className="w-3 h-3" /> Bloquear
                                        </>
                                    ) : (
                                        <>
                                            <Unlock className="w-3 h-3" /> Manual
                                        </>
                                    )}
                                </button>
                            </div>
                            <input 
                                required type="text" disabled={!editFolioManual}
                                className={`w-full rounded-xl px-3.5 py-2 text-xs font-mono font-black transition-all ${
                                    editFolioManual 
                                        ? "bg-white border-2 border-red-400 text-red-700 shadow-inner" 
                                        : "bg-zinc-100/90 border border-zinc-200 text-amber-900 cursor-not-allowed"
                                }`}
                                value={formData.folio}
                                onChange={e => setFormData({...formData, folio: e.target.value.toUpperCase()})}
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

                        {/* Ficha paciente */}
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Parentesco</label>
                            <input 
                                disabled type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-100 px-4 py-2.5 text-xs text-zinc-500"
                                value={formData.parentesco}
                            />
                        </div>
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Nombre Trabajador Relacionado</label>
                            <input 
                                disabled type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-100 px-4 py-2.5 text-xs text-zinc-500"
                                value={formData.nombre_trabajador}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Edad Paciente</label>
                            <input 
                                disabled type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-100 px-4 py-2.5 text-xs text-zinc-500"
                                value={formData.edad}
                            />
                        </div>

                        {/* Edad Trabajador y Antigüedad */}
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">F. Nacimiento Trabajador</label>
                            <input 
                                type="date"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold"
                                value={formData.fecha_nacimiento_trabajador}
                                onChange={e => handleWorkerBirthdateChange(e.target.value)}
                            />
                            {formData.edad_trabajador && (
                                <p className="text-[10px] text-zinc-500 mt-1 font-bold">Edad: {formData.edad_trabajador}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Antigüedad en Trabajo</label>
                            <input 
                                type="text"
                                placeholder="Ej. 3 años, 6 meses"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold"
                                value={formData.antiguedad}
                                onChange={e => setFormData({...formData, antiguedad: e.target.value})}
                            />
                        </div>

                        {/* Acompañante */}
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Acompañante de Viaje</label>
                            <input 
                                type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold"
                                value={formData.acompanante}
                                onChange={e => setFormData({...formData, acompanante: e.target.value})}
                                placeholder="NO REQUIERE"
                            />
                        </div>
                    </div>

                    {/* Clínicas y Destinos */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-zinc-50/50 p-4 rounded-xl border border-zinc-150">
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Clínica de Origen (Fijo)</label>
                            <select 
                                required className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold"
                                value={formData.id_clinica_origen}
                                onChange={e => setFormData({...formData, id_clinica_origen: e.target.value})}
                            >
                                <option value="">Seleccione origen...</option>
                                {clinicas.filter(c => c.activo !== false).map(c => (
                                    <option key={c.id_clinica} value={c.id_clinica}>{c.nombre} ({c.tipo})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Clínica de Destino (Externa)</label>
                            <select 
                                required className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold"
                                value={formData.id_clinica_destino}
                                onChange={e => setFormData({...formData, id_clinica_destino: e.target.value})}
                            >
                                <option value="">Seleccione destino...</option>
                                {clinicas.filter(c => c.activo !== false).map(c => (
                                    <option key={c.id_clinica} value={c.id_clinica}>{c.nombre} ({c.tipo})</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-amber-800 uppercase mb-0.5">Unidad de Destino (Impresión Ficha):</label>
                            <input 
                                type="text" required
                                className="w-full rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-1.5 text-[11px] font-bold text-amber-950 shadow-inner"
                                value={formData.unidad_se_refiere}
                                onChange={e => setFormData({...formData, unidad_se_refiere: e.target.value.toUpperCase()})}
                            />
                        </div>
                    </div>

                    {/* Signos Vitales Block */}
                    <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-150 space-y-3">
                        <h3 className="text-xs font-black text-zinc-700 uppercase tracking-widest flex items-center gap-1.5">
                            <Stethoscope className="w-4 h-4 text-amber-500" /> Signos Vitales
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
                                <input type="text" className="w-full rounded-lg border-zinc-200 bg-white p-2 text-xs font-bold" value={formData.sv_talla} onChange={e => setFormData({...formData, sv_talla: e.target.value})} placeholder="1.70" />
                            </div>
                        </div>
                    </div>

                    {/* Diagnósticos */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Padecimiento Actual / Antecedentes</label>
                            <textarea 
                                required rows={3}
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold"
                                value={formData.padecimiento_actual}
                                onChange={e => setFormData({...formData, padecimiento_actual: e.target.value})}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Estudios Paraclínicos</label>
                                <input type="text" className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold" value={formData.estudios_paraclinicos} onChange={e => setFormData({...formData, estudios_paraclinicos: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Impresión Diagnóstica</label>
                                <input required type="text" className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold" value={formData.impresion_diagnostica} onChange={e => setFormData({...formData, impresion_diagnostica: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Comentarios de Envío</label>
                                <input type="text" className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-bold" value={formData.comentarios} onChange={e => setFormData({...formData, comentarios: e.target.value})} />
                            </div>
                        </div>
                    </div>

                    {/* Médicos y Viáticos */}
                    <div className="bg-zinc-50/50 p-4 rounded-xl border border-zinc-150 space-y-4">
                        <h3 className="text-xs font-black text-zinc-700 uppercase tracking-widest flex items-center gap-1.5">
                            <Building className="w-4 h-4 text-emerald-600" /> Control y Médicos Autorizados
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Médico que Refiere</label>
                                <select 
                                    className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold"
                                    value={formData.medico_refiere}
                                    onChange={e => handleDoctorRefiereSelect(e.target.value)}
                                >
                                    <option value="">Seleccione médico tratante...</option>
                                    {medicos.map(m => (
                                        <option key={m.id} value={m.nombre_completo}>{m.nombre_completo}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Cédula Profesional</label>
                                <input required type="text" className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold" value={formData.cedula_refiere} onChange={e => setFormData({...formData, cedula_refiere: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Medio de Transporte</label>
                                <input required type="text" className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold" value={formData.medio_transporte} onChange={e => setFormData({...formData, medio_transporte: e.target.value})} />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Fecha de Salida Unidad</label>
                                <input required type="date" className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold" value={formData.fecha_salida_unidad} onChange={e => setFormData({...formData, fecha_salida_unidad: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Fecha Programada de Consulta</label>
                                <input required type="date" className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold" value={formData.fecha_consulta} onChange={e => setFormData({...formData, fecha_consulta: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Fecha Real que se Presentó</label>
                                <input type="date" className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold" value={formData.fecha_presento_consulta} onChange={e => setFormData({...formData, fecha_presento_consulta: e.target.value})} />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Médico Responsable de Unidad</label>
                                <select 
                                    className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold"
                                    value={formData.medico_responsable_unidad}
                                    onChange={e => handleDoctorResponsableSelect(e.target.value)}
                                >
                                    <option value="">Seleccione médico de unidad...</option>
                                    {medicos.map(m => (
                                        <option key={m.id} value={m.nombre_completo}>{m.nombre_completo}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Cédula de Médico de Unidad</label>
                                <input required type="text" className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold" value={formData.cedula_responsable_unidad} onChange={e => setFormData({...formData, cedula_responsable_unidad: e.target.value})} />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Servicio Especialidad al que se envía</label>
                                <input required type="text" className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold" value={formData.servicio_se_envia} onChange={e => setFormData({...formData, servicio_se_envia: e.target.value})} />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Médico Acepta Referencia</label>
                                <input required type="text" className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold" value={formData.medico_acepta} onChange={e => setFormData({...formData, medico_acepta: e.target.value})} />
                            </div>
                            <div className="flex items-center mt-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                                        checked={formData.requiere_especialista}
                                        onChange={e => setFormData({...formData, requiere_especialista: e.target.checked})}
                                    />
                                    <span className="text-xs font-bold text-zinc-700 uppercase">¿Atención de especialista?</span>
                                </label>
                            </div>
                            {formData.requiere_especialista && (
                                <div>
                                    <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Fecha de Cita</label>
                                    <input type="date" className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold" value={formData.fecha_cita} onChange={e => setFormData({...formData, fecha_cita: e.target.value})} />
                                </div>
                            )}
                        </div>

                        {/* Hotel Fields */}
                        <div className="pt-4 border-t border-zinc-200 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex items-center">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                                        checked={formData.requiere_hotel}
                                        onChange={e => setFormData({...formData, requiere_hotel: e.target.checked})}
                                    />
                                    <span className="text-xs font-bold text-zinc-700 uppercase">¿Requiere pase de hotel/hospedaje?</span>
                                </label>
                            </div>
                            {formData.requiere_hotel && (
                                <div>
                                    <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Nombre del Hotel</label>
                                    <input 
                                        required type="text"
                                        placeholder="Ej. HOTEL DEL CENTRO"
                                        className="w-full rounded-xl border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold"
                                        value={formData.hotel_nombre}
                                        onChange={e => setFormData({...formData, hotel_nombre: e.target.value})}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox"
                                className="rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                                checked={formData.compartido_departamentos}
                                onChange={e => setFormData({...formData, compartido_departamentos: e.target.checked})}
                            />
                            <span className="text-xs font-bold text-zinc-650 uppercase">Compartir pase en Muro / Departamentos</span>
                        </label>
                        <button type="submit" className="bg-amber-500 text-black px-6 py-2.5 rounded-xl text-sm font-black hover:bg-amber-400 transition-colors shadow-md">
                            Guardar e Registrar Pase Médico
                        </button>
                    </div>
                </form>
            )}

            {/* List Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
                <div className="p-4 border-b border-zinc-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-zinc-50">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input 
                            type="text"
                            placeholder="Buscar por paciente o folio..."
                            className="w-full pl-10 pr-4 py-2 rounded-xl border-zinc-200 bg-white text-xs font-semibold"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <button 
                            onClick={() => setFilterMode('todos')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterMode === 'todos' ? 'bg-zinc-900 text-white' : 'bg-white border text-zinc-600'}`}
                        >
                            Todos
                        </button>
                        <button 
                            onClick={() => setFilterMode('compartidos')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterMode === 'compartidos' ? 'bg-amber-500 text-black' : 'bg-white border text-zinc-600'}`}
                        >
                            Compartidos
                        </button>
                        <button 
                            onClick={() => setFilterMode('solo_medicos')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterMode === 'solo_medicos' ? 'bg-zinc-800 text-white' : 'bg-white border text-zinc-600'}`}
                        >
                            Exclusivo Médico
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-zinc-50 text-zinc-500 font-medium border-b border-zinc-100">
                            <tr>
                                <th className="px-6 py-4">Folio</th>
                                <th className="px-6 py-4">Paciente / Trabajador</th>
                                <th className="px-6 py-4">Clínica Origen</th>
                                <th className="px-6 py-4">Destino</th>
                                <th className="px-6 py-4">Motivo / Urgencia</th>
                                <th className="px-6 py-4">Impresión</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {loading ? (
                                <tr><td colSpan={7} className="px-6 py-8 text-center text-zinc-400">Cargando registros...</td></tr>
                            ) : filteredPases.length === 0 ? (
                                <tr><td colSpan={7} className="px-6 py-8 text-center text-zinc-400">No se encontraron pases registrados</td></tr>
                            ) : (
                                filteredPases.map(pase => (
                                    <tr key={pase.id_pase} className="hover:bg-zinc-50/50 transition-colors font-medium text-zinc-800">
                                        <td className="px-6 py-4 font-mono font-black text-red-700">{pase.folio}</td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-zinc-950 uppercase">{pase.pacientes?.nombre_completo || 'Paciente no registrado'}</div>
                                            <div className="text-[10px] text-zinc-400 uppercase">{pase.parentesco || 'ELLA MISMA'} | TRAB: {pase.nombre_trabajador || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4">{pase.clinica_origen?.nombre || 'Clínica Origen'}</td>
                                        <td className="px-6 py-4 font-bold text-amber-700">{pase.unidad_se_refiere || pase.clinica_destino?.nombre || 'Destino'}</td>
                                        <td className="px-6 py-4">
                                            <div className="truncate max-w-xs">{pase.motivo}</div>
                                            <div className="text-[10px] text-zinc-400 font-bold uppercase">Urgencia: <span className={pase.urgencia === 'SÍ' ? 'text-red-600 font-black' : ''}>{pase.urgencia || 'NO'}</span></div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handlePrintPase(pase)}
                                                    className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 border text-[10px] font-bold rounded-lg flex items-center gap-1 uppercase transition-colors"
                                                    title="Imprimir Pase de Referencia y Viáticos"
                                                >
                                                    <Printer className="w-3.5 h-3.5" /> Pase
                                                </button>
                                                {pase.requiere_hotel && (
                                                    <button 
                                                        onClick={() => handlePrintHotelPase(pase)}
                                                        className="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-bold rounded-lg flex items-center gap-1 uppercase transition-colors"
                                                        title="Imprimir Pase de Hospedaje en Hotel"
                                                    >
                                                        🏨 Hotel
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => deletePase(pase.id_pase, pase.folio)}
                                                className="text-zinc-400 hover:text-rose-600 transition-colors ml-auto flex items-center gap-1"
                                                title="Eliminar Pase"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" /> Eliminar
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
