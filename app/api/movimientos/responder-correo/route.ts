import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSystemEmail, resolveEmailConfig } from '@/utils/mailer'
import { formatShortDate } from '@/utils/contratistasConfig'

async function processDepartmentDecision(params: {
  id_postulacion: string
  decision: 'SI' | 'NO'
  comentario?: string
  nueva_fecha?: string
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Configuración de Supabase no disponible')
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: post, error: postErr } = await admin
    .from('movimientos_postulantes')
    .select('*, movimientos_vacantes(*)')
    .eq('id_postulacion', params.id_postulacion)
    .maybeSingle()

  if (postErr || !post) {
    throw new Error('No se encontró la postulación solicitada.')
  }

  const isApproved = params.decision === 'SI'
  const respuestaLabel = isApproved ? 'Autorizado (Sí)' : 'No / Reprogramar Fecha'
  const nuevoEstatus = isApproved ? 'Confirmado para Mover (SÍ)' : 'Reprogramar Fecha (NO)'

  const updates: any = {
    respuesta_depto_origen: respuestaLabel,
    estatus_movimiento: nuevoEstatus,
    fecha_respuesta_origen: new Date().toISOString(),
    aviso_retorno_destino: true,
  }
  if (params.comentario) updates.comentario_depto_origen = params.comentario
  if (params.nueva_fecha) {
    updates.nueva_fecha_reprogramada = params.nueva_fecha
    updates.fecha_presentacion = params.nueva_fecha
  }

  const { error: upErr } = await admin
    .from('movimientos_postulantes')
    .update(updates)
    .eq('id_postulacion', params.id_postulacion)

  if (upErr) throw upErr

  // Buscar correo del encargado del departamento destino (ej. Mina) + correo de RH
  const vac = post.movimientos_vacantes
  const deptoDestino = vac?.departamento_destino || 'Mina'
  const puestoVacante = vac?.puesto_vacante || post.puesto_postulado

  const { data: encDestino } = await admin
    .from('movimientos_encargados_subdeptos')
    .select('*')
    .ilike('departamento_principal', `%${deptoDestino}%`)
    .limit(1)
    .maybeSingle()

  const mailCfg = await resolveEmailConfig()
  const recipients = [encDestino?.correo_encargado, mailCfg.rhNotificationEmail, mailCfg.smtpUser].filter(Boolean) as string[]

  const subject = isApproved
    ? `✅ [CONFIRMADO SÍ] ${post.departamento_actual} autorizó a ${post.nombre_completo} para ${puestoVacante} (${deptoDestino})`
    : `⏳ [REPROGRAMAR FECHA - NO] ${post.departamento_actual} solicita nueva fecha para ${post.nombre_completo} (${puestoVacante})`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #d4d4d8; border-radius: 16px; overflow: hidden;">
      <div style="background: ${isApproved ? '#065f46' : '#9f1239'}; color: #ffffff; padding: 18px 24px;">
        <div style="font-size: 11px; color: #fde68a; font-weight: bold;">
          RESPUESTA OFICIAL DE DEPARTAMENTO DE ORIGEN • GRUPO MINERO BACÍS
        </div>
        <h3 style="margin: 6px 0 0; font-size: 17px;">
          ${isApproved ? '✅ LIBERACIÓN AUTORIZADA — LISTO PARA PRESENTARSE' : '⏳ NO DISPONIBLE EN FECHA — REQUIERE REPROGRAMAR'}
        </h3>
      </div>
      <div style="padding: 22px; color: #18181b; font-size: 13px; line-height: 1.6;">
        <p>
          Aviso automático de retorno para el departamento de <strong>${deptoDestino}</strong>, <strong>Recursos Humanos</strong> y <strong>Sindicato</strong>:
        </p>
        <div style="background: #f4f4f5; padding: 14px; border-radius: 10px; margin: 12px 0;">
          <div><strong>Trabajador:</strong> ${post.nombre_completo}</div>
          <div><strong>Departamento / Sub-depto Origen:</strong> ${post.departamento_actual}${
    post.sub_departamento_actual ? ` (${post.sub_departamento_actual})` : ''
  } — Puesto actual: ${post.puesto_actual}</div>
          <div><strong>Vacante Destino:</strong> ${puestoVacante} en ${deptoDestino} (Folio ${
    vac?.folio_convocatoria || 'N/A'
  })</div>
          <div><strong>Respuesta del Encargado (${post.encargado_origen_nombre || post.departamento_actual}):</strong> <strong>${respuestaLabel}</strong></div>
          <div><strong>Fecha programada:</strong> ${formatShortDate(params.nueva_fecha || post.fecha_presentacion)}</div>
          ${params.comentario ? `<div><strong>Observación:</strong> ${params.comentario}</div>` : ''}
        </div>
        <p style="font-size: 12px; color: #52525b;">
          ${
            isApproved
              ? 'El trabajador ya tiene las 4 reglas del Tablero de Ajedrez en verde y puede ejecutarse su movimiento de plaza.'
              : 'El candidato se ha regresado a estado de reprogramación para acordar una nueva fecha de presentación.'
          }
        </p>
      </div>
    </div>
  `

  let emailSent = false
  if (recipients.length > 0) {
    const mRes = await sendSystemEmail({
      to: Array.from(new Set(recipients)),
      subject,
      html,
    })
    emailSent = mRes.sent
  }

  await admin.from('movimientos_notificaciones_log').insert([
    {
      id_vacante: post.id_vacante || null,
      id_postulacion: post.id_postulacion,
      tipo_aviso: isApproved ? 'RESPUESTA_SI_ORIGEN' : 'RESPUESTA_NO_REPROGRAMAR',
      remitente: `${post.encargado_origen_nombre || post.departamento_actual}`,
      destinatarios: `Depto Destino: ${deptoDestino} y Recursos Humanos`,
      asunto: subject,
      mensaje: isApproved
        ? `Confirmó que SÍ autoriza la salida de ${post.nombre_completo} para presentarse el ${formatShortDate(
            post.fecha_presentacion
          )} como ${puestoVacante} en ${deptoDestino}.`
        : `Indicó que NO puede liberar a ${post.nombre_completo} en la fecha solicitada. Se regresa para planear una nueva fecha.${
            params.comentario ? ` Motivo: ${params.comentario}` : ''
          }`,
      correo_enviado: emailSent,
    },
  ])

  return { post, isApproved, respuestaLabel, nuevoEstatus, emailSent }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id') || ''
    const decision = (searchParams.get('decision') || 'SI').toUpperCase() === 'NO' ? 'NO' : 'SI'
    const comentario = searchParams.get('comentario') || ''

    if (!id) {
      return new NextResponse('Falta identificador de postulación', { status: 400 })
    }

    const result = await processDepartmentDecision({
      id_postulacion: id,
      decision,
      comentario:
        comentario ||
        (decision === 'SI'
          ? 'Autorizado desde enlace de correo electrónico'
          : 'Solicita reprogramar fecha desde correo electrónico'),
    })

    const htmlResponse = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Respuesta Registrada — Grupo Minero Bacís</title>
      </head>
      <body style="font-family: Arial, sans-serif; background: #09090b; color: #ffffff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px;">
        <div style="background: #18181b; border: 2px solid ${
          result.isApproved ? '#10b981' : '#f59e0b'
        }; border-radius: 20px; max-width: 500px; width: 100%; padding: 28px; text-align: center;">
          <div style="font-size: 44px; margin-bottom: 10px;">${result.isApproved ? '✅' : '⏳'}</div>
          <div style="font-size: 11px; color: #fbbf24; font-weight: bold; letter-spacing: 1px;">
            GRUPO MINERO BACÍS • SISTEMA DE MOVIMIENTOS Y ESCALAFÓN
          </div>
          <h2 style="margin: 10px 0; font-size: 20px;">
            ${
              result.isApproved
                ? '¡Autorización de Salida Confirmada (SÍ)!'
                : 'Solicitud de Nueva Fecha Registrada (NO / Reprogramar)'
            }
          </h2>
          <p style="font-size: 14px; color: #d4d4d8; line-height: 1.5;">
            Se registró tu respuesta para el trabajador <strong>${result.post.nombre_completo}</strong> y ya se envió el aviso automático de vuelta al departamento destino y a Recursos Humanos.
          </p>
          <a href="/movimientos-sindicato" style="display: inline-block; margin-top: 16px; background: #f59e0b; color: #000000; font-weight: bold; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-size: 13px;">
            Ir al Tablero de Movimientos y Ajedrez
          </a>
        </div>
      </body>
      </html>
    `
    return new NextResponse(htmlResponse, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (err: any) {
    return new NextResponse(`Error procesando respuesta: ${err.message}`, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { id_postulacion, decision, comentario, nueva_fecha } = body
    if (!id_postulacion || !decision) {
      return NextResponse.json({ error: 'Faltan parámetros id_postulacion o decision' }, { status: 400 })
    }

    const result = await processDepartmentDecision({
      id_postulacion,
      decision: decision === 'NO' ? 'NO' : 'SI',
      comentario,
      nueva_fecha,
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error registrando decisión' }, { status: 500 })
  }
}
