'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Save, Upload, Building, Trash2 } from 'lucide-react'

export default function EmpresaConfigPage() {
    const [config, setConfig] = useState<any>({
        nombre_empresa: 'Minera Topia S.A. de C.V.',
        direccion: 'Domicilio Conocido, Topia, Durango',
        rfc: '',
        registro_patronal: '',
        logo_base64: ''
    })
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const saved = localStorage.getItem('rh_config_empresa')
        if (saved) setConfig(JSON.parse(saved))
    }, [])

    const handleSave = () => {
        setLoading(true)
        localStorage.setItem('rh_config_empresa', JSON.stringify(config))
        setTimeout(() => setLoading(false), 500)
        alert('Configuración guardada (Local). El logo se usará en los PDFs.')
    }

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setConfig({ ...config, logo_base64: reader.result as string })
            }
            reader.readAsDataURL(file)
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center space-x-4">
                <div className="p-3 bg-amber-500/10 rounded-full">
                    <Building className="h-8 w-8 text-amber-600" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 uppercase tracking-wide">Identidad de la Empresa</h2>
                    <p className="text-sm text-zinc-500">Estos datos aparecerán en los formatos oficiales (PDF) y cabeceras.</p>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-zinc-200 p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700">Razón Social</label>
                            <input
                                type="text"
                                value={config.nombre_empresa}
                                onChange={(e) => setConfig({ ...config, nombre_empresa: e.target.value })}
                                className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-3 border text-zinc-900"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700">Dirección Fiscal</label>
                            <textarea
                                rows={3}
                                value={config.direccion}
                                onChange={(e) => setConfig({ ...config, direccion: e.target.value })}
                                className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-3 border text-zinc-900"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700">RFC</label>
                            <input
                                type="text"
                                value={config.rfc}
                                onChange={(e) => setConfig({ ...config, rfc: e.target.value })}
                                className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-3 border text-zinc-900"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700">Registro Patronal</label>
                            <input
                                type="text"
                                value={config.registro_patronal || ''}
                                onChange={(e) => setConfig({ ...config, registro_patronal: e.target.value })}
                                className="mt-1 block w-full rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-3 border text-zinc-900"
                                placeholder="Ej. Y583749210"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-zinc-700">Logotipo Institucional</label>
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-300 rounded-lg p-6 hover:bg-zinc-50 transition-colors">
                            {config.logo_base64 ? (
                                <div className="relative mb-4">
                                    <img src={config.logo_base64} alt="Logo" className="h-32 object-contain" />
                                    <button
                                        onClick={() => setConfig({ ...config, logo_base64: '' })}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <Upload className="mx-auto h-12 w-12 text-zinc-300" />
                                    <p className="mt-1 text-sm text-zinc-500">PNG, JPG hasta 1MB</p>
                                </div>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoChange}
                                className="block w-full text-sm text-zinc-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-amber-50 file:text-amber-700
                        hover:file:bg-amber-100
                        cursor-pointer
                        "
                            />
                        </div>
                        <p className="text-xs text-zinc-400">
                            * Este logo se incrustará automáticamente en la esquina superior izquierda de los formatos PDF de vacaciones y bajas.
                        </p>
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex items-center px-6 py-3 bg-black text-white rounded-md shadow hover:bg-zinc-800 disabled:opacity-50"
                    >
                        <Save className="mr-2 h-4 w-4 text-amber-500" />
                        Guardar Configuración
                    </button>
                </div>
            </div>
        </div>
    )
}
