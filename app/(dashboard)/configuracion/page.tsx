'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import Link from 'next/link'
import { Save, Building, Upload, CheckCircle, Shield, AlertTriangle } from 'lucide-react'

export default function ConfiguracionPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [configId, setConfigId] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        nombre_empresa: '',
        rfc: '',
        direccion: '',
        registro_patronal: '',
        logo_base64: '',
        clave_maestra: ''
    })

    useEffect(() => {
        fetchConfig()
    }, [])

    async function fetchConfig() {
        setLoading(true)
        const { data, error } = await supabase
            .from('configuracion_empresa')
            .select('*')
            .limit(1)
            .single()

        if (data) {
            setConfigId(data.id)
            setFormData({
                nombre_empresa: data.nombre_empresa || '',
                rfc: data.rfc || '',
                direccion: data.direccion || '',
                registro_patronal: data.registro_patronal || '',
                logo_base64: data.logo_base64 || '',
                clave_maestra: data.clave_maestra || ''
            })
        }
        setLoading(false)
    }

    async function handleSave() {
        setSaving(true)
        try {
            const updates = {
                ...formData,
                actualizado_el: new Date().toISOString()
            }

            let error
            if (configId) {
                const { error: updateError } = await supabase
                    .from('configuracion_empresa')
                    .update(updates)
                    .eq('id', configId)
                error = updateError
            } else {
                // Fallback if table was empty
                const { error: insertError } = await supabase
                    .from('configuracion_empresa')
                    .insert(updates)
                error = insertError
            }

            if (error) throw error

            // Also update localStorage for immediate availability in other tabs/components
            localStorage.setItem('rh_config_empresa', JSON.stringify(updates))

            alert('Configuración guardada correctamente.')
        } catch (e: any) {
            alert('Error al guardar: ' + e.message)
        } finally {
            setSaving(false)
        }
    }

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setFormData({ ...formData, logo_base64: reader.result as string })
            }
            reader.readAsDataURL(file)
        }
    }

    if (loading) return <div className="p-8 text-center text-zinc-500">Cargando configuración...</div>

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-6">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 uppercase tracking-wide">Configuración Institucional</h2>
                    <p className="text-sm text-zinc-500">Defina la identidad de la empresa para documentos y reportes.</p>
                </div>
                <div className="flex items-center space-x-3">
                    <Link
                        href="/usuarios"
                        className="flex items-center space-x-2 bg-zinc-100 text-zinc-900 px-4 py-2 rounded-md font-bold hover:bg-zinc-200 transition-colors"
                    >
                        <Shield className="w-4 h-4" />
                        <span>Gestión de Usuarios</span>
                    </Link>
                    <Link
                        href="/configuracion/peligro"
                        className="flex items-center space-x-2 bg-red-100 text-red-900 px-4 py-2 rounded-md font-bold hover:bg-red-200 transition-colors"
                        title="Zona de Peligro"
                    >
                        <AlertTriangle className="w-4 h-4" />
                        <span>Botón Rojo</span>
                    </Link>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center space-x-2 bg-black text-white px-6 py-2 rounded-md font-bold hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                        {saving ? <span className="animate-spin">⏳</span> : <Save className="w-5 h-5" />}
                        <span>Guardar Cambios</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Logo Section */}
                <div className="md:col-span-1 space-y-4">
                    <label className="block text-sm font-bold text-zinc-700">Logotipo Institucional</label>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-zinc-200 flex flex-col items-center justify-center text-center space-y-4 h-64">
                        {formData.logo_base64 ? (
                            <div className="relative w-full h-full flex items-center justify-center bg-zinc-50 rounded-lg p-4 overflow-hidden group">
                                <img src={formData.logo_base64} alt="Company Logo" className="max-w-full max-h-full object-contain" />
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p className="text-white text-xs font-bold">Cambiar Imagen</p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-zinc-300 flex flex-col items-center">
                                <Building className="w-16 h-16 mb-2" />
                                <span className="text-xs">Sin logotipo</span>
                            </div>
                        )}
                        <label className="cursor-pointer bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-4 py-2 rounded-md text-sm font-medium transition-colors w-full flex items-center justify-center">
                            <Upload className="w-4 h-4 mr-2" />
                            {formData.logo_base64 ? "Reemplazar" : "Subir Logo"}
                            <input type="file" onChange={handleLogoUpload} accept="image/*" className="hidden" />
                        </label>
                    </div>
                    <p className="text-xs text-zinc-400 text-center">Recomendado: PNG o JPG con fondo transparente.</p>
                </div>

                {/* Form Fields */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Nombre de la Empresa / Razón Social</label>
                                <input
                                    type="text"
                                    value={formData.nombre_empresa}
                                    onChange={e => setFormData({ ...formData, nombre_empresa: e.target.value })}
                                    className="w-full border-zinc-300 rounded-md focus:ring-black focus:border-black font-bold text-lg"
                                    placeholder="Ej. Mi Empresa S.A. de C.V."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">RFC</label>
                                <input
                                    type="text"
                                    value={formData.rfc}
                                    onChange={e => setFormData({ ...formData, rfc: e.target.value })}
                                    className="w-full border-zinc-300 rounded-md focus:ring-black focus:border-black uppercase bg-zinc-50"
                                    placeholder="XAXX010101000"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-zinc-700 mb-1">Registro Patronal</label>
                                <input
                                    type="text"
                                    className="w-full border-zinc-300 rounded-md shadow-sm focus:ring-black focus:border-black p-2 border"
                                    value={formData.registro_patronal}
                                    onChange={e => setFormData({ ...formData, registro_patronal: e.target.value })}
                                />
                            </div>

                            <div className="col-span-2 pt-4 border-t border-zinc-200 mt-4">
                                <label className="flex items-center text-sm font-bold text-red-600 mb-1">
                                    <Shield className="w-4 h-4 mr-2" />
                                    Clave Maestra de Autorizaciones
                                </label>
                                <p className="text-xs text-zinc-500 mb-2">Se utilizará para forzar autorizaciones de Recursos Humanos cuando el jefe no esté disponible.</p>
                                <input
                                    type="password"
                                    placeholder="Ejem: 123456"
                                    className="w-full border-zinc-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 p-2 border bg-red-50"
                                    value={formData.clave_maestra}
                                    onChange={e => setFormData({ ...formData, clave_maestra: e.target.value })}
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Dirección Fiscal Completa</label>
                                <textarea
                                    rows={3}
                                    value={formData.direccion}
                                    onChange={e => setFormData({ ...formData, direccion: e.target.value })}
                                    className="w-full border-zinc-300 rounded-md focus:ring-black focus:border-black bg-zinc-50"
                                    placeholder="Calle, Número, Colonia, Ciudad, Estado, CP"
                                />
                            </div>
                        </div>

                        <div className="bg-amber-50 p-4 rounded-lg flex items-start">
                            <CheckCircle className="w-5 h-5 text-amber-600 mt-0.5 mr-2" />
                            <div>
                                <h4 className="text-sm font-bold text-amber-800">Uso de la información</h4>
                                <p className="text-xs text-amber-700 mt-1">Estos datos aparecerán automáticamente en el encabezado de los formatos PDF (Vacaciones, Bajas, etc.) generados por la plataforma.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
