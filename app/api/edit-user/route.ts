import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { userId, nombre_completo, rol, id_departamento, password } = body

        if (!userId) {
            return NextResponse.json({ error: 'Falta userId' }, { status: 400 })
        }

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json(
                { error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada. Agrégala en tu .env local o en Vercel.' },
                { status: 500 }
            )
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        // 1. Update perfiles table
        const { error: profileError } = await supabaseAdmin
            .from('perfiles')
            .update({
                nombre_completo,
                rol,
                id_departamento: id_departamento || null
            })
            .eq('id', userId)

        if (profileError) {
            return NextResponse.json({ error: profileError.message }, { status: 400 })
        }

        // 2. Optionally update password in auth.users
        if (password && password.trim() !== '') {
            if (password.length < 6) {
                return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
            }
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                password: password
            })
            if (authError) {
                return NextResponse.json({ error: authError.message }, { status: 400 })
            }
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error in edit-user route:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
