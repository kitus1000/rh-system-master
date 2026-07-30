import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { email, password, nombre_completo, rol, id_departamento, departamentos_autorizados } = body

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !serviceKey) {
            return NextResponse.json(
                { error: 'Configuración de Supabase incompleta (Falta URL o Key).' },
                { status: 500 }
            )
        }

        const isServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
        const supabaseClient = createClient(supabaseUrl, serviceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })

        let userId = ''
        let authUserObj: any = null

        if (isServiceRole && process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('eyJ')) {
            // 1. Create auth user via admin API (Bypasses email confirmation & rate limits)
            const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
                email,
                password,
                email_confirm: true
            })
            if (authError) {
                if (authError.message.toLowerCase().includes('invalid api key')) {
                    return NextResponse.json({ 
                        error: 'La clave SUPABASE_SERVICE_ROLE_KEY debe ser la clave Legacy que empieza por "eyJ...". Cópiala desde la pestaña "Legacy anon, service_role API keys" en Supabase.' 
                    }, { status: 400 })
                }
                return NextResponse.json({ error: authError.message }, { status: 400 })
            }
            userId = authData.user.id
            authUserObj = authData.user
        } else {
            // Fallback: Create auth user via signUp API
            const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email,
                password
            })

            if (authError) {
                if (authError.message.toLowerCase().includes('rate limit') || authError.message.toLowerCase().includes('email')) {
                    return NextResponse.json({ 
                        error: 'Se superó el límite por hora de correos de Supabase. Para crear usuarios sin confirmación de correo ni límites, agrega SUPABASE_SERVICE_ROLE_KEY a tus variables de entorno en Vercel o en el archivo .env.local.' 
                    }, { status: 429 })
                }
                return NextResponse.json({ error: authError.message }, { status: 400 })
            }

            if (!authData.user) {
                return NextResponse.json({ error: 'No se pudo generar el usuario registrado.' }, { status: 400 })
            }

            userId = authData.user.id
            authUserObj = authData.user
        }

        // 2. Insert into perfiles table
        const isChofer = rol === 'Chofer' || (rol && rol.toLowerCase().includes('chofer'))
        const finalNombre = isChofer && !nombre_completo.includes('(Chofer)') ? `${nombre_completo} (Chofer)` : nombre_completo

        const { error: perfilError } = await supabaseClient.from('perfiles').upsert([{
            id: userId,
            nombre_completo: finalNombre,
            rol: isChofer ? 'Chofer' : rol,
            id_departamento: id_departamento || null,
            departamentos_autorizados: departamentos_autorizados || []
        }])

        if (perfilError) {
            // Handle PostgreSQL perfiles_rol_check constraint error
            if (perfilError.message.includes('perfiles_rol_check') || perfilError.code === '23514') {
                const { error: retryError } = await supabaseClient.from('perfiles').upsert([{
                    id: userId,
                    nombre_completo: finalNombre,
                    rol: 'Jefe',
                    id_departamento: id_departamento || null,
                    departamentos_autorizados: departamentos_autorizados || []
                }])
                if (retryError) {
                    if (isServiceRole) await supabaseClient.auth.admin.deleteUser(userId)
                    return NextResponse.json({ error: retryError.message }, { status: 400 })
                }
            } else {
                if (isServiceRole) await supabaseClient.auth.admin.deleteUser(userId)
                return NextResponse.json({ error: perfilError.message }, { status: 400 })
            }
        }

        return NextResponse.json({ success: true, user: authUserObj })

    } catch (error: any) {
        console.error('Error in create-user:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
