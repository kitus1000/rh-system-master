import { jsPDF } from 'jspdf'

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
  seccion_sindical?: string
  firma_area?: string
}

const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function formatLongSpanishDate(isoDate?: string): string {
  const clean = (isoDate || '').trim().split('T')[0]
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean)
  if (match) {
    const year = match[1]
    const monthIdx = Math.max(0, Math.min(11, Number(match[2]) - 1))
    const day = Number(match[3])
    return `${day} de ${MESES_ES[monthIdx]} del ${year}`
  }
  const now = new Date()
  return `${now.getDate()} de ${MESES_ES[now.getMonth()]} del ${now.getFullYear()}`
}

function formatDiasConvocatoriaTexto(dias?: number): string {
  const n = Number(dias || 10)
  const map: Record<number, string> = {
    1: 'un día',
    5: 'cinco días',
    7: 'siete días',
    10: 'diez días',
    15: 'quince días',
    20: 'veinte días',
    30: 'treinta días',
  }
  return map[n] || `${n} días`
}

async function tryLoadPublicLogoDataUrl(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') return null
    const res = await fetch('/logo-bacis.png')
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
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
  doc.rect(left + pad * 0.75, top + size - pad * 1.6, size - pad * 1.5, pad * 0.8, 'F')

  doc.setDrawColor(245, 158, 11)
  doc.setLineWidth(0.55)
  const toolY1 = cy - r * 0.56
  const toolY2 = cy - r * 0.12
  doc.line(cx - r * 0.34, toolY2, cx + r * 0.34, toolY1)
  doc.line(cx - r * 0.34, toolY1, cx + r * 0.34, toolY2)

  doc.setFont('times', 'bold')
  doc.setFontSize(Math.max(6, size * 0.68))
  doc.setTextColor(245, 158, 11)
  doc.text('GB', cx + 0.18, cy + r * 0.52 + 0.16, { align: 'center' })
  doc.setTextColor(255, 255, 255)
  doc.text('GB', cx, cy + r * 0.52, { align: 'center' })
}

export async function generateConvocatoriaSindicatoPDF(data: ConvocatoriaBulletinData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageW = 215.9
  const margin = 22
  const contentW = pageW - margin * 2

  // 1. Membrete Formal Corporativo
  const logoB64 = await tryLoadPublicLogoDataUrl()
  let logoRendered = false
  if (logoB64) {
    try {
      doc.addImage(logoB64, 'PNG', margin, 16, 21, 21)
      logoRendered = true
    } catch {
      logoRendered = false
    }
  }
  if (!logoRendered) {
    drawBacisLogoHeader(doc, margin + 10.5, 26.5, 20)
  }

  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('GRUPO MINERO BACÍS S.A. DE C.V.', pageW / 2 + 8, 24.5, { align: 'center' })

  doc.setTextColor(23, 37, 84)
  doc.setFontSize(12)
  doc.text('UNIDAD "EL HERRERO".', pageW / 2 + 8, 31.5, { align: 'center' })

  // Líneas finas institucionales bajo membrete
  doc.setDrawColor(23, 37, 84)
  doc.setLineWidth(0.8)
  doc.line(margin, 41, pageW - margin, 41)
  doc.setDrawColor(217, 119, 6)
  doc.setLineWidth(0.4)
  doc.line(margin, 42.3, pageW - margin, 42.3)

  // 2. Fecha Formal Alineada a la Derecha
  const fechaAperturaLarga = formatLongSpanishDate(data.fecha_apertura)
  const fechaCierreLarga = formatLongSpanishDate(data.fecha_cierre_inscripcion)
  const diasTexto = formatDiasConvocatoriaTexto(data.dias_convocatoria)

  let y = 55
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`A ${fechaAperturaLarga}.`, pageW - margin, y, { align: 'right' })

  doc.setTextColor(100, 116, 139)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(`Folio: ${data.folio_convocatoria || 'S/F'}`, pageW - margin, y + 5.5, { align: 'right' })

  // 3. Destinatario Sindicato Alineado a la Izquierda
  y = 74
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.text(data.seccion_sindical || 'S.N.T.M.M.S.S.R.M. Secc. 45', margin, y)
  doc.text('Presente. -', margin, y + 6.5)

  // 4. Párrafo Introductorio
  y = 95
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(24, 24, 27)
  const introText =
    'En base a la plantilla de trabajadores autorizados para el desarrollo de las operaciones, se hace de su conocimiento que se hará aplicación en la siguiente categoría que está vacante:'
  const introLines = doc.splitTextToSize(introText, contentW) as string[]
  introLines.forEach((ln, idx) => {
    doc.text(ln, margin, y + idx * 6.2)
  })
  y += introLines.length * 6.2 + 8

  // 5. Tabla Formal Centrada: Categoría | Cantidad | Departamento
  const col1W = 74
  const col2W = 28
  const col3W = contentW - col1W - col2W
  const headerH = 10

  doc.setFillColor(23, 37, 84)
  doc.setDrawColor(23, 37, 84)
  doc.setLineWidth(0.35)
  doc.rect(margin, y, contentW, headerH, 'FD')

  // Divisiones de columnas en encabezado
  doc.setDrawColor(148, 163, 184)
  doc.line(margin + col1W, y, margin + col1W, y + headerH)
  doc.line(margin + col1W + col2W, y, margin + col1W + col2W, y + headerH)

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.text('Categoría', margin + col1W / 2, y + 6.7, { align: 'center' })
  doc.text('Cantidad', margin + col1W + col2W / 2, y + 6.7, { align: 'center' })
  doc.text('Departamento', margin + col1W + col2W + col3W / 2, y + 6.7, { align: 'center' })

  y += headerH

  const categoriaText = (data.puesto_vacante || 'VACANTE').toUpperCase()
  const cantidadText = String(Math.max(1, data.plazas_totales || 1))
  const deptoMainText = (data.departamento_destino || 'OPERACIONES').toUpperCase()
  const subDeptoClean = (data.sub_departamento_destino || '').trim()
  const hasDistinctSub =
    Boolean(subDeptoClean) && subDeptoClean.toUpperCase() !== deptoMainText

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  const catLines = doc.splitTextToSize(categoriaText, col1W - 6) as string[]
  const deptLines = doc.splitTextToSize(deptoMainText, col3W - 6) as string[]
  const maxCellLines = Math.max(catLines.length, deptLines.length + (hasDistinctSub ? 1 : 0), 1)
  const rowH = Math.max(15, maxCellLines * 6 + 7)

  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(23, 37, 84)
  doc.setLineWidth(0.35)
  doc.rect(margin, y, contentW, rowH, 'FD')
  doc.line(margin + col1W, y, margin + col1W, y + rowH)
  doc.line(margin + col1W + col2W, y, margin + col1W + col2W, y + rowH)

  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  const catStartY = y + rowH / 2 - ((catLines.length - 1) * 5.5) / 2 + 1.8
  catLines.forEach((ln, idx) => {
    doc.text(ln, margin + col1W / 2, catStartY + idx * 5.5, { align: 'center' })
  })

  doc.setFontSize(12.5)
  doc.text(cantidadText, margin + col1W + col2W / 2, y + rowH / 2 + 2, { align: 'center' })

  doc.setFontSize(11)
  const totalDeptRows = deptLines.length + (hasDistinctSub ? 1 : 0)
  const deptStartY = y + rowH / 2 - ((totalDeptRows - 1) * 5.2) / 2 + 1.8
  deptLines.forEach((ln, idx) => {
    doc.text(ln, margin + col1W + col2W + col3W / 2, deptStartY + idx * 5.2, { align: 'center' })
  })
  if (hasDistinctSub) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(71, 85, 105)
    doc.text(
      `(${subDeptoClean})`,
      margin + col1W + col2W + col3W / 2,
      deptStartY + deptLines.length * 5.2,
      { align: 'center' }
    )
  }

  y += rowH + 14

  // 6. Párrafo Normativo C.C.T. Artículo 116
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(24, 24, 27)
  const cctParagraph =
    `Se solicita a las personas que cumplan con el perfil para dicho puesto y de acuerdo al escalafón, ` +
    `se presenten en las oficinas de Recursos Humanos, para que, en el término de ${diasTexto} a partir ` +
    `de esta fecha (cierre el ${fechaCierreLarga}), hagan aplicación a dicha categoría los trabajadores ` +
    `que se crean con derecho a ascender, de acuerdo a su competencia, antigüedad de empresa y ` +
    `departamento, tal y como lo marca el Artículo 116 del C.C.T.`
  const cctLines = doc.splitTextToSize(cctParagraph, contentW) as string[]
  cctLines.forEach((ln, idx) => {
    doc.text(ln, margin, y + idx * 6.4)
  })

  y += cctLines.length * 6.4 + 10

  // 7. Despedida Formal
  doc.text('Sin más y en espera de sus comentarios, quedo.', margin, y)

  // 8. Bloque Centrado de Firma
  const signBlockY = Math.max(y + 26, 214)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  doc.text('Atentamente', pageW / 2, signBlockY, { align: 'center' })

  doc.setDrawColor(100, 116, 139)
  doc.setLineWidth(0.4)
  doc.line(pageW / 2 - 34, signBlockY + 20, pageW / 2 + 34, signBlockY + 20)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.text(data.firma_area || 'Recursos Humanos', pageW / 2, signBlockY + 25.5, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  doc.text('Grupo Minero Bacís S.A. de C.V. — Unidad El Herrero', pageW / 2, signBlockY + 30.5, { align: 'center' })

  // 9. Pie de Oficio C.c.p. Tableros de avisos
  doc.setTextColor(24, 24, 27)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('C.c.p. Tableros de avisos', margin, 260)

  const fileVacanteSlug = (data.puesto_vacante || 'Vacante').replace(/\s+/g, '_')
  doc.save(`Aviso_Vacante_${data.folio_convocatoria}_${fileVacanteSlug}.pdf`)
}
