'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { AuthProvider } from '@/components/AuthProvider'
import { Menu } from 'lucide-react'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [collapsed, setCollapsed] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    return (
        <AuthProvider>
            <div className="flex h-screen bg-slate-100 overflow-hidden">
                {/* Mobile Sidebar Overlay */}
                {mobileMenuOpen && (
                    <div 
                        className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
                        onClick={() => setMobileMenuOpen(false)}
                    />
                )}

                <Sidebar 
                    collapsed={collapsed} 
                    onToggle={() => setCollapsed(!collapsed)} 
                    mobileOpen={mobileMenuOpen}
                    onCloseMobile={() => setMobileMenuOpen(false)}
                />
                
                <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                    {/* Mobile Topbar */}
                    <header className="md:hidden bg-zinc-950 text-white flex items-center justify-between p-4 border-b border-zinc-900 shrink-0 z-30 shadow-md">
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setMobileMenuOpen(true)}
                                className="p-2 -ml-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                            >
                                <Menu className="w-6 h-6" />
                            </button>
                            <div className="flex flex-col">
                                <h1 className="text-[10px] font-black tracking-tighter text-zinc-500 uppercase italic leading-tight">El</h1>
                                <h1 className="text-sm font-black tracking-widest text-amber-500 uppercase leading-none -mt-1">Expediente</h1>
                            </div>
                        </div>
                    </header>

                    <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 transition-all duration-300">
                        {children}
                    </main>
                </div>
            </div>
        </AuthProvider>
    )
}
