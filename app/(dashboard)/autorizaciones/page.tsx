'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { CheckCircle, XCircle, Clock, Filter, Search, Calendar, User, FileText, ChevronRight } from 'lucide-react'
import Link from 'next/link'

type Request = {
    id_solicitud: string
    estatus: string
    creado_el: string
    cat_tipos_solicitud: {
        tipo_solicitud: string
    }
    empleados: {
        nombre: string
        apellido_paterno: string
        apellido_materno: string
        empleado_adscripciones: {
            cat_departamentos: {
                id_departamento: number
                departamento: string
            }
            cat_puestos: {
                puesto: string
            }
        }[]
    }
    payload: any // JSONB column
}

export default function AutorizacionesPage() {
    const [userProfile, setUserProfile] = useState<any>(null)
    const [departments, setDepartments] = useState<any[]>([])
    const [requests, setRequests] = useState<Request[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'Pendientes' | 'Historial'>('Pendientes')
    const [masterKey, setMasterKey] = useState<string | null>(null)

    useEffect(() => {
        fetchRequests()
        fetchDepartments()
        fetchUserProfile()
        fetchMasterKey()
    }, [])

    async function fetchMasterKey() {
        const { data } = await supabase.from('configuracion_empresa').select('clave_maestra').limit(1).single()
        if (data) setMasterKey(data.clave_maestra)
    }

    async function fetchUserProfile() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data } = await supabase
                .from('perfiles')
                .select('*, cat_departamentos(departamento)')
                .eq('id', user.id)
                .single()
            setUserProfile(data)
        }
    }

    async function fetchDepartments() {
        const { data } = await supabase.from('cat_departamentos').select('*').order('departamento')
        if (data) setDepartments(data)
    }

    async function handleQuickApprove(id: string, type: string, useMasterKey: boolean = false) {
        if (useMasterKey) {
            const key = prompt('Ingrese la Clave Maestra de Autorizaciones:')
            if (key !== masterKey) {
                alert('Clave incorrecta.')
                return
            }
        } else {
            if (!confirm(`¿Autorizar solicitud de ${type}?`)) return
        }

        const { error } = await supabase
            .from('solicitudes')
            .update({ 
                estatus: 'Aprobada por Jefe',
                id_autorizador: userProfile?.id || null 
            })
            .eq('id_solicitud', id)

        if (error) {
            alert('Error al autorizar: ' + error.message)
        } else {
            setRequests(current => current.map(r =>
                r.id_solicitud === id ? { ...r, estatus: 'Aprobada por Jefe' } : r
            ))
            fetchRequests()
        }
    }

    async function fetchRequests() {
        setLoading(true)
        const { data, error } = await supabase
            .from('solicitudes')
            .select(`
                *,
                cat_tipos_solicitud(tipo_solicitud),
                empleados!solicitudes_id_empleado_objetivo_fkey(
                    nombre, 
                    apellido_paterno, 
                    apellido_materno,
                    empleado_adscripciones(
                        cat_departamentos(id_departamento, departamento),
                        cat_puestos(puesto)
                    )
                )
            `)
            .order('creado_el', { ascending: false })

        if (!error && data) {
            setRequests(data)
        }
        setLoading(false)
    }

    // Role-based filter
    const roleFiltered = requests.filter(req => {
        if (!userProfile) return true // Show all while loading
        if (userProfile.rol === 'Administrativo') return true

        const empDeptId = req.empleados?.empleado_adscripciones?.[0]?.cat_departamentos?.id_departamento

        // Also check if the request is for this manager's department (Target Department)
        // This handles "Cambio de Adscripción" where the manager of the NEW department should approve.
        const targetDeptId = req.payload?.id_nuevo_departamento

        return empDeptId === userProfile.id_departamento || (targetDeptId && Number(targetDeptId) === userProfile.id_departamento)
    })

    const pendingRequests = roleFiltered.filter(r =>
        r.estatus === 'En revisión' ||
        r.estatus === 'Pendiente'
    )

    const historyRequests = roleFiltered.filter(r =>
        r.estatus !== 'En revisión' &&
        r.estatus !== 'Pendiente'
    )

    let displayedRequests = filter === 'Pendientes' ? pendingRequests : historyRequests

    const statsPending = pendingRequests.length

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Portal de Autorizaciones</h1>
                    <p className="text-zinc-500 mt-1">
                        {userProfile?.rol === 'Jefe'
                            ? `Gestionando departamento: ${userProfile.cat_departamentos?.departamento}`
                            : 'Gestión ejecutiva de solicitudes de personal.'}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
                    <div className="flex bg-zinc-100 p-1 rounded-lg">
                        <button
                            onClick={() => setFilter('Pendientes')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${filter === 'Pendientes' ? 'bg-white text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                        >
                            Por Autorizar
                            <span className="ml-2 bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full">{statsPending}</span>
                        </button>
                        <button
                            onClick={() => setFilter('Historial')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${filter === 'Historial' ? 'bg-white text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                        >
                            Historial
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            {filter === 'Pendientes' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-white to-zinc-50 p-6 rounded-xl border border-zinc-200 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-amber-100 rounded-lg">
                                <Clock className="w-6 h-6 text-amber-600" />
                            </div>
                            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded">Prioridad Alta</span>
                        </div>
                        <h3 className="text-2xl font-bold text-zinc-900">{statsPending}</h3>
                        <p className="text-sm text-zinc-500">Solicitudes pendientes de su firma</p>
                    </div>
                    <div className="bg-gradient-to-br from-white to-zinc-50 p-6 rounded-xl border border-zinc-200 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <FileText className="w-6 h-6 text-blue-600" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-zinc-900">{requests.filter(r => r.cat_tipos_solicitud?.tipo_solicitud === 'Vacaciones').length}</h3>
                        <p className="text-sm text-zinc-500">Solicitudes de Vacaciones este mes</p>
                    </div>
                    <div className="bg-gradient-to-br from-white to-zinc-50 p-6 rounded-xl border border-zinc-200 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <CheckCircle className="w-6 h-6 text-green-600" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-zinc-900">{historyRequests.filter(r => r.estatus === 'Ejecutada' || r.estatus === 'Autorizada RH').length}</h3>
                        <p className="text-sm text-zinc-500">Solicitudes procesadas exitosamente</p>
                    </div>
                </div>
            )}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {loading ? (
                    <div className="col-span-full text-center py-20 text-zinc-400">Cargando autorizaciones...</div>
                ) : displayedRequests.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 bg-zinc-50 rounded-xl border border-dashed border-zinc-300">
                        <CheckCircle className="w-12 h-12 text-zinc-300 mb-4" />
                        <h3 className="text-lg font-medium text-zinc-900">Todo al día</h3>
                        <p className="text-zinc-500">No hay solicitudes en esta bandeja.</p>
                    </div>
                ) : (
                    displayedRequests.map((req) => (
                        <Link
                            href={`/solicitudes/${req.id_solicitud}`}
                            key={req.id_solicitud}
                            className="group block bg-white rounded-xl border border-zinc-200 shadow-sm transition-all duration-200 overflow-hidden hover:shadow-md hover:border-zinc-300 cursor-pointer"
                        >
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="h-10 w-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-600 font-bold">
                                            {req.empleados?.nombre.charAt(0)}{req.empleados?.apellido_paterno.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-zinc-900 group-hover:text-blue-600 transition-colors">
                                                {req.empleados?.nombre} {req.empleados?.apellido_paterno}
                                            </h4>
                                            <p className="text-xs text-zinc-500">
                                                {req.empleados?.empleado_adscripciones?.[0]?.cat_puestos?.puesto || 'Puesto no asignado'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${req.estatus === 'En revisión' ? 'bg-amber-100 text-amber-800' :
                                        req.estatus === 'Autorizada RH' ? 'bg-blue-100 text-blue-800' :
                                            req.estatus === 'Ejecutada' ? 'bg-green-100 text-green-800' :
                                                'bg-zinc-100 text-zinc-600'
                                        }`}>
                                        {req.estatus}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center text-sm text-zinc-600 bg-zinc-50 p-2 rounded">
                                        <FileText className="w-4 h-4 mr-2 text-zinc-400" />
                                        <span className="font-medium">{req.cat_tipos_solicitud?.tipo_solicitud}</span>
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-100">
                                        <span className="flex items-center">
                                            <Calendar className="w-3 h-3 mr-1" />
                                            {new Date(req.creado_el).toLocaleDateString()}
                                        </span>

                                        <div className="flex items-center space-x-2">
                                            {/* Autorizar button based on status and role */}
                                            {(req.estatus === 'En revisión' || req.estatus === 'Pendiente') && (
                                                <div className="flex space-x-1 z-10">
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault()
                                                            e.stopPropagation()
                                                            handleQuickApprove(req.id_solicitud, req.cat_tipos_solicitud?.tipo_solicitud)
                                                        }}
                                                        className="px-3 py-1 bg-black text-white rounded text-xs font-bold hover:bg-zinc-800 transition-colors shadow-sm"
                                                    >
                                                        AUTORIZAR
                                                    </button>
                                                    {userProfile?.rol === 'Administrativo' && masterKey && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                                handleQuickApprove(req.id_solicitud, req.cat_tipos_solicitud?.tipo_solicitud, true)
                                                            }}
                                                            className="px-3 py-1 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700 transition-colors shadow-sm"
                                                            title="Forzar Autorización con Clave Maestra"
                                                        >
                                                            FORZAR (MAESTRA)
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            <span className="flex items-center text-blue-600 font-medium group-hover:translate-x-1 transition-transform">
                                                Ver <ChevronRight className="w-3 h-3 ml-1" />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="h-1 w-full bg-gradient-to-r from-transparent via-zinc-200 to-transparent transition-all opacity-50 group-hover:via-blue-400"></div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    )
}
