'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/utils/supabase/client'
import { Pill, Plus, Search, ArrowRightLeft, PackagePlus, CheckCircle2, X, Building2 } from 'lucide-react'

export default function InventarioPage() {
    const [medicamentos, setMedicamentos] = useState<any[]>([])
    const [clinicas, setClinicas] = useState<any[]>([])
    const [inventario, setInventario] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [showTransferModal, setShowTransferModal] = useState(false)
    const [adjustModalMed, setAdjustModalMed] = useState<any | null>(null)
    const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        nombre: '',
        descripcion: '',
        sustancia_activa: '',
        presentacion: '',
        precio_venta: 0,
        stock_inicial: 0,
        id_clinica: '',
    })

    const [adjustForm, setAdjustForm] = useState({
        id_clinica: '',
        modo: 'sumar' as 'sumar' | 'fijar',
        cantidad: 10,
    })

    const [transferForm, setTransferForm] = useState({
        id_medicamento: '',
        id_clinica_origen: '',
        id_clinica_destino: '',
        cantidad: 1,
    })

    useEffect(() => {
        fetchAllData()
    }, [])

    const fetchAllData = async () => {
        setLoading(true)
        const [medsRes, clinRes, invRes] = await Promise.all([
            supabase.from('cat_medicamentos').select('*').order('nombre'),
            supabase.from('cat_clinicas').select('*').neq('activo', false).order('nombre'),
            supabase.from('inventario_clinicas').select('*'),
        ])

        const clinList = clinRes.data || []
        if (medsRes.data) setMedicamentos(medsRes.data)
        setClinicas(clinList)
        if (invRes.data) setInventario(invRes.data)

        const defaultClin =
            clinList.find((c: any) => c.tipo === 'Interna')?.id_clinica ||
            clinList[0]?.id_clinica ||
            ''

        setFormData(prev => (prev.id_clinica ? prev : { ...prev, id_clinica: defaultClin }))
        setAdjustForm(prev => (prev.id_clinica ? prev : { ...prev, id_clinica: defaultClin }))
        setLoading(false)
    }

    const clinicaNameMap = useMemo(() => {
        const m = new Map<string, string>()
        clinicas.forEach((c: any) => m.set(String(c.id_clinica), c.nombre))
        return m
    }, [clinicas])

    const stockByMed = useMemo(() => {
        const map = new Map<
            string,
            { total: number; rows: Array<{ id_inventario: string; id_clinica: string; clinicaNombre: string; cantidad: number }> }
        >()
        inventario.forEach((row: any) => {
            const medId = String(row.id_medicamento || '')
            if (!medId) return
            const qty = Math.max(0, Number(row.cantidad || 0))
            const cur = map.get(medId) || { total: 0, rows: [] }
            cur.total += qty
            cur.rows.push({
                id_inventario: row.id_inventario,
                id_clinica: String(row.id_clinica || ''),
                clinicaNombre: clinicaNameMap.get(String(row.id_clinica || '')) || 'Clínica',
                cantidad: qty,
            })
            map.set(medId, cur)
        })
        return map
    }, [inventario, clinicaNameMap])

    const filteredMedicamentos = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        if (!q) return medicamentos
        return medicamentos.filter((m: any) =>
            `${m.nombre || ''} ${m.sustancia_activa || ''} ${m.presentacion || ''}`.toLowerCase().includes(q)
        )
    }, [medicamentos, searchQuery])

    const showNotice = (msg: string) => {
        setFeedbackMsg(msg)
        setTimeout(() => setFeedbackMsg(null), 4000)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            const { data: insertedMed, error } = await supabase
                .from('cat_medicamentos')
                .insert([
                    {
                        nombre: formData.nombre.trim(),
                        descripcion: formData.descripcion.trim(),
                        sustancia_activa: formData.sustancia_activa.trim(),
                        presentacion: formData.presentacion.trim(),
                        precio_venta: Number(formData.precio_venta || 0),
                    },
                ])
                .select()
                .single()

            if (error) throw error

            const stockIni = Math.max(0, Number(formData.stock_inicial || 0))
            if (insertedMed?.id_medicamento && stockIni > 0 && formData.id_clinica) {
                const { error: invErr } = await supabase
                    .from('inventario_clinicas')
                    .upsert(
                        [
                            {
                                id_clinica: formData.id_clinica,
                                id_medicamento: insertedMed.id_medicamento,
                                cantidad: stockIni,
                            },
                        ],
                        { onConflict: 'id_clinica,id_medicamento' }
                    )
                if (invErr) throw invErr
            }

            const defaultClin =
                clinicas.find((c: any) => c.tipo === 'Interna')?.id_clinica ||
                clinicas[0]?.id_clinica ||
                ''

            setShowForm(false)
            setFormData({
                nombre: '',
                descripcion: '',
                sustancia_activa: '',
                presentacion: '',
                precio_venta: 0,
                stock_inicial: 0,
                id_clinica: defaultClin,
            })
            await fetchAllData()
            showNotice(`Medicamento "${insertedMed?.nombre || ''}" registrado${stockIni > 0 ? ` con ${stockIni} unidad(es) en stock` : ''}.`)
        } catch (err: any) {
            alert('Error al guardar medicamento: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const openAdjustModal = (med: any) => {
        const defaultClin =
            clinicas.find((c: any) => c.tipo === 'Interna')?.id_clinica ||
            clinicas[0]?.id_clinica ||
            ''
        setAdjustForm({ id_clinica: defaultClin, modo: 'sumar', cantidad: 10 })
        setAdjustModalMed(med)
    }

    const handleSaveAdjust = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!adjustModalMed || !adjustForm.id_clinica) return
        setSaving(true)
        try {
            const existing = inventario.find(
                (r: any) =>
                    String(r.id_medicamento) === String(adjustModalMed.id_medicamento) &&
                    String(r.id_clinica) === String(adjustForm.id_clinica)
            )
            const currentQty = existing ? Math.max(0, Number(existing.cantidad || 0)) : 0
            const inputQty = Math.max(0, Number(adjustForm.cantidad || 0))
            const nextQty = adjustForm.modo === 'sumar' ? currentQty + inputQty : inputQty

            const { error } = await supabase
                .from('inventario_clinicas')
                .upsert(
                    [
                        {
                            id_clinica: adjustForm.id_clinica,
                            id_medicamento: adjustModalMed.id_medicamento,
                            cantidad: nextQty,
                        },
                    ],
                    { onConflict: 'id_clinica,id_medicamento' }
                )

            if (error) throw error
            setAdjustModalMed(null)
            await fetchAllData()
            showNotice(`Stock actualizado para ${adjustModalMed.nombre}: ${nextQty} pzs.`)
        } catch (err: any) {
            alert('Error al ajustar inventario: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const openTransferModal = () => {
        const interna = clinicas.find((c: any) => c.tipo === 'Interna')?.id_clinica || clinicas[0]?.id_clinica || ''
        const otra = clinicas.find((c: any) => String(c.id_clinica) !== String(interna))?.id_clinica || ''
        setTransferForm({
            id_medicamento: medicamentos[0]?.id_medicamento || '',
            id_clinica_origen: interna,
            id_clinica_destino: otra,
            cantidad: 1,
        })
        setShowTransferModal(true)
    }

    const handleSaveTransfer = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!transferForm.id_medicamento || !transferForm.id_clinica_origen || !transferForm.id_clinica_destino) {
            return alert('Selecciona medicamento, clínica origen y clínica destino.')
        }
        if (transferForm.id_clinica_origen === transferForm.id_clinica_destino) {
            return alert('La clínica origen y destino deben ser distintas.')
        }

        const qty = Math.max(1, Number(transferForm.cantidad || 1))
        setSaving(true)
        try {
            const origRow = inventario.find(
                (r: any) =>
                    String(r.id_medicamento) === String(transferForm.id_medicamento) &&
                    String(r.id_clinica) === String(transferForm.id_clinica_origen)
            )
            const origQty = origRow ? Math.max(0, Number(origRow.cantidad || 0)) : 0
            if (origQty < qty) {
                setSaving(false)
                return alert(`Stock insuficiente en la clínica origen (disponible: ${origQty}).`)
            }

            const destRow = inventario.find(
                (r: any) =>
                    String(r.id_medicamento) === String(transferForm.id_medicamento) &&
                    String(r.id_clinica) === String(transferForm.id_clinica_destino)
            )
            const destQty = destRow ? Math.max(0, Number(destRow.cantidad || 0)) : 0

            const { error: errOrig } = await supabase
                .from('inventario_clinicas')
                .upsert(
                    [
                        {
                            id_clinica: transferForm.id_clinica_origen,
                            id_medicamento: transferForm.id_medicamento,
                            cantidad: origQty - qty,
                        },
                    ],
                    { onConflict: 'id_clinica,id_medicamento' }
                )
            if (errOrig) throw errOrig

            const { error: errDest } = await supabase
                .from('inventario_clinicas')
                .upsert(
                    [
                        {
                            id_clinica: transferForm.id_clinica_destino,
                            id_medicamento: transferForm.id_medicamento,
                            cantidad: destQty + qty,
                        },
                    ],
                    { onConflict: 'id_clinica,id_medicamento' }
                )
            if (errDest) throw errDest

            await supabase.from('transferencias_medicamentos').insert([
                {
                    id_clinica_origen: transferForm.id_clinica_origen,
                    id_clinica_destino: transferForm.id_clinica_destino,
                    id_medicamento: transferForm.id_medicamento,
                    cantidad: qty,
                    estatus: 'Completada',
                },
            ])

            setShowTransferModal(false)
            await fetchAllData()
            showNotice(`Transferencia completada (${qty} unidad(es) movidas).`)
        } catch (err: any) {
            alert('Error al transferir medicamento: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-3 bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-800 flex items-center gap-2">
                        <Pill className="w-6 h-6 text-amber-500" />
                        Catálogo e Inventario de Farmacia
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1">
                        Existencias por consultorio y <strong>descuento automático de stock por cada receta emitida</strong>
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={openTransferModal}
                        className="bg-zinc-100 text-zinc-700 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-zinc-200 transition-colors cursor-pointer"
                    >
                        <ArrowRightLeft className="w-4 h-4" />
                        Transferir
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowForm(!showForm)}
                        className="bg-zinc-900 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo Medicamento
                    </button>
                </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                    <strong>Descuento automático activo:</strong> cada vez que un médico guarda una consulta o receta (en Web o APK sincronizada), las unidades recetadas se descuentan automáticamente del stock disponible en la clínica correspondiente.
                </span>
            </div>

            {feedbackMsg && (
                <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-2.5 rounded-xl text-xs font-bold">
                    {feedbackMsg}
                </div>
            )}

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 space-y-4">
                    <h2 className="text-lg font-semibold text-zinc-800 border-b pb-2">Registrar Medicamento</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Nombre Comercial *</label>
                            <input
                                required
                                type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2"
                                value={formData.nombre}
                                onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Sustancia Activa</label>
                            <input
                                type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2"
                                value={formData.sustancia_activa}
                                onChange={e => setFormData({ ...formData, sustancia_activa: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Presentación</label>
                            <input
                                type="text"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2"
                                placeholder="Ej. Caja con 20 tabletas"
                                value={formData.presentacion}
                                onChange={e => setFormData({ ...formData, presentacion: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Precio Venta ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2"
                                value={formData.precio_venta}
                                onChange={e => setFormData({ ...formData, precio_venta: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Stock Inicial (Pzs/Cajas)</label>
                            <input
                                type="number"
                                min="0"
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2 font-bold"
                                value={formData.stock_inicial}
                                onChange={e => setFormData({ ...formData, stock_inicial: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Clínica de Ingreso</label>
                            <select
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-4 py-2 text-sm"
                                value={formData.id_clinica}
                                onChange={e => setFormData({ ...formData, id_clinica: e.target.value })}
                            >
                                <option value="">-- Seleccionar clínica --</option>
                                {clinicas.map((c: any) => (
                                    <option key={c.id_clinica} value={c.id_clinica}>
                                        {c.nombre} ({c.tipo})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end pt-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-amber-500 text-black px-6 py-2 rounded-xl text-sm font-bold hover:bg-amber-400 disabled:opacity-50"
                        >
                            {saving ? 'Guardando...' : 'Guardar Medicamento'}
                        </button>
                    </div>
                </form>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
                <div className="p-4 border-b border-zinc-100 flex items-center justify-between gap-4 bg-zinc-50">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Buscar medicamento, sustancia o presentación..."
                            className="w-full pl-10 pr-4 py-2 rounded-xl border-zinc-200 bg-white text-sm"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="text-xs font-bold text-zinc-500">
                        {filteredMedicamentos.length} medicamento(s)
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50 text-zinc-500 font-medium border-b border-zinc-100">
                            <tr>
                                <th className="px-6 py-4">Nombre Comercial</th>
                                <th className="px-6 py-4">Sustancia Activa</th>
                                <th className="px-6 py-4">Presentación</th>
                                <th className="px-6 py-4">Precio Público</th>
                                <th className="px-6 py-4">Stock Total</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-zinc-500">Cargando inventario...</td></tr>
                            ) : filteredMedicamentos.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-zinc-500">No hay medicamentos registrados</td></tr>
                            ) : (
                                filteredMedicamentos.map(med => {
                                    const info = stockByMed.get(String(med.id_medicamento)) || { total: 0, rows: [] }
                                    const stockBadge =
                                        info.total > 10
                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                            : info.total >= 1
                                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                                            : 'bg-rose-100 text-rose-800 border-rose-200'

                                    return (
                                        <tr key={med.id_medicamento} className="hover:bg-zinc-50/50 transition-colors">
                                            <td className="px-6 py-4 font-semibold text-zinc-800">{med.nombre}</td>
                                            <td className="px-6 py-4 text-zinc-600">{med.sustancia_activa || '—'}</td>
                                            <td className="px-6 py-4 text-zinc-600">{med.presentacion || '—'}</td>
                                            <td className="px-6 py-4 text-emerald-600 font-medium">${Number(med.precio_venta || 0).toFixed(2)}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className={`inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-black border ${stockBadge}`}>
                                                        {info.total} pzs
                                                    </span>
                                                    {info.rows.length > 0 && (
                                                        <div className="text-[11px] text-zinc-500 flex flex-wrap gap-1.5">
                                                            {info.rows.map(r => (
                                                                <span key={r.id_inventario} className="bg-zinc-100 px-1.5 py-0.5 rounded text-[10px]">
                                                                    {r.clinicaNombre}: <strong>{r.cantidad}</strong>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => openAdjustModal(med)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold cursor-pointer"
                                                >
                                                    <PackagePlus className="w-3.5 h-3.5" />
                                                    + Entrada / Ajustar
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {adjustModalMed && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <form onSubmit={handleSaveAdjust} className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="text-base font-black text-zinc-900 flex items-center gap-2">
                                <PackagePlus className="w-5 h-5 text-amber-500" />
                                Entrada / Ajuste de Stock
                            </h3>
                            <button type="button" onClick={() => setAdjustModalMed(null)} className="text-zinc-400 hover:text-zinc-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="text-xs font-bold text-zinc-600 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                            {adjustModalMed.nombre} {adjustModalMed.presentacion ? `· ${adjustModalMed.presentacion}` : ''}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Clínica / Farmacia *</label>
                            <select
                                required
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                                value={adjustForm.id_clinica}
                                onChange={e => setAdjustForm({ ...adjustForm, id_clinica: e.target.value })}
                            >
                                {clinicas.map((c: any) => (
                                    <option key={c.id_clinica} value={c.id_clinica}>{c.nombre} ({c.tipo})</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Operación</label>
                                <select
                                    className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold"
                                    value={adjustForm.modo}
                                    onChange={e => setAdjustForm({ ...adjustForm, modo: e.target.value as 'sumar' | 'fijar' })}
                                >
                                    <option value="sumar">Sumar entrada (+)</option>
                                    <option value="fijar">Fijar total exacto (=)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Cantidad</label>
                                <input
                                    type="number"
                                    min="0"
                                    required
                                    className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-bold text-center"
                                    value={adjustForm.cantidad}
                                    onChange={e => setAdjustForm({ ...adjustForm, cantidad: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setAdjustModalMed(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100">
                                Cancelar
                            </button>
                            <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black">
                                {saving ? 'Guardando...' : 'Aplicar Ajuste'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {showTransferModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <form onSubmit={handleSaveTransfer} className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h3 className="text-base font-black text-zinc-900 flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-blue-600" />
                                Transferir Medicamento entre Clínicas
                            </h3>
                            <button type="button" onClick={() => setShowTransferModal(false)} className="text-zinc-400 hover:text-zinc-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Medicamento *</label>
                            <select
                                required
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                                value={transferForm.id_medicamento}
                                onChange={e => setTransferForm({ ...transferForm, id_medicamento: e.target.value })}
                            >
                                {medicamentos.map((m: any) => (
                                    <option key={m.id_medicamento} value={m.id_medicamento}>
                                        {m.nombre} (Total: {stockByMed.get(String(m.id_medicamento))?.total || 0})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Origen *</label>
                                <select
                                    required
                                    className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold"
                                    value={transferForm.id_clinica_origen}
                                    onChange={e => setTransferForm({ ...transferForm, id_clinica_origen: e.target.value })}
                                >
                                    {clinicas.map((c: any) => (
                                        <option key={c.id_clinica} value={c.id_clinica}>{c.nombre}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Destino *</label>
                                <select
                                    required
                                    className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold"
                                    value={transferForm.id_clinica_destino}
                                    onChange={e => setTransferForm({ ...transferForm, id_clinica_destino: e.target.value })}
                                >
                                    <option value="">-- Elegir destino --</option>
                                    {clinicas.map((c: any) => (
                                        <option key={c.id_clinica} value={c.id_clinica}>{c.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Cantidad a transferir *</label>
                            <input
                                type="number"
                                min="1"
                                required
                                className="w-full rounded-xl border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-bold text-center"
                                value={transferForm.cantidad}
                                onChange={e => setTransferForm({ ...transferForm, cantidad: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setShowTransferModal(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100">
                                Cancelar
                            </button>
                            <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-black">
                                {saving ? 'Transfiriendo...' : 'Confirmar Transferencia'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}
