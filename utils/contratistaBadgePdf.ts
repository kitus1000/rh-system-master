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

  // Base exterior tipo portal de mina (acero oscuro / borde plata)
  doc.setFillColor(15, 23, 42)
  doc.setDrawColor(217, 119, 6) // dorado minero
  doc.setLineWidth(0.35 * (size / 14))
  doc.roundedRect(left, top, size, size, size * 0.22, size * 0.22, 'FD')

  // Arco interior Azul Cobalto Bacís
  const pad = size * 0.1
  doc.setFillColor(29, 78, 216) // Royal Blue Bacís (#1D4ED8)
  doc.setDrawColor(148, 163, 184) // Acero (#94A3B8)
  doc.setLineWidth(0.25 * (size / 14))
  doc.roundedRect(left + pad, top + pad, size - pad * 2, size - pad * 2, size * 0.18, size * 0.18, 'FD')

  // Solera / base del túnel en la parte inferior del emblema
  doc.setFillColor(15, 23, 42)
  doc.rect(left + pad * 0.7, top + size - pad * 1.65, size - pad * 1.4, pad * 0.85, 'F')

  // Pico y Pala cruzados en la parte superior del arco (Dorado)
  doc.setDrawColor(245, 158, 11) // Amber gold
  doc.setLineWidth(0.45 * (size / 14))
  const toolY1 = cy - r * 0.55
  const toolY2 = cy - r * 0.05
  doc.line(cx - r * 0.35, toolY2, cx + r * 0.35, toolY1)
  doc.line(cx - r * 0.35, toolY1, cx + r * 0.35, toolY2)

  // Cabeza de pico y pala (pequeños trazos transversales)
  doc.setLineWidth(0.35 * (size / 14))
  doc.line(cx - r * 0.42, toolY1 + r * 0.08, cx - r * 0.24, toolY1 - r * 0.08)
  doc.line(cx + r * 0.24, toolY1 - r * 0.08, cx + r * 0.42, toolY1 + r * 0.08)

  // Letras emblemáticas "GB" en la parte inferior del túnel
  doc.setFont('times', 'bold')
  doc.setFontSize(Math.max(5.5, size * 1.15))
  // Sombra dorada
  doc.setTextColor(245, 158, 11)
  doc.text('GB', cx + 0.18, cy + r * 0.52 + 0.15, { align: 'center' })
  // Texto blanco/plata principal
  doc.setTextColor(248, 250, 252)
  doc.text('GB', cx, cy + r * 0.52, { align: 'center' })
}

/**
 * Dibuja franja minera de seguridad (chevrons amarillo/ámbar y negro/azul oscuro)
 */
function drawSafetyStripeBar(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(245, 158, 11) // Amber 500
  doc.rect(x, y, w, h, 'F')

  const stripeCount = 12
  const segW = w / stripeCount
  doc.setFillColor(11, 17, 32) // Obsidian Navy
  for (let i = 0; i < stripeCount; i += 2) {
    doc.rect(x + i * segW, y, segW * 0.55, h, 'F')
  }
}

/**
 * Renderiza el FRENTE de la credencial adaptándose proporcionalmente a cualquier tamaño (cardW x cardH)
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
  const s = cardW / 90 // Factor de escala horizontal respecto al diseño base de 90mm
  const sy = cardH / 135 // Factor de escala vertical respecto a 135mm
  const f = Math.min(s, sy) // Factor tipográfico proporcional

  // 1. Fondo Principal Obsidiana Minera
  doc.setFillColor(11, 17, 32) // #0B1120
  doc.setDrawColor(217, 119, 6) // Borde Dorado Bacís
  doc.setLineWidth(0.5 * f)
  doc.roundedRect(cardX, cardY, cardW, cardH, 3.2 * f, 3.2 * f, 'FD')

  // Marco estructural interior tipo acero/azul real
  const inPad = 1.6 * f
  doc.setDrawColor(30, 58, 138) // #1E3A8A
  doc.setLineWidth(0.3 * f)
  doc.roundedRect(cardX + inPad, cardY + inPad, cardW - inPad * 2, cardH - inPad * 2, 2.2 * f, 2.2 * f, 'D')

  // 2. Franja Superior de Seguridad Minera (0% a 2.4%)
  const stripeH = 2.8 * sy
  drawSafetyStripeBar(doc, cardX + inPad, cardY + inPad, cardW - inPad * 2, stripeH)

  // 3. Encabezado Corporativo Grupo Minero Bacís (2.4% a 17.5%)
  const headerY = cardY + inPad + stripeH
  const headerH = 19.5 * sy
  doc.setFillColor(23, 37, 84) // Azul Cobalto Oscuro Bacís (#172554)
  doc.rect(cardX + inPad, headerY, cardW - inPad * 2, headerH, 'F')

  // Línea divisoria dorada bajo el header
  doc.setFillColor(245, 158, 11)
  doc.rect(cardX + inPad, headerY + headerH - 0.9 * sy, cardW - inPad * 2, 0.9 * sy, 'F')

  // Marca de perforación (slot para porta-gafete) arriba al centro
  const slotW = 11 * s
  const slotH = 2.0 * sy
  doc.setFillColor(11, 17, 32)
  doc.setDrawColor(100, 116, 139)
  doc.setLineWidth(0.2 * f)
  doc.roundedRect(cardX + (cardW - slotW) / 2, headerY + 1.2 * sy, slotW, slotH, 0.9 * f, 0.9 * f, 'FD')

  // Emblema GB a la izquierda del encabezado
  const logoSize = 13.5 * f
  const logoCX = cardX + inPad + 3.2 * s + logoSize / 2
  const logoCY = headerY + headerH / 2 + 0.8 * sy
  drawBacisMiningLogo(doc, logoCX, logoCY, logoSize)

  // Textos Corporativos Bacís a la derecha del logo
  const textCenterX = cardX + inPad + logoSize + 4.5 * s + (cardW - inPad * 2 - logoSize - 5.5 * s) / 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.8 * f)
  doc.setTextColor(255, 255, 255)
  doc.text('GRUPO MINERO BACÍS', textCenterX, headerY + 7.2 * sy, { align: 'center' })

  doc.setFontSize(6.6 * f)
  doc.setTextColor(251, 191, 36) // Dorado brillante
  doc.text('UNIDAD "EL HERRERO"', textCenterX, headerY + 11.8 * sy, { align: 'center' })

  // Cintillo PASE CONTRATISTA
  const badgePillW = cardW - inPad * 2 - logoSize - 8 * s
  const badgePillH = 3.8 * sy
  const badgePillX = textCenterX - badgePillW / 2
  const badgePillY = headerY + 13.5 * sy
  doc.setFillColor(245, 158, 11)
  doc.roundedRect(badgePillX, badgePillY, badgePillW, badgePillH, 0.9 * f, 0.9 * f, 'F')
  doc.setTextColor(11, 17, 32)
  doc.setFontSize(5.7 * f)
  doc.text('ACREDITACIÓN CONTRATISTA', textCenterX, badgePillY + 2.75 * sy, { align: 'center' })

  // 4. Sección Central Superior: Fotografía + Indicadores Médicos/Seguridad (19% a 42.5%)
  const photoSectionY = headerY + headerH + 2.5 * sy
  const photoW = 26 * s
  const photoH = 29 * sy
  const photoX = cardX + 5.5 * s

  // Marco exterior dorado de la fotografía
  doc.setFillColor(30, 41, 59)
  doc.setDrawColor(245, 158, 11)
  doc.setLineWidth(0.55 * f)
  doc.roundedRect(photoX, photoSectionY, photoW, photoH, 2.2 * f, 2.2 * f, 'FD')

  if (photoB64) {
    const fmt = photoB64.includes('png') ? 'PNG' : 'JPEG'
    try {
      doc.addImage(photoB64, fmt, photoX + 0.8 * s, photoSectionY + 0.8 * sy, photoW - 1.6 * s, photoH - 1.6 * sy)
    } catch {
      // Fallback initials if image fails
    }
  } else {
    doc.setTextColor(245, 158, 11)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13 * f)
    const initials = data.nombre_completo
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
    doc.text(initials || 'GB', photoX + photoW / 2, photoSectionY + photoH / 2 + 1.8 * sy, { align: 'center' })
  }

  // Columna derecha junto a la foto: Tarjetas de Sangre, NSS, Folio y Estatus
  const rightColX = photoX + photoW + 3.5 * s
  const rightColW = cardX + cardW - inPad - 3.5 * s - rightColX

  // Tarjeta 1: Tipo de Sangre + NSS
  const card1H = 9.2 * sy
  doc.setFillColor(23, 37, 84) // Azul Bacís
  doc.setDrawColor(59, 130, 246)
  doc.setLineWidth(0.25 * f)
  doc.roundedRect(rightColX, photoSectionY, rightColW, card1H, 1.5 * f, 1.5 * f, 'FD')

  // Pill Roja Tipo de Sangre
  const bloodW = 16.5 * s
  doc.setFillColor(185, 28, 28) // Rojo médico
  doc.roundedRect(rightColX + rightColW - bloodW - 1.2 * s, photoSectionY + 1.1 * sy, bloodW, card1H - 2.2 * sy, 1.1 * f, 1.1 * f, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(4.6 * f)
  doc.text('SANGRE', rightColX + rightColW - bloodW / 2 - 1.2 * s, photoSectionY + 3.6 * sy, { align: 'center' })
  doc.setFontSize(6.8 * f)
  doc.text((data.tipo_sangre || 'N/E').toUpperCase(), rightColX + rightColW - bloodW / 2 - 1.2 * s, photoSectionY + 7.2 * sy, { align: 'center' })

  // NSS a la izquierda de Sangre
  doc.setTextColor(148, 163, 184)
  doc.setFontSize(4.8 * f)
  doc.text('IMSS / NSS:', rightColX + 2.2 * s, photoSectionY + 3.6 * sy)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(6.6 * f)
  doc.text((data.nss || 'SIN NSS').slice(0, 13), rightColX + 2.2 * s, photoSectionY + 7.3 * sy)

  // Tarjeta 2: Área / Departamento Autorizado
  const card2Y = photoSectionY + card1H + 1.6 * sy
  const card2H = 9.5 * sy
  doc.setFillColor(19, 30, 58)
  doc.setDrawColor(217, 119, 6)
  doc.roundedRect(rightColX, card2Y, rightColW, card2H, 1.5 * f, 1.5 * f, 'FD')
  doc.setTextColor(251, 191, 36)
  doc.setFontSize(4.7 * f)
  doc.text('ÁREA / DEPTO AUTORIZADO:', rightColX + 2.2 * s, card2Y + 3.4 * sy)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(6.2 * f)
  const deptoClean = (data.departamento_autorizado || 'MINA / SERVICIOS').toUpperCase()
  const deptoLines = doc.splitTextToSize(deptoClean, rightColW - 4 * s)
  doc.text(deptoLines[0] || 'GENERAL', rightColX + 2.2 * s, card2Y + 7.3 * sy)

  // Tarjeta 3: Sello Seguridad Industrial / Vigencia
  const card3Y = card2Y + card2H + 1.6 * sy
  const card3H = 7.1 * sy
  doc.setFillColor(6, 78, 59) // Verde Esmeralda Oscuro
  doc.setDrawColor(16, 185, 129)
  doc.roundedRect(rightColX, card3Y, rightColW, card3H, 1.4 * f, 1.4 * f, 'FD')
  doc.setTextColor(167, 243, 208)
  doc.setFontSize(5.4 * f)
  doc.text('✓ INDUCCIÓN Y ACCESO VALIDADO', rightColX + rightColW / 2, card3Y + 4.6 * sy, { align: 'center' })

  // 5. Bloque Nombre del Trabajador, Puesto y Empresa Contratista (44% a 61.5%)
  const infoY = photoSectionY + photoH + 2.2 * sy
  const infoBoxH = 22.5 * sy
  doc.setFillColor(17, 27, 51)
  doc.setDrawColor(30, 58, 138)
  doc.setLineWidth(0.3 * f)
  doc.roundedRect(cardX + 4 * s, infoY, cardW - 8 * s, infoBoxH, 2 * f, 2 * f, 'FD')

  // Nombre del trabajador
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.6 * f)
  const nameLines = doc.splitTextToSize(data.nombre_completo.toUpperCase(), cardW - 12 * s)
  doc.text(nameLines[0] || '', cardX + cardW / 2, infoY + 5.2 * sy, { align: 'center' })
  if (nameLines[1]) {
    doc.setFontSize(7.6 * f)
    doc.text(nameLines[1], cardX + cardW / 2, infoY + 9.2 * sy, { align: 'center' })
  }

  // Cinta dorada del Puesto
  const puestoY = infoY + (nameLines[1] ? 10.6 * sy : 7.8 * sy)
  const puestoH = 4.4 * sy
  doc.setFillColor(245, 158, 11)
  doc.roundedRect(cardX + 10 * s, puestoY, cardW - 20 * s, puestoH, 1 * f, 1 * f, 'F')
  doc.setTextColor(11, 17, 32)
  doc.setFontSize(6.2 * f)
  doc.text((data.puesto || 'CONTRATISTA ESPECIALIZADO').toUpperCase().slice(0, 34), cardX + cardW / 2, puestoY + 3.1 * sy, { align: 'center' })

  // Empresa Contratista
  doc.setTextColor(147, 197, 253) // Azul claro corporativo
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.8 * f)
  const empClean = (data.empresa || 'EMPRESA CONTRATISTA').toUpperCase()
  const empLines = doc.splitTextToSize(empClean, cardW - 12 * s)
  doc.text(empLines[0] || '', cardX + cardW / 2, infoY + infoBoxH - 2.2 * sy, { align: 'center' })

  // 6. Barra de Vigencia Autorizada (62.5% a 68.5%)
  const vigY = infoY + infoBoxH + 1.6 * sy
  const vigH = 6.8 * sy
  doc.setFillColor(30, 58, 138) // Azul Real Bacís
  doc.setDrawColor(245, 158, 11)
  doc.setLineWidth(0.35 * f)
  doc.roundedRect(cardX + 4 * s, vigY, cardW - 8 * s, vigH, 1.5 * f, 1.5 * f, 'FD')
  doc.setTextColor(254, 240, 138)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.3 * f)
  doc.text(
    `VIGENCIA: ${formatShortDate(data.vigencia_desde)}  AL  ${formatShortDate(data.vigencia_hasta)}`,
    cardX + cardW / 2,
    vigY + 4.5 * sy,
    { align: 'center' }
  )

  // 7. Zona Exclusiva del Código QR (70% a 90.5%) — 100% libre de texto encimado
  const qrTopY = vigY + vigH + 2.0 * sy
  const qrBoxSize = 26.5 * Math.min(s, sy)
  const qrBoxX = cardX + (cardW - qrBoxSize) / 2

  // Contenedor blanco puro con margen limpio para lectura instantánea del escáner
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(245, 158, 11)
  doc.setLineWidth(0.45 * f)
  doc.roundedRect(qrBoxX, qrTopY, qrBoxSize, qrBoxSize, 2.2 * f, 2.2 * f, 'FD')

  const qrInnerPad = 1.4 * Math.min(s, sy)
  doc.addImage(
    qrDataUrl,
    'PNG',
    qrBoxX + qrInnerPad,
    qrTopY + qrInnerPad,
    qrBoxSize - qrInnerPad * 2,
    qrBoxSize - qrInnerPad * 2
  )

  // 8. Barra Inferior Independiente para el Código QR en Texto (92% a 98%) — FUERA del QR
  const footerPillY = qrTopY + qrBoxSize + 1.5 * sy
  const footerPillH = 5.4 * sy
  const footerPillW = cardW - 14 * s
  const footerPillX = cardX + (cardW - footerPillW) / 2

  doc.setFillColor(245, 158, 11) // Fondo Dorado Minero
  doc.roundedRect(footerPillX, footerPillY, footerPillW, footerPillH, 1.4 * f, 1.4 * f, 'F')

  doc.setTextColor(11, 17, 32) // Letras negras/obsidiana de alto contraste sobre barra dorada
  doc.setFont('courier', 'bold')
  doc.setFontSize(7.5 * f)
  doc.text(`QR: ${data.codigo_qr}`, cardX + cardW / 2, footerPillY + 3.8 * sy, { align: 'center' })
}

/**
 * Renderiza el REVERSO de la credencial adaptándose proporcionalmente a cualquier tamaño (cardW x cardH)
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
  doc.roundedRect(backX, cardY, cardW, cardH, 3.2 * f, 3.2 * f, 'FD')

  const inPad = 1.6 * f
  doc.setDrawColor(217, 119, 6)
  doc.setLineWidth(0.25 * f)
  doc.roundedRect(backX + inPad, cardY + inPad, cardW - inPad * 2, cardH - inPad * 2, 2.2 * f, 2.2 * f, 'D')

  // Encabezado Reverso
  const headerH = 15.5 * sy
  doc.setFillColor(15, 23, 42)
  doc.rect(backX + inPad, cardY + inPad, cardW - inPad * 2, headerH, 'F')

  doc.setFillColor(245, 158, 11)
  doc.rect(backX + inPad, cardY + inPad + headerH - 0.9 * sy, cardW - inPad * 2, 0.9 * sy, 'F')

  // Emblema mini en el reverso
  drawBacisMiningLogo(doc, backX + inPad + 7 * s, cardY + inPad + headerH / 2, 9.5 * f)

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.2 * f)
  doc.text('CONTROL DE CASETA Y SEGURIDAD', backX + cardW / 2 + 3.5 * s, cardY + inPad + 6.5 * sy, { align: 'center' })
  doc.setTextColor(251, 191, 36)
  doc.setFontSize(5.8 * f)
  doc.text('GRUPO MINERO BACÍS • UNIDAD "EL HERRERO"', backX + cardW / 2 + 3.5 * s, cardY + inPad + 11.2 * sy, { align: 'center' })

  // Bloque de Datos de Respaldo y Emergencia
  let by = cardY + inPad + headerH + 3.5 * sy
  const boxX = backX + 4.5 * s
  const boxW = cardW - 9 * s
  const dataBoxH = 34 * sy

  doc.setFillColor(241, 245, 249)
  doc.setDrawColor(203, 213, 225)
  doc.roundedRect(boxX, by, boxW, dataBoxH, 2 * f, 2 * f, 'FD')

  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.3 * f)
  let rowY = by + 5 * sy
  const stepY = 5.4 * sy

  doc.text(`FOLIO DE ACCESO:  ${data.folio_solicitud}`, boxX + 3 * s, rowY)
  rowY += stepY
  doc.text(`RFC CONTRATISTA:  ${data.rfc_empresa || 'N/A'}`, boxX + 3 * s, rowY)
  rowY += stepY
  doc.text(`CURP TRABAJADOR:  ${data.curp || 'N/A'}`, boxX + 3 * s, rowY)
  rowY += stepY
  doc.text(`ZONA DE TRABAJO:  ${(data.area_trabajo || data.departamento_autorizado).slice(0, 30)}`, boxX + 3 * s, rowY)
  rowY += stepY
  doc.setTextColor(185, 28, 28)
  doc.text(`TEL. EMERGENCIA:  ${(data.contacto_emergencia || 'Reportar a Seguridad Mina').slice(0, 30)}`, boxX + 3 * s, rowY)

  // Checklist Multi-Factor
  by += dataBoxH + 3 * sy
  const checkH = 29 * sy
  doc.setFillColor(254, 243, 199) // Amber 100
  doc.setDrawColor(245, 158, 11)
  doc.roundedRect(boxX, by, boxW, checkH, 2 * f, 2 * f, 'FD')

  doc.setTextColor(146, 64, 14)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.4 * f)
  doc.text('SELLOS DE VALIDACIÓN MULTI-FACTOR', boxX + 3 * s, by + 5.2 * sy)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.9 * f)
  doc.setTextColor(30, 41, 59)
  doc.text('✓ 1. Opinión SAT / Alta IMSS / NSS Verificados', boxX + 3.5 * s, by + 10.5 * sy)
  doc.text('✓ 2. Autorización del Departamento Solicitante', boxX + 3.5 * s, by + 15.5 * sy)
  doc.text('✓ 3. Inducción de Seguridad Industrial Aprobada', boxX + 3.5 * s, by + 20.5 * sy)
  doc.text('✓ 4. Control de Campamentos y Recursos Humanos', boxX + 3.5 * s, by + 25.5 * sy)

  // Protocolo de Caseta y Devolución Obligatoria
  by += checkH + 3.2 * sy
  const ruleH = 23 * sy
  doc.setFillColor(23, 37, 84)
  doc.roundedRect(boxX, by, boxW, ruleH, 2 * f, 2 * f, 'F')

  doc.setTextColor(251, 191, 36)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.9 * f)
  doc.text('REGLAMENTO DE PORTACIÓN Y DEVOLUCIÓN:', boxX + 3 * s, by + 4.8 * sy)

  doc.setTextColor(241, 245, 249)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.4 * f)
  const notice = doc.splitTextToSize(
    'Este gafete es propiedad de Grupo Minero Bacís. Su portación visible y el uso de EPP completo son obligatorios en todo momento. Al concluir sus trabajos o salir de la unidad minera, DEBERÁ ENTREGAR ESTA CREDENCIAL en Caseta de Vigilancia para registrar su salida.',
    boxW - 6 * s
  )
  doc.text(notice, boxX + 3 * s, by + 9.2 * sy)

  // Línea de Firma y Sello
  const signY = cardY + cardH - 10 * sy
  doc.setDrawColor(100, 116, 139)
  doc.setLineWidth(0.3 * f)
  doc.line(backX + 14 * s, signY, backX + cardW - 14 * s, signY)

  doc.setTextColor(71, 85, 105)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5 * f)
  doc.text('FIRMA Y SELLO DE SEGURIDAD / CASETA', backX + cardW / 2, signY + 3.6 * sy, { align: 'center' })

  // Franja inferior de seguridad
  drawSafetyStripeBar(doc, backX + inPad, cardY + cardH - inPad - 2.2 * sy, cardW - inPad * 2, 2.2 * sy)
}

export async function generateContractorCredentialPDF(data: ContractorBadgeData): Promise<void> {
  const formatId: BadgeSizeFormat = data.size_format || 'gafete_medio'
  const sizeSpec = BADGE_SIZE_OPTIONS.find((o) => o.id === formatId) || BADGE_SIZE_OPTIONS[2]

  // Pre-cargar QR en alta definición y foto del trabajador
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

  // Encabezado de la hoja de impresión con instrucciones de recorte y enmicado
  doc.setFillColor(15, 23, 42)
  doc.roundedRect(14, 10, pageW - 28, 16, 2.5, 2.5, 'F')
  doc.setTextColor(251, 191, 36)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text('GRUPO MINERO BACÍS S.A. DE C.V. — EMISIÓN OFICIAL DE CREDENCIAL CONTRATISTA', 20, 16.5)
  doc.setTextColor(203, 213, 225)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text(
    `Formato seleccionado: ${sizeSpec.label} (${sizeSpec.dimensions})  •  Recorta por la línea punteada exterior y dobla al centro para enmicar.`,
    20,
    22
  )

  // Posicionar Frente y Reverso centrados en la hoja
  const gap = formatId === 'cr80_enmicar' ? 2 : 6 // En CR80 enmicar van casi pegados para doblar como libro
  const totalW = cardW * 2 + gap
  const startX = (pageW - totalW) / 2
  const startY = 36
  const backX = startX + cardW + gap

  // Guía exterior de corte punteada (✂)
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
  doc.text('✂ GUÍA DE RECORTE EXTERIOR', startX, startY - 3.5)
  doc.text('LÍNEA DE DOBLEZ', foldX, startY - 6, { align: 'center' })
  doc.text('FRENTE (ANVERSO)', startX + cardW / 2, startY + cardH + 6, { align: 'center' })
  doc.text('VUELTA (REVERSO)', backX + cardW / 2, startY + cardH + 6, { align: 'center' })

  // Renderizar Frente y Reverso
  await renderBadgeFront(doc, data, startX, startY, cardW, cardH, qrDataUrl, photoB64)
  renderBadgeBack(doc, data, backX, startY, cardW, cardH)

  // Pie de hoja con ficha de control RH
  const footY = startY + cardH + 15
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, footY, pageW - 28, 20, 2, 2, 'FD')
  doc.setTextColor(51, 65, 85)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text(
    `COMPROBANTE DE EMISIÓN: ${data.nombre_completo.toUpperCase()}  |  EMPRESA: ${data.empresa.toUpperCase()}  |  QR: ${data.codigo_qr}`,
    20,
    footY + 7
  )
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(
    `Medida física real: ${cardW} mm de ancho × ${cardH} mm de alto. Al imprimir desde tu navegador o Adobe Reader, selecciona escala "Tamaño real (100%)" sin ajustar a página.`,
    20,
    footY + 13.5
  )

  doc.save(`Credencial_Bacis_${formatId}_${data.codigo_qr}.pdf`)
}
