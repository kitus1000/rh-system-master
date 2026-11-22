'use client'

import React from 'react'

export type PortalIconId =
  | 'rh'
  | 'jefes'
  | 'contratista'
  | 'seguridad'
  | 'caseta-qr'
  | 'campamento'
  | 'medico'
  | 'chofer'
  | 'viajes'
  | 'farmacia'
  | 'pases'
  | 'hotel'
  | 'clinicas'
  | 'flota'
  | 'accesos'
  | 'integracion'
  | 'prenomina'
  | 'solicitudes'
  | 'autorizaciones'
  | 'comedor'
  | 'evaluaciones'
  | 'calendario'
  | 'chat'
  | 'catalogos'
  | 'documentos'
  | 'lockers'
  | 'usuarios'
  | 'perfil'

interface PortalAppIconProps {
  id: PortalIconId
  className?: string
  active?: boolean
}

/**
 * Íconos vectoriales de aplicación creados a medida para PORTAL BACIS.
 * Paleta estricta del logotipo Bacís: Azul Rey (#1d4ed8 / #2563eb / #38bdf8), Blanco (#ffffff) y Negro (#020617).
 */
export function PortalAppIcon({ id, className = 'w-16 h-16', active = false }: PortalAppIconProps) {
  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_8px_18px_rgba(29,78,216,0.45)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`bg-${id}`} x1="8" y1="6" x2="72" y2="74" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={active ? '#2563eb' : '#0b1838'} />
            <stop offset="55%" stopColor={active ? '#1d4ed8' : '#050b1c'} />
            <stop offset="100%" stopColor={active ? '#0b1838' : '#010308'} />
          </linearGradient>
          <linearGradient id={`rim-${id}`} x1="8" y1="6" x2="72" y2="74" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={active ? '0.85' : '0.45'} />
            <stop offset="45%" stopColor="#3b82f6" stopOpacity={active ? '0.95' : '0.55'} />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id={`blue-${id}`} x1="20" y1="18" x2="60" y2="62" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="55%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
          <linearGradient id={`steel-${id}`} x1="16" y1="16" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="65%" stopColor="#dbeafe" />
            <stop offset="100%" stopColor="#93c5fd" />
          </linearGradient>
        </defs>

        {/* Cuerpo tipo App Tile 3D con bisel metálico */}
        <rect
          x="4"
          y="4"
          width="72"
          height="72"
          rx="20"
          fill={`url(#bg-${id})`}
          stroke={`url(#rim-${id})`}
          strokeWidth="2.2"
        />

        {/* Reflejo cristalino superior */}
        <path
          d="M12 16 C12 10 18 7 24 7 L56 7 C62 7 68 10 68 16 C56 22 24 22 12 16 Z"
          fill="rgba(255,255,255,0.08)"
        />

        {/* Contenido iconográfico específico por módulo */}
        {renderIconArtwork(id)}
      </svg>
    </div>
  )
}

function renderIconArtwork(id: PortalIconId) {
  switch (id) {
    case 'rh':
      // Escudo central con estructura de personas y núcleo azul Bacís
      return (
        <g>
          <circle cx="40" cy="40" r="22" fill="#07112b" stroke="#3b82f6" strokeWidth="1.4" strokeOpacity="0.55" />
          {/* Persona lateral izquierda */}
          <circle cx="26" cy="34" r="4.5" fill="#93c5fd" />
          <path d="M18 49 C18 44 21.5 41 26 41 C28.5 41 30.5 42 32 43.5" stroke="#93c5fd" strokeWidth="2.4" strokeLinecap="round" />
          {/* Persona lateral derecha */}
          <circle cx="54" cy="34" r="4.5" fill="#93c5fd" />
          <path d="M62 49 C62 44 58.5 41 54 41 C51.5 41 49.5 42 48 43.5" stroke="#93c5fd" strokeWidth="2.4" strokeLinecap="round" />
          {/* Persona central principal en blanco puro */}
          <circle cx="40" cy="30" r="6.2" fill="#ffffff" />
          <path d="M28 53 C28 45.5 33.4 41 40 41 C46.6 41 52 45.5 52 53 Z" fill="#2563eb" stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="40" cy="54" r="3.5" fill="#ffffff" />
        </g>
      )

    case 'jefes':
      // Tablero de mando ejecutivo con sello de visto bueno y estrella
      return (
        <g>
          <rect x="21" y="19" width="38" height="45" rx="6" fill="#0c1b42" stroke="#ffffff" strokeWidth="2.2" />
          <rect x="30" y="14" width="20" height="8" rx="3" fill="#2563eb" stroke="#ffffff" strokeWidth="1.8" />
          <line x1="28" y1="31" x2="43" y2="31" stroke="#93c5fd" strokeWidth="2.6" strokeLinecap="round" />
          <line x1="28" y1="39" x2="39" y2="39" stroke="#93c5fd" strokeWidth="2.6" strokeLinecap="round" />
          {/* Sello circular de aprobación */}
          <circle cx="49" cy="49" r="10.5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
          <path d="M44.5 49.2 L47.8 52.5 L54 45.8" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )

    case 'contratista':
      // Casco minero con haz de lámpara frontal sobre credencial empresarial
      return (
        <g>
          {/* Base credencial */}
          <rect x="20" y="42" width="40" height="20" rx="5" fill="#0c1b42" stroke="#60a5fa" strokeWidth="2" />
          <line x1="26" y1="50" x2="44" y2="50" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="26" y1="56" x2="38" y2="56" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
          <circle cx="52" cy="52" r="3.5" fill="#38bdf8" />
          {/* Casco minero blanco y azul */}
          <path d="M22 38 C22 25 30 18 40 18 C50 18 58 25 58 38 Z" fill="#ffffff" stroke="#1e3a8a" strokeWidth="1.6" />
          <path d="M17 38 L63 38 C63 41 59 42 56 42 L24 42 C21 42 17 41 17 38 Z" fill="#2563eb" stroke="#ffffff" strokeWidth="1.6" />
          {/* Lámpara minera frontal */}
          <rect x="35" y="21" width="10" height="8" rx="2.5" fill="#1d4ed8" stroke="#020617" strokeWidth="1.5" />
          <circle cx="40" cy="25" r="2.3" fill="#ffffff" />
        </g>
      )

    case 'seguridad':
      // Escudo octogonal de Seguridad Industrial + marca de verificación luminosa
      return (
        <g>
          <path
            d="M40 15 L59 22 V39 C59 51 50.5 60 40 65 C29.5 60 21 51 21 39 V22 Z"
            fill="#1e3a8a"
            stroke="#ffffff"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path
            d="M40 20 L54 25.2 V38.8 C54 47.8 47.6 54.8 40 58.8 C32.4 54.8 26 47.8 26 38.8 V25.2 Z"
            fill="#0b1530"
            stroke="#60a5fa"
            strokeWidth="1.2"
          />
          <path d="M32.5 39.5 L38 45 L49 33" stroke="#ffffff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )

    case 'caseta-qr':
      // Matriz QR estilizada con rayo láser azul horizontal
      return (
        <g>
          {/* Esquinas del visor escáner */}
          <path d="M18 27 V19 H26" stroke="#60a5fa" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M54 19 H62 V27" stroke="#60a5fa" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18 53 V61 H26" stroke="#60a5fa" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M54 61 H62 V53" stroke="#60a5fa" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          {/* Cuadros QR blancos */}
          <rect x="24" y="24" width="12" height="12" rx="2.5" fill="none" stroke="#ffffff" strokeWidth="2.4" />
          <rect x="28" y="28" width="4" height="4" fill="#ffffff" />
          <rect x="44" y="24" width="12" height="12" rx="2.5" fill="none" stroke="#ffffff" strokeWidth="2.4" />
          <rect x="48" y="28" width="4" height="4" fill="#ffffff" />
          <rect x="24" y="44" width="12" height="12" rx="2.5" fill="none" stroke="#ffffff" strokeWidth="2.4" />
          <rect x="28" y="48" width="4" height="4" fill="#ffffff" />
          <rect x="44" y="44" width="5" height="5" fill="#93c5fd" />
          <rect x="51" y="44" width="5" height="5" fill="#ffffff" />
          <rect x="44" y="51" width="12" height="5" rx="1" fill="#ffffff" />
          {/* Haz escáner activo */}
          <line x1="15" y1="40" x2="65" y2="40" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="20" y1="40" x2="60" y2="40" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" />
        </g>
      )

    case 'campamento':
      // Alojamiento modular 3D con techo geométrico y ventanas iluminadas
      return (
        <g>
          {/* Edificio 3D */}
          <path d="M16 37 L40 20 L64 37" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22 35 V60 H58 V35" fill="#0d1e47" stroke="#60a5fa" strokeWidth="2" strokeLinejoin="round" />
          {/* Puerta central */}
          <rect x="35" y="44" width="10" height="16" rx="2" fill="#2563eb" stroke="#ffffff" strokeWidth="1.6" />
          {/* Ventanas laterales */}
          <rect x="25.5" y="38" width="6.5" height="6.5" rx="1.5" fill="#ffffff" />
          <rect x="48" y="38" width="6.5" height="6.5" rx="1.5" fill="#ffffff" />
          {/* Indicador cubo 3D */}
          <circle cx="40" cy="27" r="2.5" fill="#38bdf8" />
        </g>
      )

    case 'medico':
      // Cruz clínica blanca sobre placa azul con pulso ECG cardíaco
      return (
        <g>
          <rect x="20" y="20" width="40" height="40" rx="11" fill="#2563eb" stroke="#ffffff" strokeWidth="2.2" />
          {/* Cruz blanca */}
          <rect x="35.5" y="26" width="9" height="28" rx="2.5" fill="#ffffff" />
          <rect x="26" y="35.5" width="28" height="9" rx="2.5" fill="#ffffff" />
          {/* Pulso ECG superpuesto en azul profundo */}
          <path
            d="M23 40 H31 L34.5 32 L39 48 L43.5 34 L46.5 40 H57"
            stroke="#061230"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )

    case 'chofer':
      // Cabina frontal de transporte minero con parabrisas iluminado y faros
      return (
        <g>
          {/* Carrocería camión */}
          <rect x="20" y="20" width="40" height="36" rx="8" fill="#1e3a8a" stroke="#ffffff" strokeWidth="2.2" />
          {/* Parabrisas panorámico */}
          <rect x="24.5" y="25" width="31" height="14" rx="3.5" fill="#050b18" stroke="#60a5fa" strokeWidth="1.5" />
          <path d="M28 28 L35 28 L31 35" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.6" />
          {/* Parrilla y faros */}
          <rect x="32" y="44" width="16" height="6" rx="2" fill="#0b1530" stroke="#93c5fd" strokeWidth="1.2" />
          <circle cx="26.5" cy="47" r="3" fill="#ffffff" />
          <circle cx="53.5" cy="47" r="3" fill="#ffffff" />
          {/* Llantas */}
          <rect x="22" y="56" width="8" height="6" rx="2" fill="#ffffff" />
          <rect x="50" y="56" width="8" height="6" rx="2" fill="#ffffff" />
        </g>
      )

    case 'viajes':
      // Ruta curva cinética + autobús de personal y pin de destino
      return (
        <g>
          {/* Arco de ruta */}
          <path d="M16 56 C24 44, 52 44, 62 24" stroke="#60a5fa" strokeWidth="2.4" strokeDasharray="4 3" strokeLinecap="round" />
          {/* Pin de destino arriba derecha */}
          <path d="M56 16 C51.5 16 48 19.5 48 24 C48 29.5 56 36 56 36 C56 36 64 29.5 64 24 C64 19.5 60.5 16 56 16 Z" fill="#ffffff" />
          <circle cx="56" cy="24" r="2.8" fill="#2563eb" />
          {/* Silueta de autobús */}
          <rect x="17" y="30" width="26" height="18" rx="4.5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
          <rect x="20" y="33.5" width="20" height="7" rx="1.5" fill="#07112b" />
          <circle cx="22.5" cy="49" r="3" fill="#ffffff" />
          <circle cx="37.5" cy="49" r="3" fill="#ffffff" />
        </g>
      )

    case 'farmacia':
      return (
        <g>
          <g transform="rotate(-35 40 40)">
            <rect x="20" y="30" width="40" height="20" rx="10" fill="#2563eb" stroke="#ffffff" strokeWidth="2.2" />
            <path d="M20 40 C20 34.5 24.5 30 30 30 H40 V50 H30 C24.5 50 20 45.5 20 40 Z" fill="#ffffff" />
          </g>
          <circle cx="54" cy="24" r="3" fill="#60a5fa" />
        </g>
      )

    case 'pases':
      return (
        <g>
          <rect x="17" y="25" width="46" height="30" rx="6" fill="#0d1e47" stroke="#ffffff" strokeWidth="2.2" />
          <line x1="33" y1="25" x2="33" y2="55" stroke="#60a5fa" strokeWidth="1.8" strokeDasharray="3 3" />
          <rect x="22" y="37" width="6" height="6" rx="1" fill="#ffffff" />
          <line x1="39" y1="35" x2="57" y2="35" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
          <line x1="39" y1="43" x2="52" y2="43" stroke="#93c5fd" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      )

    case 'hotel':
      return (
        <g>
          <rect x="21" y="18" width="38" height="44" rx="5" fill="#1e3a8a" stroke="#ffffff" strokeWidth="2.2" />
          <rect x="28" y="25" width="8" height="7" rx="1.5" fill="#ffffff" />
          <rect x="44" y="25" width="8" height="7" rx="1.5" fill="#ffffff" />
          <rect x="28" y="37" width="8" height="7" rx="1.5" fill="#60a5fa" />
          <rect x="44" y="37" width="8" height="7" rx="1.5" fill="#60a5fa" />
          <rect x="35" y="49" width="10" height="13" rx="2" fill="#050b1c" stroke="#ffffff" strokeWidth="1.6" />
        </g>
      )

    case 'clinicas':
      return (
        <g>
          <path d="M18 59 V27 H34 V19 H46 V27 H62 V59 Z" fill="#0d1e47" stroke="#ffffff" strokeWidth="2.2" strokeLinejoin="round" />
          <rect x="38" y="24" width="4" height="12" rx="1" fill="#60a5fa" />
          <rect x="34" y="28" width="12" height="4" rx="1" fill="#60a5fa" />
          <rect x="35" y="44" width="10" height="15" rx="1.5" fill="#2563eb" stroke="#ffffff" strokeWidth="1.6" />
        </g>
      )

    case 'flota':
      return (
        <g>
          <circle cx="40" cy="40" r="21" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeDasharray="4 3" />
          <circle cx="40" cy="40" r="12" fill="#1e3a8a" stroke="#93c5fd" strokeWidth="1.6" />
          <path d="M40 24 L46 37 L40 40 L34 37 Z" fill="#ffffff" />
          <circle cx="40" cy="40" r="4" fill="#38bdf8" stroke="#020617" strokeWidth="1.4" />
        </g>
      )

    case 'accesos':
      return (
        <g>
          <rect x="18" y="44" width="12" height="18" rx="3" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
          <path d="M27 46 L60 28" stroke="#ffffff" strokeWidth="5.5" strokeLinecap="round" />
          <path d="M32 43.3 L57 29.6" stroke="#2563eb" strokeWidth="3.5" strokeDasharray="6 5" />
          <circle cx="56" cy="52" r="7" fill="#0c1b42" stroke="#60a5fa" strokeWidth="2" />
          <circle cx="56" cy="52" r="2.5" fill="#ffffff" />
        </g>
      )

    case 'integracion':
      return (
        <g>
          <circle cx="33" cy="36" r="11" fill="none" stroke="#ffffff" strokeWidth="2.6" />
          <circle cx="47" cy="36" r="11" fill="none" stroke="#60a5fa" strokeWidth="2.6" />
          <circle cx="40" cy="48" r="11" fill="none" stroke="#2563eb" strokeWidth="2.8" />
          <circle cx="40" cy="40" r="4" fill="#ffffff" />
        </g>
      )

    case 'prenomina':
      return (
        <g>
          <circle cx="40" cy="40" r="20" fill="#0d1e47" stroke="#ffffff" strokeWidth="2.4" />
          <path d="M40 27 V40 L50 45" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="40" cy="40" r="3" fill="#ffffff" />
        </g>
      )

    case 'solicitudes':
      return (
        <g>
          <path d="M18 39 L24 22 H56 L62 39 V57 H18 Z" fill="#0d1e47" stroke="#ffffff" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M18 39 H30 L34 45 H46 L50 39 H62" stroke="#60a5fa" strokeWidth="2.2" strokeLinejoin="round" />
          <line x1="33" y1="30" x2="47" y2="30" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      )

    case 'autorizaciones':
      return (
        <g>
          <rect x="20" y="20" width="40" height="40" rx="10" fill="#1e3a8a" stroke="#ffffff" strokeWidth="2.2" />
          <path d="M29 41 L37 49 L52 31" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )

    case 'comedor':
      return (
        <g>
          <path d="M18 50 H62" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
          <path d="M22 46 C22 33 30 25 40 25 C50 25 58 33 58 46 Z" fill="#2563eb" stroke="#ffffff" strokeWidth="2.2" />
          <circle cx="40" cy="21" r="3.5" fill="#ffffff" />
          <path d="M31 35 C34 31 38 30 43 30" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
        </g>
      )

    case 'evaluaciones':
      return (
        <g>
          <rect x="21" y="42" width="9" height="18" rx="2.5" fill="#60a5fa" />
          <rect x="35.5" y="32" width="9" height="28" rx="2.5" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
          <rect x="50" y="22" width="9" height="38" rx="2.5" fill="#ffffff" />
        </g>
      )

    case 'calendario':
      return (
        <g>
          <rect x="19" y="22" width="42" height="38" rx="7" fill="#0d1e47" stroke="#ffffff" strokeWidth="2.2" />
          <path d="M19 32 H61" stroke="#60a5fa" strokeWidth="2.2" />
          <line x1="30" y1="17" x2="30" y2="25" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" />
          <line x1="50" y1="17" x2="50" y2="25" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" />
          <rect x="26" y="38" width="8" height="7" rx="1.5" fill="#ffffff" />
          <rect x="36" y="38" width="8" height="7" rx="1.5" fill="#3b82f6" />
          <rect x="46" y="38" width="8" height="7" rx="1.5" fill="#ffffff" />
          <rect x="26" y="48" width="8" height="7" rx="1.5" fill="#60a5fa" />
        </g>
      )

    case 'chat':
      return (
        <g>
          <path d="M18 24 H52 V46 H34 L24 55 V46 H18 Z" fill="#2563eb" stroke="#ffffff" strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="28" cy="35" r="2.5" fill="#ffffff" />
          <circle cx="35" cy="35" r="2.5" fill="#ffffff" />
          <circle cx="42" cy="35" r="2.5" fill="#ffffff" />
        </g>
      )

    case 'catalogos':
      return (
        <g>
          <rect x="20" y="22" width="17" height="17" rx="4" fill="#ffffff" />
          <rect x="43" y="22" width="17" height="17" rx="4" fill="#2563eb" stroke="#ffffff" strokeWidth="1.8" />
          <rect x="20" y="43" width="17" height="17" rx="4" fill="#60a5fa" />
          <rect x="43" y="43" width="17" height="17" rx="4" fill="#0d1e47" stroke="#60a5fa" strokeWidth="2" />
        </g>
      )

    case 'documentos':
      return (
        <g>
          <path d="M23 18 H47 L57 28 V60 H23 Z" fill="#0d1e47" stroke="#ffffff" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M47 18 V28 H57" stroke="#60a5fa" strokeWidth="2" strokeLinejoin="round" />
          <line x1="30" y1="36" x2="50" y2="36" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="30" y1="44" x2="50" y2="44" stroke="#93c5fd" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="30" y1="52" x2="42" y2="52" stroke="#60a5fa" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      )

    case 'lockers':
      return (
        <g>
          <rect x="20" y="18" width="18" height="44" rx="4" fill="#1e3a8a" stroke="#ffffff" strokeWidth="2" />
          <rect x="42" y="18" width="18" height="44" rx="4" fill="#0d1e47" stroke="#60a5fa" strokeWidth="2" />
          <line x1="25" y1="26" x2="33" y2="26" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
          <line x1="47" y1="26" x2="55" y2="26" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" />
          <circle cx="33" cy="40" r="2" fill="#ffffff" />
          <circle cx="55" cy="40" r="2" fill="#60a5fa" />
        </g>
      )

    case 'usuarios':
      return (
        <g>
          <circle cx="34" cy="35" r="10" fill="none" stroke="#ffffff" strokeWidth="2.8" />
          <circle cx="34" cy="35" r="4" fill="#2563eb" />
          <path d="M43 40 L59 52 L55 56 L51 53 L47 56" stroke="#60a5fa" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )

    case 'perfil':
    default:
      return (
        <g>
          <circle cx="40" cy="31" r="8" fill="#ffffff" />
          <path d="M24 58 C24 47.5 31 42 40 42 C49 42 56 47.5 56 58" fill="#2563eb" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      )
  }
}
