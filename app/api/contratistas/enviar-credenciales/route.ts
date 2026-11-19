import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, password, razon_social, portal_url } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Falta correo o contraseña' }, { status: 400 })
    }

    const resendKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Accesos Mina <onboarding@resend.dev>'

    if (!resendKey) {
      return NextResponse.json({
        sent: false,
        reason: 'NO_EMAIL_PROVIDER',
        message: 'No hay proveedor de correo configurado (RESEND_API_KEY). Usa los botones de Correo / WhatsApp / Copiar para entregar los accesos.',
      })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: `Acceso Portal de Contratistas - ${razon_social || 'Unidad Minera'}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden;">
            <div style="background: #09090b; color: #fff; padding: 20px 24px;">
              <h2 style="margin: 0; color: #f97316;">PORTAL DE CONTRATISTAS</h2>
              <p style="margin: 6px 0 0; font-size: 13px; color: #a1a1aa;">Credenciales de acceso habilitadas</p>
            </div>
            <div style="padding: 24px; color: #18181b; font-size: 14px; line-height: 1.6;">
              <p>Hola <strong>${razon_social || 'Contratista'}</strong>,</p>
              <p>Tu cuenta para el Portal de Contratistas ya está activa. Ingresa para registrar tu personal, subir fotografías y documentos (SAT, IMSS, NSS, permisos) y solicitar acceso a mina:</p>
              <div style="background: #f4f4f5; padding: 16px; border-radius: 12px; font-family: monospace; margin: 16px 0;">
                <div><strong>Enlace:</strong> ${portal_url || 'Portal Central -> Portal Contratistas'}</div>
                <div><strong>Usuario:</strong> ${email}</div>
                <div><strong>Contraseña:</strong> ${password}</div>
              </div>
              <p style="font-size: 12px; color: #71717a;">Te recomendamos cambiar tu contraseña desde "Mi Perfil" al ingresar.</p>
            </div>
          </div>
        `,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ sent: false, error: data.message || 'Error enviando con Resend' }, { status: 400 })
    }

    return NextResponse.json({ sent: true, id: data.id })
  } catch (err: any) {
    return NextResponse.json({ sent: false, error: err.message }, { status: 500 })
  }
}
