'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
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
} from 'lucide-react'

export default function MiPerfilPage() {
  const { profile, realProfile } = useAuth()
  const [apodo, setApodo] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [password, setPassword] = useState('')
  const [clinicas, setClinicas] = useState<any[]>([])
  const [idClinica, setIdClinica] = useState('')

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

  // Canvas Signature Functions (escalado exacto pantalla <-> lienzo)
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
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasFirmaDraft(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setMsg({ type: '', text: '' })
    try {
      let finalFirma = docForm.firma_base64
      if (hasFirmaDraft && canvasRef.current) {
        finalFirma = canvasRef.current.toDataURL('image/png')
      }

      const updatedDoc: DoctorCofeprisProfile = {
        ...docForm,
        firma_base64: finalFirma,
      }

      // 1. Guardar en catálogo multi-médico local (soporta múltiples doctores cada uno con su firma)
      const updatedList = saveDoctorProfile(updatedDoc)
      setDoctorProfiles(updatedList)
      setDocForm(updatedDoc)
      setActiveDoctorId(updatedDoc.id)

      // 2. Si corresponde al usuario logueado actual, sincronizar columnas oficiales en Supabase `perfiles`
      if (sessionProfile?.id && updatedDoc.id === sessionProfile.id) {
        const { error: profileError } = await supabase
          .from('perfiles')
          .update({
            apodo,
            id_clinica: idClinica || null,
            cedula_profesional: updatedDoc.cedula_profesional,
            universidad: updatedDoc.institucion_titulo,
            especialidad: updatedDoc.especialidad,
            domicilio_consultorio: updatedDoc.domicilio_consultorio,
            telefono_consultorio: updatedDoc.telefono_consultorio,
            firma: finalFirma || null,
          })
          .eq('id', sessionProfile.id)

        if (profileError) throw profileError
      } else if (sessionProfile?.id) {
        await supabase
          .from('perfiles')
          .update({
            apodo,
            id_clinica: idClinica || null,
          })
          .eq('id', sessionProfile.id)
      }

      if (password.trim() !== '') {
        if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres')
        const { error: authError } = await supabase.auth.updateUser({ password })
        if (authError) throw authError
      }

      setHasFirmaDraft(false)
      clearCanvas()
      setMsg({
        type: 'success',
        text: `Perfil y firma digital de "${updatedDoc.nombre_completo}" guardados correctamente.`,
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

  const activeRoleLower = (profile.rol || '').toLowerCase()
  const isMedico =
    activeRoleLower.includes('médic') ||
    activeRoleLower.includes('medic') ||
    activeRoleLower.includes('admin') ||
    activeRoleLower.includes('sistemas') ||
    activeRoleLower.includes('recursos')
  const isDrPrincipal =
    activeRoleLower.includes('jefe médico') ||
    activeRoleLower.includes('jefe medico') ||
    activeRoleLower.includes('admin') ||
    activeRoleLower.includes('sistemas') ||
    Boolean(docForm.es_dr_principal)

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-wide">
            Mi Perfil Profesional y Configuración Médica COFEPRIS
          </h2>
          <p className="text-sm text-zinc-500">
            Cada doctor configura sus credenciales COFEPRIS y su firma digital autógrafa. El Dr. Principal personaliza el formato abierto de receta.
          </p>
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

      {/* TARJETA PRINCIPAL DE PERFIL Y FIRMA DEL DOCTOR */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start gap-8">
          {/* Foto */}
          <div className="flex flex-col items-center space-y-3 shrink-0 self-center lg:self-start">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-28 h-28 rounded-full border-4 border-white shadow-lg overflow-hidden bg-zinc-100 flex items-center justify-center">
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
            <div className="text-center px-3 py-1 rounded-full bg-zinc-100 text-[11px] font-black text-zinc-700">
              {profile.rol}
            </div>
          </div>

          {/* Formulario */}
          <div className="flex-1 space-y-6 w-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">
                  Usuario de Sesión
                </label>
                <input
                  type="text"
                  disabled
                  value={sessionProfile?.nombre_completo || profile.nombre_completo}
                  className="w-full border border-zinc-200 bg-zinc-50 rounded-xl p-3 text-sm text-zinc-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-900 uppercase mb-1.5">
                  Apodo / Alias (Para Chat)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Dr. Martinez..."
                  value={apodo}
                  onChange={(e) => setApodo(e.target.value)}
                  className="w-full border border-zinc-300 rounded-xl p-3 text-sm focus:ring-black focus:border-black"
                />
              </div>

              {isMedico && (
                <div>
                  <label className="block text-xs font-bold text-zinc-900 uppercase mb-1.5">
                    Clínica Activa de Consulta
                  </label>
                  <select
                    value={idClinica}
                    onChange={(e) => setIdClinica(e.target.value)}
                    className="w-full border border-zinc-300 rounded-xl p-3 text-sm bg-white font-semibold"
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

            {isMedico && (
              <div className="bg-zinc-50/80 p-5 sm:p-6 rounded-2xl border border-zinc-200 space-y-5">
                {/* Selector de Perfiles de Doctores */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-200 pb-4">
                  <div>
                    <h3 className="text-sm font-black text-amber-700 uppercase tracking-wider flex items-center gap-2">
                      <Edit3 className="w-4 h-4" /> Perfil Profesional COFEPRIS y Firma Propia por Doctor
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Selecciona tu perfil o crea perfiles individuales para cada médico/profesional autorizado para que cada quien tenga su propia firma.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedDocId}
                      onChange={(e) => handleSelectDoctor(e.target.value)}
                      className="border border-zinc-300 rounded-xl px-3 py-2 text-xs font-black bg-white"
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
                    <label className="block text-xs font-bold text-zinc-800 uppercase mb-1">
                      Nombre Completo del Profesional *
                    </label>
                    <input
                      type="text"
                      value={docForm.nombre_completo}
                      onChange={(e) => setDocForm({ ...docForm, nombre_completo: e.target.value })}
                      placeholder="Ej. Dr. Juan Antonio Ramírez López"
                      className="w-full border border-zinc-300 rounded-xl p-2.5 text-xs font-bold bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-800 uppercase mb-1">
                      Emisor Autorizado COFEPRIS (Art. 28 Bis LGS) *
                    </label>
                    <select
                      value={docForm.categoria_emisor}
                      onChange={(e) =>
                        setDocForm({
                          ...docForm,
                          categoria_emisor: e.target.value as CofeprisEmisorCategoriaId,
                        })
                      }
                      className="w-full border border-zinc-300 rounded-xl p-2.5 text-xs font-bold bg-white"
                    >
                      {COFEPRIS_EMISORES_AUTORIZADOS.map((em) => (
                        <option key={em.id} value={em.id}>
                          {em.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-800 uppercase mb-1">
                      Número de Cédula Profesional *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. 12204901"
                      value={docForm.cedula_profesional}
                      onChange={(e) =>
                        setDocForm({ ...docForm, cedula_profesional: e.target.value })
                      }
                      className="w-full border border-zinc-300 rounded-xl p-2.5 text-xs font-bold bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-800 uppercase mb-1">
                      Institución que Emite el Título *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Universidad Juárez del Estado de Durango"
                      value={docForm.institucion_titulo}
                      onChange={(e) =>
                        setDocForm({ ...docForm, institucion_titulo: e.target.value })
                      }
                      className="w-full border border-zinc-300 rounded-xl p-2.5 text-xs font-semibold bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-800 uppercase mb-1">
                      Especialidad / Área de Competencia
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Medicina General, Odontología, Homeopatía..."
                      value={docForm.especialidad}
                      onChange={(e) => setDocForm({ ...docForm, especialidad: e.target.value })}
                      className="w-full border border-zinc-300 rounded-xl p-2.5 text-xs font-semibold bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-800 uppercase mb-1">
                      Teléfono del Consultorio *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. 618-123-4567"
                      value={docForm.telefono_consultorio}
                      onChange={(e) =>
                        setDocForm({ ...docForm, telefono_consultorio: e.target.value })
                      }
                      className="w-full border border-zinc-300 rounded-xl p-2.5 text-xs font-semibold bg-white"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-zinc-800 uppercase mb-1">
                      Domicilio Completo del Consultorio *
                    </label>
                    <input
                      type="text"
                      placeholder="Calle, número, colonia, C.P., municipio y estado..."
                      value={docForm.domicilio_consultorio}
                      onChange={(e) =>
                        setDocForm({ ...docForm, domicilio_consultorio: e.target.value })
                      }
                      className="w-full border border-zinc-300 rounded-xl p-2.5 text-xs font-semibold bg-white"
                    />
                  </div>

                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-xs font-black text-indigo-900 bg-indigo-50 border border-indigo-200 px-3 py-2.5 rounded-xl w-full cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(docForm.es_dr_principal)}
                        onChange={(e) =>
                          setDocForm({ ...docForm, es_dr_principal: e.target.checked })
                        }
                      />
                      <span>Designar como Dr. Principal (Jefe Médico)</span>
                    </label>
                  </div>
                </div>

                {/* Captura de Firma Autógrafa Individual */}
                <div className="pt-2 border-t border-zinc-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <label className="text-xs font-black text-zinc-800 uppercase">
                      ✍️ Firma Digital Autógrafa de {docForm.nombre_completo || 'este Doctor'}
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInkColor('#0f172a')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black border cursor-pointer ${
                          inkColor === '#0f172a'
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-white text-zinc-700 border-zinc-300'
                        }`}
                      >
                        Tinta Negra
                      </button>
                      <button
                        type="button"
                        onClick={() => setInkColor('#1d4ed8')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black border cursor-pointer ${
                          inkColor === '#1d4ed8'
                            ? 'bg-blue-700 text-white border-blue-700'
                            : 'bg-white text-blue-700 border-blue-200'
                        }`}
                      >
                        Tinta Azul
                      </button>
                      <button
                        type="button"
                        onClick={() => signatureUploadRef.current?.click()}
                        className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Subir Firma (PNG/JPG)</span>
                      </button>
                      <input
                        ref={signatureUploadRef}
                        type="file"
                        accept="image/*"
                        onChange={handleUploadSignatureImage}
                        className="hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div className="space-y-2">
                      <div className="border-2 border-dashed border-zinc-300 bg-white rounded-xl overflow-hidden touch-none relative shadow-inner">
                        <canvas
                          ref={canvasRef}
                          width={460}
                          height={160}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                          className="w-full h-40 cursor-crosshair block"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={clearCanvas}
                          className="px-3 py-1.5 rounded-lg border border-zinc-300 hover:bg-zinc-100 text-[11px] font-black uppercase cursor-pointer"
                        >
                          Limpiar Lienzo
                        </button>
                        <span className="text-[11px] text-zinc-500 font-bold">
                          Dibuja tu firma con mouse o pantalla táctil
                        </span>
                      </div>
                    </div>

                    <div className="border border-zinc-200 bg-white p-4 rounded-xl flex flex-col justify-center items-center text-center h-40">
                      {docForm.firma_base64 ? (
                        <div className="relative group w-full h-full flex flex-col justify-between items-center">
                          <img
                            src={docForm.firma_base64}
                            alt="Firma digital"
                            className="max-h-24 object-contain bg-white border rounded p-2"
                          />
                          <button
                            type="button"
                            onClick={clearSavedFirma}
                            className="text-xs text-rose-600 font-black hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Eliminar Firma Guardada
                          </button>
                        </div>
                      ) : (
                        <div className="text-zinc-400 text-xs font-bold">
                          Sin firma digital guardada para este médico.
                          <br />
                          <span className="font-normal text-[11px] text-zinc-500">
                            Dibuja tu firma en el recuadro izquierdo o sube una imagen y presiona &quot;Guardar Cambios&quot;.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-zinc-100 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-zinc-900 uppercase mb-1.5 flex items-center">
                  <Lock className="w-4 h-4 mr-2" />
                  Cambiar Contraseña (Opcional)
                </label>
                <input
                  type="password"
                  placeholder="Dejar en blanco para no cambiar..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-zinc-300 rounded-xl p-3 text-sm"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center space-x-2 bg-zinc-950 hover:bg-black text-amber-400 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-colors shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  <span>{saving ? 'Guardando...' : 'Guardar Perfil y Firma'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PANEL DEL DR. PRINCIPAL: CONFIGURADOR DE CAMPOS Y FORMATO ABIERTO COFEPRIS */}
      {isMedico && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-amber-300/80 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black uppercase mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Panel del Dr. Principal (Jefe Médico) · Normativa Mexicana &amp; COFEPRIS</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-zinc-900 uppercase">
                Personalización Abierta de Campos de Receta Médica
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Como Bacís no extiende recetas cerradas, el encabezado es totalmente abierto y el Dr. Principal puede apagar o activar cualquier campo. La receta se reacomoda uniformemente en automático.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  handleSaveTemplateConfig(applyCofeprisPreset(recetaConfig, 'COFEPRIS_COMPLETA'))
                }
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer"
              >
                ✓ Todos COFEPRIS
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSaveTemplateConfig(applyCofeprisPreset(recetaConfig, 'SOLO_OBLIGATORIOS'))
                }
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black cursor-pointer"
              >
                Solo 16 Obligatorios
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSaveTemplateConfig(applyCofeprisPreset(recetaConfig, 'COMPACTA'))
                }
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-black cursor-pointer"
              >
                Formato Compacto
              </button>
              <button
                type="button"
                onClick={() => setShowTemplatePreview(!showTemplatePreview)}
                className="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>{showTemplatePreview ? 'Ocultar Vista Previa' : 'Ver Vista Previa'}</span>
              </button>
            </div>
          </div>

          {!isDrPrincipal && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold">
              💡 Marca arriba &quot;Designar como Dr. Principal (Jefe Médico)&quot; o inicia con rol <strong>Jefe Médico</strong> para administrar el formato oficial del consultorio.
            </div>
          )}

          {/* Encabezado Abierto Editable */}
          <div className="bg-zinc-50 rounded-2xl border border-zinc-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-black uppercase text-zinc-800 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-amber-600" />
                <span>Formato Abierto de Receta (Sin Membrete Institucional Cerrado)</span>
              </h4>
              <label className="flex items-center gap-2 text-xs font-black text-zinc-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recetaConfig.modo_abierto_sin_membrete_empresa}
                  onChange={(e) =>
                    handleSaveTemplateConfig({
                      ...recetaConfig,
                      modo_abierto_sin_membrete_empresa: e.target.checked,
                    })
                  }
                />
                <span>Modo Abierto (Sin logo de empresa cerrado)</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">
                  Encabezado Abierto del Consultorio
                </label>
                <input
                  type="text"
                  value={recetaConfig.titulo_consultorio_abierto}
                  onChange={(e) =>
                    handleSaveTemplateConfig({
                      ...recetaConfig,
                      titulo_consultorio_abierto: e.target.value,
                    })
                  }
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-xs font-bold bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">
                  Subtítulo / Etiqueta Superior
                </label>
                <input
                  type="text"
                  value={recetaConfig.subtitulo_receta}
                  onChange={(e) =>
                    handleSaveTemplateConfig({
                      ...recetaConfig,
                      subtitulo_receta: e.target.value,
                    })
                  }
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-xs font-bold bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">
                  Leyenda / Pie Abierto
                </label>
                <input
                  type="text"
                  value={recetaConfig.nota_abierta_pie}
                  onChange={(e) =>
                    handleSaveTemplateConfig({
                      ...recetaConfig,
                      nota_abierta_pie: e.target.value,
                    })
                  }
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-xs font-bold bg-white"
                />
              </div>
            </div>
          </div>

          {/* 3 Columnas de Switches COFEPRIS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Grupo 1 */}
            <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 space-y-2.5">
              <h4 className="text-xs font-black uppercase text-sky-900 border-b border-zinc-200 pb-2">
                1. Obligatorios COFEPRIS — Médico
              </h4>
              {COFEPRIS_FIELD_CATALOG.filter((f) => f.grupo === 'OBLIGATORIOS_MEDICO').map((f) => (
                <label key={f.key} className="flex items-center justify-between gap-2 text-xs font-bold text-zinc-800 cursor-pointer py-1">
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
            <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 space-y-2.5">
              <h4 className="text-xs font-black uppercase text-amber-900 border-b border-zinc-200 pb-2">
                2. Obligatorios COFEPRIS — Tratamiento
              </h4>
              {COFEPRIS_FIELD_CATALOG.filter((f) => f.grupo === 'OBLIGATORIOS_TRATAMIENTO').map((f) => (
                <label key={f.key} className="flex items-center justify-between gap-2 text-xs font-bold text-zinc-800 cursor-pointer py-1">
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
            <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 space-y-2.5">
              <h4 className="text-xs font-black uppercase text-emerald-900 border-b border-zinc-200 pb-2">
                3. Recomendados COFEPRIS — Paciente / Vitales
              </h4>
              {COFEPRIS_FIELD_CATALOG.filter(
                (f) => f.grupo === 'RECOMENDADOS_PACIENTE' || f.grupo === 'VISUALES'
              ).map((f) => (
                <label key={f.key} className="flex items-center justify-between gap-2 text-xs font-bold text-zinc-800 cursor-pointer py-1">
                  <span>{f.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(recetaConfig[f.key])}
                    onChange={(e) =>
                      handleSaveTemplateConfig({ ...recetaConfig, [f.key]: e.target.checked })
                    }
                    className="w-4 h-4 accent-emerald-600"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Vista Previa Adaptable en Vivo */}
          {showTemplatePreview && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-zinc-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-600" />
                  Vista Previa Dinámica (La receta se adapta uniformemente al instante según los campos activos)
                </span>
              </div>
              <div className="rounded-2xl border-2 border-zinc-300 overflow-hidden bg-zinc-100">
                <iframe
                  title="Vista Previa Receta COFEPRIS"
                  srcDoc={previewHtml}
                  className="w-full h-[640px] border-0 bg-white"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
