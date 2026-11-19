import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { razon_social, rfc, representante_legal, telefono, correo, especialidad, notas } = body

    if (!razon_social || !rfc || !correo) {
      return NextResponse.json(
        { error: 'Razón social, RFC y correo electrónico son obligatorios.' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Configuración de Supabase incompleta.' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await supabaseAdmin
      .from('contratistas_empresas')
      .insert([
        {
          razon_social: String(razon_social).trim(),
          nombre_comercial: String(razon_social).trim(),
          rfc: String(rfc).trim().toUpperCase(),
          representante_legal: representante_legal ? String(representante_legal).trim() : null,
          telefono: telefono ? String(telefono).trim() : null,
          correo: String(correo).trim().toLowerCase(),
          especialidad: especialidad ? String(especialidad).trim() : null,
          notas: notas ? String(notas).trim() : 'Solicitud de cuenta enviada desde el Portal Central',
          estatus: 'Pendiente',
        },
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, empresa: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
