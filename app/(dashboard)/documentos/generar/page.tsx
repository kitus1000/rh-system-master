'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { FontFamily } from '@tiptap/extension-font-family'
import { Color } from '@tiptap/extension-color'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { Download, Search, FileText } from 'lucide-react'
import Link from 'next/link'

export default function GenerarDocumentoPage() {
    const [step, setStep] = useState(1) // 1: Select Template, 2: Select Employee, 3: Preview
    const [templates, setTemplates] = useState<any[]>([])
    const [employees, setEmployees] = useState<any[]>([])

    // Search State
    const [searchTerm, setSearchTerm] = useState('')
    const [showEmployeeList, setShowEmployeeList] = useState(false)

    const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null)
    const [previewHtml, setPreviewHtml] = useState('')
    const [headerHtml, setHeaderHtml] = useState('')
    const [footerHtml, setFooterHtml] = useState('')
    const [companyConfig, setCompanyConfig] = useState<any>(null)

    const [generating, setGenerating] = useState(false)
    const previewRef = useRef<HTMLDivElement>(null)

    // Derived filtering logic
    const filteredEmpleados = employees.filter(e => {
        if (!searchTerm) return true
        const term = searchTerm.toLowerCase().trim()
        if (!isNaN(Number(term)) && term !== '') {
            return e.numero_empleado?.toString().includes(term)
        }
        const fullName = `${e.nombre} ${e.apellido_paterno} ${e.apellido_materno || ''}`.toLowerCase()
        return fullName.includes(term)
    }).slice(0, 10)

    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as any).html2canvas = html2canvas
        }
        loadData()
    }, [])

    useEffect(() => {
        if (selectedEmployee && selectedTemplate && step === 2) {
            generatePreview()
        }
    }, [selectedEmployee])

    async function loadData() {
        const { data: t } = await supabase.from('document_templates').select('*')
        setTemplates(t || [])

        const { data: e, error } = await supabase.from('empleados')
            .select(`
                *,
                empleado_adscripciones (
                    cat_departamentos (departamento)
                )
            `)
            .order('nombre', { ascending: true })

        setEmployees(e || [])

        // Load Company Config
        const { data: config } = await supabase.from('configuracion_empresa').select('*').limit(1).single()
        if (config) {
            setCompanyConfig(config)
        } else {
            const saved = localStorage.getItem('rh_config_empresa')
            if (saved) setCompanyConfig(JSON.parse(saved))
        }
    }

    const generatePreview = () => {
        if (!selectedTemplate || !selectedEmployee) return

        const extensions = [
            StarterKit,
            Underline,
            TextStyle,
            FontFamily,
            Color,
            TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
        ]

        // 1. Convert JSON to HTML for all sections
        let body = generateHTML(selectedTemplate.content || {}, extensions)
        let header = selectedTemplate.header_content ? generateHTML(selectedTemplate.header_content, extensions) : ''
        let footer = selectedTemplate.footer_content ? generateHTML(selectedTemplate.footer_content, extensions) : ''

        // Data Prep
        const depto = selectedEmployee.empleado_adscripciones?.[0]?.cat_departamentos?.departamento || ''
        const empresa = companyConfig?.nombre_empresa || 'MI EMPRESA S.A. DE C.V.'

        const variables: Record<string, string> = {
            '{nombre}': selectedEmployee.nombre,
            '{apellido_paterno}': selectedEmployee.apellido_paterno,
            '{apellido_materno}': selectedEmployee.apellido_materno || '',
            '{puesto}': selectedEmployee.puesto || '',
            '{salario}': selectedEmployee.salario_diario ? `$${(selectedEmployee.salario_diario * 30).toFixed(2)}` : '',
            '{fecha_inicio}': selectedEmployee.fecha_contratacion || '',
            '{curp}': selectedEmployee.curp || '',
            '{rfc}': selectedEmployee.rfc || '',
            '{nss}': selectedEmployee.nss || '',
            '{direccion}': selectedEmployee.direccion || '',
            '{numero_empleado}': selectedEmployee.numero_empleado || '',
            '{departamento}': depto,
            '{empresa}': empresa,
            '{fecha_actual}': new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
            '{fecha_baja}': selectedEmployee.fecha_baja || '______________________',
        }

        const replaceVars = (str: string) => {
            let result = str
            Object.entries(variables).forEach(([key, value]) => {
                result = result.replaceAll(key, value || '')
            })
            return result
        }

        setPreviewHtml(replaceVars(body))
        setHeaderHtml(replaceVars(header))
        setFooterHtml(replaceVars(footer))
        setStep(3)
    }

    const downloadPdf = async () => {
        if (!previewRef.current || generating) return
        setGenerating(true)
        console.log("Starting PDF generation...")

        const element = previewRef.current

        const originalColor = element.style.color
        const originalBg = element.style.backgroundColor
        const originalTransform = element.style.transform

        // 1. Force container overrides to HEX 
        element.style.setProperty('color', '#000000', 'important')
        element.style.setProperty('background-color', '#ffffff', 'important')
        element.style.transform = 'none' // Remove zoom

        // 2. Force children to black
        const children = element.querySelectorAll('*')
        children.forEach((node) => {
            const child = node as HTMLElement
            if (!child.style.color) {
                child.dataset['originalColor'] = 'unset'
                child.style.setProperty('color', '#000000', 'important')
            }
        })

        try {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'cm',
                format: 'letter'
            })

            // Calculate width logic:
            // Letter width: 21.59cm
            // jsPDF .html() uses pixels. 1px = 1/96 inch? 
            // Better to match windowWidth to container width.
            // Container width is 21.59cm. At 96dpi -> ~816px.

            await doc.html(element, {
                callback: function (doc) {
                    doc.save(`${selectedTemplate.name}_${selectedEmployee.nombre}.pdf`)
                    restoreStyles()
                    setGenerating(false)
                },
                x: 0,
                y: 0,
                width: 21.59,
                windowWidth: 816, // Forces 21.59cm to map to ~816px visual width, ensuring 1:1 scale
                html2canvas: {
                    useCORS: true,
                    logging: true,
                    backgroundColor: '#ffffff'
                    // NO SCALE HERE! Let jsPDF handle it via width/windowWidth
                }
            })
        } catch (e: any) {
            console.error("PDF Gen Error:", e)
            alert("Error al generar PDF: " + e.message)
            restoreStyles()
            setGenerating(false)
        }

        function restoreStyles() {
            if (!element) return
            element.style.color = originalColor
            element.style.backgroundColor = originalBg
            element.style.transform = originalTransform

            children.forEach((node) => {
                const child = node as HTMLElement
                if (child.dataset['originalColor'] === 'unset') {
                    child.style.removeProperty('color')
                    delete child.dataset['originalColor']
                }
            })
        }
    }

    const reset = () => {
        setStep(1)
        setSelectedEmployee(null)
        setSelectedTemplate(null)
        setSearchTerm('')
        setPreviewHtml('')
        setHeaderHtml('')
        setFooterHtml('')
    }

    // Safe margins
    const margins = selectedTemplate?.margins || { top: 2.5, right: 2.5, bottom: 2.5, left: 2.5 }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Generar Documento</h2>

            {/* Stepper */}
            <div className="flex items-center text-sm font-medium text-zinc-500 mb-8">
                <span className={`${step >= 1 ? 'text-amber-600' : ''}`}>1. Seleccionar Plantilla</span>
                <span className="mx-2">→</span>
                <span className={`${step >= 2 ? 'text-amber-600' : ''}`}>2. Seleccionar Empleado</span>
                <span className="mx-2">→</span>
                <span className={`${step >= 3 ? 'text-amber-600' : ''}`}>3. Vista Previa y Descarga</span>
            </div>

            {step === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {templates.map((t) => (
                        <div key={t.id}
                            onClick={() => { setSelectedTemplate(t); setStep(2) }}
                            className="cursor-pointer bg-white p-6 rounded-lg shadow border border-zinc-200 hover:border-amber-500 transition-all hover:shadow-md">
                            <FileText className="h-8 w-8 text-zinc-400 mb-2" />
                            <h3 className="font-semibold text-zinc-900">{t.name}</h3>
                            <p className="text-xs text-zinc-500 mt-1 capitalize">{t.type}</p>
                        </div>
                    ))}
                    {templates.length === 0 && (
                        <div className="col-span-3 text-center py-10 text-zinc-500">
                            No hay plantillas disponibles. <Link href="/documentos/plantillas/nueva" className="text-amber-600 underline">Crea una primero</Link>.
                        </div>
                    )}
                </div>
            )}

            {step === 2 && (
                <div className="bg-white p-6 rounded-lg shadow border border-zinc-200 max-w-xl mx-auto min-h-[400px]">
                    <h3 className="font-semibold text-zinc-900 mb-4">Buscar Empleado</h3>

                    <div className="relative mb-4">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-zinc-400" />
                        </div>
                        <input
                            type="text"
                            autoComplete="off"
                            className="block w-full pl-10 rounded-md border-zinc-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-3 border text-zinc-900 bg-white"
                            placeholder="Buscar por ID o Apellido..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value)
                                setShowEmployeeList(true)
                            }}
                            onFocus={() => setShowEmployeeList(true)}
                        />
                        {showEmployeeList && (
                            <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm border border-zinc-200">
                                {filteredEmpleados.length === 0 ? (
                                    <div className="cursor-default select-none relative py-2 px-4 text-zinc-500">
                                        No se encontraron resultados para "{searchTerm}"
                                    </div>
                                ) : (
                                    filteredEmpleados.map((emp: any) => (
                                        <div
                                            key={emp.id_empleado}
                                            className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-amber-50 border-b border-zinc-50 last:border-0"
                                            onClick={() => {
                                                setSelectedEmployee(emp)
                                                setSearchTerm(`${emp.nombre} ${emp.apellido_paterno}`)
                                                setShowEmployeeList(false)
                                            }}
                                        >
                                            <div className="flex items-center">
                                                <span className="font-medium block truncate text-zinc-900">
                                                    {emp.nombre} {emp.apellido_paterno} {emp.apellido_materno || ''}
                                                </span>
                                                <span className="ml-2 text-zinc-400 text-xs">#{emp.numero_empleado}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    <div className="text-xs text-zinc-400 mt-1 text-right">
                        Debug: {employees.length} empleados cargados.
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="flex gap-6 h-[calc(100vh-200px)]">
                    <div className="flex-1 bg-zinc-100 p-8 shadow-inner border border-zinc-200 overflow-auto flex justify-center rounded-lg">
                        <div ref={previewRef}
                            className="bg-white shadow-lg text-black prose prose-sm max-w-none text-zinc-900 mx-auto flex flex-col relative"
                            style={{
                                width: '21.59cm',
                                minHeight: '27.94cm',
                                // We apply PADDING for margins, but Header/Footer might be in margin area?
                                // Usually Header/Footer are inside the page boundaries.
                                // We will render them absolutely or flex?
                                // Flex is safer.
                                padding: `${margins.top}cm ${margins.right}cm ${margins.bottom}cm ${margins.left}cm`,
                                transform: 'scale(1)',
                                transformOrigin: 'top center'
                            }}
                        >
                            {/* Header Section */}
                            {headerHtml && (
                                <div className="mb-4 text-sm text-zinc-600 border-b border-zinc-100 pb-2" dangerouslySetInnerHTML={{ __html: headerHtml }} />
                            )}

                            {/* Body Section */}
                            <div className="flex-1" dangerouslySetInnerHTML={{ __html: previewHtml }} />

                            {/* Footer Section */}
                            {footerHtml && (
                                <div className="mt-8 pt-4 border-t border-zinc-100 text-xs text-zinc-500 text-center" dangerouslySetInnerHTML={{ __html: footerHtml }} />
                            )}
                        </div>
                    </div>
                    <div className="w-64 space-y-4">
                        <button
                            onClick={downloadPdf}
                            disabled={generating}
                            className="w-full flex items-center justify-center gap-2 bg-black text-white py-3 rounded-lg font-medium hover:bg-zinc-800 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                            {generating ? (
                                <>Generando...</>
                            ) : (
                                <>
                                    <Download className="h-5 w-5" />
                                    Descargar PDF
                                </>
                            )}
                        </button>
                        <button onClick={reset} className="w-full py-2 text-zinc-600 hover:text-zinc-900 text-sm">
                            Empezar de nuevo
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
