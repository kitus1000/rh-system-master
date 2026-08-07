import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CHOFERES_DATA = [
  { numero_empleado: 'CH-101', nombre: 'Adalberto', apellido_paterno: 'Pinales', puesto: 'Chofer', departamento: 'Movilidad', estado_empleado: 'Activo' },
  { numero_empleado: 'CH-102', nombre: 'Ramon', apellido_paterno: 'Yañez', puesto: 'Chofer', departamento: 'Movilidad', estado_empleado: 'Activo' },
  { numero_empleado: 'CH-103', nombre: 'Oscar', apellido_paterno: 'Vazquez', puesto: 'Chofer', departamento: 'Movilidad', estado_empleado: 'Activo' },
  { numero_empleado: 'CH-104', nombre: 'Enrique', apellido_paterno: 'Linares', puesto: 'Chofer', departamento: 'Movilidad', estado_empleado: 'Activo' },
  { numero_empleado: 'CH-105', nombre: 'Samuel', apellido_paterno: 'Madriles', puesto: 'Chofer', departamento: 'Movilidad', estado_empleado: 'Activo' },
  { numero_empleado: 'CH-106', nombre: 'Jesus', apellido_paterno: 'Saucedo', puesto: 'Chofer', departamento: 'Movilidad', estado_empleado: 'Activo' },
]

export async function GET() {
  return handleInsert()
}

export async function POST() {
  return handleInsert()
}

async function handleInsert() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Configuración Supabase faltante' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const inserted = []

    for (const c of CHOFERES_DATA) {
      // Check if employee already exists by name
      const { data: existing } = await supabase
        .from('empleados')
        .select('*')
        .ilike('nombre', `%${c.nombre}%`)
        .ilike('apellido_paterno', `%${c.apellido_paterno}%`)

      if (!existing || existing.length === 0) {
        const { data: insData, error: insErr } = await supabase
          .from('empleados')
          .insert([c])
          .select()

        if (!insErr && insData) {
          inserted.push(insData[0])
        } else {
          console.warn('Insert err:', insErr)
        }
      } else {
        // Update existing to ensure puesto is Chofer
        await supabase
          .from('empleados')
          .update({ puesto: 'Chofer', departamento: 'Movilidad', estado_empleado: 'Activo' })
          .eq('id_empleado', existing[0].id_empleado)

        inserted.push(existing[0])
      }
    }

    return NextResponse.json({
      success: true,
      message: `Se insertaron/verificaron ${inserted.length} choferes en la tabla empleados`,
      choferes: inserted
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
