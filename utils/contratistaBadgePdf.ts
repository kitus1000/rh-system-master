import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { formatShortDate } from './contratistasConfig'

export type BadgeSizeFormat =
  | 'cr80_pvc'      // 54 x 85.6 mm (PDF 2 páginas tamaño exacto para Impresora de Credenciales PVC)
  | 'cr80_enmicar'  // 54 x 86 mm (En hoja Carta con guías de corte y doblez para enmicar)
  | 'gafete_medio'  // 70 x 105 mm (Gafete minero mediano porta-gafete en hoja Carta)
  | 'gafete_grande' // 90 x 135 mm (Gafete minero grande alta visibilidad en hoja Carta)

export interface BadgeSizeOption {
  id: BadgeSizeFormat
  label: string
  dimensions: string
  description: string
  widthMm: number
  heightMm: number
  directCardPage?: boolean
}

export const BADGE_SIZE_OPTIONS: BadgeSizeOption[] = [
  {
    id: 'cr80_pvc',
    label: 'Impresora de Credenciales PVC (CR80 Directo)',
    dimensions: '54 × 85.6 mm',
    description: '2 páginas al tamaño exacto de tarjeta plástica PVC (Zebra, Fargo, Evolis) sin bordes.',
    widthMm: 54,
    heightMm: 85.6,
    directCardPage: true,
  },
  {
    id: 'cr80_enmicar',
    label: 'Credencial Estándar para Recortar y Enmicar',
    dimensions: '54 × 86 mm (Hoja Carta)',
    description: 'Tamaño tarjeta estándar en hoja Carta con guías de recorte y línea de doblez para mica comercial.',
    widthMm: 54,
    heightMm: 86,
  },
  {
    id: 'gafete_medio',
    label: 'Gafete Minero Mediano (Porta-Gafete / Cordón)',
    dimensions: '70 × 105 mm (Hoja Carta)',
    description: 'Tamaño intermedio ideal para porta-gafete vertical con clip o cordón y mica mediana.',
    widthMm: 70,
    heightMm: 105,
  },
  {
    id: 'gafete_grande',
    label: 'Gafete Minero Grande (Alta Visibilidad Caseta)',
    dimensions: '90 × 135 mm (Hoja Carta)',
    description: 'Formato grande de alta visibilidad a distancia para control rápido en Caseta y Mina.',
    widthMm: 90,
    heightMm: 135,
  },
]

export interface ContractorBadgeData {
  codigo_qr: string
  nombre_completo: string
  empresa: string
  rfc_empresa?: string
  puesto: string
  nss?: string
  curp?: string
  tipo_sangre?: string
  contacto_emergencia?: string
  departamento_autorizado: string
  area_trabajo?: string
  vigencia_desde: string
  vigencia_hasta: string
  folio_solicitud: string
  foto_url?: string | null
  estatus?: string
  size_format?: BadgeSizeFormat
}

function fitSingleLine(
  doc: jsPDF,
  rawText: string,
  maxW: number,
  initialPt: number,
  minPt = 3.8
): { text: string; fontSize: number } {
  const safeMax = Math.max(4, maxW)
  const clean = (rawText || '').replace(/\s+/g, ' ').trim()
  if (!clean) return { text: '', fontSize: initialPt }

  let pt = initialPt
  while (pt > minPt) {
    doc.setFontSize(pt)
    if (doc.getTextWidth(clean) <= safeMax) {
      return { text: clean, fontSize: pt }
    }
    pt = Math.max(minPt, Number((pt - 0.3).toFixed(2)))
    if (pt === minPt) break
  }

  doc.setFontSize(minPt)
  if (doc.getTextWidth(clean) <= safeMax) {
    return { text: clean, fontSize: minPt }
  }

  let truncated = clean
  while (truncated.length > 1 && doc.getTextWidth(`${truncated}...`) > safeMax) {
    truncated = truncated.slice(0, -1).trimEnd()
  }
  return {
    text: truncated.length < clean.length ? `${truncated}...` : truncated,
    fontSize: minPt,
  }
}

function fitMultiLine(
  doc: jsPDF,
  rawText: string,
  maxW: number,
  maxLines: number,
  initialPt: number,
  minPt = 3.8
): { lines: string[]; fontSize: number } {
  const safeMax = Math.max(4, maxW)
  const clean = (rawText || '').replace(/\s+/g, ' ').trim()
  if (!clean) return { lines: [], fontSize: initialPt }

  let pt = initialPt
  while (pt > minPt) {
    doc.setFontSize(pt)
    const lines = doc.splitTextToSize(clean, safeMax) as string[]
    if (lines.length <= maxLines) {
      return { lines, fontSize: pt }
    }
    pt = Math.max(minPt, Number((pt - 0.3).toFixed(2)))
    if (pt === minPt) break
  }

  doc.setFontSize(minPt)
  const lines = doc.splitTextToSize(clean, safeMax) as string[]
  if (lines.length <= maxLines) {
    return { lines, fontSize: minPt }
  }

  const sliced = lines.slice(0, maxLines)
  const lastIdx = sliced.length - 1
  let last = sliced[lastIdx] || ''
  while (last.length > 1 && doc.getTextWidth(`${last}...`) > safeMax) {
    last = last.slice(0, -1).trimEnd()
  }
  sliced[lastIdx] = `${last}...`
  return { lines: sliced, fontSize: minPt }
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    if (url.startsWith('data:image')) return url
    const res = await fetch(url)
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

/**
 * Dibuja el emblema vectorial de Grupo Minero Bacís (Túnel minero azul cobalto, pico y pala cruzados dorados y siglas GB)
 */
function drawBacisMiningLogo(doc: jsPDF, cx: number, cy: number, size: number) {
  const r = size / 2
  const left = cx - r
  const top = cy - r

  // Base exterior tipo portal de mina
  doc.setFillColor(15, 23, 42)
  doc.setDrawColor(217, 119, 6)
  doc.setLineWidth(0.32 * (size / 14))
  doc.roundedRect(left, top, size, size, size * 0.22, size * 0.22, 'FD')

  // Arco interior Azul Cobalto Bacís
  const pad = size * 0.1
  doc.setFillColor(29, 78, 216)
  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.24 * (size / 14))
  doc.roundedRect(left + pad, top + pad, size - pad * 2, size - pad * 2, size * 0.18, size * 0.18, 'FD')

  // Solera / base del túnel en la parte inferior del emblema
  doc.setFillColor(15, 23, 42)
  doc.rect(left + pad * 0.85, top + size - pad * 1.6, size - pad * 1.7, pad * 0.78, 'F')

  // Pico y Pala cruzados en la parte superior del arco (Dorado)
  doc.setDrawColor(245, 158, 11)
  doc.setLineWidth(0.4 * (size / 14))
  const toolY1 = cy - r * 0.56
  const toolY2 = cy - r * 0.14
  doc.line(cx - r * 0.34, toolY2, cx + r * 0.34, toolY1)
  doc.line(cx - r * 0.34, toolY1, cx + r * 0.34, toolY2)

  // Cabeza de pico y pala
  doc.setLineWidth(0.3 * (size / 14))
  doc.line(cx - r * 0.4, toolY1 + r * 0.08, cx - r * 0.24, toolY1 - r * 0.08)
  doc.line(cx + r * 0.24, toolY1 - r * 0.08, cx + r * 0.4, toolY1 + r * 0.08)

  // Letras emblemáticas "GB" contenidas dentro del arco sin salir del borde
  doc.setFont('times', 'bold')
  doc.setFontSize(Math.max(4.4, size * 0.68))
  doc.setTextColor(245, 158, 11)
  doc.text('GB', cx + 0.15, cy + r * 0.52 + 0.12, { align: 'center' })
  doc.setTextColor(248, 250, 252)
  doc.text('GB', cx, cy + r * 0.52, { align: 'center' })
}

/**
 * Dibuja franja minera de seguridad (amarillo/ámbar y obsidiana)
 */
function drawSafetyStripeBar(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(245, 158, 11)
  doc.rect(x, y, w, h, 'F')

  const stripeCount = 12
  const segW = w / stripeCount
  doc.setFillColor(11, 17, 32)
  for (let i = 0; i < stripeCount; i += 2) {
    doc.rect(x + i * segW, y, segW * 0.55, h, 'F')
  }
}

/**
 * Renderiza el FRENTE de la credencial ajustado estrictamente a los márgenes internos
 */
async function renderBadgeFront(
  doc: jsPDF,
  data: ContractorBadgeData,
  cardX: number,
  cardY: number,
  cardW: number,
  cardH: number,
  qrDataUrl: string,
  photoB64: string | null
) {
  const s = cardW / 90
  const sy = cardH / 135
  const f = Math.min(s, sy)

  // 1. Fondo Principal Obsidiana Minera
  doc.setFillColor(11, 17, 32)
  doc.setDrawColor(217, 119, 6)
  doc.setLineWidth(0.5 * f)
  doc.roundedRect(cardX, cardY, cardW, cardH, 3.0 * f, 3.0 * f, 'FD')

  // Marco estructural interior azul real
  const inPad = 1.6 * f
  const innerPadX = inPad + 2.0 * s
  const cardInnerX = cardX + innerPadX
  const innerW = cardW - innerPadX * 2

  doc.setDrawColor(30, 58, 138)
  doc.setLineWidth(0.3 * f)
  doc.roundedRect(cardX + inPad, cardY + inPad, cardW - inPad * 2, cardH - inPad * 2, 2.2 * f, 2.2 * f, 'D')

  // 2. Franja Superior de Seguridad Minera
  const stripeH = 2.6 * sy
  drawSafetyStripeBar(doc, cardX + inPad, cardY + inPad, cardW - inPad * 2, stripeH)

  // 3. Encabezado Corporativo Grupo Minero Bacís
  const headerY = cardY + inPad + stripeH
  const headerH = 20.5 * sy
  doc.setFillColor(23, 37, 84)
  doc.rect(cardX + inPad, headerY, cardW - inPad * 2, headerH, 'F')

  // Línea divisoria dorada bajo el header
  doc.setFillColor(245, 158, 11)
  doc.rect(cardX + inPad, headerY + headerH - 0.85 * sy, cardW - inPad * 2, 0.85 * sy, 'F')

  // Ranura porta-gafete arriba centrada
  const slotW = 10 * s
  const slotH = 1.7 * sy
  doc.setFillColor(11, 17, 32)
  doc.setDrawColor(100, 116, 139)
  doc.setLineWidth(0.2 * f)
  doc.roundedRect(cardX + (cardW - slotW) / 2, headerY + 1.0 * sy, slotW, slotH, 0.8 * f, 0.8 * f, 'FD')

  // Emblema GB a la izquierda
  const logoSize = 12 * f
  const logoCX = cardX + inPad + 2.6 * s + logoSize / 2
  const logoCY = headerY + headerH / 2 + 1.1 * sy
  drawBacisMiningLogo(doc, logoCX, logoCY, logoSize)

  // Zona segura de textos corporativos a la derecha del logo
  const textLeftX = logoCX + logoSize / 2 + 2.2 * s
  const textRightEdge = cardX + cardW - inPad - 2.2 * s
  const textColW = textRightEdge - textLeftX
  const textCenterX = textLeftX + textColW / 2

  doc.setFont('helvetica', 'bold')
  const t1 = fitSingleLine(doc, 'GRUPO MINERO BACÍS', textColW - 2 * s, 8.2 * f, 4.2 * f)
  doc.setFontSize(t1.fontSize)
  doc.setTextColor(255, 255, 255)
  doc.text(t1.text, textCenterX, headerY + 7.5 * sy, { align: 'center' })

  const t2 = fitSingleLine(doc, 'UNIDAD "EL HERRERO"', textColW - 2 * s, 6.2 * f, 3.8 * f)
  doc.setFontSize(t2.fontSize)
  doc.setTextColor(251, 191, 36)
  doc.text(t2.text, textCenterX, headerY + 11.7 * sy, { align: 'center' })

  // Cintillo ACREDITACIÓN CONTRATISTA estrictamente contenido en textColW
  const badgePillW = textColW - 1.6 * s
  const badgePillH = 3.8 * sy
  const badgePillX = textCenterX - badgePillW / 2
  const badgePillY = headerY + 13.7 * sy
  doc.setFillColor(245, 158, 11)
  doc.roundedRect(badgePillX, badgePillY, badgePillW, badgePillH, 0.8 * f, 0.8 * f, 'F')

  const tPill = fitSingleLine(doc, 'ACREDITACIÓN CONTRATISTA', badgePillW - 2 * s, 5.4 * f, 3.6 * f)
  doc.setFontSize(tPill.fontSize)
  doc.setTextColor(11, 17, 32)
  doc.text(tPill.text, textCenterX, badgePillY + badgePillH * 0.72, { align: 'center' })

  // 4. Sección Central Superior: Fotografía + Tarjetas de Sangre, NSS, Depto y Acceso
  const photoSectionY = headerY + headerH + 2.2 * sy
  const photoW = 24.5 * s
  const photoH = 29 * sy
  const photoX = cardInnerX

  doc.setFillColor(30, 41, 59)
  doc.setDrawColor(245, 158, 11)
  doc.setLineWidth(0.5 * f)
  doc.roundedRect(photoX, photoSectionY, photoW, photoH, 2.0 * f, 2.0 * f, 'FD')

  if (photoB64) {
    const fmt = photoB64.includes('png') ? 'PNG' : 'JPEG'
    try {
      doc.addImage(photoB64, fmt, photoX + 0.8 * s, photoSectionY + 0.8 * sy, photoW - 1.6 * s, photoH - 1.6 * sy)
    } catch {
      // Fallback silencioso a iniciales si la foto remota falla
    }
  } else {
    doc.setTextColor(245, 158, 11)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12 * f)
    const initials = data.nombre_completo
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
    doc.text(initials || 'GB', photoX + photoW / 2, photoSectionY + photoH / 2 + 1.8 * sy, { align: 'center' })
  }

  // Columna derecha junto a la foto
  const rightColX = photoX + photoW + 2.4 * s
  const rightColW = cardX + cardW - innerPadX - rightColX

  // Tarjeta 1: Tipo de Sangre + NSS
  const card1H = 9.4 * sy
  doc.setFillColor(23, 37, 84)
  doc.setDrawColor(59, 130, 246)
  doc.setLineWidth(0.25 * f)
  doc.roundedRect(rightColX, photoSectionY, rightColW, card1H, 1.4 * f, 1.4 * f, 'FD')

  const bloodW = Math.min(15 * s, rightColW * 0.36)
  const bloodX = rightColX + rightColW - bloodW - 1.1 * s
  doc.setFillColor(185, 28, 28)
  doc.roundedRect(bloodX, photoSectionY + 1.0 * sy, bloodW, card1H - 2.0 * sy, 1.0 * f, 1.0 * f, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  const bloodLbl = fitSingleLine(doc, 'SANGRE', bloodW - 2 * s, 4.4 * f, 3.2 * f)
  doc.setFontSize(bloodLbl.fontSize)
  doc.text(bloodLbl.text, bloodX + bloodW / 2, photoSectionY + 3.6 * sy, { align: 'center' })

  const bloodVal = fitSingleLine(doc, (data.tipo_sangre || 'N/E').toUpperCase(), bloodW - 2 * s, 6.4 * f, 3.6 * f)
  doc.setFontSize(bloodVal.fontSize)
  doc.text(bloodVal.text, bloodX + bloodW / 2, photoSectionY + 7.2 * sy, { align: 'center' })

  const nssMaxW = bloodX - (rightColX + 1.8 * s) - 1.2 * s
  doc.setTextColor(148, 163, 184)
  doc.setFontSize(4.6 * f)
  doc.text('IMSS / NSS:', rightColX + 1.8 * s, photoSectionY + 3.6 * sy)

  doc.setTextColor(255, 255, 255)
  const nssFit = fitSingleLine(doc, data.nss || 'SIN NSS', nssMaxW, 6.2 * f, 3.8 * f)
  doc.setFontSize(nssFit.fontSize)
  doc.text(nssFit.text, rightColX + 1.8 * s, photoSectionY + 7.2 * sy)

  // Tarjeta 2: Área / Departamento Autorizado
  const card2Y = photoSectionY + card1H + 1.5 * sy
  const card2H = 9.8 * sy
  doc.setFillColor(19, 30, 58)
  doc.setDrawColor(217, 119, 6)
  doc.setLineWidth(0.25 * f)
  doc.roundedRect(rightColX, card2Y, rightColW, card2H, 1.4 * f, 1.4 * f, 'FD')

  doc.setTextColor(251, 191, 36)
  const deptoHdr = fitSingleLine(doc, 'ÁREA / DEPTO AUTORIZADO:', rightColW - 3.6 * s, 4.6 * f, 3.4 * f)
  doc.setFontSize(deptoHdr.fontSize)
  doc.text(deptoHdr.text, rightColX + 1.8 * s, card2Y + 3.2 * sy)

  doc.setTextColor(255, 255, 255)
  const deptoClean = (data.departamento_autorizado || 'MINA / SERVICIOS').toUpperCase()
  const deptoFit = fitMultiLine(doc, deptoClean, rightColW - 3.6 * s, 2, 5.8 * f, 3.8 * f)
  doc.setFontSize(deptoFit.fontSize)
  deptoFit.lines.forEach((ln, idx) => {
    doc.text(ln, rightColX + 1.8 * s, card2Y + (6.1 + idx * 2.7) * sy)
  })

  // Tarjeta 3: Sello Seguridad Industrial con punto vectorial verde (sin Unicode roto)
  const card3Y = card2Y + card2H + 1.5 * sy
  const card3H = 6.8 * sy
  doc.setFillColor(6, 78, 59)
  doc.setDrawColor(16, 185, 129)
  doc.roundedRect(rightColX, card3Y, rightColW, card3H, 1.3 * f, 1.3 * f, 'FD')

  doc.setFillColor(52, 211, 153)
  doc.circle(rightColX + 2.8 * s, card3Y + card3H / 2, 0.85 * f, 'F')

  doc.setTextColor(167, 243, 208)
  const sealFit = fitSingleLine(doc, 'INDUCCIÓN Y ACCESO VALIDADO', rightColW - 6.0 * s, 5.1 * f, 3.5 * f)
  doc.setFontSize(sealFit.fontSize)
  doc.text(sealFit.text, rightColX + 4.4 * s, card3Y + card3H * 0.63)

  // 5. Bloque Nombre del Trabajador, Puesto y Empresa Contratista
  const infoY = photoSectionY + photoH + 2.2 * sy
  const infoBoxH = 22.5 * sy
  doc.setFillColor(17, 27, 51)
  doc.setDrawColor(30, 58, 138)
  doc.setLineWidth(0.3 * f)
  doc.roundedRect(cardInnerX, infoY, innerW, infoBoxH, 2.0 * f, 2.0 * f, 'FD')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  const nameFit = fitMultiLine(doc, (data.nombre_completo || '').toUpperCase(), innerW - 5 * s, 2, 8.2 * f, 4.4 * f)
  doc.setFontSize(nameFit.fontSize)
  doc.text(nameFit.lines[0] || '', cardX + cardW / 2, infoY + 4.9 * sy, { align: 'center' })
  if (nameFit.lines[1]) {
    doc.text(nameFit.lines[1], cardX + cardW / 2, infoY + 8.5 * sy, { align: 'center' })
  }

  // Píldora dorada del Puesto
  const puestoW = innerW - 6 * s
  const puestoX = cardX + (cardW - puestoW) / 2
  const puestoY = infoY + (nameFit.lines.length > 1 ? 10.1 * sy : 7.8 * sy)
  const puestoH = 4.5 * sy
  doc.setFillColor(245, 158, 11)
  doc.roundedRect(puestoX, puestoY, puestoW, puestoH, 0.9 * f, 0.9 * f, 'F')

  doc.setTextColor(11, 17, 32)
  const puestoFit = fitSingleLine(
    doc,
    (data.puesto || 'CONTRATISTA ESPECIALIZADO').toUpperCase(),
    puestoW - 4 * s,
    5.9 * f,
    3.8 * f
  )
  doc.setFontSize(puestoFit.fontSize)
  doc.text(puestoFit.text, cardX + cardW / 2, puestoY + puestoH * 0.72, { align: 'center' })

  // Empresa Contratista
  doc.setTextColor(147, 197, 253)
  const empFit = fitSingleLine(
    doc,
    (data.empresa || 'EMPRESA CONTRATISTA').toUpperCase(),
    innerW - 5 * s,
    6.2 * f,
    4.0 * f
  )
  doc.setFontSize(empFit.fontSize)
  doc.text(empFit.text, cardX + cardW / 2, infoY + infoBoxH - 2.2 * sy, { align: 'center' })

  // 6. Barra de Vigencia Autorizada
  const vigY = infoY + infoBoxH + 1.7 * sy
  const vigH = 6.5 * sy
  doc.setFillColor(30, 58, 138)
  doc.setDrawColor(245, 158, 11)
  doc.setLineWidth(0.32 * f)
  doc.roundedRect(cardInnerX, vigY, innerW, vigH, 1.4 * f, 1.4 * f, 'FD')

  doc.setTextColor(254, 240, 138)
  doc.setFont('helvetica', 'bold')
  const vigFit = fitSingleLine(
    doc,
    `VIGENCIA: ${formatShortDate(data.vigencia_desde)}  AL  ${formatShortDate(data.vigencia_hasta)}`,
    innerW - 5 * s,
    6.0 * f,
    3.8 * f
  )
  doc.setFontSize(vigFit.fontSize)
  doc.text(vigFit.text, cardX + cardW / 2, vigY + vigH * 0.67, { align: 'center' })

  // 7. Zona Exclusiva del Código QR y Barra Inferior calculadas dinámicamente
  const cardBottomSafe = cardY + cardH - inPad - 1.5 * sy
  const footerPillH = 5.2 * sy
  const qrTopY = vigY + vigH + 1.8 * sy
  const gapBetweenQrAndFooter = 1.4 * sy
  const availableHeightForQr = Math.max(8, cardBottomSafe - qrTopY - footerPillH - gapBetweenQrAndFooter)
  const qrBoxSize = Math.min(26.5 * Math.min(s, sy), availableHeightForQr, cardW - 18 * s)
  const qrBoxX = cardX + (cardW - qrBoxSize) / 2

  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(245, 158, 11)
  doc.setLineWidth(0.45 * f)
  doc.roundedRect(qrBoxX, qrTopY, qrBoxSize, qrBoxSize, 2.0 * f, 2.0 * f, 'FD')

  const qrInnerPad = 1.3 * Math.min(s, sy)
  doc.addImage(
    qrDataUrl,
    'PNG',
    qrBoxX + qrInnerPad,
    qrTopY + qrInnerPad,
    qrBoxSize - qrInnerPad * 2,
    qrBoxSize - qrInnerPad * 2
  )

  // 8. Barra Inferior Independiente para el Código QR en Texto
  const footerPillY = qrTopY + qrBoxSize + gapBetweenQrAndFooter
  const footerPillW = Math.min(innerW, cardW - 12 * s)
  const footerPillX = cardX + (cardW - footerPillW) / 2

  doc.setFillColor(245, 158, 11)
  doc.roundedRect(footerPillX, footerPillY, footerPillW, footerPillH, 1.3 * f, 1.3 * f, 'F')

  doc.setTextColor(11, 17, 32)
  doc.setFont('courier', 'bold')
  const qrTxtFit = fitSingleLine(doc, `QR: ${data.codigo_qr}`, footerPillW - 4 * s, 7.2 * f, 4.2 * f)
  doc.setFontSize(qrTxtFit.fontSize)
  doc.text(qrTxtFit.text, cardX + cardW / 2, footerPillY + footerPillH * 0.72, { align: 'center' })
}

/**
 * Renderiza el REVERSO de la credencial sin desbordes ni símbolos Unicode rotos
 */
function renderBadgeBack(
  doc: jsPDF,
  data: ContractorBadgeData,
  backX: number,
  cardY: number,
  cardW: number,
  cardH: number
) {
  const s = cardW / 90
  const sy = cardH / 135
  const f = Math.min(s, sy)

  // Fondo claro industrial con marco Azul/Dorado Bacís
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(23, 37, 84)
  doc.setLineWidth(0.5 * f)
  doc.roundedRect(backX, cardY, cardW, cardH, 3.0 * f, 3.0 * f, 'FD')

  const inPad = 1.6 * f
  doc.setDrawColor(217, 119, 6)
  doc.setLineWidth(0.25 * f)
  doc.roundedRect(backX + inPad, cardY + inPad, cardW - inPad * 2, cardH - inPad * 2, 2.2 * f, 2.2 * f, 'D')

  // Encabezado Reverso
  const headerH = 15.5 * sy
  doc.setFillColor(15, 23, 42)
  doc.rect(backX + inPad, cardY + inPad, cardW - inPad * 2, headerH, 'F')

  doc.setFillColor(245, 158, 11)
  doc.rect(backX + inPad, cardY + inPad + headerH - 0.85 * sy, cardW - inPad * 2, 0.85 * sy, 'F')

  const miniLogoSize = 9.2 * f
  const miniLogoCX = backX + inPad + 2.4 * s + miniLogoSize / 2
  drawBacisMiningLogo(doc, miniLogoCX, cardY + inPad + headerH / 2, miniLogoSize)

  const hdrTextLeft = miniLogoCX + miniLogoSize / 2 + 2.2 * s
  const hdrTextRight = backX + cardW - inPad - 2.0 * s
  const hdrTextW = hdrTextRight - hdrTextLeft
  const hdrTextCenter = hdrTextLeft + hdrTextW / 2

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  const backH1 = fitSingleLine(doc, 'CONTROL DE CASETA Y SEGURIDAD', hdrTextW - 2 * s, 6.8 * f, 3.8 * f)
  doc.setFontSize(backH1.fontSize)
  doc.text(backH1.text, hdrTextCenter, cardY + inPad + 6.4 * sy, { align: 'center' })

  doc.setTextColor(251, 191, 36)
  const backH2 = fitSingleLine(doc, 'GRUPO MINERO BACÍS - UNIDAD EL HERRERO', hdrTextW - 2 * s, 5.4 * f, 3.5 * f)
  doc.setFontSize(backH2.fontSize)
  doc.text(backH2.text, hdrTextCenter, cardY + inPad + 11.2 * sy, { align: 'center' })

  // Zona Segura para cajas del reverso
  const boxX = backX + inPad + 2.2 * s
  const boxW = cardW - (inPad + 2.2 * s) * 2
  let by = cardY + inPad + headerH + 2.8 * sy

  // Bloque de Datos de Respaldo y Emergencia
  const dataBoxH = 33 * sy
  doc.setFillColor(241, 245, 249)
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.25 * f)
  doc.roundedRect(boxX, by, boxW, dataBoxH, 1.8 * f, 1.8 * f, 'FD')

  doc.setFont('helvetica', 'bold')
  const infoRows: { label: string; red?: boolean }[] = [
    { label: `FOLIO ACCESO: ${data.folio_solicitud || 'N/A'}` },
    { label: `RFC EMPRESA: ${data.rfc_empresa || 'N/A'}` },
    { label: `CURP TITULAR: ${data.curp || 'N/A'}` },
    { label: `ZONA TRABAJO: ${data.area_trabajo || data.departamento_autorizado || 'GENERAL'}` },
    { label: `EMERGENCIA: ${data.contacto_emergencia || 'Seguridad Mina'}`, red: true },
  ]

  infoRows.forEach((row, idx) => {
    const rowY = by + (5.2 + idx * 5.5) * sy
    doc.setTextColor(row.red ? 185 : 15, row.red ? 28 : 23, row.red ? 28 : 42)
    const rowFit = fitSingleLine(doc, row.label, boxW - 5 * s, 6.0 * f, 3.8 * f)
    doc.setFontSize(rowFit.fontSize)
    doc.text(rowFit.text, boxX + 2.5 * s, rowY)
  })

  // Checklist Multi-Factor (con círculos vectoriales verdes en lugar de ✓)
  by += dataBoxH + 2.5 * sy
  const checkH = 28 * sy
  doc.setFillColor(254, 243, 199)
  doc.setDrawColor(245, 158, 11)
  doc.roundedRect(boxX, by, boxW, checkH, 1.8 * f, 1.8 * f, 'FD')

  doc.setTextColor(146, 64, 14)
  doc.setFont('helvetica', 'bold')
  const chkTitle = fitSingleLine(doc, 'SELLOS DE VALIDACIÓN MULTI-FACTOR', boxW - 5 * s, 6.0 * f, 3.8 * f)
  doc.setFontSize(chkTitle.fontSize)
  doc.text(chkTitle.text, boxX + 2.5 * s, by + 5.0 * sy)

  const checkItems = [
    '1. Opinión SAT / Alta IMSS / NSS Verificados',
    '2. Autorización del Departamento Solicitante',
    '3. Inducción de Seguridad Industrial Aprobada',
    '4. Control de Campamentos y Recursos Humanos',
  ]
  doc.setFont('helvetica', 'normal')
  checkItems.forEach((txt, idx) => {
    const cyRow = by + (9.8 + idx * 4.8) * sy
    doc.setFillColor(16, 185, 129)
    doc.circle(boxX + 3.4 * s, cyRow - 0.8 * f, 0.75 * f, 'F')
    doc.setTextColor(30, 41, 59)
    const itemFit = fitSingleLine(doc, txt, boxW - 8 * s, 5.6 * f, 3.6 * f)
    doc.setFontSize(itemFit.fontSize)
    doc.text(itemFit.text, boxX + 5.2 * s, cyRow)
  })

  // Protocolo de Caseta y Devolución Obligatoria
  by += checkH + 2.5 * sy
  const ruleH = 25 * sy
  doc.setFillColor(23, 37, 84)
  doc.roundedRect(boxX, by, boxW, ruleH, 1.8 * f, 1.8 * f, 'F')

  doc.setTextColor(251, 191, 36)
  doc.setFont('helvetica', 'bold')
  const ruleTitle = fitSingleLine(doc, 'REGLAMENTO DE PORTACIÓN Y DEVOLUCIÓN:', boxW - 5 * s, 5.6 * f, 3.6 * f)
  doc.setFontSize(ruleTitle.fontSize)
  doc.text(ruleTitle.text, boxX + 2.5 * s, by + 4.8 * sy)

  doc.setTextColor(241, 245, 249)
  doc.setFont('helvetica', 'normal')
  const noticeText =
    'Este gafete es propiedad de Grupo Minero Bacís. Su portación visible y el uso de EPP completo son obligatorios en todo momento. Al concluir sus trabajos o salir de la unidad minera, DEBERÁ ENTREGAR ESTA CREDENCIAL en Caseta de Vigilancia.'
  const noticeFit = fitMultiLine(doc, noticeText, boxW - 5 * s, 5, 5.0 * f, 3.5 * f)
  doc.setFontSize(noticeFit.fontSize)
  const lineH = noticeFit.fontSize * 0.42
  noticeFit.lines.forEach((ln, idx) => {
    doc.text(ln, boxX + 2.5 * s, by + 8.6 * sy + idx * lineH)
  })

  // Línea de Firma y Sello
  const signY = cardY + cardH - inPad - 8.2 * sy
  doc.setDrawColor(100, 116, 139)
  doc.setLineWidth(0.3 * f)
  doc.line(backX + 12 * s, signY, backX + cardW - 12 * s, signY)

  doc.setTextColor(71, 85, 105)
  doc.setFont('helvetica', 'bold')
  const signFit = fitSingleLine(doc, 'FIRMA Y SELLO DE SEGURIDAD / CASETA', cardW - 14 * s, 5.2 * f, 3.5 * f)
  doc.setFontSize(signFit.fontSize)
  doc.text(signFit.text, backX + cardW / 2, signY + 3.4 * sy, { align: 'center' })

  // Franja inferior de seguridad
  drawSafetyStripeBar(doc, backX + inPad, cardY + cardH - inPad - 2.2 * sy, cardW - inPad * 2, 2.2 * sy)
}

export async function generateContractorCredentialPDF(data: ContractorBadgeData): Promise<void> {
  const formatId: BadgeSizeFormat = data.size_format || 'gafete_medio'
  const sizeSpec = BADGE_SIZE_OPTIONS.find((o) => o.id === formatId) || BADGE_SIZE_OPTIONS[2]

  const qrDataUrl = await QRCode.toDataURL(data.codigo_qr, {
    width: 480,
    margin: 1,
    color: { dark: '#000000', light: '#FFFFFF' },
  })
  const photoB64 = data.foto_url ? await fetchImageAsBase64(data.foto_url) : null

  const cardW = sizeSpec.widthMm
  const cardH = sizeSpec.heightMm

  // MODO 1: Impresora directa de tarjetas PVC CR80 (2 páginas del tamaño exacto 54 x 85.6 mm)
  if (sizeSpec.directCardPage) {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [cardW, cardH],
    })

    await renderBadgeFront(doc, data, 0, 0, cardW, cardH, qrDataUrl, photoB64)
    doc.addPage([cardW, cardH], 'portrait')
    renderBadgeBack(doc, data, 0, 0, cardW, cardH)

    doc.save(`Credencial_Bacis_PVC_${data.codigo_qr}.pdf`)
    return
  }

  // MODO 2: Impresión en Hoja Carta con Frente y Reverso lado a lado listos para recortar y enmicar
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageW = 215.9

  // Encabezado de la hoja de impresión
  doc.setFillColor(15, 23, 42)
  doc.roundedRect(14, 10, pageW - 28, 16, 2.5, 2.5, 'F')
  doc.setTextColor(251, 191, 36)
  doc.setFont('helvetica', 'bold')
  const hdr1 = fitSingleLine(
    doc,
    'GRUPO MINERO BACÍS S.A. DE C.V. — EMISIÓN OFICIAL DE CREDENCIAL CONTRATISTA',
    pageW - 38,
    9.5,
    6.5
  )
  doc.setFontSize(hdr1.fontSize)
  doc.text(hdr1.text, 20, 16.5)

  doc.setTextColor(203, 213, 225)
  doc.setFont('helvetica', 'normal')
  const hdr2 = fitSingleLine(
    doc,
    `Formato seleccionado: ${sizeSpec.label} (${sizeSpec.dimensions})  •  Recorta por la línea punteada y dobla al centro para enmicar.`,
    pageW - 38,
    7.5,
    5.5
  )
  doc.setFontSize(hdr2.fontSize)
  doc.text(hdr2.text, 20, 22)

  // Posicionar Frente y Reverso centrados en la hoja
  const gap = formatId === 'cr80_enmicar' ? 2 : 6
  const totalW = cardW * 2 + gap
  const startX = (pageW - totalW) / 2
  const startY = 36
  const backX = startX + cardW + gap

  // Guía exterior de corte punteada
  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.25)
  doc.setLineDashPattern([2, 1.5], 0)
  doc.rect(startX - 2, startY - 2, totalW + 4, cardH + 4)

  // Línea central de doblez
  const foldX = startX + cardW + gap / 2
  doc.line(foldX, startY - 5, foldX, startY + cardH + 5)
  doc.setLineDashPattern([], 0)

  doc.setTextColor(100, 116, 139)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.text('--- GUIA DE RECORTE EXTERIOR ---', startX, startY - 3.5)
  doc.text('LINEA DE DOBLEZ', foldX, startY - 6, { align: 'center' })
  doc.text('FRENTE (ANVERSO)', startX + cardW / 2, startY + cardH + 6, { align: 'center' })
  doc.text('VUELTA (REVERSO)', backX + cardW / 2, startY + cardH + 6, { align: 'center' })

  await renderBadgeFront(doc, data, startX, startY, cardW, cardH, qrDataUrl, photoB64)
  renderBadgeBack(doc, data, backX, startY, cardW, cardH)

  // Pie de hoja con ficha de control RH ajustado al ancho
  const footY = startY + cardH + 15
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, footY, pageW - 28, 20, 2, 2, 'FD')

  doc.setTextColor(51, 65, 85)
  doc.setFont('helvetica', 'bold')
  const footLine1 = fitSingleLine(
    doc,
    `COMPROBANTE DE EMISION: ${data.nombre_completo.toUpperCase()}  |  EMPRESA: ${data.empresa.toUpperCase()}  |  QR: ${data.codigo_qr}`,
    pageW - 38,
    7.5,
    5.2
  )
  doc.setFontSize(footLine1.fontSize)
  doc.text(footLine1.text, 20, footY + 7.2)

  doc.setFont('helvetica', 'normal')
  const footLine2 = fitSingleLine(
    doc,
    `Medida física real: ${cardW} mm de ancho x ${cardH} mm de alto. Al imprimir selecciona escala "Tamaño real (100%)" sin ajustar a página.`,
    pageW - 38,
    7.0,
    5.0
  )
  doc.setFontSize(footLine2.fontSize)
  doc.text(footLine2.text, 20, footY + 13.8)

  doc.save(`Credencial_Bacis_${formatId}_${data.codigo_qr}.pdf`)
}
