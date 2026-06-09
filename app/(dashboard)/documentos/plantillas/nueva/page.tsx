'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase/client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import { FontFamily } from '@tiptap/extension-font-family'
import { Color } from '@tiptap/extension-color'
import {
    Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Save, ArrowLeft, Type, ZoomIn, ZoomOut, Settings, LayoutTemplate
} from 'lucide-react'
import Link from 'next/link'
import { Rnd } from 'react-rnd'
import { nanoid } from 'nanoid'

const VARIABLES = [
    { label: 'Nombre', value: '{nombre}' },
    { label: 'Apellido Paterno', value: '{apellido_paterno}' },
    { label: 'Apellido Materno', value: '{apellido_materno}' },
    { label: 'Puesto', value: '{puesto}' },
    { label: 'Salario', value: '{salario}' },
    { label: 'Fecha Inicio', value: '{fecha_inicio}' },
    { label: 'CURP', value: '{curp}' },
    { label: 'RFC', value: '{rfc}' },
    { label: 'NSS', value: '{nss}' },
    { label: 'Dirección', value: '{direccion}' },
    { label: 'Empresa', value: '{empresa}' },
    { label: 'Departamento', value: '{departamento}' },
    { label: 'Fecha Actual', value: '{fecha_actual}' },
    { label: 'Fecha Baja', value: '{fecha_baja}' },
]

// Single Tab for Settings, but Main view is WYSIWYG
type EditorMode = 'edit' | 'settings'
type Section = 'header' | 'body' | 'footer'

type TextBlock = {
    id: string
    section: Section
    x: number
    y: number
    w: number
    h: number
    z: number
    text: string
}

const MIN_ZOOM = 50
const MAX_ZOOM = 200

export default function NuevaPlantillaPage() {
    const router = useRouter()
    const [name, setName] = useState('')
    const [type, setType] = useState('contrato')
    const [saving, setSaving] = useState(false)
    const [mode, setMode] = useState<EditorMode>('edit')
    const [activeSection, setActiveSection] = useState<Section>('body')

    // Blocks State
    const [blocks, setBlocks] = useState<TextBlock[]>([])
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
    const [editingBlockId, setEditingBlockId] = useState<string | null>(null)

    // Config
    const [zoom, setZoom] = useState(90)
    const scale = zoom / 100 // Derived scale
    const [margins, setMargins] = useState({ top: 2.5, right: 2.5, bottom: 2.5, left: 2.5 })

    const editorConfig = (placeholder: string) => ({
        extensions: [
            StarterKit,
            Underline,
            TextStyle,
            FontFamily,
            Color,
            TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
            Placeholder.configure({ placeholder }),
        ],
        content: '',
        immediatelyRender: false,
        editorProps: {
            attributes: {
                // Simplified classes, layout handled by container
                class: 'focus:outline-none w-full h-full text-zinc-900',
            },
        },
    })

    const bodyEditor = useEditor(editorConfig('Escribe el contenido principal...'))
    const headerEditor = useEditor(editorConfig('Encabezado (opcional)...'))
    const footerEditor = useEditor(editorConfig('Pie de página (opcional)...'))

    // Helper to get active editor for Toolbar commands
    const getActiveEditor = () => {
        if (activeSection === 'header') return headerEditor
        if (activeSection === 'footer') return footerEditor
        return bodyEditor
    }
    const activeEditor = getActiveEditor()

    const insertVariable = (variable: string) => {
        activeEditor?.chain().focus().insertContent(` ${variable} `).run()
    }

    const setFontFamily = (font: string) => {
        activeEditor?.chain().focus().setFontFamily(font).run()
    }

    // --- Block Management ---
    const addTextBlock = () => {
        const count = blocks.length
        const newBlock: TextBlock = {
            id: nanoid(),
            section: activeSection,
            x: 60 + (count * 20) % 300,
            y: 80 + (count * 20) % 400,
            w: 320,
            h: 120,
            z: Date.now(),
            text: 'Nuevo bloque...'
        }
        setBlocks(prev => [...prev, newBlock])
        setSelectedBlockId(newBlock.id)
        // Auto-enter edit mode for new blocks
        setEditingBlockId(newBlock.id)
    }

    const updateBlock = (id: string, patch: Partial<TextBlock>) => {
        setBlocks(prev => prev.map(b => (b.id === id ? { ...b, ...patch } : b)))
    }

    const bringToFront = () => {
        if (!selectedBlockId) return
        updateBlock(selectedBlockId, { z: Date.now() })
    }

    const sendToBack = () => {
        if (!selectedBlockId) return
        // el más bajo
        const minZ = Math.min(...blocks.map(b => b.z), 0)
        updateBlock(selectedBlockId, { z: minZ - 1 })
    }

    const deleteSelectedBlock = () => {
        if (!selectedBlockId) return
        setBlocks(prev => prev.filter(b => b.id !== selectedBlockId))
        setSelectedBlockId(null)
    }

    // Hotkeys: Delete/Backspace borra bloque seleccionado, ESC deselecciona
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (!selectedBlockId) return

            if (e.key === 'Escape') {
                setSelectedBlockId(null)
                setEditingBlockId(null)
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                const target = e.target as HTMLElement
                const isEditing = target?.getAttribute?.('data-textblock') === 'true'
                if (!isEditing) {
                    e.preventDefault()
                    deleteSelectedBlock()
                }
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [selectedBlockId])

    const handleSave = async () => {
        if (!name) {
            alert('Por favor, ingresa un nombre para la plantilla.')
            return
        }
        setSaving(true)
        try {
            const payload = {
                name,
                type,
                content: bodyEditor?.getJSON(),
                header_content: headerEditor?.getJSON(),
                footer_content: footerEditor?.getJSON(),
                margins,
                blocks
            }
            const { error } = await supabase.from('document_templates').insert(payload)
            if (error) throw error
            alert('Plantilla guardada correctamente.')
            router.push('/documentos/plantillas')
        } catch (e: any) {
            console.error(e)
            alert('Error al guardar: ' + e.message)
        } finally {
            setSaving(false)
        }
    }

    if (!bodyEditor || !headerEditor || !footerEditor) return null

    return (
        <div className="space-y-4 h-[calc(100vh-100px)] flex flex-col">
            {/* Top Bar */}
            <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-zinc-200">
                <div className="flex items-center gap-4">
                    <Link href="/documentos/plantillas" className="text-zinc-400 hover:text-zinc-600">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <input
                            type="text"
                            className="text-lg font-bold text-zinc-900 border-none focus:ring-0 p-0 placeholder-zinc-300 w-64"
                            placeholder="Nombre de la Plantilla"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <div className="text-xs text-zinc-500 flex gap-2 items-center">
                            Tipo:
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="text-xs py-0 pl-1 pr-6 border-none text-zinc-600 font-medium bg-transparent focus:ring-0 cursor-pointer"
                            >
                                <option value="contrato">Contrato</option>
                                <option value="carta">Carta</option>
                                <option value="constancia">Constancia</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setMode(mode === 'settings' ? 'edit' : 'settings')} className={`p-2 rounded ${mode === 'settings' ? 'bg-amber-100 text-amber-900' : 'text-zinc-500 hover:bg-zinc-100'}`} title="Configuración de Página">
                        <Settings className="h-5 w-5" />
                    </button>
                    <div className="w-px h-6 bg-zinc-300 mx-2" />
                    <div className="flex items-center gap-2 bg-zinc-100 rounded-md px-2 py-1">
                        <ZoomOut className="h-4 w-4 text-zinc-500 cursor-pointer" onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - 10))} />
                        <span className="text-xs font-mono w-8 text-center">{zoom}%</span>
                        <ZoomIn className="h-4 w-4 text-zinc-500 cursor-pointer" onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + 10))} />
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                        <Save className="-ml-1 mr-2 h-4 w-4" />
                        Guardar
                    </button>
                </div>
            </div>

            {/* Main Workspace */}
            <div className="flex flex-1 gap-4 overflow-hidden">

                {/* Left Sidebar: Variables */}
                <div className="w-64 flex flex-col bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
                    <div className="p-3 bg-zinc-50 border-b border-zinc-200 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        Variables
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {VARIABLES.map((v) => (
                            <button
                                key={v.value}
                                onClick={() => insertVariable(v.value)}
                                className="w-full text-left px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-amber-50 hover:text-amber-700 rounded transition-colors group"
                            >
                                <span className="text-amber-600 group-hover:text-amber-800 opacity-50 mr-2">{'{ }'}</span>
                                {v.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Center: Editor Canvas */}
                <div className="flex-1 bg-zinc-100 rounded-lg border border-zinc-200 overflow-hidden flex flex-col relative">

                    {mode === 'settings' ? (
                        <div className="p-8 max-w-2xl mx-auto w-full">
                            <h3 className="text-lg font-bold text-zinc-900 mb-6">Configuración de Página</h3>
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200 space-y-6">
                                <div>
                                    <h4 className="font-medium text-zinc-900 mb-4 flex items-center gap-2">
                                        <LayoutTemplate className="h-4 w-4" /> Márgenes (cm)
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-zinc-500 mb-1">Superior</label>
                                            <input type="number" step="0.1" value={margins.top} onChange={e => setMargins({ ...margins, top: parseFloat(e.target.value) })} className="w-full border-zinc-300 rounded text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-zinc-500 mb-1">Inferior</label>
                                            <input type="number" step="0.1" value={margins.bottom} onChange={e => setMargins({ ...margins, bottom: parseFloat(e.target.value) })} className="w-full border-zinc-300 rounded text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-zinc-500 mb-1">Izquierdo</label>
                                            <input type="number" step="0.1" value={margins.left} onChange={e => setMargins({ ...margins, left: parseFloat(e.target.value) })} className="w-full border-zinc-300 rounded text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-zinc-500 mb-1">Derecho</label>
                                            <input type="number" step="0.1" value={margins.right} onChange={e => setMargins({ ...margins, right: parseFloat(e.target.value) })} className="w-full border-zinc-300 rounded text-sm" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setMode('edit')} className="mt-8 mx-auto block text-zinc-500 underline text-sm">Volver al editor</button>
                        </div>
                    ) : (
                        <>
                            {/* Toolbar */}
                            <div className="bg-white border-b border-zinc-200 p-2 flex items-center gap-2 overflow-x-auto shadow-sm z-10 justify-center">
                                <span className="text-xs text-zinc-400 uppercase font-black mr-2 tracking-widest text-[0.6rem]">{activeSection}</span>
                                <div className="w-px h-6 bg-zinc-300 mx-2" />
                                <ToolbarButton onClick={() => activeEditor?.chain().focus().toggleBold().run()} active={activeEditor?.isActive('bold')} icon={Bold} />
                                <ToolbarButton onClick={() => activeEditor?.chain().focus().toggleItalic().run()} active={activeEditor?.isActive('italic')} icon={Italic} />
                                <ToolbarButton onClick={() => activeEditor?.chain().focus().toggleUnderline().run()} active={activeEditor?.isActive('underline')} icon={UnderlineIcon} />
                                <div className="w-px h-6 bg-zinc-300 mx-2" />
                                <ToolbarButton onClick={() => activeEditor?.chain().focus().setTextAlign('left').run()} active={activeEditor?.isActive({ textAlign: 'left' })} icon={AlignLeft} />
                                <ToolbarButton onClick={() => activeEditor?.chain().focus().setTextAlign('center').run()} active={activeEditor?.isActive({ textAlign: 'center' })} icon={AlignCenter} />
                                <ToolbarButton onClick={() => activeEditor?.chain().focus().setTextAlign('right').run()} active={activeEditor?.isActive({ textAlign: 'right' })} icon={AlignRight} />
                                <ToolbarButton onClick={() => activeEditor?.chain().focus().setTextAlign('justify').run()} active={activeEditor?.isActive({ textAlign: 'justify' })} icon={AlignJustify} />
                                <div className="w-px h-6 bg-zinc-300 mx-2" />
                                <select
                                    className="text-xs border-zinc-300 rounded py-1 pl-2 pr-6 h-8 w-32 bg-white text-zinc-900"
                                    onChange={(e) => setFontFamily(e.target.value)}
                                    value={activeEditor?.getAttributes('textStyle').fontFamily || ''}
                                >
                                    <option value="" className="text-zinc-500">Fuente (Default)</option>
                                    <option value="Arial" style={{ fontFamily: 'Arial' }}>Arial</option>
                                    <option value="Times New Roman" style={{ fontFamily: 'Times New Roman' }}>Times New Roman</option>
                                    <option value="Courier New" style={{ fontFamily: 'Courier New' }}>Courier New</option>
                                    <option value="Georgia" style={{ fontFamily: 'Georgia' }}>Georgia</option>
                                    <option value="Verdana" style={{ fontFamily: 'Verdana' }}>Verdana</option>
                                </select>

                                {/* Font Size Dropdown */}
                                <select
                                    className="text-xs border-zinc-300 rounded py-1 pl-2 pr-6 h-8 w-20 bg-white text-zinc-900 cursor-pointer"
                                    onChange={(e) => {
                                        const size = e.target.value
                                        if (size) {
                                            activeEditor?.chain().focus().setMark('textStyle', { fontSize: size }).run()
                                        } else {
                                            activeEditor?.chain().focus().unsetMark('textStyle').run()
                                        }
                                    }}
                                    value={activeEditor?.getAttributes('textStyle').fontSize || ''}
                                >
                                    <option value="" className="text-zinc-500">Tam.</option>
                                    <option value="10px">10px</option>
                                    <option value="11px">11px</option>
                                    <option value="12px">12px</option>
                                    <option value="14px">14px</option>
                                    <option value="16px">16px</option>
                                    <option value="18px">18px</option>
                                    <option value="20px">20px</option>
                                    <option value="24px">24px</option>
                                    <option value="30px">30px</option>
                                </select>

                                <div className="w-px h-6 bg-zinc-300 mx-2" />

                                <button
                                    onClick={addTextBlock}
                                    className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 transition-colors"
                                    title="Insertar bloque de texto"
                                >
                                    <Type className="h-4 w-4" />
                                    Bloque
                                </button>

                                <button
                                    onClick={bringToFront}
                                    disabled={!selectedBlockId}
                                    className="rounded-md px-2 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-40"
                                    title="Traer al frente"
                                >
                                    ↑ Frente
                                </button>

                                <button
                                    onClick={sendToBack}
                                    disabled={!selectedBlockId}
                                    className="rounded-md px-2 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-40"
                                    title="Enviar atrás"
                                >
                                    ↓ Atrás
                                </button>
                            </div>

                            {/* Canvas Wrapper with Zoom */}
                            <div className="flex-1 overflow-auto bg-zinc-200/50 p-4 md:p-8 flex justify-center cursor-default" onClick={() => {
                                // Clicking canvas background doesn't focus
                            }}>
                                <div
                                    style={{
                                        transform: `scale(${scale})`,
                                        transformOrigin: 'top center',
                                        transition: 'transform 0.2s ease-in-out'
                                    }}
                                >
                                    {/* Real Page - No Scale Transform here, just physical dimensions */}
                                    <div
                                        className="bg-white shadow-xl flex flex-col relative transition-all"
                                        style={{
                                            width: '21.59cm',      // Letter Width
                                            minHeight: '27.94cm',  // Letter Height
                                        }}
                                    >
                                        {/* Margin Guides (Visual only) */}
                                        <div
                                            className="absolute pointer-events-none inset-0 z-0"
                                            style={{
                                                paddingTop: `${margins.top}cm`,
                                                paddingRight: `${margins.right}cm`,
                                                paddingBottom: `${margins.bottom}cm`,
                                                paddingLeft: `${margins.left}cm`,
                                            }}
                                        >
                                            <div className="w-full h-full border border-dashed border-zinc-300 opacity-50" />
                                        </div>

                                        {/* GLOBAL BLOCKS LAYER - Covers entire page, on top of content */}
                                        <BlocksLayer
                                            blocks={blocks}
                                            selectedBlockId={selectedBlockId}
                                            setSelectedBlockId={setSelectedBlockId}
                                            editingBlockId={editingBlockId}
                                            setEditingBlockId={setEditingBlockId}
                                            updateBlock={updateBlock}
                                            scale={scale}
                                        />

                                        {/* Content Area (Respects Margins) */}
                                        <div
                                            className="relative flex flex-col h-full z-10"
                                            style={{
                                                paddingTop: `${margins.top}cm`,
                                                paddingRight: `${margins.right}cm`,
                                                paddingBottom: `${margins.bottom}cm`,
                                                paddingLeft: `${margins.left}cm`,
                                            }}
                                        >
                                            <div
                                                onClick={() => {
                                                    // Set active section or focus
                                                    bodyEditor?.commands.focus()
                                                    setSelectedBlockId(null)
                                                    setEditingBlockId(null)
                                                }}
                                                className="flex-1 h-full outline-none"
                                            >
                                                <EditorContent editor={bodyEditor} className="h-full" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="absolute bottom-4 right-4 bg-black/75 text-white px-3 py-1 rounded-full text-xs backdrop-blur-sm pointer-events-none">
                                Editando: {activeSection === 'header' ? 'Encabezado' : activeSection === 'footer' ? 'Pie de página' : 'Contenido Principal'}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

function ToolbarButton({ onClick, active, icon: Icon }: any) {
    return (
        <button
            onClick={onClick}
            className={`p-1.5 rounded hover:bg-zinc-100 transition-colors ${active ? 'bg-zinc-200 text-black shadow-inner' : 'text-zinc-600'}`}
        >
            <Icon className="h-4 w-4" />
        </button>
    )
}

function BlocksLayer({
    blocks,
    selectedBlockId,
    setSelectedBlockId,
    editingBlockId,
    setEditingBlockId,
    updateBlock,
    scale,
}: {
    blocks: any[]
    selectedBlockId: string | null
    setSelectedBlockId: (id: string | null) => void
    editingBlockId: string | null
    setEditingBlockId: (id: string | null) => void
    updateBlock: (id: string, patch: any) => void
    scale: number
}) {
    // Retornamos Fragmento para no tener un DIV gigante bloqueando clicks.
    // Los bloques Rnd son absolutos y se posicionarán relativos al padre (la hoja).
    return (
        <>
            {blocks
                .slice()
                .sort((a, b) => a.z - b.z)
                .map((b) => {
                    const isSelected = selectedBlockId === b.id
                    const isEditing = editingBlockId === b.id

                    return (
                        <Rnd
                            key={b.id}
                            size={{ width: b.w, height: b.h }}
                            position={{ x: b.x, y: b.y }}
                            scale={scale}
                            // Eliminamos dragHandleClassName para arrastrar de TODOS LADOS
                            // dragHandleClassName="block-handle"
                            // Eliminamos cancel para que se pueda arrastrar desde el texto (si no estamos editando)
                            // cancel=".block-editor"
                            minWidth={120}
                            minHeight={60}
                            disableDragging={isEditing}
                            enableResizing={{
                                top: !isEditing, right: !isEditing, bottom: !isEditing, left: !isEditing,
                                topRight: !isEditing, bottomRight: !isEditing, bottomLeft: !isEditing, topLeft: !isEditing,
                            }}
                            onDragStart={() => {
                                setSelectedBlockId(b.id)
                                if (isEditing) setEditingBlockId(null)
                            }}
                            onDragStop={(e, d) => updateBlock(b.id, { x: d.x, y: d.y })}
                            onResizeStart={() => setSelectedBlockId(b.id)}
                            onResizeStop={(e, direction, ref, delta, position) => {
                                updateBlock(b.id, {
                                    w: ref.offsetWidth,
                                    h: ref.offsetHeight,
                                    x: position.x,
                                    y: position.y,
                                })
                            }}
                            style={{ zIndex: b.z, pointerEvents: 'auto' }}
                        >
                            <div
                                data-block="true"
                                className={`h-full w-full rounded-md bg-white shadow-sm overflow-hidden border flex flex-col
                  ${isSelected ? 'border-amber-500 ring-2 ring-amber-300' : 'border-zinc-300 hover:border-zinc-400'}
                  ${isEditing ? 'ring-2 ring-blue-400 border-blue-500 cursor-text' : 'cursor-move'}`}
                                onMouseDown={(e) => {
                                    // Importante: al pulsar, seleccionamos
                                    e.stopPropagation()
                                    setSelectedBlockId(b.id)
                                }}
                                onClick={(e) => {
                                    // Aseguramos que el click no pase al padre
                                    e.stopPropagation()
                                }}
                                onDoubleClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedBlockId(b.id)
                                    setEditingBlockId(b.id)
                                }}
                            >
                                {/* BARRA INDICADORA (Visual) para saber que es un bloque */}
                                <div
                                    className={`px-2 py-1 text-[10px] uppercase font-bold select-none border-b flex items-center justify-between
                    ${isSelected ? 'bg-amber-100 text-amber-900 border-amber-200' : 'bg-zinc-50 text-zinc-400 border-zinc-100'}`}
                                >
                                    <span>TEXTO</span>
                                    {isSelected && !isEditing && <span className="text-[9px] opacity-75">DOBLE CLIC EDITAR</span>}
                                </div>

                                {/* TEXTO CONTENT EDITABLE
                                    Si NO estamos editando, contentEditable=false -> arrastrable 
                                    Si estamos editando, contentEditable=true -> interactivo (seleccionar texto)
                                */}
                                <div
                                    className={`block-editor flex-1 w-full p-2 text-[12px] leading-5 text-zinc-900 outline-none overflow-auto bg-white
                                    ${isEditing ? 'cursor-text select-text' : 'cursor-move select-none'}`}
                                    contentEditable={isEditing}
                                    suppressContentEditableWarning
                                    data-textblock="true"
                                    onBlur={() => setEditingBlockId(null)}
                                    onInput={(e) =>
                                        updateBlock(b.id, {
                                            text: (e.currentTarget as HTMLDivElement).innerText,
                                        })
                                    }
                                >
                                    {b.text}
                                </div>
                            </div>
                        </Rnd>
                    )
                })}
        </>
    )
}
