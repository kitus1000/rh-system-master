'use client'

import { useRef, useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/utils/supabase/client'
import { ArrowLeft, User, Briefcase, FileText, AlertTriangle, Edit, X, MapPin, CreditCard, ShieldCheck, Home, FolderLock, QrCode, ArrowLeftRight, HardHat } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { AdscripcionesManager } from '@/components/AdscripcionesManager'
import { TurnoRolManager } from '@/components/TurnoRolManager'
import { IncidenciasManager } from '@/components/IncidenciasManager'
import { VacationBalanceManager } from '@/components/VacationBalanceManager'
import CapturaFotoEmpleado from '@/components/CapturaFotoEmpleado'
import { canonicalizeDepartment, invertEmployeeNameFields } from '@/utils/dataNormalization'
import { TrayectoriaMinaHistorial } from '@/components/TrayectoriaMinaHistorial'

export default function EmpleadoDetallePage() {
    const params = useParams()
    const id = params.id as string
    const { profile: authProfile } = useAuth()
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
    const [externalFeed, setExternalFeed] = useState<{
        pases: any[]
        consultas: any[]
        camas: any[]
        comedor: any[]
        viajes: any[]
    }>({ pases: [], consultas: [], camas: [], comedor: [], viajes: [] })

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const tabParam = new URLSearchParams(window.location.search).get('tab')
            if (tabParam && ['perfil', 'trayectoria', 'historial', 'incidencias', 'vacaciones', 'actividad_externa', 'documentos'].includes(tabParam)) {
                setActiveTab(tabParam)
            }
        }
    }, [])

    useEffect(() => {
        checkPermissions()
        fetchEmpleado()
        fetchCatalogs()
        fetchExternalFeed()
    }, [id])

    async function fetchExternalFeed() {
        if (!id) return
        try {
            const [pasesRes, consRes, camasRes, comRes, repRes] = await Promise.all([
                supabase.from('pases_medicos').select('*').eq('id_empleado', id).order('creado_el', { ascending: false }).limit(10),
                supabase.from('consultas_medicas').select('*').eq('id_empleado', id).order('fecha', { ascending: false }).limit(10),
                supabase.from('campamento_camas').select('id_cama, numero, estatus_lavado, campamento_cuartos(nombre, campamentos(nombre, zona))').eq('id_empleado', id),
                supabase.from('comedor_registros').select('*').eq('id_empleado', id).order('creado_el', { ascending: false }).limit(20),
                supabase.from('logistica_reportes_diarios').select('id_reporte, fecha, camion_numero, punto_a, punto_b, pasajeros_lista, creado_el').order('creado_el', { ascending: false }).limit(40)
            ])

            const empViajes = (repRes.data || []).filter((r: any) =>
                Array.isArray(r.pasajeros_lista) && r.pasajeros_lista.some((p: any) => p.id === id)
            )

            setExternalFeed({
                pases: pasesRes.data || [],
                consultas: consRes.data || [],
                camas: camasRes.data || [],
                comedor: comRes.data || [],
                viajes: empViajes
            })
        } catch (e) {
            console.warn('Error loading external feed for employee:', e)
        }
    }

    async function checkPermissions() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data: profile } = await supabase
                .from('perfiles')
                .select('rol, cat_departamentos(departamento)')
                .eq('id', user.id)
                .single()

            if (profile) {
                const role = (profile.rol || '').toUpperCase()
                const isAdminOrHR =
                    role.includes('ADMIN') ||
                    role.includes('SISTEMAS') ||
                    role.includes('RECURSOS HUMANOS') ||
                    role.includes('RH')
                // @ts-ignore
                const deptName = profile.cat_departamentos?.departamento || (Array.isArray(profile.cat_departamentos) ? profile.cat_departamentos[0]?.departamento : '')
                const isHRDept = canonicalizeDepartment(deptName).canonicalKey === 'RECURSOS_HUMANOS'
                setCanManage(isAdminOrHR || isHRDept)
            }
        }
    }

    async function handleQuickInvertProfileName() {
        if (!empleado) return
        const swapped = invertEmployeeNameFields({
            nombre: empleado.nombre || '',
            apellido_paterno: empleado.apellido_paterno || '',
            apellido_materno: empleado.apellido_materno || '',
        })
        if (!confirm(`¿Invertir el nombre de este trabajador a:\n\nNombre(s): ${swapped.nombre}\nApellido Paterno: ${swapped.apellido_paterno}\nApellido Materno: ${swapped.apellido_materno}?`)) return
        const { error } = await supabase
            .from('empleados')
            .update({
                nombre: swapped.nombre.toUpperCase(),
                apellido_paterno: swapped.apellido_paterno.toUpperCase(),
                apellido_materno: swapped.apellido_materno ? swapped.apellido_materno.toUpperCase() : null,
            })
            .eq('id_empleado', id)
        if (!error) fetchEmpleado()
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

        let res = await supabase
            .from('empleados')
            .select(`
            *,
            empleado_domicilio(*),
            empleado_ingreso(*),
            empleado_banco(*),
            empleado_salarios(*),
            empleado_adscripciones(
                fecha_inicio,
                fecha_fin,
                es_jefe,
                cat_departamentos(departamento),
                cat_puestos(puesto)
            ),
            turnos(nombre)
        `)
            .eq('id_empleado', id)
            .single()

        if (res.error) {
            res = await supabase
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
        }

        const { data, error } = res

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
                id_turno: data.id_turno || '',
                // Puesto y Departamento resueltos
                puesto: data.puesto || data.empleado_adscripciones?.[0]?.cat_puestos?.puesto || '',
                departamento: data.departamento || data.empleado_adscripciones?.[0]?.cat_departamentos?.departamento || ''
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
                    puesto: editForm.puesto || null,
                    departamento: editForm.departamento || null,
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

    const adsArray = Array.isArray(empleado.empleado_adscripciones)
        ? [...empleado.empleado_adscripciones].sort(
              (a: any, b: any) => new Date(b.fecha_inicio || 0).getTime() - new Date(a.fecha_inicio || 0).getTime()
          )
        : []
    const latestAdscripcion = adsArray[0]
    const rawDepto = empleado.departamento || latestAdscripcion?.cat_departamentos?.departamento || ''
    const resolvedDepartamento = canonicalizeDepartment(rawDepto).officialName
    const resolvedPuesto = empleado.puesto || latestAdscripcion?.cat_puestos?.puesto || 'Sin puesto asignado'

    const authRolUpper = (authProfile?.rol || '').toUpperCase()
    const canEvaluateTrayectoria =
        canManage ||
        authRolUpper.includes('JEFE') ||
        authRolUpper.includes('SUPERINTENDENTE') ||
        authRolUpper.includes('SUPERVISOR') ||
        authRolUpper.includes('ADMIN') ||
        authRolUpper.includes('RECURSOS') ||
        authRolUpper.includes('RH') ||
        authRolUpper.includes('SISTEMAS')

    return (
        <div className="max-w-7xl mx-auto relative space-y-5">
            {/* Header Responsivo */}
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/empleados" className="p-2 rounded-full hover:bg-zinc-100 transition-colors shrink-0">
                        <ArrowLeft className="h-5 w-5 text-zinc-600" />
                    </Link>
                    {empleado.foto_url ? (
                        <img src={empleado.foto_url} alt="Foto" className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl object-cover border border-zinc-200 shadow-sm shrink-0" />
                    ) : (
                        <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-zinc-900 text-amber-400 flex items-center justify-center border border-zinc-700 shadow-sm shrink-0">
                            <User className="h-7 w-7" />
                        </div>
                    )}
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 uppercase">
                                {empleado.nombre} {empleado.apellido_paterno} {empleado.apellido_materno || ''}
                            </h1>
                            <button
                                type="button"
                                onClick={handleQuickInvertProfileName}
                                className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-amber-100 text-zinc-700 hover:text-amber-900 text-[11px] font-black flex items-center gap-1 cursor-pointer border border-zinc-200"
                                title="Invertir Nombre <-> Apellidos si fue capturado al revés"
                            >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                                <span>⇄ Invertir Nombre</span>
                            </button>
                        </div>
                        <p className="text-xs sm:text-sm text-zinc-500 font-semibold mt-0.5">
                            Ficha #{empleado.numero_empleado} •{' '}
                            <span className="font-bold text-zinc-800">
                                {resolvedDepartamento}
                            </span>{' '}
                            •{' '}
                            <span className="font-bold text-amber-700">
                                {resolvedPuesto}
                            </span>{' '}
                            •{' '}
                            <span className={isBaja ? 'text-rose-600 font-black' : 'text-emerald-600 font-black'}>
                                {empleado.estado_empleado}
                            </span>
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {canManage && isBaja && (
                        <button
                            onClick={() => setIsRehireModalOpen(true)}
                            className="flex items-center px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-black text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                        >
                            <User className="w-4 h-4 mr-1.5" />
                            Recontratar
                        </button>
                    )}

                    {!isBaja && (
                        <>
                            {canManage && (
                                <button
                                    onClick={() => setIsTerminationModalOpen(true)}
                                    className="flex items-center px-3.5 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs font-black text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                                >
                                    <AlertTriangle className="w-4 h-4 mr-1.5" />
                                    Dar de Baja
                                </button>
                            )}
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-black hover:bg-zinc-800 shadow-sm transition-colors cursor-pointer"
                            >
                                <Edit className="w-4 h-4 mr-1.5 text-amber-400" />
                                Editar Perfil
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Barra de Conexión Directa (Pasos siguientes del trabajador: Inducción -> Campamento -> Locker -> Credencial) */}
            <div className="bg-zinc-950 text-white p-4 rounded-2xl border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="text-xs">
                    <span className="text-amber-400 font-black uppercase tracking-wider block">
                        🔗 Flujo Operativo Conectado del Trabajador
                    </span>
                    <span className="text-zinc-400 text-[11px]">
                        Envía o gestiona directamente a este trabajador en los módulos operativos de la unidad:
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        href={`/seguridad?emp=${id}`}
                        className="px-3 py-2 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300 text-xs font-black flex items-center gap-1.5"
                    >
                        <ShieldCheck className="w-4 h-4 text-orange-400" />
                        <span>1. Inducción Seguridad</span>
                    </Link>
                    <Link
                        href={`/campamentos?emp=${id}`}
                        className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-black flex items-center gap-1.5"
                    >
                        <Home className="w-4 h-4 text-emerald-400" />
                        <span>2. Campamento / Cama</span>
                    </Link>
                    <Link
                        href={`/lockers?emp=${id}`}
                        className="px-3 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 text-xs font-black flex items-center gap-1.5"
                    >
                        <FolderLock className="w-4 h-4 text-blue-400" />
                        <span>3. Casillero / Locker QR</span>
                    </Link>
                    <Link
                        href={`/empleados/credenciales?emp=${id}`}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black flex items-center gap-1.5 shadow-md"
                    >
                        <QrCode className="w-4 h-4" />
                        <span>4. Imprimir Credencial QR</span>
                    </Link>
                    <button
                        type="button"
                        onClick={() => setActiveTab('trayectoria')}
                        className="px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/50 text-indigo-200 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                        <HardHat className="w-4 h-4 text-amber-400" />
                        <span>5. ♟️ Trayectoria en Mina</span>
                    </button>
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
                    {[
                        { id: 'perfil', label: 'Perfil' },
                        { id: 'trayectoria', label: '♟️ Trayectoria en Mina & Escalafón' },
                        { id: 'historial', label: 'Historial' },
                        { id: 'incidencias', label: 'Incidencias' },
                        { id: 'vacaciones', label: 'Vacaciones' },
                        { id: 'actividad_externa', label: 'Pulso Externo (Médico / Campamento / Comedor / Choferes)' },
                        { id: 'documentos', label: 'Documentos' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                                ${activeTab === tab.id
                                    ? 'border-black text-black'
                                    : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'}
                            `}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content: Perfil */}
            {activeTab === 'perfil' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                    <div className="space-y-6">
                        {/* 📸 FOTO PARA RECONOCIMIENTO FACIAL */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-indigo-200 col-span-2">
                            <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
                                <span className="text-lg">📸</span> Foto para Reconocimiento Facial
                                <span className="text-xs font-normal text-zinc-400 ml-2">(Necesaria para identificar al empleado en el camión)</span>
                            </h3>
                            <CapturaFotoEmpleado
                                idEmpleado={id}
                                nombreEmpleado={`${empleado.nombre} ${empleado.apellido_paterno} ${empleado.apellido_materno || ''}`}
                                fotoActual={empleado.foto_url}
                                onFotoGuardada={(url) => setEmpleado((prev: any) => ({ ...prev, foto_url: url }))}
                            />
                        </div>
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
                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <dt className="text-xs font-medium text-zinc-500">Puesto Oficial Actual</dt>
                                    <dd className="text-sm font-black text-zinc-900">
                                        {resolvedPuesto}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-zinc-500">Departamento Actual</dt>
                                    <dd className="text-sm font-black text-zinc-900">
                                        {resolvedDepartamento}
                                    </dd>
                                </div>
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

                    {/* Resumen de Trayectoria en Mina visible directo en la vista principal del Expediente */}
                    <div className="md:col-span-2 pt-2">
                        <TrayectoriaMinaHistorial
                            compact={true}
                            viewerMode="admin"
                            idEmpleado={id}
                            numeroEmpleado={empleado?.numero_empleado}
                            nombreEmpleado={empleado ? `${empleado.nombre} ${empleado.apellido_paterno} ${empleado.apellido_materno || ''}`.trim() : ''}
                            puestoActual={resolvedPuesto}
                            departamentoActual={resolvedDepartamento}
                            fechaIngreso={ingreso?.fecha_ingreso || empleado?.fecha_ingreso}
                            canManage={canEvaluateTrayectoria}
                            currentUserRole={authProfile?.rol || 'Recursos Humanos'}
                            currentUserName={authProfile?.nombre_completo || 'Jefatura / RH'}
                            onOpenFullView={() => setActiveTab('trayectoria')}
                            onPuestoActualizado={(nuevoPuesto, nuevoDepto) => {
                                setEmpleado((prev: any) => prev ? { ...prev, puesto: nuevoPuesto, departamento: nuevoDepto } : prev);
                                fetchEmpleado();
                            }}
                        />
                    </div>
                </div>
            )}

            {activeTab === 'trayectoria' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <TrayectoriaMinaHistorial
                        viewerMode="admin"
                        idEmpleado={id}
                        numeroEmpleado={empleado?.numero_empleado}
                        nombreEmpleado={empleado ? `${empleado.nombre} ${empleado.apellido_paterno} ${empleado.apellido_materno || ''}`.trim() : ''}
                        puestoActual={resolvedPuesto}
                        departamentoActual={resolvedDepartamento}
                        fechaIngreso={ingreso?.fecha_ingreso || empleado?.fecha_ingreso}
                        canManage={canEvaluateTrayectoria}
                        currentUserRole={authProfile?.rol || 'Recursos Humanos'}
                        currentUserName={authProfile?.nombre_completo || 'Jefatura / RH'}
                        onPuestoActualizado={(nuevoPuesto, nuevoDepto) => {
                            setEmpleado((prev: any) => prev ? { ...prev, puesto: nuevoPuesto, departamento: nuevoDepto } : prev);
                            fetchEmpleado();
                        }}
                    />
                </div>
            )}

            {activeTab === 'historial' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h4 className="text-sm font-black text-zinc-900">
                                ♟️ Historial de Escalafón, Calificaciones y Trayectoria en Mina
                            </h4>
                            <p className="text-xs text-zinc-600">
                                Consulta la línea de tiempo completa de ascensos sindicales, días acumulados y evaluaciones por departamento.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setActiveTab('trayectoria')}
                            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-400 text-xs font-black shrink-0 cursor-pointer"
                        >
                            Ir a ♟️ Trayectoria en Mina y Calificaciones &rarr;
                        </button>
                    </div>
                    <TurnoRolManager idEmpleado={id} isReadOnly={isBaja} />
                    <AdscripcionesManager idEmpleado={id} isReadOnly={isBaja} onSaved={() => fetchEmpleado()} />
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

            {activeTab === 'actividad_externa' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                    {/* Pases Médicos & Consultas */}
                    <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm space-y-3">
                        <h3 className="font-bold text-sm uppercase text-zinc-900">Clínica Médica (Pases y Consultas)</h3>
                        {externalFeed.pases.map((p: any) => (
                            <div key={p.id_pase} className="p-3 bg-rose-50/50 border border-rose-200 rounded-lg text-xs">
                                <div className="flex justify-between font-bold text-zinc-900">
                                    <span>Pase {p.folio || p.id_pase.slice(0, 8)}</span>
                                    <span>{p.estatus}</span>
                                </div>
                                <p className="text-zinc-600 mt-0.5">{p.motivo || 'Atención médica'} • Salida: {p.fecha_salida || '—'} • Retorno: {p.fecha_retorno || '—'}</p>
                            </div>
                        ))}
                        {externalFeed.pases.length === 0 && externalFeed.consultas.length === 0 && (
                            <p className="text-xs text-zinc-400">Sin pases médicos o consultas registradas.</p>
                        )}
                    </div>

                    {/* Campamento */}
                    <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm space-y-3">
                        <h3 className="font-bold text-sm uppercase text-zinc-900">Campamentos (Alojamiento Actual)</h3>
                        {externalFeed.camas.map((c: any) => (
                            <div key={c.id_cama} className="p-3 bg-teal-50/50 border border-teal-200 rounded-lg text-xs">
                                <p className="font-bold text-zinc-900">
                                    {c.campamento_cuartos?.campamentos?.nombre || 'Campamento'} — Cuarto {c.campamento_cuartos?.nombre || ''} — Cama #{c.numero}
                                </p>
                                <p className="text-zinc-600 mt-0.5">Zona: {c.campamento_cuartos?.campamentos?.zona || 'Parajes'} • Lavandería: {c.estatus_lavado}</p>
                            </div>
                        ))}
                        {externalFeed.camas.length === 0 && <p className="text-xs text-zinc-400">Sin cama asignada actualmente en campamento.</p>}
                    </div>

                    {/* Comedor */}
                    <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-sm uppercase text-zinc-900">Comedor (Últimos Consumos)</h3>
                            <span className="text-xs font-bold text-emerald-700">
                                Total: ${externalFeed.comedor.reduce((a: number, r: any) => a + Number(r.costo || 0), 0).toFixed(0)} MXN
                            </span>
                        </div>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto">
                            {externalFeed.comedor.map((r: any) => (
                                <div key={r.id_registro} className="flex justify-between text-xs p-2 bg-zinc-50 rounded border border-zinc-100">
                                    <span>{r.fecha} {r.hora} — <strong>{r.servicio}</strong></span>
                                    <span className="font-bold">${Number(r.costo).toFixed(0)}</span>
                                </div>
                            ))}
                            {externalFeed.comedor.length === 0 && <p className="text-xs text-zinc-400">Sin consumos registrados en comedor.</p>}
                        </div>
                    </div>

                    {/* Choferes / Movilidad */}
                    <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm space-y-3">
                        <h3 className="font-bold text-sm uppercase text-zinc-900">Movilidad Choferes (Abordajes QR)</h3>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto">
                            {externalFeed.viajes.map((v: any) => (
                                <div key={v.id_reporte} className="flex justify-between text-xs p-2 bg-purple-50/50 rounded border border-purple-200">
                                    <span>{v.fecha} — Unidad <strong>{v.camion_numero}</strong></span>
                                    <span>{v.punto_a || 'Origen'} → {v.punto_b || 'Destino'}</span>
                                </div>
                            ))}
                            {externalFeed.viajes.length === 0 && <p className="text-xs text-zinc-400">Sin abordajes QR registrados recientemente.</p>}
                        </div>
                    </div>
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
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Puesto Oficial Actual</label>
                                            <input type="text" className="w-full text-sm border-zinc-300 rounded-md text-black bg-white uppercase" value={editForm.puesto || ''} onChange={e => setEditForm({ ...editForm, puesto: e.target.value })} placeholder="Ej. PERFORISTA 1RA" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-500 mb-1">Departamento Actual</label>
                                            <input type="text" className="w-full text-sm border-zinc-300 rounded-md text-black bg-white uppercase" value={editForm.departamento || ''} onChange={e => setEditForm({ ...editForm, departamento: e.target.value })} placeholder="Ej. MINA" />
                                        </div>
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
