import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { buildLockerQrUrl, parseLockerObservaciones } from './lockerMeta'

export interface LockerPdfEmpleado {
  id_empleado?: string
  nombre: string
  apellido_paterno: string
  apellido_materno?: string
  numero_empleado: number | string
  departamento?: string
  puesto?: string
}

export interface LockerPdfCasillero {
  id_casillero: string
  id_modulo?: string
  codigo_casillero: string
  posicion_nivel: string
  numero_en_modulo?: number
  id_empleado?: string | null
  nombre_provisional?: string | null
  numero_empleado_provisional?: string | null
  estatus: 'Disponible' | 'Asignado' | 'En Reparacion' | 'Inservible' | string
  condicion_llave?: string
  numero_llave?: string | null
  descripcion_dano?: string | null
  observaciones?: string | null
  fecha_asignacion?: string | null
  empleados?: LockerPdfEmpleado | null
  modulo_bateria?: string
  modulo_area?: string
  tipo_modulo?: string
}

export interface LockerPdfModulo {
  id_modulo: string
  codigo_modulo: string
  area: string
  bateria: string
  tipo_modulo: '3_niveles' | '2_niveles' | string
  ubicacion_detalle?: string
  orden?: number
  lockers_casilleros?: LockerPdfCasillero[]
}

function fitSingleLine(
  doc: jsPDF,
  rawText: string,
  maxW: number,
  initialPt: number,
  minPt = 5.0
): { text: string; fontSize: number } {
  const safeMax = Math.max(5, maxW)
  const clean = (rawText || '').replace(/\s+/g, ' ').trim()
  if (!clean) return { text: '', fontSize: initialPt }

  let pt = initialPt
  while (pt > minPt) {
    doc.setFontSize(pt)
    if (doc.getTextWidth(clean) <= safeMax) {
      return { text: clean, fontSize: pt }
    }
    pt = Math.max(minPt, Number((pt - 0.4).toFixed(2)))
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
  minPt = 5.5
): { lines: string[]; fontSize: number } {
  const safeMax = Math.max(5, maxW)
  const clean = (rawText || '').replace(/\s+/g, ' ').trim()
  if (!clean) return { lines: [], fontSize: initialPt }

  let pt = initialPt
  while (pt > minPt) {
    doc.setFontSize(pt)
    const lines = doc.splitTextToSize(clean, safeMax) as string[]
    if (lines.length <= maxLines) {
      return { lines, fontSize: pt }
    }
    pt = Math.max(minPt, Number((pt - 0.4).toFixed(2)))
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

function drawTarjetaMediaCarta(
  doc: jsPDF,
  casillero: LockerPdfCasillero,
  qrDataUrl: string,
  x: number,
  y: number,
  w: number,
  h: number,
  modoPreCenso: boolean
) {
  const emp = casillero.empleados
  const { meta } = parseLockerObservaciones(casillero.observaciones)
  const areaName = casillero.modulo_area || 'Planta de Beneficio'
  const bateriaName = casillero.modulo_bateria || 'BATERIA VESTIDOR'
  const esGrande =
    (casillero.posicion_nivel || '').includes('Grande') || casillero.tipo_modulo === '2_niveles'

  // Marco exterior de la ficha
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(24, 24, 27)
  doc.setLineWidth(0.7)
  doc.roundedRect(x, y, w, h, 3, 3, 'FD')

  const pad = 6
  const innerW = w - pad * 2

  // 1. Header de Ficha
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(24, 24, 27)
  const hdrFit = fitSingleLine(doc, 'RECURSOS HUMANOS - CONTROL DE CASILLEROS', innerW - 56, 10.5, 7.5)
  doc.setFontSize(hdrFit.fontSize)
  doc.text(hdrFit.text, x + pad, y + 8.5)

  // Pill negra de Departamento + Batería
  const deptLabel = `DEPTO: ${areaName.toUpperCase()}`
  const deptPillFit = fitSingleLine(doc, deptLabel, 76, 7.5, 5.5)
  doc.setFontSize(deptPillFit.fontSize)
  const pillW = Math.min(78, doc.getTextWidth(deptPillFit.text) + 6)
  doc.setFillColor(15, 23, 42)
  doc.roundedRect(x + pad, y + 10.8, pillW, 5.5, 1.5, 1.5, 'F')
  doc.setTextColor(255, 255, 255)
  doc.text(deptPillFit.text, x + pad + 3, y + 14.5)

  doc.setTextColor(82, 82, 91)
  doc.setFont('helvetica', 'bold')
  const batFit = fitSingleLine(doc, `| ${bateriaName}`, innerW - pillW - 56, 7.5, 5.5)
  doc.setFontSize(batFit.fontSize)
  doc.text(batFit.text, x + pad + pillW + 2, y + 14.5)

  // Badge tipo módulo arriba a la derecha
  const modLabel = esGrande ? 'MODULO 2 CASILLEROS (GRANDE)' : 'MODULO 3 CASILLEROS'
  doc.setFontSize(6.5)
  const modBoxW = Math.min(52, doc.getTextWidth(modLabel) + 6)
  if (esGrande) {
    doc.setFillColor(24, 24, 27)
    doc.setTextColor(255, 255, 255)
  } else {
    doc.setFillColor(244, 244, 245)
    doc.setTextColor(24, 24, 27)
  }
  doc.setDrawColor(24, 24, 27)
  doc.setLineWidth(0.35)
  doc.roundedRect(x + w - pad - modBoxW, y + 4.8, modBoxW, 5.8, 1, 1, 'FD')
  const modFit = fitSingleLine(doc, modLabel, modBoxW - 3, 6.5, 5.0)
  doc.setFontSize(modFit.fontSize)
  doc.text(modFit.text, x + w - pad - modBoxW / 2, y + 8.6, { align: 'center' })

  doc.setTextColor(113, 113, 122)
  doc.setFontSize(7.2)
  doc.text(`Nivel: ${casillero.posicion_nivel || 'Estandar'}`, x + w - pad, y + 14.8, { align: 'right' })

  // Línea divisoria bajo header
  doc.setDrawColor(24, 24, 27)
  doc.setLineWidth(0.6)
  doc.line(x + pad, y + 18.5, x + w - pad, y + 18.5)

  // 2. Cuerpo Principal: Columna izquierda (Código + Titular) + Columna derecha (QR)
  const bodyTop = y + 23
  const qrBoxW = 50
  const qrBoxH = 60
  const qrBoxX = x + w - pad - qrBoxW
  const leftW = qrBoxX - (x + pad) - 6

  // Etiqueta CODIGO DE CASILLERO + badge área
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(113, 113, 122)
  doc.setFontSize(7.5)
  doc.text('CODIGO DE CASILLERO', x + pad, bodyTop + 3)

  // Código gigante
  doc.setFont('courier', 'bold')
  doc.setTextColor(9, 9, 11)
  const codeFit = fitSingleLine(doc, casillero.codigo_casillero, leftW, 30, 16)
  doc.setFontSize(codeFit.fontSize)
  doc.text(codeFit.text, x + pad, bodyTop + 16)

  doc.setDrawColor(212, 212, 216)
  doc.setLineWidth(0.35)
  doc.line(x + pad, bodyTop + 19.5, x + pad + leftW, bodyTop + 19.5)

  // Datos del titular
  const titY = bodyTop + 25.5
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(113, 113, 122)
  doc.setFontSize(7.5)
  doc.text('TRABAJADOR ASIGNADO / TITULAR:', x + pad, titY)

  if (modoPreCenso) {
    doc.setDrawColor(161, 161, 170)
    doc.setLineDashPattern([1, 1.2], 0)
    doc.line(x + pad, titY + 11, x + pad + leftW, titY + 11)
    doc.line(x + pad + 12, titY + 21, x + pad + leftW * 0.45, titY + 21)
    doc.line(x + pad + leftW * 0.65, titY + 21, x + pad + leftW, titY + 21)
    doc.setLineDashPattern([], 0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(113, 113, 122)
    doc.text('Ficha:', x + pad, titY + 20.5)
    doc.text('Turno / Puesto:', x + pad + leftW * 0.48, titY + 20.5)
  } else if (emp) {
    const fullName = `${emp.apellido_paterno || ''} ${emp.apellido_materno || ''} ${emp.nombre || ''}`
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase()
    const nameFit = fitMultiLine(doc, fullName, leftW, 2, 13.5, 9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(24, 24, 27)
    doc.setFontSize(nameFit.fontSize)
    nameFit.lines.forEach((ln, idx) => {
      doc.text(ln, x + pad, titY + 7 + idx * 6)
    })

    const subInfoY = titY + (nameFit.lines.length > 1 ? 18.5 : 13.5)
    doc.setTextColor(82, 82, 91)
    const subFit = fitSingleLine(
      doc,
      `Ficha #${emp.numero_empleado} | ${emp.puesto || emp.departamento || areaName}`,
      leftW,
      9.2,
      6.5
    )
    doc.setFontSize(subFit.fontSize)
    doc.text(subFit.text, x + pad, subInfoY)
  } else if (casillero.nombre_provisional) {
    const provFit = fitMultiLine(doc, casillero.nombre_provisional.toUpperCase(), leftW, 2, 13, 8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(24, 24, 27)
    doc.setFontSize(provFit.fontSize)
    provFit.lines.forEach((ln, idx) => {
      doc.text(ln, x + pad, titY + 7 + idx * 6)
    })
    doc.setTextColor(180, 83, 9)
    const provSub = fitSingleLine(
      doc,
      `Ficha #${casillero.numero_empleado_provisional || 'N/A'} | ${meta.puesto_provisional || areaName}`,
      leftW,
      8.8,
      6.5
    )
    doc.setFontSize(provSub.fontSize)
    doc.text(provSub.text, x + pad, titY + (provFit.lines.length > 1 ? 18.5 : 13.5))
  } else {
    doc.setTextColor(4, 120, 87)
    doc.setFont('helvetica', 'bold')
    const availFit = fitSingleLine(
      doc,
      'CASILLERO DISPONIBLE - ESCANEA EL QR PARA REGISTRARTE',
      leftW,
      9.2,
      6.5
    )
    doc.setFontSize(availFit.fontSize)
    doc.text(availFit.text, x + pad, titY + 8.5)

    doc.setDrawColor(161, 161, 170)
    doc.setLineDashPattern([1, 1.2], 0)
    doc.line(x + pad, titY + 18.5, x + pad + leftW, titY + 18.5)
    doc.setLineDashPattern([], 0)
  }

  // Tarjeta QR derecha
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(24, 24, 27)
  doc.setLineWidth(0.55)
  doc.roundedRect(qrBoxX, bodyTop, qrBoxW, qrBoxH, 2.2, 2.2, 'FD')

  doc.setFillColor(228, 228, 231)
  doc.setDrawColor(161, 161, 170)
  doc.setLineWidth(0.25)
  doc.roundedRect(qrBoxX + 3, bodyTop + 2.5, qrBoxW - 6, 5.2, 1, 1, 'FD')
  doc.setTextColor(24, 24, 27)
  doc.setFont('helvetica', 'bold')
  const qrAreaFit = fitSingleLine(doc, areaName.toUpperCase(), qrBoxW - 9, 6.8, 4.8)
  doc.setFontSize(qrAreaFit.fontSize)
  doc.text(qrAreaFit.text, qrBoxX + qrBoxW / 2, bodyTop + 6, { align: 'center' })

  if (qrDataUrl) {
    const qrSize = 37
    doc.addImage(qrDataUrl, 'PNG', qrBoxX + (qrBoxW - qrSize) / 2, bodyTop + 10, qrSize, qrSize)
  }

  doc.setTextColor(24, 24, 27)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.8)
  doc.text('Escanea para Registro', qrBoxX + qrBoxW / 2, bodyTop + 52, { align: 'center' })
  doc.text('y Resguardo en RH', qrBoxX + qrBoxW / 2, bodyTop + 55.5, { align: 'center' })

  // 3. Footer Control de Llave y Firma
  const footTop = y + h - 24
  doc.setDrawColor(24, 24, 27)
  doc.setLineWidth(0.6)
  doc.line(x + pad, footTop, x + w - pad, footTop)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(113, 113, 122)
  doc.setFontSize(7.2)
  doc.text('CONTROL DE ACCESO / LLAVE:', x + pad, footTop + 5)

  const check1 = casillero.condicion_llave === 'Tiene Llave' ? 'X' : ' '
  const check2 = casillero.condicion_llave === 'Candado Personal' ? 'X' : ' '
  const check3 =
    casillero.condicion_llave === 'Copia en RH' ||
    meta.deja_llave_rh === 'Si' ||
    meta.deja_llave_rh === 'Ya Entregada'
      ? 'X'
      : ' '

  const checks = [
    `[${check1}] Llave Oficial`,
    `[${check2}] Candado Propio`,
    `[${check3}] Deja Copia RH`,
  ]
  let cx = x + pad
  doc.setTextColor(24, 24, 27)
  doc.setFontSize(7.4)
  checks.forEach((lbl) => {
    const bw = doc.getTextWidth(lbl) + 4
    doc.setDrawColor(161, 161, 170)
    doc.setLineWidth(0.25)
    doc.roundedRect(cx, footTop + 7.2, bw, 5.2, 0.8, 0.8, 'D')
    doc.text(lbl, cx + 2, footTop + 10.8)
    cx += bw + 2.2
  })

  if (casillero.numero_llave) {
    doc.setFontSize(7.5)
    doc.setTextColor(82, 82, 91)
    doc.text(`Num. Llave: ${casillero.numero_llave}`, x + pad, footTop + 17.5)
  }

  // Firma derecha
  const signLeft = x + w - pad - 76
  doc.setDrawColor(113, 113, 122)
  doc.setLineWidth(0.4)
  doc.line(signLeft, footTop + 11, x + w - pad, footTop + 11)
  doc.setTextColor(39, 39, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text('Firma de Resguardo / Conformidad del Titular', signLeft + 38, footTop + 15.2, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(113, 113, 122)
  doc.text('El trabajador debe acudir a RH a firmar su resguardo oficial.', signLeft + 38, footTop + 18.8, {
    align: 'center',
  })
}

export async function generateLockersFichasPDF(
  casilleros: LockerPdfCasillero[],
  baseUrl: string,
  modoPreCenso: boolean
): Promise<void> {
  if (!casilleros || casilleros.length === 0) return

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageW = 215.9
  const marginX = 11
  const cardW = pageW - marginX * 2
  const cardH = 123

  const totalPages = Math.ceil(casilleros.length / 2)
  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (pageIdx > 0) doc.addPage('letter', 'portrait')

    const c1 = casilleros[pageIdx * 2]
    const c2 = casilleros[pageIdx * 2 + 1] || null

    const qr1 = await QRCode.toDataURL(buildLockerQrUrl(baseUrl, c1.codigo_casillero, c1.modulo_area), {
      width: 320,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
    })
    drawTarjetaMediaCarta(doc, c1, qr1, marginX, 10, cardW, cardH, modoPreCenso)

    // Línea central de corte
    const cutY = 139.7
    doc.setDrawColor(161, 161, 170)
    doc.setLineWidth(0.35)
    doc.setLineDashPattern([2, 1.5], 0)
    doc.line(marginX, cutY, pageW - marginX, cutY)
    doc.setLineDashPattern([], 0)

    doc.setFillColor(255, 255, 255)
    doc.rect(pageW / 2 - 34, cutY - 2.5, 68, 5, 'F')
    doc.setFont('courier', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(82, 82, 91)
    doc.text('--- CORTE AQUI (MEDIA HOJA CARTA) ---', pageW / 2, cutY + 1, { align: 'center' })

    if (c2) {
      const qr2 = await QRCode.toDataURL(buildLockerQrUrl(baseUrl, c2.codigo_casillero, c2.modulo_area), {
        width: 320,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
      })
      drawTarjetaMediaCarta(doc, c2, qr2, marginX, 146.4, cardW, cardH, modoPreCenso)
    }
  }

  const areaSlug =
    casilleros.length > 0 && casilleros.every((c) => c.modulo_area === casilleros[0].modulo_area)
      ? `_${(casilleros[0].modulo_area || 'General').replace(/\s+/g, '_')}`
      : ''
  doc.save(`Fichas_QR_Casilleros${areaSlug}.pdf`)
}

export async function generateLockersEtiquetasPDF(
  items: { casillero: LockerPdfCasillero; modulo: LockerPdfModulo }[],
  baseUrl: string,
  modoPreCenso: boolean
): Promise<void> {
  if (!items || items.length === 0) return

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const marginX = 11
  const marginY = 10
  const gapX = 5.9
  const gapY = 3.5
  const cardW = 94
  const cardH = 34.5
  const perPage = 14 // 2 columnas x 7 filas

  for (let i = 0; i < items.length; i++) {
    const posInPage = i % perPage
    if (i > 0 && posInPage === 0) {
      doc.addPage('letter', 'portrait')
    }

    const col = posInPage % 2
    const row = Math.floor(posInPage / 2)
    const x = marginX + col * (cardW + gapX)
    const y = marginY + row * (cardH + gapY)

    const { casillero, modulo } = items[i]
    const emp = casillero.empleados
    const areaName = modulo.area || 'GENERAL'
    const batShort = (modulo.bateria || '').split(' ').slice(0, 2).join(' ')
    const qrUrl = await QRCode.toDataURL(buildLockerQrUrl(baseUrl, casillero.codigo_casillero, modulo.area), {
      width: 240,
      margin: 0,
      color: { dark: '#000000', light: '#FFFFFF' },
    })

    // Caja etiqueta
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(24, 24, 27)
    doc.setLineWidth(0.5)
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD')

    const leftW = cardW - 31
    // Header mini
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(39, 39, 42)
    const hLeft = fitSingleLine(doc, `${areaName.toUpperCase()} | ${batShort}`, leftW - 22, 6.2, 4.5)
    doc.setFontSize(hLeft.fontSize)
    doc.text(hLeft.text, x + 3, y + 5.2)

    const hRight = fitSingleLine(doc, casillero.posicion_nivel || '', 22, 6.2, 4.5)
    doc.setFontSize(hRight.fontSize)
    doc.text(hRight.text, x + 3 + leftW - 1, y + 5.2, { align: 'right' })

    doc.setDrawColor(212, 212, 216)
    doc.setLineWidth(0.25)
    doc.line(x + 3, y + 6.8, x + 3 + leftW, y + 6.8)

    // Código casillero grande
    doc.setFont('courier', 'bold')
    doc.setTextColor(9, 9, 11)
    const codFit = fitSingleLine(doc, casillero.codigo_casillero, leftW - 2, 16.5, 11)
    doc.setFontSize(codFit.fontSize)
    doc.text(codFit.text, x + 3, y + 15.5)

    // Titular
    if (modoPreCenso) {
      doc.setDrawColor(161, 161, 170)
      doc.setLineDashPattern([1, 1], 0)
      doc.line(x + 3, y + 25.5, x + 3 + leftW, y + 25.5)
      doc.setLineDashPattern([], 0)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.setTextColor(113, 113, 122)
      doc.text('Nombre / Ficha:', x + 3, y + 29.5)
    } else if (emp) {
      const fullName = `${emp.apellido_paterno || ''} ${emp.apellido_materno || ''} ${emp.nombre || ''}`
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase()
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(24, 24, 27)
      const nFit = fitSingleLine(doc, fullName, leftW - 2, 8.2, 5.8)
      doc.setFontSize(nFit.fontSize)
      doc.text(nFit.text, x + 3, y + 23.5)

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(82, 82, 91)
      const sFit = fitSingleLine(
        doc,
        `Ficha #${emp.numero_empleado} | ${emp.puesto || emp.departamento || areaName}`,
        leftW - 2,
        7.0,
        5.0
      )
      doc.setFontSize(sFit.fontSize)
      doc.text(sFit.text, x + 3, y + 29)
    } else if (casillero.nombre_provisional) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(180, 83, 9)
      const pFit = fitSingleLine(doc, casillero.nombre_provisional.toUpperCase(), leftW - 2, 8.2, 5.8)
      doc.setFontSize(pFit.fontSize)
      doc.text(pFit.text, x + 3, y + 23.5)

      doc.setFontSize(7)
      doc.text(`(Ficha #${casillero.numero_empleado_provisional || 'N/A'})`, x + 3, y + 29)
    } else {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(4, 120, 87)
      const dFit = fitSingleLine(doc, 'ESCANEA EL QR PARA REGISTRAR', leftW - 2, 7.8, 5.5)
      doc.setFontSize(dFit.fontSize)
      doc.text(dFit.text, x + 3, y + 26)
    }

    // QR derecha
    const qrBoxSize = 23.5
    const qrX = x + cardW - qrBoxSize - 3
    const qrY = y + 3.2
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(24, 24, 27)
    doc.setLineWidth(0.35)
    doc.roundedRect(qrX, qrY, qrBoxSize, qrBoxSize, 1.2, 1.2, 'FD')
    doc.addImage(qrUrl, 'PNG', qrX + 1.1, qrY + 1.1, qrBoxSize - 2.2, qrBoxSize - 2.2)

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(24, 24, 27)
    const qrCap = fitSingleLine(doc, areaName.toUpperCase(), qrBoxSize + 1, 5.5, 4.0)
    doc.setFontSize(qrCap.fontSize)
    doc.text(qrCap.text, qrX + qrBoxSize / 2, y + 31.2, { align: 'center' })
  }

  doc.save('Etiquetas_QR_Puertas_Casilleros.pdf')
}

export async function generateLockersPlanogramaPDF(
  tirasPlanograma: LockerPdfModulo[][],
  modoPreCenso: boolean
): Promise<void> {
  if (!tirasPlanograma || tirasPlanograma.length === 0) return

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' })
  const pageW = 279.4
  const marginX = 10
  const stripW = pageW - marginX * 2
  const stripH = 92

  const totalPages = Math.ceil(tirasPlanograma.length / 2)
  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    if (pIdx > 0) doc.addPage('letter', 'landscape')

    for (let slot = 0; slot < 2; slot++) {
      const tiraIdx = pIdx * 2 + slot
      const grupoModulos = tirasPlanograma[tiraIdx]
      if (!grupoModulos || grupoModulos.length === 0) continue

      const y = slot === 0 ? 10 : 112
      doc.setFillColor(255, 255, 255)
      doc.setDrawColor(24, 24, 27)
      doc.setLineWidth(0.6)
      doc.roundedRect(marginX, y, stripW, stripH, 2.5, 2.5, 'FD')

      // Cabecera tira
      doc.setFillColor(24, 24, 27)
      doc.roundedRect(marginX + 4, y + 3.5, 48, 5.5, 1, 1, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('courier', 'bold')
      doc.setFontSize(7.5)
      doc.text(`TIRA PLANOGRAMA #${tiraIdx + 1}`, marginX + 28, y + 7.2, { align: 'center' })

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(24, 24, 27)
      const areaTitle = `${grupoModulos[0]?.area || 'DEPARTAMENTO'} | ${grupoModulos[0]?.bateria || ''}`
      const aFit = fitSingleLine(doc, areaTitle.toUpperCase(), 140, 8.5, 6)
      doc.setFontSize(aFit.fontSize)
      doc.text(aFit.text, marginX + 55, y + 7.4)

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(82, 82, 91)
      doc.setFontSize(7.5)
      doc.text(
        `Modulos ${grupoModulos[0]?.codigo_modulo} al ${grupoModulos[grupoModulos.length - 1]?.codigo_modulo}`,
        marginX + stripW - 4,
        y + 7.4,
        { align: 'right' }
      )

      doc.setDrawColor(24, 24, 27)
      doc.setLineWidth(0.45)
      doc.line(marginX + 4, y + 10.8, marginX + stripW - 4, y + 10.8)

      // 6 módulos por fila
      const innerStripW = stripW - 8
      const colGap = 2.5
      const colW = (innerStripW - colGap * 5) / 6

      grupoModulos.forEach((mod, mIdx) => {
        const mx = marginX + 4 + mIdx * (colW + colGap)
        const my = y + 13
        const mh = stripH - 22

        doc.setFillColor(255, 255, 255)
        doc.setDrawColor(39, 39, 42)
        doc.setLineWidth(0.4)
        doc.roundedRect(mx, my, colW, mh, 1.5, 1.5, 'FD')

        doc.setFillColor(24, 24, 27)
        doc.rect(mx, my, colW, 8.5, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('courier', 'bold')
        doc.setFontSize(8.5)
        doc.text(mod.codigo_modulo, mx + colW / 2, my + 4.3, { align: 'center' })
        doc.setTextColor(251, 191, 36)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6)
        doc.text(mod.tipo_modulo === '2_niveles' ? '2 NIVELES' : '3 NIVELES', mx + colW / 2, my + 7.3, {
          align: 'center',
        })

        const items = [...(mod.lockers_casilleros || [])].sort(
          (a, b) => (a.numero_en_modulo || 0) - (b.numero_en_modulo || 0)
        )
        const count = Math.max(items.length, mod.tipo_modulo === '2_niveles' ? 2 : 3)
        const cellGap = 1.6
        const availH = mh - 10.5 - cellGap * (count - 1)
        const cellH = Math.max(12, availH / count)

        items.forEach((cas, cIdx) => {
          const cy = my + 9.8 + cIdx * (cellH + cellGap)
          const emp = cas.empleados
          const libre = cas.estatus === 'Disponible'
          const reparacion = cas.estatus === 'En Reparacion'
          const inservible = cas.estatus === 'Inservible'

          if (inservible) {
            doc.setFillColor(255, 241, 242)
            doc.setDrawColor(251, 113, 133)
          } else if (reparacion) {
            doc.setFillColor(255, 251, 235)
            doc.setDrawColor(251, 191, 36)
          } else if (libre) {
            doc.setFillColor(236, 253, 245)
            doc.setDrawColor(52, 211, 153)
          } else {
            doc.setFillColor(244, 244, 245)
            doc.setDrawColor(212, 212, 216)
          }
          doc.setLineWidth(0.3)
          doc.roundedRect(mx + 1.2, cy, colW - 2.4, cellH, 1, 1, 'FD')

          doc.setFont('courier', 'bold')
          doc.setTextColor(24, 24, 27)
          doc.setFontSize(6.5)
          doc.text(cas.codigo_casillero, mx + 2.2, cy + 4)

          doc.setFont('helvetica', 'bold')
          const cellText = modoPreCenso
            ? '__________________'
            : emp
            ? `${emp.apellido_paterno || ''} ${(emp.nombre || '').split(' ')[0]}`.trim()
            : cas.nombre_provisional
            ? `${cas.nombre_provisional.split(' ')[0]} (Prov)`
            : reparacion
            ? 'A REPARAR'
            : inservible
            ? 'INSERVIBLE'
            : 'LIBRE'
          const cFit = fitSingleLine(doc, cellText, colW - 4.4, 7.0, 4.8)
          doc.setFontSize(cFit.fontSize)
          doc.text(cFit.text, mx + 2.2, cy + cellH * 0.56)

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(5.8)
          doc.setTextColor(113, 113, 122)
          const subTxt = emp ? `#${emp.numero_empleado}` : cas.condicion_llave || 'Sin Llave'
          const subFit = fitSingleLine(doc, subTxt, colW - 4.4, 5.8, 4.2)
          doc.setFontSize(subFit.fontSize)
          doc.text(subFit.text, mx + 2.2, cy + cellH - 2)
        })
      })

      // Guía corte tira
      doc.setDrawColor(161, 161, 170)
      doc.setLineDashPattern([1.5, 1.5], 0)
      doc.line(marginX + 4, y + stripH - 5.5, marginX + stripW - 4, y + stripH - 5.5)
      doc.setLineDashPattern([], 0)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.2)
      doc.setTextColor(113, 113, 122)
      doc.text(
        '--- CORTAR POR LA LINEA PUNTEADA PARA FORMAR TIRA CONTINUA DE CABEZAL ---',
        marginX + stripW / 2,
        y + stripH - 2,
        { align: 'center' }
      )
    }
  }

  doc.save('Tiras_Planograma_Casilleros.pdf')
}
