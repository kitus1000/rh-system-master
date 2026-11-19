import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { id_pase, id_empleado, fecha_inicio, fecha_fin, motivo, folio } = body

    if (!id_pase || !id_empleado || !fecha_inicio) {
      return NextResponse.json({ error: 'Datos incompletos para sincronizar pase médico a RH' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Configuración de Supabase incompleta' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Find or create an Incidencia Type for "Incapacidad / Pase Médico"
    const { data: tipos } = await supabaseAdmin
      .from('cat_tipos_incidencia')
      .select('id_tipo_incidencia, tipo_incidencia')
      .eq('activo', true)

    let tipoObj = tipos?.find((t) => {
      const n = (t.tipo_incidencia || '').toLowerCase()
      return n.includes('incapacidad') || n.includes('médic') || n.includes('medic') || n.includes('enfermedad')
    })

    if (!tipoObj && tipos && tipos.length > 0) {
      tipoObj = tipos[0]
    }

    if (!tipoObj) {
      const { data: createdTipo, error: tipoErr } = await supabaseAdmin
        .from('cat_tipos_incidencia')
        .insert([
          {
            tipo_incidencia: 'Incapacidad / Pase Médico',
            bloquea_asistencia: true,
            requiere_evidencia: false,
            cuenta_como_descanso: false,
            activo: true,
          },
        ])
        .select()
        .single()

      if (tipoErr || !createdTipo) {
        return NextResponse.json({ error: 'No se pudo obtener/crear tipo de incidencia: ' + (tipoErr?.message || 'sin datos') }, { status: 400 })
      }
      tipoObj = createdTipo
    }

    if (!tipoObj) {
      return NextResponse.json({ error: 'No se encontró tipo de incidencia válido' }, { status: 400 })
    }

    // 2. Insert into empleado_incidencias
    const cleanStart = String(fecha_inicio).split('T')[0]
    const cleanEnd = fecha_fin && !String(fecha_fin).toUpperCase().includes('INMEDIATA') && !String(fecha_fin).toUpperCase().includes('ABIERTO')
      ? String(fecha_fin).split('T')[0]
      : cleanStart

    const { data: incData, error: incErr } = await supabaseAdmin
      .from('empleado_incidencias')
      .insert([
        {
          id_empleado,
          id_tipo_incidencia: tipoObj.id_tipo_incidencia,
          fecha_inicio: cleanStart,
          fecha_fin: cleanEnd,
          comentarios: `[Sincronizado de Clínica Médica - Folio ${folio || id_pase.slice(0, 8)}] ${motivo || 'Pase médico / Atención clínica'}`,
          estado: 'Aprobada',
        },
      ])
      .select()
      .single()

    if (incErr) {
      return NextResponse.json({ error: 'Error creando incidencia en RH: ' + incErr.message }, { status: 400 })
    }

    // 3. Mark pase as synced (best-effort if column exists)
    await supabaseAdmin
      .from('pases_medicos')
      .update({
        sincronizado_rh: true,
        id_incidencia_rh: incData.id_incidencia,
      })
      .eq('id_pase', id_pase)

    return NextResponse.json({ success: true, incidencia: incData })
  } catch (err: any) {
    console.error('Error sync-medico:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
