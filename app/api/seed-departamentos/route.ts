import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_MINING_DEPARTMENTS = [
  'Mina',
  'Planta de Beneficio',
  'Mantenimiento',
  'Geología y Exploración',
  'Seguridad y Medio Ambiente',
  'Laboratorio Químico',
  'Eléctrico e Instrumentación',
  'Logística y Almacén',
]

function slugifyDepartment(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .split('.')
    .slice(0, 2)
    .join('.')
}

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Configuración de Supabase incompleta' }, { status: 500 })
    }

    const isServiceRole = Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ')
    )
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Obtener departamentos actuales de cat_departamentos
    let { data: depts } = await supabaseAdmin
      .from('cat_departamentos')
      .select('*')
      .eq('activo', true)
      .order('departamento')

    // Si no hay departamentos registrados aún, sembrar los departamentos mineros base
    if (!depts || depts.length === 0) {
      for (const dName of DEFAULT_MINING_DEPARTMENTS) {
        await supabaseAdmin.from('cat_departamentos').insert([{ departamento: dName, activo: true }])
      }
      const resDepts = await supabaseAdmin
        .from('cat_departamentos')
        .select('*')
        .eq('activo', true)
        .order('departamento')
      depts = resDepts.data || []
    }

    // Precargar lista de usuarios Auth si tenemos service role
    let existingAuthUsers: any[] = []
    if (isServiceRole) {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
      existingAuthUsers = listData?.users || []
    }

    const defaultPassword = 'Bacis2026!'
    const createdAccounts: any[] = []

    for (const dept of depts || []) {
      const deptName = (dept.departamento || '').trim()
      if (!deptName) continue

      const slug = slugifyDepartment(deptName) || `area${dept.id_departamento}`
      const email = `jefe.${slug}@bacis.com`
      const displayName = `Jefe ${deptName}`

      let userId = ''
      let status = 'creado'

      if (isServiceRole) {
        const found = existingAuthUsers.find((u) => (u.email || '').toLowerCase() === email.toLowerCase())
        if (found) {
          userId = found.id
          status = 'actualizado'
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: defaultPassword,
            email_confirm: true,
            user_metadata: {
              full_name: displayName,
              rol: 'Jefe de Departamento',
              id_departamento: dept.id_departamento,
            },
          })
        } else {
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: defaultPassword,
            email_confirm: true,
            user_metadata: {
              full_name: displayName,
              rol: 'Jefe de Departamento',
              id_departamento: dept.id_departamento,
            },
          })
          if (!createErr && created?.user) {
            userId = created.user.id
          }
        }
      }

      if (userId) {
        // Intentar upsert con rol 'Jefe de Departamento', con fallback a 'Jefe' si existe constraint antigua
        const payloadFull: any = {
          id: userId,
          nombre_completo: displayName,
          rol: 'Jefe de Departamento',
          id_departamento: dept.id_departamento,
          departamentos_autorizados: [dept.id_departamento],
        }
        const { error: upErr } = await supabaseAdmin.from('perfiles').upsert([payloadFull])
        if (upErr) {
          await supabaseAdmin.from('perfiles').upsert([
            {
              id: userId,
              nombre_completo: displayName,
              rol: 'Jefe',
              id_departamento: dept.id_departamento,
            },
          ])
        }

        createdAccounts.push({
          departamento: deptName,
          id_departamento: dept.id_departamento,
          nombre: displayName,
          email,
          password: defaultPassword,
          status,
        })
      }
    }

    return NextResponse.json({
      success: true,
      accounts: createdAccounts,
      message: `Se sincronizaron ${createdAccounts.length} accesos de Jefes de Departamento.`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error sincronizando departamentos' }, { status: 500 })
  }
}
