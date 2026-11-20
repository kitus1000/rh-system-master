import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const OFFICIAL_AUTHORIZERS = [
  {
    key: 'jefe_rh_unidad',
    nombre_completo: 'Jefe de RH Unidad',
    email: 'jefe.rh.unidad@bacis.com',
    rol: 'Jefe de RH Unidad',
    fallbackRol: 'Administrativo',
    fallbackTag: '(Jefe RH Unidad)',
    areaLabel: 'Paso 1: Jefe de RH Unidad',
  },
  {
    key: 'supt_rh_corporativo',
    nombre_completo: 'Superintendente de RH Corporativo',
    email: 'supt.rh.corporativo@bacis.com',
    rol: 'Superintendente de RH Corporativo',
    fallbackRol: 'Administrativo',
    fallbackTag: '(RH Corporativo)',
    areaLabel: 'Paso 2: Supt. RH Corporativo',
  },
  {
    key: 'sindicato',
    nombre_completo: 'Comité Sindical / Escalafón',
    email: 'sindicato@bacis.com',
    rol: 'Sindicato',
    fallbackRol: 'Jefe',
    fallbackTag: '(Sindicato)',
    areaLabel: 'Comisión Mixta: Sindicato',
  },
]

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

    const defaultPassword = 'Bacis2026!'
    let existingAuthUsers: any[] = []
    if (isServiceRole) {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
      existingAuthUsers = listData?.users || []
    }

    const createdAccounts: any[] = []
    const idsByKey: Record<string, { id: string; nombre: string; correo: string }> = {}

    for (const authDef of OFFICIAL_AUTHORIZERS) {
      let userId = ''
      let status = 'creado'

      if (isServiceRole) {
        const found = existingAuthUsers.find(
          (u) => (u.email || '').toLowerCase() === authDef.email.toLowerCase()
        )
        if (found) {
          userId = found.id
          status = 'actualizado'
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: defaultPassword,
            email_confirm: true,
            user_metadata: {
              full_name: authDef.nombre_completo,
              rol: authDef.rol,
            },
          })
        } else {
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: authDef.email,
            password: defaultPassword,
            email_confirm: true,
            user_metadata: {
              full_name: authDef.nombre_completo,
              rol: authDef.rol,
            },
          })
          if (!createErr && created?.user) {
            userId = created.user.id
          }
        }
      }

      if (userId) {
        const profilePayload: any = {
          id: userId,
          nombre_completo: authDef.nombre_completo,
          rol: authDef.rol,
          email: authDef.email,
        }

        let { error: upErr } = await supabaseAdmin.from('perfiles').upsert([profilePayload])
        if (upErr && upErr.message?.toLowerCase().includes('email')) {
          delete profilePayload.email
          const retryNoEmail = await supabaseAdmin.from('perfiles').upsert([profilePayload])
          upErr = retryNoEmail.error
        }

        if (upErr && (upErr.message?.includes('perfiles_rol_check') || upErr.code === '23514')) {
          const taggedName = authDef.nombre_completo.includes(authDef.fallbackTag)
            ? authDef.nombre_completo
            : `${authDef.nombre_completo} ${authDef.fallbackTag}`
          await supabaseAdmin.from('perfiles').upsert([
            {
              id: userId,
              nombre_completo: taggedName,
              rol: authDef.fallbackRol,
            },
          ])
        }

        idsByKey[authDef.key] = {
          id: userId,
          nombre: authDef.nombre_completo,
          correo: authDef.email,
        }

        createdAccounts.push({
          departamento: authDef.areaLabel,
          nombre: authDef.nombre_completo,
          email: authDef.email,
          password: defaultPassword,
          rol: authDef.rol,
          status,
          id: userId,
        })
      }
    }

    // 2. Actualizar/insertar la Matriz de Reglas y Autorizadores
    let rulesRow: any = null
    try {
      const { data: existingRule } = await supabaseAdmin
        .from('movimientos_reglas_autorizacion')
        .select('*')
        .limit(1)
        .maybeSingle()

      const rulePayload: any = {
        jefe_rh_unidad_id: idsByKey.jefe_rh_unidad?.id || existingRule?.jefe_rh_unidad_id || null,
        jefe_rh_unidad_nombre: idsByKey.jefe_rh_unidad?.nombre || existingRule?.jefe_rh_unidad_nombre || 'Jefe de RH Unidad',
        jefe_rh_unidad_correo: idsByKey.jefe_rh_unidad?.correo || existingRule?.jefe_rh_unidad_correo || 'jefe.rh.unidad@bacis.com',
        supt_rh_corporativo_id: idsByKey.supt_rh_corporativo?.id || existingRule?.supt_rh_corporativo_id || null,
        supt_rh_corporativo_nombre:
          idsByKey.supt_rh_corporativo?.nombre || existingRule?.supt_rh_corporativo_nombre || 'Superintendente de RH Corporativo',
        supt_rh_corporativo_correo:
          idsByKey.supt_rh_corporativo?.correo || existingRule?.supt_rh_corporativo_correo || 'supt.rh.corporativo@bacis.com',
        sindicato_id: idsByKey.sindicato?.id || existingRule?.sindicato_id || null,
        sindicato_nombre: idsByKey.sindicato?.nombre || existingRule?.sindicato_nombre || 'Comité Sindical / Escalafón',
        sindicato_correo: idsByKey.sindicato?.correo || existingRule?.sindicato_correo || 'sindicato@bacis.com',
        actualizado_el: new Date().toISOString(),
      }

      if (existingRule?.id_regla) {
        const { data: updatedRule } = await supabaseAdmin
          .from('movimientos_reglas_autorizacion')
          .update(rulePayload)
          .eq('id_regla', existingRule.id_regla)
          .select()
          .maybeSingle()
        rulesRow = updatedRule || { ...existingRule, ...rulePayload }
      } else {
        const { data: insertedRule } = await supabaseAdmin
          .from('movimientos_reglas_autorizacion')
          .insert([rulePayload])
          .select()
          .maybeSingle()
        rulesRow = insertedRule || rulePayload
      }
    } catch (ruleErr) {
      console.warn('Tabla movimientos_reglas_autorizacion pendiente:', ruleErr)
    }

    // 3. Vincular id_usuario_encargado en movimientos_encargados_subdeptos con los usuarios auth existentes (jefe.*@bacis.com)
    try {
      const { data: encList } = await supabaseAdmin.from('movimientos_encargados_subdeptos').select('*')
      if (encList && encList.length > 0 && existingAuthUsers.length > 0) {
        // Refrescar listado por si acabamos de crear cuentas
        const { data: refreshedAuth } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
        const authList = refreshedAuth?.users || existingAuthUsers

        for (const enc of encList) {
          const encEmail = (enc.correo_encargado || '').toLowerCase().trim()
          const matchedUser = authList.find((u) => (u.email || '').toLowerCase().trim() === encEmail)
          if (matchedUser && enc.id_usuario_encargado !== matchedUser.id) {
            await supabaseAdmin
              .from('movimientos_encargados_subdeptos')
              .update({ id_usuario_encargado: matchedUser.id })
              .eq('id_encargado', enc.id_encargado)
          }
        }
      }
    } catch (encErr) {
      console.warn('No se pudo vincular encargados:', encErr)
    }

    return NextResponse.json({
      success: true,
      accounts: createdAccounts,
      rules: rulesRow,
      message: `Se sincronizaron ${createdAccounts.length} autorizadores oficiales (Jefe RH Unidad, Supt. RH Corporativo y Sindicato).`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error sincronizando autorizadores' }, { status: 500 })
  }
}
