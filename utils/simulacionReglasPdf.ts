import { jsPDF } from 'jspdf'

export interface SimulacionRuleItem {
  regla: string
  responsable: string
  estado: 'CUMPLE' | 'BLOQUEA' | 'NO_APLICA'
  detalle: string
}

export interface SimulacionReglasReportData {
  escenarioNombre: string
  candidatoNombre: string
  puestoActual: string
  departamentoOrigen: string
  puestoVacante: string
  departamentoDestino: string
  plazasLibres: number
  veredicto: 'PROCEDE' | 'BLOQUEADO'
  reglasMatriz: {
    jefe_rh_unidad_nombre: string
    jefe_rh_unidad_correo: string
    supt_rh_corporativo_nombre: string
    supt_rh_corporativo_correo: string
    sindicato_nombre: string
    sindicato_correo: string
    regla_vacante_libre_obligatoria: boolean
    regla_orden_secuencial: boolean
    regla_bloqueo_por_usuario: boolean
    regla_requiere_jefe_rh_unidad: boolean
    regla_requiere_supt_rh_corporativo: boolean
    regla_requiere_liberacion_origen: boolean
    regla_permitir_efecto_domino: boolean
    regla_dias_convocatoria: number
  }
  evaluacionReglas: SimulacionRuleItem[]
  cadenaNotificaciones: string[]
  efectoDominoMensaje?: string
}

function drawBacisLogoMini(doc: jsPDF, cx: number, cy: number, size: number) {
  const r = size / 2
  const left = cx - r
  const top = cy - r

  doc.setFillColor(15, 23, 42)
  doc.setDrawColor(217, 119, 6)
  doc.setLineWidth(0.45)
  doc.roundedRect(left, top, size, size, size * 0.22, size * 0.22, 'FD')

  const pad = size * 0.1
  doc.setFillColor(29, 78, 216)
  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.3)
  doc.roundedRect(left + pad, top + pad, size - pad * 2, size - pad * 2, size * 0.18, size * 0.18, 'FD')

  doc.setFillColor(15, 23, 42)
  doc.rect(left + pad * 0.7, top + size - pad * 1.65, size - pad * 1.4, pad * 0.85, 'F')

  doc.setDrawColor(245, 158, 11)
  doc.setLineWidth(0.55)
  const toolY1 = cy - r * 0.55
  const toolY2 = cy - r * 0.05
  doc.line(cx - r * 0.35, toolY2, cx + r * 0.35, toolY1)
  doc.line(cx - r * 0.35, toolY1, cx + r * 0.35, toolY2)

  doc.setFont('times', 'bold')
  doc.setFontSize(size * 1.0)
  doc.setTextColor(245, 158, 11)
  doc.text('GB', cx + 0.18, cy + r * 0.52 + 0.15, { align: 'center' })
  doc.setTextColor(255, 255, 255)
  doc.text('GB', cx, cy + r * 0.52, { align: 'center' })
}

export function generateSimulacionReglasPDF(data: SimulacionReglasReportData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageW = 215.9
  const margin = 14
  const contentW = pageW - margin * 2

  // Marco corporativo
  doc.setDrawColor(23, 37, 84)
  doc.setLineWidth(0.7)
  doc.roundedRect(9, 9, pageW - 18, 261, 3, 3, 'D')

  // Encabezado
  doc.setFillColor(15, 23, 42)
  doc.roundedRect(margin, 13, contentW, 25, 2.5, 2.5, 'F')
  doc.setFillColor(245, 158, 11)
  doc.rect(margin, 36.8, contentW, 1.2, 'F')

  drawBacisLogoMini(doc, margin + 12, 25, 16)

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12.5)
  doc.text('GRUPO MINERO BACÍS S.A. DE C.V. — UNIDAD "EL HERRERO"', margin + 24, 21)

  doc.setTextColor(251, 191, 36)
  doc.setFontSize(9)
  doc.text('REPORTE OFICIAL DE AUDITORÍA DE REGLAS Y SIMULACIÓN DE MOVIMIENTOS', margin + 24, 27)

  doc.setTextColor(203, 213, 225)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text(
    `Generado: ${new Date().toLocaleString('es-MX')}  •  Escenario Simulado: ${data.escenarioNombre}`,
    margin + 24,
    33
  )

  // Sección 1: Matriz de Titulares Autorizadores
  let y = 43
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('1. MATRIZ DE TITULARES AUTORIZADORES ASIGNADOS', margin, y)

  y += 3
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(203, 213, 225)
  doc.roundedRect(margin, y, contentW, 25, 2, 2, 'FD')

  doc.setFontSize(7.8)
  doc.setTextColor(30, 41, 59)
  doc.text(
    `• Paso 1 — Jefe de RH Unidad: ${data.reglasMatriz.jefe_rh_unidad_nombre} (${data.reglasMatriz.jefe_rh_unidad_correo})`,
    margin + 4,
    y + 6.5
  )
  doc.text(
    `• Paso 2 — Supt. de RH Corporativo: ${data.reglasMatriz.supt_rh_corporativo_nombre} (${data.reglasMatriz.supt_rh_corporativo_correo})`,
    margin + 4,
    y + 12.5
  )
  doc.text(
    `• Comisión Sindical / Escalafón: ${data.reglasMatriz.sindicato_nombre} (${data.reglasMatriz.sindicato_correo})`,
    margin + 4,
    y + 18.5
  )
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(180, 83, 9)
  doc.text(
    `Candado estricto por usuario: ${data.reglasMatriz.regla_bloqueo_por_usuario ? 'ACTIVO (Solo titular firma)' : 'FLEXIBLE'}   |   Orden Secuencial: ${data.reglasMatriz.regla_orden_secuencial ? 'ACTIVO' : 'LIBRE'}`,
    margin + 4,
    y + 23.2
  )

  // Sección 2: Reglas Activas del Tablero de Ajedrez
  y += 31
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('2. REGLAS CONFIGURADAS EN EL SISTEMA', margin, y)

  y += 3
  doc.setFillColor(241, 245, 249)
  doc.roundedRect(margin, y, contentW, 26, 2, 2, 'FD')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.6)
  doc.setTextColor(30, 41, 59)
  const rulesSummary = [
    `[${data.reglasMatriz.regla_vacante_libre_obligatoria ? 'ACTIVA' : 'INACTIVA'}] Exigir Vacante / Plaza Libre (Prohibido mover sin plaza disponible)`,
    `[${data.reglasMatriz.regla_requiere_jefe_rh_unidad ? 'ACTIVA' : 'INACTIVA'}] Firma obligatoria de Jefe de RH Unidad (Paso 1)`,
    `[${data.reglasMatriz.regla_requiere_supt_rh_corporativo ? 'ACTIVA' : 'INACTIVA'}] Firma obligatoria de Superintendente de RH Corporativo (Paso 2)`,
    `[${data.reglasMatriz.regla_requiere_liberacion_origen ? 'ACTIVA' : 'INACTIVA'}] Liberación SÍ/NO del Encargado del Depto/Sub-depto Origen`,
    `[${data.reglasMatriz.regla_permitir_efecto_domino ? 'ACTIVA' : 'INACTIVA'}] Efecto Dominó Automático (Abre vacante de ${data.reglasMatriz.regla_dias_convocatoria} días en puesto origen)`,
  ]
  let ry = y + 5.5
  for (const rs of rulesSummary) {
    doc.text(rs, margin + 4, ry)
    ry += 4.5
  }

  // Sección 3: Resultado de la Simulación Ejecutada
  y += 32
  const isOk = data.veredicto === 'PROCEDE'
  doc.setFillColor(isOk ? 6 : 136, isOk ? 95 : 19, isOk ? 70 : 55)
  doc.roundedRect(margin, y, contentW, 18, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.text(
    `3. VEREDICTO DE SIMULACIÓN: ${isOk ? 'PROCEDE EL MOVIMIENTO (CUMPLE TODAS LAS REGLAS)' : 'MOVIMIENTO BLOQUEADO POR REGLAS'}`,
    margin + 5,
    y + 7.2
  )
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(
    `Trabajador: ${data.candidatoNombre}  |  Trayectoria: ${data.puestoActual} (${data.departamentoOrigen}) -> ${data.puestoVacante} (${data.departamentoDestino})  |  Plazas libres: ${data.plazasLibres}`,
    margin + 5,
    y + 13.5
  )

  // Tabla Evaluación Regla por Regla
  y += 22
  doc.setFillColor(15, 23, 42)
  doc.rect(margin, y, contentW, 7, 'F')
  doc.setTextColor(251, 191, 36)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text('REGLA EVALUADA', margin + 3, y + 4.8)
  doc.text('AUTORIZADOR RESPONSABLE', margin + 62, y + 4.8)
  doc.text('ESTADO', margin + 120, y + 4.8)
  doc.text('DETALLE DE SIMULACIÓN', margin + 142, y + 4.8)

  y += 7
  for (const item of data.evaluacionReglas) {
    const rowH = 10
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(226, 232, 240)
    doc.rect(margin, y, contentW, rowH, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(15, 23, 42)
    doc.text(doc.splitTextToSize(item.regla, 56).slice(0, 2), margin + 3, y + 4)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(51, 65, 85)
    doc.text(doc.splitTextToSize(item.responsable, 54).slice(0, 2), margin + 62, y + 4)

    if (item.estado === 'CUMPLE') doc.setTextColor(5, 150, 105)
    else if (item.estado === 'BLOQUEA') doc.setTextColor(225, 29, 72)
    else doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'bold')
    doc.text(item.estado, margin + 120, y + 5.5)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(51, 65, 85)
    doc.text(doc.splitTextToSize(item.detalle, 44).slice(0, 2), margin + 142, y + 4)

    y += rowH
  }

  // Sección 4: Cadena de Notificaciones y Efecto Dominó
  y += 6
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('4. CADENA DE NOTIFICACIONES Y EFECTO DOMINÓ RESULTANTE:', margin, y)

  y += 3
  doc.setFillColor(254, 243, 199)
  doc.setDrawColor(245, 158, 11)
  doc.roundedRect(margin, y, contentW, 28, 2, 2, 'FD')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.4)
  doc.setTextColor(30, 41, 59)
  let ny = y + 5.2
  for (const notif of data.cadenaNotificaciones.slice(0, 4)) {
    doc.text(`• ${notif.slice(0, 108)}`, margin + 4, ny)
    ny += 4.6
  }
  if (data.efectoDominoMensaje) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(146, 64, 14)
    doc.text(`♟️ ${data.efectoDominoMensaje.slice(0, 105)}`, margin + 4, ny + 1)
  }

  // Firmas Oficiales
  const signY = 250
  const colW = contentW / 4
  const signs = [
    { t1: data.reglasMatriz.jefe_rh_unidad_nombre.slice(0, 24), t2: 'JEFE DE RH UNIDAD' },
    { t1: data.reglasMatriz.supt_rh_corporativo_nombre.slice(0, 24), t2: 'SUPT. RH CORPORATIVO' },
    { t1: data.reglasMatriz.sindicato_nombre.slice(0, 24), t2: 'SINDICATO / ESCALAFÓN' },
    { t1: 'JEFATURA / SUPT.', t2: data.departamentoDestino.toUpperCase().slice(0, 22) },
  ]

  doc.setDrawColor(100, 116, 139)
  doc.setLineWidth(0.35)
  signs.forEach((s, idx) => {
    const cx = margin + colW * idx + colW / 2
    doc.line(cx - 20, signY, cx + 20, signY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.8)
    doc.setTextColor(15, 23, 42)
    doc.text(s.t1, cx, signY + 4, { align: 'center' })
    doc.setTextColor(100, 116, 139)
    doc.text(s.t2, cx, signY + 7.6, { align: 'center' })
  })

  doc.save(`Reporte_Reglas_Simulacion_Bacis_${Date.now().toString().slice(-5)}.pdf`)
}
