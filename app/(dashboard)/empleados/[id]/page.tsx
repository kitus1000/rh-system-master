'use client'

import { useRef, useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/utils/supabase/client'
import { ArrowLeft, User, Briefcase, FileText, AlertTriangle, Edit, X, MapPin, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { AdscripcionesManager } from '@/components/AdscripcionesManager'
import { TurnoRolManager } from '@/components/TurnoRolManager'
import { IncidenciasManager } from '@/components/IncidenciasManager'
import { VacationBalanceManager } from '@/components/VacationBalanceManager'

export default function EmpleadoDetallePage() {
    const params = useParams()
    const id = params.id as string
    const [empleado, setEmpleado] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('perfil')
    const [isEditing, setIsEditing] = useState(false)

    // Edit Modal State
    const [editTab, setEditTab] = useState('personal')
    const [editForm, setEditForm] = useState<any>({})
    const [fotoFile, setFotoFile] = useState<File | null>(null)

    // Auto-calcular SDI cuando cambia salario_diario
    useEffect(() => {
        if (editForm.salario_diario) {
            const sd = parseFloat(editForm.salario_diario);
            if (!isNaN(sd)) {
                // Factor de integración por defecto (1 año antigüedad: 1.0493)
                const sdiCalculado = (sd * 1.0493).toFixed(2);
                if (editForm.sdi !== sdiCalculado) {
                    setEditForm((prev: any) => ({ ...prev, sdi: sdiCalculado }));
                }
            }
        }
    }, [editForm.salario_diario]);
    const [fotoPreview, setFotoPreview] = useState<string | null>(null)

    // Rehire Modal State
    const [isRehireModalOpen, setIsRehireModalOpen] = useState(false)
    const [rehireDate, setRehireDate] = useState(new Date().toISOString().split('T')[0])

    // Termination Modal State
    const [isTerminationModalOpen, setIsTerminationModalOpen] = useState(false)
    const [terminationForm, setTerminationForm] = useState({
        id_causa_baja: '',
        id_causa_imss: '',
        fecha_baja: new Date().toISOString().split('T')[0],
        comentarios: ''
    })
    const [catalogs, setCatalogs] = useState<{ causasBaja: any[], causasImss: any[], tipoSolicitudBajaId: string | null, tipoSolicitudReingresoId: string | null }>({
        causasBaja: [],
        causasImss: [],
        tipoSolicitudBajaId: null,
        tipoSolicitudReingresoId: null
    })
    const [canManage, setCanManage] = useState(false)
    const [turnos, setTurnos] = useState<any[]>([])

    useEffect(() => {
        checkPermissions()
        fetchEmpleado()
        fetchCatalogs()
    }, [id])

    async function checkPermissions() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data: profile } = await supabase
                .from('perfiles')
                .select('rol, cat_departamentos(departamento)')
                .eq('id', user.id)
                .single()

            if (profile) {
                const isAdmin = profile.rol === 'Administrativo'
                // @ts-ignore
                const deptName = profile.cat_departamentos?.departamento || (Array.isArray(profile.cat_departamentos) ? profile.cat_departamentos[0]?.departamento : '')
                const isHR = profile.rol === 'Jefe' && deptName === 'Recursos Humanos'
                setCanManage(isAdmin || isHR)
            }
        }
    }

    async function fetchCatalogs() {
        const { data: causasBaja } = await supabase.from('cat_causas_baja').select('*').eq('activo', true)
        const { data: causasImss } = await supabase.from('cat_causas_baja_imss').select('*').eq('activo', true)
        const { data: tipoBaja } = await supabase.from('cat_tipos_solicitud').select('id_tipo_solicitud').eq('tipo_solicitud', 'Baja de Personal').single()
        const { data: tipoReingreso } = await supabase.from('cat_tipos_solicitud').select('id_tipo_solicitud').eq('tipo_solicitud', 'Reingreso').single()
        const { data: turnosData } = await supabase.from('turnos').select('*').eq('activo', true)

        setCatalogs({
            causasBaja: causasBaja || [],
            causasImss: causasImss || [],
            tipoSolicitudBajaId: tipoBaja?.id_tipo_solicitud || null,
            tipoSolicitudReingresoId: tipoReingreso?.id_tipo_solicitud || null
        })
        setTurnos(turnosData || [])
    }

    async function fetchEmpleado() {
        if (!id) return

        const { data, error } = await supabase
            .from('empleados')
            .select(`
            *,
            empleado_domicilio(*),
            empleado_ingreso(*),
            empleado_banco(*),
            empleado_salarios(*),
            turnos(nombre)
        `)
            .eq('id_empleado', id)
            .single()

        if (!error && data) {
            setEmpleado(data)

            // Normalize as objects
            const domicilio = Array.isArray(data.empleado_domicilio) ? data.empleado_domicilio[0] : data.empleado_domicilio
            const ingreso = Array.isArray(data.empleado_ingreso) ? data.empleado_ingreso[0] : data.empleado_ingreso
            const banco = Array.isArray(data.empleado_banco) ? data.empleado_banco[0] : data.empleado_banco
            const salarios = data.empleado_salarios || []
            const salarioActual = salarios.sort((a: any, b: any) => new Date(b.fecha_inicio_vigencia).getTime() - new Date(a.fecha_inicio_vigencia).getTime())[0]

            // Flatten data for edit form
            setEditForm({
                ...data,
                // Domicilio
                calle: domicilio?.calle || '',
                numero_exterior: domicilio?.numero_exterior || '',
                colonia: domicilio?.colonia || '',
                codigo_postal: domicilio?.codigo_postal || '',
                ciudad: domicilio?.ciudad || '',
                municipio: domicilio?.municipio || '',
                estado: domicilio?.estado || '',
                // Ingreso
                fecha_ingreso: ingreso?.fecha_ingreso || '',
                // Salario
                salario_diario: salarioActual?.salario_diario || '',
                sdi: salarioActual?.sdi || '',
                // Banco
                banco: banco?.banco || '',
                numero_cuenta: banco?.numero_cuenta || '',
                clabe: banco?.clabe || '',
                // Turno
                id_turno: data.id_turno || ''
            })
            if (data.foto_url) {
                setFotoPreview(data.foto_url)
            }
        }
        setLoading(false)
    }

    async function handleRehire() {
        if (!rehireDate) {
            alert('Por favor seleccione una fecha de reingreso')
            return
        }

        let reingresoId = catalogs.tipoSolicitudReingresoId

        // Fallback: Fetch if missing (e.g. stale state or connection issue on load)
        if (!reingresoId) {
            const { data } = await supabase.from('cat_tipos_solicitud').select('id_tipo_solicitud').eq('tipo_solicitud', 'Reingreso').single()
            if (data) reingresoId = data.id_tipo_solicitud
        }

        if (!reingresoId) {
            alert('Error: No se encontró el tipo de solicitud "Reingreso" en el sistema. Intente recargar la página.')
            return
        }

        try {
            // Create Rehire Request
            const { error } = await supabase.from('solicitudes').insert({
                id_tipo_solicitud: reingresoId,
                id_empleado_objetivo: id,
                estatus: 'Pendiente',
                folio: `REING-${Date.now()}`,
                payload: {
                    fecha_reingreso: rehireDate,
                    nombre_empleado: `${empleado.nombre} ${empleado.apellido_paterno}`
                }
            })

            if (error) throw error

            setIsRehireModalOpen(false)
            alert('Solicitud de Reingreso iniciada correctamente. Pendiente de aprobación RH.')
        } catch (e: any) {
            alert('Error iniciando reingreso: ' + e.message)
        }
    }

    async function handleTerminate() {
        if (!terminationForm.id_causa_baja || !terminationForm.fecha_baja) {
            alert('Por favor complete los campos obligatorios')
            return
        }

        try {
            if (!catalogs.tipoSolicitudBajaId) {
                alert('Error: No se encontró el tipo de solicitud "Baja" en el sistema.')
                return
            }

            // Create Termination Request (Solicitud)
            const { error } = await supabase.from('solicitudes').insert({
                id_tipo_solicitud: catalogs.tipoSolicitudBajaId,
                id_empleado_objetivo: id,
                estatus: 'Pendiente', // or 'Enviada'
                folio: `BAJA-${Date.now()}`, // Simple folio generation
                payload: {
                    id_causa_baja: terminationForm.id_causa_baja,
                    fecha_baja: terminationForm.fecha_baja,
                    comentarios: terminationForm.comentarios,
                    nombre_empleado: `${empleado.nombre} ${empleado.apellido_paterno}`
                }
            })

            if (error) throw error

            setIsTerminationModalOpen(false)
            alert('Solicitud de Baja iniciada correctamente. Pendiente de aprobación.')
        } catch (e: any) {
            alert('Error iniciando baja: ' + e.message)
        }
    }

    async function handleUpdate() {
        try {
            // 0. Subir nueva foto si se seleccionó
            let newFotoUrl = empleado.foto_url;
            if (fotoFile) {
                const fileExt = fotoFile.name.split('.').pop()
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('fotos_empleados')
                    .upload(fileName, fotoFile)
                
                if (uploadError) throw new Error('Error al subir la foto: ' + uploadError.message)
                
                const { data: publicUrlData } = supabase.storage
                    .from('fotos_empleados')
                    .getPublicUrl(fileName)
                
                newFotoUrl = publicUrlData.publicUrl
            }

            // 1. Update Main Employee Table
            const { error: empError } = await supabase
                .from('empleados')
                .update({
                    nombre: editForm.nombre,
                    apellido_paterno: editForm.apellido_paterno,
                    apellido_materno: editForm.apellido_materno,
                    telefono: editForm.telefono,
                    correo_electronico: editForm.correo_electronico,
                    sexo: editForm.sexo,
                    fecha_nacimiento: editForm.fecha_nacimiento,
                    estado_civil: editForm.estado_civil,
                    rfc: editForm.rfc,
                    curp: editForm.curp,
                    nss: editForm.nss,
                    foto_url: newFotoUrl,
                    id_turno: editForm.id_turno || null
                })
                .eq('id_empleado', id)

            if (empError) throw empError

            // 2. Upsert Domicilio
            const domicilioData = {
                id_empleado: id,
                calle: editForm.calle,
                numero_exterior: editForm.numero_exterior,
                colonia: editForm.colonia,
                codigo_postal: editForm.codigo_postal,
                ciudad: editForm.ciudad,
                municipio: editForm.municipio,
                estado: editForm.estado
            }
            const { error: domError } = await supabase.from('empleado_domicilio').upsert(domicilioData)
            if (domError) console.error("Error domicilio:", domError)

            // 3. Upsert Ingreso (Only if editing allowed, rarely changes unless rehire)
            if (editForm.fecha_ingreso) {
                const { error: ingError } = await supabase.from('empleado_ingreso').upsert({
                    id_empleado: id,
                    fecha_ingreso: editForm.fecha_ingreso
                })
                if (ingError) console.error("Error ingreso:", ingError)
            }

            // 4. Upsert Salario
            if (editForm.salario_diario && editForm.fecha_ingreso) {
                const sdiVal = editForm.sdi ? parseFloat(editForm.sdi) : (parseFloat(editForm.salario_diario) * 1.0493);
                
                const payload: any = {
                    id_empleado: id,
                    fecha_inicio_vigencia: editForm.fecha_ingreso,
                    salario_diario: parseFloat(editForm.salario_diario),
                    motivo: 'Actualización'
                };
                
                if (!isNaN(sdiVal)) {
                    payload.sdi = parseFloat(sdiVal.toFixed(2));
                }

                const { error: salError } = await supabase.from('empleado_salarios').upsert(payload)
                if (salError) {
                    console.error("Error salario:", salError);
                    alert("Asegúrate de haber creado la columna 'sdi' en la tabla empleado_salarios: " + salError.message);
                }
            }

            // 4. Upsert Banco
            if (editForm.banco || editForm.numero_cuenta || editForm.clabe) {
                const bancoData = {
                    id_empleado: id,
                    banco: editForm.banco,
                    numero_cuenta: editForm.numero_cuenta,
                    clabe: editForm.clabe
                }
                const { error: bankError } = await supabase.from('empleado_banco').upsert(bancoData)
                if (bankError) console.error("Error banco:", bankError)
            }

            // Refresh data
            fetchEmpleado()
            setIsEditing(false)
            alert('Información actualizada correctamente')
        } catch (e: any) {
            alert('Error updating: ' + e.message)
        }
    }

    if (loading) return <div className="p-8 text-center text-zinc-500">Cargando perfil...</div>
    if (!empleado) return <div className="p-8 text-center text-red-500">Empleado no encontrado.</div>

    // Helpers
    const domicilio = Array.isArray(empleado.empleado_domicilio) ? empleado.empleado_domicilio[0] : empleado.empleado_domicilio
    const ingreso = Array.isArray(empleado.empleado_ingreso) ? empleado.empleado_ingreso[0] : empleado.empleado_ingreso
    const banco = Array.isArray(empleado.empleado_banco) ? empleado.empleado_banco[0] : empleado.empleado_banco
    const isBaja = empleado.estado_empleado === 'Baja'

    return (
        <div className="max-w-7xl mx-auto relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                    <Link href="/empleados" className="p-2 rounded-full hover:bg-zinc-200 transition-colors">
                        <ArrowLeft className="h-6 w-6 text-zinc-600" />
                    </Link>
                    {empleado.foto_url ? (
                        <img src={empleado.foto_url} alt="Foto" className="h-16 w-16 rounded-full object-cover border border-zinc-200 shadow-sm" />
                    ) : (
                        <div className="h-16 w-16 rounded-full bg-zinc-200 flex items-center justify-center border border-zinc-300 shadow-sm">
                            <User className="h-8 w-8 text-zinc-500" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900">{empleado.nombre} {empleado.apellido_paterno}</h1>
                        <p className="text-sm text-zinc-500">#{empleado.numero_empleado} • <span className={isBaja ? "text-red-500 font-bold" : "text-green-600"}>{empleado.estado_empleado}</span></p>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    {canManage && isBaja && (
                        <button
                            onClick={() => setIsRehireModalOpen(true)}
                            className="flex items-center px-4 py-2 bg-green-50 border border-green-200 rounded-md text-sm font-medium text-green-700 hover:bg-green-100 transition-colors shadow-sm"
                        >
                            <User className="w-4 h-4 mr-2" />
                            Recontratar
                        </button>
                    )}

                    {!isBaja && (
                        <>
                            {canManage && (
                                <button
                                    onClick={() => setIsTerminationModalOpen(true)}
                                    className="flex items-center px-4 py-2 bg-red-50 border border-red-200 rounded-md text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
                                >
                                    <AlertTriangle className="w-4 h-4 mr-2" />
                                    Dar de Baja
                                </button>
                            )}
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center px-4 py-2 bg-white border border-zinc-300 rounded-md text-sm font-medium text-zinc-700 hover:bg-zinc-50 shadow-sm transition-colors"
                            >
                                <Edit className="w-4 h-4 mr-2" />
                                Editar Perfil
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Rehire Modal */}
            {isRehireModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden border-2 border-green-100">
                        <div className="p-6 border-b border-green-50 bg-green-50/30 flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-bold text-zinc-900">Recontratar Empleado</h3>
                                <p className="text-xs text-green-600 font-medium">Se reiniciará la antigüedad y vacaciones.</p>
                            </div>
                            <button onClick={() => setIsRehireModalOpen(false)} className="text-zinc-400 hover:text-zinc-900">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <label className="block text-xs font-bold text-zinc-700 mb-2">Nueva Fecha de Ingreso</label>
                            <input
                                type="date"
                                className="w-full text-sm border-zinc-300 rounded-md text-black bg-white"
                                value={rehireDate}
                                onChange={e => setRehireDate(e.target.value)}
                            />
                            <div className="mt-6 flex justify-end">
                                <button onClick={() => setIsRehireModalOpen(false)} className="mr-3 text-sm text-zinc-500 hover:text-zinc-800">Cancelar</button>
                                <button
                                    onClick={handleRehire}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
                                >
                                    Confirmar Reingreso
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="border-b border-zinc-200 mb-6">
                <nav className="-mb-px flex space-x-8 overflow-x-auto">
                    {['perfil', 'historial', 'incidencias', 'vacaciones', 'documentos'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`
                                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors
                                ${activeTab === tab
                                    ? 'border-black text-black'
                                    : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'}
                            `}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content: Perfil */}
            {activeTab === 'perfil' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                    <div className="space-y-6">
                        {/* Información Personal */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
                            <h3 className="font-bold text-zinc-900 mb-4 flex items-center">
                                <User className="w-5 h-5 mr-2" />
                                Información Personal
                            </h3>
                            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                                <div className="col-span-1">
                                    <dt className="text-xs font-medium text-zinc-500">RFC</dt>
                                    <dd className="text-sm font-medium text-zinc-900">{empleado.rfc || '-'}</dd>
                                </div>
                                <div className="col-span-1">
                                    <dt className="text-xs font-medium text-zinc-500">CURP</dt>
                                    <dd className="text-sm font-medium text-zinc-900">{empleado.curp || '-'}</dd>
                                </div>
                                <div className="col-span-1">
                                    <dt className="text-xs font-medium text-zinc-500">NSS</dt>
                                    <dd className="text-sm font-medium text-zinc-900">{empleado.nss || '-'}</dd>
                                </div>
                                <div className="col-span-1">
                                    <dt className="text-xs font-medium text-zinc-500">Fecha Nacimiento</dt>
                                    <dd className="text-sm font-medium text-zinc-900">{empleado.fecha_nacimiento || '-'}</dd>
                                </div>
                                <div className="col-span-1">
                                    <dt className="text-xs font-medium text-zinc-500">Sexo</dt>
                                    <dd className="text-sm font-medium text-zinc-900">{empleado.sexo || '-'}</dd>
                                </div>
                                <div className="col-span-1">
                                    <dt className="text-xs font-medium text-zinc-500">Estado Civil</dt>
                                    <dd className="text-sm font-medium text-zinc-900">{empleado.estado_civil || '-'}</dd>
                                </div>
                                <div className="col-span-2">
                                    <dt className="text-xs font-medium text-zinc-500">Correo Electrónico</dt>
                                    <dd className="text-sm font-medium text-zinc-900">{empleado.correo_electronico || '-'}</dd>
                                </div>
                                <div className="col-span-2">
                                    <dt className="text-xs font-medium text-zinc-500">Teléfono</dt>
                                    <dd className="text-sm font-medium text-zinc-900">{empleado.telefono || '-'}</dd>
                                </div>
                            </dl>
                        </div>

                        {/* Domicilio */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
                            <h3 className="font-bold text-zinc-900 mb-4 flex items-center">
                                <MapPin className="w-5 h-5 mr-2" />
                                Domicilio
                            </h3>
                            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                                <div className="col-span-2">
                                    <dt className="text-xs font-medium text-zinc-500">Calle y Número</dt>
                                    <dd className="text-sm font-medium text-zinc-900">
                                        {domicilio?.calle} {domicilio?.numero_exterior}
                                    </dd>
                                </div>
                                <div className="col-span-1">
                                    <dt className="text-xs font-medium text-zinc-500">Colonia</dt>
                                    <dd className="text-sm font-medium text-zinc-900">{domicilio?.colonia || '-'}</dd>
                                </div>
                                <div className="col-span-1">
                                    <dt className="text-xs font-medium text-zinc-500">C.P.</dt>
                                    <dd className="text-sm font-medium text-zinc-900">{domicilio?.codigo_postal || '-'}</dd>
                                </div>
                                <div className="col-span-1">
                                    <dt className="text-xs font-medium text-zinc-500">Ciudad/Municipio</dt>
                                    <dd className="text-sm font-medium text-zinc-900">
                                        {domicilio?.ciudad} {domicilio?.municipio ? `, ${domicilio.municipio}` : ''}
                                    </dd>
                                </div>
                                <div className="col-span-1">
                                    <dt className="text-xs font-medium text-zinc-500">Estado</dt>
                                    <dd className="text-sm font-medium text-zinc-900">{domicilio?.estado || '-'}</dd>
                                </div>
                            </dl>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Datos Bancarios */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
                            <h3 className="font-bold text-zinc-900 mb-4 flex items-center">
                                <CreditCard className="w-5 h-5 mr-2" />
                                Datos Bancarios
                            </h3>
                            <dl className="space-y-4">
                                <div>
                                    <dt className="text-xs font-medium text-zinc-500">Banco</dt>
                                    <dd className="text-sm font-medium text-zinc-900">{banco?.banco || 'No registrado'}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-zinc-500">Número de Cuenta</dt>
                                    <dd className="text-sm font-medium text-zinc-900 font-mono bg-zinc-50 p-1 rounded inline-block">
                                        {banco?.numero_cuenta || '-'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-zinc-500">CLABE</dt>
                                    <dd className="text-sm font-medium text-zinc-900 font-mono bg-zinc-50 p-1 rounded inline-block">
                                        {banco?.clabe || '-'}
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        {/* Datos de Ingreso */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
                            <h3 className="font-bold text-zinc-900 mb-4 flex items-center">
                                <Briefcase className="w-5 h-5 mr-2" />
                                Información Laboral
                            </h3>
                            <dl className="space-y-4">
                                <div>
                                    <dt className="text-xs font-medium text-zinc-500">Fecha de Ingreso Vigente</dt>
                                    <dd className="text-sm font-bold text-zinc-900">
                                        {ingreso?.fecha_ingreso || 'No registrada'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-zinc-500">Turno Asignado</dt>
                                    <dd className="text-sm font-bold text-zinc-900">
                                        {empleado.turnos?.nombre || 'Sin Turno Asignado'}
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'historial' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <TurnoRolManager idEmpleado={id} isReadOnly={isBaja} />
                    <AdscripcionesManager idEmpleado={id} isReadOnly={isBaja} />
                </div>
            )}

            {activeTab === 'incidencias' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <IncidenciasManager idEmpleado={id} isReadOnly={isBaja || !canManage} />
                </div>
            )}

            {activeTab === 'vacaciones' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <VacationBalanceManager idEmpleado={id} fechaIngreso={ingreso?.fecha_ingreso} isReadOnly={!canManage} />
                </div>
            )}

            {activeTab === 'documentos' && (
                <div className="text-center py-10 text-zinc-400">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>Módulo de documentos en desarrollo.</p>
                </div>
            )}

            {/* Edit Modal */}
            {
                isEditing && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                            <div className="flex justify-between items-center p-6 border-b border-zinc-200 shrink-0">
                                <div>
                                    <h3 className="text-xl font-bold text-zinc-900">Editar Información</h3>
                                    <p className="text-sm text-zinc-500">Actualice los datos del empleado</p>
                                </div>
                                <button onClick={() => setIsEditing(false)} className="text-zinc-400 hover:text-zinc-900">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Modal Tabs */}
                            <div className="bg-zinc-50 border-b border-zinc-200 px-6 shrink-0">
                                <nav className="-mb-px flex space-x-6">
                                    {['personal', 'domicilio', 'bancario', 'fiscales', 'laboral'].map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setEditTab(t)}
                                            className={`capitalize whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${editTab === t
                                                ? 'border-black text-black'
                                                : 'border-transparent text-zinc-500 hover:text-zinc-700'
                                                }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </nav>
                            </div>

                            <div className="p-6 overflow-y-auto flex-1">
                                {editTab === 'personal' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                                        <div className="col-span-1 md:col-span-2 flex flex-col items-center justify-center p-4 border-2 border-dashed border-zinc-300 rounded-lg bg-zinc-50 mb-4">
                                            <div className="h-24 w-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-zinc-200 flex items-center justify-center relative mb-4">
                                                {fotoPreview ? (
                                                    <img src={fotoPreview} alt="Preview" className="h-full w-full object-cover" />
                                                ) : (
                                                    <User className="h-12 w-12 text-zinc-400" />
                                                )}
                                            </div>
                                            <label className="cursor-pointer bg-white px-4 py-2 border border-zinc-300 rounded-md shadow-sm text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors">
                                                <span>Cambiar Foto</span>
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    className="sr-only" 
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0]
                                                        if (file) {
                                                            setFotoFile(file)
                                                            setFotoPreview(URL.createObjectURL(file))
                                                        }
                                                    }}
                                                />
                                            </label>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Nombre</label>
                                            <input className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Apellido Paterno</label>
                                            <input className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.apellido_paterno} onChange={e => setEditForm({ ...editForm, apellido_paterno: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Apellido Materno</label>
                                            <input className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.apellido_materno} onChange={e => setEditForm({ ...editForm, apellido_materno: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Sexo</label>
                                            <select className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.sexo} onChange={e => setEditForm({ ...editForm, sexo: e.target.value })}>
                                                <option value="Masculino">Masculino</option>
                                                <option value="Femenino">Femenino</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Fecha Nacimiento</label>
                                            <input type="date" className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.fecha_nacimiento} onChange={e => setEditForm({ ...editForm, fecha_nacimiento: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Estado Civil</label>
                                            <select className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.estado_civil} onChange={e => setEditForm({ ...editForm, estado_civil: e.target.value })}>
                                                <option value="">Seleccionar...</option>
                                                <option value="Soltero">Soltero/a</option>
                                                <option value="Casado">Casado/a</option>
                                                <option value="Divorciado">Divorciado/a</option>
                                                <option value="Viudo">Viudo/a</option>
                                                <option value="Union Libre">Unión Libre</option>
                                            </select>
                                        </div>
                                        <div className="col-span-2 border-t pt-4 mt-2">
                                            <h4 className="text-xs font-bold text-zinc-900 mb-4">Contacto</h4>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div>
                                                    <label className="block text-xs font-medium text-zinc-500 mb-1">Teléfono</label>
                                                    <input className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.telefono} onChange={e => setEditForm({ ...editForm, telefono: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-zinc-500 mb-1">Correo Electrónico</label>
                                                    <input className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.correo_electronico} onChange={e => setEditForm({ ...editForm, correo_electronico: e.target.value })} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {editTab === 'domicilio' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Calle</label>
                                            <input className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.calle} onChange={e => setEditForm({ ...editForm, calle: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">No. Exterior</label>
                                            <input className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.numero_exterior} onChange={e => setEditForm({ ...editForm, numero_exterior: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Código Postal</label>
                                            <input className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.codigo_postal} onChange={e => setEditForm({ ...editForm, codigo_postal: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Colonia</label>
                                            <input className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.colonia} onChange={e => setEditForm({ ...editForm, colonia: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Ciudad</label>
                                            <input className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.ciudad} onChange={e => setEditForm({ ...editForm, ciudad: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Municipio</label>
                                            <input className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.municipio} onChange={e => setEditForm({ ...editForm, municipio: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Estado</label>
                                            <input className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.estado} onChange={e => setEditForm({ ...editForm, estado: e.target.value })} />
                                        </div>
                                    </div>
                                )}

                                {editTab === 'fiscales' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">RFC</label>
                                            <input className="w-full text-sm border-zinc-300 rounded-md uppercase text-black bg-white" value={editForm.rfc} onChange={e => setEditForm({ ...editForm, rfc: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">CURP</label>
                                            <input className="w-full text-sm border-zinc-300 rounded-md uppercase text-black bg-white" value={editForm.curp} onChange={e => setEditForm({ ...editForm, curp: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">NSS</label>
                                            <input className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.nss} onChange={e => setEditForm({ ...editForm, nss: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Fecha Ingreso</label>
                                            <input type="date" className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.fecha_ingreso} onChange={e => setEditForm({ ...editForm, fecha_ingreso: e.target.value })} />
                                        </div>
                                    </div>
                                )}

                                {editTab === 'bancario' && (
                                    <div className="grid grid-cols-1 gap-6 animate-in fade-in">
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Banco</label>
                                            <input className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.banco} onChange={e => setEditForm({ ...editForm, banco: e.target.value })} placeholder="Ej. BBVA" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Número de Cuenta</label>
                                            <input className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.numero_cuenta} onChange={e => setEditForm({ ...editForm, numero_cuenta: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">CLABE Interbancaria</label>
                                            <input className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.clabe} onChange={e => setEditForm({ ...editForm, clabe: e.target.value })} />
                                        </div>
                                    </div>
                                )}

                                {editTab === 'laboral' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Fecha Ingreso</label>
                                            <input type="date" className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.fecha_ingreso} onChange={e => setEditForm({ ...editForm, fecha_ingreso: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Salario Diario</label>
                                            <input type="number" step="0.01" className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.salario_diario || ''} onChange={e => setEditForm({ ...editForm, salario_diario: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Salario Diario Integrado (SDI)</label>
                                            <input type="number" step="0.01" className="w-full text-sm border-zinc-300 rounded-md text-black bg-white" value={editForm.sdi || ''} onChange={e => setEditForm({ ...editForm, sdi: e.target.value })} />
                                        </div>
                                        
                                        <div className="col-span-1 md:col-span-2 bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-md my-2">
                                            <p className="text-sm font-bold">Gestión de Horarios y Roles</p>
                                            <p className="text-xs mt-1">Cualquier cambio de horario o rol se guardará inmediatamente y se añadirá al historial del colaborador para proyecciones futuras.</p>
                                        </div>
                                        <div className="col-span-1 md:col-span-2">
                                            <TurnoRolManager idEmpleado={id} isReadOnly={isBaja} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end p-6 border-t border-zinc-200 bg-zinc-50 shrink-0">
                                <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 mr-2">Cancelar</button>
                                <button onClick={handleUpdate} className="px-6 py-2 text-sm bg-black text-white font-bold rounded-md hover:bg-zinc-800 shadow-md">Guardar Cambios</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Termination Modal */}
            {
                isTerminationModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden border-2 border-red-100">
                            <div className="p-6 border-b border-red-50 bg-red-50/30 flex justify-between items-start">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-red-100 rounded-full">
                                        <AlertTriangle className="w-6 h-6 text-red-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-zinc-900">Iniciar Baja</h3>
                                        <p className="text-xs text-red-600 font-medium">Acción Irreversible: Requiere Aprobación</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsTerminationModalOpen(false)} className="text-zinc-400 hover:text-zinc-900">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-700 mb-1">Motivo de la Baja</label>
                                    <select
                                        className="w-full text-sm border-zinc-300 rounded-md text-black bg-white"
                                        value={terminationForm.id_causa_baja}
                                        onChange={e => setTerminationForm({ ...terminationForm, id_causa_baja: e.target.value })}
                                    >
                                        <option value="">Seleccione un motivo...</option>
                                        {catalogs.causasBaja.map((c: any) => (
                                            <option key={c.id_causa_baja} value={c.id_causa_baja}>{c.causa}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Show IMSS Cause if selected reason matches typical cases or just always show as optional? 
                                User Requirement: "causas dle imss solo para dar de baja ante el imss"
                                Let's show it always as "Causa Oficial IMSS" 
                            */}


                                <div>
                                    <label className="block text-xs font-bold text-zinc-700 mb-1">Fecha Efectiva de Baja</label>
                                    <input
                                        type="date"
                                        className="w-full text-sm border-zinc-300 rounded-md text-black bg-white"
                                        value={terminationForm.fecha_baja}
                                        onChange={e => setTerminationForm({ ...terminationForm, fecha_baja: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-zinc-700 mb-1">Comentarios / Justificación</label>
                                    <textarea
                                        className="w-full text-sm border-zinc-300 rounded-md text-black bg-white h-24"
                                        placeholder="Detalles adicionales sobre la baja..."
                                        value={terminationForm.comentarios}
                                        onChange={e => setTerminationForm({ ...terminationForm, comentarios: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-end space-x-3">
                                <button
                                    onClick={() => setIsTerminationModalOpen(false)}
                                    className="px-4 py-2 border border-zinc-300 rounded-md text-sm text-zinc-600 hover:bg-zinc-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleTerminate}
                                    className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-bold hover:bg-red-700 shadow-sm"
                                >
                                    Enviar Solicitud de Baja
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }


        </div >
    )
}
