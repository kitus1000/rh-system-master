'use client'

import Link from 'next/link'
import { FileText, Files, PlusCircle } from 'lucide-react'

export default function DocumentosPage() {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Gestión de Documentos</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Plantillas Card */}
                <Link href="/documentos/plantillas" className="group">
                    <div className="bg-white p-6 rounded-lg shadow border border-zinc-200 hover:border-amber-500 transition-colors h-full">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-amber-100 rounded-full text-amber-600">
                                <Files className="h-6 w-6" />
                            </div>
                        </div>
                        <h3 className="text-lg font-semibold text-zinc-900 group-hover:text-amber-600 transition-colors">Plantillas</h3>
                        <p className="text-zinc-500 mt-2 text-sm">
                            Crea y gestiona modelos para contratos, cartas y constancias.
                        </p>
                    </div>
                </Link>

                {/* Generar Documento Card */}
                <Link href="/documentos/generar" className="group">
                    <div className="bg-white p-6 rounded-lg shadow border border-zinc-200 hover:border-amber-500 transition-colors h-full">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                                <FileText className="h-6 w-6" />
                            </div>
                        </div>
                        <h3 className="text-lg font-semibold text-zinc-900 group-hover:text-blue-600 transition-colors">Generar Documento</h3>
                        <p className="text-zinc-500 mt-2 text-sm">
                            Crea un documento nuevo utilizando los datos de un empleado.
                        </p>
                    </div>
                </Link>
            </div>
        </div>
    )
}
