'use client'

import { FolderLock, Heart, Code2, Database, Layout, ShieldCheck, Mail } from 'lucide-react'

export default function AcercaDePage() {
    return (
        <div className="max-w-4xl mx-auto space-y-12 py-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Hero Section */}
            <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center p-4 bg-amber-500 rounded-2xl shadow-2xl shadow-amber-500/20 mb-4 animate-bounce">
                    <FolderLock className="w-12 h-12 text-black" />
                </div>
                <h1 className="text-5xl font-black text-zinc-900 tracking-tighter uppercase italic">
                    El <span className="text-amber-500">Expediente</span>
                </h1>
                <p className="text-xl text-zinc-500 font-medium">Versión 1.0.4 "Enterprise Edition"</p>
                <div className="h-1 w-24 bg-amber-500 mx-auto rounded-full"></div>
            </div>

            {/* Credits Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-xl shadow-zinc-200/50 space-y-6">
                    <div className="flex items-center space-x-3 text-zinc-900 font-bold text-xl">
                        <Code2 className="text-amber-500" />
                        <h2>Desarrollo y Diseño</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="group">
                            <p className="text-sm text-zinc-400 uppercase font-black tracking-widest">Creado por:</p>
                            <p className="text-2xl font-bold text-zinc-900 group-hover:text-amber-600 transition-colors">Sistema de Gestión RH</p>
                        </div>
                        <p className="text-zinc-600 leading-relaxed">
                            Diseñado específicamente para optimizar los procesos de Capital Humano,
                            automatizar solicitudes de vacaciones, gestionar expedientes digitales
                            y centralizar el control de incidencias.
                        </p>
                        <div className="flex items-center space-x-4 pt-4 border-t border-zinc-50">
                            <a href="#" className="p-2 bg-zinc-900 text-white rounded-full hover:bg-amber-500 transition-colors">
                                <Mail className="w-5 h-5" />
                            </a>
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-800 shadow-2xl space-y-6 text-zinc-300">
                    <div className="flex items-center space-x-3 text-white font-bold text-xl">
                        <ShieldCheck className="text-amber-500" />
                        <h2>Tecnologías Ejecutivas</h2>
                    </div>
                    <ul className="space-y-4">
                        <li className="flex items-center space-x-3">
                            <Layout className="w-5 h-5 text-amber-500 shrink-0" />
                            <span><strong className="text-white">Fron-End:</strong> Next.js 14 & Tailwind CSS</span>
                        </li>
                        <li className="flex items-center space-x-3">
                            <Database className="w-5 h-5 text-amber-500 shrink-0" />
                            <span><strong className="text-white">Back-End:</strong> Supabase (Real-time DB)</span>
                        </li>
                        <li className="flex items-center space-x-3">
                            <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0" />
                            <span><strong className="text-white">Seguridad:</strong> PostgREST & Auth Policy</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* Footer Credit */}
            <div className="flex flex-col items-center justify-center space-y-2 py-8 border-t border-zinc-100 font-medium">
                <div className="flex items-center space-x-2 text-zinc-500">
                    <span>Sistema diseñado y desarrollado por:</span>
                </div>
                <div className="text-zinc-900 font-black italic tracking-widest text-lg">
                    J. Raul Mtz M
                </div>
                <p className="text-xs text-zinc-300">© 2026 El Expediente - Todos los derechos reservados.</p>
            </div>
        </div>
    )
}
