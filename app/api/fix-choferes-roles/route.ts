import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  return handleFix()
}

export async function POST() {
  return handleFix()
}

async function handleFix() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Falta configuración de Supabase' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const driverNames = [
      'Adalberto Pinales',
      'Ramon Yañez',
      'Oscar Vazquez',
      'Enrique Linares',
      'Samuel Madriles',
      'Jesus Saucedo'
    ]

    // 1. Fetch all perfiles
    const { data: perfiles, error: pErr } = await supabase.from('perfiles').select('*')
    if (pErr) throw pErr

    const updated = []

    for (const p of (perfiles || [])) {
      const name = (p.nombre_completo || '').toLowerCase()
      const isDriver = driverNames.some(d => name.includes(d.toLowerCase())) || name.includes('chofer')

      if (isDriver) {
        // Tag name with (Chofer) if missing and set rol = 'Chofer'
        let cleanName = p.nombre_completo.replace(/\s*\(Chofer\)/gi, '').trim()
        let taggedName = `${cleanName} (Chofer)`

        const { error: uErr } = await supabase
          .from('perfiles')
          .update({
            rol: 'Chofer',
            nombre_completo: taggedName
          })
          .eq('id', p.id)

        if (!uErr) {
          updated.push({ id: p.id, name: taggedName, oldRol: p.rol })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Se actualizaron ${updated.length} usuarios al rol exclusivo de Chofer`,
      updated
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
