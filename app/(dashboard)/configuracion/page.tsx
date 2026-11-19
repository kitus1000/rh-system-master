'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import Link from 'next/link'
import { Save, Building, Upload, CheckCircle, Shield, AlertTriangle, Mail, Send } from 'lucide-react'

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
        clave_maestra: '',
        email_provider: 'smtp',
        resend_api_key: '',
        smtp_host: 'smtp.gmail.com',
        smtp_port: 587,
        smtp_user: '',
        smtp_pass: '',
        smtp_secure: false,
        email_remitente: '',
        email_rh_notificaciones: ''
    })
    const [testEmailTo, setTestEmailTo] = useState('')
    const [testingEmail, setTestingEmail] = useState(false)

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
                clave_maestra: data.clave_maestra || '',
                email_provider: data.email_provider || 'smtp',
                resend_api_key: data.resend_api_key || '',
                smtp_host: data.smtp_host || 'smtp.gmail.com',
                smtp_port: Number(data.smtp_port || 587),
                smtp_user: data.smtp_user || '',
                smtp_pass: data.smtp_pass || '',
                smtp_secure: Boolean(data.smtp_secure),
                email_remitente: data.email_remitente || '',
                email_rh_notificaciones: data.email_rh_notificaciones || ''
            })
            if (data.email_rh_notificaciones) setTestEmailTo(data.email_rh_notificaciones)
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

    async function handleTestEmail() {
        const target = testEmailTo.trim() || formData.email_rh_notificaciones.trim() || formData.smtp_user.trim()
        if (!target) {
            alert('⚠️ Escribe un correo destino en la casilla para la prueba (ej: tu correo personal).')
            return
        }

        if (formData.email_provider === 'smtp') {
            if (!formData.smtp_user?.trim()) {
                alert('⚠️ Falta ingresar el "Usuario / Correo SMTP" (tu correo de Gmail o empresa).')
                return
            }
            if (!formData.smtp_pass?.trim()) {
                alert('⚠️ Falta ingresar la "Contraseña / App Password". Si usas Gmail, recuerda generar una contraseña de aplicación de 16 caracteres en tu cuenta de Google.')
                return
            }
        } else if (formData.email_provider === 'resend') {
            if (!formData.resend_api_key?.trim()) {
                alert('⚠️ Falta ingresar tu "Resend API Key".')
                return
            }
        }

        setTestingEmail(true)
        try {
            // Guardar primero en BD
            try {
                const updates = { ...formData, actualizado_el: new Date().toISOString() }
                if (configId) {
                    await supabase.from('configuracion_empresa').update(updates).eq('id', configId)
                } else {
                    const { data: inserted } = await supabase.from('configuracion_empresa').insert(updates).select('id').maybeSingle()
                    if (inserted?.id) setConfigId(inserted.id)
                }
                localStorage.setItem('rh_config_empresa', JSON.stringify(updates))
            } catch (saveErr) {
                console.warn('DB client-side auto-save notice:', saveErr)
            }

            const res = await fetch('/api/contratistas/notificar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo: 'test',
                    to: target,
                    config: formData
                })
            })
            const json = await res.json()
            if (json.sent) {
                alert(`✅ Correo de prueba enviado exitosamente a ${target} (vía ${json.provider}). Revisa tu bandeja de entrada.`)
            } else {
                alert(`❌ No se pudo enviar: ${json.error || 'Verifica tus datos SMTP/Resend y vuelve a intentar.'}`)
            }
        } catch (err: any) {
            alert('Error: ' + err.message)
        } finally {
            setTestingEmail(false)
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

                    {/* Automatic Email Settings */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200 space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                            <div className="flex items-center gap-2">
                                <Mail className="w-5 h-5 text-orange-500" />
                                <div>
                                    <h3 className="text-sm font-black text-zinc-900 uppercase">Correo Automático (Contratistas & Notificaciones)</h3>
                                    <p className="text-xs text-zinc-500">Envía automáticamente accesos, fechas de inducción y credenciales QR sin intervención manual.</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-600 uppercase mb-1">Método de Envío</label>
                                <select
                                    value={formData.email_provider}
                                    onChange={e => setFormData({ ...formData, email_provider: e.target.value })}
                                    className="w-full border-zinc-300 rounded-md p-2 border text-xs font-bold"
                                >
                                    <option value="smtp">SMTP (Gmail / Outlook / Correo Corporativo)</option>
                                    <option value="resend">Resend API</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-600 uppercase mb-1">Correo de RH (Para recibir avisos de nuevos contratistas)</label>
                                <input
                                    type="email"
                                    value={formData.email_rh_notificaciones}
                                    onChange={e => setFormData({ ...formData, email_rh_notificaciones: e.target.value })}
                                    placeholder="rh@tuempresa.com"
                                    className="w-full border-zinc-300 rounded-md p-2 border text-xs font-mono"
                                />
                            </div>
                        </div>

                        {formData.email_provider === 'resend' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-600 uppercase mb-1">Resend API Key</label>
                                    <input
                                        type="password"
                                        value={formData.resend_api_key}
                                        onChange={e => setFormData({ ...formData, resend_api_key: e.target.value })}
                                        placeholder="re_xxxxxxxx..."
                                        className="w-full border-zinc-300 rounded-md p-2 border text-xs font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-600 uppercase mb-1">Correo Remitente</label>
                                    <input
                                        type="text"
                                        value={formData.email_remitente}
                                        onChange={e => setFormData({ ...formData, email_remitente: e.target.value })}
                                        placeholder="Accesos Mina <accesos@tudominio.com>"
                                        className="w-full border-zinc-300 rounded-md p-2 border text-xs font-mono"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-600 uppercase mb-1">Servidor SMTP (Host)</label>
                                    <input
                                        type="text"
                                        value={formData.smtp_host}
                                        onChange={e => setFormData({ ...formData, smtp_host: e.target.value })}
                                        placeholder="smtp.gmail.com o smtp.office365.com"
                                        className="w-full border-zinc-300 rounded-md p-2 border text-xs font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-600 uppercase mb-1">Puerto SMTP</label>
                                    <input
                                        type="number"
                                        value={formData.smtp_port}
                                        onChange={e => setFormData({ ...formData, smtp_port: Number(e.target.value) })}
                                        className="w-full border-zinc-300 rounded-md p-2 border text-xs font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-600 uppercase mb-1">Usuario / Correo SMTP</label>
                                    <input
                                        type="email"
                                        value={formData.smtp_user}
                                        onChange={e => setFormData({ ...formData, smtp_user: e.target.value })}
                                        placeholder="tucorreo@gmail.com"
                                        className="w-full border-zinc-300 rounded-md p-2 border text-xs font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-600 uppercase mb-1">Contraseña / App Password</label>
                                    <input
                                        type="password"
                                        value={formData.smtp_pass}
                                        onChange={e => setFormData({ ...formData, smtp_pass: e.target.value })}
                                        placeholder="Contraseña de aplicación (16 caracteres en Gmail)"
                                        className="w-full border-zinc-300 rounded-md p-2 border text-xs font-mono"
                                    />
                                </div>
                                <div className="md:col-span-2 flex items-center justify-between gap-4 bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                                    <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.smtp_secure}
                                            onChange={e => setFormData({ ...formData, smtp_secure: e.target.checked })}
                                        />
                                        <span>Usar SSL directo (puerto 465)</span>
                                    </label>
                                    <span className="text-[11px] text-zinc-500">Para Gmail/Outlook puerto 587 déjalo desmarcado.</span>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-zinc-100">
                            <input
                                type="email"
                                value={testEmailTo}
                                onChange={e => setTestEmailTo(e.target.value)}
                                placeholder="Correo para prueba de envío..."
                                className="flex-1 border-zinc-300 rounded-md p-2 border text-xs font-mono"
                            />
                            <button
                                type="button"
                                onClick={handleTestEmail}
                                disabled={testingEmail}
                                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-black font-black text-xs rounded-md"
                            >
                                <Send className="w-3.5 h-3.5" />
                                <span>{testingEmail ? 'Enviando...' : 'Guardar primero y Probar Envío'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
