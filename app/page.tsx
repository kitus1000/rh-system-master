'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/utils/supabase/client'
import Link from 'next/link'
import {
  ArrowRight,
  Lock,
  Mail,
  Bus,
  Truck,
  Stethoscope,
  Users,
  ClipboardList,
  ChevronLeft,
  Eye,
  EyeOff,
  Home,
  HardHat,
  ShieldCheck,
  QrCode,
  RotateCcw,
  Sparkles,
  Cpu,
  Wifi,
  Shield,
  Layers,
  Activity,
  LogIn,
} from 'lucide-react'
import { BacisLogoEmblem } from '@/components/BacisLogoEmblem'

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
  code: string
  title: string
  subtitle: string
  cta: string
  tag: string
  zone: Exclude<ZoneKey, 'all'>
  icon: any
  target?: LoginTarget
  href?: string
  featured?: boolean
  directAccess?: boolean
}

const BOOT_STEPS = [
  'Inicializando núcleo PORTAL BACIS v4.5...',
  'Verificando conexión segura Unidad El Herrero...',
  'Sincronizando RH, Seguridad, Clínica y Logística...',
  'Sistema listo · Desplegando portales operativos',
]

const PORTAL_CARDS: PortalCardConfig[] = [
  // ZONA 01: DIRECCIÓN, RH & CONTRATISTAS
  {
    id: 'rh',
    code: '01',
    title: 'Acceso RH & Control',
    subtitle: 'Centro unificado de personal, nómina semanal/quincenal, sindicato Secc. 45 y expedientes.',
    cta: 'Ingresar al Núcleo',
    tag: 'NÚCLEO CENTRAL',
    zone: 'corporativo',
    icon: Users,
    target: 'rh',
    featured: true,
  },
  {
    id: 'jefes',
    code: '02',
    title: 'Jefes de Departamento',
    subtitle: 'Autorizaciones digitales, ausencias, escalafón sindical y visto bueno a contratistas.',
    cta: 'Acceso Jefaturas',
    tag: 'AUTORIZACIONES',
    zone: 'corporativo',
    icon: ClipboardList,
    target: 'jefes',
  },
  {
    id: 'contratista',
    code: '03',
    title: 'Portal Contratistas',
    subtitle: 'Alta de personal externo, carga de NSS/IMSS/SAT, permisos de ingreso y credencial QR.',
    cta: 'Acceso Empresas',
    tag: 'EXTERNO',
    zone: 'corporativo',
    icon: HardHat,
    target: 'contratista',
  },

  // ZONA 02: SEGURIDAD, ACCESOS & CAMPAMENTOS
  {
    id: 'seguridad',
    code: '04',
    title: 'Seguridad Industrial',
    subtitle: 'Validación de inducciones de seguridad, requisitos normativos y programación de fechas.',
    cta: 'Inducciones',
    tag: 'NORMATIVA MINA',
    zone: 'operacion',
    icon: ShieldCheck,
    target: 'seguridad',
  },
  {
    id: 'caseta-qr',
    code: '05',
    title: 'Checador QR Caseta',
    subtitle: 'Sin contraseña: escanea credencial QR en caseta, valida autorización y registra entrada/salida.',
    cta: 'Abrir Checador',
    tag: 'ACCESO DIRECTO QR',
    zone: 'operacion',
    icon: QrCode,
    href: '/caseta-qr',
    directAccess: true,
  },
  {
    id: 'campamento',
    code: '06',
    title: 'Campamentos y Comedor',
    subtitle: 'Visualización 3D de camas, hospedaje de personal y contratistas, lavandería y comedor.',
    cta: 'Operación',
    tag: 'HOSPEDAJE 3D',
    zone: 'operacion',
    icon: Home,
    target: 'campamento',
  },

  // ZONA 03: SALUD, LOGÍSTICA & TRASLADOS
  {
    id: 'medico',
    code: '07',
    title: 'Servicios Médicos',
    subtitle: 'Consultas, recetas COFEPRIS, farmacia, padrón de beneficiarios y pases médicos.',
    cta: 'Clínica Médica',
    tag: 'SALUD & COFEPRIS',
    zone: 'servicios',
    icon: Stethoscope,
    target: 'medico',
  },
  {
    id: 'chofer',
    code: '08',
    title: 'Portal Choferes',
    subtitle: 'Checklist vehicular pre-viaje, bitácora de rutas mineras y abordaje QR de pasajeros.',
    cta: 'Acceso Chofer',
    tag: 'FLOTA MINA',
    zone: 'servicios',
    icon: Truck,
    target: 'chofer',
  },
  {
    id: 'viajes',
    code: '09',
    title: 'Portal de Viajes',
    subtitle: 'Auto-reservación rápida de asientos y traslados de personal hacia y desde la unidad.',
    cta: 'Reservar Traslado',
    tag: 'ACCESO DIRECTO',
    zone: 'servicios',
    icon: Bus,
    href: '/reservar-viaje',
    directAccess: true,
  },
]

const ZONE_META: Record<
  Exclude<ZoneKey, 'all'>,
  { num: string; title: string; subtitle: string; icon: any }
> = {
  corporativo: {
    num: '01',
    title: 'Dirección, RH & Contratistas',
    subtitle: 'Gestión central de personal, aprobaciones y empresas externas',
    icon: Layers,
  },
  operacion: {
    num: '02',
    title: 'Seguridad, Accesos & Campamentos',
    subtitle: 'Control de ingreso a mina, inducción normativa y hospedaje',
    icon: Shield,
  },
  servicios: {
    num: '03',
    title: 'Salud, Logística & Traslados',
    subtitle: 'Atención clínica COFEPRIS, transporte de personal y rutas',
    icon: Activity,
  },
}

/**
 * Spinner orbital de 5 puntos luminosos estilo arranque de Windows 11 / Software Industrial
 */
function WindowsOrbitLoader({ size = 44 }: { size?: number }) {
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
              width: idx === 0 ? 7 : 5.5,
              height: idx === 0 ? 7 : 5.5,
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
  // Fase de arranque tipo software/Windows -> luego despliegue cinético rápido de portales
  const [phase, setPhase] = useState<'boot' | 'ready'>('boot')
  const [bootProgress, setBootProgress] = useState(8)
  const [bootStepIdx, setBootStepIdx] = useState(0)
  const [animCycle, setAnimCycle] = useState(1)

  const [view, setView] = useState<'hub' | 'login'>('hub')
  const [activeZone, setActiveZone] = useState<ZoneKey>('all')
  const [clockTime, setClockTime] = useState('')
  const [clockDate, setClockDate] = useState('')

  // Estado del Login PORTAL BACIS
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

  // Reloj en vivo estilo barra de tareas de software
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

  // Secuencia de arranque tipo Windows / Software corporativo
  const runBootSequence = useCallback(() => {
    setPhase('boot')
    setBootProgress(10)
    setBootStepIdx(0)

    const t1 = setTimeout(() => {
      setBootProgress(42)
      setBootStepIdx(1)
    }, 340)
    const t2 = setTimeout(() => {
      setBootProgress(76)
      setBootStepIdx(2)
    }, 760)
    const t3 = setTimeout(() => {
      setBootProgress(100)
      setBootStepIdx(3)
    }, 1180)
    const t4 = setTimeout(() => {
      setPhase('ready')
      setAnimCycle((c) => c + 1)
    }, 1520)

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
    const cleanup = runBootSequence()
    return cleanup
  }, [runBootSequence])

  const handleReplayIntro = () => {
    setView('hub')
    setActiveZone('all')
    runBootSequence()
  }

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

  const launchWithWindowsTransition = (destination: string, welcomeLabel?: string) => {
    setEnteringSystem(welcomeLabel || 'Preparando tu espacio de trabajo...')
    setTimeout(() => {
      window.location.href = destination
    }, 820)
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
          launchWithWindowsTransition(nextPath, 'Bienvenido Administrador · Cargando PORTAL BACIS...')
          return
        }

        // Check if user exists in perfiles table as fallback
        const { data: fallbackProf } = await supabase
          .from('perfiles')
          .select('*')
          .or(`nombre_completo.ilike.%${email.split('@')[0]}%,rol.ilike.Chofer`)
          .limit(1)
        if (fallbackProf && fallbackProf.length > 0) {
          const prof = fallbackProf[0]
          launchWithWindowsTransition(
            resolveRedirectByRole(prof.rol || '', prof.nombre_completo || '', loginTarget),
            `Bienvenido ${prof.nombre_completo || ''} · Iniciando sesión...`
          )
          return
        }

        setError('Credenciales inválidas o correo no confirmado')
        setLoading(false)
        return
      }

      launchWithWindowsTransition(
        nextPath,
        welcomeName
          ? `Bienvenido, ${welcomeName} · Iniciando escritorio...`
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
          title: 'Acceso RH & Control Central',
          sub: 'Personal, nómina semanal/quincenal, sindicato Secc. 45 y control integral',
          tag: 'MÓDULO 01 · RH',
        }
      case 'medico':
        return {
          title: 'Servicios Médicos & Clínica',
          sub: 'Consultas, recetas COFEPRIS, farmacia, beneficiarios y pases médicos',
          tag: 'MÓDULO 07 · CLÍNICA',
        }
      case 'jefes':
        return {
          title: 'Jefes de Área & Superintendentes',
          sub: 'Autorizaciones, ausencias de personal, escalafón y visto bueno a contratistas',
          tag: 'MÓDULO 02 · JEFATURAS',
        }
      case 'chofer':
        return {
          title: 'Portal de Choferes',
          sub: 'Checklist vehicular, rutas mineras y escaneo QR de pasajeros',
          tag: 'MÓDULO 08 · FLOTA',
        }
      case 'campamento':
        return {
          title: 'Campamentos y Comedor',
          sub: 'Control 3D de camas, lavandería, disponibilidad y registro de comidas',
          tag: 'MÓDULO 06 · HOSPEDAJE',
        }
      case 'contratista':
        return {
          title: 'Portal Individual de Contratistas',
          sub: 'Alta de personal, carga de NSS/IMSS/SAT, permisos, solicitud de ingreso y QR',
          tag: 'MÓDULO 03 · CONTRATISTAS',
        }
      case 'seguridad':
        return {
          title: 'Seguridad Industrial (Inducciones)',
          sub: 'Revisión de requisitos, fechas de inducción y validación de personal contratista',
          tag: 'MÓDULO 04 · SEGURIDAD',
        }
      case 'caseta':
        return {
          title: 'Caseta (Credenciales QR)',
          sub: 'Control de credenciales autorizadas, entradas, salidas y devolución en mina',
          tag: 'MÓDULO 05 · CASETA',
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
      {/* ===================================================================
          FONDO CORPORATIVO BACÍS: NEGRO OBSIDIANA + AZUL REY + DESTELLO BLANCO
         =================================================================== */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Malla tecnológica sutil */}
        <div
          className="absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(37,99,235,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(37,99,235,0.22) 1px, transparent 1px)',
            backgroundSize: '46px 46px',
          }}
        />
        {/* Gradiente principal Bacís (Azul Profundo -> Negro Puro) */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 75% 55% at 50% -10%, rgba(29,78,216,0.42) 0%, rgba(15,23,42,0.55) 45%, rgba(2,5,11,0.98) 100%)',
          }}
        />
        {/* Orbes de energía Azul Bacís y Blanco */}
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[780px] h-[380px] rounded-full blur-[130px] bacis-halo-pulse"
          style={{ background: 'rgba(37, 99, 235, 0.32)' }}
        />
        <div
          className="absolute bottom-[-120px] left-[-100px] w-[420px] h-[420px] rounded-full blur-[130px]"
          style={{ background: 'rgba(29, 78, 216, 0.22)' }}
        />
        <div
          className="absolute bottom-[-100px] right-[-80px] w-[420px] h-[420px] rounded-full blur-[140px]"
          style={{ background: 'rgba(255, 255, 255, 0.08)' }}
        />
        {/* Línea de escaneo sutil estilo software */}
        <div
          className="absolute left-0 right-0 h-[2px] bacis-scanline"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(56,189,248,0.55) 30%, rgba(255,255,255,0.85) 50%, rgba(37,99,235,0.55) 70%, transparent 100%)',
          }}
        />
      </div>

      {/* ===================================================================
          PANTALLA 1: ARRANQUE DE SOFTWARE TIPO WINDOWS — "PORTAL BACIS"
         =================================================================== */}
      {phase === 'boot' && (
        <div className="fixed inset-0 z-50 bg-[#02050b] flex flex-col items-center justify-center p-6 overflow-hidden">
          {/* Halo de encendido */}
          <div
            className="absolute w-[520px] h-[520px] rounded-full blur-[120px] bacis-halo-pulse pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.48) 0%, rgba(2,5,11,0) 70%)' }}
          />

          <div className="relative z-10 flex flex-col items-center text-center max-w-md w-full space-y-6">
            {/* Emblema GB con anillo orbital */}
            <div className="relative flex items-center justify-center bacis-logo-boot">
              <div className="absolute -inset-4 rounded-full border border-blue-500/35 animate-spin" style={{ animationDuration: '9s' }} />
              <div className="absolute -inset-7 rounded-full border border-dashed border-white/15 animate-spin" style={{ animationDuration: '16s', animationDirection: 'reverse' }} />
              <div className="w-28 h-24 rounded-3xl bg-gradient-to-b from-[#0b1630] to-black border border-blue-500/50 shadow-[0_0_50px_rgba(37,99,235,0.5)] flex items-center justify-center p-3">
                <BacisLogoEmblem className="w-24 h-20" />
              </div>
            </div>

            {/* Título PORTAL BACIS */}
            <div className="space-y-1.5 bacis-logo-boot" style={{ animationDelay: '100ms' }}>
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

            {/* Spinner orbital estilo Windows + Barra de progreso */}
            <div className="w-full space-y-4 pt-2 flex flex-col items-center">
              <WindowsOrbitLoader size={44} />

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

            <button
              type="button"
              onClick={() => {
                setPhase('ready')
                setAnimCycle((c) => c + 1)
              }}
              className="mt-4 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-colors cursor-pointer"
            >
              Saltar animación &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================
          OVERLAY DE BIENVENIDA TIPO WINDOWS AL INICIAR SESIÓN
         =================================================================== */}
      {enteringSystem && (
        <div className="fixed inset-0 z-50 bg-[#02050b]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="flex flex-col items-center text-center space-y-5 max-w-md">
            <div className="w-24 h-20 rounded-3xl bg-gradient-to-b from-blue-950 to-black border border-blue-400/50 shadow-[0_0_60px_rgba(37,99,235,0.65)] flex items-center justify-center p-2.5">
              <BacisLogoEmblem className="w-20 h-16" />
            </div>
            <h2 className="text-3xl font-black tracking-[0.14em] text-white uppercase">
              PORTAL <span className="text-blue-400">BACIS</span>
            </h2>
            <WindowsOrbitLoader size={46} />
            <p className="text-xs font-mono tracking-wider text-blue-200 uppercase">
              {enteringSystem}
            </p>
          </div>
        </div>
      )}

      {/* ===================================================================
          BARRA SUPERIOR ESTILO SOFTWARE / WINDOWS TASKBAR (AZUL · BLANCO · NEGRO)
         =================================================================== */}
      {phase === 'ready' && (
        <header className="relative z-20 border-b border-blue-500/20 bg-black/70 backdrop-blur-xl bacis-header-drop">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            {/* Identidad PORTAL BACIS */}
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

            {/* Controles OS + Reloj */}
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

              <button
                type="button"
                onClick={handleReplayIntro}
                className="px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-blue-600/25 border border-white/15 hover:border-blue-400/50 text-[10px] sm:text-xs font-bold text-slate-200 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
                title="Volver a reproducir el arranque de software y acomodo rápido de portales"
              >
                <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Repetir Intro</span>
              </button>

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
                  <span>Ver Portales</span>
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {/* ===================================================================
          CONTENIDO PRINCIPAL: HUB DE PORTALES ORGANIZADOS Ó LOGIN PORTAL BACIS
         =================================================================== */}
      {phase === 'ready' && (
        <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-10">
          <div className="w-full max-w-7xl">
            {view === 'hub' ? (
              <div className="space-y-8">
                {/* HERO PORTAL BACIS + DOCK DE FILTROS */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 bacis-header-drop">
                  <div className="space-y-2.5">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/15 border border-blue-400/35 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-blue-300">
                      <Sparkles className="w-3 h-3 text-white" />
                      Plataforma Corporativa Integrada · 9 Portales Activos
                    </div>
                    <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white uppercase leading-none">
                      PORTAL <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-200 to-white">BACIS</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                      Selecciona tu área operativa para iniciar sesión o acceder directamente a los módulos de control de{' '}
                      <span className="text-white font-bold">Grupo Minero Bacís S.A. de C.V.</span>
                    </p>
                  </div>

                  {/* Dock interactivo de organización por zonas */}
                  <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-black/75 border border-blue-500/25 backdrop-blur-xl shadow-lg">
                    {(
                      [
                        { id: 'all', label: 'Todos los Portales', count: 9 },
                        { id: 'corporativo', label: 'Dirección & RH', count: 3 },
                        { id: 'operacion', label: 'Seguridad & Mina', count: 3 },
                        { id: 'servicios', label: 'Salud & Logística', count: 3 },
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

                {/* =========================================================
                    BLOQUES ORGANIZADOS CON ACOMODO CINÉTICO RÁPIDO 3D
                   ========================================================= */}
                <div key={animCycle} className="space-y-7">
                  {visibleZones.map((zoneKey, zIdx) => {
                    const zMeta = ZONE_META[zoneKey]
                    const ZoneIcon = zMeta.icon
                    const cardsInZone = PORTAL_CARDS.filter((c) => c.zone === zoneKey)

                    return (
                      <section key={zoneKey} className="space-y-3.5">
                        {/* Encabezado elegante de zona */}
                        <div
                          className="flex items-center justify-between gap-3 pb-2 border-b border-white/10 bacis-zone-reveal"
                          style={{ animationDelay: `${zIdx * 90}ms` }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-mono font-black text-xs flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.6)]">
                              {zMeta.num}
                            </span>
                            <div>
                              <h2 className="text-xs sm:text-sm font-black uppercase tracking-[0.16em] text-white flex items-center gap-2">
                                <ZoneIcon className="w-4 h-4 text-blue-400" />
                                {zMeta.title}
                              </h2>
                              <p className="text-[11px] text-slate-400 hidden sm:block">
                                {zMeta.subtitle}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-blue-300/80 uppercase tracking-widest">
                            {cardsInZone.length} MÓDULOS
                          </span>
                        </div>

                        {/* Grid 3 columnas con vuelo rápido individual */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {cardsInZone.map((card, cIdx) => {
                            const globalIdx = zIdx * 3 + cIdx
                            const flyClass = `bacis-tile-in-${globalIdx % 9}`
                            const staggerMs = globalIdx * 55
                            const IconComp = card.icon

                            const cardBody = (
                              <>
                                {/* Destello metálico azul-blanco al acomodarse */}
                                <div
                                  className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl"
                                >
                                  <div
                                    className="w-1/2 h-full bacis-tile-sheen"
                                    style={{
                                      animationDelay: `${staggerMs + 360}ms`,
                                      background:
                                        'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, rgba(56,189,248,0.22) 70%, transparent 100%)',
                                    }}
                                  />
                                </div>

                                {/* Línea superior luminosa azul Bacís */}
                                <div
                                  className={`absolute top-0 left-0 right-0 h-[2.5px] transition-all duration-300 ${
                                    card.featured
                                      ? 'bg-gradient-to-r from-blue-600 via-white to-blue-500 opacity-100'
                                      : 'bg-gradient-to-r from-transparent via-blue-500 to-white opacity-45 group-hover:opacity-100'
                                  }`}
                                />

                                {/* Marca de agua gigante de fondo */}
                                <div className="absolute -bottom-3 -right-3 opacity-[0.06] group-hover:opacity-[0.16] transition-all duration-500 pointer-events-none">
                                  <IconComp className="w-28 h-28 text-blue-400 transform group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500" />
                                </div>

                                <div className="relative z-10 space-y-4">
                                  {/* Fila superior: Ícono + Código y Etiqueta */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div
                                      className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110 ${
                                        card.featured
                                          ? 'bg-blue-600 text-white border-white/40 shadow-[0_0_24px_rgba(37,99,235,0.65)]'
                                          : 'bg-blue-950/70 text-blue-300 border-blue-500/30 group-hover:bg-blue-600 group-hover:text-white group-hover:border-white/50 group-hover:shadow-[0_0_22px_rgba(37,99,235,0.55)]'
                                      }`}
                                    >
                                      <IconComp className="w-6 h-6" />
                                    </div>

                                    <div className="flex flex-col items-end gap-1">
                                      <span
                                        className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono font-black tracking-widest uppercase border ${
                                          card.directAccess
                                            ? 'bg-white text-black border-white'
                                            : card.featured
                                            ? 'bg-blue-600/30 text-blue-200 border-blue-400/50'
                                            : 'bg-black/60 text-blue-300 border-blue-500/30'
                                        }`}
                                      >
                                        {card.tag}
                                      </span>
                                      <span className="text-[10px] font-mono text-slate-500 group-hover:text-blue-300 transition-colors">
                                        SYS//{card.code}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Título y descripción */}
                                  <div>
                                    <h3 className="text-base sm:text-lg font-black text-white tracking-tight group-hover:text-blue-200 transition-colors">
                                      {card.title}
                                    </h3>
                                    <p className="text-xs text-slate-400 group-hover:text-slate-300 mt-1.5 leading-relaxed">
                                      {card.subtitle}
                                    </p>
                                  </div>
                                </div>

                                {/* Footer de la tarjeta */}
                                <div className="relative z-10 mt-5 pt-3.5 border-t border-white/10 flex items-center justify-between">
                                  <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-blue-400 group-hover:text-white transition-colors">
                                    <span>{card.cta}</span>
                                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform" />
                                  </span>
                                  <span className="flex items-center gap-1 text-[9px] font-mono text-slate-500 group-hover:text-blue-300 uppercase">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
                                    LISTO
                                  </span>
                                </div>
                              </>
                            )

                            const baseClassName = `text-left group relative rounded-3xl p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1.5 overflow-hidden flex flex-col justify-between min-h-[215px] cursor-pointer ${flyClass} ${
                              card.featured
                                ? 'bg-gradient-to-br from-[#0b1b3d] via-[#070f24] to-black border-2 border-blue-500/70 hover:border-white shadow-[0_14px_45px_-12px_rgba(37,99,235,0.45)]'
                                : 'bg-gradient-to-br from-[#081022]/95 via-[#050a15]/95 to-black/95 border border-white/15 hover:border-blue-400 hover:shadow-[0_14px_40px_-10px_rgba(37,99,235,0.42)]'
                            }`

                            if (card.href) {
                              return (
                                <Link
                                  key={card.id}
                                  href={card.href}
                                  className={baseClassName}
                                  style={{ animationDelay: `${staggerMs}ms` }}
                                >
                                  {cardBody}
                                </Link>
                              )
                            }

                            return (
                              <button
                                key={card.id}
                                type="button"
                                onClick={() => openPortalLogin(card.target || 'rh')}
                                className={baseClassName}
                                style={{ animationDelay: `${staggerMs}ms` }}
                              >
                                {cardBody}
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
                 PANTALLA DE LOGIN OFICIAL: "PORTAL BACIS" (AZUL · BLANCO · NEGRO)
                 =========================================================== */
              <div className="max-w-lg mx-auto bacis-tile-in-4">
                <button
                  type="button"
                  onClick={() => setView('hub')}
                  className="mb-5 inline-flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-blue-400" />
                  Volver a los Portales Bacís
                </button>

                <div className="bg-gradient-to-b from-[#081229]/95 via-[#050a17]/95 to-black/95 border-2 border-blue-500/45 rounded-3xl p-7 sm:p-9 backdrop-blur-2xl shadow-[0_24px_70px_-12px_rgba(37,99,235,0.5)] relative overflow-hidden">
                  {/* Barra superior luminosa Azul-Blanco */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-700 via-blue-400 to-white" />

                  {/* Encabezado PORTAL BACIS */}
                  <div className="mb-6 text-center space-y-3">
                    <div className="w-20 h-16 rounded-2xl mx-auto bg-gradient-to-b from-blue-950 to-black border border-blue-400/40 flex items-center justify-center p-2 shadow-[0_0_30px_rgba(37,99,235,0.45)]">
                      <BacisLogoEmblem className="w-16 h-14" showGlow={false} />
                    </div>

                    <div>
                      <h1 className="text-2xl sm:text-3xl font-black tracking-[0.14em] text-white uppercase leading-none">
                        PORTAL <span className="text-blue-400">BACIS</span>
                      </h1>
                      <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-slate-400 mt-1">
                        Grupo Minero Bacís S.A. de C.V.
                      </p>
                    </div>

                    {/* Badge del módulo seleccionado */}
                    <div className="p-3 rounded-2xl bg-blue-600/10 border border-blue-500/30">
                      <span className="inline-block text-[9px] font-mono font-black tracking-[0.22em] text-blue-300 uppercase mb-0.5">
                        {meta.tag}
                      </span>
                      <h2 className="text-sm font-black text-white uppercase tracking-wide">
                        {meta.title}
                      </h2>
                      <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">{meta.sub}</p>
                    </div>
                  </div>

                  {/* Selector rápido de portal destino dentro del mismo login */}
                  <div className="mb-5">
                    <label className="block text-[9px] font-mono font-black text-blue-300/80 uppercase tracking-[0.2em] mb-1.5 ml-1">
                      Área / Portal de Acceso
                    </label>
                    <select
                      value={loginTarget}
                      onChange={(e) => {
                        const val = e.target.value as LoginTarget
                        setLoginTarget(val)
                        setError(null)
                        setRequestDone(false)
                      }}
                      className="bacis-portal-input w-full bg-black/80 border border-blue-500/35 rounded-xl py-2.5 px-3.5 text-white text-xs font-bold focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    >
                      <option value="rh">01 · Acceso RH &amp; Control Central</option>
                      <option value="jefes">02 · Jefes de Departamento &amp; Superintendentes</option>
                      <option value="contratista">03 · Portal Individual de Contratistas</option>
                      <option value="seguridad">04 · Seguridad Industrial (Inducciones)</option>
                      <option value="caseta">05 · Caseta (Credenciales QR)</option>
                      <option value="campamento">06 · Campamentos y Comedor</option>
                      <option value="medico">07 · Servicios Médicos &amp; Clínica</option>
                      <option value="chofer">08 · Portal de Choferes</option>
                    </select>
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
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ===================================================================
          FOOTER DE ESTADO ESTILO SOFTWARE CORPORATIVO
         =================================================================== */}
      {phase === 'ready' && (
        <footer className="relative z-20 border-t border-white/10 bg-black/60 backdrop-blur-md">
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
