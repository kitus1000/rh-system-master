'use client'

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { TEST_AUTH_LEVELS, getTestAuthLevel, type TestAuthLevel } from '@/utils/testAuthLevels'

type Role = 'Administrativo' | 'Superintendente' | 'Jefe de Departamento' | string

interface AuthProfile {
    id: string
    nombre_completo: string
    rol: Role
    email?: string
    id_departamento?: string
    departamento_simulado?: string
    departamentos_autorizados?: string[]
    id_empresa_contratista?: string | null
}

interface AuthContextType {
    user: any | null
    profile: AuthProfile | null
    realProfile: AuthProfile | null
    loading: boolean
    hasAccess: (allowedRoles: Role[]) => boolean
    testLevelId: string
    activeTestLevel: TestAuthLevel
    isTestModeActive: boolean
    setTestLevel: (levelId: string) => void
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    realProfile: null,
    loading: true,
    hasAccess: () => false,
    testLevelId: 'REAL_SESSION',
    activeTestLevel: TEST_AUTH_LEVELS[0],
    isTestModeActive: false,
    setTestLevel: () => {}
})

export function useAuth() {
    return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<AuthProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [accessDenied, setAccessDenied] = useState(false)
    const [testLevelId, setTestLevelId] = useState<string>('REAL_SESSION')
    const pathname = usePathname()
    const router = useRouter()

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('bacis_test_auth_level')
            if (saved && TEST_AUTH_LEVELS.some((l) => l.id === saved)) {
                setTestLevelId(saved)
            }
        }
    }, [])

    const setTestLevel = (levelId: string) => {
        const valid = TEST_AUTH_LEVELS.some((l) => l.id === levelId) ? levelId : 'REAL_SESSION'
        setTestLevelId(valid)
        if (typeof window !== 'undefined') {
            localStorage.setItem('bacis_test_auth_level', valid)
            window.dispatchEvent(new CustomEvent('bacis-test-level-change', { detail: valid }))
        }
    }

    useEffect(() => {
        let mounted = true
        async function fetchAuth() {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (!session) {
                    if (mounted) {
                        setUser(null)
                        setProfile(null)
                        setLoading(false)
                    }
                    return
                }

                if (mounted) setUser(session.user)

                // Fetch Profile
                const { data: profData } = await supabase
                    .from('perfiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single()

                if (mounted) {
                    if (profData) {
                        const metaRol = (session.user.user_metadata?.rol || '') as string
                        const metaEmpresa = (session.user.user_metadata?.id_empresa_contratista || null) as string | null
                        let normalizedRol = profData.rol || metaRol || 'Jefe de Departamento'
                        const rolLower = normalizedRol.toLowerCase()
                        const metaRolLower = metaRol.toLowerCase()
                        const nameLower = (profData.nombre_completo || '').toLowerCase()
                        const isChoferName = nameLower.includes('pinales') || nameLower.includes('yañez') || nameLower.includes('yanez') || nameLower.includes('vazquez') || nameLower.includes('linares') || nameLower.includes('madriles') || nameLower.includes('saucedo') || nameLower.includes('chofer')
                        if (rolLower.includes('contratista') || metaRolLower.includes('contratista') || nameLower.includes('(contratista)')) normalizedRol = 'Contratista'
                        else if (rolLower.includes('corporativo') || metaRolLower.includes('corporativo') || nameLower.includes('(rh corporativo)')) normalizedRol = 'Superintendente de RH Corporativo'
                        else if (rolLower.includes('jefe de rh unidad') || rolLower.includes('rh unidad') || metaRolLower.includes('rh unidad') || nameLower.includes('(jefe rh unidad)')) normalizedRol = 'Jefe de RH Unidad'
                        else if (rolLower.includes('sindicato') || metaRolLower.includes('sindicato') || nameLower.includes('(sindicato)')) normalizedRol = 'Sindicato'
                        else if (rolLower === 'jefe' || rolLower.includes('jefe de departamento')) normalizedRol = 'Jefe de Departamento'
                        else if (rolLower.includes('caseta') || rolLower.includes('patrimonial') || metaRolLower.includes('caseta') || metaRolLower.includes('patrimonial') || nameLower.includes('(caseta)')) normalizedRol = 'Caseta'
                        else if (rolLower.includes('seguridad') || metaRolLower.includes('seguridad') || nameLower.includes('(seguridad)')) normalizedRol = 'Seguridad Industrial'
                        else if (rolLower.includes('chofer') || rolLower.includes('conductor') || rolLower.includes('operador') || isChoferName) normalizedRol = 'Chofer'
                        else if (rolLower.includes('jefe médico') || rolLower.includes('jefe medico') || nameLower.includes('jefe médico') || nameLower.includes('jefe medico')) normalizedRol = 'Jefe Médico'
                        else if (rolLower.includes('médico') || rolLower.includes('medico') || nameLower.includes('médico') || nameLower.includes('medico')) normalizedRol = 'Médico'
                        else if (rolLower.includes('campamento') || rolLower.includes('comedor') || rolLower.includes('encargado de campamento') || metaRolLower.includes('campamento') || nameLower.includes('(campamento y comedor)')) normalizedRol = 'Encargado de Campamento y Comedor'
                        else if (rolLower.includes('recursos humanos')) normalizedRol = 'Recursos Humanos'
                        else if (rolLower.includes('admin')) normalizedRol = 'Administrativo'
                        else if (rolLower.includes('superintendente')) normalizedRol = 'Superintendente'
                        else if (rolLower.includes('supervisor')) normalizedRol = 'Supervisor'
                        
                        setProfile({
                            ...profData,
                            email: session.user.email || profData.email,
                            rol: normalizedRol,
                            id_empresa_contratista: profData.id_empresa_contratista || metaEmpresa
                        } as AuthProfile)
                    } else {
                        const newProfile = {
                            id: session.user.id,
                            nombre_completo: session.user.user_metadata?.full_name || session.user.email || 'Usuario de Emergencia',
                            rol: 'Administrativo'
                        }
                        await supabase.from('perfiles').insert(newProfile)
                        setProfile({
                            ...newProfile,
                            email: session.user.email,
                        } as AuthProfile)
                    }
                }
            } catch (err) {
                console.error("Auth error:", err)
            } finally {
                if (mounted) setLoading(false)
            }
        }

        fetchAuth()

        const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT') {
                setUser(null)
                setProfile(null)
                router.push('/')
            } else if (session) {
                fetchAuth()
            }
        })

        return () => {
            mounted = false
            listener.subscription.unsubscribe()
        }
    }, [router])

    const activeTestLevel = useMemo(() => getTestAuthLevel(testLevelId), [testLevelId])
    const isTestModeActive = testLevelId !== 'REAL_SESSION'

    // Usuario y perfil efectivos (toman el nivel de prueba cuando se activa la simulación Multi-Vista)
    const effectiveUser = useMemo(() => {
        if (!user) return null
        if (!isTestModeActive) return user
        return {
            ...user,
            email: activeTestLevel.email || user.email,
            user_metadata: {
                ...(user.user_metadata || {}),
                full_name: activeTestLevel.nombre_completo,
                rol: activeTestLevel.rol,
                departamento: activeTestLevel.departamento,
            },
        }
    }, [user, isTestModeActive, activeTestLevel])

    const effectiveProfile = useMemo<AuthProfile | null>(() => {
        if (!profile) return null
        if (!isTestModeActive) return profile
        return {
            ...profile,
            nombre_completo: activeTestLevel.nombre_completo,
            rol: activeTestLevel.rol,
            email: activeTestLevel.email || profile.email,
            departamento_simulado: activeTestLevel.departamento,
        }
    }, [profile, isTestModeActive, activeTestLevel])

    const hasAccess = (allowedRoles: Role[]) => {
        if (isTestModeActive) return true
        if (!effectiveProfile) return false
        const userRolLower = (effectiveProfile.rol || '').toLowerCase()
        return allowedRoles.some(r => {
            const rLower = r.toLowerCase()
            if (rLower === userRolLower) return true
            if (userRolLower === 'supervisor' && rLower === 'jefe de departamento') return true
            if ((userRolLower.includes('médic') || userRolLower.includes('medic') || userRolLower.includes('doctor')) && 
                (rLower.includes('médic') || rLower.includes('medic'))) return true
            return false
        })
    }

    // RBAC Route Guarding Logic
    useEffect(() => {
        if (loading || !effectiveProfile || !pathname) return

        // En Modo Prueba multi-vista permitimos recorrer libremente todos los portales para probar autorizaciones
        if (isTestModeActive) {
            setAccessDenied(false)
            return
        }
        
        let denied = false

        if (effectiveProfile.rol === 'Contratista') {
            const allowedContratistaPaths = ['/contratistas-portal', '/mi-perfil']
            const isAllowed = allowedContratistaPaths.some(p => pathname === p || pathname.startsWith(p + '/'))
            if (!isAllowed) denied = true
        }

        if (effectiveProfile.rol === 'Seguridad Industrial' || effectiveProfile.rol === 'Seguridad') {
            const allowedSeguridadPaths = ['/seguridad', '/autorizaciones', '/mi-perfil', '/acerca-de']
            const isAllowed = allowedSeguridadPaths.some(p => pathname === p || pathname.startsWith(p + '/'))
            if (!isAllowed) denied = true
        }

        if (effectiveProfile.rol === 'Caseta' || effectiveProfile.rol === 'Seguridad Patrimonial') {
            const allowedCasetaPaths = ['/caseta', '/mi-perfil', '/acerca-de']
            const isAllowed = allowedCasetaPaths.some(p => pathname === p || pathname.startsWith(p + '/'))
            if (!isAllowed) denied = true
        }

        if (effectiveProfile.rol === 'Chofer') {
            const allowedChoferPaths = ['/logistica/choferes', '/mi-perfil']
            const isAllowed = allowedChoferPaths.some(p => pathname === p || pathname.startsWith(p + '/'))
            if (!isAllowed) denied = true
        }

        if (effectiveProfile.rol === 'Encargado de Campamento y Comedor') {
            const allowedCampComedorPaths = ['/campamentos', '/comedor', '/autorizaciones', '/mi-perfil', '/acerca-de']
            const isAllowed = allowedCampComedorPaths.some(p => pathname === p || pathname.startsWith(p + '/'))
            if (!isAllowed) denied = true
        }

        if (effectiveProfile.rol === 'Sindicato') {
            const allowedSindicatoPaths = ['/movimientos-sindicato', '/autorizaciones', '/mi-perfil', '/chat', '/acerca-de']
            const isAllowed = allowedSindicatoPaths.some(p => pathname === p || pathname.startsWith(p + '/'))
            if (!isAllowed) denied = true
        }

        if (effectiveProfile.rol === 'Jefe de RH Unidad' || effectiveProfile.rol === 'Superintendente de RH Corporativo') {
            const allowedRHExecutivePaths = [
                '/movimientos-sindicato', '/mi-departamento', '/integracion-rh', '/contratistas',
                '/empleados', '/autorizaciones', '/dashboard', '/inicio', '/mi-perfil', '/chat',
                '/reportes/prenomina', '/consulta-medica', '/solicitudes', '/calendario', '/acerca-de'
            ]
            const isAllowed = allowedRHExecutivePaths.some(p => pathname === p || pathname.startsWith(p + '/'))
            if (!isAllowed) denied = true
        }

        if (pathname.startsWith('/configuracion') || pathname.startsWith('/usuarios') || pathname.startsWith('/catalogos')) {
            if (effectiveProfile.rol !== 'Administrativo' && effectiveProfile.rol !== 'Recursos Humanos' && effectiveProfile.rol !== 'Sistemas') denied = true
        }
        if (pathname.startsWith('/integracion-rh')) {
            if (
                effectiveProfile.rol !== 'Administrativo' &&
                effectiveProfile.rol !== 'Recursos Humanos' &&
                effectiveProfile.rol !== 'Sistemas' &&
                effectiveProfile.rol !== 'Jefe de RH Unidad' &&
                effectiveProfile.rol !== 'Superintendente de RH Corporativo'
            ) {
                denied = true
            }
        }

        const isDoctor = effectiveProfile.rol === 'Médico' || effectiveProfile.rol === 'Jefe Médico' || 
                         (effectiveProfile.rol || '').toLowerCase().includes('médic') || 
                         (effectiveProfile.rol || '').toLowerCase().includes('medic')
        
        if (isDoctor) {
            const allowedMedicalPaths = [
                '/inicio', '/mi-perfil', '/chat', '/acerca-de', '/medico', '/consulta-medica', '/autorizaciones'
            ]
            const isAllowed = allowedMedicalPaths.some(p => pathname === p || pathname.startsWith(p + '/'))
            if (!isAllowed) denied = true
        }

        if (effectiveProfile.rol === 'Jefe de Departamento') {
            if (pathname === '/empleados/nuevo') denied = true
        }

        setAccessDenied(denied)

    }, [pathname, effectiveProfile, loading, isTestModeActive])


    if (loading) {
        return <div className="flex h-screen items-center justify-center bg-slate-100"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div></div>
    }

    if (accessDenied) {
        return (
            <div className="flex flex-col h-screen items-center justify-center bg-slate-100 p-6 text-center">
                <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
                <h1 className="text-3xl font-black text-zinc-900 mb-2 uppercase">Acceso Denegado</h1>
                <p className="text-zinc-500 max-w-md">
                    Tu rol actual ({effectiveProfile?.rol}) no tiene permisos para acceder a esta sección o dominio. Si crees que esto es un error, contacta al administrador.
                </p>
                <button 
                    onClick={() => {
                        setAccessDenied(false)
                        if (effectiveProfile?.rol === 'Contratista') router.push('/contratistas-portal')
                        else if (effectiveProfile?.rol === 'Caseta' || effectiveProfile?.rol === 'Seguridad Patrimonial') router.push('/caseta')
                        else if (effectiveProfile?.rol === 'Seguridad Industrial' || effectiveProfile?.rol === 'Seguridad') router.push('/seguridad')
                        else if (effectiveProfile?.rol === 'Chofer') router.push('/logistica/choferes')
                        else if (effectiveProfile?.rol === 'Encargado de Campamento y Comedor') router.push('/campamentos')
                        else if (effectiveProfile?.rol === 'Médico' || effectiveProfile?.rol === 'Jefe Médico') router.push('/medico/consultas')
                        else if (effectiveProfile?.rol === 'Jefe de Departamento' || effectiveProfile?.rol === 'Supervisor') router.push('/mi-departamento')
                        else if (
                            effectiveProfile?.rol === 'Sindicato' ||
                            effectiveProfile?.rol === 'Jefe de RH Unidad' ||
                            effectiveProfile?.rol === 'Superintendente de RH Corporativo'
                        ) router.push('/movimientos-sindicato')
                        else router.push('/inicio')
                    }} 
                    className="mt-6 px-6 py-2 bg-black text-white font-bold rounded-md hover:bg-zinc-800"
                >
                    Volver a mi Portal
                </button>
            </div>
        )
    }

    return (
        <AuthContext.Provider value={{
            user: effectiveUser,
            profile: effectiveProfile,
            realProfile: profile,
            loading,
            hasAccess,
            testLevelId,
            activeTestLevel,
            isTestModeActive,
            setTestLevel
        }}>
            {children}
        </AuthContext.Provider>
    )
}
