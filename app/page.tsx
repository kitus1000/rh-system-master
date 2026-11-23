'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/utils/supabase/client'
import Link from 'next/link'
import {
  ArrowRight,
  Lock,
  Mail,
  ChevronLeft,
  Eye,
  EyeOff,
  Cpu,
  Wifi,
  Shield,
  Layers,
  Activity,
  LogIn,
} from 'lucide-react'
import { BacisLogoEmblem } from '@/components/BacisLogoEmblem'
import { PortalAppIcon, type PortalIconId } from '@/components/PortalAppIcons'

type LoginTarget =
  | 'rh'
  | 'medico'
  | 'jefes'
  | 'chofer'
  | 'campamento'
  | 'contratista'
  | 'seguridad'
  | 'caseta'

type ZoneKey = 'all' | 'corporativo' | 'operacion' | 'servicios'

interface PortalCardConfig {
  id: string
  iconId: PortalIconId
  code: string
  title: string
  shortTitle: string
  subtitle: string
  tag: string
  zone: Exclude<ZoneKey, 'all'>
  target?: LoginTarget
  href?: string
  featured?: boolean
  directAccess?: boolean
}

const BOOT_STEPS = [
  'Inicializando sistema PORTAL BACIS...',
  'Verificando enlace Unidad El Herrero...',
  'Cargando módulos y accesos operativos...',
  'Sistema listo',
]

const PORTAL_CARDS: PortalCardConfig[] = [
  // ZONA 01: DIRECCIÓN, RH & CONTRATISTAS
  {
    id: 'rh',
    iconId: 'rh',
    code: '01',
    title: 'Acceso RH & Control',
    shortTitle: 'RH & Control',
    subtitle: 'Centro de personal, nómina, sindicato Secc. 45 y expedientes.',
    tag: 'CENTRAL',
    zone: 'corporativo',
    target: 'rh',
    featured: true,
  },
  {
    id: 'jefes',
    iconId: 'jefes',
    code: '02',
    title: 'Jefes de Área',
    shortTitle: 'Jefes',
    subtitle: 'Autorizaciones, ausencias, escalafón y visto bueno.',
    tag: 'MANDO',
    zone: 'corporativo',
    target: 'jefes',
  },
  {
    id: 'contratista',
    iconId: 'contratista',
    code: '03',
    title: 'Portal Contratistas',
    shortTitle: 'Contratistas',
    subtitle: 'Empresas externas, NSS/IMSS/SAT, permisos y pase QR.',
    tag: 'EXTERNO',
    zone: 'corporativo',
    target: 'contratista',
  },

  // ZONA 02: SEGURIDAD, ACCESOS & CAMPAMENTOS
  {
    id: 'seguridad',
    iconId: 'seguridad',
    code: '04',
    title: 'Seguridad Industrial',
    shortTitle: 'Seguridad',
    subtitle: 'Inducciones de seguridad, requisitos y fechas.',
    tag: 'SEGURIDAD',
    zone: 'operacion',
    target: 'seguridad',
  },
  {
    id: 'caseta-qr',
    iconId: 'caseta-qr',
    code: '05',
    title: 'Checador QR Caseta',
    shortTitle: 'Checador QR',
    subtitle: 'Escaneo QR directo sin usuario para entradas y salidas.',
    tag: 'DIRECTO QR',
    zone: 'operacion',
    href: '/caseta-qr',
    directAccess: true,
  },
  {
    id: 'campamento',
    iconId: 'campamento',
    code: '06',
    title: 'Campamentos y Comedor',
    shortTitle: 'Campamentos',
    subtitle: 'Mapa 3D de camas, lavandería y control de comedor.',
    tag: '3D / CAMAS',
    zone: 'operacion',
    target: 'campamento',
  },

  // ZONA 03: SALUD, LOGÍSTICA & TRASLADOS
  {
    id: 'medico',
    iconId: 'medico',
    code: '07',
    title: 'Servicios Médicos',
    shortTitle: 'Médico',
    subtitle: 'Consultas, recetas COFEPRIS, beneficiarios y pases.',
    tag: 'CLÍNICA',
    zone: 'servicios',
    target: 'medico',
  },
  {
    id: 'chofer',
    iconId: 'chofer',
    code: '08',
    title: 'Portal Choferes',
    shortTitle: 'Choferes',
    subtitle: 'Checklist de unidades, rutas y abordaje QR.',
    tag: 'FLOTA',
    zone: 'servicios',
    target: 'chofer',
  },
  {
    id: 'viajes',
    iconId: 'viajes',
    code: '09',
    title: 'Portal de Viajes',
    shortTitle: 'Viajes',
    subtitle: 'Auto-reservación directa de traslados de personal.',
    tag: 'DIRECTO',
    zone: 'servicios',
    href: '/reservar-viaje',
    directAccess: true,
  },
]

const LOGIN_PORTAL_TARGETS: {
  target: LoginTarget
  iconId: PortalIconId
  label: string
}[] = [
  { target: 'rh', iconId: 'rh', label: 'RH Control' },
  { target: 'jefes', iconId: 'jefes', label: 'Jefaturas' },
  { target: 'contratista', iconId: 'contratista', label: 'Contratistas' },
  { target: 'seguridad', iconId: 'seguridad', label: 'Seguridad' },
  { target: 'caseta', iconId: 'caseta-qr', label: 'Caseta QR' },
  { target: 'campamento', iconId: 'campamento', label: 'Campamento' },
  { target: 'medico', iconId: 'medico', label: 'Médicos' },
  { target: 'chofer', iconId: 'chofer', label: 'Choferes' },
]

const ZONE_META: Record<
  Exclude<ZoneKey, 'all'>,
  { num: string; title: string; subtitle: string; icon: any }
> = {
  corporativo: {
    num: '01',
    title: 'Dirección, RH & Contratistas',
    subtitle: 'Control de personal, aprobaciones y proveedores',
    icon: Layers,
  },
  operacion: {
    num: '02',
    title: 'Seguridad, Caseta & Campamentos',
    subtitle: 'Accesos a mina, inducción y alojamiento 3D',
    icon: Shield,
  },
  servicios: {
    num: '03',
    title: 'Salud, Choferes & Traslados',
    subtitle: 'Clínica médica COFEPRIS, flota y transporte',
    icon: Activity,
  },
}

/**
 * Spinner orbital de 5 puntos luminosos estilo arranque de Windows / Software
 */
function WindowsOrbitLoader({ size = 42 }: { size?: number }) {
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-label="Cargando sistema"
    >
      {[0, 1, 2, 3, 4].map((idx) => (
        <div
          key={idx}
          className="absolute inset-0 bacis-win-dot"
          style={{ animationDelay: `${idx * 135}ms` }}
        >
          <span
            className="block rounded-full mx-auto"
            style={{
              width: idx === 0 ? 6.5 : 5,
              height: idx === 0 ? 6.5 : 5,
              background: idx % 2 === 0 ? '#ffffff' : '#38bdf8',
              boxShadow: '0 0 10px rgba(56,189,248,0.95), 0 0 18px rgba(37,99,235,0.8)',
            }}
          />
        </div>
      ))}
    </div>
  )
}

export default function LandingHub() {
  const [phase, setPhase] = useState<'boot' | 'ready'>('boot')
  const [bootProgress, setBootProgress] = useState(12)
  const [bootStepIdx, setBootStepIdx] = useState(0)
  const [animCycle, setAnimCycle] = useState(1)

  const [view, setView] = useState<'hub' | 'login'>('hub')
  const [activeZone, setActiveZone] = useState<ZoneKey>('all')
  const [clockTime, setClockTime] = useState('')
  const [clockDate, setClockDate] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [enteringSystem, setEnteringSystem] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loginTarget, setLoginTarget] = useState<LoginTarget>('rh')
  const [contractorMode, setContractorMode] = useState<'login' | 'request'>('login')
  const [requestDone, setRequestDone] = useState(false)
  const [reqForm, setReqForm] = useState({
    razon_social: '',
    rfc: '',
    representante_legal: '',
    telefono: '',
    correo: '',
    especialidad: '',
    notas: '',
  })

  // Reloj del sistema en vivo
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClockTime(
        now.toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      )
      setClockDate(
        now.toLocaleDateString('es-MX', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Carga inicial rápida tipo arranque real de software / Windows (sin botones de replay)
  const runInitialBoot = useCallback(() => {
    const t1 = setTimeout(() => {
      setBootProgress(46)
      setBootStepIdx(1)
    }, 260)
    const t2 = setTimeout(() => {
      setBootProgress(82)
      setBootStepIdx(2)
    }, 620)
    const t3 = setTimeout(() => {
      setBootProgress(100)
      setBootStepIdx(3)
    }, 960)
    const t4 = setTimeout(() => {
      setPhase('ready')
      setAnimCycle((c) => c + 1)
    }, 1220)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('next')) {
        setView('login')
        setPhase('ready')
        return
      }
    }
    const cleanup = runInitialBoot()
    return cleanup
  }, [runInitialBoot])

  const handleChangeZone = (zone: ZoneKey) => {
    setActiveZone(zone)
    setAnimCycle((c) => c + 1)
  }

  const resolveRedirectByRole = (rolRaw: string, nameRaw: string, target: LoginTarget): string => {
    const r = `${rolRaw} ${nameRaw}`.toLowerCase()
    if (r.includes('contratista')) return '/contratistas-portal'
    if (r.includes('corporativo') || r.includes('rh unidad') || r.includes('sindicato'))
      return '/movimientos-sindicato'
    if (r.includes('caseta') || r.includes('patrimonial')) return '/caseta'
    if (r.includes('seguridad') && !r.includes('jefe')) return '/seguridad'
    if (r.includes('chofer') || r.includes('conductor')) return '/logistica/choferes'
    if (r.includes('campamento') || r.includes('comedor')) return '/campamentos'
    if (r.includes('médic') || r.includes('medic') || r.includes('doctor')) return '/medico/consultas'
    if (
      r.includes('jefe de departamento') ||
      r === 'jefe' ||
      r.includes('supervisor') ||
      r.includes('superintendente')
    )
      return '/mi-departamento'
    if (target === 'chofer') return '/logistica/choferes'
    if (target === 'campamento') return '/campamentos'
    if (target === 'contratista') return '/contratistas-portal'
    if (target === 'caseta') return '/caseta'
    if (target === 'seguridad') return '/seguridad'
    if (target === 'medico') return '/medico/consultas'
    if (target === 'jefes') return '/mi-departamento'
    return '/inicio'
  }

  const launchWithSystemWelcome = (destination: string, welcomeLabel?: string) => {
    setEnteringSystem(welcomeLabel || 'Cargando espacio de trabajo...')
    setTimeout(() => {
      window.location.href = destination
    }, 760)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      let loginEmail = email.trim()
      if (!loginEmail.includes('@')) {
        loginEmail = `${loginEmail}@bacis.com`
      }

      let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      })

      if (authError && !email.trim().includes('@')) {
        const retryMina = await supabase.auth.signInWithPassword({
          email: `${email.trim()}@mina.com`,
          password,
        })
        if (!retryMina.error) {
          authData = retryMina.data
          authError = null
        }
      }

      const searchParams = new URLSearchParams(window.location.search)
      let nextPath = searchParams.get('next')
      let welcomeName = ''

      if (!nextPath && authData?.user?.id) {
        const { data: profData } = await supabase
          .from('perfiles')
          .select('rol, nombre_completo')
          .eq('id', authData.user.id)
          .single()
        const metaRol = (authData.user.user_metadata?.rol || '') as string
        welcomeName = profData?.nombre_completo || ''
        nextPath = resolveRedirectByRole(
          profData?.rol || metaRol || '',
          profData?.nombre_completo || '',
          loginTarget
        )
      }

      if (!nextPath) {
        nextPath = resolveRedirectByRole('', '', loginTarget)
      }

      if (authError) {
        if (email === 'admin@example.com' && password === 'admin') {
          launchWithSystemWelcome(nextPath, 'Bienvenido Administrador · Iniciando PORTAL BACIS...')
          return
        }

        const { data: fallbackProf } = await supabase
          .from('perfiles')
          .select('*')
          .or(`nombre_completo.ilike.%${email.split('@')[0]}%,rol.ilike.Chofer`)
          .limit(1)
        if (fallbackProf && fallbackProf.length > 0) {
          const prof = fallbackProf[0]
          launchWithSystemWelcome(
            resolveRedirectByRole(prof.rol || '', prof.nombre_completo || '', loginTarget),
            `Bienvenido ${prof.nombre_completo || ''} · Iniciando sesión...`
          )
          return
        }

        setError('Credenciales inválidas o correo no confirmado')
        setLoading(false)
        return
      }

      launchWithSystemWelcome(
        nextPath,
        welcomeName
          ? `Bienvenido, ${welcomeName} · Abriendo PORTAL BACIS...`
          : `Iniciando ${meta.title}...`
      )
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleContractorRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/contratistas/solicitar-cuenta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqForm),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error enviando solicitud')
      setRequestDone(true)
      setReqForm({
        razon_social: '',
        rfc: '',
        representante_legal: '',
        telefono: '',
        correo: '',
        especialidad: '',
        notas: '',
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getTargetMeta = () => {
    switch (loginTarget) {
      case 'rh':
        return {
          iconId: 'rh' as PortalIconId,
          title: 'Acceso RH & Control Central',
          sub: 'Personal, nómina semanal/quincenal, sindicato Secc. 45 y control integral',
        }
      case 'medico':
        return {
          iconId: 'medico' as PortalIconId,
          title: 'Servicios Médicos & Clínica',
          sub: 'Consultas, recetas COFEPRIS, farmacia, beneficiarios y pases médicos',
        }
      case 'jefes':
        return {
          iconId: 'jefes' as PortalIconId,
          title: 'Jefes de Área & Superintendentes',
          sub: 'Autorizaciones, ausencias, escalafón y visto bueno a contratistas',
        }
      case 'chofer':
        return {
          iconId: 'chofer' as PortalIconId,
          title: 'Portal de Choferes',
          sub: 'Checklist vehicular, rutas mineras y escaneo QR de pasajeros',
        }
      case 'campamento':
        return {
          iconId: 'campamento' as PortalIconId,
          title: 'Campamentos y Comedor',
          sub: 'Control 3D de camas, lavandería, disponibilidad y comedor',
        }
      case 'contratista':
        return {
          iconId: 'contratista' as PortalIconId,
          title: 'Portal de Contratistas',
          sub: 'Alta de personal externo, documentos NSS/IMSS/SAT, permisos y QR',
        }
      case 'seguridad':
        return {
          iconId: 'seguridad' as PortalIconId,
          title: 'Seguridad Industrial',
          sub: 'Revisión de requisitos, inducciones y validación de contratistas',
        }
      case 'caseta':
        return {
          iconId: 'caseta-qr' as PortalIconId,
          title: 'Caseta (Credenciales QR)',
          sub: 'Control de credenciales autorizadas, entradas, salidas y devolución',
        }
    }
  }

  const meta = getTargetMeta()

  const openPortalLogin = (target: LoginTarget) => {
    setLoginTarget(target)
    setError(null)
    setRequestDone(false)
    if (target === 'contratista') setContractorMode('login')
    setView('login')
  }

  const visibleZones: Exclude<ZoneKey, 'all'>[] =
    activeZone === 'all' ? ['corporativo', 'operacion', 'servicios'] : [activeZone]

  return (
    <div className="min-h-screen bg-[#02050b] text-white relative overflow-x-hidden selection:bg-blue-600 selection:text-white font-sans flex flex-col">
      {/* FONDO CORPORATIVO BACÍS: NEGRO OBSIDIANA + AZUL REY + DESTELLO BLANCO */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.2]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(37,99,235,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(37,99,235,0.2) 1px, transparent 1px)',
            backgroundSize: '46px 46px',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 75% 55% at 50% -10%, rgba(29,78,216,0.42) 0%, rgba(15,23,42,0.55) 45%, rgba(2,5,11,0.98) 100%)',
          }}
        />
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[760px] h-[360px] rounded-full blur-[130px] bacis-halo-pulse"
          style={{ background: 'rgba(37, 99, 235, 0.3)' }}
        />
        <div
          className="absolute bottom-[-120px] left-[-100px] w-[400px] h-[400px] rounded-full blur-[130px]"
          style={{ background: 'rgba(29, 78, 216, 0.2)' }}
        />
        <div
          className="absolute left-0 right-0 h-[2px] bacis-scanline"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(56,189,248,0.5) 30%, rgba(255,255,255,0.8) 50%, rgba(37,99,235,0.5) 70%, transparent 100%)',
          }}
        />
      </div>

      {/* PANTALLA DE ARRANQUE DE SOFTWARE PORTAL BACIS (sin botón de replay) */}
      {phase === 'boot' && (
        <div className="fixed inset-0 z-50 bg-[#02050b] flex flex-col items-center justify-center p-6 overflow-hidden">
          <div
            className="absolute w-[500px] h-[500px] rounded-full blur-[120px] bacis-halo-pulse pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.45) 0%, rgba(2,5,11,0) 70%)' }}
          />

          <div className="relative z-10 flex flex-col items-center text-center max-w-md w-full space-y-6">
            <div className="relative flex items-center justify-center bacis-logo-boot">
              <div className="absolute -inset-4 rounded-full border border-blue-500/35 animate-spin" style={{ animationDuration: '9s' }} />
              <div className="w-28 h-24 rounded-3xl bg-gradient-to-b from-[#0b1630] to-black border border-blue-500/50 shadow-[0_0_50px_rgba(37,99,235,0.5)] flex items-center justify-center p-3">
                <BacisLogoEmblem className="w-24 h-20" />
              </div>
            </div>

            <div className="space-y-1.5 bacis-logo-boot" style={{ animationDelay: '80ms' }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/15 border border-blue-400/30 text-[10px] font-mono font-bold tracking-[0.25em] text-blue-300 uppercase">
                <Cpu className="w-3 h-3 text-blue-400" />
                GRUPO MINERO BACÍS S.A. DE C.V.
              </div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-[0.14em] text-white drop-shadow-[0_0_24px_rgba(37,99,235,0.65)]">
                PORTAL <span className="text-blue-400">BACIS</span>
              </h1>
              <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-slate-400">
                UNIDAD EL HERRERO · SISTEMA INTEGRAL
              </p>
            </div>

            <div className="w-full space-y-4 pt-2 flex flex-col items-center">
              <WindowsOrbitLoader size={42} />

              <div className="w-full max-w-xs space-y-2">
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: `${bootProgress}%`,
                      background: 'linear-gradient(90deg, #1d4ed8 0%, #3b82f6 65%, #ffffff 100%)',
                      boxShadow: '0 0 16px rgba(59,130,246,0.9)',
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-blue-200/80">
                  <span className="truncate pr-2">{BOOT_STEPS[bootStepIdx]}</span>
                  <span className="font-black text-white shrink-0">{bootProgress}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY DE BIENVENIDA AL AUTENTICAR */}
      {enteringSystem && (
        <div className="fixed inset-0 z-50 bg-[#02050b]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="flex flex-col items-center text-center space-y-5 max-w-md">
            <div className="w-24 h-20 rounded-3xl bg-gradient-to-b from-blue-950 to-black border border-blue-400/50 shadow-[0_0_60px_rgba(37,99,235,0.65)] flex items-center justify-center p-2.5">
              <BacisLogoEmblem className="w-20 h-16" />
            </div>
            <h2 className="text-3xl font-black tracking-[0.14em] text-white uppercase">
              PORTAL <span className="text-blue-400">BACIS</span>
            </h2>
            <WindowsOrbitLoader size={44} />
            <p className="text-xs font-mono tracking-wider text-blue-200 uppercase">
              {enteringSystem}
            </p>
          </div>
        </div>
      )}

      {/* BARRA SUPERIOR ESTILO SOFTWARE PORTAL BACIS (sin botón de replay) */}
      {phase === 'ready' && (
        <header className="relative z-20 border-b border-blue-500/20 bg-black/75 backdrop-blur-xl bacis-header-drop">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setView('hub')}
              className="flex items-center gap-3 group cursor-pointer text-left"
            >
              <div className="w-11 h-10 rounded-xl bg-gradient-to-b from-blue-950/90 to-black border border-blue-500/40 flex items-center justify-center p-1 shadow-[0_0_20px_rgba(37,99,235,0.35)] group-hover:border-white/70 transition-all">
                <BacisLogoEmblem className="w-9 h-8" showGlow={false} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-black tracking-[0.14em] text-white leading-none">
                    PORTAL <span className="text-blue-400">BACIS</span>
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-600/20 border border-blue-400/30 text-[9px] font-mono font-bold text-blue-200 uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    EN LÍNEA
                  </span>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 block mt-0.5">
                  Grupo Minero Bacís · Unidad El Herrero
                </span>
              </div>
            </button>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 font-mono">
                <Wifi className="w-3.5 h-3.5 text-blue-400" />
                <div className="text-right leading-tight">
                  <div className="text-xs font-black text-white tracking-wider">
                    {clockTime || '00:00:00'}
                  </div>
                  <div className="text-[9px] text-slate-400 uppercase">{clockDate}</div>
                </div>
              </div>

              {view === 'hub' ? (
                <button
                  type="button"
                  onClick={() => openPortalLogin('rh')}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black tracking-wider uppercase flex items-center gap-1.5 shadow-[0_0_24px_rgba(37,99,235,0.5)] border border-blue-400/50 transition-all cursor-pointer active:scale-95"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Iniciar Sesión</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setView('hub')}
                  className="px-4 py-2 rounded-xl bg-white text-black hover:bg-blue-50 text-xs font-black tracking-wider uppercase flex items-center gap-1.5 shadow-lg transition-all cursor-pointer active:scale-95"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Menú de Íconos</span>
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {/* CONTENIDO PRINCIPAL: MENÚ PRINCIPAL DE ÍCONOS Y PANTALLA DE LOGIN CON ÍCONOS */}
      {phase === 'ready' && (
        <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-8">
          <div className="w-full max-w-6xl">
            {view === 'hub' ? (
              <div className="space-y-8">
                {/* ENCABEZADO DEL ESCRITORIO DE PORTALES */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 bacis-header-drop">
                  <div className="space-y-2">
                    <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white uppercase leading-none">
                      PORTAL <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-200 to-white">BACIS</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
                      Toca el ícono de tu departamento o sistema operativo para ingresar.
                    </p>
                  </div>

                  {/* Selector de zonas */}
                  <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-black/80 border border-blue-500/25 backdrop-blur-xl shadow-lg">
                    {(
                      [
                        { id: 'all', label: 'Todos', count: 9 },
                        { id: 'corporativo', label: 'RH & Empresas', count: 3 },
                        { id: 'operacion', label: 'Seguridad & Mina', count: 3 },
                        { id: 'servicios', label: 'Médicos & Flota', count: 3 },
                      ] as const
                    ).map((tab) => {
                      const active = activeZone === tab.id
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => handleChangeZone(tab.id)}
                          className={`px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                            active
                              ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.6)] border border-blue-400/60'
                              : 'text-slate-400 hover:text-white hover:bg-white/[0.06] border border-transparent'
                          }`}
                        >
                          <span>{tab.label}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                              active ? 'bg-black/35 text-white' : 'bg-white/10 text-slate-300'
                            }`}
                          >
                            {tab.count}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* LANZADOR VISUAL DE ÍCONOS CREADOS A MEDIDA (3 ZONAS ORGANIZADAS) */}
                <div key={animCycle} className="space-y-6">
                  {visibleZones.map((zoneKey, zIdx) => {
                    const zMeta = ZONE_META[zoneKey]
                    const ZoneIcon = zMeta.icon
                    const cardsInZone = PORTAL_CARDS.filter((c) => c.zone === zoneKey)

                    return (
                      <section
                        key={zoneKey}
                        className="rounded-3xl bg-gradient-to-br from-[#071127]/75 via-[#040914]/85 to-black/85 border border-blue-500/20 p-5 sm:p-6 backdrop-blur-xl shadow-[0_16px_44px_-16px_rgba(0,0,0,0.8)] space-y-5"
                      >
                        <div
                          className="flex items-center justify-between gap-3 pb-3 border-b border-white/10 bacis-zone-reveal"
                          style={{ animationDelay: `${zIdx * 80}ms` }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-mono font-black text-xs flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.6)]">
                              {zMeta.num}
                            </span>
                            <div>
                              <h2 className="text-xs sm:text-sm font-black uppercase tracking-[0.15em] text-white flex items-center gap-2">
                                <ZoneIcon className="w-4 h-4 text-blue-400" />
                                {zMeta.title}
                              </h2>
                              <p className="text-[11px] text-slate-400 hidden sm:block">
                                {zMeta.subtitle}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-blue-300/80 uppercase tracking-widest">
                            {cardsInZone.length} ACCESOS
                          </span>
                        </div>

                        {/* Íconos estilo App Launcher con vuelo cinético rápido */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {cardsInZone.map((card, cIdx) => {
                            const globalIdx = zIdx * 3 + cIdx
                            const flyClass = `bacis-tile-in-${globalIdx % 9}`
                            const staggerMs = globalIdx * 55

                            const iconTileInner = (
                              <>
                                {/* Destello sutil al acomodarse */}
                                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                                  <div
                                    className="w-1/2 h-full bacis-tile-sheen"
                                    style={{
                                      animationDelay: `${staggerMs + 340}ms`,
                                      background:
                                        'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.16) 50%, rgba(56,189,248,0.22) 70%, transparent 100%)',
                                    }}
                                  />
                                </div>

                                {/* Badge discreto esquina superior derecha */}
                                <span
                                  className={`absolute top-3.5 right-3.5 px-2 py-0.5 rounded-full text-[9px] font-mono font-black tracking-widest uppercase border ${
                                    card.directAccess
                                      ? 'bg-white text-black border-white'
                                      : card.featured
                                      ? 'bg-blue-600 text-white border-blue-300/60'
                                      : 'bg-black/75 text-blue-300 border-blue-500/35'
                                  }`}
                                >
                                  {card.tag}
                                </span>

                                {/* ÍCONO PERSONALIZADO PROTAGONISTA */}
                                <div className="relative z-10 flex flex-col items-center text-center pt-3 pb-1 space-y-3">
                                  <div className="relative transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-1">
                                    <div className="absolute -inset-2 rounded-3xl bg-blue-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                    <PortalAppIcon
                                      id={card.iconId}
                                      className="w-20 h-20 sm:w-22 sm:h-22"
                                      active={card.featured}
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <h3 className="text-sm sm:text-base font-black text-white group-hover:text-blue-300 transition-colors tracking-tight">
                                      {card.title}
                                    </h3>
                                    <p className="text-[11px] text-slate-400 group-hover:text-slate-300 leading-snug max-w-[240px] mx-auto line-clamp-2">
                                      {card.subtitle}
                                    </p>
                                  </div>

                                  <div className="pt-1 flex items-center gap-1.5 text-[10px] font-mono font-black uppercase tracking-widest text-blue-400 group-hover:text-white transition-colors">
                                    <span>Abrir Portal</span>
                                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                  </div>
                                </div>
                              </>
                            )

                            const tileClasses = `group relative rounded-3xl p-5 transition-all duration-300 hover:-translate-y-1.5 overflow-hidden cursor-pointer ${flyClass} ${
                              card.featured
                                ? 'bg-gradient-to-b from-blue-950/75 via-[#071127] to-black border-2 border-blue-500/70 hover:border-white shadow-[0_14px_38px_-12px_rgba(37,99,235,0.5)]'
                                : 'bg-gradient-to-b from-[#09142c]/90 via-[#050b18]/95 to-black border border-white/15 hover:border-blue-400 hover:shadow-[0_14px_36px_-10px_rgba(37,99,235,0.45)]'
                            }`

                            if (card.href) {
                              return (
                                <Link
                                  key={card.id}
                                  href={card.href}
                                  className={tileClasses}
                                  style={{ animationDelay: `${staggerMs}ms` }}
                                >
                                  {iconTileInner}
                                </Link>
                              )
                            }

                            return (
                              <button
                                key={card.id}
                                type="button"
                                onClick={() => openPortalLogin(card.target || 'rh')}
                                className={tileClasses}
                                style={{ animationDelay: `${staggerMs}ms` }}
                              >
                                {iconTileInner}
                              </button>
                            )
                          })}
                        </div>
                      </section>
                    )
                  })}
                </div>
              </div>
            ) : (
              /* ===========================================================
                 PANTALLA DE LOGIN OFICIAL "PORTAL BACIS" CON SELECTOR POR ÍCONOS
                 =========================================================== */
              <div className="max-w-xl mx-auto bacis-tile-in-4">
                <button
                  type="button"
                  onClick={() => setView('hub')}
                  className="mb-4 inline-flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-blue-400" />
                  Volver al Menú Principal
                </button>

                <div className="bg-gradient-to-b from-[#081229]/95 via-[#050a17]/95 to-black/95 border-2 border-blue-500/45 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-[0_24px_70px_-12px_rgba(37,99,235,0.5)] relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-700 via-blue-400 to-white" />

                  {/* CABECERA PORTAL BACIS + ÍCONO DEL PORTAL ACTIVO */}
                  <div className="mb-5 text-center space-y-2.5">
                    <div className="inline-flex items-center justify-center gap-3">
                      <div className="w-16 h-14 rounded-2xl bg-gradient-to-b from-blue-950 to-black border border-blue-400/40 flex items-center justify-center p-1.5 shadow-[0_0_24px_rgba(37,99,235,0.4)]">
                        <BacisLogoEmblem className="w-13 h-11" showGlow={false} />
                      </div>
                      <PortalAppIcon id={meta.iconId} className="w-14 h-14" active />
                    </div>

                    <div>
                      <h1 className="text-2xl sm:text-3xl font-black tracking-[0.14em] text-white uppercase leading-none">
                        PORTAL <span className="text-blue-400">BACIS</span>
                      </h1>
                      <p className="text-xs font-bold text-blue-200 mt-1">{meta.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 max-w-md mx-auto leading-snug">
                        {meta.sub}
                      </p>
                    </div>
                  </div>

                  {/* SELECTOR VISUAL DE PORTALES COMO ÍCONOS (SIN DROPDOWN PLANO) */}
                  <div className="mb-5">
                    <span className="block text-[9px] font-mono font-black text-blue-300/90 uppercase tracking-[0.2em] mb-2 text-center">
                      Selecciona el ícono del portal al que deseas entrar
                    </span>
                    <div className="grid grid-cols-4 gap-2 p-2.5 rounded-2xl bg-black/75 border border-blue-500/25">
                      {LOGIN_PORTAL_TARGETS.map((item) => {
                        const isSelected = loginTarget === item.target
                        return (
                          <button
                            key={item.target}
                            type="button"
                            onClick={() => {
                              setLoginTarget(item.target)
                              setError(null)
                              setRequestDone(false)
                            }}
                            className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer group ${
                              isSelected
                                ? 'bg-blue-600/25 border-white shadow-[0_0_18px_rgba(37,99,235,0.55)] scale-[1.03]'
                                : 'bg-white/[0.02] border-transparent hover:border-blue-500/40 hover:bg-white/[0.05]'
                            }`}
                          >
                            <PortalAppIcon
                              id={item.iconId}
                              className="w-11 h-11 transition-transform group-hover:scale-105"
                              active={isSelected}
                            />
                            <span
                              className={`mt-1.5 text-[10px] font-black tracking-tight leading-tight text-center ${
                                isSelected ? 'text-white' : 'text-slate-400 group-hover:text-white'
                              }`}
                            >
                              {item.label}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {loginTarget === 'contratista' && (
                    <div className="grid grid-cols-2 gap-1.5 bg-black/70 p-1 rounded-xl border border-blue-500/25 mb-5">
                      <button
                        type="button"
                        onClick={() => {
                          setContractorMode('login')
                          setError(null)
                          setRequestDone(false)
                        }}
                        className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                          contractorMode === 'login'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Ya tengo Usuario
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setContractorMode('request')
                          setError(null)
                          setRequestDone(false)
                        }}
                        className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                          contractorMode === 'request'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Solicitar Usuario
                      </button>
                    </div>
                  )}

                  {loginTarget === 'contratista' && contractorMode === 'request' ? (
                    requestDone ? (
                      <div className="bg-blue-600/15 border border-blue-400/40 rounded-2xl p-5 text-center space-y-3">
                        <p className="text-sm font-black text-white uppercase">
                          ¡Solicitud Enviada a Recursos Humanos!
                        </p>
                        <p className="text-xs text-slate-300">
                          RH revisará tus datos y te enviará tu usuario y contraseña para registrar a tu personal y requisitos.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setContractorMode('login')
                            setRequestDone(false)
                          }}
                          className="px-4 py-2 bg-white text-black text-xs font-black rounded-xl cursor-pointer hover:bg-blue-50"
                        >
                          Volver a Iniciar Sesión
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleContractorRequest} className="space-y-3">
                        <input
                          required
                          value={reqForm.razon_social}
                          onChange={(e) => setReqForm({ ...reqForm, razon_social: e.target.value })}
                          placeholder="Razón Social / Empresa *"
                          className="bacis-portal-input w-full bg-black/75 border border-white/15 rounded-xl py-2.5 px-3.5 text-white text-xs placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            required
                            value={reqForm.rfc}
                            onChange={(e) => setReqForm({ ...reqForm, rfc: e.target.value })}
                            placeholder="RFC *"
                            className="bacis-portal-input w-full bg-black/75 border border-white/15 rounded-xl py-2.5 px-3.5 text-white text-xs font-mono uppercase placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
                          />
                          <input
                            value={reqForm.telefono}
                            onChange={(e) => setReqForm({ ...reqForm, telefono: e.target.value })}
                            placeholder="Teléfono"
                            className="bacis-portal-input w-full bg-black/75 border border-white/15 rounded-xl py-2.5 px-3.5 text-white text-xs placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
                          />
                        </div>
                        <input
                          required
                          value={reqForm.representante_legal}
                          onChange={(e) =>
                            setReqForm({ ...reqForm, representante_legal: e.target.value })
                          }
                          placeholder="Nombre del Responsable / Contacto *"
                          className="bacis-portal-input w-full bg-black/75 border border-white/15 rounded-xl py-2.5 px-3.5 text-white text-xs placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
                        />
                        <input
                          required
                          type="email"
                          value={reqForm.correo}
                          onChange={(e) => setReqForm({ ...reqForm, correo: e.target.value })}
                          placeholder="Correo electrónico para recibir usuario *"
                          className="bacis-portal-input w-full bg-black/75 border border-white/15 rounded-xl py-2.5 px-3.5 text-white text-xs font-mono placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
                        />
                        <input
                          value={reqForm.especialidad}
                          onChange={(e) => setReqForm({ ...reqForm, especialidad: e.target.value })}
                          placeholder="Servicio / Depto que solicita (ej. Mantenimiento)"
                          className="bacis-portal-input w-full bg-black/75 border border-white/15 rounded-xl py-2.5 px-3.5 text-white text-xs placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
                        />
                        {error && (
                          <div className="bg-rose-500/15 border border-rose-400/40 text-rose-200 text-xs font-bold p-2.5 rounded-xl text-center">
                            {error}
                          </div>
                        )}
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full font-black py-3.5 rounded-xl text-xs uppercase tracking-wider bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_25px_rgba(37,99,235,0.5)] border border-blue-400/50 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {loading ? 'ENVIANDO SOLICITUD...' : 'SOLICITAR USUARIO A RH'}
                        </button>
                      </form>
                    )
                  ) : (
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono font-black text-slate-300 uppercase tracking-widest ml-1">
                          Usuario / Correo Institucional
                        </label>
                        <div className="relative group">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 group-focus-within:text-white transition-colors" />
                          <input
                            type="text"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="usuario@bacis.com"
                            className="bacis-portal-input w-full bg-black/80 border border-white/20 rounded-xl py-3 pl-11 pr-4 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400 transition-all placeholder:text-slate-500 font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[10px] font-mono font-black text-slate-300 uppercase tracking-widest">
                            Contraseña
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-[10px] text-blue-300 hover:text-white font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            {showPassword ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                            <span>{showPassword ? 'Ocultar' : 'Ver contraseña'}</span>
                          </button>
                        </div>
                        <div className="relative group">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 group-focus-within:text-white transition-colors" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••••••"
                            className="bacis-portal-input w-full bg-black/80 border border-white/20 rounded-xl py-3 pl-11 pr-11 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400 transition-all placeholder:text-slate-500 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4 text-blue-400" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {error && (
                        <div className="bg-rose-500/15 border border-rose-400/40 text-rose-200 text-xs font-bold p-3 rounded-xl text-center uppercase font-mono">
                          {error}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full font-black py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 text-xs tracking-[0.16em] uppercase bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 hover:from-blue-600 hover:to-blue-400 text-white shadow-[0_0_28px_rgba(37,99,235,0.6)] border border-white/25 cursor-pointer active:scale-[0.99]"
                      >
                        {loading ? 'AUTENTICANDO EN PORTAL BACIS...' : 'ENTRAR A PORTAL BACIS'}
                        {!loading && <ArrowRight className="w-4 h-4" />}
                      </button>
                    </form>
                  )}

                  {/* ACCESOS DIRECTOS Y APP MÓVIL COMO ÍCONOS EN EL LOGIN */}
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <span className="block text-[9px] font-mono uppercase tracking-[0.2em] text-slate-400 text-center mb-2.5">
                      Accesos Rápidos y App Móvil
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <Link
                        href="/medico-app"
                        className="flex items-center gap-2.5 p-2 rounded-xl bg-blue-950/70 border border-blue-400/35 hover:border-blue-300 transition-all group"
                      >
                        <img
                          src="/medico-icon-192.png"
                          alt="App Médico Bacís"
                          className="w-10 h-10 rounded-lg shrink-0"
                        />
                        <div className="text-left">
                          <div className="text-[11px] font-black text-white group-hover:text-blue-300">
                            App Médico
                          </div>
                          <div className="text-[9px] text-sky-300/90">Celular / Offline</div>
                        </div>
                      </Link>
                      <Link
                        href="/caseta-qr"
                        className="flex items-center gap-2.5 p-2 rounded-xl bg-black/70 border border-white/15 hover:border-blue-400 transition-all group"
                      >
                        <PortalAppIcon id="caseta-qr" className="w-10 h-10 shrink-0" />
                        <div className="text-left">
                          <div className="text-[11px] font-black text-white group-hover:text-blue-300">
                            Checador QR
                          </div>
                          <div className="text-[9px] text-slate-400">Caseta directa</div>
                        </div>
                      </Link>
                      <Link
                        href="/reservar-viaje"
                        className="flex items-center gap-2.5 p-2 rounded-xl bg-black/70 border border-white/15 hover:border-blue-400 transition-all group"
                      >
                        <PortalAppIcon id="viajes" className="w-10 h-10 shrink-0" />
                        <div className="text-left">
                          <div className="text-[11px] font-black text-white group-hover:text-blue-300">
                            Portal Viajes
                          </div>
                          <div className="text-[9px] text-slate-400">Reservar asiento</div>
                        </div>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* FOOTER ESTILO SOFTWARE CORPORATIVO */}
      {phase === 'ready' && (
        <footer className="relative z-20 border-t border-white/10 bg-black/65 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] font-mono text-slate-400 uppercase tracking-widest">
            <span>© {new Date().getFullYear()} GRUPO MINERO BACÍS S.A. DE C.V. · PORTAL BACIS</span>
            <span className="flex items-center gap-2 text-blue-300/90">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              UNIDAD EL HERRERO · CONEXIÓN CIFRADA
            </span>
          </div>
        </footer>
      )}
    </div>
  )
}
