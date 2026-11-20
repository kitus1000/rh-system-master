import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSystemEmail } from '@/utils/mailer'
import { formatShortDate } from '@/utils/contratistasConfig'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { vacante, candidatos, baseUrl } = body

    if (!vacante || !Array.isArray(candidatos) || candidatos.length === 0) {
      return NextResponse.json({ error: 'Se requiere la vacante y al menos un candidato seleccionado.' }, { status: 400 })
    }

    const originUrl = baseUrl || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const admin =
      supabaseUrl && serviceKey
        ? createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
        : null

    // Agrupar candidatos por correo del Encargado de su Departamento / Sub-departamento de Origen
    const groupsByEmail: Record<
      string,
      {
        encargado_nombre: string
        encargado_correo: string
        departamentos: Set<string>
        items: any[]
      }
    > = {}

    for (const c of candidatos) {
      const emailKey = (c.encargado_origen_correo || 'rh@bacis.com').toLowerCase().trim()
      if (!groupsByEmail[emailKey]) {
        groupsByEmail[emailKey] = {
          encargado_nombre: c.encargado_origen_nombre || `Encargado de ${c.departamento_actual}`,
          encargado_correo: emailKey,
          departamentos: new Set(),
          items: [],
        }
      }
      groupsByEmail[emailKey].departamentos.add(
        c.sub_departamento_actual ? `${c.departamento_actual} (${c.sub_departamento_actual})` : c.departamento_actual
      )
      groupsByEmail[emailKey].items.push(c)
    }

    const dispatchResults = []

    for (const key of Object.keys(groupsByEmail)) {
      const grp = groupsByEmail[key]
      const deptListStr = Array.from(grp.departamentos).join(', ')

      const rowsHtml = grp.items
        .map((item) => {
          const token = item.token_respuesta || item.id_postulacion
          const urlSi = `${originUrl}/api/movimientos/responder-correo?id=${encodeURIComponent(
            item.id_postulacion
          )}&token=${encodeURIComponent(token)}&decision=SI`
          const urlNo = `${originUrl}/api/movimientos/responder-correo?id=${encodeURIComponent(
            item.id_postulacion
          )}&token=${encodeURIComponent(token)}&decision=NO`

          return `
            <div style="background: #ffffff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
              <div style="font-size: 15px; font-weight: bold; color: #09090b;">
                👷 ${item.nombre_completo} ${item.numero_empleado ? `(#${item.numero_empleado})` : ''}
              </div>
              <div style="font-size: 12px; color: #52525b; margin-top: 4px;">
                <strong>Área / Sub-depto Actual:</strong> ${item.departamento_actual}${
            item.sub_departamento_actual ? ` — ${item.sub_departamento_actual}` : ''
          } | <strong>Puesto Actual:</strong> ${item.puesto_actual}
              </div>
              <div style="font-size: 12px; color: #52525b; margin-top: 2px;">
                <strong>Antigüedad:</strong> ${item.anos_antiguedad || 0} años | <strong>Requiere Capacitación Previa:</strong> ${
            item.requiere_capacitacion_previa ? 'Sí' : 'No'
          }
              </div>
              <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 10px; margin-top: 10px; font-size: 12px; color: #92400e;">
                <div><strong>📅 Fecha solicitada para presentarse en ${vacante.departamento_destino}:</strong> ${formatShortDate(
            item.fecha_presentacion || vacante.fecha_cita_propuesta
          )}</div>
                <div><strong>📋 Plan de Avance:</strong> ${
                  item.plan_avance_asignado || vacante.plan_avance_departamento || 'Presentación y evaluación en área destino'
                }</div>
              </div>
              <div style="margin-top: 14px;">
                <a href="${urlSi}" style="display: inline-block; background: #059669; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 12px; padding: 10px 16px; border-radius: 8px; margin-right: 8px;">
                  ✅ SÍ, AUTORIZO SU SALIDA EN ESA FECHA
                </a>
                <a href="${urlNo}" style="display: inline-block; background: #e11d48; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 12px; padding: 10px 16px; border-radius: 8px;">
                  ⏳ NO PUEDO EN ESA FECHA (REPROGRAMAR)
                </a>
              </div>
            </div>
          `
        })
        .join('')

      const subject = `[MOVIMIENTO INTERNO / ESCALAFÓN] Solicitud de Liberación de Personal para ${vacante.puesto_vacante} (${vacante.departamento_destino})`
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #d4d4d8; border-radius: 16px; overflow: hidden; background: #f8fafc;">
          <div style="background: #0f172a; color: #ffffff; padding: 20px 24px; border-bottom: 4px solid #f59e0b;">
            <div style="font-size: 11px; color: #fbbf24; font-weight: bold; letter-spacing: 1px;">
              GRUPO MINERO BACÍS • UNIDAD "EL HERRERO" • SINDICATO & RH
            </div>
            <h2 style="margin: 6px 0 0; font-size: 18px;">SOLICITUD DE LIBERACIÓN DE PERSONAL SELECCIONADO</h2>
          </div>
          <div style="padding: 24px; color: #18181b; font-size: 13px; line-height: 1.6;">
            <p>Estimado(a) <strong>${grp.encargado_nombre}</strong> (Encargado de <strong>${deptListStr}</strong>):</p>
            <p>
              Con autorización previa de <strong>Recursos Humanos Unidad</strong> y <strong>RH Corporativo</strong>, el departamento de
              <strong>${vacante.departamento_destino}</strong> ha seleccionado de la Convocatoria <strong>${vacante.folio_convocatoria}</strong>
              para la vacante de <strong>${vacante.puesto_vacante}</strong> al siguiente personal adscrito a sus áreas:
            </p>
            ${rowsHtml}
            <p style="font-size: 12px; color: #52525b; margin-top: 16px;">
              Por favor confirma haciendo clic en <strong>"✅ SÍ, AUTORIZO"</strong> o <strong>"⏳ NO PUEDO EN ESA FECHA"</strong> en cada trabajador (o desde tu portal en <em>${originUrl}/movimientos-sindicato</em>). Tu respuesta notificará en automático a <strong>${vacante.departamento_destino}</strong> y a <strong>RH</strong>.
            </p>
          </div>
        </div>
      `

      const mailRes = await sendSystemEmail({
        to: grp.encargado_correo,
        subject,
        html,
      })

      if (admin) {
        await admin.from('movimientos_notificaciones_log').insert([
          {
            id_vacante: vacante.id_vacante || null,
            tipo_aviso: 'SELECCION_MINA_A_ORIGEN',
            remitente: `${vacante.departamento_destino} / RH`,
            destinatarios: `${grp.encargado_nombre} (${grp.encargado_correo}) — Áreas: ${deptListStr}`,
            asunto: subject,
            mensaje: `Se notificó la selección de ${grp.items.length} trabajador(es): ${grp.items
              .map((i) => i.nombre_completo)
              .join(', ')} para presentarse al puesto de ${vacante.puesto_vacante}.`,
            correo_enviado: mailRes.sent,
          },
        ])
      }

      dispatchResults.push({
        encargado: grp.encargado_nombre,
        correo: grp.encargado_correo,
        departamentos: deptListStr,
        trabajadores: grp.items.length,
        sent: mailRes.sent,
        error: mailRes.error,
      })
    }

    return NextResponse.json({
      success: true,
      results: dispatchResults,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error notificando a departamentos' }, { status: 500 })
  }
}
