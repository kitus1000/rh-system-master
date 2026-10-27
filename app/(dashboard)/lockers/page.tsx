'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/utils/supabase/client'
import {
  parseLockerObservaciones,
  serializeLockerObservaciones,
  generarFolioResguardo,
  type LockerExtendedMeta
} from '@/utils/lockerMeta'
import { 
  FolderLock, Smartphone, Printer, Search, Filter, RefreshCw, 
  CheckCircle2, AlertTriangle, XCircle, Key, Lock, Wrench, 
  UserPlus, UserCheck, AlertCircle, Sparkles, Building2, ChevronRight,
  Layers, Info, ShieldAlert, ArrowUpDown, X, Save, Trash2, Edit3,
  Tag, FileText, FileSignature, MessageCircle, ShieldCheck, BellRing,
  Copy, Check, ExternalLink, Phone
} from 'lucide-react'

interface Empleado {
  id_empleado: string
  nombre: string
  apellido_paterno: string
  apellido_materno?: string
  numero_empleado: number | string
  departamento?: string
  puesto?: string
  telefono?: string
}

interface LockerCasillero {
  id_casillero: string
  id_modulo: string
  codigo_casillero: string
  posicion_nivel: string
  numero_en_modulo: number
  id_empleado: string | null
  nombre_provisional: string | null
  numero_empleado_provisional: string | null
  estatus: 'Disponible' | 'Asignado' | 'En Reparacion' | 'Inservible'
  condicion_llave: 'Tiene Llave' | 'Candado Personal' | 'Sin Llave' | 'Copia en RH' | 'Sin Asignar'
  numero_llave: string | null
  descripcion_dano: string | null
  observaciones: string | null
  fecha_asignacion: string | null
  fecha_reporte_dano: string | null
  empleados?: Empleado | null
}

interface LockerModulo {
  id_modulo: string
  codigo_modulo: string
  area: string
  bateria: string
  tipo_modulo: '3_niveles' | '2_niveles'
  ubicacion_detalle: string
  orden: number
  lockers_casilleros?: LockerCasillero[]
}

export default function LockersPage() {
  const [modulos, setModulos] = useState<LockerModulo[]>([])
  const [casilleros, setCasilleros] = useState<LockerCasillero[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBateria, setSelectedBateria] = useState('TODAS')
  const [selectedEstatus, setSelectedEstatus] = useState('TODOS')
  const [selectedTipo, setSelectedTipo] = useState('TODOS')

  // Modal de edición de casillero
  const [selectedCasillero, setSelectedCasillero] = useState<LockerCasillero | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copiedNotice, setCopiedNotice] = useState(false)

  // Modal de Resguardo Oficial y Firma RH
  const [isResguardoModalOpen, setIsResguardoModalOpen] = useState(false)
  const [nombreRhAutoriza, setNombreRhAutoriza] = useState('Recursos Humanos - Minas de Bacis')
  const [savedRhSig, setSavedRhSig] = useState<string | null>(null)
  const [firmaTrabajadorActual, setFirmaTrabajadorActual] = useState<string | null>(null)
  const [firmaRhActual, setFirmaRhActual] = useState<string | null>(null)
  const rhCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const empCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [drawingRh, setDrawingRh] = useState(false)
  const [drawingEmp, setDrawingEmp] = useState(false)

  // Formulario en modal
  const [editEstatus, setEditEstatus] = useState<'Disponible' | 'Asignado' | 'En Reparacion' | 'Inservible'>('Disponible')
  const [editIdEmpleado, setEditIdEmpleado] = useState<string>('')
  const [editNombreProvisional, setEditNombreProvisional] = useState('')
  const [editNumEmpleadoProvisional, setEditNumEmpleadoProvisional] = useState('')
  const [editPuestoProvisional, setEditPuestoProvisional] = useState('')
  const [editTelefonoContacto, setEditTelefonoContacto] = useState('')
  const [editEsNuevoTrabajador, setEditEsNuevoTrabajador] = useState(false)
  const [editCondicionLlave, setEditCondicionLlave] = useState<string>('Sin Asignar')
  const [editDejaLlaveRh, setEditDejaLlaveRh] = useState<'Si' | 'No' | 'Ya Entregada' | 'Sin Definir'>('Si')
  const [editEstatusResguardo, setEditEstatusResguardo] = useState<'Pendiente Firma en RH' | 'Firmado' | 'Sin Resguardo'>('Pendiente Firma en RH')
  const [editFolioResguardo, setEditFolioResguardo] = useState('')
  const [editNumeroLlave, setEditNumeroLlave] = useState('')
  const [editDescripcionDano, setEditDescripcionDano] = useState('')
  const [editObservaciones, setEditObservaciones] = useState('')
  const [filtroEmpleadoModal, setFiltroEmpleadoModal] = useState('')
  const [soloBeneficio, setSoloBeneficio] = useState(true)

  // Cargar datos
  const cargarDatos = async () => {
    setLoading(true)
    try {
      // 1. Obtener empleados para el buscador
      const { data: empData, error: empErr } = await supabase
        .from('empleados')
        .select('id_empleado, nombre, apellido_paterno, apellido_materno, numero_empleado, departamento, puesto, telefono')
        .order('apellido_paterno', { ascending: true })

      if (!empErr && empData) {
        setEmpleados(empData)
      }

      // 2. Obtener módulos y casilleros
      const { data: modData, error: modErr } = await supabase
        .from('lockers_modulos')
        .select(`
          *,
          lockers_casilleros (
            *,
            empleados:id_empleado (
              id_empleado, nombre, apellido_paterno, apellido_materno, numero_empleado, departamento, puesto, telefono
            )
          )
        `)
        .eq('area', 'Planta de Beneficio')
        .order('orden', { ascending: true })

      if (modErr) {
        if (modErr.code === 'PGRST205' || modErr.message?.includes('does not exist') || modErr.message?.includes('schema cache')) {
          setTableMissing(true)
        } else {
          console.error('Error al consultar lockers:', modErr)
        }
        setLoading(false)
        return
      }

      if (modData) {
        setTableMissing(false)
        setModulos(modData)
        const allCasilleros: LockerCasillero[] = []
        modData.forEach(m => {
          if (m.lockers_casilleros) {
            const ordenados = [...m.lockers_casilleros].sort((a, b) => a.numero_en_modulo - b.numero_en_modulo)
            allCasilleros.push(...ordenados)
          }
        })
        setCasilleros(allCasilleros)
      }
    } catch (err) {
      console.error('Error general cargando lockers:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const savedName = localStorage.getItem('rh_firma_nombre_autoriza')
    if (savedName) setNombreRhAutoriza(savedName)
    const savedSig = localStorage.getItem('rh_firma_base64_guardada')
    if (savedSig) setSavedRhSig(savedSig)
    cargarDatos()
  }, [])

  // Abrir modal de edición
  const handleOpenEdit = (casillero: LockerCasillero) => {
    setSelectedCasillero(casillero)
    setEditEstatus(casillero.estatus)
    setEditIdEmpleado(casillero.id_empleado || '')
    setEditNombreProvisional(casillero.nombre_provisional || '')
    setEditNumEmpleadoProvisional(casillero.numero_empleado_provisional || '')
    setEditEsNuevoTrabajador(!!casillero.nombre_provisional && !casillero.id_empleado)
    setEditCondicionLlave(casillero.condicion_llave || 'Sin Asignar')
    setEditNumeroLlave(casillero.numero_llave || '')
    setEditDescripcionDano(casillero.descripcion_dano || '')

    const { notasLimpias, meta } = parseLockerObservaciones(casillero.observaciones)
    setEditObservaciones(notasLimpias)
    setEditPuestoProvisional(meta.puesto_provisional || casillero.empleados?.puesto || '')
    setEditTelefonoContacto(meta.telefono_contacto || casillero.empleados?.telefono || '')
    setEditDejaLlaveRh(
      meta.deja_llave_rh && meta.deja_llave_rh !== 'Sin Definir'
        ? meta.deja_llave_rh
        : casillero.condicion_llave === 'Copia en RH'
        ? 'Ya Entregada'
        : 'Si'
    )
    setEditEstatusResguardo(
      meta.estatus_resguardo && meta.estatus_resguardo !== 'Sin Resguardo'
        ? meta.estatus_resguardo
        : casillero.estatus === 'Asignado'
        ? 'Pendiente Firma en RH'
        : 'Sin Resguardo'
    )
    setEditFolioResguardo(meta.folio_resguardo || generarFolioResguardo(casillero.codigo_casillero))
    setFirmaTrabajadorActual(meta.firma_trabajador || null)
    setFirmaRhActual(meta.firma_rh || null)

    setFiltroEmpleadoModal('')
    setCopiedNotice(false)
    setIsEditModalOpen(true)
  }

  // Construir mensaje de aviso para que el trabajador pase a RH a firmar el resguardo
  const construirMensajeAvisoResguardo = () => {
    if (!selectedCasillero) return ''
    const empSel = empleados.find(e => e.id_empleado === editIdEmpleado) || selectedCasillero.empleados
    const nombreTitular = editEsNuevoTrabajador
      ? editNombreProvisional || 'Trabajador'
      : empSel
      ? `${empSel.nombre} ${empSel.apellido_paterno}`
      : 'Trabajador'

    const textoLlave =
      editDejaLlaveRh === 'Si'
        ? ' y *entregar la copia de la llave de tu casillero*'
        : ''

    return (
      `📋 *AVISO DE RECURSOS HUMANOS - MINAS DE BACIS*\n\n` +
      `Hola *${nombreTitular}*, te notificamos que tu casillero *${selectedCasillero.codigo_casillero}* (${selectedCasillero.posicion_nivel}) ha sido registrado en el sistema.\n\n` +
      `⚠️ *PASO OBLIGATORIO:* Debes pasar personalmente a la oficina de *Recursos Humanos* para *FIRMAR TU RESGUARDO OFICIAL*${textoLlave}.\n\n` +
      `• *Folio de Resguardo:* ${editFolioResguardo}\n` +
      `• *Casillero:* ${selectedCasillero.codigo_casillero}\n` +
      `• *Deja copia de llave en RH:* ${editDejaLlaveRh === 'Si' ? 'Sí' : editDejaLlaveRh === 'Ya Entregada' ? 'Ya entregada' : 'No'}`
    )
  }

  const handleEnviarWhatsAppAviso = () => {
    const msg = construirMensajeAvisoResguardo()
    const cleanPhone = editTelefonoContacto.replace(/\D/g, '')
    const phoneParam = cleanPhone.length === 10 ? `52${cleanPhone}` : cleanPhone
    const url = phoneParam
      ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  const handleCopiarMensajeAviso = () => {
    const msg = construirMensajeAvisoResguardo()
    navigator.clipboard.writeText(msg)
    setCopiedNotice(true)
    setTimeout(() => setCopiedNotice(false), 2500)
  }

  // Guardar cambios del casillero
  const handleGuardarCasillero = async (overrideMeta?: Partial<LockerExtendedMeta>) => {
    if (!selectedCasillero) return
    setSaving(true)

    try {
      let finalEstatus = editEstatus
      let finalIdEmpleado: string | null = editIdEmpleado || null
      let finalNombreProv: string | null = editNombreProvisional.trim() || null
      let finalNumProv: string | null = editNumEmpleadoProvisional.trim() || null

      if (editEsNuevoTrabajador) {
        finalIdEmpleado = null
        if (finalNombreProv && finalEstatus === 'Disponible') {
          finalEstatus = 'Asignado'
        }
      } else {
        finalNombreProv = null
        finalNumProv = null
        if (finalIdEmpleado && finalEstatus === 'Disponible') {
          finalEstatus = 'Asignado'
        }
      }

      if (finalEstatus === 'Disponible') {
        finalIdEmpleado = null
        finalNombreProv = null
        finalNumProv = null
      }

      const prevParsed = parseLockerObservaciones(selectedCasillero.observaciones)
      const newMeta: LockerExtendedMeta = {
        ...prevParsed.meta,
        deja_llave_rh: finalEstatus === 'Disponible' ? 'Sin Definir' : editDejaLlaveRh,
        estatus_resguardo: finalEstatus === 'Disponible' ? 'Sin Resguardo' : editEstatusResguardo,
        folio_resguardo: finalEstatus === 'Disponible' ? undefined : editFolioResguardo,
        telefono_contacto: editTelefonoContacto.replace(/\D/g, '') || undefined,
        puesto_provisional: editPuestoProvisional.trim() || undefined,
        firma_trabajador: finalEstatus === 'Disponible' ? null : firmaTrabajadorActual,
        firma_rh: finalEstatus === 'Disponible' ? null : firmaRhActual,
        nombre_rh_firma: nombreRhAutoriza,
        ...overrideMeta
      }

      let finalCondicionLlave = editCondicionLlave
      if ((newMeta.deja_llave_rh === 'Si' || newMeta.deja_llave_rh === 'Ya Entregada') && finalCondicionLlave === 'Sin Asignar') {
        finalCondicionLlave = 'Copia en RH'
      }

      const observacionesSerializadas = serializeLockerObservaciones(
        editObservaciones,
        finalEstatus === 'Disponible' ? {} : newMeta
      )

      const payload = {
        estatus: finalEstatus,
        id_empleado: finalIdEmpleado,
        nombre_provisional: finalNombreProv,
        numero_empleado_provisional: finalNumProv,
        condicion_llave: finalCondicionLlave,
        numero_llave: editNumeroLlave.trim() || null,
        descripcion_dano: finalEstatus === 'En Reparacion' || finalEstatus === 'Inservible' ? editDescripcionDano : null,
        observaciones: observacionesSerializadas,
        fecha_asignacion: (finalIdEmpleado || finalNombreProv) ? (selectedCasillero.fecha_asignacion || new Date().toISOString()) : null,
        fecha_reporte_dano: (finalEstatus === 'En Reparacion' || finalEstatus === 'Inservible') ? (selectedCasillero.fecha_reporte_dano || new Date().toISOString()) : null,
        actualizado_el: new Date().toISOString()
      }

      const { error } = await supabase
        .from('lockers_casilleros')
        .update(payload)
        .eq('id_casillero', selectedCasillero.id_casillero)

      if (error) throw error

      if (!overrideMeta) {
        setIsEditModalOpen(false)
      }
      await cargarDatos()
    } catch (err: any) {
      alert('Error al guardar cambios: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  // Desasignar casillero rápido
  const handleLiberarCasillero = async () => {
    if (!selectedCasillero) return
    if (!confirm(`¿Estás seguro de liberar el casillero ${selectedCasillero.codigo_casillero}?`)) return
    
    setSaving(true)
    try {
      const { error } = await supabase
        .from('lockers_casilleros')
        .update({
          estatus: 'Disponible',
          id_empleado: null,
          nombre_provisional: null,
          numero_empleado_provisional: null,
          observaciones: null,
          fecha_asignacion: null,
          actualizado_el: new Date().toISOString()
        })
        .eq('id_casillero', selectedCasillero.id_casillero)

      if (error) throw error
      setIsEditModalOpen(false)
      await cargarDatos()
    } catch (err: any) {
      alert('Error al liberar: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  // Funciones para dibujar firmas en el Modal de Resguardo
  const iniciarTrazoCanvas = (
    canvas: HTMLCanvasElement | null,
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    setDrawingState: (val: boolean) => void
  ) => {
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    ctx.strokeStyle = '#09090b'
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(clientX - rect.left, clientY - rect.top)
    setDrawingState(true)
  }

  const dibujarTrazoCanvas = (
    canvas: HTMLCanvasElement | null,
    isDrawingNow: boolean,
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawingNow || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    ctx.lineTo(clientX - rect.left, clientY - rect.top)
    ctx.stroke()
  }

  const limpiarCanvas = (canvas: HTMLCanvasElement | null, setter: (v: string | null) => void) => {
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
    }
    setter(null)
  }

  const handleConfirmarFirmaResguardoRH = async () => {
    let nuevaFirmaRh = firmaRhActual
    if (rhCanvasRef.current) {
      // Comprobar si dibujó algo en el canvas de RH
      const dataUrl = rhCanvasRef.current.toDataURL('image/png')
      if (!nuevaFirmaRh) nuevaFirmaRh = dataUrl
    }

    let nuevaFirmaEmp = firmaTrabajadorActual
    if (empCanvasRef.current && !nuevaFirmaEmp) {
      nuevaFirmaEmp = empCanvasRef.current.toDataURL('image/png')
    }

    if (nuevaFirmaRh) {
      localStorage.setItem('rh_firma_base64_guardada', nuevaFirmaRh)
      setSavedRhSig(nuevaFirmaRh)
    }
    localStorage.setItem('rh_firma_nombre_autoriza', nombreRhAutoriza)

    setFirmaRhActual(nuevaFirmaRh)
    setFirmaTrabajadorActual(nuevaFirmaEmp)
    setEditEstatusResguardo('Firmado')

    await handleGuardarCasillero({
      estatus_resguardo: 'Firmado',
      firma_rh: nuevaFirmaRh,
      firma_trabajador: nuevaFirmaEmp,
      nombre_rh_firma: nombreRhAutoriza,
      fecha_firma_resguardo: new Date().toISOString()
    })

    alert(`✅ Resguardo Oficial de ${selectedCasillero?.codigo_casillero} firmado y guardado correctamente.`)
  }

  // Filtrado de empleados en modal
  const empleadosFiltrados = useMemo(() => {
    return empleados.filter(e => {
      const matchDep = soloBeneficio ? (e.departamento?.toLowerCase().includes('beneficio')) : true
      if (!matchDep) return false

      if (!filtroEmpleadoModal) return true
      const q = filtroEmpleadoModal.toLowerCase()
      const fullName = `${e.nombre} ${e.apellido_paterno} ${e.apellido_materno || ''}`.toLowerCase()
      const numStr = String(e.numero_empleado || '')
      return fullName.includes(q) || numStr.includes(q)
    })
  }, [empleados, filtroEmpleadoModal, soloBeneficio])

  // Estadísticas KPI
  const stats = useMemo(() => {
    const total = casilleros.length
    const asignados = casilleros.filter(c => c.estatus === 'Asignado').length
    const disponibles = casilleros.filter(c => c.estatus === 'Disponible').length
    const reparacion = casilleros.filter(c => c.estatus === 'En Reparacion').length
    const inservibles = casilleros.filter(c => c.estatus === 'Inservible').length

    let pendientesResguardo = 0
    let firmadosResguardo = 0
    casilleros.forEach(c => {
      if (c.estatus === 'Asignado') {
        const { meta } = parseLockerObservaciones(c.observaciones)
        if (meta.estatus_resguardo === 'Firmado') {
          firmadosResguardo++
        } else {
          pendientesResguardo++
        }
      }
    })

    return { total, asignados, disponibles, reparacion, inservibles, pendientesResguardo, firmadosResguardo }
  }, [casilleros])

  // Filtrado de módulos en el planograma
  const modulosFiltrados = useMemo(() => {
    return modulos.filter(mod => {
      if (selectedBateria !== 'TODAS' && mod.bateria !== selectedBateria) return false
      if (selectedTipo === '3_NIVELES' && mod.tipo_modulo !== '3_niveles') return false
      if (selectedTipo === '2_NIVELES' && mod.tipo_modulo !== '2_niveles') return false

      if (selectedEstatus !== 'TODOS' || searchTerm.trim() !== '') {
        const matchingCasilleros = mod.lockers_casilleros?.some(c => {
          const { meta } = parseLockerObservaciones(c.observaciones)
          if (selectedEstatus === 'PENDIENTE_RESGUARDO') {
            if (c.estatus !== 'Asignado' || meta.estatus_resguardo === 'Firmado') return false
          } else if (selectedEstatus === 'RESGUARDO_FIRMADO') {
            if (c.estatus !== 'Asignado' || meta.estatus_resguardo !== 'Firmado') return false
          } else if (selectedEstatus !== 'TODOS' && c.estatus !== selectedEstatus) {
            return false
          }

          if (!searchTerm.trim()) return true
          const q = searchTerm.toLowerCase()
          const cod = c.codigo_casillero.toLowerCase()
          const prov = (c.nombre_provisional || '').toLowerCase()
          const empName = c.empleados ? `${c.empleados.nombre} ${c.empleados.apellido_paterno} ${c.empleados.apellido_materno || ''}`.toLowerCase() : ''
          const empNum = c.empleados ? String(c.empleados.numero_empleado) : ''

          return cod.includes(q) || prov.includes(q) || empName.includes(q) || empNum.includes(q)
        })
        return matchingCasilleros
      }

      return true
    })
  }, [modulos, selectedBateria, selectedTipo, selectedEstatus, searchTerm])

  // Baterías únicas para tabs
  const bateriasDisponibles = useMemo(() => {
    const set = new Set(modulos.map(m => m.bateria))
    return Array.from(set)
  }, [modulos])

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header con Acciones (Oculto al imprimir resguardo) */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl text-white">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <FolderLock className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Control de Lockers, QRs y Resguardos
              </h1>
              <p className="text-xs text-zinc-400 font-medium flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                Área: <span className="text-amber-300 font-bold">Planta de Beneficio</span> (120 Casilleros · Autorregistro QR + Firma de Resguardo RH)
              </p>
            </div>
          </div>
        </div>

        {/* Botones de acción rápida */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/registro-locker?locker=PB-M01-A"
            target="_blank"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs sm:text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <ExternalLink className="w-4 h-4" />
            <span>🔗 Formulario QR Trabajador</span>
          </Link>

          <Link
            href="/lockers/censo"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-95"
          >
            <Smartphone className="w-4 h-4" />
            <span>📱 Censo Móvil</span>
          </Link>

          <Link
            href="/lockers/fichas"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-semibold text-xs sm:text-sm transition-all active:scale-95"
          >
            <Printer className="w-4 h-4 text-sky-400" />
            <span>Fichas QR</span>
          </Link>

          <Link
            href="/lockers/tiras"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-semibold text-xs sm:text-sm transition-all active:scale-95"
          >
            <Tag className="w-4 h-4 text-emerald-400" />
            <span>Tiras & Etiquetas QR</span>
          </Link>

          <Link
            href="/lockers/reporte"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-semibold text-xs sm:text-sm transition-all active:scale-95"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Padrón / Lista</span>
          </Link>

          <button
            onClick={cargarDatos}
            disabled={loading}
            className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-all disabled:opacity-50"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Alerta de Tabla no creada en Supabase */}
      {tableMissing && (
        <div className="print:hidden bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-6 text-amber-900 dark:text-amber-200 space-y-3 shadow-md">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-black text-lg text-amber-800 dark:text-amber-300">
                Tablas de Lockers pendientes de creación en Supabase
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300/80 mt-1 leading-relaxed">
                Hemos preparado el script con las 2 tablas y la creación automática de los <strong>42 módulos (36 de 3 casilleros y 6 de 2 casilleros = 120 casilleros)</strong>.
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={cargarDatos}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-lg text-xs transition-all shadow"
                >
                  🔄 Ya ejecuté el script, reintentar conexión
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tarjetas KPI de Estado */}
      <div className="print:hidden grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total</span>
            <Layers className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-white mt-2">
            {stats.total || 120}
          </div>
          <span className="text-[10px] text-zinc-500 font-medium">42 módulos físicos</span>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">Asignados</span>
            <UserCheck className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-2">
            {stats.asignados}
          </div>
          <span className="text-[10px] text-zinc-500 font-medium">Con trabajador</span>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Disponibles</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {stats.disponibles}
          </div>
          <span className="text-[10px] text-zinc-500 font-medium">Libres para QR</span>
        </div>

        <button
          type="button"
          onClick={() => setSelectedEstatus(selectedEstatus === 'PENDIENTE_RESGUARDO' ? 'TODOS' : 'PENDIENTE_RESGUARDO')}
          className={`text-left p-4 rounded-xl border transition-all shadow-sm ${
            selectedEstatus === 'PENDIENTE_RESGUARDO'
              ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30'
              : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-amber-500/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Por Firmar RH</span>
            <BellRing className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
            {stats.pendientesResguardo}
          </div>
          <span className="text-[10px] text-zinc-500 font-medium">Pendientes de resguardo</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedEstatus(selectedEstatus === 'RESGUARDO_FIRMADO' ? 'TODOS' : 'RESGUARDO_FIRMADO')}
          className={`text-left p-4 rounded-xl border transition-all shadow-sm ${
            selectedEstatus === 'RESGUARDO_FIRMADO'
              ? 'bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/30'
              : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-emerald-500/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Resguardados</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {stats.firmadosResguardo}
          </div>
          <span className="text-[10px] text-zinc-500 font-medium">Resguardo firmado</span>
        </button>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Daño / Baja</span>
            <Wrench className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">
            {stats.reparacion + stats.inservibles}
          </div>
          <span className="text-[10px] text-zinc-500 font-medium">En servicio/baja</span>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="print:hidden bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Buscador */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por código (PB-M01-A), trabajador o ficha..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-zinc-900 dark:text-white"
            />
          </div>

          {/* Filtro por Estatus */}
          <div>
            <select
              value={selectedEstatus}
              onChange={(e) => setSelectedEstatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-zinc-900 dark:text-white"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="Disponible">🟢 Disponible</option>
              <option value="Asignado">🔵 Asignado (Todos)</option>
              <option value="PENDIENTE_RESGUARDO">⏳ Falta Firma de Resguardo en RH</option>
              <option value="RESGUARDO_FIRMADO">✅ Resguardo Firmado</option>
              <option value="En Reparacion">🟠 En Reparación</option>
              <option value="Inservible">🔴 Inservible / Baja</option>
            </select>
          </div>

          {/* Filtro por Tipo de Módulo */}
          <div>
            <select
              value={selectedTipo}
              onChange={(e) => setSelectedTipo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-zinc-900 dark:text-white"
            >
              <option value="TODOS">Todos los Tipos (120 Cas.)</option>
              <option value="3_NIVELES">📦 3 Niveles (90% - 108 Cas.)</option>
              <option value="2_NIVELES">🚪 2 Niveles Grandes (10% - 12 Cas.)</option>
            </select>
          </div>
        </div>

        {/* Pestañas de Batería */}
        {bateriasDisponibles.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <span className="text-xs font-semibold text-zinc-500">Filtrar Batería:</span>
            <button
              onClick={() => setSelectedBateria('TODAS')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedBateria === 'TODAS'
                  ? 'bg-amber-500 text-zinc-950 shadow-sm'
                  : 'bg-slate-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-slate-200'
              }`}
            >
              Todas ({modulos.length} Módulos)
            </button>
            {bateriasDisponibles.map(bat => (
              <button
                key={bat}
                onClick={() => setSelectedBateria(bat)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedBateria === bat
                    ? 'bg-amber-500 text-zinc-950 shadow-sm'
                    : 'bg-slate-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-slate-200'
                }`}
              >
                {bat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Planograma Visual de Módulos */}
      <div className="print:hidden">
        {loading ? (
          <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-zinc-500">Cargando planograma de lockers...</p>
          </div>
        ) : modulosFiltrados.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
            <Info className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-zinc-500">No se encontraron lockers con los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Array.from(new Set(modulosFiltrados.map(m => m.bateria))).map(batName => {
              const modsDeBateria = modulosFiltrados.filter(m => m.bateria === batName)

              return (
                <div key={batName} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <h3 className="font-black text-lg text-zinc-800 dark:text-zinc-200">
                        {batName}
                      </h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold">
                        {modsDeBateria.length} Módulos
                      </span>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {modsDeBateria.reduce((acc, m) => acc + (m.lockers_casilleros?.length || 0), 0)} Casilleros
                    </span>
                  </div>

                  {/* Grid de Módulos (Cuerpos Físicos) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                    {modsDeBateria.map(modulo => {
                      const esDoble = modulo.tipo_modulo === '2_niveles'
                      const items = modulo.lockers_casilleros || []

                      return (
                        <div
                          key={modulo.id_modulo}
                          className={`bg-white dark:bg-zinc-900 rounded-xl border-2 transition-all shadow-sm flex flex-col ${
                            esDoble
                              ? 'border-indigo-400/50 bg-indigo-500/5 dark:bg-indigo-950/20'
                              : 'border-slate-200 dark:border-zinc-800 hover:border-amber-500/50'
                          }`}
                        >
                          {/* Cabecera del Módulo */}
                          <div className="px-2.5 py-1.5 bg-slate-100 dark:bg-zinc-800/80 rounded-t-lg flex items-center justify-between border-b border-slate-200 dark:border-zinc-700/60">
                            <span className="font-mono font-black text-xs text-zinc-800 dark:text-zinc-200">
                              {modulo.codigo_modulo}
                            </span>
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                              esDoble
                                ? 'bg-indigo-500 text-white'
                                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                            }`}>
                              {esDoble ? '2 Niveles' : '3 Niveles'}
                            </span>
                          </div>

                          {/* Casilleros apilados verticalmente dentro del módulo */}
                          <div className="p-1.5 flex-1 flex flex-col gap-1.5">
                            {items.map(cas => {
                              const emp = cas.empleados
                              const esAsignado = cas.estatus === 'Asignado'
                              const esReparacion = cas.estatus === 'En Reparacion'
                              const esInservible = cas.estatus === 'Inservible'
                              const { meta } = parseLockerObservaciones(cas.observaciones)
                              const resguardoFirmado = meta.estatus_resguardo === 'Firmado'
                              const dejaLlave = meta.deja_llave_rh === 'Si' || meta.deja_llave_rh === 'Ya Entregada' || cas.condicion_llave === 'Copia en RH'

                              return (
                                <div
                                  key={cas.id_casillero}
                                  onClick={() => handleOpenEdit(cas)}
                                  className={`group relative p-2 rounded-lg border transition-all cursor-pointer select-none flex flex-col justify-between ${
                                    esDoble ? 'min-h-[115px]' : 'min-h-[86px]'
                                  } ${
                                    esInservible
                                      ? 'bg-rose-500/10 border-rose-500/40 hover:bg-rose-500/20 text-rose-900 dark:text-rose-300'
                                      : esReparacion
                                      ? 'bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/20 text-amber-900 dark:text-amber-300'
                                      : esAsignado
                                      ? 'bg-sky-500/10 border-sky-500/40 hover:bg-sky-500/20 text-sky-900 dark:text-sky-300'
                                      : 'bg-emerald-500/5 border-emerald-500/30 hover:bg-emerald-500/15 text-emerald-900 dark:text-emerald-300'
                                  }`}
                                >
                                  {/* Código y Nivel */}
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-mono font-bold text-xs">
                                      {cas.codigo_casillero}
                                    </span>
                                    <span className="text-[9px] font-semibold opacity-75">
                                      {cas.posicion_nivel.includes('Grande') ? 'GRANDE' : cas.posicion_nivel}
                                    </span>
                                  </div>

                                  {/* Ocupante / Estado */}
                                  <div className="my-1">
                                    {emp ? (
                                      <div className="truncate">
                                        <p className="font-black text-xs truncate leading-tight text-zinc-900 dark:text-white">
                                          {emp.apellido_paterno} {emp.nombre?.split(' ')[0]}
                                        </p>
                                        <p className="text-[10px] text-zinc-500 font-medium truncate">
                                          Ficha #{emp.numero_empleado}
                                        </p>
                                      </div>
                                    ) : cas.nombre_provisional ? (
                                      <div className="truncate">
                                        <p className="font-black text-xs truncate leading-tight text-zinc-900 dark:text-white">
                                          {cas.nombre_provisional}
                                        </p>
                                        <span className="text-[9px] text-zinc-500 font-bold">
                                          Ficha #{cas.numero_empleado_provisional || 'Prov'}
                                        </span>
                                      </div>
                                    ) : esReparacion ? (
                                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                        <Wrench className="w-3 h-3" /> Reparación
                                      </span>
                                    ) : esInservible ? (
                                      <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                        <XCircle className="w-3 h-3" /> Inservible
                                      </span>
                                    ) : (
                                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                        Disponible
                                      </span>
                                    )}
                                  </div>

                                  {/* Footer del casillero: Llave y Estado de Resguardo */}
                                  <div className="flex items-center justify-between text-[8.5px] pt-1 border-t border-black/5 dark:border-white/5 gap-1">
                                    <div className="flex items-center gap-1 truncate">
                                      <Key className={`w-2.5 h-2.5 shrink-0 ${dejaLlave ? 'text-emerald-500' : 'text-zinc-400'}`} />
                                      <span className="truncate">
                                        {dejaLlave ? 'Copia RH' : cas.condicion_llave || 'N/A'}
                                      </span>
                                    </div>

                                    {esAsignado && (
                                      <span
                                        className={`px-1 py-0.2 rounded font-black shrink-0 ${
                                          resguardoFirmado
                                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                            : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                        }`}
                                        title={resguardoFirmado ? 'Resguardo Firmado' : 'Pendiente Firma de Resguardo en RH'}
                                      >
                                        {resguardoFirmado ? '✅ Firmado' : '⏳ Firma RH'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de Asignación / Edición */}
      {isEditModalOpen && selectedCasillero && (
        <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Header Modal */}
            <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                  <FolderLock className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                    <span>Casillero {selectedCasillero.codigo_casillero}</span>
                    <Link
                      href={`/registro-locker?locker=${encodeURIComponent(selectedCasillero.codigo_casillero)}`}
                      target="_blank"
                      className="text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-amber-400 px-2 py-0.5 rounded-lg border border-zinc-700 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Ver página QR
                    </Link>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Posición: <span className="text-amber-300 font-bold">{selectedCasillero.posicion_nivel}</span> | Folio: <span className="font-mono text-zinc-300">{editFolioResguardo}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido Modal Scrollable */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-zinc-900 dark:text-zinc-100">
              {/* Selector de Estado Operativo */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                  Estado del Casillero
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditEstatus('Disponible')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs border text-center transition-all ${
                      editEstatus === 'Disponible'
                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-md'
                        : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    🟢 Libre
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditEstatus('Asignado')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs border text-center transition-all ${
                      editEstatus === 'Asignado'
                        ? 'bg-sky-500 text-white border-sky-600 shadow-md'
                        : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    🔵 Asignado
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditEstatus('En Reparacion')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs border text-center transition-all ${
                      editEstatus === 'En Reparacion'
                        ? 'bg-amber-500 text-zinc-950 border-amber-600 shadow-md'
                        : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    🟠 Reparación
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditEstatus('Inservible')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs border text-center transition-all ${
                      editEstatus === 'Inservible'
                        ? 'bg-rose-500 text-white border-rose-600 shadow-md'
                        : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    🔴 Inservible
                  </button>
                </div>
              </div>

              {/* Si está en reparación o inservible: Descripción de Daño */}
              {(editEstatus === 'En Reparacion' || editEstatus === 'Inservible') && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                    <Wrench className="w-4 h-4" />
                    <span>Reporte de Mantenimiento / Daño Físico</span>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Describe el fallo (ej. cerradura rota, bisagra desprendida, sin puerta...)"
                    value={editDescripcionDano}
                    onChange={(e) => setEditDescripcionDano(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-white dark:bg-zinc-800 border border-amber-500/30 text-xs focus:ring-2 focus:ring-amber-500 text-zinc-900 dark:text-white"
                  />
                </div>
              )}

              {/* Asignación de Trabajador (si es Asignado o Disponible) */}
              {(editEstatus === 'Asignado' || editEstatus === 'Disponible') && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Trabajador Titular
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditEsNuevoTrabajador(!editEsNuevoTrabajador)}
                      className="text-xs font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {editEsNuevoTrabajador ? 'Seleccionar del Catálogo RH' : '+ Captura Manual / QR'}
                    </button>
                  </div>

                  {!editEsNuevoTrabajador ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            placeholder="Buscar sindicalizado o ficha..."
                            value={filtroEmpleadoModal}
                            onChange={(e) => setFiltroEmpleadoModal(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                          />
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-zinc-500 select-none cursor-pointer">
                          <input
                            type="checkbox"
                            checked={soloBeneficio}
                            onChange={(e) => setSoloBeneficio(e.target.checked)}
                            className="rounded text-amber-500 focus:ring-amber-400"
                          />
                          <span>Solo Planta Beneficio</span>
                        </label>
                      </div>

                      <select
                        value={editIdEmpleado}
                        onChange={(e) => {
                          setEditIdEmpleado(e.target.value)
                          if (e.target.value) {
                            setEditEstatus('Asignado')
                            const empObj = empleados.find(x => x.id_empleado === e.target.value)
                            if (empObj?.telefono && !editTelefonoContacto) {
                              setEditTelefonoContacto(empObj.telefono)
                            }
                          }
                        }}
                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-medium text-zinc-900 dark:text-white"
                      >
                        <option value="">-- Sin Trabajador Asignado --</option>
                        {empleadosFiltrados.map(emp => (
                          <option key={emp.id_empleado} value={emp.id_empleado}>
                            #{emp.numero_empleado} - {emp.apellido_paterno} {emp.apellido_materno || ''} {emp.nombre} ({emp.puesto || emp.departamento})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                        Datos capturados manualmente o por autorregistro QR:
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <input
                            type="text"
                            placeholder="Nombre Completo del Trabajador"
                            value={editNombreProvisional}
                            onChange={(e) => setEditNombreProvisional(e.target.value)}
                            className="w-full p-2 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white font-bold"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="Ficha #"
                            value={editNumEmpleadoProvisional}
                            onChange={(e) => setEditNumEmpleadoProvisional(e.target.value)}
                            className="w-full p-2 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white font-mono"
                          />
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="Puesto / Categoría (ej. Operador de Molinos)"
                        value={editPuestoProvisional}
                        onChange={(e) => setEditPuestoProvisional(e.target.value)}
                        className="w-full p-2 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                      />
                    </div>
                  )}

                  {/* Teléfono del trabajador para aviso WhatsApp */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                        Teléfono / WhatsApp del Trabajador
                      </label>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
                        <input
                          type="tel"
                          placeholder="10 dígitos (ej. 6181234567)"
                          value={editTelefonoContacto}
                          onChange={(e) => setEditTelefonoContacto(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-mono text-zinc-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                        ¿Dejará Copia de Llave en RH?
                      </label>
                      <select
                        value={editDejaLlaveRh}
                        onChange={(e) => setEditDejaLlaveRh(e.target.value as any)}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-bold text-zinc-900 dark:text-white"
                      >
                        <option value="Si">✅ Sí, dejará copia de llave en RH</option>
                        <option value="Ya Entregada">🏛️ Ya entregó copia de llave en RH</option>
                        <option value="No">❌ No deja copia de llave</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Control de Llave / Cerradura */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Condición de Llave / Candado
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['Tiene Llave', 'Candado Personal', 'Sin Llave', 'Copia en RH'].map(tipo => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setEditCondicionLlave(tipo)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                        editCondicionLlave === tipo
                          ? 'bg-zinc-900 text-amber-400 border-amber-500 dark:bg-zinc-800'
                          : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {tipo}
                    </button>
                  ))}
                </div>

                <div className="pt-1">
                  <input
                    type="text"
                    placeholder="Número o código grabado en la llave / candado (opcional)"
                    value={editNumeroLlave}
                    onChange={(e) => setEditNumeroLlave(e.target.value)}
                    className="w-full p-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              {/* ================================================================= */}
              {/* SECCIÓN DE RESGUARDO OFICIAL Y NOTIFICACIÓN AL TRABAJADOR         */}
              {/* ================================================================= */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border-2 border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSignature className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-100">
                      Control de Resguardo y Firma en RH
                    </span>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      editEstatusResguardo === 'Firmado'
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {editEstatusResguardo === 'Firmado' ? '✅ Resguardo Firmado' : '⏳ Pendiente Firma en RH'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Botón para que RH firme e imprima el resguardo */}
                  <button
                    type="button"
                    onClick={() => setIsResguardoModalOpen(true)}
                    className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
                  >
                    <FileSignature className="w-4 h-4" />
                    <span>✍️ Firmar / Imprimir Resguardo Oficial</span>
                  </button>

                  {/* Botón para enviar mensaje al trabajador para que pase a RH a firmar */}
                  <button
                    type="button"
                    onClick={handleEnviarWhatsAppAviso}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>📲 Avisar que pase a RH a firmar</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <button
                    type="button"
                    onClick={handleCopiarMensajeAviso}
                    className="text-zinc-500 hover:text-zinc-800 dark:hover:text-white flex items-center gap-1 font-semibold"
                  >
                    {copiedNotice ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedNotice ? '¡Mensaje copiado al portapapeles!' : 'Copiar texto del aviso para el trabajador'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEditEstatusResguardo(
                        editEstatusResguardo === 'Firmado' ? 'Pendiente Firma en RH' : 'Firmado'
                      )
                    }
                    className="text-amber-600 dark:text-amber-400 font-bold underline"
                  >
                    {editEstatusResguardo === 'Firmado' ? 'Marcar como Pendiente' : 'Marcar como Firmado'}
                  </button>
                </div>
              </div>

              {/* Observaciones generales */}
              <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Observaciones / Notas
                </label>
                <input
                  type="text"
                  placeholder="Ej. Comparte casillero con turno nocturno, llave entregada..."
                  value={editObservaciones}
                  onChange={(e) => setEditObservaciones(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                />
              </div>
            </div>

            {/* Footer Modal Acciones */}
            <div className="p-4 bg-slate-50 dark:bg-zinc-800/80 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              {(selectedCasillero.id_empleado || selectedCasillero.nombre_provisional) ? (
                <button
                  type="button"
                  onClick={handleLiberarCasillero}
                  disabled={saving}
                  className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-xs transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Liberar Casillero
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-semibold text-xs hover:bg-slate-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleGuardarCasillero()}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all shadow-md flex items-center gap-1.5 active:scale-95"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL E IMPRESIÓN DE CARTA DE RESGUARDO OFICIAL (FIRMA RH Y TITULAR)  */}
      {/* ===================================================================== */}
      {isResguardoModalOpen && selectedCasillero && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto print:static print:p-0 print:bg-white">
          <div className="bg-white text-zinc-900 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden my-8 print:my-0 print:shadow-none print:rounded-none">
            {/* Barra superior de acciones del Resguardo (Oculta en Impresión) */}
            <div className="print:hidden px-6 py-4 bg-zinc-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <FileSignature className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-black text-sm uppercase">
                    Formato Oficial de Resguardo · Casillero {selectedCasillero.codigo_casillero}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Firma digitalmente como RH, valida la firma del trabajador o imprime la hoja responsiva.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfirmarFirmaResguardoRH}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs flex items-center gap-1.5 shadow-md"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{saving ? 'Guardando...' : '✅ Autorizar y Guardar Resguardo'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs flex items-center gap-1.5 shadow-md"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Hoja</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsResguardoModalOpen(false)}
                  className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* DOCUMENTO OFICIAL DE RESGUARDO (IMPRIMIBLE) */}
            <div className="p-6 sm:p-8 space-y-5 text-zinc-900">
              {/* Encabezado */}
              <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">
                    MINAS DE BACIS, S.A. DE C.V. · DEPARTAMENTO DE RECURSOS HUMANOS
                  </span>
                  <h2 className="text-xl font-black uppercase text-zinc-950 mt-0.5">
                    CARTA DE RESGUARDO Y RESPONSIVA DE CASILLERO (LOCKER)
                  </h2>
                  <p className="text-xs font-bold text-zinc-600">
                    ÁREA: PLANTA DE BENEFICIO · VESTIDOR DE PERSONAL
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">FOLIO OFICIAL</span>
                  <span className="font-mono font-black text-sm border-2 border-zinc-900 px-2.5 py-1 rounded inline-block mt-0.5">
                    {editFolioResguardo}
                  </span>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Fecha: {new Date().toLocaleDateString('es-MX')}
                  </p>
                </div>
              </div>

              {/* Tabla de Datos del Casillero y del Trabajador */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-50 p-4 rounded-xl border border-zinc-300 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">Código de Casillero</span>
                  <span className="font-mono font-black text-xl text-zinc-950">{selectedCasillero.codigo_casillero}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">Posición / Nivel</span>
                  <span className="font-black text-sm text-zinc-900">{selectedCasillero.posicion_nivel}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">Condición Cerradura</span>
                  <span className="font-bold text-zinc-900">
                    {editCondicionLlave} {editNumeroLlave ? `(#${editNumeroLlave})` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">¿Deja Copia Llave en RH?</span>
                  <span className="font-black text-zinc-950 uppercase">
                    {editDejaLlaveRh === 'Si' ? 'SÍ DEJA COPIA EN RH' : editDejaLlaveRh === 'Ya Entregada' ? 'COPIA ENTREGADA EN RH' : 'NO DEJA COPIA'}
                  </span>
                </div>

                <div className="col-span-2 pt-2 border-t border-zinc-200">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">Trabajador Responsable (Titular)</span>
                  <span className="font-black text-sm text-zinc-950 uppercase">
                    {(() => {
                      const empObj = empleados.find(e => e.id_empleado === editIdEmpleado) || selectedCasillero.empleados
                      if (!editEsNuevoTrabajador && empObj) {
                        return `${empObj.apellido_paterno} ${empObj.apellido_materno || ''} ${empObj.nombre}`
                      }
                      return editNombreProvisional || '____________________________________'
                    })()}
                  </span>
                </div>

                <div className="pt-2 border-t border-zinc-200">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">Núm. Ficha / Nómina</span>
                  <span className="font-mono font-black text-sm text-zinc-900">
                    #{(() => {
                      const empObj = empleados.find(e => e.id_empleado === editIdEmpleado) || selectedCasillero.empleados
                      if (!editEsNuevoTrabajador && empObj) return empObj.numero_empleado
                      return editNumEmpleadoProvisional || '______'
                    })()}
                  </span>
                </div>

                <div className="pt-2 border-t border-zinc-200">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">Teléfono / Contacto</span>
                  <span className="font-mono font-bold text-zinc-900">
                    {editTelefonoContacto || 'No registrado'}
                  </span>
                </div>
              </div>

              {/* Cláusulas de Resguardo */}
              <div className="text-[11px] leading-relaxed text-zinc-700 space-y-1.5 border border-zinc-200 rounded-xl p-4 bg-white">
                <p className="font-black text-zinc-900 uppercase text-xs mb-1">
                  TÉRMINOS Y COMPROMISOS DE RESGUARDO:
                </p>
                <p>
                  <strong>1. USO PERSONAL E INTRANSFERIBLE:</strong> El trabajador recibe en calidad de préstamo y resguardo el casillero arriba descrito exclusivamente para guardar sus pertenencias personales y equipo de trabajo durante su jornada laboral.
                </p>
                <p>
                  <strong>2. LLAVE Y ACCESO:</strong> El titular declara que la condición de acceso es <strong>{editCondicionLlave}</strong> y respecto al duplicado de llave en Recursos Humanos: <strong>{editDejaLlaveRh === 'Si' ? 'SE COMPROMETE A DEJAR COPIA EN RH' : editDejaLlaveRh === 'Ya Entregada' ? 'ENTREGÓ COPIA EN RH' : 'NO DEJA COPIA EN RH'}</strong>. En caso de baja o cambio de área, deberá entregar el casillero vacío y limpio.
                </p>
                <p>
                  <strong>3. HIGIENE Y SEGURIDAD:</strong> Queda estrictamente prohibido almacenar alimentos perecederos, sustancias peligrosas, herramientas de la empresa no autorizadas o alterar la estructura y cerradura sin autorización de Recursos Humanos.
                </p>
              </div>

              {/* Sección de Firmas (Trabajador y Recursos Humanos) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                {/* Firma del Trabajador */}
                <div className="border-2 border-zinc-300 rounded-xl p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase text-zinc-600">
                      1. Firma de Conformidad del Trabajador
                    </span>
                    {firmaTrabajadorActual && (
                      <button
                        type="button"
                        onClick={() => limpiarCanvas(empCanvasRef.current, setFirmaTrabajadorActual)}
                        className="print:hidden text-[10px] text-rose-600 font-bold underline"
                      >
                        Borrar y volver a firmar
                      </button>
                    )}
                  </div>

                  {firmaTrabajadorActual ? (
                    <div className="h-24 flex items-center justify-center bg-white border border-zinc-200 rounded-lg p-1">
                      <img src={firmaTrabajadorActual} alt="Firma trabajador" className="max-h-full object-contain" />
                    </div>
                  ) : (
                    <div className="bg-zinc-50 border border-dashed border-zinc-400 rounded-lg p-1">
                      <canvas
                        ref={empCanvasRef}
                        width={300}
                        height={90}
                        onMouseDown={(e) => iniciarTrazoCanvas(empCanvasRef.current, e, setDrawingEmp)}
                        onMouseMove={(e) => dibujarTrazoCanvas(empCanvasRef.current, drawingEmp, e)}
                        onMouseUp={() => setDrawingEmp(false)}
                        onMouseLeave={() => setDrawingEmp(false)}
                        onTouchStart={(e) => iniciarTrazoCanvas(empCanvasRef.current, e, setDrawingEmp)}
                        onTouchMove={(e) => dibujarTrazoCanvas(empCanvasRef.current, drawingEmp, e)}
                        onTouchEnd={() => setDrawingEmp(false)}
                        className="w-full h-[90px] touch-none cursor-crosshair bg-white rounded"
                      />
                    </div>
                  )}

                  <div className="text-center border-t border-zinc-400 mt-2 pt-1">
                    <p className="text-[10px] font-black uppercase text-zinc-900">
                      Nombre y Firma del Trabajador Titular
                    </p>
                    <p className="text-[9px] text-zinc-500">Recibí casillero de conformidad</p>
                  </div>
                </div>

                {/* Firma de Recursos Humanos ("para mí firmar un resguardo") */}
                <div className="border-2 border-zinc-900 rounded-xl p-3 flex flex-col justify-between bg-amber-50/30 print:bg-white">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase text-zinc-900">
                      2. Firma de Autorización Recursos Humanos
                    </span>
                    <div className="print:hidden flex items-center gap-2">
                      {savedRhSig && !firmaRhActual && (
                        <button
                          type="button"
                          onClick={() => setFirmaRhActual(savedRhSig)}
                          className="text-[10px] bg-amber-500 text-zinc-950 px-2 py-0.5 rounded font-black"
                        >
                          Usar mi firma guardada
                        </button>
                      )}
                      {firmaRhActual && (
                        <button
                          type="button"
                          onClick={() => limpiarCanvas(rhCanvasRef.current, setFirmaRhActual)}
                          className="text-[10px] text-rose-600 font-bold underline"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                  </div>

                  {firmaRhActual ? (
                    <div className="h-24 flex items-center justify-center bg-white border border-zinc-300 rounded-lg p-1">
                      <img src={firmaRhActual} alt="Firma RH" className="max-h-full object-contain" />
                    </div>
                  ) : (
                    <div className="bg-white border border-dashed border-zinc-400 rounded-lg p-1">
                      <canvas
                        ref={rhCanvasRef}
                        width={300}
                        height={90}
                        onMouseDown={(e) => iniciarTrazoCanvas(rhCanvasRef.current, e, setDrawingRh)}
                        onMouseMove={(e) => dibujarTrazoCanvas(rhCanvasRef.current, drawingRh, e)}
                        onMouseUp={() => setDrawingRh(false)}
                        onMouseLeave={() => setDrawingRh(false)}
                        onTouchStart={(e) => iniciarTrazoCanvas(rhCanvasRef.current, e, setDrawingRh)}
                        onTouchMove={(e) => dibujarTrazoCanvas(rhCanvasRef.current, drawingRh, e)}
                        onTouchEnd={() => setDrawingRh(false)}
                        className="w-full h-[90px] touch-none cursor-crosshair bg-white rounded"
                      />
                    </div>
                  )}

                  <div className="text-center border-t border-zinc-800 mt-2 pt-1">
                    <input
                      type="text"
                      value={nombreRhAutoriza}
                      onChange={(e) => setNombreRhAutoriza(e.target.value)}
                      className="w-full text-center text-[10px] font-black uppercase text-zinc-900 bg-transparent focus:outline-none"
                    />
                    <p className="text-[9px] text-zinc-500">Validación de Resguardo y Control de Llaves RH</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
