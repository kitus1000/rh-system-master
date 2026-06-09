'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { Send, MessageCircle, Rss, User, Check, CheckCheck, MessageSquare, ThumbsUp, Heart, Laugh, Plus, CheckSquare, Square, Globe, Shield, Users } from 'lucide-react'

export default function ChatMuroPage() {
    const { profile } = useAuth()
    const [activeTab, setActiveTab] = useState<'muro' | 'chat'>('muro')

    // Muro State
    const [muroPosts, setMuroPosts] = useState<any[]>([])
    const [newPost, setNewPost] = useState('')
    
    // Muro 2.0 State
    const [esTarea, setEsTarea] = useState(false)
    const [privacidad, setPrivacidad] = useState('publico')
    const [selectedMuroUsers, setSelectedMuroUsers] = useState<string[]>([])
    
    const [activeCommentPost, setActiveCommentPost] = useState<string | null>(null)
    const [newComment, setNewComment] = useState('')

    // Chat State
    const [contacts, setContacts] = useState<any[]>([])
    const [selectedContact, setSelectedContact] = useState<any>(null)
    const [messages, setMessages] = useState<any[]>([])
    const [newMessage, setNewMessage] = useState('')
    
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!profile) return
        fetchMuro()
        fetchContacts()

        const muroSub = supabase.channel('muro-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'muro_alertas' }, () => fetchMuro())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'muro_reacciones' }, () => fetchMuro())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'muro_comentarios' }, () => fetchMuro())
            .subscribe()

        const chatSub = supabase.channel('chat-channel')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_privados' }, payload => {
                const msg = payload.new
                if (msg.id_remitente === profile.id || msg.id_destinatario === profile.id) {
                    if (selectedContact) {
                        fetchMessages(selectedContact.id)
                    }
                }
            }).subscribe()

        return () => {
            supabase.removeChannel(muroSub)
            supabase.removeChannel(chatSub)
        }
    }, [profile, selectedContact])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // --- Muro Logic ---
    async function fetchMuro() {
        if (!profile) return
        
        // Fetch posts where (publico OR departamento matches OR id_autor is me OR I am in visibilidad)
        const { data } = await supabase
            .from('muro_alertas')
            .select(`
                *,
                autor:perfiles!id_autor(nombre_completo, apodo, avatar_url),
                departamento:cat_departamentos!id_departamento(departamento),
                muro_comentarios(id, comentario, creado_el, autor:perfiles!id_autor(apodo, nombre_completo, avatar_url)),
                muro_reacciones(id, emoji, id_autor),
                muro_visibilidad_usuarios(id_usuario)
            `)
            .order('creado_el', { ascending: false })
            .limit(50)
            
        if (data) {
            // Filter locally for privacy logic because doing complex OR joins in supabase-js is tricky
            const filtered = data.filter(p => {
                if (p.id_autor === profile.id) return true
                if (profile.rol === 'Administrativo') return true
                if (p.privacidad === 'publico') return true
                if (p.privacidad === 'departamento' && p.id_departamento === (profile as any).id_departamento) return true
                if (p.privacidad === 'privado') {
                    return p.muro_visibilidad_usuarios.some((vu: any) => vu.id_usuario === profile.id)
                }
                return false
            })
            setMuroPosts(filtered)
        }
    }

    async function handlePostMuro(e: React.FormEvent) {
        e.preventDefault()
        if (!newPost.trim() || !profile) return
        
        const { data: insertedPost, error } = await supabase.from('muro_alertas').insert({
            id_autor: profile.id,
            id_departamento: (profile as any).id_departamento || null,
            contenido: newPost.trim(),
            es_tarea: esTarea,
            privacidad: privacidad
        }).select().single()
        
        if (error) {
            alert('Error al publicar: ' + error.message)
            return
        }

        if (privacidad === 'privado' && selectedMuroUsers.length > 0) {
            const visibilityRecords = selectedMuroUsers.map(uid => ({
                id_alerta: insertedPost.id,
                id_usuario: uid
            }))
            await supabase.from('muro_visibilidad_usuarios').insert(visibilityRecords)
        }
        
        setNewPost('')
        setEsTarea(false)
        setPrivacidad('publico')
        setSelectedMuroUsers([])
        fetchMuro()
    }

    async function toggleTaskStatus(post: any) {
        if (post.id_autor !== profile.id && profile.rol !== 'Administrativo') return // Only author/admin can mark done
        
        await supabase.from('muro_alertas')
            .update({ tarea_completada: !post.tarea_completada })
            .eq('id', post.id)
        
        fetchMuro()
    }

    async function addReaction(postId: string, emoji: string) {
        // Check if already reacted
        const post = muroPosts.find(p => p.id === postId)
        const existing = post.muro_reacciones.find((r: any) => r.emoji === emoji && r.id_autor === profile.id)
        
        if (existing) {
            await supabase.from('muro_reacciones').delete().eq('id', existing.id)
        } else {
            await supabase.from('muro_reacciones').insert({
                id_alerta: postId,
                id_autor: profile.id,
                emoji: emoji
            })
        }
        fetchMuro()
    }

    async function addComment(e: React.FormEvent, postId: string) {
        e.preventDefault()
        if (!newComment.trim() || !profile) return

        await supabase.from('muro_comentarios').insert({
            id_alerta: postId,
            id_autor: profile.id,
            comentario: newComment.trim()
        })

        setNewComment('')
        setActiveCommentPost(null)
        fetchMuro()
    }


    // --- Chat Logic ---
    async function fetchContacts() {
        if (!profile) return
        const { data } = await supabase
            .from('perfiles')
            .select('*')
            .neq('id', profile.id)
            .order('apodo')
        if (data) setContacts(data)
    }

    async function fetchMessages(contactId: string) {
        if (!profile) return
        const { data } = await supabase
            .from('mensajes_privados')
            .select('*')
            .or(`and(id_remitente.eq.${profile.id},id_destinatario.eq.${contactId}),and(id_remitente.eq.${contactId},id_destinatario.eq.${profile.id})`)
            .order('creado_el', { ascending: true })
        if (data) {
            setMessages(data)
            const unreadIds = data.filter(m => m.id_destinatario === profile.id && !m.leido).map(m => m.id)
            if (unreadIds.length > 0) {
                await supabase.from('mensajes_privados').update({ leido: true }).in('id', unreadIds)
            }
        }
    }

    const selectContact = (c: any) => {
        setSelectedContact(c)
        fetchMessages(c.id)
    }

    async function handleSendMessage(e: React.FormEvent) {
        e.preventDefault()
        if (!newMessage.trim() || !selectedContact || !profile) return

        const msgText = newMessage.trim()
        setNewMessage('')

        await supabase.from('mensajes_privados').insert({
            id_remitente: profile.id,
            id_destinatario: selectedContact.id,
            mensaje: msgText
        })

        fetchMessages(selectedContact.id)
    }

    // Utilities
    const getAvatar = (p: any) => p?.avatar_url || null
    const getName = (p: any) => p?.apodo || p?.nombre_completo || 'Usuario'

    const emojis = ['👍', '❤️', '👏', '🔥', '😂']

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] max-w-6xl mx-auto animate-in fade-in duration-500">
            {/* Header / Tabs */}
            <div className="flex items-center space-x-2 mb-6">
                <button
                    onClick={() => setActiveTab('muro')}
                    className={`flex items-center px-6 py-3 rounded-full font-bold text-sm transition-colors ${activeTab === 'muro' ? 'bg-black text-white shadow-md' : 'bg-white text-zinc-500 hover:bg-zinc-100'}`}
                >
                    <Rss className="w-4 h-4 mr-2" />
                    Muro de Actividades
                </button>
                <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex items-center px-6 py-3 rounded-full font-bold text-sm transition-colors ${activeTab === 'chat' ? 'bg-black text-white shadow-md' : 'bg-white text-zinc-500 hover:bg-zinc-100'}`}
                >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Chat Privado
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex">
                
                {/* ---------------- MURO TAB ---------------- */}
                {activeTab === 'muro' && (
                    <div className="flex flex-col w-full h-full">
                        {/* Composer */}
                        <div className="p-6 border-b border-zinc-200 bg-zinc-50 shrink-0">
                            <form onSubmit={handlePostMuro} className="space-y-4">
                                <div className="flex space-x-3">
                                    <div className="w-10 h-10 rounded-full bg-zinc-200 shrink-0 overflow-hidden flex items-center justify-center border-2 border-white shadow-sm">
                                        {getAvatar(profile) ? <img src={getAvatar(profile)} className="w-full h-full object-cover"/> : <User className="w-5 h-5 text-zinc-500" />}
                                    </div>
                                    <textarea
                                        value={newPost}
                                        onChange={e => setNewPost(e.target.value)}
                                        placeholder="¿Qué está pasando en tu departamento?"
                                        rows={2}
                                        className="flex-1 border-zinc-300 rounded-xl p-3 focus:ring-black focus:border-black text-sm resize-none"
                                    />
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-3 pl-13">
                                    <div className="flex flex-wrap gap-4">
                                        <label className="flex items-center space-x-2 text-sm font-medium text-zinc-700 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={esTarea} 
                                                onChange={e => setEsTarea(e.target.checked)}
                                                className="rounded text-black focus:ring-black"
                                            />
                                            <span>Es una Actividad/Tarea</span>
                                        </label>
                                        
                                        <div className="flex items-center space-x-2">
                                            <select 
                                                value={privacidad} 
                                                onChange={e => setPrivacidad(e.target.value)}
                                                className="text-sm border-zinc-300 rounded-lg p-1 text-zinc-600 focus:ring-black"
                                            >
                                                <option value="publico">🌍 Toda la empresa</option>
                                                <option value="departamento">🏢 Mi Departamento</option>
                                                <option value="privado">🔒 Privado (Usuarios)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <button type="submit" disabled={!newPost.trim()} className="bg-black text-white px-6 py-2 rounded-xl font-bold hover:bg-zinc-800 disabled:opacity-50 transition-colors">
                                        Publicar
                                    </button>
                                </div>
                                
                                {privacidad === 'privado' && (
                                    <div className="mt-2 bg-white p-3 rounded-xl border border-zinc-200">
                                        <p className="text-xs font-bold text-zinc-500 mb-2">Selecciona quién puede verlo:</p>
                                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                            {contacts.map(c => (
                                                <label key={c.id} className="flex items-center space-x-2 text-xs bg-zinc-50 p-2 rounded-lg border border-zinc-100 cursor-pointer hover:bg-zinc-100">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedMuroUsers.includes(c.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedMuroUsers([...selectedMuroUsers, c.id])
                                                            else setSelectedMuroUsers(selectedMuroUsers.filter(id => id !== c.id))
                                                        }}
                                                        className="rounded text-black"
                                                    />
                                                    <span>{getName(c)}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>
                        
                        {/* Feed */}
                        <div className="flex-1 overflow-y-auto p-6 bg-[#f0f2f5] space-y-6">
                            {muroPosts.map(post => {
                                const canCheckTask = post.id_autor === profile?.id || profile?.rol === 'Administrativo'
                                
                                return (
                                <div key={post.id} className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-200 animate-in slide-in-from-bottom-2">
                                    {/* Post Header */}
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-full bg-zinc-200 overflow-hidden flex items-center justify-center shadow-sm">
                                                {getAvatar(post.autor) ? <img src={getAvatar(post.autor)} className="w-full h-full object-cover"/> : <User className="w-5 h-5 text-zinc-500" />}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm text-zinc-900 leading-none">{getName(post.autor)}</h4>
                                                <div className="flex items-center text-xs text-zinc-500 mt-1 space-x-2">
                                                    <span>{new Date(post.creado_el).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                    <span>•</span>
                                                    {post.privacidad === 'publico' ? <Globe className="w-3 h-3" /> : 
                                                     post.privacidad === 'departamento' ? <Building className="w-3 h-3" /> : 
                                                     <Shield className="w-3 h-3" />}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {post.departamento && (
                                            <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                                                {post.departamento.departamento}
                                            </span>
                                        )}
                                    </div>

                                    {/* Post Body */}
                                    <div className={`mb-4 ${post.es_tarea ? 'bg-blue-50 border border-blue-100 p-4 rounded-xl' : ''}`}>
                                        {post.es_tarea && (
                                            <div className="flex items-center mb-2">
                                                <button 
                                                    onClick={() => toggleTaskStatus(post)}
                                                    disabled={!canCheckTask}
                                                    className={`mr-3 ${canCheckTask ? 'cursor-pointer hover:scale-110' : 'opacity-50 cursor-not-allowed'} transition-transform`}
                                                >
                                                    {post.tarea_completada 
                                                        ? <CheckSquare className="w-6 h-6 text-emerald-500" />
                                                        : <Square className="w-6 h-6 text-zinc-400" />
                                                    }
                                                </button>
                                                <span className={`text-xs font-bold uppercase tracking-wider ${post.tarea_completada ? 'text-emerald-600' : 'text-blue-600'}`}>
                                                    {post.tarea_completada ? 'Actividad Completada' : 'Actividad Pendiente'}
                                                </span>
                                            </div>
                                        )}
                                        <p className={`text-zinc-800 text-sm whitespace-pre-wrap ${post.es_tarea && post.tarea_completada ? 'line-through opacity-70' : ''}`}>
                                            {post.contenido}
                                        </p>
                                    </div>

                                    {/* Interactions (Reactions & Comments count) */}
                                    <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                                        <div className="flex items-center gap-1 bg-zinc-50 rounded-full p-1 border border-zinc-200">
                                            {emojis.map(emoji => {
                                                const count = post.muro_reacciones?.filter((r:any) => r.emoji === emoji).length || 0
                                                const hasReacted = post.muro_reacciones?.some((r:any) => r.emoji === emoji && r.id_autor === profile?.id)
                                                return (
                                                    <button
                                                        key={emoji}
                                                        onClick={() => addReaction(post.id, emoji)}
                                                        className={`flex items-center justify-center space-x-1 px-2 py-1 rounded-full text-xs transition-colors ${hasReacted ? 'bg-black text-white' : 'hover:bg-zinc-200 text-zinc-600'}`}
                                                    >
                                                        <span>{emoji}</span>
                                                        {count > 0 && <span className="font-bold">{count}</span>}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        
                                        <button 
                                            onClick={() => setActiveCommentPost(activeCommentPost === post.id ? null : post.id)}
                                            className="flex items-center space-x-1 text-xs font-bold text-zinc-500 hover:text-zinc-800 transition-colors"
                                        >
                                            <MessageSquare className="w-4 h-4" />
                                            <span>{post.muro_comentarios?.length || 0} Comentarios</span>
                                        </button>
                                    </div>

                                    {/* Comments Section */}
                                    {activeCommentPost === post.id && (
                                        <div className="mt-4 pt-4 border-t border-zinc-100 space-y-4 animate-in slide-in-from-top-2">
                                            {post.muro_comentarios?.map((comment: any) => (
                                                <div key={comment.id} className="flex space-x-3">
                                                    <div className="w-8 h-8 rounded-full bg-zinc-200 overflow-hidden flex items-center justify-center shrink-0">
                                                        {getAvatar(comment.autor) ? <img src={getAvatar(comment.autor)} className="w-full h-full object-cover"/> : <User className="w-4 h-4 text-zinc-500" />}
                                                    </div>
                                                    <div className="bg-zinc-100 p-3 rounded-xl rounded-tl-none flex-1">
                                                        <div className="flex items-baseline justify-between mb-1">
                                                            <span className="font-bold text-xs text-zinc-900">{getName(comment.autor)}</span>
                                                            <span className="text-[10px] text-zinc-400">{new Date(comment.creado_el).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                        </div>
                                                        <p className="text-xs text-zinc-700">{comment.comentario}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            
                                            <form onSubmit={(e) => addComment(e, post.id)} className="flex items-center space-x-2 mt-2">
                                                <div className="w-8 h-8 rounded-full bg-zinc-200 overflow-hidden flex items-center justify-center shrink-0 border border-white">
                                                    {getAvatar(profile) ? <img src={getAvatar(profile)} className="w-full h-full object-cover"/> : <User className="w-4 h-4 text-zinc-500" />}
                                                </div>
                                                <input
                                                    type="text"
                                                    value={newComment}
                                                    onChange={e => setNewComment(e.target.value)}
                                                    placeholder="Escribe un comentario..."
                                                    className="flex-1 text-xs border-zinc-300 rounded-full px-4 py-2 focus:ring-black focus:border-black bg-zinc-50"
                                                />
                                                <button type="submit" disabled={!newComment.trim()} className="p-2 bg-black text-white rounded-full hover:bg-zinc-800 disabled:opacity-50">
                                                    <Send className="w-3 h-3" />
                                                </button>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            )})}
                            {muroPosts.length === 0 && (
                                <div className="text-center text-zinc-400 py-10 text-sm bg-white rounded-2xl border border-dashed border-zinc-300">
                                    No hay publicaciones que mostrar. ¡Sé el primero!
                                </div>
                            )}
                        </div>
                    </div>
                )}


                {/* ---------------- CHAT TAB ---------------- */}
                {activeTab === 'chat' && (
                    <>
                        {/* Sidebar Contacts */}
                        <div className="w-80 border-r border-zinc-100 flex flex-col bg-zinc-50/50">
                            <div className="p-4 border-b border-zinc-100">
                                <h3 className="font-bold text-zinc-800">Contactos</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {contacts.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => selectContact(c)}
                                        className={`w-full flex items-center p-4 border-b border-zinc-100 transition-colors ${selectedContact?.id === c.id ? 'bg-white border-l-4 border-l-black shadow-sm' : 'hover:bg-zinc-100 border-l-4 border-l-transparent'}`}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-zinc-200 shrink-0 overflow-hidden flex items-center justify-center border-2 border-white shadow-sm mr-3">
                                            {getAvatar(c) ? <img src={getAvatar(c)} className="w-full h-full object-cover"/> : <User className="w-5 h-5 text-zinc-500" />}
                                        </div>
                                        <div className="text-left flex-1 min-w-0">
                                            <p className="font-bold text-sm text-zinc-900 truncate">{getName(c)}</p>
                                            <p className="text-[10px] text-zinc-500 uppercase font-bold truncate">{c.rol}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Chat Area */}
                        <div className="flex-1 flex flex-col bg-[#f0f2f5]">
                            {selectedContact ? (
                                <>
                                    <div className="p-4 bg-white border-b border-zinc-200 flex items-center shadow-sm z-10">
                                        <div className="w-10 h-10 rounded-full bg-zinc-200 shrink-0 overflow-hidden flex items-center justify-center mr-3">
                                            {getAvatar(selectedContact) ? <img src={getAvatar(selectedContact)} className="w-full h-full object-cover"/> : <User className="w-5 h-5 text-zinc-500" />}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-zinc-900">{getName(selectedContact)}</h3>
                                            <p className="text-xs text-zinc-500">{selectedContact.cat_departamentos?.departamento || 'Global'}</p>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                        {messages.map(msg => {
                                            const isMe = msg.id_remitente === profile.id
                                            return (
                                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-[70%] rounded-2xl px-4 py-2 shadow-sm ${isMe ? 'bg-black text-white rounded-tr-sm' : 'bg-white text-zinc-800 rounded-tl-sm'}`}>
                                                        <p className="text-sm break-words">{msg.mensaje}</p>
                                                        <div className={`flex justify-end items-center mt-1 space-x-1 ${isMe ? 'text-zinc-400' : 'text-zinc-400'}`}>
                                                            <span className="text-[10px]">{new Date(msg.creado_el).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                            {isMe && (
                                                                msg.leido ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Check className="w-3 h-3" />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    <div className="p-4 bg-[#f0f2f5]">
                                        <form onSubmit={handleSendMessage} className="flex items-center space-x-2 bg-white rounded-xl p-2 shadow-sm">
                                            <input
                                                type="text"
                                                value={newMessage}
                                                onChange={e => setNewMessage(e.target.value)}
                                                placeholder="Escribe un mensaje..."
                                                className="flex-1 border-none focus:ring-0 text-sm px-2 bg-transparent"
                                            />
                                            <button 
                                                type="submit" 
                                                disabled={!newMessage.trim()} 
                                                className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                                            >
                                                <Send className="w-4 h-4" />
                                            </button>
                                        </form>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
                                    <MessageCircle className="w-16 h-16 mb-4 text-zinc-300" />
                                    <p className="font-medium">Selecciona un contacto para iniciar un chat</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
