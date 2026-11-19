import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveEmailConfig, sendSystemEmail } from '@/utils/mailer'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { razon_social, rfc, representante_legal, telefono, correo, especialidad, notas } = body

    if (!razon_social || !rfc || !correo) {
      return NextResponse.json(
        { error: 'Razón social, RFC y correo electrónico son obligatorios.' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Configuración de Supabase incompleta.' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await supabaseAdmin
      .from('contratistas_empresas')
      .insert([
        {
          razon_social: String(razon_social).trim(),
          nombre_comercial: String(razon_social).trim(),
          rfc: String(rfc).trim().toUpperCase(),
          representante_legal: representante_legal ? String(representante_legal).trim() : null,
          telefono: telefono ? String(telefono).trim() : null,
          correo: String(correo).trim().toLowerCase(),
          especialidad: especialidad ? String(especialidad).trim() : null,
          notas: notas ? String(notas).trim() : 'Solicitud de cuenta enviada desde el Portal Central',
          estatus: 'Pendiente',
        },
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Best-effort automatic email notification to RH if configured
    const emailCfg = await resolveEmailConfig()
    if (emailCfg.rhNotificationEmail) {
      await sendSystemEmail({
        to: emailCfg.rhNotificationEmail,
        subject: `Nueva Solicitud de Usuario Contratista: ${razon_social}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; border: 1px solid #e4e4e7; border-radius: 14px; overflow: hidden;">
            <div style="background: #09090b; color: #fff; padding: 16px 20px;">
              <h3 style="margin: 0; color: #f59e0b;">NUEVA SOLICITUD DE CONTRATISTA</h3>
            </div>
            <div style="padding: 20px; font-size: 14px; color: #18181b;">
              <p>Una empresa contratista solicitó usuario de acceso al portal:</p>
              <ul>
                <li><strong>Razón Social:</strong> ${razon_social}</li>
                <li><strong>RFC:</strong> ${String(rfc).toUpperCase()}</li>
                <li><strong>Responsable:</strong> ${representante_legal || 'N/D'}</li>
                <li><strong>Correo:</strong> ${correo}</li>
                <li><strong>Teléfono:</strong> ${telefono || 'N/D'}</li>
                <li><strong>Servicio:</strong> ${especialidad || 'N/D'}</li>
              </ul>
              <p>Ingresa al módulo <strong>Contratistas</strong> para aprobar y enviar sus credenciales.</p>
            </div>
          </div>
        `,
      })
    }

    return NextResponse.json({ success: true, empresa: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
