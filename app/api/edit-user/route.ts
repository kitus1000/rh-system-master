import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { userId, email, nombre_completo, rol, id_departamento, departamentos_autorizados, password } = body

        if (!userId) {
            return NextResponse.json({ error: 'Falta userId' }, { status: 400 })
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !serviceKey) {
            return NextResponse.json({ error: 'Configuración de Supabase incompleta.' }, { status: 500 })
        }

        const isServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ'))
        const supabaseClient = createClient(supabaseUrl, serviceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })

        // 1. Update auth.users (Email and/or Password) via Admin API
        if (isServiceRole) {
            const authUpdates: any = {}
            if (email && email.trim() !== '') {
                authUpdates.email = email.trim()
                authUpdates.email_confirm = true
            }
            if (password && password.trim() !== '') {
                if (password.length < 6) {
                    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
                }
                authUpdates.password = password.trim()
            }

            if (Object.keys(authUpdates).length > 0) {
                const { error: authError } = await supabaseClient.auth.admin.updateUserById(userId, authUpdates)
                if (authError) {
                    return NextResponse.json({ error: 'Error actualizando credenciales: ' + authError.message }, { status: 400 })
                }
            }
        }

        // 2. Update perfiles table
        const isChofer = rol === 'Chofer' || (rol && rol.toLowerCase().includes('chofer'))
        const finalNombre = isChofer && !nombre_completo.includes('(Chofer)') ? `${nombre_completo} (Chofer)` : nombre_completo

        const updatePayload: any = {
            nombre_completo: finalNombre,
            rol: isChofer ? 'Chofer' : rol,
            id_departamento: id_departamento || null,
            departamentos_autorizados: departamentos_autorizados || []
        }

        let { error: profileError } = await supabaseClient
            .from('perfiles')
            .update(updatePayload)
            .eq('id', userId)

        if (profileError && (profileError.message.includes('perfiles_rol_check') || profileError.code === '23514')) {
            const isJefeMed = rol === 'Jefe Médico' || (rol && rol.toLowerCase().includes('médico') && rol.toLowerCase().includes('jefe'))
            const isMed = isJefeMed || rol === 'Médico' || (rol && rol.toLowerCase().includes('médic'))
            const fallbackRol = isMed ? 'Médico' : (isChofer ? 'Chofer' : 'Jefe')
            const taggedNombre = isJefeMed && !finalNombre.includes('(Jefe Médico)') ? `${finalNombre} (Jefe Médico)` : finalNombre

            const { error: retryErr } = await supabaseClient
                .from('perfiles')
                .update({
                    nombre_completo: taggedNombre,
                    rol: fallbackRol,
                    id_departamento: id_departamento || null,
                    departamentos_autorizados: departamentos_autorizados || []
                })
                .eq('id', userId)
            if (retryErr) {
                return NextResponse.json({ error: retryErr.message }, { status: 400 })
            }
        } else if (profileError) {
            return NextResponse.json({ error: profileError.message }, { status: 400 })
        }

        return NextResponse.json({ success: true, message: 'Usuario y credenciales actualizados exitosamente' })
    } catch (error: any) {
        console.error('Error in edit-user route:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
