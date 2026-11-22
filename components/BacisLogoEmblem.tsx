'use client'

import React from 'react'

interface BacisLogoEmblemProps {
  className?: string
  showGlow?: boolean
}

/**
 * Emblema Vectorial Oficial de Grupo Minero Bacís S.A. de C.V. ("GB")
 * Basado en el escudo institucional: arco de túnel minero negro/plata,
 * núcleo azul cobalto Bacís, pico y martillo cruzados y monograma blanco "GB".
 */
export function BacisLogoEmblem({ className = 'w-16 h-16', showGlow = true }: BacisLogoEmblemProps) {
  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      {showGlow && (
        <div
          className="absolute inset-0 rounded-full blur-xl opacity-60 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(37,99,235,0.75) 0%, rgba(14,165,233,0.28) 55%, transparent 78%)',
          }}
        />
      )}
      <svg
        viewBox="0 0 120 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative w-full h-full drop-shadow-[0_6px_18px_rgba(37,99,235,0.55)]"
        aria-label="Logotipo Grupo Minero Bacís"
      >
        <defs>
          <linearGradient id="bacisBlueCore" x1="60" y1="12" x2="60" y2="88" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="48%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#0f2966" />
          </linearGradient>
          <linearGradient id="bacisArchRim" x1="20" y1="10" x2="100" y2="92" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#94a3b8" />
            <stop offset="70%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="bacisSteel" x1="40" y1="18" x2="80" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
        </defs>

        {/* Base negra exterior del arco / túnel minero */}
        <path
          d="M12 88 L22 88 L27 42 C29 20 43 10 60 10 C77 10 91 20 93 42 L98 88 L108 88 L108 94 L12 94 Z"
          fill="#020617"
          stroke="url(#bacisArchRim)"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />

        {/* Interior azul Bacís */}
        <path
          d="M27 88 L32 44 C34 26 45 17 60 17 C75 17 86 26 88 44 L93 88 Z"
          fill="url(#bacisBlueCore)"
          stroke="#60a5fa"
          strokeWidth="1.3"
        />

        {/* Destello superior sutil dentro del arco */}
        <path
          d="M36 42 C38 28 47 21 60 21 C73 21 82 28 84 42 C74 36 46 36 36 42 Z"
          fill="rgba(255,255,255,0.14)"
        />

        {/* Pico y martillo minero cruzados */}
        <g stroke="#020617" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          {/* Mango 1 */}
          <path d="M47 47 L73 26" stroke="url(#bacisSteel)" strokeWidth="3.2" />
          {/* Mango 2 */}
          <path d="M73 47 L47 26" stroke="url(#bacisSteel)" strokeWidth="3.2" />
          {/* Cabeza del pico (izquierda arriba) */}
          <path
            d="M42 30 C46 23 53 22 57 24 L53 28 C49 27 46 29 44 32 Z"
            fill="#f8fafc"
          />
          {/* Cabeza del martillo / mazo (derecha arriba) */}
          <rect
            x="66"
            y="22"
            width="10"
            height="6"
            rx="1.2"
            transform="rotate(36 71 25)"
            fill="#f8fafc"
          />
        </g>

        {/* Monograma oficial GB en blanco puro */}
        <text
          x="60"
          y="80"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontWeight="900"
          fontSize="31"
          letterSpacing="1.5"
          style={{ filter: 'drop-shadow(0px 2px 4px rgba(2,6,23,0.9))' }}
        >
          GB
        </text>

        {/* Línea base brillante azul-blanco */}
        <line x1="16" y1="91" x2="104" y2="91" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.85" />
      </svg>
    </div>
  )
}
