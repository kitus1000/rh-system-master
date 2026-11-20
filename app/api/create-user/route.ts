import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { email, password, nombre_completo, rol, id_departamento, departamentos_autorizados, id_empresa_contratista } = body

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
                email_confirm: true,
                user_metadata: {
                    full_name: nombre_completo,
                    rol,
                    id_empresa_contratista: id_empresa_contratista || null
                }
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

        const perfilPayload: any = {
            id: userId,
            nombre_completo: finalNombre,
            rol: isChofer ? 'Chofer' : rol,
            email: email || null,
            id_departamento: id_departamento || null,
            departamentos_autorizados: departamentos_autorizados || []
        }
        if (id_empresa_contratista) {
            perfilPayload.id_empresa_contratista = id_empresa_contratista
        }

        let { error: perfilError } = await supabaseClient.from('perfiles').upsert([perfilPayload])

        // If id_empresa_contratista or email column doesn't exist yet, retry without them (metadata still holds them)
        if (perfilError && (perfilError.message?.toLowerCase().includes('id_empresa_contratista') || perfilError.message?.toLowerCase().includes('email'))) {
            if (perfilError.message?.toLowerCase().includes('id_empresa_contratista')) delete perfilPayload.id_empresa_contratista
            if (perfilError.message?.toLowerCase().includes('email')) delete perfilPayload.email
            const retryCol = await supabaseClient.from('perfiles').upsert([perfilPayload])
            perfilError = retryCol.error
        }

        if (perfilError) {
            // Handle PostgreSQL perfiles_rol_check constraint error
            if (perfilError.message.includes('perfiles_rol_check') || perfilError.code === '23514') {
                const isJefeMed = rol === 'Jefe Médico' || (rol && rol.toLowerCase().includes('médico') && rol.toLowerCase().includes('jefe'))
                const isMed = isJefeMed || rol === 'Médico' || (rol && rol.toLowerCase().includes('médic'))
                const isContratista = rol === 'Contratista'
                const isCaseta = rol === 'Caseta' || rol === 'Seguridad Patrimonial'
                const isSeguridad = rol === 'Seguridad Industrial' || rol === 'Seguridad'
                const isCamp = rol === 'Encargado de Campamento y Comedor'
                const isCorp = rol === 'Superintendente de RH Corporativo'
                const isRHUnidad = rol === 'Jefe de RH Unidad'
                const isSindicato = rol === 'Sindicato'
                const fallbackRol = isMed ? 'Médico' : (isCorp || isRHUnidad ? 'Administrativo' : 'Jefe')
                let taggedNombre = finalNombre
                if (isJefeMed && !taggedNombre.includes('(Jefe Médico)')) taggedNombre = `${taggedNombre} (Jefe Médico)`
                else if (isContratista && !taggedNombre.includes('(Contratista)')) taggedNombre = `${taggedNombre} (Contratista)`
                else if (isCaseta && !taggedNombre.includes('(Caseta)')) taggedNombre = `${taggedNombre} (Caseta)`
                else if (isSeguridad && !taggedNombre.includes('(Seguridad)')) taggedNombre = `${taggedNombre} (Seguridad)`
                else if (isCamp && !taggedNombre.includes('(Campamento y Comedor)')) taggedNombre = `${taggedNombre} (Campamento y Comedor)`
                else if (isCorp && !taggedNombre.includes('(RH Corporativo)')) taggedNombre = `${taggedNombre} (RH Corporativo)`
                else if (isRHUnidad && !taggedNombre.includes('(Jefe RH Unidad)')) taggedNombre = `${taggedNombre} (Jefe RH Unidad)`
                else if (isSindicato && !taggedNombre.includes('(Sindicato)')) taggedNombre = `${taggedNombre} (Sindicato)`

                const { error: retryError } = await supabaseClient.from('perfiles').upsert([{
                    id: userId,
                    nombre_completo: taggedNombre,
                    rol: fallbackRol,
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
