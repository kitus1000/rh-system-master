import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  canonicalizeDepartment,
  isMergedGhostEmployee,
  isTitularPatient,
  normalizeNameTokensForDedup,
  phoneticSpanishToken,
} from '@/utils/dataNormalization'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Configuración de Supabase incompleta en el servidor.')
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function safeUpdateEq(
  sb: any,
  table: string,
  patch: Record<string, any>,
  col: string,
  val: string
) {
  try {
    const { error } = await sb.from(table).update(patch).eq(col, val)
    if (error) {
      // Ignorar si la tabla o columna no existe en esta instancia
      const msg = String(error.message || '').toLowerCase()
      if (
        msg.includes('does not exist') ||
        msg.includes('schema cache') ||
        msg.includes('could not find')
      ) {
        return
      }
    }
  } catch (_) {}
}

async function safeDeleteEq(sb: any, table: string, col: string, val: string) {
  try {
    await sb.from(table).delete().eq(col, val)
  } catch (_) {}
}

/**
 * Consolida tablas con llave primaria compuesta (ej. empleado_adscripciones, empleado_roles, etc.)
 * moviendo filas sin conflicto al Maestro y eliminando las redundantes del Duplicado.
 */
async function mergeCompositeRows(
  sb: any,
  table: string,
  masterId: string,
  dupId: string,
  conflictFields: string[],
  idRowCol?: string
) {
  try {
    const { data: dupRows, error: dupErr } = await sb.from(table).select('*').eq('id_empleado', dupId)
    if (dupErr || !dupRows || dupRows.length === 0) return

    const { data: masterRows } = await sb.from(table).select('*').eq('id_empleado', masterId)
    const existingKeys = new Set(
      (masterRows || []).map((r: any) => conflictFields.map((f) => String(r[f] ?? '')).join('|'))
    )

    for (const row of dupRows) {
      const key = conflictFields.map((f) => String(row[f] ?? '')).join('|')
      if (existingKeys.has(key)) {
        // Conflicto con fila existente en Maestro: eliminar la redundante del duplicado
        if (idRowCol && row[idRowCol]) {
          await sb.from(table).delete().eq(idRowCol, row[idRowCol])
        } else {
          let q = sb.from(table).delete().eq('id_empleado', dupId)
          for (const f of conflictFields) {
            if (row[f] !== undefined && row[f] !== null) q = q.eq(f, row[f])
          }
          await q
        }
      } else {
        // Mover al Maestro
        let updErr: any = null
        if (idRowCol && row[idRowCol]) {
          const res = await sb.from(table).update({ id_empleado: masterId }).eq(idRowCol, row[idRowCol])
          updErr = res.error
        } else {
          let q = sb.from(table).update({ id_empleado: masterId }).eq('id_empleado', dupId)
          for (const f of conflictFields) {
            if (row[f] !== undefined && row[f] !== null) q = q.eq(f, row[f])
          }
          const res = await q
          updErr = res.error
        }
        if (updErr) {
          // Si falló por cualquier otra restricción única, eliminar para liberar FK
          if (idRowCol && row[idRowCol]) {
            await sb.from(table).delete().eq(idRowCol, row[idRowCol])
          } else {
            await sb.from(table).delete().eq('id_empleado', dupId)
          }
        } else {
          existingKeys.add(key)
        }
      }
    }
  } catch (_) {}
}

/**
 * Rescata un registro 1-a-1 si el Maestro no lo tiene, y elimina el del Duplicado.
 */
async function rescueOneToOne(sb: any, table: string, masterId: string, dupId: string) {
  try {
    const { data: dupRow } = await sb.from(table).select('*').eq('id_empleado', dupId).maybeSingle()
    if (!dupRow) return

    const { data: masterRow } = await sb.from(table).select('*').eq('id_empleado', masterId).maybeSingle()
    if (!masterRow) {
      const { id_empleado: _, ...rest } = dupRow
      await sb.from(table).delete().eq('id_empleado', dupId)
      await sb.from(table).insert([{ id_empleado: masterId, ...rest }])
    } else {
      await sb.from(table).delete().eq('id_empleado', dupId)
    }
  } catch (_) {
    await safeDeleteEq(sb, table, 'id_empleado', dupId)
  }
}

/**
 * Consolida un registro de `pacientes` duplicado dentro de `masterId`,
 * transfiriendo consultas y pases y eliminando el duplicado.
 */
async function mergeSinglePatientIntoMaster(sb: any, masterId: string, dupId: string) {
  if (!masterId || !dupId || String(masterId) === String(dupId)) return

  const { data: masterPac, error: mErr } = await sb
    .from('pacientes')
    .select('*')
    .eq('id_paciente', masterId)
    .maybeSingle()

  if (mErr || !masterPac) {
    throw new Error(`No se encontró el paciente Maestro (${masterId}).`)
  }

  const { data: dupPac } = await sb
    .from('pacientes')
    .select('*')
    .eq('id_paciente', dupId)
    .maybeSingle()

  if (!dupPac) return // Ya fue eliminado

  // 1. Re-vincular TODAS las consultas médicas al Maestro
  const { error: conErr } = await sb
    .from('consultas_medicas')
    .update({ id_paciente: masterId })
    .eq('id_paciente', dupId)
  if (conErr) {
    throw new Error(`Error reasignando consultas médicas: ${conErr.message}`)
  }

  // 2. Re-vincular TODOS los pases médicos al Maestro
  const { error: pasErr } = await sb
    .from('pases_medicos')
    .update({ id_paciente: masterId })
    .eq('id_paciente', dupId)
  if (pasErr) {
    throw new Error(`Error reasignando pases médicos: ${pasErr.message}`)
  }

  // 3. Conservar metadatos faltantes en el Maestro sin sobrescribir lo que ya tenía
  const patch: Record<string, any> = {}
  if (!masterPac.id_empleado && dupPac.id_empleado) {
    patch.id_empleado = dupPac.id_empleado
  }
  const masterIsGeneric =
    !masterPac.parentesco ||
    String(masterPac.parentesco).toUpperCase().includes('POBLACIÓN GENERAL') ||
    String(masterPac.parentesco).toUpperCase().includes('POBLACION GENERAL')
  const dupIsSpecific =
    dupPac.parentesco &&
    !String(dupPac.parentesco).toUpperCase().includes('POBLACIÓN GENERAL') &&
    !String(dupPac.parentesco).toUpperCase().includes('POBLACION GENERAL')

  if (masterIsGeneric && dupIsSpecific) {
    patch.parentesco = dupPac.parentesco
    patch.es_poblacion_general = false
  }
  if (!masterPac.fecha_nacimiento && dupPac.fecha_nacimiento) {
    patch.fecha_nacimiento = dupPac.fecha_nacimiento
  }
  if (!masterPac.acompanante && dupPac.acompanante) {
    patch.acompanante = dupPac.acompanante
  }

  if (Object.keys(patch).length > 0) {
    const { error: updErr } = await sb
      .from('pacientes')
      .update(patch)
      .eq('id_paciente', masterId)
    if (updErr) {
      throw new Error(`Error actualizando datos del paciente Maestro: ${updErr.message}`)
    }
  }

  // 4. Eliminar físicamente el paciente duplicado
  const { error: delErr } = await sb.from('pacientes').delete().eq('id_paciente', dupId)
  if (delErr) {
    throw new Error(`No se pudo eliminar el beneficiario/paciente duplicado: ${delErr.message}`)
  }
}

/**
 * Consolida los pacientes y beneficiarios médicos de un empleado duplicado hacia el empleado Maestro,
 * asegurando que NO queden titulares duplicados ni familiares duplicados.
 */
async function consolidateEmployeePatients(sb: any, masterEmpId: string, dupEmpId: string) {
  const { data: masterPacientes } = await sb
    .from('pacientes')
    .select('*')
    .eq('id_empleado', masterEmpId)
  const { data: dupPacientes } = await sb
    .from('pacientes')
    .select('*')
    .eq('id_empleado', dupEmpId)

  const mList = [...(masterPacientes || [])]
  const dList = [...(dupPacientes || [])]

  const masterTitular = mList.find((p) => isTitularPatient(p))

  for (const dp of dList) {
    if (isTitularPatient(dp)) {
      if (masterTitular) {
        await mergeSinglePatientIntoMaster(sb, masterTitular.id_paciente, dp.id_paciente)
      } else {
        await sb.from('pacientes').update({ id_empleado: masterEmpId }).eq('id_paciente', dp.id_paciente)
        mList.push({ ...dp, id_empleado: masterEmpId })
      }
    } else {
      // Es beneficiario / familiar: verificar si ya existe en el maestro (exacto o fonético)
      const dpTok = normalizeNameTokensForDedup(dp.nombre_completo).join('|')
      const dpPhon = normalizeNameTokensForDedup(dp.nombre_completo).map(phoneticSpanishToken).sort().join('|')

      const existingMatch = mList.find((mp) => {
        if (isTitularPatient(mp)) return false
        const mpTok = normalizeNameTokensForDedup(mp.nombre_completo).join('|')
        const mpPhon = normalizeNameTokensForDedup(mp.nombre_completo).map(phoneticSpanishToken).sort().join('|')
        return (dpTok && mpTok === dpTok) || (dpPhon && mpPhon === dpPhon)
      })

      if (existingMatch) {
        await mergeSinglePatientIntoMaster(sb, existingMatch.id_paciente, dp.id_paciente)
      } else {
        // Conservarlo re-vinculándolo al empleado Maestro
        await sb.from('pacientes').update({ id_empleado: masterEmpId }).eq('id_paciente', dp.id_paciente)
        mList.push({ ...dp, id_empleado: masterEmpId })
      }
    }
  }
}

async function mergeSingleEmployeeIntoMaster(
  sb: any,
  masterId: string,
  dupId: string,
  editedFields?: Record<string, any>
) {
  if (!masterId || !dupId || String(masterId) === String(dupId)) return

  const { data: masterRec } = await sb
    .from('empleados')
    .select('*')
    .eq('id_empleado', masterId)
    .maybeSingle()
  const { data: dupRec } = await sb
    .from('empleados')
    .select('*')
    .eq('id_empleado', dupId)
    .maybeSingle()

  if (!masterRec) throw new Error('No se encontró el trabajador Maestro.')
  if (!dupRec) return

  // Preparar valores rescatados en memoria ANTES de limpiar UNIQUE en el duplicado
  const pick = (field: string) => masterRec[field] || dupRec[field] || null
  const updateMasterPayload: Record<string, any> = {
    nombre: ((editedFields?.nombre ?? masterRec.nombre ?? '') as string).trim().toUpperCase(),
    apellido_paterno: ((editedFields?.apellido_paterno ?? masterRec.apellido_paterno ?? '') as string)
      .trim()
      .toUpperCase(),
    apellido_materno:
      ((editedFields?.apellido_materno ?? masterRec.apellido_materno ?? '') as string).trim().toUpperCase() || null,
    departamento: editedFields?.departamento
      ? canonicalizeDepartment(editedFields.departamento).officialName
      : pick('departamento'),
    puesto: editedFields?.puesto || pick('puesto'),
    curp: pick('curp'),
    rfc: pick('rfc'),
    nss: pick('nss'),
    telefono: pick('telefono'),
    correo_electronico: pick('correo_electronico'),
    foto_url: pick('foto_url'),
    fecha_nacimiento: pick('fecha_nacimiento'),
    sexo: pick('sexo'),
  }

  const desiredNum =
    editedFields?.numero_empleado && !isNaN(parseInt(editedFields.numero_empleado, 10))
      ? parseInt(editedFields.numero_empleado, 10)
      : masterRec.numero_empleado

  // 1. Liberar campos UNIQUE (curp, rfc, nss y numero_empleado) del duplicado antes de actualizar Maestro
  const tempNegativeNum = -Math.floor(100000000 + Math.random() * 800000000)
  await sb
    .from('empleados')
    .update({
      curp: null,
      rfc: null,
      nss: null,
      numero_empleado: tempNegativeNum,
    })
    .eq('id_empleado', dupId)

  // 2. Consolidar pacientes & beneficiarios médicos sin duplicar
  await consolidateEmployeePatients(sb, masterId, dupId)

  // 3. Re-vincular TODAS las tablas satélite estándar que usan `id_empleado`
  const standardTables = [
    'pases_medicos',
    'consultas_medicas',
    'logistica_viajes_programados',
    'logistica_reportes_diarios',
    'logistica_acceso_pasajeros',
    'logistica_foraneo',
    'logistica_local_asignaciones',
    'campamento_camas',
    'lockers_casilleros',
    'comedor_registros',
    'empleado_incidencias',
    'permisos_autorizados',
    'checadas',
    'seguridad_inducciones',
    'movimientos_postulantes',
    'movimientos_postulaciones',
    'movimientos_historial_estancia',
    'evaluaciones',
    'bajas',
    'empleado_horas_extras',
    'empleado_festivos',
    'empleado_turnos',
    'contratistas_personal',
  ]

  for (const tbl of standardTables) {
    await safeUpdateEq(sb, tbl, { id_empleado: masterId }, 'id_empleado', dupId)
  }

  // Tablas con nombres de columna distintos
  await safeUpdateEq(sb, 'logistica_accesos', { id_chofer: masterId }, 'id_chofer', dupId)
  await safeUpdateEq(sb, 'app_viajes_activos', { id_chofer: masterId }, 'id_chofer', dupId)
  await safeUpdateEq(sb, 'solicitudes', { id_empleado: masterId }, 'id_empleado', dupId)
  await safeUpdateEq(sb, 'solicitudes', { id_empleado_objetivo: masterId }, 'id_empleado_objetivo', dupId)
  await safeUpdateEq(sb, 'transporte_personal_viajes', { creado_por: masterId }, 'creado_por', dupId)

  // 4. Tablas con llave compuesta o restricciones únicas por empleado
  await mergeCompositeRows(sb, 'empleado_adscripciones', masterId, dupId, ['fecha_inicio'])
  await mergeCompositeRows(sb, 'empleado_roles', masterId, dupId, ['fecha_inicio'], 'id_rol')
  await mergeCompositeRows(sb, 'empleado_salarios', masterId, dupId, ['fecha_inicio_vigencia'], 'id_salario')
  await mergeCompositeRows(sb, 'vacaciones_saldos', masterId, dupId, ['anio'], 'id_saldo')
  await mergeCompositeRows(sb, 'transporte_personal_asientos', masterId, dupId, ['id_viaje'], 'id_reserva')

  // 5. Tablas 1-a-1 (rescatar si maestro no tiene y eliminar duplicado)
  await rescueOneToOne(sb, 'empleado_domicilio', masterId, dupId)
  await rescueOneToOne(sb, 'empleado_ingreso', masterId, dupId)
  await rescueOneToOne(sb, 'empleado_banco', masterId, dupId)

  // 6. Eliminar físicamente el empleado duplicado
  const { error: delErr } = await sb.from('empleados').delete().eq('id_empleado', dupId)
  if (delErr) {
    throw new Error(
      `No se pudo eliminar físicamente al empleado duplicado (${dupRec.nombre || dupId}): ${delErr.message}`
    )
  }

  // 7. Finalmente actualizar el Maestro con los campos consolidados y editados
  if (desiredNum !== null && desiredNum !== undefined) {
    updateMasterPayload.numero_empleado = desiredNum
  }
  const { error: masterUpdErr } = await sb
    .from('empleados')
    .update(updateMasterPayload)
    .eq('id_empleado', masterId)
  if (masterUpdErr) {
    throw new Error(`Se eliminó el duplicado pero hubo error actualizando el Maestro: ${masterUpdErr.message}`)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action } = body
    const sb = getAdminClient()

    if (action === 'merge_employees') {
      const { masterId, duplicateIds, editedFields } = body
      if (!masterId || !Array.isArray(duplicateIds) || duplicateIds.length === 0) {
        return NextResponse.json({ error: 'Faltan masterId o duplicateIds' }, { status: 400 })
      }
      for (const dupId of duplicateIds) {
        await mergeSingleEmployeeIntoMaster(sb, masterId, dupId, editedFields)
      }
      return NextResponse.json({ success: true, mergedCount: duplicateIds.length })
    }

    if (action === 'merge_patients') {
      const { groups } = body
      // Soporta un grupo { masterId, duplicateIds } o arreglo `groups: [{ masterId, duplicateIds }]`
      const groupList: { masterId: string; duplicateIds: string[] }[] = Array.isArray(groups)
        ? groups
        : [{ masterId: body.masterId, duplicateIds: body.duplicateIds || [] }]

      let mergedCount = 0
      for (const g of groupList) {
        if (!g.masterId || !Array.isArray(g.duplicateIds)) continue
        for (const dupId of g.duplicateIds) {
          await mergeSinglePatientIntoMaster(sb, g.masterId, dupId)
          mergedCount++
        }
      }

      return NextResponse.json({ success: true, mergedCount })
    }

    if (action === 'cleanup_ghosts') {
      const { data: allEmps, error: fetchErr } = await sb.from('empleados').select('*')
      if (fetchErr) throw new Error(fetchErr.message)

      const ghosts = (allEmps || []).filter((e: any) => isMergedGhostEmployee(e))
      let purged = 0
      const errors: string[] = []

      for (const g of ghosts) {
        try {
          // Buscar si el texto "[FUSIONADO->#NUM]" refiere al maestro real
          const match = String(g.nombre || '').match(/->#?([^\]]+)\]/)
          let targetMasterId: string | null = null
          if (match && match[1]) {
            const ref = match[1].trim()
            const foundMaster = (allEmps || []).find(
              (e: any) =>
                !isMergedGhostEmployee(e) &&
                (String(e.id_empleado) === ref || String(e.numero_empleado) === ref)
            )
            if (foundMaster) targetMasterId = foundMaster.id_empleado
          }

          if (targetMasterId) {
            await mergeSingleEmployeeIntoMaster(sb, targetMasterId, g.id_empleado)
          } else {
            // Purgar directamente dependencias residuales si no se identifica maestro
            const tables = [
              'pases_medicos',
              'consultas_medicas',
              'pacientes',
              'empleado_domicilio',
              'empleado_ingreso',
              'empleado_banco',
              'empleado_salarios',
              'empleado_adscripciones',
              'empleado_roles',
              'empleado_turnos',
              'empleado_incidencias',
              'vacaciones_saldos',
              'bajas',
            ]
            for (const tbl of tables) {
              await safeDeleteEq(sb, tbl, 'id_empleado', g.id_empleado)
            }
            const { error: delErr } = await sb.from('empleados').delete().eq('id_empleado', g.id_empleado)
            if (delErr) throw new Error(delErr.message)
          }
          purged++
        } catch (err: any) {
          errors.push(`${g.id_empleado}: ${err.message}`)
        }
      }

      return NextResponse.json({ success: errors.length === 0, purged, errors })
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (err: any) {
    console.error('Error en /api/duplicados/unificar:', err)
    return NextResponse.json({ error: err.message || 'Error interno al unificar' }, { status: 500 })
  }
}
