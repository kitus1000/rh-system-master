import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSystemEmail, EmailConfigOverride } from '@/utils/mailer'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tipo, to, asunto, mensaje, detalles, config, modo_prueba } = body
    const isTestMode = Boolean(modo_prueba) && tipo !== 'test'

    if (!to) {
      return NextResponse.json({ sent: false, error: 'Destinatario requerido para el correo' }, { status: 400 })
    }

    const configOverride: EmailConfigOverride | undefined = config ? {
      provider: config.email_provider || config.provider,
      resendApiKey: config.resend_api_key || config.resendApiKey,
      smtpHost: config.smtp_host || config.smtpHost,
      smtpPort: config.smtp_port ? Number(config.smtp_port) : undefined,
      smtpUser: config.smtp_user || config.smtpUser,
      smtpPass: config.smtp_pass || config.smtpPass,
      smtpSecure: config.smtp_secure !== undefined ? Boolean(config.smtp_secure) : undefined,
      fromEmail: config.email_remitente || config.fromEmail,
      rhNotificationEmail: config.email_rh_notificaciones || config.rhNotificationEmail,
    } : undefined

    if (tipo === 'test') {
      // Auto-save to configuracion_empresa if config object was supplied
      if (config) {
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          if (supabaseUrl && serviceKey) {
            const admin = createClient(supabaseUrl, serviceKey, {
              auth: { autoRefreshToken: false, persistSession: false },
            })
            const { data: existing } = await admin.from('configuracion_empresa').select('id').limit(1).maybeSingle()
            const payload: any = {
              email_provider: config.email_provider || 'smtp',
              resend_api_key: config.resend_api_key || null,
              smtp_host: config.smtp_host || 'smtp.gmail.com',
              smtp_port: Number(config.smtp_port || 587),
              smtp_user: config.smtp_user || null,
              smtp_pass: config.smtp_pass || null,
              smtp_secure: Boolean(config.smtp_secure),
              email_remitente: config.email_remitente || null,
              email_rh_notificaciones: config.email_rh_notificaciones || null,
              actualizado_el: new Date().toISOString(),
            }
            if (existing?.id) {
              await admin.from('configuracion_empresa').update(payload).eq('id', existing.id)
            } else {
              await admin.from('configuracion_empresa').insert([payload])
            }
          }
        } catch (dbErr) {
          console.warn('Auto-save email config to DB error:', dbErr)
        }
      }

      const res = await sendSystemEmail({
        to,
        subject: 'Prueba de Correo Automático - Sistema RH & Contratistas',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 24px; border: 1px solid #e4e4e7; border-radius: 12px; max-width: 580px; margin: 0 auto;">
            <h2 style="color: #10b981; margin-top: 0;">✅ Configuración de Correo Exitosa</h2>
            <p style="color: #27272a; font-size: 14px; line-height: 1.6;">
              Tu servidor de correo automático está conectado correctamente con el <strong>Sistema RH y el Portal de Contratistas</strong>.
            </p>
            <div style="background: #f4f4f5; padding: 12px 16px; border-radius: 8px; font-family: monospace; font-size: 12px; color: #52525b; margin-top: 16px;">
              Fecha y hora: ${new Date().toLocaleString('es-MX')}
            </div>
          </div>
        `,
      }, configOverride)
      return NextResponse.json(res)
    }

    const res = await sendSystemEmail({
      to,
      subject: asunto || 'Notificación - Portal de Contratistas',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden;">
          <div style="background: #09090b; color: #fff; padding: 18px 22px;">
            <h3 style="margin: 0; color: #f59e0b;">${asunto || 'NOTIFICACIÓN DE ACCESO A MINA'}</h3>
          </div>
          <div style="padding: 22px; color: #18181b; font-size: 14px; line-height: 1.6;">
            <p>${mensaje || ''}</p>
            ${detalles ? `<div style="background: #f4f4f5; padding: 14px; border-radius: 10px; font-family: monospace; margin-top: 12px;">${detalles}</div>` : ''}
          </div>
        </div>
      `,
      isTestMode,
    }, configOverride)

    return NextResponse.json(res)
  } catch (err: any) {
    return NextResponse.json({ sent: false, error: err.message }, { status: 500 })
  }
}
