import { jsPDF } from 'jspdf'
import { formatShortDate } from './contratistasConfig'

export interface ConvocatoriaBulletinData {
  folio_convocatoria: string
  puesto_vacante: string
  departamento_destino: string
  sub_departamento_destino?: string
  plazas_totales: number
  plazas_ocupadas?: number
  origen_vacante?: string
  liberada_por_nombre?: string
  categoria_tabulador?: string
  requisitos?: string
  fecha_apertura: string
  fecha_cierre_inscripcion: string
  dias_convocatoria?: number
  plan_avance_departamento?: string
}

function drawBacisLogoHeader(doc: jsPDF, cx: number, cy: number, size: number) {
  const r = size / 2
  const left = cx - r
  const top = cy - r

  doc.setFillColor(15, 23, 42)
  doc.setDrawColor(217, 119, 6)
  doc.setLineWidth(0.5)
  doc.roundedRect(left, top, size, size, size * 0.22, size * 0.22, 'FD')

  const pad = size * 0.1
  doc.setFillColor(29, 78, 216)
  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.35)
  doc.roundedRect(left + pad, top + pad, size - pad * 2, size - pad * 2, size * 0.18, size * 0.18, 'FD')

  doc.setFillColor(15, 23, 42)
  doc.rect(left + pad * 0.7, top + size - pad * 1.65, size - pad * 1.4, pad * 0.85, 'F')

  doc.setDrawColor(245, 158, 11)
  doc.setLineWidth(0.6)
  const toolY1 = cy - r * 0.55
  const toolY2 = cy - r * 0.05
  doc.line(cx - r * 0.35, toolY2, cx + r * 0.35, toolY1)
  doc.line(cx - r * 0.35, toolY1, cx + r * 0.35, toolY2)

  doc.setFont('times', 'bold')
  doc.setFontSize(size * 1.05)
  doc.setTextColor(245, 158, 11)
  doc.text('GB', cx + 0.2, cy + r * 0.52 + 0.2, { align: 'center' })
  doc.setTextColor(255, 255, 255)
  doc.text('GB', cx, cy + r * 0.52, { align: 'center' })
}

export function generateConvocatoriaSindicatoPDF(data: ConvocatoriaBulletinData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageW = 215.9
  const margin = 15
  const contentW = pageW - margin * 2

  // Marco exterior formal minero
  doc.setDrawColor(23, 37, 84)
  doc.setLineWidth(0.8)
  doc.roundedRect(10, 10, pageW - 20, 259, 3, 3, 'D')
  doc.setDrawColor(217, 119, 6)
  doc.setLineWidth(0.35)
  doc.roundedRect(11.5, 11.5, pageW - 23, 256, 2.5, 2.5, 'D')

  // Encabezado Corporativo Grupo Minero Bacís & Sindicato
  doc.setFillColor(15, 23, 42)
  doc.roundedRect(margin, 15, contentW, 28, 2.5, 2.5, 'F')
  doc.setFillColor(245, 158, 11)
  doc.rect(margin, 41.5, contentW, 1.5, 'F')

  drawBacisLogoHeader(doc, margin + 15, 28.5, 19)

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('GRUPO MINERO BACÍS S.A. DE C.V.', margin + 30, 23)

  doc.setTextColor(251, 191, 36)
  doc.setFontSize(9.5)
  doc.text('UNIDAD "EL HERRERO"  •  RECURSOS HUMANOS & COMISIÓN MIXTA / SINDICATO', margin + 30, 29)

  doc.setTextColor(203, 213, 225)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('BOLETÍN OFICIAL DE CONVOCATORIA DE VACANTE Y ESCALAFÓN INTERNO', margin + 30, 35.5)

  // Folio Box arriba a la derecha
  doc.setFillColor(245, 158, 11)
  doc.roundedRect(pageW - margin - 44, 18.5, 40, 12, 1.5, 1.5, 'F')
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.text('FOLIO CONVOCATORIA', pageW - margin - 24, 22.8, { align: 'center' })
  doc.setFont('courier', 'bold')
  doc.setFontSize(9)
  doc.text(data.folio_convocatoria, pageW - margin - 24, 28.2, { align: 'center' })

  // Cintillo de Anuncio de 10 Días
  let y = 49
  doc.setFillColor(254, 243, 199)
  doc.setDrawColor(245, 158, 11)
  doc.setLineWidth(0.5)
  doc.roundedRect(margin, y, contentW, 16, 2, 2, 'FD')

  doc.setTextColor(146, 64, 14)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(
    `¡CONVOCATORIA ABIERTA! — PERIODO DE INSCRIPCIÓN: ${data.dias_convocatoria || 10} DÍAS NATURALES`,
    pageW / 2,
    y + 6.8,
    { align: 'center' }
  )
  doc.setFontSize(8.5)
  doc.setTextColor(30, 41, 59)
  doc.text(
    `FECHA DE APERTURA: ${formatShortDate(data.fecha_apertura)}     |     FECHA LÍMITE PARA INSCRIBIRSE: ${formatShortDate(data.fecha_cierre_inscripcion)}`,
    pageW / 2,
    y + 12.8,
    { align: 'center' }
  )

  // Bloque Principal de la Vacante
  y += 22
  doc.setFillColor(23, 37, 84)
  doc.roundedRect(margin, y, contentW, 34, 2.5, 2.5, 'F')

  doc.setTextColor(147, 197, 253)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('PUESTO VACANTE CONVOCADO:', margin + 6, y + 7)

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.text((data.puesto_vacante || 'AYUDANTE DE PERFORISTA').toUpperCase(), margin + 6, y + 16)

  doc.setTextColor(251, 191, 36)
  doc.setFontSize(9.5)
  const deptoStr = `DEPARTAMENTO DESTINO: ${data.departamento_destino.toUpperCase()}${
    data.sub_departamento_destino ? `  (${data.sub_departamento_destino.toUpperCase()})` : ''
  }`
  doc.text(deptoStr, margin + 6, y + 23.5)

  doc.setTextColor(226, 232, 240)
  doc.setFontSize(8)
  const libres = Math.max(1, (data.plazas_totales || 1) - (data.plazas_ocupadas || 0))
  doc.text(
    `PLAZAS DISPONIBLES: ${libres}   |   CATEGORÍA: ${(data.categoria_tabulador || 'SINDICALIZADO / ESCALAFÓN').toUpperCase()}   |   ORIGEN: ${(data.origen_vacante || 'VACANTE LIBRE').toUpperCase()}`,
    margin + 6,
    y + 30
  )

  // Requisitos y Plan del Departamento
  y += 40
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(203, 213, 225)
  doc.roundedRect(margin, y, contentW, 32, 2, 2, 'FD')

  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('1. REQUISITOS Y PERFIL DE LA VACANTE:', margin + 5, y + 7)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.2)
  const reqLines = doc.splitTextToSize(
    data.requisitos ||
      'Personal activo con disponibilidad de horario, cumplimiento de normas de Seguridad Industrial, evaluación médica vigente y disposición para plan de adiestramiento en el área.',
    contentW - 10
  )
  doc.text(reqLines.slice(0, 3), margin + 5, y + 13)

  if (data.plan_avance_departamento) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(30, 58, 138)
    doc.text(`PLAN DE AVANCE / EVALUACIÓN DEL ÁREA: ${data.plan_avance_departamento.slice(0, 95)}`, margin + 5, y + 27.5)
  }

  // Datos que debe proporcionar el trabajador en su inscripción
  y += 38
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(23, 37, 84)
  doc.roundedRect(margin, y, contentW, 48, 2, 2, 'FD')

  doc.setFillColor(15, 23, 42)
  doc.rect(margin, y, contentW, 8, 'F')
  doc.setTextColor(251, 191, 36)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('2. DATOS OBLIGATORIOS PARA EL REGISTRO DE INSCRIPCIÓN DEL POSTULANTE', margin + 5, y + 5.5)

  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.2)
  doc.text(
    'Todo trabajador interesado en postularse a la vacante deberá quedar inscrito dentro del periodo de 10 días registrando:',
    margin + 5,
    y + 14
  )

  doc.setFont('helvetica', 'bold')
  doc.text('• Nombre Completo y Número de Nómina', margin + 8, y + 21)
  doc.text('• Fecha de Inscripción a la Convocatoria', margin + 8, y + 27)
  doc.text('• Departamento / Sub-departamento y Puesto Actual', margin + 8, y + 33)
  doc.text('• Puesto al que se Postula y Teléfono Celular', margin + 8, y + 39)

  doc.text('• Años de Antigüedad en la Empresa (Escalafón)', margin + 102, y + 21)
  doc.text('• [  ] ¿Cuenta con Años de Experiencia en Mina?', margin + 102, y + 27)
  doc.text('• [  ] ¿Tiene Experiencia Directa en el Puesto?', margin + 102, y + 33)
  doc.text('• [  ] ¿Requiere Capacitación Previa / Adiestramiento?', margin + 102, y + 39)

  // Procedimiento Oficial de Selección y Movimiento (Reglas de Ajedrez)
  y += 54
  doc.setFillColor(241, 245, 249)
  doc.setDrawColor(148, 163, 184)
  doc.roundedRect(margin, y, contentW, 38, 2, 2, 'FD')

  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('3. PROCEDIMIENTO DE AUTORIZACIÓN, FECHAS Y LIBERACIÓN ENTRE DEPARTAMENTOS:', margin + 5, y + 6.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.6)
  const steps = [
    '1) Al cierre o corte de inscripciones, la lista de postulantes pasa a validación previa de Recursos Humanos Unidad y RH Corporativo.',
    '2) El Departamento de la Vacante define el Plan de Avance y selecciona a los candidatos indicando las fechas para presentarse.',
    '3) El sistema notifica automáticamente por correo a los Encargados de los Departamentos/Sub-departamentos de origen de cada trabajador.',
    '4) Una vez que el Encargado de origen confirma que SÍ puede liberar al trabajador en la fecha, se notifica al área destino y se ejecuta el movimiento.',
    '5) Si un departamento de origen no puede liberar en esa fecha por operación, el movimiento se reprograma para una nueva fecha acordada.',
    '6) Durante su estancia en el nuevo puesto, se contabilizan sus días acumulados y el Departamento Asignado registra su calificación de desempeño.',
  ]
  let sy = y + 12.5
  for (const st of steps) {
    doc.text(st, margin + 5, sy)
    sy += 4.3
  }

  // Firmas Oficiales
  const signY = 250
  const colW = contentW / 4
  const labels = [
    { t1: 'RECURSOS HUMANOS', t2: 'UNIDAD MINERA' },
    { t1: 'AUTORIZACIÓN', t2: 'RH CORPORATIVO' },
    { t1: 'COMITÉ EJECUTIVO', t2: 'SINDICATO / ESCALAFÓN' },
    { t1: 'JEFATURA / SUPT.', t2: data.departamento_destino.toUpperCase().slice(0, 22) },
  ]

  doc.setDrawColor(100, 116, 139)
  doc.setLineWidth(0.35)
  labels.forEach((lb, i) => {
    const cx = margin + colW * i + colW / 2
    doc.line(cx - 19, signY, cx + 19, signY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.8)
    doc.setTextColor(15, 23, 42)
    doc.text(lb.t1, cx, signY + 4.2, { align: 'center' })
    doc.setTextColor(100, 116, 139)
    doc.text(lb.t2, cx, signY + 7.8, { align: 'center' })
  })

  doc.save(`Convocatoria_10Dias_${data.folio_convocatoria}_${data.puesto_vacante.replace(/\s+/g, '_')}.pdf`)
}
