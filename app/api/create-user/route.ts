import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { email, password, nombre_completo, rol, id_departamento } = body

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json(
                { error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada. Agrega esta variable a tu .env en Vercel.' },
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

        // 1. Create auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true // bypass email confirmation
        })

        if (authError) {
            return NextResponse.json({ error: authError.message }, { status: 400 })
        }

        const userId = authData.user.id

        // 2. Insert into perfiles table
        const { error: perfilError } = await supabaseAdmin.from('perfiles').insert([{
            id: userId,
            nombre_completo,
            rol,
            id_departamento: id_departamento || null
        }])

        if (perfilError) {
            // Rollback auth user creation if profile fails
            await supabaseAdmin.auth.admin.deleteUser(userId)
            return NextResponse.json({ error: perfilError.message }, { status: 400 })
        }

        return NextResponse.json({ success: true, user: authData.user })

    } catch (error: any) {
        console.error('Error in create-user:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
