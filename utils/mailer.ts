import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

export interface SendEmailInput {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

export interface SendEmailResult {
  sent: boolean
  provider?: 'resend' | 'smtp'
  reason?: 'NO_EMAIL_PROVIDER' | 'ERROR'
  error?: string
  id?: string
}

interface ResolvedEmailConfig {
  provider: 'resend' | 'smtp' | null
  resendApiKey?: string
  smtpHost?: string
  smtpPort: number
  smtpUser?: string
  smtpPass?: string
  smtpSecure: boolean
  fromEmail: string
  rhNotificationEmail?: string
}

export interface EmailConfigOverride {
  provider?: 'resend' | 'smtp' | null
  resendApiKey?: string
  smtpHost?: string
  smtpPort?: number
  smtpUser?: string
  smtpPass?: string
  smtpSecure?: boolean
  fromEmail?: string
  rhNotificationEmail?: string
}

export async function resolveEmailConfig(override?: EmailConfigOverride): Promise<ResolvedEmailConfig> {
  // 1. Check .env.local first
  const envResend = process.env.RESEND_API_KEY
  const envSmtpHost = process.env.SMTP_HOST
  const envSmtpUser = process.env.SMTP_USER
  const envSmtpPass = process.env.SMTP_PASS

  let dbCfg: any = null
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (supabaseUrl && serviceKey) {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data } = await supabaseAdmin.from('configuracion_empresa').select('*').limit(1).maybeSingle()
      dbCfg = data
    }
  } catch {
    // Ignore DB config lookup errors
  }

  const rawPass = override?.smtpPass || envSmtpPass || dbCfg?.smtp_pass || ''
  const cleanPass = String(rawPass).replace(/\s+/g, '') // Elimina espacios de contraseñas de app de Google

  const resendApiKey = (override?.resendApiKey || envResend || dbCfg?.resend_api_key || '').trim()
  const smtpHost = (override?.smtpHost || envSmtpHost || dbCfg?.smtp_host || '').trim()
  const smtpPort = Number(override?.smtpPort || process.env.SMTP_PORT || dbCfg?.smtp_port || 587)
  const smtpUser = (override?.smtpUser || envSmtpUser || dbCfg?.smtp_user || '').trim()
  const smtpPass = cleanPass
  const smtpSecure = override?.smtpSecure !== undefined
    ? Boolean(override.smtpSecure)
    : process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === 'true'
      : Boolean(dbCfg?.smtp_secure || smtpPort === 465)

  const preferred = override?.provider || dbCfg?.email_provider || (resendApiKey ? 'resend' : smtpHost ? 'smtp' : null)

  let provider: 'resend' | 'smtp' | null = null
  if (preferred === 'resend' && resendApiKey) provider = 'resend'
  else if (preferred === 'smtp' && smtpHost && smtpUser && smtpPass) provider = 'smtp'
  else if (smtpHost && smtpUser && smtpPass) provider = 'smtp'
  else if (resendApiKey) provider = 'resend'

  const fromEmail =
    override?.fromEmail ||
    process.env.RESEND_FROM_EMAIL ||
    process.env.SMTP_FROM ||
    dbCfg?.email_remitente ||
    smtpUser ||
    'Accesos Mina <onboarding@resend.dev>'

  return {
    provider,
    resendApiKey,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpSecure,
    fromEmail,
    rhNotificationEmail: override?.rhNotificationEmail || process.env.RH_NOTIFICATION_EMAIL || dbCfg?.email_rh_notificaciones || '',
  }
}

export async function sendSystemEmail(input: SendEmailInput, override?: EmailConfigOverride): Promise<SendEmailResult> {
  try {
    const cfg = await resolveEmailConfig(override)
    const recipients = Array.isArray(input.to) ? input.to.filter(Boolean) : [input.to].filter(Boolean)
    if (recipients.length === 0) {
      return { sent: false, reason: 'ERROR', error: 'Sin destinatario válido' }
    }

    if (!cfg.provider) {
      // Diagnostic message to help user know exactly what field is missing
      const missing: string[] = []
      if (!cfg.smtpUser) missing.push('Usuario / Correo SMTP')
      if (!cfg.smtpPass) missing.push('Contraseña / App Password (16 letras)')
      if (!cfg.smtpHost) missing.push('Servidor SMTP (Host)')

      const detail = missing.length > 0 ? ` (Faltan: ${missing.join(', ')})` : ''
      return {
        sent: false,
        reason: 'NO_EMAIL_PROVIDER',
        error: `No se han configurado los datos de correo${detail}. Completa los campos en Configuración -> Correo Automático y haz clic en Guardar Cambios.`,
      }
    }

    if (cfg.provider === 'resend' && cfg.resendApiKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: cfg.fromEmail,
          to: recipients,
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        return { sent: false, provider: 'resend', reason: 'ERROR', error: json.message || 'Error en Resend API' }
      }
      return { sent: true, provider: 'resend', id: json.id }
    }

    // SMTP via Nodemailer
    const transporter = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      secure: cfg.smtpSecure,
      auth: {
        user: cfg.smtpUser,
        pass: cfg.smtpPass,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
    })

    const info = await transporter.sendMail({
      from: cfg.fromEmail,
      to: recipients.join(', '),
      subject: input.subject,
      html: input.html,
      text: input.text,
    })

    return { sent: true, provider: 'smtp', id: info.messageId }
  } catch (err: any) {
    console.error('Mailer error:', err)
    let userMsg = err.message || 'Error enviando correo'
    if (err.code === 'EAUTH' || err.responseCode === 535) {
      userMsg = 'Error de autenticación SMTP: Usuario o contraseña incorrectos. Si usas Gmail, recuerda usar una "Contraseña de aplicación" de 16 letras, no tu contraseña habitual.'
    } else if (err.code === 'ESOCKET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      userMsg = 'No se pudo conectar al servidor SMTP. Verifica el Servidor Host (ej: smtp.gmail.com) y el Puerto (587).'
    }
    return { sent: false, reason: 'ERROR', error: userMsg }
  }
}
