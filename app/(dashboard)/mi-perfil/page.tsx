'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { TrayectoriaMinaHistorial } from '@/components/TrayectoriaMinaHistorial'
import {
  COFEPRIS_EMISORES_AUTORIZADOS,
  COFEPRIS_FIELD_CATALOG,
  type CofeprisEmisorCategoriaId,
  type CofeprisRecetaTemplateConfig,
  type DoctorCofeprisProfile,
  loadCofeprisRecetaConfig,
  saveCofeprisRecetaConfig,
  applyCofeprisPreset,
  loadDoctorProfiles,
  saveDoctorProfile,
  deleteDoctorProfile,
  getActiveDoctorId,
  setActiveDoctorId,
  buildCofeprisRecetaHtml,
} from '@/utils/cofeprisRecetaConfig'
import {
  User,
  Camera,
  Lock,
  Save,
  Loader2,
  Edit3,
  Trash2,
  SlidersHorizontal,
  FileText,
  Upload,
  Plus,
  CheckCircle2,
  Eye,
  ShieldCheck,
  Briefcase,
  History,
  HardHat,
  Sparkles,
  Building2,
  KeyRound,
  Stethoscope,
  RefreshCw,
} from 'lucide-react'

export default function MiPerfilPage() {
  const { profile, realProfile } = useAuth()
  const [apodo, setApodo] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [password, setPassword] = useState('')
  const [clinicas, setClinicas] = useState<any[]>([])
  const [idClinica, setIdClinica] = useState('')

  // Pestaña activa del perfil: 'trayectoria' | 'cuenta' | 'medico'
  const [activeTab, setActiveTab] = useState<'trayectoria' | 'cuenta' | 'medico'>('trayectoria')

  // Datos vinculados del empleado (nómina y puesto oficial)
  const [empleadoData, setEmpleadoData] = useState<{
    id_empleado: string | null
    numero_empleado: string | number | null
    nombre: string
    puesto: string
    departamento: string
    fecha_ingreso: string
  } | null>(null)
  const [loadingEmpleado, setLoadingEmpleado] = useState(true)

  // Perfiles de Doctores + Firma Digital Individual
  const [doctorProfiles, setDoctorProfiles] = useState<DoctorCofeprisProfile[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string>('')
  const [docForm, setDocForm] = useState<DoctorCofeprisProfile>({
    id: '',
    nombre_completo: '',
    categoria_emisor: 'I',
    cedula_profesional: '',
    institucion_titulo: '',
    especialidad: '',
    domicilio_consultorio: '',
    telefono_consultorio: '',
    titulo_consultorio: '',
    firma_base64: '',
    es_dr_principal: false,
  })

  // Configurador de Receta COFEPRIS del Dr. Principal
  const [recetaConfig, setRecetaConfig] = useState<CofeprisRecetaTemplateConfig>(() =>
    loadCofeprisRecetaConfig()
  )
  const [showTemplatePreview, setShowTemplatePreview] = useState(true)

  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const signatureUploadRef = useRef<HTMLInputElement>(null)

  // Canvas drawing states
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasFirmaDraft, setHasFirmaDraft] = useState(false)
  const [inkColor, setInkColor] = useState<'#0f172a' | '#1d4ed8'>('#0f172a')

  const sessionProfile = realProfile || profile

  const activeRoleLower = ((sessionProfile?.rol || profile?.rol || '') as string).toLowerCase()
  const isMedico =
    activeRoleLower.includes('médic') ||
    activeRoleLower.includes('medic') ||
    activeRoleLower.includes('admin') ||
    activeRoleLower.includes('sistemas') ||
    activeRoleLower.includes('recursos humanos')
  const isDrPrincipal =
    activeRoleLower.includes('jefe médico') ||
    activeRoleLower.includes('jefe medico') ||
    activeRoleLower.includes('admin') ||
    activeRoleLower.includes('sistemas') ||
    Boolean(docForm.es_dr_principal)

  // Cargar datos de empleado vinculado
  const fetchEmpleadoVinculado = async () => {
    if (!sessionProfile) return
    setLoadingEmpleado(true)
    try {
      const email = ((sessionProfile as any).email || profile?.email || '').toLowerCase().trim()
      const nombreUsuario = (sessionProfile.nombre_completo || profile?.nombre_completo || '').trim()
      let foundEmp: any = null

      if (email) {
        const { data: byMail } = await supabase
          .from('empleados')
          .select('id_empleado, numero_empleado, nombre, apellido_paterno, apellido_materno, puesto, departamento, fecha_ingreso, estatus')
          .ilike('correo_electronico', email)
          .limit(1)
        if (byMail && byMail[0]) {
          foundEmp = byMail[0]
        }
      }

      if (!foundEmp && nombreUsuario) {
        const tokens = nombreUsuario.split(/\s+/).filter(Boolean)
        const firstName = tokens[0] || ''
        const { data: byName } = await supabase
          .from('empleados')
          .select('id_empleado, numero_empleado, nombre, apellido_paterno, apellido_materno, puesto, departamento, fecha_ingreso, estatus')
          .ilike('nombre', `%${firstName}%`)
          .limit(10)

        if (byName && byName.length > 0) {
          const exact = byName.find((e: any) => {
            const comp = `${e.nombre} ${e.apellido_paterno} ${e.apellido_materno || ''}`.toLowerCase()
            return tokens.some((t) => t.length > 2 && comp.includes(t.toLowerCase()))
          })
          foundEmp = exact || byName[0]
        }
      }

      if (foundEmp) {
        const fullName = `${foundEmp.nombre} ${foundEmp.apellido_paterno} ${foundEmp.apellido_materno || ''}`.trim()
        setEmpleadoData({
          id_empleado: foundEmp.id_empleado,
          numero_empleado: foundEmp.numero_empleado,
          nombre: fullName,
          puesto: foundEmp.puesto || 'Puesto Operativo',
          departamento: foundEmp.departamento || 'Operaciones',
          fecha_ingreso: foundEmp.fecha_ingreso || new Date().toISOString().split('T')[0],
        })
      } else {
        // Asignación con datos del perfil
        setEmpleadoData({
          id_empleado: null,
          numero_empleado: (sessionProfile as any).numero_empleado || 'S/N',
          nombre: nombreUsuario,
          puesto: (sessionProfile as any).puesto || sessionProfile.rol || 'Trabajador Oficial',
          departamento: (sessionProfile as any).departamento_simulado || (sessionProfile as any).departamento || 'Unidad El Herrero',
          fecha_ingreso: (sessionProfile as any).creado_el?.split('T')[0] || new Date().toISOString().split('T')[0],
        })
      }
    } catch (e) {
      console.warn('Error fetching empleado vinculado:', e)
    } finally {
      setLoadingEmpleado(false)
    }
  }

  useEffect(() => {
    if (sessionProfile) {
      setApodo((sessionProfile as any).apodo || '')
      setAvatarUrl((sessionProfile as any).avatar_url || '')
      setIdClinica((sessionProfile as any).id_clinica || '')

      const list = loadDoctorProfiles(sessionProfile)
      setDoctorProfiles(list)

      const savedActive = getActiveDoctorId()
      const initialDoc =
        list.find((d) => d.id === savedActive) ||
        list.find((d) => d.id === sessionProfile.id) ||
        list[0]
      if (initialDoc) {
        setSelectedDocId(initialDoc.id)
        setDocForm(initialDoc)
      }
    }
    setRecetaConfig(loadCofeprisRecetaConfig())
    fetchClinicas()
    fetchEmpleadoVinculado()
  }, [sessionProfile?.id])

  const fetchClinicas = async () => {
    const { data } = await supabase.from('cat_clinicas').select('*').order('nombre')
    if (data) setClinicas(data)
  }

  const handleSelectDoctor = (docId: string) => {
    const found = doctorProfiles.find((d) => d.id === docId)
    if (!found) return
    setSelectedDocId(found.id)
    setDocForm(found)
    setActiveDoctorId(found.id)
    clearCanvas()
  }

  const handleCreateNewDoctorProfile = () => {
    const nuevoId = `doc-${Date.now()}`
    const nuevoDoc: DoctorCofeprisProfile = {
      id: nuevoId,
      nombre_completo: 'Dr(a). Nuevo Profesional',
      categoria_emisor: 'I',
      cedula_profesional: '',
      institucion_titulo: '',
      especialidad: 'Medicina General',
      domicilio_consultorio: docForm.domicilio_consultorio || 'Consultorio Médico de Atención Primaria',
      telefono_consultorio: docForm.telefono_consultorio || '',
      titulo_consultorio: '',
      firma_base64: '',
      es_dr_principal: false,
    }
    const updated = saveDoctorProfile(nuevoDoc)
    setDoctorProfiles(updated)
    setSelectedDocId(nuevoId)
    setDocForm(nuevoDoc)
    setActiveDoctorId(nuevoId)
    clearCanvas()
    setMsg({
      type: 'success',
      text: 'Nuevo perfil médico creado. Captura sus datos COFEPRIS y dibuja o sube su firma individual.',
    })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]

    setSaving(true)
    setMsg({ type: '', text: '' })
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `avatars/${sessionProfile?.id}-${Math.random()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('fotos_empleados')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('fotos_empleados')
        .getPublicUrl(fileName)

      const url = publicUrlData.publicUrl
      setAvatarUrl(url)

      await supabase.from('perfiles').update({ avatar_url: url }).eq('id', sessionProfile?.id)
      setMsg({ type: 'success', text: 'Foto de perfil actualizada.' })
    } catch (error: any) {
      setMsg({ type: 'error', text: 'Error al subir imagen: ' + error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleUploadSignatureImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      if (dataUrl) {
        setDocForm((prev) => ({ ...prev, firma_base64: dataUrl }))
        setHasFirmaDraft(false)
        clearCanvas()
        setMsg({ type: 'success', text: 'Imagen de firma cargada. Presiona "Guardar Perfil y Firma" para confirmar.' })
      }
    }
    reader.readAsDataURL(file)
  }

  // Canvas Signature Functions
  const getPos = (e: any) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const scaleX = canvas.width / (rect.width || 1)
    const scaleY = canvas.height / (rect.height || 1)
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  const startDrawing = (e: any) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = inkColor
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setIsDrawing(true)
  }

  const draw = (e: any) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    setHasFirmaDraft(true)
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png')
      setDocForm((prev) => ({ ...prev, firma_base64: dataUrl }))
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    setHasFirmaDraft(false)
  }

  const handleSaveDocProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMsg({ type: '', text: '' })

    try {
      const updatedDoc = {
        ...docForm,
        es_dr_principal: docForm.es_dr_principal || isDrPrincipal,
      }
      const updatedList = saveDoctorProfile(updatedDoc)
      setDoctorProfiles(updatedList)

      if (sessionProfile?.id && updatedDoc.id === sessionProfile.id) {
        await supabase
          .from('perfiles')
          .update({
            apodo,
            id_clinica: idClinica || null,
            firma: updatedDoc.firma_base64 || null,
            cedula_profesional: updatedDoc.cedula_profesional || null,
            institucion_titulo: updatedDoc.institucion_titulo || null,
            especialidad: updatedDoc.especialidad || null,
          })
          .eq('id', sessionProfile.id)
      } else if (sessionProfile?.id) {
        await supabase
          .from('perfiles')
          .update({
            apodo,
            id_clinica: idClinica || null,
          })
          .eq('id', sessionProfile.id)
      }

      if (password) {
        const { error: authError } = await supabase.auth.updateUser({ password })
        if (authError) throw authError
      }

      setHasFirmaDraft(false)
      clearCanvas()
      setMsg({
        type: 'success',
        text: `Perfil y credenciales guardados correctamente.`,
      })
      setPassword('')
    } catch (error: any) {
      setMsg({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  const clearSavedFirma = async () => {
    if (!confirm(`¿Deseas eliminar la firma digital de ${docForm.nombre_completo}?`)) return
    setSaving(true)
    try {
      const updatedDoc = { ...docForm, firma_base64: '' }
      const updatedList = saveDoctorProfile(updatedDoc)
      setDoctorProfiles(updatedList)
      setDocForm(updatedDoc)
      if (sessionProfile?.id && docForm.id === sessionProfile.id) {
        await supabase.from('perfiles').update({ firma: null }).eq('id', sessionProfile.id)
      }
      clearCanvas()
      setMsg({ type: 'success', text: 'Firma eliminada correctamente.' })
    } catch (error: any) {
      setMsg({ type: 'error', text: 'Error al borrar firma: ' + error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveTemplateConfig = (next: CofeprisRecetaTemplateConfig) => {
    const stamped = {
      ...next,
      actualizado_por: docForm.nombre_completo || profile?.nombre_completo || 'Dr. Principal',
    }
    setRecetaConfig(stamped)
    saveCofeprisRecetaConfig(stamped)
  }

  const previewHtml = useMemo(() => {
    return buildCofeprisRecetaHtml({
      cfg: recetaConfig,
      doctor: {
        ...docForm,
        firma_base64: docForm.firma_base64,
      },
      folio: 'REC-COFEPRIS-001',
      fechaTexto: '22 de noviembre de 2026',
      fechaCorta: '22/11/2026',
      paciente: {
        nombre_completo: 'JUAN CARLOS PÉREZ RAMÍREZ (EJEMPLO)',
        categoria_etiqueta: 'CONSULTA EXTERNA / FORMATO ABIERTO',
        edad: '34 años',
        sexo: 'Masculino',
        alergias: 'Negadas',
        talla: '1.74 m',
        peso: '76 kg',
        imc: '25.1',
        temperatura: '36.6',
        presion_arterial: '120/80',
        diagnostico: 'Faringoamigdalitis aguda no complicada',
      },
      medicamentos: [
        {
          nombre_generico: 'PARACETAMOL',
          forma_farmaceutica: 'Tableta',
          dosis: '500 mg (1 tableta)',
          presentacion: 'Caja con 20 tabletas',
          frecuencia: 'Cada 8 horas',
          via_administracion: 'Oral (VO)',
          duracion_tratamiento: 'Por 5 días',
          indicaciones_uso: 'Tomar después de los alimentos con un vaso de agua.',
          cantidad: 1,
          costo_unitario: 0,
        },
      ],
      autoPrintScript: false,
    })
  }, [recetaConfig, docForm])

  if (!profile) return null

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      {/* ===================================================================== */}
      {/* ENCABEZADO PRINCIPAL DE MI PERFIL                                     */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-wide">
              Mi Perfil Oficial · Unidad El Herrero
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-zinc-950">
              {profile.rol}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Consulta y actualiza tu categoría laboral autorizada, trayectoria en mina y credenciales de acceso.
          </p>
        </div>

        {/* Pestañas de Navegación del Perfil */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 self-start sm:self-auto overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('trayectoria')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'trayectoria'
                ? 'bg-amber-500 text-zinc-950 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900'
            }`}
          >
            <HardHat className="w-3.5 h-3.5" />
            <span>♟️ Trayectoria en Mina & Escalafón</span>
          </button>

          <button
            onClick={() => setActiveTab('cuenta')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'cuenta'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>👤 Datos de Cuenta & Clave</span>
          </button>

          {isMedico && (
            <button
              onClick={() => setActiveTab('medico')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'medico'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>🩺 Receta Médica COFEPRIS</span>
            </button>
          )}
        </div>
      </div>

      {msg.text && (
        <div
          className={`p-4 rounded-xl text-sm font-bold border flex items-center gap-2 ${
            msg.type === 'error'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
          }`}
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{msg.text}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VISTA 1: TRAYECTORIA EN MINA & ESCALAFÓN (PUESTO, HISTORIAL Y CAMBIO) */}
      {/* ===================================================================== */}
      {activeTab === 'trayectoria' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <TrayectoriaMinaHistorial
            idEmpleado={empleadoData?.id_empleado}
            numeroEmpleado={empleadoData?.numero_empleado}
            nombreEmpleado={empleadoData?.nombre || sessionProfile?.nombre_completo || profile.nombre_completo}
            puestoActual={empleadoData?.puesto}
            departamentoActual={empleadoData?.departamento}
            fechaIngreso={empleadoData?.fecha_ingreso}
            canManage={isDrPrincipal || activeRoleLower.includes('admin') || activeRoleLower.includes('recursos') || activeRoleLower.includes('jefe') || activeRoleLower.includes('superintendente')}
            currentUserRole={sessionProfile?.rol || profile.rol}
            currentUserName={sessionProfile?.nombre_completo || profile.nombre_completo}
            onPuestoActualizado={(nuevoPuesto, nuevoDepto) => {
              setEmpleadoData((prev) =>
                prev ? { ...prev, puesto: nuevoPuesto, departamento: nuevoDepto } : prev
              )
              setMsg({
                type: 'success',
                text: `¡Tu puesto oficial ha sido actualizado a "${nuevoPuesto}" en "${nuevoDepto}"!`,
              })
            }}
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* VISTA 2: DATOS DE CUENTA Y CLAVE (FOTO, ALIAS, CONTRASEÑA)            */}
      {/* ===================================================================== */}
      {activeTab === 'cuenta' && (
        <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col lg:flex-row items-start gap-8">
            {/* Foto */}
            <div className="flex flex-col items-center space-y-3 shrink-0 self-center lg:self-start">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="w-28 h-28 rounded-full border-4 border-white dark:border-zinc-800 shadow-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 text-zinc-400" />
                  )}
                </div>
                <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-7 h-7 text-white" />
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Cambiar Foto</p>
              <div className="text-center px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] font-black text-zinc-700 dark:text-zinc-300">
                {profile.rol}
              </div>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveDocProfile} className="flex-1 space-y-6 w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">
                    Usuario de Sesión Oficial
                  </label>
                  <input
                    type="text"
                    disabled
                    value={sessionProfile?.nombre_completo || profile.nombre_completo}
                    className="w-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3 text-sm text-zinc-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-900 dark:text-white uppercase mb-1.5">
                    Apodo / Alias (Para Chat)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Minero Juan..."
                    value={apodo}
                    onChange={(e) => setApodo(e.target.value)}
                    className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-sm bg-white dark:bg-zinc-800 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-900 dark:text-white uppercase mb-1.5">
                    Cambiar Contraseña de Acceso
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="Escribe para cambiar la contraseña..."
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-sm bg-white dark:bg-zinc-800 pr-10 focus:ring-amber-500 focus:border-amber-500"
                    />
                    <Lock className="w-4 h-4 text-zinc-400 absolute right-3 top-3.5" />
                  </div>
                </div>

                {isMedico && (
                  <div>
                    <label className="block text-xs font-bold text-zinc-900 dark:text-white uppercase mb-1.5">
                      Clínica Activa de Consulta
                    </label>
                    <select
                      value={idClinica}
                      onChange={(e) => setIdClinica(e.target.value)}
                      className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-sm bg-white dark:bg-zinc-800 font-semibold"
                    >
                      <option value="">Seleccione clínica activa...</option>
                      {clinicas.map((c) => (
                        <option key={c.id_clinica} value={c.id_clinica}>
                          {c.nombre} ({c.tipo})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Guardar Datos de Cuenta</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VISTA 3: CONFIGURACIÓN MÉDICA COFEPRIS Y FIRMA (MÉDICOS Y ADMINS)     */}
      {/* ===================================================================== */}
      {activeTab === 'medico' && isMedico && (
        <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6 animate-in fade-in duration-300">
          <div className="bg-zinc-50/80 dark:bg-zinc-800/50 p-5 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 space-y-5">
            {/* Selector de Perfiles de Doctores */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-700 pb-4">
              <div>
                <h3 className="text-sm font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <Edit3 className="w-4 h-4" /> Perfil Profesional COFEPRIS y Firma Propia por Doctor
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Selecciona tu perfil o crea perfiles individuales para cada médico/profesional autorizado para que cada quien tenga su propia firma.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedDocId}
                  onChange={(e) => handleSelectDoctor(e.target.value)}
                  className="border border-zinc-300 dark:border-zinc-600 rounded-xl px-3 py-2 text-xs font-black bg-white dark:bg-zinc-800"
                >
                  {doctorProfiles.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre_completo} ({d.es_dr_principal ? 'Dr. Principal' : d.categoria_emisor})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleCreateNewDoctorProfile}
                  className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-black text-amber-400 text-xs font-black flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuevo Doctor</span>
                </button>
                {doctorProfiles.length > 1 && docForm.id !== sessionProfile?.id && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = deleteDoctorProfile(docForm.id)
                      setDoctorProfiles(next)
                      if (next[0]) handleSelectDoctor(next[0].id)
                    }}
                    className="p-2 rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200 cursor-pointer"
                    title="Eliminar este perfil médico adicional"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Datos Obligatorios COFEPRIS del Profesional */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase mb-1">
                  Nombre Completo del Profesional *
                </label>
                <input
                  type="text"
                  value={docForm.nombre_completo}
                  onChange={(e) => setDocForm({ ...docForm, nombre_completo: e.target.value })}
                  placeholder="Ej. Dr. Juan Antonio Ramírez López"
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-xl p-2.5 text-xs font-bold bg-white dark:bg-zinc-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase mb-1">
                  Emisor Autorizado COFEPRIS (Art. 28 Bis LGS) *
                </label>
                <select
                  value={docForm.categoria_emisor}
                  onChange={(e) =>
                    setDocForm({ ...docForm, categoria_emisor: e.target.value as CofeprisEmisorCategoriaId })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-xl p-2.5 text-xs font-semibold bg-white dark:bg-zinc-800"
                >
                  {COFEPRIS_EMISORES_AUTORIZADOS.map((em) => (
                    <option key={em.id} value={em.id}>
                      {em.codigo} — {em.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase mb-1">
                  Número de Cédula Profesional *
                </label>
                <input
                  type="text"
                  value={docForm.cedula_profesional}
                  onChange={(e) => setDocForm({ ...docForm, cedula_profesional: e.target.value })}
                  placeholder="Ej. 12345678"
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-xl p-2.5 text-xs font-mono font-bold bg-white dark:bg-zinc-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase mb-1">
                  Institución que Emite el Título *
                </label>
                <input
                  type="text"
                  value={docForm.institucion_titulo}
                  onChange={(e) => setDocForm({ ...docForm, institucion_titulo: e.target.value })}
                  placeholder="Ej. UNAM / UJED / IPN"
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-xl p-2.5 text-xs bg-white dark:bg-zinc-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase mb-1">
                  Especialidad / Título
                </label>
                <input
                  type="text"
                  value={docForm.especialidad}
                  onChange={(e) => setDocForm({ ...docForm, especialidad: e.target.value })}
                  placeholder="Ej. Medicina del Trabajo / Médico Cirujano"
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-xl p-2.5 text-xs bg-white dark:bg-zinc-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase mb-1">
                  Teléfono del Consultorio *
                </label>
                <input
                  type="text"
                  value={docForm.telefono_consultorio}
                  onChange={(e) => setDocForm({ ...docForm, telefono_consultorio: e.target.value })}
                  placeholder="Ej. (618) 123-4567"
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-xl p-2.5 text-xs bg-white dark:bg-zinc-800"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase mb-1">
                  Domicilio Completo del Consultorio *
                </label>
                <input
                  type="text"
                  value={docForm.domicilio_consultorio}
                  onChange={(e) => setDocForm({ ...docForm, domicilio_consultorio: e.target.value })}
                  placeholder="Ej. Unidad Minera El Herrero, Campamento Principal, Bacís, Dgo."
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-xl p-2.5 text-xs bg-white dark:bg-zinc-800"
                />
              </div>
            </div>

            {/* SECCIÓN DE CAPTURA DE FIRMA INDIVIDUAL */}
            <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h4 className="text-xs font-black uppercase text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <Edit3 className="w-4 h-4 text-amber-500" />
                    Firma Digital Autógrafa de {docForm.nombre_completo}
                  </h4>
                  <p className="text-[11px] text-zinc-500">
                    Dibuja en el recuadro con el mouse/pantalla táctil o sube una imagen PNG/JPG limpia de tu firma.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInkColor('#0f172a')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                      inkColor === '#0f172a' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700'
                    }`}
                  >
                    Tinta Negra
                  </button>
                  <button
                    type="button"
                    onClick={() => setInkColor('#1d4ed8')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                      inkColor === '#1d4ed8' ? 'bg-blue-700 text-white' : 'bg-white text-zinc-700'
                    }`}
                  >
                    Tinta Azul
                  </button>
                  <button
                    type="button"
                    onClick={() => signatureUploadRef.current?.click()}
                    className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Subir Imagen</span>
                  </button>
                  <input
                    type="file"
                    ref={signatureUploadRef}
                    onChange={handleUploadSignatureImage}
                    accept="image/*"
                    className="hidden"
                  />
                  {docForm.firma_base64 && (
                    <button
                      type="button"
                      onClick={clearSavedFirma}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Borrar Firma</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl p-2 bg-white flex flex-col items-center justify-center relative">
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={160}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-36 touch-none cursor-crosshair rounded-xl"
                  />
                  <div className="w-full flex items-center justify-between pt-1 px-1 border-t border-zinc-100 text-[10px] text-zinc-400">
                    <span>Lienzo de dibujo táctil / mouse</span>
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-amber-600 font-bold hover:underline"
                    >
                      Limpiar trazo
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex flex-col items-center justify-center min-h-[140px]">
                  <span className="text-[10px] font-bold uppercase text-zinc-400 mb-2">
                    Vista Previa de la Firma Activa
                  </span>
                  {docForm.firma_base64 ? (
                    <img
                      src={docForm.firma_base64}
                      alt="Firma Activa"
                      className="max-h-24 max-w-full object-contain filter contrast-125"
                    />
                  ) : (
                    <span className="text-xs text-zinc-400 italic">
                      Aún no hay firma capturada para este profesional.
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={handleSaveDocProfile}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs flex items-center gap-2 shadow-md cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Guardar Perfil y Firma del Doctor</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* PANEL EXCLUSIVO DEL DR. PRINCIPAL / JEFE MÉDICO                       */}
          {/* ===================================================================== */}
          <div className="p-6 rounded-3xl bg-zinc-900 text-white space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-amber-400" />
                  <h3 className="font-black text-base uppercase tracking-wide">
                    Panel del Dr. Principal · Personalizador Abierto de Receta COFEPRIS
                  </h3>
                </div>
                <p className="text-xs text-zinc-400">
                  Bacís no extiende recetas comerciales. Marca o desmarca qué elementos deben aparecer. La receta se adapta automáticamente y uniforme.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const preset = applyCofeprisPreset(recetaConfig, 'COFEPRIS_COMPLETA')
                    handleSaveTemplateConfig(preset)
                  }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-bold"
                >
                  Preset: Oficial COFEPRIS Completa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const preset = applyCofeprisPreset(recetaConfig, 'COMPACTA')
                    handleSaveTemplateConfig(preset)
                  }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold"
                >
                  Preset: Consulta Breve Mina
                </button>
                <button
                  type="button"
                  onClick={() => setShowTemplatePreview(!showTemplatePreview)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 text-zinc-950 text-xs font-black flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{showTemplatePreview ? 'Ocultar Preview' : 'Ver Preview'}</span>
                </button>
              </div>
            </div>

            {/* Configuración de Encabezado Institucional de la Receta */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-zinc-900">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">
                  Razón Social / Título Superior
                </label>
                <input
                  type="text"
                  value={recetaConfig.titulo_consultorio_abierto}
                  onChange={(e) =>
                    handleSaveTemplateConfig({ ...recetaConfig, titulo_consultorio_abierto: e.target.value })
                  }
                  className="w-full border border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold bg-zinc-900 text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">
                  Subtítulo / Unidad Minera
                </label>
                <input
                  type="text"
                  value={recetaConfig.subtitulo_receta}
                  onChange={(e) =>
                    handleSaveTemplateConfig({ ...recetaConfig, subtitulo_receta: e.target.value })
                  }
                  className="w-full border border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold bg-zinc-900 text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">
                  Texto al Pie / Advertencia Legal
                </label>
                <input
                  type="text"
                  value={recetaConfig.nota_abierta_pie}
                  onChange={(e) =>
                    handleSaveTemplateConfig({ ...recetaConfig, nota_abierta_pie: e.target.value })
                  }
                  className="w-full border border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold bg-zinc-900 text-white"
                />
              </div>
            </div>

            {/* 3 Columnas de Switches COFEPRIS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-zinc-900">
              {/* Grupo 1 */}
              <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950 space-y-2.5">
                <h4 className="text-xs font-black uppercase text-amber-400 border-b border-zinc-800 pb-2">
                  1. Obligatorios COFEPRIS — Médico
                </h4>
                {COFEPRIS_FIELD_CATALOG.filter((f) => f.grupo === 'OBLIGATORIOS_MEDICO').map((f) => (
                  <label key={f.key} className="flex items-center justify-between gap-2 text-xs font-bold text-zinc-300 cursor-pointer py-1">
                    <span>{f.label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(recetaConfig[f.key])}
                      onChange={(e) =>
                        handleSaveTemplateConfig({ ...recetaConfig, [f.key]: e.target.checked })
                      }
                      className="w-4 h-4 accent-amber-500"
                    />
                  </label>
                ))}
              </div>

              {/* Grupo 2 */}
              <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950 space-y-2.5">
                <h4 className="text-xs font-black uppercase text-amber-400 border-b border-zinc-800 pb-2">
                  2. Obligatorios COFEPRIS — Tratamiento
                </h4>
                {COFEPRIS_FIELD_CATALOG.filter((f) => f.grupo === 'OBLIGATORIOS_TRATAMIENTO').map((f) => (
                  <label key={f.key} className="flex items-center justify-between gap-2 text-xs font-bold text-zinc-300 cursor-pointer py-1">
                    <span>{f.label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(recetaConfig[f.key])}
                      onChange={(e) =>
                        handleSaveTemplateConfig({ ...recetaConfig, [f.key]: e.target.checked })
                      }
                      className="w-4 h-4 accent-amber-500"
                    />
                  </label>
                ))}
              </div>

              {/* Grupo 3 + Visuales */}
              <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950 space-y-2.5">
                <h4 className="text-xs font-black uppercase text-emerald-400 border-b border-zinc-800 pb-2">
                  3. Recomendados COFEPRIS — Paciente / Vitales
                </h4>
                {COFEPRIS_FIELD_CATALOG.filter(
                  (f) => f.grupo === 'RECOMENDADOS_PACIENTE' || f.grupo === 'VISUALES'
                ).map((f) => (
                  <label key={f.key} className="flex items-center justify-between gap-2 text-xs font-bold text-zinc-300 cursor-pointer py-1">
                    <span>{f.label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(recetaConfig[f.key])}
                      onChange={(e) =>
                        handleSaveTemplateConfig({ ...recetaConfig, [f.key]: e.target.checked })
                      }
                      className="w-4 h-4 accent-emerald-500"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Vista Previa Adaptable en Vivo */}
            {showTemplatePreview && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-zinc-300 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-400" />
                    Vista Previa Dinámica (La receta se adapta uniformemente al instante según los campos activos)
                  </span>
                </div>
                <div className="rounded-2xl border-2 border-zinc-700 overflow-hidden bg-white">
                  <iframe
                    title="Vista Previa Receta COFEPRIS"
                    srcDoc={previewHtml}
                    className="w-full h-[640px] border-0 bg-white"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
