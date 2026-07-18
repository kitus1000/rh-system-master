import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { userId } = body

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

        // 1. Delete profile first
        await supabaseAdmin.from('perfiles').delete().eq('id', userId)

        // 2. Delete auth user
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
        
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error in delete-user route:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
