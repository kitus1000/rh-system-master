import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !serviceKey) return null
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const codigo = (searchParams.get('codigo') || '').trim().toUpperCase()
    if (!codigo) {
      return NextResponse.json({ error: 'Ingresa o escanea un código QR.' }, { status: 400 })
    }

    const supabase = getAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Configuración de Supabase incompleta.' }, { status: 500 })
    }

    const { data: cred, error } = await supabase
      .from('contratistas_credenciales')
      .select(`
        *,
        contratistas_empresas (id_empresa, razon_social, rfc, telefono),
        contratistas_personal (id_personal, nombre, apellido_paterno, apellido_materno, puesto_servicio, nss, tipo_sangre, contacto_emergencia, foto_url, induccion_aprobada),
        contratistas_solicitudes (id_solicitud, folio, id_departamento_objetivo, departamento_nombre, area_trabajo, descripcion_servicio, requiere_campamento, requiere_comedor)
      `)
      .ilike('codigo_qr', codigo)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (!cred) {
      return NextResponse.json({ error: `Credencial "${codigo}" no encontrada en el sistema.` }, { status: 404 })
    }

    const { data: solPers } = await supabase
      .from('contratistas_solicitud_personal')
      .select('cama_descripcion')
      .eq('id_solicitud', cred.id_solicitud)
      .eq('id_personal', cred.id_personal)
      .maybeSingle()

    const today = new Date().toISOString().split('T')[0]
    const vencida = cred.vigencia_hasta < today
    const noVigenteAun = cred.vigencia_desde > today

    return NextResponse.json({
      credencial: {
        ...cred,
        cama_descripcion: solPers?.cama_descripcion || null,
        vencida,
        noVigenteAun,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error verificando QR' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { codigo_qr, accion, caseta_lugar, guardia_nombre } = body

    if (!codigo_qr || !accion) {
      return NextResponse.json({ error: 'Falta código QR o acción.' }, { status: 400 })
    }

    const supabase = getAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Configuración de Supabase incompleta.' }, { status: 500 })
    }

    const { data: cred, error: credErr } = await supabase
      .from('contratistas_credenciales')
      .select(`
        *,
        contratistas_empresas (razon_social),
        contratistas_personal (nombre, apellido_paterno, apellido_materno),
        contratistas_solicitudes (folio, id_departamento_objetivo, departamento_nombre)
      `)
      .ilike('codigo_qr', String(codigo_qr).trim())
      .maybeSingle()

    if (credErr || !cred) {
      return NextResponse.json({ error: 'Credencial no encontrada.' }, { status: 404 })
    }

    const nowIso = new Date().toISOString()
    const horaStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    const workerName = `${cred.contratistas_personal?.nombre || ''} ${cred.contratistas_personal?.apellido_paterno || ''}`.trim()
    const empresaName = cred.contratistas_empresas?.razon_social || 'Contratista'
    const deptoName = cred.contratistas_solicitudes?.departamento_nombre || 'Área'
    const caseta = caseta_lugar || 'Caseta Principal'
    const guardia = guardia_nombre || 'Guardia en Turno'

    if (accion === 'Entrada') {
      if (cred.estatus === 'Revocada' || cred.estatus === 'Devuelta') {
        return NextResponse.json({ error: `Esta credencial está ${cred.estatus} y no permite nuevo ingreso.` }, { status: 400 })
      }
      const today = nowIso.split('T')[0]
      if (cred.vigencia_hasta < today) {
        return NextResponse.json({ error: `Credencial vencida desde ${cred.vigencia_hasta}. Solicita prórroga primero.` }, { status: 400 })
      }

      await supabase
        .from('contratistas_credenciales')
        .update({ estatus: 'En Mina', fecha_entrada_mina: nowIso, notas_caseta: `Entrada por ${caseta} (${guardia})` })
        .eq('id_credencial', cred.id_credencial)

      await supabase
        .from('contratistas_personal')
        .update({ estatus: 'En Mina' })
        .eq('id_personal', cred.id_personal)

      await supabase
        .from('contratistas_solicitudes')
        .update({ estatus_general: 'En Mina', actualizado_el: nowIso })
        .eq('id_solicitud', cred.id_solicitud)

      await supabase.from('contratistas_movimientos_bitacora').insert([
        {
          id_credencial: cred.id_credencial,
          id_personal: cred.id_personal,
          id_empresa: cred.id_empresa,
          tipo_movimiento: 'Entrada',
          caseta_lugar: caseta,
          registrado_por: guardia,
          observaciones: `Ingreso verificado por QR (${cred.codigo_qr})`,
        },
      ])

      const avisoTexto = `✅ AVISO CASETA (ENTRADA A MINA): ${workerName} (${empresaName}) ingresó a las ${horaStr} por ${caseta} con credencial ${cred.codigo_qr} hacia ${deptoName}.`

      await supabase.from('contratistas_mensajes').insert([
        {
          id_solicitud: cred.id_solicitud,
          id_empresa: cred.id_empresa,
          remitente_nombre: `${caseta} (${guardia})`,
          remitente_rol: 'Caseta',
          mensaje: avisoTexto,
        },
      ])

      // Also notify internal RH/Department wall (best-effort)
      await supabase.from('muro_alertas').insert([
        {
          id_departamento: cred.contratistas_solicitudes?.id_departamento_objetivo || null,
          contenido: avisoTexto,
        },
      ])

      return NextResponse.json({
        success: true,
        nuevo_estatus: 'En Mina',
        aviso: avisoTexto,
      })
    }

    if (accion === 'Salida') {
      await supabase
        .from('contratistas_credenciales')
        .update({
          estatus: 'Devuelta',
          fecha_salida_mina: nowIso,
          credencial_entregada: true,
          recibido_por: guardia,
          notas_caseta: `Salida y entrega de credencial en ${caseta} (${guardia})`,
        })
        .eq('id_credencial', cred.id_credencial)

      await supabase
        .from('contratistas_personal')
        .update({ estatus: 'Activo' })
        .eq('id_personal', cred.id_personal)

      // Liberar cama en campamento si tenía asignada
      await supabase
        .from('campamento_camas')
        .update({ id_contratista_personal: null, ocupado_por_nombre: null })
        .eq('id_contratista_personal', cred.id_personal)

      await supabase.from('contratistas_movimientos_bitacora').insert([
        {
          id_credencial: cred.id_credencial,
          id_personal: cred.id_personal,
          id_empresa: cred.id_empresa,
          tipo_movimiento: 'Entrega Credencial',
          caseta_lugar: caseta,
          registrado_por: guardia,
          observaciones: 'Salida de mina y entrega física de credencial',
        },
      ])

      const avisoTexto = `🚪 AVISO CASETA (SALIDA Y ENTREGA DE CREDENCIAL): ${workerName} (${empresaName}) entregó su credencial ${cred.codigo_qr} y salió de mina a las ${horaStr} por ${caseta}.`

      await supabase.from('contratistas_mensajes').insert([
        {
          id_solicitud: cred.id_solicitud,
          id_empresa: cred.id_empresa,
          remitente_nombre: `${caseta} (${guardia})`,
          remitente_rol: 'Caseta',
          mensaje: avisoTexto,
        },
      ])

      await supabase.from('muro_alertas').insert([
        {
          id_departamento: cred.contratistas_solicitudes?.id_departamento_objetivo || null,
          contenido: avisoTexto,
        },
      ])

      return NextResponse.json({
        success: true,
        nuevo_estatus: 'Devuelta',
        aviso: avisoTexto,
      })
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error procesando movimiento' }, { status: 500 })
  }
}
