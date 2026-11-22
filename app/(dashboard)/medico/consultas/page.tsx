'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import {
  COFEPRIS_EMISORES_AUTORIZADOS,
  COFEPRIS_FIELD_CATALOG,
  FORMAS_FARMACEUTICAS_COFEPRIS,
  VIAS_ADMINISTRACION_COFEPRIS,
  type CofeprisEmisorCategoriaId,
  type CofeprisMedicationItem,
  type CofeprisRecetaTemplateConfig,
  type ConsultaCofeprisPayload,
  type DoctorCofeprisProfile,
  loadCofeprisRecetaConfig,
  saveCofeprisRecetaConfig,
  applyCofeprisPreset,
  loadDoctorProfiles,
  saveDoctorProfile,
  getActiveDoctorId,
  setActiveDoctorId,
  encodeConsultaDiagnosticoWithCofepris,
  decodeConsultaCofeprisMeta,
  saveConsultaCofeprisMetaLocal,
  calcularIMC,
  buildCofeprisRecetaHtml,
} from '@/utils/cofeprisRecetaConfig'
import {
  Plus,
  Printer,
  Stethoscope,
  Pill,
  CheckCircle,
  SlidersHorizontal,
  PenTool,
  X,
  Upload,
  Eye,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
} from 'lucide-react'

const EMPTY_MED_ITEM = (): CofeprisMedicationItem => ({
  id_medicamento: '',
  nombre_generico: '',
  nombre_comercial: '',
  forma_farmaceutica: 'Tableta',
  dosis: '500 mg (1 unidad)',
  presentacion: '',
  frecuencia: 'Cada 8 horas',
  via_administracion: 'Oral (VO)',
  duracion_tratamiento: 'Por 5 días',
  indicaciones_uso: 'Tomar después de los alimentos con abundante agua.',
  cantidad: 1,
  costo_unitario: 0,
})

export default function ConsultasPage() {
  const { profile, realProfile } = useAuth()
  const [consultas, setConsultas] = useState<any[]>([])
  const [pacientes, setPacientes] = useState<any[]>([])
  const [medicamentosCat, setMedicamentosCat] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [savingConsulta, setSavingConsulta] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [filterPatientName, setFilterPatientName] = useState('')
  const [logoBase64, setLogoBase64] = useState<string | null>(null)

  // Perfiles de Doctores y Configurador COFEPRIS del Dr. Principal
  const [doctorProfiles, setDoctorProfiles] = useState<DoctorCofeprisProfile[]>([])
  const [activeDoctorId, setActiveDocIdState] = useState<string>('')
  const [recetaConfig, setRecetaConfig] = useState<CofeprisRecetaTemplateConfig>(() =>
    loadCofeprisRecetaConfig()
  )

  // Modales rápidos en Consultas
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showDoctorModal, setShowDoctorModal] = useState(false)
  const [editingDoctor, setEditingDoctor] = useState<DoctorCofeprisProfile | null>(null)
  const [previewHtmlModal, setPreviewHtmlModal] = useState<string | null>(null)

  // Canvas de firma dentro del modal rápido
  const sigCanvasRef = useRef<HTMLCanvasElement>(null)
  const sigUploadRef = useRef<HTMLInputElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSigDraft, setHasSigDraft] = useState(false)
  const [inkColor, setInkColor] = useState<'#0f172a' | '#1d4ed8'>('#0f172a')

  const [formData, setFormData] = useState({
    id_paciente: '',
    paciente_nombre_libre: '',
    edad: '',
    sexo: 'Masculino',
    alergias: 'Negadas',
    talla: '',
    peso: '',
    imc: '',
    temperatura: '36.6',
    presion_arterial: '120/80',
    diagnostico: '',
    costo_consulta: 0,
    acompanante: '',
    medicamentos_recetados: [EMPTY_MED_ITEM()] as CofeprisMedicationItem[],
  })

  const sessionProfile = realProfile || profile

  useEffect(() => {
    fetchConsultas()
    fetchCatalogos()
    setRecetaConfig(loadCofeprisRecetaConfig())
  }, [])

  useEffect(() => {
    const docs = loadDoctorProfiles(sessionProfile)
    setDoctorProfiles(docs)
    const savedId = getActiveDoctorId()
    const match =
      docs.find((d) => d.id === savedId) ||
      docs.find((d) => d.id === sessionProfile?.id) ||
      docs[0]
    if (match) {
      setActiveDocIdState(match.id)
    }
  }, [sessionProfile?.id])

  const activeDoctor =
    doctorProfiles.find((d) => d.id === activeDoctorId) ||
    doctorProfiles[0] || {
      id: sessionProfile?.id || 'default-doc',
      nombre_completo: sessionProfile?.nombre_completo || 'Médico Prescriptor',
      categoria_emisor: 'I' as CofeprisEmisorCategoriaId,
      cedula_profesional: (sessionProfile as any)?.cedula_profesional || '',
      institucion_titulo: (sessionProfile as any)?.universidad || '',
      especialidad: (sessionProfile as any)?.especialidad || 'Medicina General',
      domicilio_consultorio:
        (sessionProfile as any)?.domicilio_consultorio || 'Consultorio Médico',
      telefono_consultorio: (sessionProfile as any)?.telefono_consultorio || '',
      firma_base64: (sessionProfile as any)?.firma || '',
    }

  const fetchCatalogos = async () => {
    const { data: pData } = await supabase.from('pacientes').select('*').order('nombre_completo')
    if (pData) setPacientes(pData)

    const { data: mData } = await supabase.from('cat_medicamentos').select('*').order('nombre')
    if (mData) setMedicamentosCat(mData)

    const { data: configData } = await supabase
      .from('configuracion_empresa')
      .select('logo_base64')
      .single()
    if (configData?.logo_base64) setLogoBase64(configData.logo_base64)
  }

  const fetchConsultas = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('consultas_medicas')
      .select(`
        *,
        pacientes (nombre_completo, es_poblacion_general, parentesco, acompanante, fecha_nacimiento)
      `)
      .order('fecha', { ascending: false })

    if (error) {
      const fallback = await supabase
        .from('consultas_medicas')
        .select(`
          *,
          pacientes (nombre_completo, es_poblacion_general, parentesco)
        `)
        .order('fecha', { ascending: false })
      if (fallback.data) setConsultas(fallback.data)
    } else if (data) {
      setConsultas(data)
    }
    setLoading(false)
  }

  const handleAddMedicamento = () => {
    setFormData((prev) => ({
      ...prev,
      medicamentos_recetados: [...prev.medicamentos_recetados, EMPTY_MED_ITEM()],
    }))
  }

  const inferFormaFarmaceutica = (presentacion?: string): string => {
    const lower = (presentacion || '').toLowerCase()
    if (lower.includes('cáps') || lower.includes('caps')) return 'Cápsula'
    if (lower.includes('jarabe')) return 'Jarabe'
    if (lower.includes('susp')) return 'Suspensión Oral'
    if (lower.includes('inyec') || lower.includes('amp')) return 'Solución Inyectable'
    if (lower.includes('crema') || lower.includes('pomada')) return 'Crema / Pomada'
    if (lower.includes('gotas')) return 'Gotas Oftálmicas'
    if (lower.includes('gel')) return 'Gel Tópico'
    if (lower.includes('sobre')) return 'Polvo / Sobre'
    return 'Tableta'
  }

  const updateMedicamento = (index: number, field: keyof CofeprisMedicationItem, value: any) => {
    const newMed = [...formData.medicamentos_recetados]
    newMed[index] = { ...newMed[index], [field]: value }

    if (field === 'id_medicamento') {
      const med = medicamentosCat.find((m) => m.id_medicamento === value)
      const pac = pacientes.find((p) => p.id_paciente === formData.id_paciente)
      if (med) {
        newMed[index].nombre_generico = (med.sustancia_activa || med.nombre || '').toUpperCase()
        newMed[index].nombre_comercial = med.nombre || ''
        newMed[index].presentacion = med.presentacion || 'Presentación estándar'
        newMed[index].forma_farmaceutica = inferFormaFarmaceutica(med.presentacion)
        if (med.descripcion) {
          newMed[index].indicaciones_uso = med.descripcion
        }
        newMed[index].costo_unitario = pac?.es_poblacion_general ? med.precio_venta || 0 : 0
      } else {
        newMed[index].costo_unitario = 0
      }
    }

    setFormData({ ...formData, medicamentos_recetados: newMed })
  }

  const handleWeightOrHeightChange = (field: 'peso' | 'talla', val: string) => {
    const nextPeso = field === 'peso' ? val : formData.peso
    const nextTalla = field === 'talla' ? val : formData.talla
    const autoImc = calcularIMC(nextPeso, nextTalla)
    setFormData((prev) => ({
      ...prev,
      [field]: val,
      imc: autoImc || prev.imc,
    }))
  }

  const handlePacienteChange = (val: string) => {
    const pac = pacientes.find((p) => p.id_paciente === val)
    let calcEdad = ''
    if (pac?.fecha_nacimiento) {
      const birth = new Date(pac.fecha_nacimiento)
      const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 86400000))
      if (age >= 0 && age <= 120) calcEdad = `${age} años`
    }
    setFormData((prev) => ({
      ...prev,
      id_paciente: val,
      paciente_nombre_libre: pac ? pac.nombre_completo : prev.paciente_nombre_libre,
      edad: calcEdad || prev.edad,
      acompanante: pac?.acompanante || '',
      costo_consulta: pac?.es_poblacion_general ? 200 : 0,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingConsulta(true)
    try {
      let resolvedPatientId: string | null = formData.id_paciente || null

      // Si es un paciente abierto escrito libremente sin registro previo, creamos registro en `pacientes` como Público General
      if (!resolvedPatientId && formData.paciente_nombre_libre.trim()) {
        const { data: createdPac } = await supabase
          .from('pacientes')
          .insert([
            {
              nombre_completo: formData.paciente_nombre_libre.trim().toUpperCase(),
              es_poblacion_general: true,
              activo: true,
            },
          ])
          .select()
          .single()
        if (createdPac?.id_paciente) {
          resolvedPatientId = createdPac.id_paciente
        }
      }

      const validMeds = formData.medicamentos_recetados.filter(
        (m) => m.nombre_generico.trim() || m.id_medicamento
      )

      const cofeprisPayload: ConsultaCofeprisPayload = {
        paciente_nombre_libre: formData.paciente_nombre_libre.trim().toUpperCase(),
        edad: formData.edad,
        sexo: formData.sexo,
        alergias: formData.alergias,
        talla: formData.talla,
        peso: formData.peso,
        imc: formData.imc || calcularIMC(formData.peso, formData.talla),
        temperatura: formData.temperatura,
        presion_arterial: formData.presion_arterial,
        diagnostico_limpio: formData.diagnostico,
        doctor_snapshot: activeDoctor,
        medicamentos: validMeds,
      }

      const diagFinal = encodeConsultaDiagnosticoWithCofepris(
        formData.diagnostico,
        cofeprisPayload
      )

      const { data: consultaData, error: consultaError } = await supabase
        .from('consultas_medicas')
        .insert([
          {
            id_paciente: resolvedPatientId,
            diagnostico: diagFinal,
            costo_consulta: formData.costo_consulta,
            medico_id: sessionProfile?.id || profile?.id || null,
          },
        ])
        .select()

      if (consultaError) throw consultaError

      if (consultaData && consultaData.length > 0) {
        const idConsulta = consultaData[0].id_consulta
        saveConsultaCofeprisMetaLocal(idConsulta, cofeprisPayload)

        const catalogMeds = validMeds.filter((m) => Boolean(m.id_medicamento))
        if (catalogMeds.length > 0) {
          const dispPayloadWithDosis = catalogMeds.map((med) => ({
            id_consulta: idConsulta,
            id_medicamento: med.id_medicamento,
            cantidad: med.cantidad || 1,
            costo_unitario: med.costo_unitario || 0,
            costo_total: (med.cantidad || 1) * (med.costo_unitario || 0),
            dosis: `${med.dosis} · ${med.frecuencia} · ${med.via_administracion} · ${med.duracion_tratamiento}`.toUpperCase(),
          }))
          const { error: dispErr } = await supabase
            .from('dispensacion_medicamentos')
            .insert(dispPayloadWithDosis)
          if (dispErr) {
            // Fallback sin columna `dosis` si la BD base no la tiene
            const dispBasic = catalogMeds.map((med) => ({
              id_consulta: idConsulta,
              id_medicamento: med.id_medicamento,
              cantidad: med.cantidad || 1,
              costo_unitario: med.costo_unitario || 0,
              costo_total: (med.cantidad || 1) * (med.costo_unitario || 0),
            }))
            await supabase.from('dispensacion_medicamentos').insert(dispBasic)
          }
        }

        if (resolvedPatientId && formData.acompanante.trim()) {
          await supabase
            .from('pacientes')
            .update({ acompanante: formData.acompanante.trim().toUpperCase() })
            .eq('id_paciente', resolvedPatientId)
        }
      }

      setShowForm(false)
      setFormData({
        id_paciente: '',
        paciente_nombre_libre: '',
        edad: '',
        sexo: 'Masculino',
        alergias: 'Negadas',
        talla: '',
        peso: '',
        imc: '',
        temperatura: '36.6',
        presion_arterial: '120/80',
        diagnostico: '',
        costo_consulta: 0,
        acompanante: '',
        medicamentos_recetados: [EMPTY_MED_ITEM()],
      })
      setFilterPatientName('')
      await fetchConsultas()
      await fetchCatalogos()
    } catch (err: any) {
      alert('Error al guardar consulta: ' + err.message)
    } finally {
      setSavingConsulta(false)
    }
  }

  const resolveRecetaHtmlForConsulta = async (consulta: any, autoPrintScript: boolean) => {
    const { cleanDiagnostico, meta } = decodeConsultaCofeprisMeta(
      consulta.id_consulta,
      consulta.diagnostico
    )

    // 1. Obtener dispensación de BD como respaldo
    const { data: dispensacion } = await supabase
      .from('dispensacion_medicamentos')
      .select('*, cat_medicamentos(nombre, presentacion, sustancia_activa, descripcion)')
      .eq('id_consulta', consulta.id_consulta)

    // 2. Resolver médico prescriptor con su firma real
    let prescriptorDoc: DoctorCofeprisProfile = activeDoctor
    if (meta?.doctor_snapshot?.id) {
      const localMatch = doctorProfiles.find((d) => d.id === meta.doctor_snapshot?.id)
      if (localMatch) {
        prescriptorDoc = localMatch
      } else {
        prescriptorDoc = {
          ...activeDoctor,
          ...meta.doctor_snapshot,
          firma_base64:
            meta.doctor_snapshot.firma_base64 &&
            meta.doctor_snapshot.firma_base64 !== '__HAS_SIG__'
              ? meta.doctor_snapshot.firma_base64
              : activeDoctor.firma_base64,
        }
      }
    } else if (consulta.medico_id) {
      const localMatch = doctorProfiles.find((d) => d.id === consulta.medico_id)
      if (localMatch) {
        prescriptorDoc = localMatch
      } else {
        const { data: docDb } = await supabase
          .from('perfiles')
          .select('*')
          .eq('id', consulta.medico_id)
          .maybeSingle()
        if (docDb) {
          prescriptorDoc = {
            id: docDb.id,
            nombre_completo: docDb.nombre_completo || activeDoctor.nombre_completo,
            categoria_emisor: 'I',
            cedula_profesional: docDb.cedula_profesional || '',
            institucion_titulo: docDb.universidad || '',
            especialidad: docDb.especialidad || '',
            domicilio_consultorio: docDb.domicilio_consultorio || '',
            telefono_consultorio: docDb.telefono_consultorio || '',
            firma_base64: docDb.firma || '',
          }
        }
      }
    }

    // 3. Medicamentos combinados
    const medsList: CofeprisMedicationItem[] =
      meta?.medicamentos && meta.medicamentos.length > 0
        ? meta.medicamentos
        : (dispensacion || []).map((item: any) => {
            const m = item.cat_medicamentos || {}
            return {
              id_medicamento: item.id_medicamento,
              nombre_generico: (m.sustancia_activa || m.nombre || 'MEDICAMENTO').toUpperCase(),
              nombre_comercial: m.nombre && m.sustancia_activa ? m.nombre : '',
              forma_farmaceutica: inferFormaFarmaceutica(m.presentacion),
              dosis: item.dosis || 'Según indicación médica',
              presentacion: m.presentacion || 'Presentación estándar',
              frecuencia: 'Según esquema indicado',
              via_administracion: 'Oral (VO)',
              duracion_tratamiento: 'Según evolución clínica',
              indicaciones_uso: item.dosis || m.descripcion || 'Tomar según prescripción médica.',
              cantidad: item.cantidad || 1,
              costo_unitario: item.costo_unitario || 0,
            }
          })

    const formattedFecha = new Date(consulta.fecha || Date.now()).toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const fechaCorta = new Date(consulta.fecha || Date.now()).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

    const pacienteNombre = (
      meta?.paciente_nombre_libre ||
      consulta.pacientes?.nombre_completo ||
      'PACIENTE REGISTRADO'
    ).toUpperCase()

    const categoriaPaciente = consulta.pacientes
      ? consulta.pacientes.es_poblacion_general
        ? 'ATENCIÓN EXTERNA / FORMATO ABIERTO'
        : `TRABAJADOR / BENEFICIARIO (${consulta.pacientes.parentesco || 'TITULAR'})`
      : 'FORMATO ABIERTO'

    const folioReceta = `REC-${(consulta.id_consulta || '').toString().slice(0, 8).toUpperCase()}`

    return buildCofeprisRecetaHtml({
      cfg: loadCofeprisRecetaConfig(),
      doctor: prescriptorDoc,
      folio: folioReceta,
      fechaTexto: formattedFecha,
      fechaCorta,
      paciente: {
        nombre_completo: pacienteNombre,
        categoria_etiqueta: categoriaPaciente,
        acompanante: consulta.pacientes?.acompanante || '',
        edad: meta?.edad || '',
        sexo: meta?.sexo || '',
        alergias: meta?.alergias || '',
        talla: meta?.talla || '',
        peso: meta?.peso || '',
        imc: meta?.imc || '',
        temperatura: meta?.temperatura || '',
        presion_arterial: meta?.presion_arterial || '',
        diagnostico: cleanDiagnostico || 'Valoración médica general',
      },
      medicamentos: medsList,
      logoBase64,
      autoPrintScript,
    })
  }

  const handlePrintReceta = async (consulta: any) => {
    const html = await resolveRecetaHtmlForConsulta(consulta, true)
    const printWindow = window.open('', '_blank', 'width=920,height=1150')
    if (!printWindow) {
      setPreviewHtmlModal(html)
      return
    }
    printWindow.document.write(html)
    printWindow.document.close()
  }

  const handlePreviewReceta = async (consulta: any) => {
    const html = await resolveRecetaHtmlForConsulta(consulta, false)
    setPreviewHtmlModal(html)
  }

  // Helpers rápidos para Firma en Modal de Doctor
  const getSigPos = (e: any) => {
    const canvas = sigCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * (canvas.width / (rect.width || 1)),
      y: (clientY - rect.top) * (canvas.height / (rect.height || 1)),
    }
  }

  const startSigDraw = (e: any) => {
    const canvas = sigCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = inkColor
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const pos = getSigPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setIsDrawing(true)
  }

  const sigDrawMove = (e: any) => {
    if (!isDrawing) return
    const canvas = sigCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = getSigPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    setHasSigDraft(true)
  }

  const clearSigCanvas = () => {
    const canvas = sigCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSigDraft(false)
  }

  const handleSaveDoctorQuickModal = async () => {
    if (!editingDoctor) return
    let nextFirma = editingDoctor.firma_base64
    if (hasSigDraft && sigCanvasRef.current) {
      nextFirma = sigCanvasRef.current.toDataURL('image/png')
    }
    const updated: DoctorCofeprisProfile = {
      ...editingDoctor,
      firma_base64: nextFirma,
    }
    const nextList = saveDoctorProfile(updated)
    setDoctorProfiles(nextList)
    setActiveDocIdState(updated.id)
    setActiveDoctorId(updated.id)

    if (sessionProfile?.id && updated.id === sessionProfile.id) {
      await supabase
        .from('perfiles')
        .update({
          cedula_profesional: updated.cedula_profesional,
          universidad: updated.institucion_titulo,
          especialidad: updated.especialidad,
          domicilio_consultorio: updated.domicilio_consultorio,
          telefono_consultorio: updated.telefono_consultorio,
          firma: nextFirma || null,
        })
        .eq('id', sessionProfile.id)
    }

    setHasSigDraft(false)
    setShowDoctorModal(false)
  }

  const handleUpdateTemplateConfig = (next: CofeprisRecetaTemplateConfig) => {
    setRecetaConfig(next)
    saveCofeprisRecetaConfig(next)
  }

  const filteredPacientes = pacientes.filter((p) =>
    (p.nombre_completo || '').toLowerCase().includes(filterPatientName.toLowerCase())
  )

  const emisorActual =
    COFEPRIS_EMISORES_AUTORIZADOS.find((e) => e.id === activeDoctor.categoria_emisor) ||
    COFEPRIS_EMISORES_AUTORIZADOS[0]

  return (
    <div className="space-y-6 pb-20">
      {/* HEADER PRINCIPAL CON BARRA DE DOCTOR Y CONFIGURADOR COFEPRIS */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-zinc-200 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-900 text-[10px] font-black uppercase mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Recetas Normativa Mexicana &amp; COFEPRIS · Formato Abierto Adaptable</span>
            </div>
            <h1 className="text-2xl font-black text-zinc-900 flex items-center gap-2 uppercase">
              <Stethoscope className="w-6 h-6 text-amber-500" />
              Consultas Médicas y Recetas COFEPRIS
            </h1>
            <p className="text-zinc-500 text-xs mt-0.5">
              Emisión libre conforme a COFEPRIS con firma individual por médico y campos personalizables por el Dr. Principal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingDoctor({ ...activeDoctor })
                setHasSigDraft(false)
                setShowDoctorModal(true)
              }}
              className="px-3.5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-black flex items-center gap-1.5 cursor-pointer border border-zinc-300"
            >
              <PenTool className="w-4 h-4 text-sky-700" />
              <span>Mi Firma y Perfil COFEPRIS</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTemplateModal(true)}
              className="px-3.5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-950 text-xs font-black flex items-center gap-1.5 cursor-pointer border border-indigo-200"
            >
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              <span>Campos Receta (Dr. Principal)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="bg-amber-500 text-black px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-amber-400 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{showForm ? 'Cerrar Formulario' : 'Nueva Consulta / Receta'}</span>
            </button>
          </div>
        </div>

        {/* Tira del Médico Prescriptor Activo */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-sky-700 shrink-0" />
              <span className="font-black text-zinc-700 uppercase">Prescribe:</span>
              <select
                value={activeDoctor.id}
                onChange={(e) => {
                  setActiveDocIdState(e.target.value)
                  setActiveDoctorId(e.target.value)
                }}
                className="border border-zinc-300 rounded-xl px-3 py-1.5 text-xs font-black bg-white"
              >
                {doctorProfiles.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre_completo}
                  </option>
                ))}
              </select>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-900 font-black text-[11px]">
              {emisorActual.codigo}
            </span>
            <span className="font-mono font-bold text-zinc-600 text-[11px]">
              Cédula: {activeDoctor.cedula_profesional || 'Sin capturar'}
            </span>
            {activeDoctor.firma_base64 ? (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-black text-[11px]">
                ✓ Firma Digital Lista
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingDoctor({ ...activeDoctor })
                  setShowDoctorModal(true)
                }}
                className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-black text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Sin firma guardada — Capturar ahora</span>
              </button>
            )}
          </div>

          <span className="text-[11px] font-bold text-zinc-500">
            Modo: {recetaConfig.modo_abierto_sin_membrete_empresa ? '🔓 Abierto (Sin membrete cerrado)' : '🏢 Con Logo'}
          </span>
        </div>
      </div>

      {/* FORMULARIO DE NUEVA CONSULTA Y RECETA COFEPRIS */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-3xl shadow-sm border-2 border-amber-300/70 space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-zinc-900 uppercase">
                Registrar Consulta Médica y Receta COFEPRIS
              </h2>
              <p className="text-xs text-zinc-500">
                Los campos visibles siguen la configuración activa del Dr. Principal (puedes ajustar qué aparece desde &quot;Campos Receta&quot;).
              </p>
            </div>
          </div>

          {/* BLOQUE 1: PACIENTE Y RECOMENDADOS COFEPRIS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {recetaConfig.rec_nombre_paciente && (
                <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200 space-y-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-zinc-800 uppercase">
                      Paciente del Padrón (Opcional — Formato Abierto)
                    </label>
                    <input
                      type="text"
                      placeholder="Buscar por nombre en el padrón..."
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-bold"
                      value={filterPatientName}
                      onChange={(e) => setFilterPatientName(e.target.value)}
                    />
                    <select
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-bold"
                      value={formData.id_paciente}
                      onChange={(e) => handlePacienteChange(e.target.value)}
                    >
                      <option value="">
                        -- Paciente externo / escribir nombre libre abajo ({filteredPacientes.length} en padrón) --
                      </option>
                      {filteredPacientes.map((p) => (
                        <option key={p.id_paciente} value={p.id_paciente}>
                          {p.nombre_completo} {p.es_poblacion_general ? '(Público)' : '(Trabajador/Benef)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-zinc-800 uppercase mb-1">
                      Nombre Completo del Paciente en Receta *
                    </label>
                    <input
                      type="text"
                      required={recetaConfig.rec_nombre_paciente}
                      placeholder="Ej. MARÍA FERNANDA LÓPEZ GARCÍA"
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-xs font-black uppercase"
                      value={formData.paciente_nombre_libre}
                      onChange={(e) =>
                        setFormData({ ...formData, paciente_nombre_libre: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}

              {/* Somatometría y Signos Vitales Recomendados COFEPRIS */}
              {(recetaConfig.rec_edad ||
                recetaConfig.rec_sexo ||
                recetaConfig.rec_alergias ||
                recetaConfig.rec_talla ||
                recetaConfig.rec_peso ||
                recetaConfig.rec_imc ||
                recetaConfig.rec_temperatura ||
                recetaConfig.rec_presion_arterial) && (
                <div className="bg-sky-50/50 p-4 rounded-2xl border border-sky-200 space-y-3">
                  <h3 className="text-xs font-black text-sky-950 uppercase">
                    Somatometría, Signos Vitales y Alergias (Recomendados COFEPRIS)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {recetaConfig.rec_edad && (
                      <div>
                        <label className="block text-[10px] font-black text-zinc-600 uppercase mb-1">
                          Edad
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. 32 años"
                          value={formData.edad}
                          onChange={(e) => setFormData({ ...formData, edad: e.target.value })}
                          className="w-full rounded-xl border border-zinc-300 bg-white px-2.5 py-2 text-xs font-bold"
                        />
                      </div>
                    )}
                    {recetaConfig.rec_sexo && (
                      <div>
                        <label className="block text-[10px] font-black text-zinc-600 uppercase mb-1">
                          Sexo
                        </label>
                        <select
                          value={formData.sexo}
                          onChange={(e) => setFormData({ ...formData, sexo: e.target.value })}
                          className="w-full rounded-xl border border-zinc-300 bg-white px-2.5 py-2 text-xs font-bold"
                        >
                          <option value="Masculino">Masculino</option>
                          <option value="Femenino">Femenino</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>
                    )}
                    {recetaConfig.rec_peso && (
                      <div>
                        <label className="block text-[10px] font-black text-zinc-600 uppercase mb-1">
                          Peso (kg)
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. 74.5"
                          value={formData.peso}
                          onChange={(e) => handleWeightOrHeightChange('peso', e.target.value)}
                          className="w-full rounded-xl border border-zinc-300 bg-white px-2.5 py-2 text-xs font-bold"
                        />
                      </div>
                    )}
                    {recetaConfig.rec_talla && (
                      <div>
                        <label className="block text-[10px] font-black text-zinc-600 uppercase mb-1">
                          Talla (m o cm)
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. 1.72"
                          value={formData.talla}
                          onChange={(e) => handleWeightOrHeightChange('talla', e.target.value)}
                          className="w-full rounded-xl border border-zinc-300 bg-white px-2.5 py-2 text-xs font-bold"
                        />
                      </div>
                    )}
                    {recetaConfig.rec_imc && (
                      <div>
                        <label className="block text-[10px] font-black text-zinc-600 uppercase mb-1">
                          IMC (Auto)
                        </label>
                        <input
                          type="text"
                          placeholder="kg/m²"
                          value={formData.imc}
                          onChange={(e) => setFormData({ ...formData, imc: e.target.value })}
                          className="w-full rounded-xl border border-sky-300 bg-sky-50 px-2.5 py-2 text-xs font-black text-sky-900"
                        />
                      </div>
                    )}
                    {recetaConfig.rec_temperatura && (
                      <div>
                        <label className="block text-[10px] font-black text-zinc-600 uppercase mb-1">
                          Temperatura (°C)
                        </label>
                        <input
                          type="text"
                          placeholder="36.6"
                          value={formData.temperatura}
                          onChange={(e) =>
                            setFormData({ ...formData, temperatura: e.target.value })
                          }
                          className="w-full rounded-xl border border-zinc-300 bg-white px-2.5 py-2 text-xs font-bold"
                        />
                      </div>
                    )}
                    {recetaConfig.rec_presion_arterial && (
                      <div>
                        <label className="block text-[10px] font-black text-zinc-600 uppercase mb-1">
                          Presión Arterial
                        </label>
                        <input
                          type="text"
                          placeholder="120/80"
                          value={formData.presion_arterial}
                          onChange={(e) =>
                            setFormData({ ...formData, presion_arterial: e.target.value })
                          }
                          className="w-full rounded-xl border border-zinc-300 bg-white px-2.5 py-2 text-xs font-bold"
                        />
                      </div>
                    )}
                    {recetaConfig.rec_alergias && (
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-[10px] font-black text-rose-700 uppercase mb-1">
                          Alergias
                        </label>
                        <input
                          type="text"
                          placeholder="Negadas / Penicilina..."
                          value={formData.alergias}
                          onChange={(e) => setFormData({ ...formData, alergias: e.target.value })}
                          className="w-full rounded-xl border border-rose-200 bg-white px-2.5 py-2 text-xs font-bold"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Costo de Consulta ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-bold"
                    value={formData.costo_consulta}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        costo_consulta: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Acompañante de Consulta (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. MARÍA ARREOLA (MADRE)"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-bold"
                    value={formData.acompanante}
                    onChange={(e) => setFormData({ ...formData, acompanante: e.target.value })}
                  />
                </div>
              </div>

              {recetaConfig.rec_diagnostico && (
                <div>
                  <label className="block text-xs font-black text-zinc-800 uppercase mb-1">
                    Diagnóstico Médico *
                  </label>
                  <textarea
                    required={recetaConfig.rec_diagnostico}
                    rows={3}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-xs font-bold resize-none"
                    value={formData.diagnostico}
                    onChange={(e) => setFormData({ ...formData, diagnostico: e.target.value })}
                    placeholder="Describa el diagnóstico médico clínico..."
                  />
                </div>
              )}
            </div>

            {/* BLOQUE 2: TRATAMIENTO (8 ELEMENTOS OBLIGATORIOS COFEPRIS) */}
            <div className="bg-zinc-50 p-4 sm:p-5 rounded-2xl border border-zinc-200 flex flex-col justify-between space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-200 pb-3">
                <div>
                  <h3 className="font-black text-zinc-900 text-sm uppercase flex items-center gap-2">
                    <Pill className="w-4 h-4 text-amber-500" />
                    Tratamiento Prescrito (COFEPRIS)
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Nombre genérico, forma farmacéutica, dosis, presentación, frecuencia, vía, duración e indicaciones.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddMedicamento}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black cursor-pointer shrink-0"
                >
                  + Agregar Fármaco
                </button>
              </div>

              <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                {formData.medicamentos_recetados.map((med, idx) => (
                  <div
                    key={idx}
                    className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-2">
                      <span className="text-xs font-black text-amber-700 uppercase">
                        Medicamento #{idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <select
                          className="rounded-lg border border-zinc-300 text-xs font-bold py-1 px-2 text-zinc-800 max-w-[230px]"
                          value={med.id_medicamento || ''}
                          onChange={(e) => updateMedicamento(idx, 'id_medicamento', e.target.value)}
                        >
                          <option value="">-- Medicamento Libre / Receta Abierta --</option>
                          {medicamentosCat.map((m) => (
                            <option key={m.id_medicamento} value={m.id_medicamento}>
                              {m.nombre} {m.sustancia_activa ? `(${m.sustancia_activa})` : ''}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              medicamentos_recetados: formData.medicamentos_recetados.filter(
                                (_, i) => i !== idx
                              ),
                            })
                          }
                          className="text-rose-500 hover:bg-rose-50 px-2 py-1 rounded-lg font-black text-xs cursor-pointer"
                          title="Quitar medicamento"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {recetaConfig.ob_nombre_generico && (
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-black text-zinc-600 uppercase mb-0.5">
                            Nombre Genérico del Tratamiento *
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. PARACETAMOL / IBUPROFENO / AMOXICILINA"
                            value={med.nombre_generico}
                            onChange={(e) =>
                              updateMedicamento(idx, 'nombre_generico', e.target.value)
                            }
                            className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-black uppercase"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] font-black text-zinc-600 uppercase mb-0.5">
                          Cantidad (Cajas/Pzs)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={med.cantidad}
                          onChange={(e) =>
                            updateMedicamento(idx, 'cantidad', parseInt(e.target.value) || 1)
                          }
                          className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-bold text-center"
                        />
                      </div>

                      {recetaConfig.ob_forma_farmaceutica && (
                        <div>
                          <label className="block text-[10px] font-black text-zinc-600 uppercase mb-0.5">
                            Forma Farmacéutica
                          </label>
                          <select
                            value={med.forma_farmaceutica}
                            onChange={(e) =>
                              updateMedicamento(idx, 'forma_farmaceutica', e.target.value)
                            }
                            className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-bold bg-white"
                          >
                            {FORMAS_FARMACEUTICAS_COFEPRIS.map((ff) => (
                              <option key={ff} value={ff}>
                                {ff}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {recetaConfig.ob_dosis && (
                        <div>
                          <label className="block text-[10px] font-black text-zinc-600 uppercase mb-0.5">
                            Dosis
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. 500 mg (1 tableta)"
                            value={med.dosis}
                            onChange={(e) => updateMedicamento(idx, 'dosis', e.target.value)}
                            className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-bold"
                          />
                        </div>
                      )}

                      {recetaConfig.ob_presentacion && (
                        <div>
                          <label className="block text-[10px] font-black text-zinc-600 uppercase mb-0.5">
                            Presentación
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. Caja c/ 20 tabletas"
                            value={med.presentacion}
                            onChange={(e) =>
                              updateMedicamento(idx, 'presentacion', e.target.value)
                            }
                            className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-bold"
                          />
                        </div>
                      )}

                      {recetaConfig.ob_frecuencia && (
                        <div>
                          <label className="block text-[10px] font-black text-zinc-600 uppercase mb-0.5">
                            Frecuencia
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. Cada 8 horas"
                            value={med.frecuencia}
                            onChange={(e) => updateMedicamento(idx, 'frecuencia', e.target.value)}
                            className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-bold"
                          />
                        </div>
                      )}

                      {recetaConfig.ob_via_administracion && (
                        <div>
                          <label className="block text-[10px] font-black text-zinc-600 uppercase mb-0.5">
                            Vía de Administración
                          </label>
                          <select
                            value={med.via_administracion}
                            onChange={(e) =>
                              updateMedicamento(idx, 'via_administracion', e.target.value)
                            }
                            className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-bold bg-white"
                          >
                            {VIAS_ADMINISTRACION_COFEPRIS.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {recetaConfig.ob_duracion_tratamiento && (
                        <div>
                          <label className="block text-[10px] font-black text-zinc-600 uppercase mb-0.5">
                            Duración del Tratamiento
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. Por 5 días"
                            value={med.duracion_tratamiento}
                            onChange={(e) =>
                              updateMedicamento(idx, 'duracion_tratamiento', e.target.value)
                            }
                            className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-bold"
                          />
                        </div>
                      )}

                      {recetaConfig.ob_indicaciones_uso && (
                        <div className="sm:col-span-2 lg:col-span-3">
                          <label className="block text-[10px] font-black text-zinc-600 uppercase mb-0.5">
                            Indicaciones para el Uso
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. Tomar después de los alimentos con abundante agua."
                            value={med.indicaciones_uso}
                            onChange={(e) =>
                              updateMedicamento(idx, 'indicaciones_uso', e.target.value)
                            }
                            className="w-full rounded-lg border border-amber-200 bg-amber-50/50 px-2.5 py-1.5 text-xs font-semibold text-amber-950"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-zinc-100 text-zinc-700 px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-zinc-200 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingConsulta}
              className="bg-zinc-950 text-amber-400 px-8 py-2.5 rounded-xl text-xs font-black hover:bg-black transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{savingConsulta ? 'Guardando...' : 'Guardar Consulta y Emitir Receta COFEPRIS'}</span>
            </button>
          </div>
        </form>
      )}

      {/* HISTORIAL DE CONSULTAS Y RECETAS */}
      <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="p-5 border-b border-zinc-100 bg-zinc-50/70 flex flex-wrap justify-between items-center gap-2">
          <div>
            <h3 className="font-black text-zinc-900 text-sm uppercase tracking-tight">
              Historial de Consultas y Recetas Emitidas
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Previsualiza o imprime cualquier receta con los campos configurados por el Dr. Principal y la firma del médico prescriptor.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-900 text-amber-400 font-black text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Fecha y Folio</th>
                <th className="px-6 py-3.5">Paciente</th>
                <th className="px-6 py-3.5">Diagnóstico Clínico</th>
                <th className="px-6 py-3.5">Signos / Costo</th>
                <th className="px-6 py-3.5 text-right">Receta COFEPRIS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-zinc-500 font-medium">
                    Cargando consultas...
                  </td>
                </tr>
              ) : consultas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-zinc-500 font-medium">
                    No hay consultas registradas aún
                  </td>
                </tr>
              ) : (
                consultas.map((c) => {
                  const { cleanDiagnostico, meta } = decodeConsultaCofeprisMeta(
                    c.id_consulta,
                    c.diagnostico
                  )
                  const nombrePaciente =
                    meta?.paciente_nombre_libre || c.pacientes?.nombre_completo || 'PACIENTE'
                  return (
                    <tr key={c.id_consulta} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs">
                        <div className="font-bold text-zinc-900">
                          {new Date(c.fecha || Date.now()).toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[10px] text-amber-700 font-black mt-0.5">
                          #REC-{(c.id_consulta || '').toString().slice(0, 8).toUpperCase()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-black text-zinc-900 text-xs uppercase">
                          {nombrePaciente}
                        </div>
                        <div className="text-[10px] font-bold text-zinc-500 uppercase mt-0.5">
                          {c.pacientes
                            ? c.pacientes.es_poblacion_general
                              ? 'Consulta Abierta / Público'
                              : `Trabajador/Benef (${c.pacientes.parentesco || 'Titular'})`
                            : 'Formato Abierto'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-zinc-700 text-xs max-w-md">
                        <div className="font-semibold line-clamp-2">
                          {cleanDiagnostico || 'Valoración médica'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {meta?.presion_arterial && (
                          <div className="text-[10px] font-mono text-zinc-600">
                            TA: {meta.presion_arterial} · Temp: {meta.temperatura || '36.6'}°C
                          </div>
                        )}
                        {c.costo_consulta > 0 ? (
                          <span className="inline-block mt-0.5 text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            ${c.costo_consulta}
                          </span>
                        ) : (
                          <span className="inline-block mt-0.5 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Sin costo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handlePreviewReceta(c)}
                            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-black px-3 py-2 rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintReceta(c)}
                            className="bg-amber-500 hover:bg-amber-400 text-black font-black px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Imprimir</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL RÁPIDO 1: CONFIGURADOR DE CAMPOS DE RECETA DEL DR. PRINCIPAL */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-zinc-200">
            <div className="bg-zinc-950 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm uppercase text-amber-400">
                  Configurador de Campos de Receta COFEPRIS (Dr. Principal)
                </h3>
                <p className="text-xs text-zinc-400">
                  Apaga o enciende cualquier campo. El formato impreso se reacomoda uniformemente de forma automática.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50 border border-amber-200 p-3.5 rounded-2xl">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateTemplateConfig(
                        applyCofeprisPreset(recetaConfig, 'COFEPRIS_COMPLETA')
                      )
                    }
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-black cursor-pointer"
                  >
                    ✓ Todos (26 Campos COFEPRIS)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateTemplateConfig(
                        applyCofeprisPreset(recetaConfig, 'SOLO_OBLIGATORIOS')
                      )
                    }
                    className="px-3 py-1.5 rounded-xl bg-amber-500 text-black text-xs font-black cursor-pointer"
                  >
                    Solo Obligatorios
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateTemplateConfig(applyCofeprisPreset(recetaConfig, 'COMPACTA'))
                    }
                    className="px-3 py-1.5 rounded-xl bg-zinc-900 text-white text-xs font-black cursor-pointer"
                  >
                    Compacta
                  </button>
                </div>

                <label className="flex items-center gap-2 text-xs font-black text-zinc-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recetaConfig.modo_abierto_sin_membrete_empresa}
                    onChange={(e) =>
                      handleUpdateTemplateConfig({
                        ...recetaConfig,
                        modo_abierto_sin_membrete_empresa: e.target.checked,
                      })
                    }
                  />
                  <span>Receta Abierta (Sin logo Bacís cerrado)</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">
                    Encabezado Abierto
                  </label>
                  <input
                    type="text"
                    value={recetaConfig.titulo_consultorio_abierto}
                    onChange={(e) =>
                      handleUpdateTemplateConfig({
                        ...recetaConfig,
                        titulo_consultorio_abierto: e.target.value,
                      })
                    }
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">
                    Subtítulo Receta
                  </label>
                  <input
                    type="text"
                    value={recetaConfig.subtitulo_receta}
                    onChange={(e) =>
                      handleUpdateTemplateConfig({
                        ...recetaConfig,
                        subtitulo_receta: e.target.value,
                      })
                    }
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(
                  [
                    {
                      id: 'OBLIGATORIOS_MEDICO',
                      title: '1. Obligatorios Médico',
                    },
                    {
                      id: 'OBLIGATORIOS_TRATAMIENTO',
                      title: '2. Obligatorios Fármaco',
                    },
                    {
                      id: 'RECOMENDADOS_PACIENTE',
                      title: '3. Recomendados Paciente',
                    },
                  ] as const
                ).map((grp) => (
                  <div key={grp.id} className="p-3.5 rounded-2xl border border-zinc-200 bg-zinc-50 space-y-2">
                    <h4 className="text-xs font-black uppercase text-zinc-900 border-b border-zinc-200 pb-1.5">
                      {grp.title}
                    </h4>
                    {COFEPRIS_FIELD_CATALOG.filter((f) => f.grupo === grp.id).map((f) => (
                      <label
                        key={f.key}
                        className="flex items-center justify-between gap-2 text-xs font-semibold text-zinc-800 cursor-pointer py-0.5"
                      >
                        <span>{f.label}</span>
                        <input
                          type="checkbox"
                          checked={Boolean(recetaConfig[f.key])}
                          onChange={(e) =>
                            handleUpdateTemplateConfig({
                              ...recetaConfig,
                              [f.key]: e.target.checked,
                            })
                          }
                          className="w-4 h-4 accent-amber-500"
                        />
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="px-6 py-2.5 rounded-xl bg-zinc-950 text-amber-400 text-xs font-black cursor-pointer"
              >
                Aplicar Cambios y Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RÁPIDO 2: CAPTURA DE FIRMA Y PERFIL PROPIO DEL DOCTOR */}
      {showDoctorModal && editingDoctor && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-zinc-200">
            <div className="bg-zinc-950 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm uppercase text-amber-400">
                  Perfil COFEPRIS y Firma Propia del Doctor
                </h3>
                <p className="text-xs text-zinc-400">
                  Cada doctor puede dibujar o subir su propia firma digital autógrafa y sus datos oficiales.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDoctorModal(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    value={editingDoctor.nombre_completo}
                    onChange={(e) =>
                      setEditingDoctor({ ...editingDoctor, nombre_completo: e.target.value })
                    }
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    ¿Quién Emite? (Art. 28 Bis LGS / COFEPRIS) *
                  </label>
                  <select
                    value={editingDoctor.categoria_emisor}
                    onChange={(e) =>
                      setEditingDoctor({
                        ...editingDoctor,
                        categoria_emisor: e.target.value as CofeprisEmisorCategoriaId,
                      })
                    }
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-xs font-bold bg-white"
                  >
                    {COFEPRIS_EMISORES_AUTORIZADOS.map((em) => (
                      <option key={em.id} value={em.id}>
                        {em.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Cédula Profesional *
                  </label>
                  <input
                    type="text"
                    value={editingDoctor.cedula_profesional}
                    onChange={(e) =>
                      setEditingDoctor({ ...editingDoctor, cedula_profesional: e.target.value })
                    }
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Institución que Emite el Título *
                  </label>
                  <input
                    type="text"
                    value={editingDoctor.institucion_titulo}
                    onChange={(e) =>
                      setEditingDoctor({ ...editingDoctor, institucion_titulo: e.target.value })
                    }
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Teléfono del Consultorio *
                  </label>
                  <input
                    type="text"
                    value={editingDoctor.telefono_consultorio}
                    onChange={(e) =>
                      setEditingDoctor({ ...editingDoctor, telefono_consultorio: e.target.value })
                    }
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-600 mb-1">
                    Domicilio Completo del Consultorio *
                  </label>
                  <input
                    type="text"
                    value={editingDoctor.domicilio_consultorio}
                    onChange={(e) =>
                      setEditingDoctor({ ...editingDoctor, domicilio_consultorio: e.target.value })
                    }
                    className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2 border-t border-zinc-200 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase text-zinc-800">
                    ✍️ Capturar Firma Digital de este Doctor
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setInkColor('#0f172a')}
                      className={`px-2 py-1 rounded text-[10px] font-black border cursor-pointer ${
                        inkColor === '#0f172a' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700'
                      }`}
                    >
                      Negro
                    </button>
                    <button
                      type="button"
                      onClick={() => setInkColor('#1d4ed8')}
                      className={`px-2 py-1 rounded text-[10px] font-black border cursor-pointer ${
                        inkColor === '#1d4ed8' ? 'bg-blue-700 text-white' : 'bg-white text-blue-700'
                      }`}
                    >
                      Azul
                    </button>
                    <button
                      type="button"
                      onClick={() => sigUploadRef.current?.click()}
                      className="px-2.5 py-1 rounded bg-amber-500 text-black text-[10px] font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Subir Firma</span>
                    </button>
                    <input
                      ref={sigUploadRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            setEditingDoctor({ ...editingDoctor, firma_base64: reader.result })
                            setHasSigDraft(false)
                            clearSigCanvas()
                          }
                        }
                        reader.readAsDataURL(file)
                      }}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <canvas
                      ref={sigCanvasRef}
                      width={380}
                      height={140}
                      onMouseDown={startSigDraw}
                      onMouseMove={sigDrawMove}
                      onMouseUp={() => setIsDrawing(false)}
                      onMouseLeave={() => setIsDrawing(false)}
                      onTouchStart={startSigDraw}
                      onTouchMove={sigDrawMove}
                      onTouchEnd={() => setIsDrawing(false)}
                      className="w-full h-36 border-2 border-dashed border-zinc-300 rounded-xl bg-white cursor-crosshair touch-none"
                    />
                    <button
                      type="button"
                      onClick={clearSigCanvas}
                      className="mt-1.5 text-[10px] font-black uppercase text-zinc-600 underline cursor-pointer"
                    >
                      Limpiar trazo
                    </button>
                  </div>

                  <div className="h-36 border border-zinc-200 rounded-xl bg-zinc-50 flex items-center justify-center p-3 text-center">
                    {editingDoctor.firma_base64 ? (
                      <img
                        src={editingDoctor.firma_base64}
                        alt="Firma actual"
                        className="max-h-28 object-contain bg-white border rounded p-1"
                      />
                    ) : (
                      <span className="text-[11px] text-zinc-400 font-bold">
                        Dibuja tu firma en el recuadro o sube una imagen PNG/JPG
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDoctorModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveDoctorQuickModal}
                className="px-6 py-2 rounded-xl bg-zinc-950 text-amber-400 text-xs font-black cursor-pointer"
              >
                Guardar Firma y Perfil Médico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VISTA PREVIA DE RECETA */}
      {previewHtmlModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-zinc-950 text-white p-4 flex items-center justify-between">
              <span className="text-xs font-black uppercase text-amber-400">
                Vista Previa de Receta Médica COFEPRIS (Formato Abierto)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const win = window.open('', '_blank', 'width=920,height=1150')
                    if (win) {
                      win.document.write(previewHtmlModal)
                      win.document.close()
                      setTimeout(() => win.print(), 400)
                    }
                  }}
                  className="px-4 py-1.5 rounded-xl bg-amber-500 text-black text-xs font-black flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Ahora</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewHtmlModal(null)}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <iframe
              title="Vista Previa Receta"
              srcDoc={previewHtmlModal}
              className="flex-1 w-full border-0 bg-zinc-100"
            />
          </div>
        </div>
      )}
    </div>
  )
}
