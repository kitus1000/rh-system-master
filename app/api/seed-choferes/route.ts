import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CHOFERES_LIST = [
  { nombre_completo: 'Adalberto Pinales', email: 'adalberto.pinales@bacis.com', password: 'Bacis2026!' },
  { nombre_completo: 'Ramon Yañez', email: 'ramon.yanez@bacis.com', password: 'Bacis2026!' },
  { nombre_completo: 'Oscar Vazquez', email: 'oscar.vazquez@bacis.com', password: 'Bacis2026!' },
  { nombre_completo: 'Enrique Linares', email: 'enrique.linares@bacis.com', password: 'Bacis2026!' },
  { nombre_completo: 'Samuel Madriles', email: 'samuel.madriles@bacis.com', password: 'Bacis2026!' },
  { nombre_completo: 'Jesus Saucedo', email: 'jesus.saucedo@bacis.com', password: 'Bacis2026!' },
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
        // 1. Intentar crear usuario con confirmación de correo
        const { data: authData, error: authErr } = await supabaseClient.auth.admin.createUser({
          email: c.email,
          password: c.password,
          email_confirm: true
        })

        if (authErr) {
          if (authErr.message.includes('already registered') || authErr.message.includes('already exists') || authErr.message.includes('unique')) {
            // Buscar usuario existente en la lista de auth
            const { data: usersData } = await supabaseClient.auth.admin.listUsers()
            const existing = usersData?.users?.find(u => u.email?.toLowerCase() === c.email.toLowerCase())
            if (existing) {
              userId = existing.id
              status = 'actualizado'
              // Forzar actualización de contraseña
              await supabaseClient.auth.admin.updateUserById(userId, { 
                password: c.password,
                email_confirm: true
              })
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
        // Upsert en la tabla perfiles con rol EXACTO 'Chofer'
        await supabaseClient.from('perfiles').upsert([{
          id: userId,
          nombre_completo: `${c.nombre_completo} (Chofer)`,
          rol: 'Chofer'
        }])

        results.push({
          nombre: c.nombre_completo,
          email: c.email,
          password: c.password,
          rol: 'Chofer',
          status,
          userId
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Cuentas oficiales de choferes sincronizadas y listas para login con rol Chofer',
      choferes: results
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
