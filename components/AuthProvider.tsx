'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'

type Role = 'Administrativo' | 'Superintendente' | 'Jefe de Departamento' | string

interface AuthProfile {
    id: string
    nombre_completo: string
    rol: Role
    id_departamento?: string
}

interface AuthContextType {
    user: any | null
    profile: AuthProfile | null
    loading: boolean
    hasAccess: (allowedRoles: Role[]) => boolean
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    loading: true,
    hasAccess: () => false
})

export function useAuth() {
    return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<AuthProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [accessDenied, setAccessDenied] = useState(false)
    const pathname = usePathname()
    const router = useRouter()

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
                        let normalizedRol = profData.rol || 'Jefe de Departamento'
                        const rolLower = normalizedRol.toLowerCase()
                        if (rolLower.includes('admin')) normalizedRol = 'Administrativo'
                        else if (rolLower === 'jefe') normalizedRol = 'Jefe de Departamento'
                        else if (rolLower.includes('superintendente')) normalizedRol = 'Superintendente'
                        
                        setProfile({ ...profData, rol: normalizedRol } as AuthProfile)
                    } else {
                        // Create their profile dynamically in the database
                        const newProfile = {
                            id: session.user.id,
                            nombre_completo: session.user.user_metadata?.full_name || session.user.email || 'Usuario de Emergencia',
                            rol: 'Administrativo'
                        };
                        
                        // Attempt to insert
                        await supabase.from('perfiles').insert(newProfile);
                        
                        setProfile(newProfile as AuthProfile);
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
                router.push('/login')
            } else if (session) {
                fetchAuth()
            }
        })

        return () => {
            mounted = false
            listener.subscription.unsubscribe()
        }
    }, [router])

    const hasAccess = (allowedRoles: Role[]) => {
        if (!profile) return false
        return allowedRoles.includes(profile.rol)
    }

    // RBAC Route Guarding Logic
    useEffect(() => {
        if (loading || !profile) return
        
        let denied = false

        // Only Administrativos can manage Config, Usuarios, Catalogos
        if (pathname.startsWith('/configuracion') || pathname.startsWith('/usuarios') || pathname.startsWith('/catalogos')) {
            if (profile.rol !== 'Administrativo') denied = true
        }

        // Médico is restricted to only medical, profile, chat and inicio modules
        if (profile.rol === 'Médico') {
            const allowedMedicalPaths = [
                '/inicio', '/mi-perfil', '/chat', '/acerca-de', '/medico', '/consulta-medica'
            ]
            // If the pathname is not starting with any allowed paths, deny access
            const isAllowed = allowedMedicalPaths.some(p => pathname === p || pathname.startsWith(p + '/'))
            // If pathname is root / or similar, it redirects normally, but explicitly block HR/Operations paths
            const forbiddenPaths = [
                '/dashboard', '/empleados', '/solicitudes', '/autorizaciones', '/campamentos',
                '/logistica', '/evaluaciones', '/comedor', '/documentos'
            ]
            if (forbiddenPaths.some(p => pathname.startsWith(p))) {
                denied = true
            }
        }

        // Superintendentes and Admins can see everything else.
        // Jefes de Departamento are restricted.
        if (profile.rol === 'Jefe de Departamento') {
            // Can they see 'empleados/nuevo'? No, usually HR does that.
            if (pathname === '/empleados/nuevo') denied = true
            // Can they see 'reportes/prenomina'? Maybe only their own, but typically pre-nomina is global.
            // We'll allow Jefes to see pre-nomina but the UI itself will filter by their department automatically.
        }

        setAccessDenied(denied)

    }, [pathname, profile, loading])


    if (loading) {
        return <div className="flex h-screen items-center justify-center bg-slate-100"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div></div>
    }

    if (accessDenied) {
        return (
            <div className="flex flex-col h-screen items-center justify-center bg-slate-100 p-6 text-center">
                <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
                <h1 className="text-3xl font-black text-zinc-900 mb-2 uppercase">Acceso Denegado</h1>
                <p className="text-zinc-500 max-w-md">
                    Tu rol actual ({profile?.rol}) no tiene permisos para acceder a esta sección o dominio. Si crees que esto es un error, contacta al administrador.
                </p>
                <button 
                    onClick={() => { setAccessDenied(false); router.push('/inicio') }} 
                    className="mt-6 px-6 py-2 bg-black text-white font-bold rounded-md hover:bg-zinc-800"
                >
                    Volver al Inicio
                </button>
            </div>
        )
    }

    return (
        <AuthContext.Provider value={{ user, profile, loading, hasAccess }}>
            {children}
        </AuthContext.Provider>
    )
}
