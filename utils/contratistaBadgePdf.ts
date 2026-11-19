import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { formatShortDate } from './contratistasConfig'

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

export async function generateContractorCredentialPDF(data: ContractorBadgeData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })

  // Card dimensions centered on page (standard oversized mine badge 95 x 140 mm)
  const cardX = 20
  const cardY = 20
  const cardW = 90
  const cardH = 135

  // Front of Badge
  doc.setFillColor(15, 23, 42) // slate-900
  doc.roundedRect(cardX, cardY, cardW, cardH, 4, 4, 'F')

  // Top amber accent bar
  doc.setFillColor(245, 158, 11) // amber-500
  doc.rect(cardX, cardY, cardW, 18, 'F')

  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('PASE DE ACCESO CONTRATISTA', cardX + cardW / 2, cardY + 7.5, { align: 'center' })
  doc.setFontSize(7.5)
  doc.text('CONTROL DE INGRESO A UNIDAD MINERA', cardX + cardW / 2, cardY + 13, { align: 'center' })

  // Photo box
  const photoSize = 28
  const photoX = cardX + (cardW - photoSize) / 2
  const photoY = cardY + 23
  doc.setFillColor(30, 41, 59)
  doc.setDrawColor(245, 158, 11)
  doc.roundedRect(photoX, photoY, photoSize, photoSize, 3, 3, 'FD')

  if (data.foto_url) {
    const imgB64 = await fetchImageAsBase64(data.foto_url)
    if (imgB64) {
      const fmt = imgB64.includes('png') ? 'PNG' : 'JPEG'
      try {
        doc.addImage(imgB64, fmt, photoX + 1, photoY + 1, photoSize - 2, photoSize - 2)
      } catch {
        // Fallback initials
      }
    }
  } else {
    doc.setTextColor(245, 158, 11)
    doc.setFontSize(16)
    const initials = data.nombre_completo
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(s => s[0])
      .join('')
      .toUpperCase()
    doc.text(initials || 'CT', photoX + photoSize / 2, photoY + photoSize / 2 + 2, { align: 'center' })
  }

  // Worker Name & Company
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  const nameLines = doc.splitTextToSize(data.nombre_completo.toUpperCase(), cardW - 10)
  doc.text(nameLines.slice(0, 2), cardX + cardW / 2, photoY + photoSize + 7, { align: 'center' })

  doc.setTextColor(245, 158, 11)
  doc.setFontSize(8)
  doc.text((data.puesto || 'CONTRATISTA').toUpperCase(), cardX + cardW / 2, photoY + photoSize + 15, { align: 'center' })

  doc.setTextColor(203, 213, 225)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  const empLines = doc.splitTextToSize(data.empresa.toUpperCase(), cardW - 12)
  doc.text(empLines.slice(0, 2), cardX + cardW / 2, photoY + photoSize + 21, { align: 'center' })

  // Details block
  const detY = photoY + photoSize + 29
  doc.setFillColor(30, 41, 59)
  doc.roundedRect(cardX + 5, detY, cardW - 10, 22, 2, 2, 'F')

  doc.setTextColor(148, 163, 184)
  doc.setFontSize(6.5)
  doc.text(`ÁREA / DEPTO: ${data.departamento_autorizado.toUpperCase()}`, cardX + 8, detY + 5)
  doc.text(`NSS: ${data.nss || 'N/A'}   |   SANGRE: ${data.tipo_sangre || 'N/E'}`, cardX + 8, detY + 10.5)
  doc.text(`VIGENCIA: ${formatShortDate(data.vigencia_desde)} AL ${formatShortDate(data.vigencia_hasta)}`, cardX + 8, detY + 16)

  // QR Code
  const qrDataUrl = await QRCode.toDataURL(data.codigo_qr, {
    width: 300,
    margin: 1,
    color: { dark: '#000000', light: '#FFFFFF' },
  })
  const qrSize = 27
  const qrX = cardX + (cardW - qrSize) / 2
  const qrY = detY + 25
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(qrX - 1.5, qrY - 1.5, qrSize + 3, qrSize + 3, 2, 2, 'F')
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

  doc.setTextColor(245, 158, 11)
  doc.setFont('courier', 'bold')
  doc.setFontSize(8.5)
  doc.text(data.codigo_qr, cardX + cardW / 2, cardY + cardH - 4.5, { align: 'center' })

  // Back of Badge (next to front)
  const backX = cardX + cardW + 10
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(15, 23, 42)
  doc.roundedRect(backX, cardY, cardW, cardH, 4, 4, 'FD')

  doc.setFillColor(15, 23, 42)
  doc.rect(backX, cardY, cardW, 14, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('AUTORIZACIONES Y CONTROL DE CASETA', backX + cardW / 2, cardY + 8.5, { align: 'center' })

  doc.setTextColor(30, 41, 59)
  doc.setFontSize(7.5)
  let by = cardY + 22
  doc.text(`Folio Solicitud: ${data.folio_solicitud}`, backX + 6, by)
  by += 6
  doc.text(`RFC Empresa: ${data.rfc_empresa || 'N/A'}`, backX + 6, by)
  by += 6
  doc.text(`CURP: ${data.curp || 'N/A'}`, backX + 6, by)
  by += 6
  doc.text(`Zona / Trabajo: ${(data.area_trabajo || data.departamento_autorizado).slice(0, 34)}`, backX + 6, by)
  by += 6
  doc.text(`Emergencia: ${(data.contacto_emergencia || 'Reportar a Seguridad Mina').slice(0, 34)}`, backX + 6, by)

  by += 10
  doc.setFillColor(254, 243, 199)
  doc.roundedRect(backX + 5, by, cardW - 10, 28, 2, 2, 'F')
  doc.setTextColor(146, 64, 14)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('CHECKLIST DE VALIDACIÓN MULTI-FACTOR', backX + 8, by + 5.5)
  doc.setFont('helvetica', 'normal')
  doc.text('✓ Documentación Fiscal / IMSS / NSS Validada', backX + 8, by + 11)
  doc.text('✓ Visto Bueno Departamento Interesado', backX + 8, by + 16)
  doc.text('✓ Inducción de Seguridad Vigente', backX + 8, by + 21)
  doc.text('✓ Control de Campamento / Acceso RH', backX + 8, by + 26)

  by += 36
  doc.setTextColor(51, 65, 85)
  doc.setFontSize(6.8)
  const notice = doc.splitTextToSize(
    'AVISO OBLIGATORIO: Esta credencial es personal e intransferible. Debe portarse en lugar visible dentro de la unidad minera y ENTREGARSE OBLIGATORIAMENTE en Caseta / Seguridad al concluir su estadía o salir de la mina.',
    cardW - 12
  )
  doc.text(notice, backX + 6, by)

  by += 25
  doc.setDrawColor(148, 163, 184)
  doc.line(backX + 10, by, backX + cardW - 10, by)
  doc.setFontSize(6.5)
  doc.text('Firma / Sello Seguridad (Entrega y Devolución)', backX + cardW / 2, by + 4, { align: 'center' })

  doc.save(`Credencial_${data.codigo_qr}.pdf`)
}
