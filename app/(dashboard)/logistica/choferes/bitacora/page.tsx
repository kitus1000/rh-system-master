"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { 
  Clock, Truck, Users, AlertTriangle, ArrowRight, Download, 
  Search, RefreshCw, Bus, CheckCircle2, Calendar, MapPin, 
  FileText, ShieldCheck, UserCheck, Filter, FileSpreadsheet,
  Eye, Check, Sparkles, CloudUpload
} from "lucide-react";
import { jsPDF } from "jspdf";
import Link from "next/link";

interface PasajeroEscaneado {
  id: string;
  nombre: string;
  puesto?: string;
  departamento?: string;
  hora: string;
  metodo: 'QR' | 'Manual';
}

interface ViajeBitacora {
  id_bitacora: string;
  id_chofer?: string;
  chofer_nombre: string;
  punto_a: string;
  punto_b: string;
  hora_salida_a: string;
  hora_llegada_b?: string;
  pasajeros_subieron_a: number;
  pasajeros_bajaron_b?: number;
  pasajeros_lista?: PasajeroEscaneado[];
  estatus: string;
  fecha: string;
  comentarios?: string;
  creado_el: string;
}

const CHOFERES_LIST = [
  "Todos",
  "Adalberto Pinales",
  "Ramon Yañez",
  "Oscar Vazquez",
  "Enrique Linares",
  "Samuel Madriles",
  "Jesus Saucedo"
];

export default function BitacoraChoferesPage() {
  const { profile } = useAuth();
  
  const isChofer = profile?.rol === 'Chofer';
  const isRHOrAdmin = profile?.rol === 'Administrativo' || 
                      profile?.rol === 'Superintendente' || 
                      profile?.rol === 'Jefe de Departamento' || 
                      (profile?.rol || '').toLowerCase().includes('rh') || 
                      (profile?.rol || '').toLowerCase().includes('admin');

  const [viajes, setViajes] = useState<ViajeBitacora[]>([]);
  const [empleadosMap, setEmpleadosMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [demoMessage, setDemoMessage] = useState("");
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDriverFilter, setSelectedDriverFilter] = useState("Todos");
  const [dateFilter, setDateFilter] = useState<"todos" | "hoy" | "semana" | "mes">("todos");
  
  const [selectedViajeModal, setSelectedViajeModal] = useState<ViajeBitacora | null>(null);

  useEffect(() => {
    cargarEmpleados();
    fetchViajes();

    // Si es chofer, prefiltrar por su nombre
    if (profile && isChofer) {
      const match = CHOFERES_LIST.find(c => (profile.nombre_completo || '').toLowerCase().includes(c.toLowerCase()));
      if (match) setSelectedDriverFilter(match);
    }

    const timer = setInterval(() => {
      fetchViajes();
    }, 15000);

    return () => clearInterval(timer);
  }, [profile]);

  // Cargar catálogo de empleados para resolver nombres reales
  const cargarEmpleados = async () => {
    try {
      const { data } = await supabase
        .from('empleados')
        .select('id_empleado, nombre, apellido_paterno, apellido_materno, puesto, departamento, numero_empleado, qr_token');

      if (data) {
        const map = new Map<string, any>();
        data.forEach(e => {
          const full = `${e.nombre} ${e.apellido_paterno} ${e.apellido_materno || ''}`.trim();
          const info = { ...e, nombre_completo: full };
          if (e.id_empleado) map.set(e.id_empleado.toLowerCase(), info);
          if (e.numero_empleado) map.set(String(e.numero_empleado).trim(), info);
          if (e.qr_token) map.set(e.qr_token.trim(), info);
        });
        setEmpleadosMap(map);
      }
    } catch (_) {}
  };

  const resolverNombre = (idOrName: string, nombreDefault?: string): { nombre: string; puesto: string } => {
    if (!idOrName) return { nombre: nombreDefault || "Trabajador", puesto: "Personal" };

    if (nombreDefault && 
        !nombreDefault.toLowerCase().startsWith("trabajador #") && 
        !nombreDefault.toLowerCase().startsWith("empleado nómina") && 
        !nombreDefault.toLowerCase().startsWith("empleado #")
    ) {
      return { nombre: nombreDefault, puesto: "Operativo • Mina Bacis" };
    }

    const clean = idOrName.trim();
    const numMatch = clean.match(/\d+/);
    const digitos = numMatch ? numMatch[0] : clean;

    const match = empleadosMap.get(clean.toLowerCase()) || empleadosMap.get(digitos);
    if (match) {
      return {
        nombre: match.nombre_completo,
        puesto: `${match.puesto || 'Personal'} • ${match.departamento || 'Mina Bacis'}`
      };
    }

    return { nombre: nombreDefault || `Trabajador Nómina #${digitos}`, puesto: "Mina Bacis" };
  };

  // Cargar viajes de TODOS los choferes desde Supabase y LocalStorage
  const fetchViajes = async () => {
    setLoading(true);
    let allRutas: ViajeBitacora[] = [];

    // 1. Cargar desde logistica_reportes_diarios (Tabla principal en Supabase)
    try {
      const { data: supaReportes } = await supabase
        .from("logistica_reportes_diarios")
        .select(`
          id_reporte,
          id_empleado,
          fecha,
          camion_numero,
          tipo_vehiculo,
          comentarios_vehiculo,
          observaciones_recorrido,
          ubicacion_caseta,
          creado_el,
          empleados:id_empleado (id_empleado, nombre, apellido_paterno, apellido_materno)
        `)
        .order("creado_el", { ascending: false });

      if (supaReportes && supaReportes.length > 0) {
        supaReportes.forEach((rep: any) => {
          const com = rep.comentarios_vehiculo || "";
          let puntoA = "Mina Bacis";
          let puntoB = rep.ubicacion_caseta || "Parajes";
          let choferNombre = "Chofer Operador";

          if (rep.empleados) {
            choferNombre = `${rep.empleados.nombre} ${rep.empleados.apellido_paterno || ''}`.trim();
          }

          // Parser seguro por split de cadenas
          if (com.includes("Ruta:")) {
            const rPart = com.split("Ruta:")[1]?.split("|")[0]?.trim() || "";
            const parts = rPart.split(/\s+a\s+|\s+➔\s+|\s+->\s+/i);
            if (parts.length >= 2) {
              puntoA = parts[0].trim();
              puntoB = parts[1].trim();
            } else if (rPart) {
              puntoA = rPart;
            }
          }
          if (com.includes("Chofer:")) {
            const chPart = com.split("Chofer:")[1]?.split("|")[0]?.trim() || "";
            if (chPart) {
              choferNombre = chPart;
            }
          }

          let listaPasajeros: any[] = [];
          try {
            if (rep.observaciones_recorrido && rep.observaciones_recorrido !== '[]') {
              listaPasajeros = JSON.parse(rep.observaciones_recorrido);
            }
          } catch (_) {}

          const horaSalida = rep.creado_el ? new Date(rep.creado_el).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : "N/A";

          allRutas.push({
            id_bitacora: rep.id_reporte,
            id_chofer: rep.id_empleado,
            chofer_nombre: choferNombre,
            punto_a: puntoA,
            punto_b: puntoB,
            hora_salida_a: horaSalida,
            hora_llegada_b: "Completado",
            pasajeros_subieron_a: listaPasajeros.length,
            pasajeros_bajaron_b: listaPasajeros.length,
            pasajeros_lista: listaPasajeros,
            estatus: "CONCLUIDO",
            fecha: rep.fecha ? rep.fecha.toString() : (rep.creado_el ? rep.creado_el.split('T')[0] : new Date().toISOString().split('T')[0]),
            creado_el: rep.creado_el || new Date().toISOString()
          });
        });
      }
    } catch (e) {}

    // 2. Cargar desde LocalStorage de la App Móvil
    try {
      const rawApp = localStorage.getItem("rh_chofer_viajes");
      if (rawApp) {
        const appViajes = JSON.parse(rawApp);
        appViajes.forEach((v: any) => {
          allRutas.push({
            id_bitacora: v.id_viaje_local || "APP-" + Date.now(),
            id_chofer: v.id_chofer || "CHOFER",
            chofer_nombre: v.chofer_nombre || "Chofer Operador",
            punto_a: v.ruta_origen || "Origen",
            punto_b: v.ruta_destino || "Destino",
            hora_salida_a: v.hora_inicio_real ? new Date(v.hora_inicio_real).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : "N/A",
            hora_llegada_b: v.hora_fin_real ? new Date(v.hora_fin_real).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : "Completado",
            pasajeros_subieron_a: v.pasajeros?.length || 0,
            pasajeros_bajaron_b: v.pasajeros?.length || 0,
            pasajeros_lista: (v.pasajeros || []).map((p: any) => ({
              id: p.id_empleado || p.id_manual || p.id_registro_local,
              nombre: p.nombre_completo || `Empleado #${p.id_manual || p.id_empleado}`,
              puesto: p.puesto_depto || "Personal",
              departamento: "Mina Bacis",
              hora: p.hora_subida ? new Date(p.hora_subida).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : "N/A",
              metodo: p.metodo_registro || "QR"
            })),
            estatus: v.estado === 'Finalizado' ? "CONCLUIDO" : "EN_CURSO",
            fecha: v.creado_el ? new Date(v.creado_el).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
            creado_el: v.creado_el || new Date().toISOString()
          });
        });
      }
    } catch (e) {}

    // 3. Cargar desde LocalStorage Global de Rutas
    try {
      const globalRaw = localStorage.getItem("rh_rutas_qr_global_history");
      if (globalRaw) allRutas = [...allRutas, ...JSON.parse(globalRaw)];
    } catch (e) {}

    // Deduplicar rutas
    const unique = allRutas.filter((v, i, a) => 
      a.findIndex(t => t.id_bitacora === v.id_bitacora || (t.hora_salida_a === v.hora_salida_a && t.fecha === v.fecha && t.chofer_nombre === v.chofer_nombre)) === i
    );

    // Ordenar de más reciente a más antiguo
    unique.sort((a, b) => new Date(b.creado_el || b.fecha).getTime() - new Date(a.creado_el || a.fecha).getTime());

    setViajes(unique);
    setLoading(false);
  };

  // Generador de Rutas y Manifiestos de Demostración para los 6 choferes oficiales
  const handleGenerarRutasDemo = async () => {
    setSeedingDemo(true);
    setDemoMessage("Generando rutas oficiales en la base de datos para los 6 choferes...");

    try {
      const { data: emps } = await supabase
        .from('empleados')
        .select('id_empleado, nombre, apellido_paterno, apellido_materno, puesto, departamento, numero_empleado')
        .limit(30);

      const listaEmps = emps || [];
      const hoy = new Date().toISOString().split('T')[0];

      const demoTrips = [
        { chofer: "Adalberto Pinales", eco: "CAM-01", origen: "Obscuridad", destino: "Parajes", horaSalida: "07:00 AM", horaLlegada: "07:45 AM", count: 12 },
        { chofer: "Ramon Yañez", eco: "CAM-02", origen: "San Miguel", destino: "Planta", horaSalida: "07:15 AM", horaLlegada: "08:00 AM", count: 8 },
        { chofer: "Oscar Vazquez", eco: "URVAN-01", origen: "Mina Bacis", destino: "Parajes", horaSalida: "08:30 AM", horaLlegada: "09:10 AM", count: 6 },
        { chofer: "Enrique Linares", eco: "BUS-01", origen: "Parajes", destino: "Obscuridad", horaSalida: "06:45 AM", horaLlegada: "07:35 AM", count: 18 },
        { chofer: "Samuel Madriles", eco: "CAM-03", origen: "Obscuridad", destino: "Mina Bacis", horaSalida: "07:30 AM", horaLlegada: "08:15 AM", count: 10 },
        { chofer: "Jesus Saucedo", eco: "CAM-04", origen: "Planta", destino: "San Miguel", horaSalida: "08:00 AM", horaLlegada: "08:40 AM", count: 9 }
      ];

      for (const d of demoTrips) {
        const pasajerosViaje = listaEmps.slice(0, d.count).map((e, idx) => ({
          id: e.id_empleado,
          nombre: `${e.nombre} ${e.apellido_paterno} ${e.apellido_materno || ''}`.trim(),
          puesto: `${e.puesto || 'Operador'} • ${e.departamento || 'Mina Bacis'}`,
          hora: `07:${String(10 + idx * 2).padStart(2, '0')} AM`,
          metodo: 'QR'
        }));

        await supabase.from("logistica_reportes_diarios").insert([{
          camion_numero: d.eco,
          tipo_vehiculo: d.eco.startsWith('BUS') ? 'Camión' : (d.eco.startsWith('URVAN') ? 'Urvan' : 'Camioneta'),
          ubicacion_caseta: d.destino,
          fecha: hoy,
          comentarios_vehiculo: `[VIAJE_QR] Ruta: ${d.origen} a ${d.destino} | Chofer: ${d.chofer} | Pasajeros: ${pasajerosViaje.length} | Salida: ${d.horaSalida} | Llegada: ${d.horaLlegada}`,
          observaciones_recorrido: JSON.stringify(pasajerosViaje),
          frenos_ok: true,
          luces_ok: true,
          llantas_ok: true,
          niveles_aceite_ok: true,
          carroceria_ok: true,
          extintor_ok: true,
          botiquin_ok: true
        }]);
      }

      setDemoMessage("✅ ¡6 viajes oficiales generados exitosamente en la base de datos central!");
      setTimeout(() => setDemoMessage(""), 4000);
      fetchViajes();
    } catch (e: any) {
      setDemoMessage("Error generando demostración: " + e.message);
    } finally {
      setSeedingDemo(false);
    }
  };

  // Filtrado múltiple
  const filteredViajes = viajes.filter(v => {
    if (selectedDriverFilter !== "Todos") {
      if (!v.chofer_nombre.toLowerCase().includes(selectedDriverFilter.toLowerCase())) return false;
    }

    if (dateFilter === "hoy") {
      const hoy = new Date().toISOString().split("T")[0];
      if (v.fecha !== hoy) return false;
    } else if (dateFilter === "semana") {
      const sieteDiasAtras = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split("T")[0];
      if (v.fecha < sieteDiasAtras) return false;
    } else if (dateFilter === "mes") {
      const mesActual = new Date().toISOString().slice(0, 7);
      if (!v.fecha.startsWith(mesActual)) return false;
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchRuta = v.punto_a.toLowerCase().includes(term) || v.punto_b.toLowerCase().includes(term);
      const matchChofer = v.chofer_nombre.toLowerCase().includes(term);
      const matchFecha = v.fecha.includes(term);
      const matchPasajero = (v.pasajeros_lista || []).some(p => p.nombre.toLowerCase().includes(term));
      if (!matchRuta && !matchChofer && !matchFecha && !matchPasajero) return false;
    }

    return true;
  });

  const totalPasajeros = filteredViajes.reduce((acc, v) => acc + (v.pasajeros_subieron_a || 0), 0);

  // Exportar Manifiesto Individual a PDF Oficial
  const exportManifiestoPDF = (viaje: ViajeBitacora) => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("MINAS DE BACIS - CONTROL DE MOVILIDAD", 105, 18, { align: "center" });
    doc.setFontSize(12);
    doc.text("Manifiesto Oficial de Pasajeros y Control de Ruta", 105, 26, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Ruta: ${viaje.punto_a} ➔ ${viaje.punto_b}`, 14, 38);
    doc.text(`Chofer Operador: ${viaje.chofer_nombre}`, 14, 46);
    doc.text(`Fecha: ${viaje.fecha} | Hora Salida: ${viaje.hora_salida_a} | Llegada: ${viaje.hora_llegada_b || "Completado"}`, 14, 54);
    doc.text(`Total de Personal a Bordo: ${viaje.pasajeros_subieron_a} trabajadores`, 14, 62);
    doc.line(14, 66, 196, 66);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Lista Nominal de Pasajeros Registrados:", 14, 74);

    let y = 84;
    doc.setFontSize(9);
    doc.text("#", 14, y);
    doc.text("Nombre Completo del Trabajador", 24, y);
    doc.text("Puesto / Departamento", 110, y);
    doc.text("Hora Subida", 160, y);
    doc.text("Método", 182, y);
    doc.line(14, y + 2, 196, y + 2);
    y += 8;

    doc.setFont("helvetica", "normal");
    const lista = viaje.pasajeros_lista || [];
    if (lista.length === 0) {
      doc.text("Sin desglose individual de nombres (Conteo general registrado).", 14, y);
    } else {
      lista.forEach((p, idx) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        const { nombre, puesto } = resolverNombre(p.id, p.nombre);
        doc.text(`${idx + 1}`, 14, y);
        doc.text(`${nombre}`, 24, y);
        doc.text(`${puesto}`, 110, y);
        doc.text(`${p.hora}`, 160, y);
        doc.text(`${p.metodo || "QR"}`, 182, y);
        y += 7;
      });
    }

    doc.save(`Manifiesto_Oficial_${viaje.punto_a}_a_${viaje.punto_b}_${viaje.fecha}.pdf`);
  };

  // Exportar Todos a CSV / Excel
  const exportarTodosCSV = () => {
    let csv = "ID Viaje,Fecha,Chofer,Origen,Destino,Hora Salida,Hora Llegada,Total Pasajeros,Nombre Pasajero,Puesto Pasajero,Hora Pasajero\n";
    filteredViajes.forEach(v => {
      if (!v.pasajeros_lista || v.pasajeros_lista.length === 0) {
        csv += `"${v.id_bitacora}","${v.fecha}","${v.chofer_nombre}","${v.punto_a}","${v.punto_b}","${v.hora_salida_a}","${v.hora_llegada_b || ''}",${v.pasajeros_subieron_a},"Sin desglose","",""\n`;
      } else {
        v.pasajeros_lista.forEach(p => {
          const { nombre, puesto } = resolverNombre(p.id, p.nombre);
          csv += `"${v.id_bitacora}","${v.fecha}","${v.chofer_nombre}","${v.punto_a}","${v.punto_b}","${v.hora_salida_a}","${v.hora_llegada_b || ''}",${v.pasajeros_subieron_a},"${nombre}","${puesto}","${p.hora}"\n`;
        });
      }
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Manifiestos_Rutas_Bacis_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      
      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 text-white p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="bg-emerald-500 p-3 rounded-2xl text-black shadow-md">
            <Bus className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
              {isChofer ? `Bitácora Oficial • ${profile?.nombre_completo || 'Chofer'}` : 'Panel Administrativo Central'}
            </span>
            <h1 className="text-2xl font-black tracking-tight">Centro de Manifiestos de Choferes</h1>
            <p className="text-zinc-400 text-xs mt-0.5">Control y visualización de viajes de todos los choferes y pasaje a bordo</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isRHOrAdmin && (
            <button
              onClick={handleGenerarRutasDemo}
              disabled={seedingDemo}
              className="px-3.5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95"
              title="Cargar viajes de prueba para los 6 choferes oficiales"
            >
              <Sparkles className="w-4 h-4" />
              <span>{seedingDemo ? "Generando..." : "⚡ Cargar Rutas Demo"}</span>
            </button>
          )}

          <Link
            href="/chofer-app"
            target="_blank"
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-black rounded-xl border border-zinc-700 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Truck className="w-4 h-4 text-amber-400" />
            <span>📱 App Choferes</span>
          </Link>

          <button
            onClick={exportarTodosCSV}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl shadow-md text-xs font-black transition-all flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Excel (.csv)</span>
          </button>

          <button
            onClick={fetchViajes}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-zinc-700"
            title="Actualizar datos en vivo"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {demoMessage && (
        <div className="p-3 bg-emerald-950 border border-emerald-500/60 text-emerald-300 text-xs rounded-2xl font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{demoMessage}</span>
        </div>
      )}

      {/* Tarjetas de Estadísticas en Tiempo Real */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
            <Bus className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Total de Viajes Registrados</span>
            <div className="text-2xl font-black text-zinc-900">{filteredViajes.length}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-black">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Total Pasajeros Transportados</span>
            <div className="text-2xl font-black text-zinc-900">{totalPasajeros}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-black">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Flotilla Oficial</span>
            <div className="text-2xl font-black text-zinc-900">6 Choferes</div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros del Administrador */}
      <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          
          {/* Buscador */}
          <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 w-full sm:w-80">
            <Search className="w-4 h-4 text-zinc-400 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por chofer, ruta o trabajador..."
              className="w-full text-xs font-bold text-zinc-800 focus:outline-none bg-transparent"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="text-xs font-bold text-zinc-400 hover:text-zinc-600">✕</button>
            )}
          </div>

          {/* Filtro por Chofer (Solo editable para Administradores / RH) */}
          {isRHOrAdmin ? (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Chofer:</span>
              <select
                value={selectedDriverFilter}
                onChange={e => setSelectedDriverFilter(e.target.value)}
                className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800 focus:outline-none"
              >
                {CHOFERES_LIST.map(ch => (
                  <option key={ch} value={ch}>{ch === 'Todos' ? '👥 Todos los Choferes' : `👔 ${ch}`}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-xs font-bold text-zinc-600 bg-zinc-100 px-3 py-2 rounded-xl">
              👔 Chofer: <strong className="text-zinc-900">{profile?.nombre_completo || 'Chofer Operador'}</strong>
            </div>
          )}

          {/* Filtro por Fecha */}
          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl w-full sm:w-auto justify-center">
            {(['todos', 'hoy', 'semana', 'mes'] as const).map(f => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black capitalize transition-all ${
                  dateFilter === f ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla de Manifiestos de Todos los Choferes */}
      {loading ? (
        <div className="text-center py-16 text-zinc-400 font-bold text-xs animate-pulse">Cargando manifiestos de choferes...</div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="px-6 py-4 font-black uppercase text-zinc-600 tracking-wider">Chofer Operador</th>
                  <th className="px-6 py-4 font-black uppercase text-zinc-600 tracking-wider">Ruta Minera</th>
                  <th className="px-6 py-4 font-black uppercase text-zinc-600 tracking-wider">Fecha y Horarios</th>
                  <th className="px-6 py-4 font-black uppercase text-zinc-600 tracking-wider text-center">Personal a Bordo</th>
                  <th className="px-6 py-4 font-black uppercase text-zinc-600 tracking-wider text-right">Manifiesto Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {filteredViajes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 font-bold space-y-2">
                      <div>No se han encontrado registros con los filtros actuales.</div>
                      {isRHOrAdmin && (
                        <button
                          onClick={handleGenerarRutasDemo}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl shadow-sm mt-2"
                        >
                          ⚡ Cargar Rutas Oficiales Demo
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredViajes.map((viaje, idx) => (
                    <tr key={viaje.id_bitacora || idx} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-sm">
                            👔
                          </div>
                          <div>
                            <div className="font-black text-zinc-900">{viaje.chofer_nombre}</div>
                            <div className="text-[10px] text-zinc-400 font-mono">Chofer Oficial</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-black text-zinc-900 flex items-center gap-1.5">
                          <span>{viaje.punto_a}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{viaje.punto_b}</span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mt-1 inline-block border border-emerald-200">
                          {viaje.estatus || "CONCLUIDO"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-bold text-zinc-700">📅 {viaje.fecha}</div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          Salida: <strong>{viaje.hora_salida_a}</strong> | Llegada: <strong>{viaje.hora_llegada_b || "Fin"}</strong>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-xs bg-indigo-50 text-indigo-900 border border-indigo-200">
                          <Users className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{viaje.pasajeros_subieron_a || (viaje.pasajeros_lista?.length || 0)} Trabajadores</span>
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedViajeModal(viaje)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs flex items-center gap-1 shadow-sm transition-all"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>Ver Manifiesto ({viaje.pasajeros_lista?.length || viaje.pasajeros_subieron_a || 0})</span>
                          </button>

                          <button
                            onClick={() => exportManifiestoPDF(viaje)}
                            className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl border border-zinc-200 transition-all"
                            title="Descargar PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DETALLADO DE MANIFIESTO NOMINAL */}
      {selectedViajeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl border border-zinc-200">
            <div className="flex justify-between items-start border-b pb-3 border-zinc-100">
              <div>
                <span className="text-[10px] text-emerald-600 font-black uppercase tracking-wider flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> MANIFIESTO OFICIAL DE PASAJEROS
                </span>
                <h3 className="text-lg font-black text-zinc-900">
                  {selectedViajeModal.punto_a} ➔ {selectedViajeModal.punto_b}
                </h3>
                <p className="text-xs text-zinc-500">
                  Chofer: <strong>{selectedViajeModal.chofer_nombre}</strong> • Fecha: {selectedViajeModal.fecha}
                </p>
              </div>
              <button
                onClick={() => setSelectedViajeModal(null)}
                className="p-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-black text-xs"
              >
                ✕ Cerrar
              </button>
            </div>

            {/* Resumen */}
            <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-[10px] text-zinc-400 block uppercase font-bold">Salida</span>
                <strong className="text-zinc-900 text-xs font-black">{selectedViajeModal.hora_salida_a}</strong>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block uppercase font-bold">Llegada</span>
                <strong className="text-zinc-900 text-xs font-black">{selectedViajeModal.hora_llegada_b || "Completado"}</strong>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block uppercase font-bold">Total a Bordo</span>
                <strong className="text-emerald-700 text-xs font-black">
                  {selectedViajeModal.pasajeros_subieron_a || (selectedViajeModal.pasajeros_lista?.length || 0)} Trabajadores
                </strong>
              </div>
            </div>

            {/* Lista Nominal */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-black uppercase text-zinc-700 tracking-wider">
                  Personal a Bordo ({selectedViajeModal.pasajeros_lista?.length || 0})
                </h4>
                <button
                  onClick={() => exportManifiestoPDF(selectedViajeModal)}
                  className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Descargar PDF
                </button>
              </div>

              {(!selectedViajeModal.pasajeros_lista || selectedViajeModal.pasajeros_lista.length === 0) ? (
                <div className="p-4 bg-zinc-50 rounded-xl text-center text-xs text-zinc-400">
                  Sin desglose individual de nombres.
                </div>
              ) : (
                <div className="border border-zinc-200 rounded-2xl overflow-hidden divide-y divide-zinc-100 max-h-64 overflow-y-auto">
                  {selectedViajeModal.pasajeros_lista.map((p, idx) => {
                    const { nombre, puesto } = resolverNombre(p.id, p.nombre);
                    return (
                      <div key={idx} className="p-3 bg-white flex justify-between items-center text-xs hover:bg-zinc-50">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-black text-zinc-900">{nombre}</div>
                            <div className="text-[10px] text-zinc-500 font-medium">{puesto}</div>
                          </div>
                        </div>
                        <div className="text-right font-mono text-[11px]">
                          <span className="font-bold text-zinc-700">{p.hora}</span>
                          <span className="block text-[9px] font-bold text-emerald-600 uppercase tracking-wider">{p.metodo || "QR"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedViajeModal(null)}
              className="w-full bg-zinc-900 text-white font-bold py-3 rounded-xl text-xs hover:bg-zinc-800 transition-all"
            >
              Cerrar Ventana
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
