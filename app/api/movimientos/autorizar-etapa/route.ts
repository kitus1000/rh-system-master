import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSystemEmail, resolveEmailConfig } from '@/utils/mailer'
import { formatShortDate } from '@/utils/contratistasConfig'

const DEFAULT_RULES = {
  jefe_rh_unidad_id: null as string | null,
  jefe_rh_unidad_nombre: 'Jefe de RH Unidad',
  jefe_rh_unidad_correo: 'jefe.rh.unidad@bacis.com',
  supt_rh_corporativo_id: null as string | null,
  supt_rh_corporativo_nombre: 'Superintendente de RH Corporativo',
  supt_rh_corporativo_correo: 'supt.rh.corporativo@bacis.com',
  sindicato_id: null as string | null,
  sindicato_nombre: 'Comité Sindical / Escalafón',
  sindicato_correo: 'sindicato@bacis.com',
  regla_vacante_libre_obligatoria: true,
  regla_orden_secuencial: true,
  regla_bloqueo_por_usuario: true,
  regla_requiere_jefe_rh_unidad: true,
  regla_requiere_supt_rh_corporativo: true,
  regla_requiere_liberacion_origen: true,
  regla_permitir_efecto_domino: true,
  regla_dias_convocatoria: 10,
  regla_respetar_10_dias: false,
  regla_notificar_correo_automatico: true,
}

function norm(s?: string | null): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function matchesEncargadoForDept(encargados: any[], deptoName: string, subDeptoName?: string | null) {
  const dClean = norm(deptoName)
  const sClean = norm(subDeptoName)
  for (const enc of encargados || []) {
    const mainClean = norm(enc.departamento_principal)
    const subs: string[] = Array.isArray(enc.sub_departamentos) ? enc.sub_departamentos : []
    const matchSub = subs.some((s) => {
      const sc = norm(s)
      return (sClean && (sc.includes(sClean) || sClean.includes(sc))) || (dClean && (sc.includes(dClean) || dClean.includes(sc)))
    })
    if (matchSub || (mainClean && (mainClean.includes(dClean) || dClean.includes(mainClean)))) {
      return enc
    }
  }
  return null
}

async function safeEmail(
  to: string | string[],
  subject: string,
  html: string,
  enabled: boolean,
  isTestMode?: boolean,
  actorName?: string
) {
  if (!enabled) return { sent: false, reason: 'DISABLED' as const }
  if (isTestMode) {
    return {
      sent: false,
      reason: 'TEST_MODE' as const,
      simulated: true,
      error: 'Modo Prueba activo: correo omitido para evitar rebotes.',
    }
  }
  const cleanTo = (Array.isArray(to) ? to : [to]).map((x) => (x || '').trim()).filter(Boolean)
  if (cleanTo.length === 0) return { sent: false, reason: 'NO_RECIPIENT' as const }
  return await sendSystemEmail({ to: cleanTo, subject, html, isTestMode, actorName })
}

function formatMailNote(mRes: { sent?: boolean; reason?: string; simulated?: boolean }): string {
  if (mRes.sent) return ''
  if (mRes.reason === 'TEST_MODE') {
    return ' (🧪 Modo Prueba: alerta guardada en bandeja; correo SMTP omitido).'
  }
  if (mRes.reason === 'PLACEHOLDER_DOMAIN') {
    return ' (ℹ️ Correo omitido: direcciones internas @bacis.com sin buzón real).'
  }
  return ''
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      id_postulacion,
      id_vacante,
      etapa,
      user_id,
      user_email,
      user_name,
      user_rol,
      decision,
      fecha_presentacion,
      plan_avance,
      comentario,
      nueva_fecha,
      domino_folio,
      baseUrl,
      bypass_lock,
      modo_prueba,
    } = body

    if (!etapa || (!id_postulacion && !id_vacante)) {
      return NextResponse.json({ error: 'Se requiere etapa y (id_postulacion o id_vacante).' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Configuración de Supabase incompleta.' }, { status: 500 })
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Cargar regla vigente, encargados y configuración de correo
    const [{ data: ruleRow }, { data: encList }, mailCfg] = await Promise.all([
      admin.from('movimientos_reglas_autorizacion').select('*').limit(1).maybeSingle(),
      admin.from('movimientos_encargados_subdeptos').select('*'),
      resolveEmailConfig(),
    ])

    const reglas = { ...DEFAULT_RULES, ...(ruleRow || {}) }
    const originUrl = baseUrl || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const actorEmail = (user_email || '').toLowerCase().trim()
    const actorRolLower = (user_rol || '').toLowerCase()
    const actorName = user_name || user_email || 'Usuario Autorizador'
    const autoMail = Boolean(reglas.regla_notificar_correo_automatico)
    const isTestMode = Boolean(
      modo_prueba ||
      bypass_lock ||
      String(actorName).toLowerCase().includes('modo prueba')
    )

    // =========================================================================
    // ETAPA APERTURA: PUBLICAR_VACANTE (Al abrir convocatoria o liberar plaza por Efecto Dominó)
    // Entera de inmediato a: Dirección de RH (Corp + Unidad), Sindicato Secc. 45 y Todos los Departamentos
    // =========================================================================
    if (etapa === 'PUBLICAR_VACANTE') {
      const { data: vacRow, error: vacErr } = await admin
        .from('movimientos_vacantes')
        .select('*')
        .eq('id_vacante', id_vacante)
        .maybeSingle()

      if (vacErr || !vacRow) {
        return NextResponse.json({ error: 'No se encontró la vacante publicada.' }, { status: 404 })
      }

      const encDestino = matchesEncargadoForDept(
        encList || [],
        vacRow.departamento_destino || 'Mina',
        vacRow.sub_departamento_destino
      )
      const plazasLibres = Math.max(0, (vacRow.plazas_totales || 1) - (vacRow.plazas_ocupadas || 0))
      const titulo = `📢 Vacante Publicada (${vacRow.folio_convocatoria}): ${vacRow.puesto_vacante} en ${vacRow.departamento_destino} (${plazasLibres} plaza(s))`
      const mensaje = `Se abrió y boletinó la convocatoria ${vacRow.folio_convocatoria} por ${vacRow.dias_convocatoria || 10} días (Art. 116 C.C.T. Secc. 45) para ${plazasLibres} plaza(s) de "${vacRow.puesto_vacante}" en ${vacRow.departamento_destino}${vacRow.sub_departamento_destino ? ` (${vacRow.sub_departamento_destino})` : ''}.${vacRow.liberada_por_nombre ? ` Plaza liberada por ascenso de ${vacRow.liberada_por_nombre}.` : ''} El personal con mayor antigüedad y competencia ya puede inscribirse.`

      const bandejaRows: any[] = [
        {
          id_usuario_destino: reglas.supt_rh_corporativo_id || null,
          rol_destino: 'Superintendente de RH Corporativo',
          correo_destino: reglas.supt_rh_corporativo_correo,
          departamento_destino: 'RECURSOS HUMANOS',
          id_vacante: vacRow.id_vacante,
          etapa: 'CONVOCATORIA_ABIERTA',
          titulo,
          mensaje: `[Dirección de RH Enterada] ${mensaje}`,
        },
        {
          id_usuario_destino: reglas.jefe_rh_unidad_id || null,
          rol_destino: 'Jefe de RH Unidad',
          correo_destino: reglas.jefe_rh_unidad_correo,
          departamento_destino: 'RECURSOS HUMANOS',
          id_vacante: vacRow.id_vacante,
          etapa: 'CONVOCATORIA_ABIERTA',
          titulo,
          mensaje,
        },
        {
          id_usuario_destino: reglas.sindicato_id || null,
          rol_destino: 'Sindicato',
          correo_destino: reglas.sindicato_correo,
          departamento_destino: 'SINDICATO',
          id_vacante: vacRow.id_vacante,
          etapa: 'CONVOCATORIA_ABIERTA',
          titulo,
          mensaje: `[Boletín Sindical Art. 116 C.C.T.] ${mensaje}`,
        },
      ]

      const seenDepts = new Set<string>()
      for (const enc of encList || []) {
        const dKey = norm(enc.departamento_principal)
        if (!dKey || seenDepts.has(dKey)) continue
        seenDepts.add(dKey)
        bandejaRows.push({
          id_usuario_destino: enc.id_usuario_encargado || null,
          rol_destino: 'Jefe de Departamento',
          correo_destino: enc.correo_encargado,
          departamento_destino: enc.departamento_principal,
          id_vacante: vacRow.id_vacante,
          etapa: 'CONVOCATORIA_ABIERTA',
          titulo,
          mensaje,
        })
      }

      if (!seenDepts.has(norm(vacRow.departamento_destino))) {
        bandejaRows.push({
          id_usuario_destino: encDestino?.id_usuario_encargado || null,
          rol_destino: 'Jefe de Departamento',
          correo_destino: encDestino?.correo_encargado || reglas.jefe_rh_unidad_correo,
          departamento_destino: vacRow.departamento_destino,
          id_vacante: vacRow.id_vacante,
          etapa: 'CONVOCATORIA_ABIERTA',
          titulo,
          mensaje,
        })
      }

      await admin.from('movimientos_bandeja_notificaciones').insert(bandejaRows).then(() => {})

      const allEmails = Array.from(
        new Set(
          [
            reglas.supt_rh_corporativo_correo,
            reglas.jefe_rh_unidad_correo,
            reglas.sindicato_correo,
            mailCfg.rhNotificationEmail,
            ...(encList || []).map((e: any) => e.correo_encargado),
          ].filter(Boolean)
        )
      ) as string[]

      const mailRes = await safeEmail(
        allEmails,
        titulo,
        `
          <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden;">
            <div style="background: #0f172a; color: #fff; padding: 18px 22px; border-bottom: 4px solid #f59e0b;">
              <div style="font-size: 11px; color: #fbbf24; font-weight: bold;">GRUPO MINERO BACÍS • ART. 116 C.C.T. SECC. 45 • DIRECCIÓN RH &amp; DEPARTAMENTOS</div>
              <h3 style="margin: 6px 0 0;">APERTURA DE VACANTE Y CONVOCATORIA DE ESCALAFÓN (${vacRow.dias_convocatoria || 10} DÍAS)</h3>
            </div>
            <div style="padding: 20px; color: #18181b; font-size: 13px; line-height: 1.6;">
              <p>${mensaje}</p>
              <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; margin: 12px 0;">
                <div><strong>Folio:</strong> ${vacRow.folio_convocatoria}</div>
                <div><strong>Categoría Vacante:</strong> ${vacRow.puesto_vacante}</div>
                <div><strong>Departamento Destino:</strong> ${vacRow.departamento_destino}${vacRow.sub_departamento_destino ? ` (${vacRow.sub_departamento_destino})` : ''}</div>
                <div><strong>Plazas Disponibles:</strong> ${plazasLibres}</div>
                <div><strong>Cierre de Inscripciones:</strong> ${formatShortDate(vacRow.fecha_cierre_inscripcion)}</div>
              </div>
              <p><a href="${originUrl}/movimientos-sindicato" style="display:inline-block; background:#f59e0b; color:#000; font-weight:bold; padding:10px 18px; border-radius:8px; text-decoration:none;">Ver Convocatoria e Inscribir Personal</a></p>
            </div>
          </div>
        `,
        autoMail,
        isTestMode,
        actorName
      )
      const emailNote = formatMailNote(mailRes)

      await admin.from('movimientos_notificaciones_log').insert([
        {
          id_vacante: vacRow.id_vacante,
          tipo_aviso: 'CONVOCATORIA_10_DIAS',
          remitente: actorName,
          destinatarios: `Dirección RH (Corp y Unidad), Sindicato Secc. 45 y Todos los Departamentos (${vacRow.departamento_destino})`,
          asunto: titulo,
          mensaje,
          correo_enviado: mailRes.sent,
        },
      ])

      return NextResponse.json({
        success: true,
        etapa,
        emailSent: mailRes.sent,
        emailSimulated: Boolean(isTestMode || (mailRes as any).simulated),
        message: `📢 Convocatoria ${vacRow.folio_convocatoria} notificada a Dirección de RH, Sindicato Secc. 45 y todos los Departamentos.${emailNote}`,
      })
    }

    const { data: post, error: postErr } = await admin
      .from('movimientos_postulantes')
      .select('*, movimientos_vacantes(*)')
      .eq('id_postulacion', id_postulacion)
      .maybeSingle()

    if (postErr || !post) {
      return NextResponse.json({ error: 'No se encontró la postulación solicitada.' }, { status: 404 })
    }

    const vac = post.movimientos_vacantes

    // =========================================================================
    // ETAPA 0: NOTIFICAR_INSCRIPCION (Se dispara al inscribir un postulante)
    // Entera de inmediato a: Jefe RH Unidad (Paso 1), Dirección RH Corp, Depto Origen y Depto Destino
    // =========================================================================
    if (etapa === 'NOTIFICAR_INSCRIPCION') {
      const targetEmail = reglas.jefe_rh_unidad_correo
      const encOrigen = matchesEncargadoForDept(encList || [], post.departamento_actual, post.sub_departamento_actual)
      const encDestino = matchesEncargadoForDept(encList || [], vac?.departamento_destino || 'Mina', vac?.sub_departamento_destino)
      const origenCorreo = post.encargado_origen_correo || encOrigen?.correo_encargado || ''
      const destinoCorreo = encDestino?.correo_encargado || ''

      const titulo = `Paso 1 Pendiente: Nueva postulación de ${post.nombre_completo} (${post.anos_antiguedad || 0} años) para ${vac?.puesto_vacante || post.puesto_postulado}`
      const mensaje = `El trabajador ${post.nombre_completo} (${post.departamento_actual} - ${post.puesto_actual}, antigüedad: ${post.anos_antiguedad || 0} años) se inscribió por Escalafón Art. 116 C.C.T. a la convocatoria ${vac?.folio_convocatoria || ''} (${vac?.puesto_vacante || post.puesto_postulado} en ${vac?.departamento_destino || 'Mina'}). Requiere 1ª Firma de Jefe de RH Unidad. Dirección de RH y los departamentos involucrados quedan enterados.`

      await admin
        .from('movimientos_bandeja_notificaciones')
        .insert([
          {
            id_usuario_destino: reglas.jefe_rh_unidad_id || null,
            rol_destino: 'Jefe de RH Unidad',
            correo_destino: targetEmail,
            departamento_destino: 'RECURSOS HUMANOS',
            id_vacante: post.id_vacante,
            id_postulacion: post.id_postulacion,
            etapa: 'PASO_1_RH_UNIDAD',
            titulo,
            mensaje,
          },
          {
            id_usuario_destino: reglas.supt_rh_corporativo_id || null,
            rol_destino: 'Superintendente de RH Corporativo',
            correo_destino: reglas.supt_rh_corporativo_correo,
            departamento_destino: 'RECURSOS HUMANOS',
            id_vacante: post.id_vacante,
            id_postulacion: post.id_postulacion,
            etapa: 'AVISO_DIRECCION_RH',
            titulo: `[Enterado Dirección RH] ${titulo}`,
            mensaje,
          },
          {
            id_usuario_destino: encOrigen?.id_usuario_encargado || null,
            rol_destino: 'Jefe de Departamento',
            correo_destino: origenCorreo || targetEmail,
            departamento_destino: post.departamento_actual,
            id_vacante: post.id_vacante,
            id_postulacion: post.id_postulacion,
            etapa: 'AVISO_INSCRIPCION_ORIGEN',
            titulo: `👷 Trabajador de tu área inscrito en Escalafón: ${post.nombre_completo} → ${vac?.puesto_vacante || post.puesto_postulado}`,
            mensaje,
          },
          {
            id_usuario_destino: encDestino?.id_usuario_encargado || null,
            rol_destino: 'Jefe de Departamento',
            correo_destino: destinoCorreo || targetEmail,
            departamento_destino: vac?.departamento_destino || 'Mina',
            id_vacante: post.id_vacante,
            id_postulacion: post.id_postulacion,
            etapa: 'AVISO_INSCRIPCION_DESTINO',
            titulo: `📋 Nuevo candidato inscrito para tu vacante (${vac?.puesto_vacante || post.puesto_postulado}): ${post.nombre_completo}`,
            mensaje,
          },
        ])
        .then(() => {})

      const notifyInscripcionTargets = Array.from(
        new Set(
          [
            targetEmail,
            reglas.supt_rh_corporativo_correo,
            mailCfg.rhNotificationEmail,
            origenCorreo,
            destinoCorreo,
          ].filter(Boolean)
        )
      ) as string[]

      const mailRes = await safeEmail(
        notifyInscripcionTargets,
        `[PASO 1 - AUTORIZACIÓN RH UNIDAD & DIRECCIÓN RH] Nuevo Postulante C.C.T.: ${post.nombre_completo} (${vac?.puesto_vacante || post.puesto_postulado})`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 14px; overflow: hidden;">
            <div style="background: #0f172a; color: #fff; padding: 18px 22px; border-bottom: 4px solid #f59e0b;">
              <div style="font-size: 11px; color: #fbbf24; font-weight: bold;">GRUPO MINERO BACÍS • ESCALAFÓN ART. 116 C.C.T. • DIRECCIÓN RH &amp; DEPARTAMENTOS</div>
              <h3 style="margin: 6px 0 0;">NUEVA INSCRIPCIÓN EN CONVOCATORIA — TURNO PASO 1 (JEFE RH UNIDAD)</h3>
            </div>
            <div style="padding: 20px; color: #18181b; font-size: 13px; line-height: 1.6;">
              <p>Aviso oficial para <strong>${reglas.jefe_rh_unidad_nombre}</strong>, <strong>Dirección de RH (${reglas.supt_rh_corporativo_nombre})</strong>, <strong>${post.departamento_actual}</strong> y <strong>${vac?.departamento_destino || 'Mina'}</strong>:</p>
              <p>${mensaje}</p>
              <p><a href="${originUrl}/movimientos-sindicato" style="display:inline-block; background:#f59e0b; color:#000; font-weight:bold; padding:10px 18px; border-radius:8px; text-decoration:none;">Entrar a Validar Escalafón (Paso 1)</a></p>
            </div>
          </div>
        `,
        autoMail,
        isTestMode,
        actorName
      )

      await admin.from('movimientos_notificaciones_log').insert([
        {
          id_vacante: post.id_vacante,
          id_postulacion: post.id_postulacion,
          tipo_aviso: 'AVISO_JEFE_RH_UNIDAD',
          remitente: 'Sistema de Convocatorias / Sindicato',
          destinatarios: `Jefe RH Unidad, Dirección RH Corporativo, ${post.departamento_actual} y ${vac?.departamento_destino || 'Mina'}`,
          asunto: titulo,
          mensaje,
          correo_enviado: mailRes.sent,
        },
      ])

      return NextResponse.json({
        success: true,
        emailSent: mailRes.sent,
        emailSimulated: Boolean(isTestMode || (mailRes as any).simulated),
        nextStage: 'PASO_1_RH_UNIDAD',
      })
    }

    // =========================================================================
    // ETAPA 1: RH_UNIDAD (Jefe de RH Unidad)
    // =========================================================================
    if (etapa === 'RH_UNIDAD') {
      if (reglas.regla_bloqueo_por_usuario && !bypass_lock) {
        const isAssignedId = Boolean(reglas.jefe_rh_unidad_id && user_id && reglas.jefe_rh_unidad_id === user_id)
        const isAssignedEmail = Boolean(reglas.jefe_rh_unidad_correo && actorEmail && reglas.jefe_rh_unidad_correo.toLowerCase().trim() === actorEmail)
        const isRoleMatch =
          actorRolLower.includes('rh unidad') ||
          actorRolLower === 'jefe de rh unidad' ||
          actorRolLower.includes('recursos humanos') ||
          actorRolLower.includes('admin')
        if (!isAssignedId && !isAssignedEmail && !isRoleMatch) {
          return NextResponse.json(
            {
              error: `🔒 Bloqueado por Matriz de Reglas: Solo el Jefe de RH Unidad titular (${reglas.jefe_rh_unidad_nombre} — ${reglas.jefe_rh_unidad_correo}) puede autorizar esta etapa con su usuario.`,
            },
            { status: 403 }
          )
        }
      }

      const approve = decision !== 'RECHAZAR'
      await admin
        .from('movimientos_postulantes')
        .update({
          autorizado_rh_local: approve,
          autorizado_rh_local_por: actorName,
          autorizado_rh_local_user_id: user_id || null,
          fecha_autorizacion_rh_local: new Date().toISOString(),
          estatus_movimiento: approve ? 'Esperando Vo.Bo. RH Corporativo' : 'Rechazado por RH Unidad',
        })
        .eq('id_postulacion', id_postulacion)

      // Marcar alertas PASO_1_RH_UNIDAD como atendidas
      await admin
        .from('movimientos_bandeja_notificaciones')
        .update({ atendida: true, leida: true })
        .eq('id_postulacion', id_postulacion)
        .eq('etapa', 'PASO_1_RH_UNIDAD')

      let emailSent = false
      let emailNote = ''
      if (approve) {
        const corpEmail = reglas.supt_rh_corporativo_correo
        const titulo = `Paso 2 Pendiente: ${post.nombre_completo} ya autorizado por RH Unidad (${actorName})`
        const mensaje = `El Jefe de RH Unidad (${actorName}) autorizó al postulante ${post.nombre_completo} para ${vac?.puesto_vacante || post.puesto_postulado} (${vac?.departamento_destino || 'Mina'}). Ahora requiere autorización del Superintendente de RH Corporativo.`

        await admin.from('movimientos_bandeja_notificaciones').insert([
          {
            id_usuario_destino: reglas.supt_rh_corporativo_id || null,
            rol_destino: 'Superintendente de RH Corporativo',
            correo_destino: corpEmail,
            departamento_destino: vac?.departamento_destino || null,
            id_vacante: post.id_vacante,
            id_postulacion: post.id_postulacion,
            etapa: 'PASO_2_RH_CORPORATIVO',
            titulo,
            mensaje,
          },
        ])

        const mRes = await safeEmail(
          corpEmail,
          `[PASO 2 - SUPT. RH CORPORATIVO] Autorizar Movimiento: ${post.nombre_completo} → ${vac?.puesto_vacante || post.puesto_postulado}`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 14px; overflow: hidden;">
              <div style="background: #0f172a; color: #fff; padding: 18px 22px; border-bottom: 4px solid #f59e0b;">
                <div style="font-size: 11px; color: #fbbf24; font-weight: bold;">GRUPO MINERO BACÍS • ESCALAFÓN CORPORATIVO</div>
                <h3 style="margin: 6px 0 0;">PASO 2: TURNO DEL SUPERINTENDENTE DE RH CORPORATIVO</h3>
              </div>
              <div style="padding: 20px; color: #18181b; font-size: 13px; line-height: 1.6;">
                <p>Hola <strong>${reglas.supt_rh_corporativo_nombre}</strong>,</p>
                <p>${mensaje}</p>
                <p><a href="${originUrl}/movimientos-sindicato" style="display:inline-block; background:#059669; color:#fff; font-weight:bold; padding:10px 18px; border-radius:8px; text-decoration:none;">Ingresar a Firmar (Paso 2)</a></p>
              </div>
            </div>
          `,
          autoMail,
          isTestMode,
          actorName
        )
        emailSent = mRes.sent
        emailNote = formatMailNote(mRes)

        await admin.from('movimientos_notificaciones_log').insert([
          {
            id_vacante: post.id_vacante,
            id_postulacion: post.id_postulacion,
            tipo_aviso: 'AUTORIZACION_RH_UNIDAD_A_CORP',
            remitente: actorName,
            destinatarios: `${reglas.supt_rh_corporativo_nombre} (${corpEmail})`,
            asunto: titulo,
            mensaje,
            correo_enviado: emailSent,
          },
        ])
      }

      return NextResponse.json({
        success: true,
        etapa,
        emailSent,
        emailSimulated: isTestMode,
        message: approve
          ? `✅ Autorización registrada por ${actorName}. Notificación registrada para Superintendente de RH Corporativo (${reglas.supt_rh_corporativo_correo}).${emailNote}`
          : 'Postulación rechazada por RH Unidad.',
      })
    }

    // =========================================================================
    // ETAPA 2: RH_CORPORATIVO (Superintendente de RH Corporativo)
    // =========================================================================
    if (etapa === 'RH_CORPORATIVO') {
      if (reglas.regla_orden_secuencial && reglas.regla_requiere_jefe_rh_unidad && !post.autorizado_rh_local && !bypass_lock) {
        return NextResponse.json(
          {
            error: `🛑 Regla Secuencial Activa: Primero debe autorizar el Jefe de RH Unidad (${reglas.jefe_rh_unidad_nombre}) antes de que firme RH Corporativo.`,
          },
          { status: 400 }
        )
      }

      if (reglas.regla_bloqueo_por_usuario && !bypass_lock) {
        const isAssignedId = Boolean(reglas.supt_rh_corporativo_id && user_id && reglas.supt_rh_corporativo_id === user_id)
        const isAssignedEmail = Boolean(reglas.supt_rh_corporativo_correo && actorEmail && reglas.supt_rh_corporativo_correo.toLowerCase().trim() === actorEmail)
        const isRoleMatch =
          actorRolLower.includes('corporativo') ||
          actorRolLower.includes('recursos humanos') ||
          actorRolLower.includes('admin')
        if (!isAssignedId && !isAssignedEmail && !isRoleMatch) {
          return NextResponse.json(
            {
              error: `🔒 Bloqueado por Matriz de Reglas: Solo el Superintendente de RH Corporativo titular (${reglas.supt_rh_corporativo_nombre} — ${reglas.supt_rh_corporativo_correo}) puede autorizar esta etapa con su usuario.`,
            },
            { status: 403 }
          )
        }
      }

      const approve = decision !== 'RECHAZAR'
      await admin
        .from('movimientos_postulantes')
        .update({
          autorizado_rh_corporativo: approve,
          autorizado_rh_corporativo_por: actorName,
          autorizado_rh_corporativo_user_id: user_id || null,
          fecha_autorizacion_rh_corporativo: new Date().toISOString(),
          estatus_movimiento: approve ? 'Autorizado por RH y Corporativo' : 'Rechazado por RH Corporativo',
        })
        .eq('id_postulacion', id_postulacion)

      await admin
        .from('movimientos_bandeja_notificaciones')
        .update({ atendida: true, leida: true })
        .eq('id_postulacion', id_postulacion)
        .eq('etapa', 'PASO_2_RH_CORPORATIVO')

      let emailSent = false
      let emailNote = ''
      const encDestino = matchesEncargadoForDept(encList || [], vac?.departamento_destino || 'Mina', vac?.sub_departamento_destino)
      if (approve) {
        await admin
          .from('movimientos_vacantes')
          .update({
            estatus_rh_local: 'Autorizado',
            estatus_rh_corporativo: 'Autorizado',
            autorizado_rh_corporativo_por: actorName,
            estatus_vacante: 'En Selección y Plan de Avance',
          })
          .eq('id_vacante', post.id_vacante)

        const destinoCorreo = encDestino?.correo_encargado || 'jefe.mina@bacis.com'
        const destinoNombre = encDestino?.nombre_encargado || `Jefe de ${vac?.departamento_destino || 'Mina'}`
        const titulo = `Paso 3 Pendiente (${vac?.departamento_destino || 'Mina'}): Plan de Avance y Fecha para ${post.nombre_completo}`
        const mensaje = `El Superintendente de RH Corporativo (${actorName}) y RH Unidad aprobaron a ${post.nombre_completo}. Como responsable de ${vac?.departamento_destino || 'Mina'}, ya puedes seleccionarlo, definir el Plan de Avance y fijar fecha de presentación.`

        await admin.from('movimientos_bandeja_notificaciones').insert([
          {
            id_usuario_destino: encDestino?.id_usuario_encargado || null,
            rol_destino: 'Jefe de Departamento',
            correo_destino: destinoCorreo,
            departamento_destino: vac?.departamento_destino || 'Mina',
            id_vacante: post.id_vacante,
            id_postulacion: post.id_postulacion,
            etapa: 'PASO_3_PLAN_DESTINO',
            titulo,
            mensaje,
          },
        ])

        const mRes = await safeEmail(
          destinoCorreo,
          `[PASO 3 - ${vac?.departamento_destino || 'MINA'}] Postulante Autorizado por RH Corporativo: ${post.nombre_completo}`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 14px; overflow: hidden;">
              <div style="background: #172554; color: #fff; padding: 18px 22px; border-bottom: 4px solid #f59e0b;">
                <div style="font-size: 11px; color: #fbbf24; font-weight: bold;">GRUPO MINERO BACÍS • VACANTE ${vac?.folio_convocatoria || ''}</div>
                <h3 style="margin: 6px 0 0;">PASO 3: DEFINIR PLAN DE AVANCE Y FECHA (${vac?.departamento_destino || 'MINA'})</h3>
              </div>
              <div style="padding: 20px; color: #18181b; font-size: 13px; line-height: 1.6;">
                <p>Estimado(a) <strong>${destinoNombre}</strong>,</p>
                <p>${mensaje}</p>
                <p><a href="${originUrl}/movimientos-sindicato" style="display:inline-block; background:#f59e0b; color:#000; font-weight:bold; padding:10px 18px; border-radius:8px; text-decoration:none;">Seleccionar Fecha y Plan de Avance</a></p>
              </div>
            </div>
          `,
          autoMail,
          isTestMode,
          actorName
        )
        emailSent = mRes.sent
        emailNote = formatMailNote(mRes)

        await admin.from('movimientos_notificaciones_log').insert([
          {
            id_vacante: post.id_vacante,
            id_postulacion: post.id_postulacion,
            tipo_aviso: 'AUTORIZACION_CORP_A_DESTINO',
            remitente: actorName,
            destinatarios: `${destinoNombre} (${destinoCorreo})`,
            asunto: titulo,
            mensaje,
            correo_enviado: emailSent,
          },
        ])
      }

      return NextResponse.json({
        success: true,
        etapa,
        emailSent,
        emailSimulated: isTestMode,
        message: approve
          ? `✅ Firma Corporativa registrada por ${actorName}. Alerta registrada para responsable de ${vac?.departamento_destino || 'Mina'}.${emailNote}`
          : 'Postulación rechazada por RH Corporativo.',
      })
    }

    // =========================================================================
    // ETAPA 3: PLAN_DESTINO (Departamento de la Vacante ej. Mina elige fecha/plan y notifica a Origen)
    // =========================================================================
    if (etapa === 'PLAN_DESTINO') {
      if (reglas.regla_orden_secuencial && !bypass_lock) {
        if (reglas.regla_requiere_jefe_rh_unidad && !post.autorizado_rh_local) {
          return NextResponse.json({ error: '🛑 Regla Secuencial: Falta autorización del Jefe de RH Unidad.' }, { status: 400 })
        }
        if (reglas.regla_requiere_supt_rh_corporativo && !post.autorizado_rh_corporativo) {
          return NextResponse.json({ error: '🛑 Regla Secuencial: Falta autorización del Superintendente de RH Corporativo.' }, { status: 400 })
        }
      }

      const encDestino = matchesEncargadoForDept(encList || [], vac?.departamento_destino || 'Mina', vac?.sub_departamento_destino)
      if (reglas.regla_bloqueo_por_usuario && encDestino && !bypass_lock) {
        const isAssignedId = Boolean(encDestino.id_usuario_encargado && user_id && encDestino.id_usuario_encargado === user_id)
        const isAssignedEmail = Boolean(encDestino.correo_encargado && actorEmail && encDestino.correo_encargado.toLowerCase().trim() === actorEmail)
        const isNotRHOrUnion = !actorRolLower.includes('rh unidad') && !actorRolLower.includes('corporativo') && !actorRolLower.includes('sindicato')
        const isDeptRole = (actorRolLower.includes('jefe de departamento') || actorRolLower === 'jefe' || actorRolLower === 'supervisor' || actorRolLower.includes('admin')) && isNotRHOrUnion
        const hasSpecificTitular = Boolean(encDestino.id_usuario_encargado || encDestino.correo_encargado)
        const canAuthorizeDestino = isAssignedId || isAssignedEmail || isDeptRole || !hasSpecificTitular
        if (!canAuthorizeDestino) {
          return NextResponse.json(
            {
              error: `🔒 Bloqueado por Matriz de Reglas: Solo el Encargado del Departamento Destino (${encDestino.nombre_encargado} — ${encDestino.correo_encargado}) puede seleccionar y asignar plan.`,
            },
            { status: 403 }
          )
        }
      }

      const chosenDate = fecha_presentacion || post.fecha_presentacion || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
      const chosenPlan = plan_avance || post.plan_avance_asignado || vac?.plan_avance_departamento || 'Plan de capacitación y evaluación en área destino.'

      await admin
        .from('movimientos_postulantes')
        .update({
          seleccionado_por_destino: true,
          fecha_presentacion: chosenDate,
          plan_avance_asignado: chosenPlan,
          seleccionado_por_usuario: actorName,
          fecha_seleccion_destino: new Date().toISOString(),
          correo_enviado_origen: true,
          fecha_correo_origen: new Date().toISOString(),
          estatus_movimiento:
            post.respuesta_depto_origen === 'Autorizado (Sí)'
              ? 'Confirmado para Mover (SÍ)'
              : 'Esperando Respuesta Depto Origen',
        })
        .eq('id_postulacion', id_postulacion)

      await admin
        .from('movimientos_bandeja_notificaciones')
        .update({ atendida: true, leida: true })
        .eq('id_postulacion', id_postulacion)
        .eq('etapa', 'PASO_3_PLAN_DESTINO')

      const encOrigen = matchesEncargadoForDept(encList || [], post.departamento_actual, post.sub_departamento_actual)
      const origenCorreo = post.encargado_origen_correo || encOrigen?.correo_encargado || 'jefe.planta.de@bacis.com'
      const origenNombre = post.encargado_origen_nombre || encOrigen?.nombre_encargado || `Encargado de ${post.departamento_actual}`

      const titulo = `Paso 4 Pendiente: ${vac?.departamento_destino || 'Mina'} seleccionó a ${post.nombre_completo} (${post.departamento_actual})`
      const mensaje = `El área ${vac?.departamento_destino || 'Mina'} eligió a ${post.nombre_completo} (${post.puesto_actual} en ${post.departamento_actual}) para presentarse el ${formatShortDate(chosenDate)} como ${vac?.puesto_vacante || post.puesto_postulado}. Plan: ${chosenPlan}. Se requiere tu respuesta SÍ o NO.`

      await admin.from('movimientos_bandeja_notificaciones').insert([
        {
          id_usuario_destino: encOrigen?.id_usuario_encargado || null,
          rol_destino: 'Jefe de Departamento',
          correo_destino: origenCorreo,
          departamento_destino: post.departamento_actual,
          id_vacante: post.id_vacante,
          id_postulacion: post.id_postulacion,
          etapa: 'PASO_4_LIBERACION_ORIGEN',
          titulo,
          mensaje,
        },
        {
          id_usuario_destino: reglas.supt_rh_corporativo_id || null,
          rol_destino: 'Superintendente de RH Corporativo',
          correo_destino: reglas.supt_rh_corporativo_correo,
          departamento_destino: 'RECURSOS HUMANOS',
          id_vacante: post.id_vacante,
          id_postulacion: post.id_postulacion,
          etapa: 'AVISO_DIRECCION_RH',
          titulo: `[Copia Dirección RH] ${titulo}`,
          mensaje,
        },
      ])

      const token = post.token_respuesta || post.id_postulacion
      const urlSi = `${originUrl}/api/movimientos/responder-correo?id=${encodeURIComponent(post.id_postulacion)}&token=${encodeURIComponent(token)}&decision=SI`
      const urlNo = `${originUrl}/api/movimientos/responder-correo?id=${encodeURIComponent(post.id_postulacion)}&token=${encodeURIComponent(token)}&decision=NO`

      const step3Targets = Array.from(
        new Set(
          [
            origenCorreo,
            reglas.supt_rh_corporativo_correo,
            reglas.jefe_rh_unidad_correo,
            mailCfg.rhNotificationEmail,
          ].filter(Boolean)
        )
      ) as string[]

      const mRes = await safeEmail(
        step3Targets,
        `[PASO 4 - LIBERACIÓN ${post.departamento_actual.toUpperCase()}] ${post.nombre_completo} elegido para ${vac?.puesto_vacante || post.puesto_postulado}`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden;">
            <div style="background: #0f172a; color: #fff; padding: 18px 22px; border-bottom: 4px solid #f59e0b;">
              <div style="font-size: 11px; color: #fbbf24; font-weight: bold;">GRUPO MINERO BACÍS • SOLICITUD DE LIBERACIÓN DE PERSONAL</div>
              <h3 style="margin: 6px 0 0;">SELECCIONADO PARA ${vac?.puesto_vacante || post.puesto_postulado} (${vac?.departamento_destino || 'Mina'})</h3>
            </div>
            <div style="padding: 20px; color: #18181b; font-size: 13px; line-height: 1.6;">
              <p>Estimado(a) <strong>${origenNombre}</strong>:</p>
              <p>${mensaje}</p>
              <div style="margin-top: 16px;">
                <a href="${urlSi}" style="display:inline-block; background:#059669; color:#fff; font-weight:bold; padding:10px 16px; border-radius:8px; text-decoration:none; margin-right:8px;">✅ SÍ, AUTORIZO SU SALIDA</a>
                <a href="${urlNo}" style="display:inline-block; background:#e11d48; color:#fff; font-weight:bold; padding:10px 16px; border-radius:8px; text-decoration:none;">⏳ NO PUEDO (REPROGRAMAR FECHA)</a>
              </div>
            </div>
          </div>
        `,
        autoMail,
        isTestMode,
        actorName
      )
      const emailNote = formatMailNote(mRes)

      await admin.from('movimientos_notificaciones_log').insert([
        {
          id_vacante: post.id_vacante,
          id_postulacion: post.id_postulacion,
          tipo_aviso: 'SELECCION_MINA_A_ORIGEN',
          remitente: `${actorName} (${vac?.departamento_destino || 'Mina'})`,
          destinatarios: `${origenNombre} (${origenCorreo})`,
          asunto: titulo,
          mensaje,
          correo_enviado: mRes.sent,
        },
      ])

      return NextResponse.json({
        success: true,
        etapa,
        emailSent: mRes.sent,
        emailSimulated: isTestMode,
        message: `✅ Plan y fecha (${formatShortDate(chosenDate)}) confirmados. Aviso registrado para ${origenNombre} (${origenCorreo}).${emailNote}`,
      })
    }

    // =========================================================================
    // ETAPA 4: LIBERACION_ORIGEN (Encargado Depto/Sub-depto Origen responde SÍ o NO)
    // =========================================================================
    if (etapa === 'LIBERACION_ORIGEN') {
      if (reglas.regla_orden_secuencial && !post.seleccionado_por_destino && !bypass_lock) {
        return NextResponse.json(
          { error: '🛑 Regla Secuencial: El departamento de la vacante aún no ha seleccionado al candidato con fecha y plan.' },
          { status: 400 }
        )
      }

      const encOrigen = matchesEncargadoForDept(encList || [], post.departamento_actual, post.sub_departamento_actual)
      if (reglas.regla_bloqueo_por_usuario && !bypass_lock) {
        const expectedEmail = (post.encargado_origen_correo || encOrigen?.correo_encargado || '').toLowerCase().trim()
        const isAssignedId = Boolean(encOrigen?.id_usuario_encargado && user_id && encOrigen.id_usuario_encargado === user_id)
        const isAssignedEmail = Boolean(expectedEmail && actorEmail && expectedEmail === actorEmail)
        const isNotRHOrUnion = !actorRolLower.includes('rh unidad') && !actorRolLower.includes('corporativo') && !actorRolLower.includes('sindicato')
        const isDeptRole = (actorRolLower.includes('jefe de departamento') || actorRolLower === 'jefe' || actorRolLower === 'supervisor' || actorRolLower.includes('admin')) && isNotRHOrUnion
        const hasSpecificTitular = Boolean(encOrigen?.id_usuario_encargado || expectedEmail)
        const canAuthorizeOrigen = isAssignedId || isAssignedEmail || isDeptRole || !hasSpecificTitular
        if (!canAuthorizeOrigen) {
          return NextResponse.json(
            {
              error: `🔒 Bloqueado por Matriz de Reglas: Solo el Encargado del Área de Origen (${encOrigen?.nombre_encargado || post.encargado_origen_nombre} — ${expectedEmail}) puede autorizar la salida del trabajador.`,
            },
            { status: 403 }
          )
        }
      }

      const isYes = decision !== 'NO'
      const respuestaLabel = isYes ? 'Autorizado (Sí)' : 'No / Reprogramar Fecha'
      const nuevoEstatus = isYes ? 'Confirmado para Mover (SÍ)' : 'Reprogramar Fecha (NO)'

      const upPayload: any = {
        respuesta_depto_origen: respuestaLabel,
        estatus_movimiento: nuevoEstatus,
        fecha_respuesta_origen: new Date().toISOString(),
        aviso_retorno_destino: true,
        comentario_depto_origen:
          comentario ||
          (isYes
            ? `Salida autorizada por ${actorName}`
            : `No disponible en fecha — solicita reprogramar (${actorName})`),
      }
      if (nueva_fecha) {
        upPayload.nueva_fecha_reprogramada = nueva_fecha
        upPayload.fecha_presentacion = nueva_fecha
      }

      await admin.from('movimientos_postulantes').update(upPayload).eq('id_postulacion', id_postulacion)

      await admin
        .from('movimientos_bandeja_notificaciones')
        .update({ atendida: true, leida: true })
        .eq('id_postulacion', id_postulacion)
        .eq('etapa', 'PASO_4_LIBERACION_ORIGEN')

      const encDestino = matchesEncargadoForDept(encList || [], vac?.departamento_destino || 'Mina', vac?.sub_departamento_destino)
      const notifyTargets = [
        encDestino?.correo_encargado,
        reglas.jefe_rh_unidad_correo,
        reglas.supt_rh_corporativo_correo,
        reglas.sindicato_correo,
        mailCfg.rhNotificationEmail,
      ].filter(Boolean) as string[]

      const titulo = isYes
        ? `✅ [SÍ AUTORIZADO] ${post.departamento_actual} liberó a ${post.nombre_completo} para ${vac?.puesto_vacante || post.puesto_postulado}`
        : `⏳ [NO / REPROGRAMAR] ${post.departamento_actual} solicita nueva fecha para ${post.nombre_completo}`
      const mensaje = isYes
        ? `${actorName} (${post.departamento_actual}) confirmó que SÍ libera a ${post.nombre_completo} para presentarse el ${formatShortDate(upPayload.fecha_presentacion || post.fecha_presentacion)}. Ya tiene las 4 autorizaciones completas y puede colocarse en la vacante.`
        : `${actorName} (${post.departamento_actual}) indicó que NO puede liberar en esa fecha. Nueva fecha tentativa: ${formatShortDate(nueva_fecha || post.fecha_presentacion)}. Motivo: ${upPayload.comentario_depto_origen}`

      await admin.from('movimientos_bandeja_notificaciones').insert([
        {
          id_usuario_destino: encDestino?.id_usuario_encargado || null,
          rol_destino: isYes ? 'Administrativo' : 'Jefe de Departamento',
          correo_destino: encDestino?.correo_encargado || reglas.jefe_rh_unidad_correo,
          departamento_destino: vac?.departamento_destino || 'Mina',
          id_vacante: post.id_vacante,
          id_postulacion: post.id_postulacion,
          etapa: isYes ? 'PASO_5_LISTO_AJEDREZ' : 'REPROGRAMAR_FECHA',
          titulo,
          mensaje,
        },
        {
          id_usuario_destino: reglas.supt_rh_corporativo_id || null,
          rol_destino: 'Superintendente de RH Corporativo',
          correo_destino: reglas.supt_rh_corporativo_correo,
          departamento_destino: 'RECURSOS HUMANOS',
          id_vacante: post.id_vacante,
          id_postulacion: post.id_postulacion,
          etapa: isYes ? 'PASO_5_LISTO_AJEDREZ' : 'REPROGRAMAR_FECHA',
          titulo: `[Dirección RH] ${titulo}`,
          mensaje,
        },
        {
          id_usuario_destino: reglas.jefe_rh_unidad_id || null,
          rol_destino: 'Jefe de RH Unidad',
          correo_destino: reglas.jefe_rh_unidad_correo,
          departamento_destino: 'RECURSOS HUMANOS',
          id_vacante: post.id_vacante,
          id_postulacion: post.id_postulacion,
          etapa: isYes ? 'PASO_5_LISTO_AJEDREZ' : 'REPROGRAMAR_FECHA',
          titulo,
          mensaje,
        },
      ])

      const mRes = await safeEmail(
        Array.from(new Set(notifyTargets)),
        titulo,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #d4d4d8; border-radius: 16px; overflow: hidden;">
            <div style="background: ${isYes ? '#065f46' : '#9f1239'}; color: #fff; padding: 18px 22px;">
              <h3 style="margin: 0;">${titulo}</h3>
            </div>
            <div style="padding: 20px; font-size: 13px; color: #18181b; line-height: 1.6;">
              <p>${mensaje}</p>
              <p><a href="${originUrl}/movimientos-sindicato" style="display:inline-block; background:#f59e0b; color:#000; font-weight:bold; padding:10px 18px; border-radius:8px; text-decoration:none;">Abrir Tablero de Ajedrez</a></p>
            </div>
          </div>
        `,
        autoMail,
        isTestMode,
        actorName
      )
      const emailNote = formatMailNote(mRes)

      await admin.from('movimientos_notificaciones_log').insert([
        {
          id_vacante: post.id_vacante,
          id_postulacion: post.id_postulacion,
          tipo_aviso: isYes ? 'RESPUESTA_SI_ORIGEN' : 'RESPUESTA_NO_REPROGRAMAR',
          remitente: actorName,
          destinatarios: `${vac?.departamento_destino || 'Mina'}, RH Unidad, RH Corporativo y Sindicato`,
          asunto: titulo,
          mensaje,
          correo_enviado: mRes.sent,
        },
      ])

      return NextResponse.json({
        success: true,
        etapa,
        isApproved: isYes,
        emailSent: mRes.sent,
        emailSimulated: isTestMode,
        message: `${mensaje}${emailNote}`,
      })
    }

    // =========================================================================
    // ETAPA 5 / FINAL: EJECUTAR_MOVIMIENTO (Trabajador entra a vacante + Efecto Dominó)
    // Avisa a la brevedad a: Dirección de RH (Corp y Unidad), Depto Destino, Depto Origen y Sindicato
    // =========================================================================
    if (etapa === 'EJECUTAR_MOVIMIENTO') {
      const encDestino = matchesEncargadoForDept(encList || [], vac?.departamento_destino || 'Mina', vac?.sub_departamento_destino)
      const encOrigen = matchesEncargadoForDept(encList || [], post.departamento_actual, post.sub_departamento_actual)
      const origenCorreo = post.encargado_origen_correo || encOrigen?.correo_encargado || ''
      const destinoCorreo = encDestino?.correo_encargado || ''

      await admin
        .from('movimientos_bandeja_notificaciones')
        .update({ atendida: true, leida: true })
        .eq('id_postulacion', id_postulacion)

      const titulo = `♟️ [MOVIMIENTO OFICIAL EJECUTADO] ${post.nombre_completo}: ${post.departamento_actual} (${post.puesto_actual}) → ${vac?.departamento_destino || 'Mina'} (${vac?.puesto_vacante || post.puesto_postulado})`
      const dominoTxt = domino_folio
        ? ` En automático se liberó su plaza anterior de "${post.puesto_actual}" en ${post.departamento_actual} con la nueva convocatoria ${domino_folio} (${reglas.regla_dias_convocatoria || 10} días Art. 116 C.C.T.).`
        : ''
      const mensaje = `Con las 4 autorizaciones jerárquicas cumplidas (RH Unidad, Dirección RH Corporativo, Jefatura ${vac?.departamento_destino || 'Mina'} y Jefatura ${post.departamento_actual}), ${post.nombre_completo} (${post.anos_antiguedad || 0} años de antigüedad) ingresó oficialmente a la vacante de "${vac?.puesto_vacante || post.puesto_postulado}" en ${vac?.departamento_destino || 'Mina'} a partir del ${formatShortDate(post.fecha_presentacion)}, iniciando su periodo de evaluación y adiestramiento C.C.T.${dominoTxt}`

      await admin
        .from('movimientos_bandeja_notificaciones')
        .insert([
          {
            id_usuario_destino: reglas.supt_rh_corporativo_id || null,
            rol_destino: 'Superintendente de RH Corporativo',
            correo_destino: reglas.supt_rh_corporativo_correo,
            departamento_destino: 'RECURSOS HUMANOS',
            id_vacante: post.id_vacante,
            id_postulacion: post.id_postulacion,
            etapa: 'MOVIMIENTO_EJECUTADO',
            titulo: `[Dirección RH] ${titulo}`,
            mensaje,
          },
          {
            id_usuario_destino: reglas.jefe_rh_unidad_id || null,
            rol_destino: 'Jefe de RH Unidad',
            correo_destino: reglas.jefe_rh_unidad_correo,
            departamento_destino: 'RECURSOS HUMANOS',
            id_vacante: post.id_vacante,
            id_postulacion: post.id_postulacion,
            etapa: 'MOVIMIENTO_EJECUTADO',
            titulo,
            mensaje,
          },
          {
            id_usuario_destino: encDestino?.id_usuario_encargado || null,
            rol_destino: 'Jefe de Departamento',
            correo_destino: destinoCorreo || reglas.jefe_rh_unidad_correo,
            departamento_destino: vac?.departamento_destino || 'Mina',
            id_vacante: post.id_vacante,
            id_postulacion: post.id_postulacion,
            etapa: 'MOVIMIENTO_EJECUTADO',
            titulo: `📥 Nuevo ingreso por Escalafón en tu área (${vac?.departamento_destino || 'Mina'}): ${post.nombre_completo}`,
            mensaje,
          },
          {
            id_usuario_destino: encOrigen?.id_usuario_encargado || null,
            rol_destino: 'Jefe de Departamento',
            correo_destino: origenCorreo || reglas.jefe_rh_unidad_correo,
            departamento_destino: post.departamento_actual,
            id_vacante: post.id_vacante,
            id_postulacion: post.id_postulacion,
            etapa: 'MOVIMIENTO_EJECUTADO',
            titulo: `📤 Salida aplicada por Escalafón en ${post.departamento_actual}: ${post.nombre_completo}${domino_folio ? ` (Vacante ${domino_folio} liberada)` : ''}`,
            mensaje,
          },
          {
            id_usuario_destino: reglas.sindicato_id || null,
            rol_destino: 'Sindicato',
            correo_destino: reglas.sindicato_correo,
            departamento_destino: 'SINDICATO',
            id_vacante: post.id_vacante,
            id_postulacion: post.id_postulacion,
            etapa: 'MOVIMIENTO_EJECUTADO',
            titulo: `[Sindicato Secc. 45] ${titulo}`,
            mensaje,
          },
        ])
        .then(() => {})

      const finalTargets = Array.from(
        new Set(
          [
            reglas.supt_rh_corporativo_correo,
            reglas.jefe_rh_unidad_correo,
            reglas.sindicato_correo,
            mailCfg.rhNotificationEmail,
            destinoCorreo,
            origenCorreo,
          ].filter(Boolean)
        )
      ) as string[]

      const mRes = await safeEmail(
        finalTargets,
        titulo,
        `
          <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #d4d4d8; border-radius: 16px; overflow: hidden;">
            <div style="background: #065f46; color: #fff; padding: 18px 22px; border-bottom: 4px solid #f59e0b;">
              <div style="font-size: 11px; color: #fde68a; font-weight: bold;">GRUPO MINERO BACÍS • DIRECCIÓN DE RH, SINDICATO SECC. 45 Y DEPARTAMENTOS</div>
              <h3 style="margin: 6px 0 0;">${titulo}</h3>
            </div>
            <div style="padding: 20px; font-size: 13px; color: #18181b; line-height: 1.6;">
              <p>${mensaje}</p>
              <p><a href="${originUrl}/movimientos-sindicato" style="display:inline-block; background:#f59e0b; color:#000; font-weight:bold; padding:10px 18px; border-radius:8px; text-decoration:none;">Ver Historial y Tablero de Escalafón</a></p>
            </div>
          </div>
        `,
        autoMail,
        isTestMode,
        actorName
      )
      const emailNote = formatMailNote(mRes)

      return NextResponse.json({
        success: true,
        etapa,
        emailSent: mRes.sent,
        emailSimulated: isTestMode,
        message: `${mensaje}${emailNote}`,
      })
    }

    return NextResponse.json({ error: `Etapa desconocida: ${etapa}` }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error en flujo de autorización' }, { status: 500 })
  }
}
