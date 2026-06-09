'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, User, MapPin, Briefcase } from 'lucide-react'
import Link from 'next/link'

export default function NuevoEmpleadoPage() {
    const router = useRouter()

    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('personal')
    const [fotoFile, setFotoFile] = useState<File | null>(null)
    const [fotoPreview, setFotoPreview] = useState<string | null>(null)
    const [turnos, setTurnos] = useState<any[]>([])
    const [roles, setRoles] = useState<any[]>([])

    // Estado único para todos los campos (expandir según necesidad)
    const [formData, setFormData] = useState({
        numero_empleado: '',
        nombre: '',
        apellido_paterno: '',
        apellido_materno: '',
        sexo: 'Masculino',
        fecha_nacimiento: '',
        curp: '',
        rfc: '',
        nss: '',
        telefono: '',
        correo_electronico: '',
        estado_civil: '',
        calle: '',
        numero_exterior: '',
        colonia: '',
        codigo_postal: '',
        municipio: '',
        ciudad: '',
        estado: '',
        fecha_ingreso: '',
        salario_diario: '',
        sdi: '',
        banco: '',
        numero_cuenta: '',
        clabe: '',
        id_turno: '',
        id_tipo_rol: '',
        tipo_esquema: 'turno'
    })

    // Auto-calcular SDI cuando cambia salario_diario
    useEffect(() => {
        if (formData.salario_diario) {
            const sd = parseFloat(formData.salario_diario);
            if (!isNaN(sd)) {
                // Factor de integración por defecto (1 año antigüedad: 1.0493)
                const sdiCalculado = (sd * 1.0493).toFixed(2);
                if (formData.sdi !== sdiCalculado) {
                    setFormData((prev: any) => ({ ...prev, sdi: sdiCalculado }));
                }
            }
        }
    }, [formData.salario_diario]);

    useEffect(() => {
        async function fetchTurnos() {
            const { data } = await supabase.from('turnos').select('*').eq('activo', true)
            if (data) setTurnos(data)
            const { data: rolesData } = await supabase.from('cat_tipos_rol').select('*').eq('activo', true)
            if (rolesData) setRoles(rolesData)
        }
        fetchTurnos()
    }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // 0. Subir Foto si existe
            let fotoUrl = null
            if (fotoFile) {
                const fileExt = fotoFile.name.split('.').pop()
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('fotos_empleados')
                    .upload(fileName, fotoFile)
                
                if (uploadError) {
                    throw new Error('Error al subir la foto: ' + uploadError.message)
                }
                
                const { data: publicUrlData } = supabase.storage
                    .from('fotos_empleados')
                    .getPublicUrl(fileName)
                
                fotoUrl = publicUrlData.publicUrl
            }

            // 1. Insertar Empleado
            const { data: empData, error: empError } = await supabase
                .from('empleados')
                .insert([{
                    numero_empleado: parseInt(formData.numero_empleado),
                    nombre: formData.nombre,
                    apellido_paterno: formData.apellido_paterno,
                    apellido_materno: formData.apellido_materno,
                    sexo: formData.sexo,
                    fecha_nacimiento: formData.fecha_nacimiento,
                    curp: formData.curp,
                    rfc: formData.rfc,
                    nss: formData.nss,
                    telefono: formData.telefono,
                    correo_electronico: formData.correo_electronico,
                    estado_civil: formData.estado_civil,
                    foto_url: fotoUrl,
                    id_turno: formData.tipo_esquema === 'turno' ? (formData.id_turno || null) : null
                }])
                .select()
                .single()

            if (empError) throw empError
            const empId = empData.id_empleado

            // 2. Insertar Domicilio
            const { error: domError } = await supabase.from('empleado_domicilio').insert([{
                id_empleado: empId,
                calle: formData.calle,
                numero_exterior: formData.numero_exterior,
                colonia: formData.colonia,
                codigo_postal: formData.codigo_postal,
                ciudad: formData.ciudad,
                municipio: formData.municipio,
                estado: formData.estado
            }])
            if (domError) throw new Error("Error al guardar domicilio: " + domError.message)

            // 3. Insertar Ingreso
            if (formData.fecha_ingreso) {
                const { error: ingError } = await supabase.from('empleado_ingreso').insert([{
                    id_empleado: empId,
                    fecha_ingreso: formData.fecha_ingreso
                }])
                if (ingError) throw new Error("Error al guardar fecha ingreso: " + ingError.message)
            }

            // 4. Insertar Salario Inicial
            if (formData.salario_diario && formData.fecha_ingreso) {
                const sdiVal = formData.sdi ? parseFloat(formData.sdi) : (parseFloat(formData.salario_diario) * 1.0493);
                
                const payload: any = {
                    id_empleado: empId,
                    fecha_inicio_vigencia: formData.fecha_ingreso,
                    salario_diario: parseFloat(formData.salario_diario),
                    motivo: 'Salario Inicial'
                };
                
                if (!isNaN(sdiVal)) {
                    payload.sdi = parseFloat(sdiVal.toFixed(2));
                }
                
                const { error: salError } = await supabase.from('empleado_salarios').insert([payload])
                if (salError) console.error("Error salario", salError) // No bloqueante
            }

            // 5. Insertar Datos Bancarios
            if (formData.banco || formData.numero_cuenta || formData.clabe) {
                const { error: bankError } = await supabase.from('empleado_banco').insert([{
                    id_empleado: empId,
                    banco: formData.banco,
                    numero_cuenta: formData.numero_cuenta,
                    clabe: formData.clabe
                }])
                if (bankError) console.error("Error banco", bankError)
            }

            // 6. Insertar Esquema Laboral (Turno / Rol)
            if (formData.tipo_esquema === 'turno' && formData.id_turno && formData.fecha_ingreso) {
                const { error: turnoError } = await supabase.from('empleado_turnos').insert([{
                    id_empleado: empId,
                    id_turno: formData.id_turno,
                    fecha_inicio: formData.fecha_ingreso
                }])
                if (turnoError) console.error("Error turno histórico", turnoError)
            } else if (formData.tipo_esquema === 'rol' && formData.id_tipo_rol && formData.fecha_ingreso) {
                const { error: rolError } = await supabase.from('empleado_roles').insert([{
                    id_empleado: empId,
                    id_tipo_rol: formData.id_tipo_rol,
                    fecha_inicio: formData.fecha_ingreso
                }])
                if (rolError) console.error("Error rol", rolError)
            }

            router.push('/empleados')
        } catch (error: any) {
            alert('Error al guardar: ' + error.message)
            setLoading(false) // Reset loading state on error
        }
    }

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                    <Link href="/empleados" className="p-2 rounded-full hover:bg-zinc-200 transition-colors">
                        <ArrowLeft className="h-6 w-6 text-zinc-600" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900">Nuevo Empleado</h1>
                        <p className="text-sm text-zinc-500">Complete la información para dar de alta al colaborador</p>
                    </div>
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex items-center px-6 py-2 bg-black text-white rounded-md shadow-lg hover:bg-zinc-800 transition-all disabled:opacity-50"
                >
                    <Save className="mr-2 h-4 w-4 text-amber-500" />
                    {loading ? 'Guardando...' : 'Guardar Empleado'}
                </button>
            </div>

            {/* Tabs */}
            <div className="mb-6 border-b border-zinc-200">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('personal')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'personal'
                            ? 'border-amber-500 text-amber-600'
                            : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
                            }`}
                    >
                        <div className="flex items-center">
                            <User className="mr-2 h-4 w-4" />
                            Información Personal
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('domicilio')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'domicilio'
                            ? 'border-amber-500 text-amber-600'
                            : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
                            }`}
                    >
                        <div className="flex items-center">
                            <MapPin className="mr-2 h-4 w-4" />
                            Domicilio
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('bancario')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'bancario'
                            ? 'border-amber-500 text-amber-600'
                            : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
                            }`}
                    >
                        <div className="flex items-center">
                            <Briefcase className="mr-2 h-4 w-4" />
                            Datos Bancarios
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('laboral')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'laboral'
                            ? 'border-amber-500 text-amber-600'
                            : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
                            }`}
                    >
                        <div className="flex items-center">
                            <Briefcase className="mr-2 h-4 w-4" />
                            Datos Laborales (Iniciales)
                        </div>
                    </button>
                </nav>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-8">
                {activeTab === 'personal' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-300">
                        {/* Foto del Empleado */}
                        <div className="col-span-1 md:col-span-3 flex flex-col items-center justify-center p-4 border-2 border-dashed border-zinc-300 rounded-lg bg-zinc-50 mb-4">
                            <div className="h-32 w-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-zinc-200 flex items-center justify-center relative mb-4">
                                {fotoPreview ? (
                                    <img src={fotoPreview} alt="Preview" className="h-full w-full object-cover" />
                                ) : (
                                    <User className="h-16 w-16 text-zinc-400" />
                                )}
                            </div>
                            <label className="cursor-pointer bg-white px-4 py-2 border border-zinc-300 rounded-md shadow-sm text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors">
                                <span>Tomar o Elegir Foto</span>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="sr-only" 
                                    onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) {
                                            setFotoFile(file)
                                            setFotoPreview(URL.createObjectURL(file))
                                        }
                                    }}
                                />
                            </label>
                            <p className="text-xs text-zinc-500 mt-2">Formatos soportados: JPG, PNG, WEBP.</p>
                        </div>

                        <div className="col-span-1 md:col-span-3">
                            <h3 className="text-lg font-medium text-zinc-900 mb-4 border-b pb-2">Identidad</h3>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-700">No. Empleado *</label>
                            <input type="number" name="numero_empleado" value={formData.numero_empleado} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900" required />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-700">Nombre (s) *</label>
                            <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900" required />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-700">Apellido Paterno *</label>
                            <input type="text" name="apellido_paterno" value={formData.apellido_paterno} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900" required />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-700">Apellido Materno</label>
                            <input type="text" name="apellido_materno" value={formData.apellido_materno} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-700">Sexo</label>
                            <select name="sexo" value={formData.sexo} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900">
                                <option value="Masculino">Masculino</option>
                                <option value="Femenino">Femenino</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-700">Fecha Nacimiento</label>
                            <input type="date" name="fecha_nacimiento" value={formData.fecha_nacimiento} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-700">Estado Civil</label>
                            <select name="estado_civil" value={formData.estado_civil} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900">
                                <option value="">Seleccionar...</option>
                                <option value="Soltero">Soltero/a</option>
                                <option value="Casado">Casado/a</option>
                                <option value="Divorciado">Divorciado/a</option>
                                <option value="Viudo">Viudo/a</option>
                                <option value="Union Libre">Unión Libre</option>
                            </select>
                        </div>

                        <div className="col-span-1 md:col-span-3 mt-4">
                            <h3 className="text-lg font-medium text-zinc-900 mb-4 border-b pb-2">Legal y Contacto</h3>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-700">CURP</label>
                            <input type="text" name="curp" value={formData.curp} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 uppercase text-zinc-900" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700">RFC</label>
                            <input type="text" name="rfc" value={formData.rfc} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 uppercase text-zinc-900" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700">NSS</label>
                            <input type="text" name="nss" value={formData.nss} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700">Teléfono</label>
                            <input type="tel" name="telefono" value={formData.telefono} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-zinc-700">Correo Electrónico</label>
                            <input type="email" name="correo_electronico" value={formData.correo_electronico} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900" />
                        </div>
                    </div>
                )}

                {activeTab === 'domicilio' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-zinc-700">Calle</label>
                            <input type="text" name="calle" value={formData.calle} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700">Número Exterior</label>
                            <input type="text" name="numero_exterior" value={formData.numero_exterior} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700">Código Postal</label>
                            <input type="text" name="codigo_postal" value={formData.codigo_postal} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700">Colonia</label>
                            <input type="text" name="colonia" value={formData.colonia} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700">Ciudad</label>
                            <input type="text" name="ciudad" value={formData.ciudad} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700">Municipio</label>
                            <input type="text" name="municipio" value={formData.municipio} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700">Estado</label>
                            <input type="text" name="estado" value={formData.estado} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900" />
                        </div>
                    </div>
                )}

                {activeTab === 'bancario' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700">Banco</label>
                            <input type="text" name="banco" value={formData.banco} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700">Número de Cuenta</label>
                            <input type="text" name="numero_cuenta" value={formData.numero_cuenta} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-zinc-700">CLABE Interbancaria</label>
                            <input type="text" name="clabe" value={formData.clabe} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900" />
                        </div>
                    </div>
                )}

                {activeTab === 'laboral' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700">Fecha de Ingreso *</label>
                            <input type="date" name="fecha_ingreso" value={formData.fecha_ingreso} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700">Salario Diario Inicial</label>
                            <input type="number" step="0.01" name="salario_diario" value={formData.salario_diario} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900" />
                            <p className="text-xs text-gray-500 mt-1">Este dato creará el primer registro en el historial de salarios.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700">Salario Diario Integrado (SDI)</label>
                            <input type="number" step="0.01" name="sdi" value={formData.sdi} onChange={handleChange} className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 font-bold">Elegir Horario o Rol Inicial</label>
                            <select 
                                name="tipo_esquema" 
                                value={formData.tipo_esquema} 
                                onChange={handleChange} 
                                className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900 bg-white"
                            >
                                <option value="turno">Turno Fijo</option>
                                <option value="rol">Rol Rotativo</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 font-bold">
                                {formData.tipo_esquema === 'turno' ? 'Horario (Turno) Inicial' : 'Rol Inicial'}
                            </label>
                            {formData.tipo_esquema === 'turno' ? (
                                <select 
                                    name="id_turno" 
                                    value={formData.id_turno} 
                                    onChange={handleChange} 
                                    className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900 bg-white"
                                >
                                    <option value="">Sin Turno Asignado</option>
                                    {turnos.map((t: any) => (
                                        <option key={t.id} value={t.id}>{t.nombre}</option>
                                    ))}
                                </select>
                            ) : (
                                <select 
                                    name="id_tipo_rol" 
                                    value={formData.id_tipo_rol} 
                                    onChange={handleChange} 
                                    className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border p-2 text-zinc-900 bg-white"
                                >
                                    <option value="">Sin Rol Asignado</option>
                                    {roles.map((r: any) => (
                                        <option key={r.id_tipo_rol} value={r.id_tipo_rol}>{r.tipo_rol} ({r.dias_trabajo}x{r.dias_descanso})</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <div className="col-span-2 p-4 bg-amber-50 border border-amber-200 rounded-md">
                            <p className="text-sm text-amber-800">
                                <strong>Nota:</strong> La asignación de Puesto, Departamento y Unidad se debe realizar desde la sección "Historial - Adscripciones" una vez creado el empleado para mantener la integridad histórica.
                            </p>
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}
