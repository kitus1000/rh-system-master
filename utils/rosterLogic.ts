import { addDays, differenceInCalendarDays, isWithinInterval, parseISO, format } from 'date-fns'

export type Incident = {
    id_incidencia: string
    fecha_inicio: string
    fecha_fin: string
    cat_tipos_incidencia: {
        tipo_incidencia: string
        color?: string // Optional if we want to store it in DB later, otherwise hardcode map
    }
}

export type Role = {
    fecha_inicio: string
    cat_tipos_rol: {
        dias_trabajo: number
        dias_descanso: number
        tipo_rol: string
    }
}

export type Turno = {
    fecha_inicio: string
    turnos: {
        nombre: string
    }
}

export type ActiveEsquema = {
    tipo: 'rol' | 'turno'
    data: Role | Turno | any
}

export type DailyStatus = {
    status: 'Laborando' | 'Descanso' | 'Incidencia' | 'Sin Rol'
    label: string
    color: string // Tailwind class or Hex
    details?: string
}

// Map incident types to colors (can be moved to DB or config)
const INCIDENT_COLORS: Record<string, string> = {
    'Vacaciones': 'bg-blue-500',
    'Incapacidad': 'bg-red-500',
    'Falta': 'bg-red-700',
    'Permiso Especial': 'bg-purple-500',
    'Suspensión': 'bg-orange-600',
    'Descanso': 'bg-zinc-300',
    'Laborando': 'bg-green-500',
    'Sin Rol': 'bg-white'
}

export function getIncidentColor(type: string | undefined): string {
    if (!type) return 'bg-zinc-100'
    const lower = type.toLowerCase()

    if (lower.includes('vacaciones')) return INCIDENT_COLORS['Vacaciones']
    if (lower.includes('incapacidad')) return INCIDENT_COLORS['Incapacidad']
    if (lower.includes('falta')) return INCIDENT_COLORS['Falta']
    if (lower.includes('permiso')) return INCIDENT_COLORS['Permiso Especial']
    if (lower.includes('suspensi')) return INCIDENT_COLORS['Suspensión'] // Covers Suspensión/Suspension
    if (lower.includes('descanso')) return INCIDENT_COLORS['Descanso']

    return INCIDENT_COLORS[type] || 'bg-amber-500'
}

export function calculateDailyStatus(
    targetDate: Date,
    esquema: ActiveEsquema | null,
    incidents: Incident[]
): DailyStatus {
    // 1. Check Incidents (Priority)
    const incident = incidents.find(inc => {
        // Fix: Force local calculation by ensuring YYYY-MM-DD matches targetDate string
        const startStr = inc.fecha_inicio.includes('T') ? inc.fecha_inicio.split('T')[0] : inc.fecha_inicio
        const endStr = inc.fecha_fin.includes('T') ? inc.fecha_fin.split('T')[0] : inc.fecha_fin
        const targetStr = format(targetDate, 'yyyy-MM-dd')

        return targetStr >= startStr && targetStr <= endStr
    })

    if (incident) {
        return {
            status: 'Incidencia',
            label: incident.cat_tipos_incidencia.tipo_incidencia,
            color: getIncidentColor(incident.cat_tipos_incidencia.tipo_incidencia),
            details: `Del ${incident.fecha_inicio} al ${incident.fecha_fin}`
        }
    }

    // 2. Check Role/Turno Logic
    if (esquema) {
        const fechaInicio = parseISO(esquema.data.fecha_inicio)
        const daysElapsed = differenceInCalendarDays(targetDate, fechaInicio)

        // If date is before scheme starts, no status
        if (daysElapsed < 0) {
            return {
                status: 'Sin Rol',
                label: '-',
                color: 'bg-zinc-50 text-zinc-300',
                details: 'Antes del inicio de asignación'
            }
        }

        if (esquema.tipo === 'rol') {
            const role = esquema.data as Role
            const { dias_trabajo, dias_descanso, tipo_rol } = role.cat_tipos_rol
            const cycleLength = dias_trabajo + dias_descanso

            if (cycleLength > 0) {
                const dayInCycle = daysElapsed % cycleLength

                if (dayInCycle < dias_trabajo) {
                    return {
                        status: 'Laborando',
                        label: 'A', // Asistencia
                        color: 'bg-green-500',
                        details: `Día ${dayInCycle + 1} de Trabajo (${tipo_rol})`
                    }
                } else {
                    return {
                        status: 'Descanso',
                        label: 'D', // Descanso
                        color: 'bg-zinc-300',
                        details: `Día ${dayInCycle - dias_trabajo + 1} de Descanso (${tipo_rol})`
                    }
                }
            }
        } else if (esquema.tipo === 'turno') {
            const turno = esquema.data as Turno
            const dayOfWeek = targetDate.getDay() // 0 = Domingo
            
            if (dayOfWeek === 0) {
                // Domingo descanso
                return {
                    status: 'Descanso',
                    label: 'D', // Descanso
                    color: 'bg-zinc-300',
                    details: `Descanso Semanal (${turno.turnos?.nombre})`
                }
            } else {
                return {
                    status: 'Laborando',
                    label: 'A', // Asistencia
                    color: 'bg-blue-500',
                    details: `Día de Trabajo (${turno.turnos?.nombre})`
                }
            }
        }
    }

    // 3. Default
    return {
        status: 'Sin Rol',
        label: '-',
        color: 'bg-white border-zinc-100',
        details: 'No asignar'
    }
}
