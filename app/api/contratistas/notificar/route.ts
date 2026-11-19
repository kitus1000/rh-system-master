import { NextResponse } from 'next/server'
import { sendSystemEmail } from '@/utils/mailer'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tipo, to, asunto, mensaje, detalles } = body

    if (!to) {
      return NextResponse.json({ sent: false, error: 'Destinatario requerido' }, { status: 400 })
    }

    if (tipo === 'test') {
      const res = await sendSystemEmail({
        to,
        subject: 'Prueba de Correo Automático - Sistema RH & Contratistas',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e4e4e7; border-radius: 12px;">
            <h2 style="color: #10b981; margin-top: 0;">✅ Configuración de Correo Exitosa</h2>
            <p>Tu servidor de correo automático está conectado correctamente con el Sistema RH y el Portal de Contratistas.</p>
          </div>
        `,
      })
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
    })

    return NextResponse.json(res)
  } catch (err: any) {
    return NextResponse.json({ sent: false, error: err.message }, { status: 500 })
  }
}
