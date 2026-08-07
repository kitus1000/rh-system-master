import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CHOFERES_LIST = [
  { nombre_completo: 'Adalberto Pinales (Chofer)', email: 'adalberto.pinales@bacis.com', password: 'Bacis2026!' },
  { nombre_completo: 'Ramon Yañez (Chofer)', email: 'ramon.yanez@bacis.com', password: 'Bacis2026!' },
  { nombre_completo: 'Oscar Vazquez (Chofer)', email: 'oscar.vazquez@bacis.com', password: 'Bacis2026!' },
  { nombre_completo: 'Enrique Linares (Chofer)', email: 'enrique.linares@bacis.com', password: 'Bacis2026!' },
  { nombre_completo: 'Samuel Madriles (Chofer)', email: 'samuel.madriles@bacis.com', password: 'Bacis2026!' },
  { nombre_completo: 'Jesus Saucedo (Chofer)', email: 'jesus.saucedo@bacis.com', password: 'Bacis2026!' },
]

export async function GET() {
  return handleSeed()
}

export async function POST() {
  return handleSeed()
}

async function handleSeed() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Configuración Supabase faltante' }, { status: 500 })
    }

    const isServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ'))
    const supabaseClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const results = []

    for (const c of CHOFERES_LIST) {
      let userId = ''
      let status = 'creado'

      if (isServiceRole) {
        const { data: authData, error: authErr } = await supabaseClient.auth.admin.createUser({
          email: c.email,
          password: c.password,
          email_confirm: true
        })

        if (authErr) {
          if (authErr.message.includes('already registered') || authErr.message.includes('already exists')) {
            // Find existing user
            const { data: usersData } = await supabaseClient.auth.admin.listUsers()
            const existing = usersData?.users?.find(u => u.email?.toLowerCase() === c.email.toLowerCase())
            if (existing) {
              userId = existing.id
              status = 'ya_existia'
              // Update password to ensure it works
              await supabaseClient.auth.admin.updateUserById(userId, { password: c.password })
            }
          } else {
            results.push({ email: c.email, status: 'error', message: authErr.message })
            continue
          }
        } else if (authData?.user) {
          userId = authData.user.id
        }
      } else {
        const { data: authData, error: authErr } = await supabaseClient.auth.signUp({
          email: c.email,
          password: c.password
        })

        if (authErr) {
          results.push({ email: c.email, status: 'error', message: authErr.message })
          continue
        }

        if (authData?.user) {
          userId = authData.user.id
        }
      }

      if (userId) {
        // Upsert in perfiles
        await supabaseClient.from('perfiles').upsert([{
          id: userId,
          nombre_completo: c.nombre_completo,
          rol: 'Chofer'
        }])

        results.push({
          nombre: c.nombre_completo,
          email: c.email,
          password: c.password,
          status,
          userId
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Creación de choferes completada',
      choferes: results
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
