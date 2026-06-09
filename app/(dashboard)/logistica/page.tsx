'use client'

import { useState } from 'react'
import ForaneoTab from './ForaneoTab'
import LocalTab from './LocalTab'
import CatalogosTab from './CatalogosTab'
import MapaTab from './MapaTab'
import { Truck, MapPin, Map, CalendarRange, Navigation } from 'lucide-react'

export default function LogisticaPage() {
    const [activeTab, setActiveTab] = useState<'foraneo' | 'local' | 'catalogos' | 'mapa'>('foraneo')

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-zinc-900">Logística de Transporte</h1>
                <p className="text-sm text-zinc-500">Gestione el transporte foráneo a Durango y las rotaciones locales en la mina</p>
            </div>

            <div className="border-b border-zinc-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('foraneo')}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center
                            ${activeTab === 'foraneo'
                                ? 'border-amber-500 text-amber-600'
                                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
                            }
                        `}
                    >
                        <Map className="w-5 h-5 mr-2" />
                        Transporte Foráneo
                    </button>
                    <button
                        onClick={() => setActiveTab('local')}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center
                            ${activeTab === 'local'
                                ? 'border-amber-500 text-amber-600'
                                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
                            }
                        `}
                    >
                        <CalendarRange className="w-5 h-5 mr-2" />
                        Transporte Local (Rotación)
                    </button>
                    <button
                        onClick={() => setActiveTab('mapa')}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center
                            ${activeTab === 'mapa'
                                ? 'border-amber-500 text-amber-600'
                                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
                            }
                        `}
                    >
                        <Navigation className="w-5 h-5 mr-2" />
                        Mapa de Rutas
                    </button>
                    <button
                        onClick={() => setActiveTab('catalogos')}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center
                            ${activeTab === 'catalogos'
                                ? 'border-amber-500 text-amber-600'
                                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
                            }
                        `}
                    >
                        <Truck className="w-5 h-5 mr-2" />
                        Catálogos (Camiones / Puntos)
                    </button>
                </nav>
            </div>

            <div className="mt-4">
                {activeTab === 'foraneo' && <ForaneoTab />}
                {activeTab === 'local' && <LocalTab />}
                {activeTab === 'mapa' && <MapaTab />}
                {activeTab === 'catalogos' && <CatalogosTab />}
            </div>
        </div>
    )
}
