import { NextResponse } from 'next/server'
import { sendSystemEmail } from '@/utils/mailer'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, password, razon_social, portal_url } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Falta correo o contraseña' }, { status: 400 })
    }

    const result = await sendSystemEmail({
      to: email,
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
            <p style="font-size: 12px; color: #71717a;">Al ingresar al portal selecciona la tarjeta <strong>Portal Contratistas</strong>. Te recomendamos cambiar tu contraseña desde "Mi Perfil".</p>
          </div>
        </div>
      `,
      text: `Hola ${razon_social || 'Contratista'},\nTu usuario para el Portal de Contratistas ya está activo.\nEnlace: ${portal_url || ''}\nUsuario: ${email}\nContraseña: ${password}`,
    })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ sent: false, error: err.message }, { status: 500 })
  }
}
