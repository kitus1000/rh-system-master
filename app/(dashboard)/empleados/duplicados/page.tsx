'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase/client'
import { 
    Users, Search, RefreshCw, AlertTriangle, CheckCircle2, ArrowRight, 
    Trash2, Link as LinkIcon, ShieldCheck, Heart, UserCheck, Sparkles, Filter
} from 'lucide-react'
import Link from 'next/link'

interface DuplicateGroup {
    key: string
    items: any[]
}

export default function DuplicadosPage() {
    const [targetType, setTargetType] = useState<'empleados' | 'pacientes'>('empleados')
    const [empleados, setEmpleados] = useState<any[]>([])
    const [pacientes, setPacientes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([])
    const [merging, setMerging] = useState(false)
    const [selectedMasterId, setSelectedMasterId] = useState<Record<string, string>>({})
    const [successMsg, setSuccessMsg] = useState('')

    useEffect(() => {
        fetchAllData()
    }, [])

    useEffect(() => {
        runDetection()
    }, [targetType, empleados, pacientes])

    const fetchAllData = async () => {
        setLoading(true)
        try {
            const [empRes, pacRes] = await Promise.all([
                supabase.from('empleados').select('*').order('nombre'),
                supabase.from('pacientes').select('*, empleados(nombre, apellido_paterno)').order('nombre_completo')
            ])

            if (empRes.data) setEmpleados(empRes.data)
            if (pacRes.data) setPacientes(pacRes.data)
        } catch (err) {
            console.error('Error fetching data for duplicates:', err)
        } finally {
            setLoading(false)
        }
    }

    // Normalize string: uppercase, remove accents, remove connectors, sort tokens
    const normalizeNameTokens = (str?: string | null): string[] => {
        if (!str) return []
        const clean = str
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove accents
            .replace(/[^A-Z0-9\s]/g, ' ')  // Remove special chars
            .trim()

        const connectors = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'VDA', 'SAN', 'SANTA', 'EL', 'JR', 'SR'])
        const tokens = clean
            .split(/\s+/)
            .filter(w => w.length > 1 && !connectors.has(w))

        return tokens.sort()
    }

    const runDetection = () => {
        const sourceData = targetType === 'empleados' ? empleados : pacientes
        const groupsMap: Record<string, any[]> = {}

        sourceData.forEach(item => {
            let fullName = ''
            if (targetType === 'empleados') {
                fullName = `${item.nombre || ''} ${item.apellido_paterno || ''} ${item.apellido_materno || ''}`.trim()
            } else {
                fullName = (item.nombre_completo || '').trim()
            }

            const tokens = normalizeNameTokens(fullName)
            if (tokens.length < 2) return // Skip very short single names

            const key = tokens.join('|')
            if (!groupsMap[key]) {
                groupsMap[key] = []
            }
            groupsMap[key].push({ ...item, _computedName: fullName })
        })

        // Also perform fuzzy Jaccard token overlap for near matches (e.g. 2 of 3 words match)
        const keys = Object.keys(groupsMap)
        const duplicateGroups: DuplicateGroup[] = []
        const visitedKeys = new Set<string>()

        for (let i = 0; i < keys.length; i++) {
            const k1 = keys[i]
            if (visitedKeys.has(k1)) continue

            const itemsInGroup = [...groupsMap[k1]]
            const tokens1 = k1.split('|')

            // If exact token match has > 1 items
            if (itemsInGroup.length > 1) {
                visitedKeys.add(k1)
                duplicateGroups.push({ key: k1, items: itemsInGroup })
                continue
            }

            // Otherwise check fuzzy overlap with remaining keys
            const fuzzyMatches: any[] = [...itemsInGroup]
            for (let j = i + 1; j < keys.length; j++) {
                const k2 = keys[j]
                if (visitedKeys.has(k2)) continue

                const tokens2 = k2.split('|')
                const set2 = new Set(tokens2)
                const intersection = tokens1.filter(t => set2.has(t))
                const unionSize = new Set([...tokens1, ...tokens2]).size

                const similarity = intersection.length / unionSize
                if (similarity >= 0.75 && intersection.length >= 2) {
                    fuzzyMatches.push(...groupsMap[k2])
                    visitedKeys.add(k2)
                }
            }

            if (fuzzyMatches.length > 1) {
                visitedKeys.add(k1)
                duplicateGroups.push({ key: k1, items: fuzzyMatches })
            }
        }

        setDuplicates(duplicateGroups)

        // Initialize default master selections (select first item as default master)
        const initialMasters: Record<string, string> = {}
        duplicateGroups.forEach(g => {
            const firstId = targetType === 'empleados' ? g.items[0].id_empleado : g.items[0].id_paciente
            initialMasters[g.key] = firstId
        })
        setSelectedMasterId(initialMasters)
    }

    const handleMergeCluster = async (group: DuplicateGroup) => {
        const masterId = selectedMasterId[group.key]
        if (!masterId) return alert('Por favor selecciona cuál será el registro Maestro.')

        const duplicateItems = group.items.filter(item => {
            const itemId = targetType === 'empleados' ? item.id_empleado : item.id_paciente
            return itemId !== masterId
        })

        if (duplicateItems.length === 0) return alert('No hay registros duplicados para unificar en este grupo.')

        const masterObj = group.items.find(item => (targetType === 'empleados' ? item.id_empleado : item.id_paciente) === masterId)
        const masterName = masterObj?._computedName || 'Registro Principal'

        const confirmMsg = `¿Confirma que desea unificar ${duplicateItems.length} registro(s) duplicados hacia el Maestro "${masterName}"?\n\nTodas las referencias (beneficiarios, pases médicos y consultas) serán re-vinculadas al registro Maestro y los duplicados serán eliminados.`
        if (!confirm(confirmMsg)) return

        setMerging(true)
        setSuccessMsg('')

        try {
            for (const dup of duplicateItems) {
                const dupId = targetType === 'empleados' ? dup.id_empleado : dup.id_paciente

                if (targetType === 'empleados') {
                    // Re-link pacientes (beneficiaries)
                    await supabase.from('pacientes').update({ id_empleado: masterId }).eq('id_empleado', dupId)
                    
                    // Re-link pases_medicos
                    await supabase.from('pases_medicos').update({ id_empleado: masterId }).eq('id_empleado', dupId)

                    // Re-link logistica_viajes_programados
                    await supabase.from('logistica_viajes_programados').update({ id_empleado: masterId }).eq('id_empleado', dupId)

                    // Re-link logistica_reportes_diarios
                    await supabase.from('logistica_reportes_diarios').update({ id_empleado: masterId }).eq('id_empleado', dupId)

                    // Delete duplicate employee
                    const { error: delErr } = await supabase.from('empleados').delete().eq('id_empleado', dupId)
                    if (delErr) console.warn('Error deleting duplicate employee:', delErr)

                } else {
                    // Re-link pases_medicos
                    await supabase.from('pases_medicos').update({ id_paciente: masterId }).eq('id_paciente', dupId)

                    // Re-link consultas_medicas
                    await supabase.from('consultas_medicas').update({ id_paciente: masterId }).eq('id_paciente', dupId)

                    // Delete duplicate patient
                    const { error: delErr } = await supabase.from('pacientes').delete().eq('id_paciente', dupId)
                    if (delErr) console.warn('Error deleting duplicate patient:', delErr)
                }
            }

            setSuccessMsg(`¡Unificación exitosa! Se consolidaron los registros hacia "${masterName}".`)
            await fetchAllData()

        } catch (err: any) {
            console.error('Error merging records:', err)
            alert('Error durante la unificación: ' + err.message)
        } finally {
            setMerging(false)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 bg-white border border-zinc-200 rounded-3xl p-12 shadow-xs">
                <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                <div className="text-center space-y-1">
                    <h3 className="text-sm font-black text-zinc-800 uppercase">Analizando Padrón de Personal y Beneficiarios...</h3>
                    <p className="text-xs text-zinc-500">Ejecutando escáner de coincidencia de nombres invertidos y duplicados.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto font-sans pb-20">
            {/* Header */}
            <div className="bg-zinc-900 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Sparkles className="w-40 h-40" />
                </div>
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 bg-amber-500 text-black rounded-2xl flex items-center justify-center font-black">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                            Detector y Unificador de Duplicados
                        </h1>
                        <p className="text-zinc-400 text-xs mt-0.5">Depuración inteligente de nombres invertidos y registros redundantes</p>
                    </div>
                </div>

                <Link
                    href="/empleados"
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold rounded-xl transition-colors border border-zinc-700"
                >
                    &larr; Volver a Empleados
                </Link>
            </div>

            {/* Target Type Selector */}
            <div className="flex gap-2 p-1.5 bg-zinc-200/80 rounded-2xl">
                <button
                    onClick={() => setTargetType('empleados')}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${
                        targetType === 'empleados'
                            ? 'bg-white text-zinc-900 shadow-sm'
                            : 'text-zinc-600 hover:text-black'
                    }`}
                >
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span>👔 Duplicados en Trabajadores ({empleados.length} Registros)</span>
                </button>
                <button
                    onClick={() => setTargetType('pacientes')}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${
                        targetType === 'pacientes'
                            ? 'bg-white text-zinc-900 shadow-sm'
                            : 'text-zinc-600 hover:text-black'
                    }`}
                >
                    <Heart className="w-4 h-4 text-amber-600" />
                    <span>👨‍👩‍👧‍👦 Duplicados en Beneficiarios ({pacientes.length} Registros)</span>
                </button>
            </div>

            {/* Success Banner */}
            {successMsg && (
                <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <span>{successMsg}</span>
                </div>
            )}

            {/* Duplicates List */}
            <div className="space-y-4">
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <span className="text-xs font-black text-zinc-800 uppercase">
                            Coincidencias Detectadas: <strong className="text-amber-600 font-extrabold">{duplicates.length} Grupos Duplicados</strong>
                        </span>
                    </div>
                    <button onClick={fetchAllData} className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5" /> Re-escanear
                    </button>
                </div>

                {duplicates.length === 0 ? (
                    <div className="bg-white border border-zinc-200 rounded-3xl p-12 text-center space-y-3">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl mx-auto flex items-center justify-center font-black">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-black text-zinc-800 uppercase">¡Excelente! No se encontraron nombres duplicados</h3>
                        <p className="text-xs text-zinc-500 max-w-md mx-auto">
                            El padrón de {targetType === 'empleados' ? 'trabajadores' : 'beneficiarios'} no presenta coincidencias o nombres invertidos no unificados.
                        </p>
                    </div>
                ) : (
                    duplicates.map((group, idx) => {
                        const currentMaster = selectedMasterId[group.key]

                        return (
                            <div key={group.key} className="bg-white border border-amber-200 rounded-3xl p-6 shadow-xs space-y-4 relative overflow-hidden">
                                <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />

                                <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center">
                                            #{idx + 1}
                                        </span>
                                        <h3 className="text-sm font-black text-zinc-900 uppercase">
                                            Grupo de Coincidencia ({group.items.length} Registros)
                                        </h3>
                                    </div>
                                    <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase">
                                        Firma: {group.key.replace(/\|/g, ' ')}
                                    </span>
                                </div>

                                {/* Items Comparison Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {group.items.map((item) => {
                                        const itemId = targetType === 'empleados' ? item.id_empleado : item.id_paciente
                                        const isSelectedMaster = itemId === currentMaster

                                        return (
                                            <div
                                                key={itemId}
                                                onClick={() => setSelectedMasterId(prev => ({ ...prev, [group.key]: itemId }))}
                                                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-3 relative ${
                                                    isSelectedMaster
                                                        ? 'bg-emerald-50/80 border-emerald-500 text-emerald-950 shadow-sm'
                                                        : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:border-zinc-300'
                                                }`}
                                            >
                                                {isSelectedMaster && (
                                                    <span className="absolute top-3 right-3 text-[9px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 shadow-xs">
                                                        <CheckCircle2 className="w-3 h-3" /> REGISTRO MAESTRO
                                                    </span>
                                                )}

                                                <div className="space-y-1">
                                                    <div className="font-black text-sm uppercase text-zinc-900 pr-24">
                                                        {item._computedName}
                                                    </div>
                                                    <div className="text-[10px] font-mono text-zinc-500 font-semibold">
                                                        ID: {itemId}
                                                    </div>
                                                </div>

                                                <div className="bg-white/80 p-2.5 rounded-xl border border-zinc-200/80 text-[11px] font-mono space-y-1">
                                                    {targetType === 'empleados' ? (
                                                        <>
                                                            <div>Depto: <strong>{item.departamento || 'Sin Asignar'}</strong></div>
                                                            <div>Puesto: <strong>{item.puesto || 'General'}</strong></div>
                                                            {item.numero_empleado && <div>No. Empleado: <strong>{item.numero_empleado}</strong></div>}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div>Parentesco: <strong>{item.parentesco || 'Beneficiario'}</strong></div>
                                                            <div>Trabajador Asociado: <strong>{item.empleados ? `${item.empleados.nombre || ''} ${item.empleados.apellido_paterno || ''}` : 'Población General'}</strong></div>
                                                        </>
                                                    )}
                                                </div>

                                                <div className="text-[10px] font-bold text-center">
                                                    {isSelectedMaster ? (
                                                        <span className="text-emerald-700">🟢 Conservar como Registro Principal</span>
                                                    ) : (
                                                        <span className="text-rose-600">🔴 Se unificará y eliminará</span>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Action Bar */}
                                <div className="pt-2 flex justify-end items-center gap-3">
                                    <button
                                        onClick={() => handleMergeCluster(group)}
                                        disabled={merging}
                                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 transition-all disabled:opacity-50"
                                    >
                                        <LinkIcon className="w-4 h-4" />
                                        <span>{merging ? 'Unificando...' : '🔗 Unificar y Consolidar Registros'}</span>
                                    </button>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
