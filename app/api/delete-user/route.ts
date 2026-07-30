import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { userId } = body

        if (!userId) {
            return NextResponse.json({ error: 'Falta userId' }, { status: 400 })
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !serviceKey) {
            return NextResponse.json(
                { error: 'Configuración de Supabase incompleta.' },
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

        // 1. Delete profile from perfiles table
        const { error: profileErr } = await supabaseClient.from('perfiles').delete().eq('id', userId)
        if (profileErr) {
            return NextResponse.json({ error: profileErr.message }, { status: 400 })
        }

        // 2. If Service Role Key is present, delete from Supabase Auth admin
        if (isServiceRole) {
            const { error: authError } = await supabaseClient.auth.admin.deleteUser(userId)
            if (authError) {
                console.warn('Auth admin delete warning:', authError.message)
            }
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error in delete-user route:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
