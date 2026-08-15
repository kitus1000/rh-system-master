"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { 
  Clock, Truck, Users, AlertTriangle, ArrowRight, Download, 
  Search, RefreshCw, Bus, CheckCircle2, Calendar, MapPin, 
  FileText, ShieldCheck, UserCheck 
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

export default function BitacoraChoferesPage() {
  const [viajes, setViajes] = useState<ViajeBitacora[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedViajeModal, setSelectedViajeModal] = useState<ViajeBitacora | null>(null);

  const fetchViajes = async () => {
    setLoading(true);
    let allRutas: ViajeBitacora[] = [];

    // 1. Cargar desde LocalStorage Global
    try {
      const globalRaw = localStorage.getItem("rh_rutas_qr_global_history");
      if (globalRaw) allRutas = [...allRutas, ...JSON.parse(globalRaw)];
    } catch (e) {}

    // 2. Cargar desde LocalStorage App Móvil
    try {
      const appRaw = localStorage.getItem("rh_viajes_locales_chofer");
      if (appRaw) {
        const appViajes = JSON.parse(appRaw);
        appViajes.forEach((v: any) => {
          allRutas.push({
            id_bitacora: v.id_viaje_local || "APP-" + Date.now(),
            id_chofer: v.id_chofer || "CHOFER",
            chofer_nombre: v.chofer_nombre || "Chofer Operador",
            punto_a: v.ruta_origen || "Origen",
            punto_b: v.ruta_destino || "Destino",
            hora_salida_a: v.hora_inicio_real ? new Date(v.hora_inicio_real).toLocaleTimeString() : "N/A",
            hora_llegada_b: v.hora_fin_real ? new Date(v.hora_fin_real).toLocaleTimeString() : "Completado",
            pasajeros_subieron_a: v.pasajeros?.length || 0,
            pasajeros_bajaron_b: v.pasajeros?.length || 0,
            pasajeros_lista: (v.pasajeros || []).map((p: any) => ({
              id: p.id_empleado || p.id_manual || "ID",
              nombre: p.nombre_completo || "Trabajador",
              puesto: p.puesto_depto || "Personal",
              hora: p.hora_subida ? new Date(p.hora_subida).toLocaleTimeString() : "N/A",
              metodo: p.metodo_registro || "QR"
            })),
            estatus: "CONCLUIDO",
            fecha: v.creado_el ? new Date(v.creado_el).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
            creado_el: v.creado_el || new Date().toISOString()
          });
        });
      }
    } catch (e) {}

    // 3. Cargar desde Supabase (chofer_bitacora_rutas o logistica_reportes_diarios)
    try {
      const { data: supaBitacora } = await supabase
        .from("chofer_bitacora_rutas")
        .select("*")
        .order("creado_el", { ascending: false });

      if (supaBitacora && supaBitacora.length > 0) {
        supaBitacora.forEach((b: any) => {
          allRutas.push({
            id_bitacora: b.id_bitacora || "SUPA-" + b.id,
            id_chofer: b.id_chofer,
            chofer_nombre: b.chofer_nombre || "Chofer Operador",
            punto_a: b.punto_a || "Origen",
            punto_b: b.punto_b || "Destino",
            hora_salida_a: b.hora_salida_a || "N/A",
            hora_llegada_b: b.hora_llegada_b || "Completado",
            pasajeros_subieron_a: b.pasajeros_subieron_a || 0,
            pasajeros_bajaron_b: b.pasajeros_bajaron_b || 0,
            pasajeros_lista: b.pasajeros_lista || [],
            estatus: b.estatus || "CONCLUIDO",
            fecha: b.fecha || new Date().toISOString().split("T")[0],
            creado_el: b.creado_el || new Date().toISOString()
          });
        });
      }
    } catch (e) {}

    // Deduplicar
    const unique = allRutas.filter((v, i, a) => 
      a.findIndex(t => t.id_bitacora === v.id_bitacora || (t.hora_salida_a === v.hora_salida_a && t.fecha === v.fecha && t.chofer_nombre === v.chofer_nombre)) === i
    );

    // Ordenar por fecha más reciente
    unique.sort((a, b) => new Date(b.creado_el || b.fecha).getTime() - new Date(a.creado_el || a.fecha).getTime());

    setViajes(unique);
    setLoading(false);
  };

  useEffect(() => {
    fetchViajes();
  }, []);

  const exportManifiestoPDF = (viaje: ViajeBitacora) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Manifiesto Oficial de Pasajeros y Control de Ruta", 105, 20, { align: "center" });

    doc.setFontSize(10);
    doc.text(`Ruta: ${viaje.punto_a} ➔ ${viaje.punto_b}`, 14, 32);
    doc.text(`Chofer Operador: ${viaje.chofer_nombre}`, 14, 40);
    doc.text(`Fecha: ${viaje.fecha} | Hora Salida: ${viaje.hora_salida_a} | Hora Llegada: ${viaje.hora_llegada_b || "Completado"}`, 14, 48);
    doc.text(`Total de Pasajeros a Bordo: ${viaje.pasajeros_subieron_a}`, 14, 56);
    doc.line(14, 62, 196, 62);

    doc.setFontSize(11);
    doc.text("Lista Detallada de Trabajadores a Bordo:", 14, 70);

    let y = 80;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("#", 14, y);
    doc.text("Nombre Completo del Trabajador", 24, y);
    doc.text("Puesto / Departamento", 105, y);
    doc.text("Hora", 160, y);
    doc.text("Método", 180, y);
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
        doc.text(`${idx + 1}`, 14, y);
        doc.text(`${p.nombre}`, 24, y);
        doc.text(`${p.puesto || "Personal"}`, 105, y);
        doc.text(`${p.hora}`, 160, y);
        doc.text(`${p.metodo || "QR"}`, 180, y);
        y += 7;
      });
    }

    doc.save(`Manifiesto_Pasajeros_${viaje.punto_a}_a_${viaje.punto_b}_${viaje.fecha}.pdf`);
  };

  const filteredViajes = viajes.filter(v => 
    v.chofer_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.punto_a.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.punto_b.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.fecha.includes(searchTerm)
  );

  const totalPasajeros = viajes.reduce((acc, v) => acc + (v.pasajeros_subieron_a || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 text-white p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-3 rounded-2xl text-black shadow-md">
            <Bus className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Bitácora Global de Rutas y Pasajeros QR</h1>
            <p className="text-zinc-400 text-xs mt-0.5">Monitoreo y Manifiestos de Traslado de Personal en Tiempo Real</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/logistica/choferes"
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-xl border border-zinc-700 transition-all flex items-center gap-1.5"
          >
            <Truck className="w-4 h-4 text-emerald-400" />
            <span>Portal de Choferes</span>
          </Link>

          <button
            onClick={fetchViajes}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl shadow-md text-xs font-black transition-all flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Tarjetas de Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
            <Bus className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Total Viajes Concluidos</span>
            <div className="text-2xl font-black text-zinc-900">{viajes.length}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-black">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Pasajeros Transportados con QR</span>
            <div className="text-2xl font-black text-zinc-900">{totalPasajeros}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Choferes en Operación</span>
            <div className="text-2xl font-black text-zinc-900">6 Registrados</div>
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs flex items-center gap-3">
        <Search className="w-5 h-5 text-zinc-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Buscar por Chofer, Origen (Mina, Obscuridad), Destino (Parajes) o Fecha..."
          className="flex-1 text-xs font-bold text-zinc-800 focus:outline-none bg-transparent"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm("")} className="text-xs font-bold text-zinc-400 hover:text-zinc-600">
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla de Bitácora */}
      {loading ? (
        <div className="text-center py-16 text-zinc-400 font-bold text-xs animate-pulse">Cargando bitácora de rutas...</div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="px-6 py-4 font-black uppercase text-zinc-600 tracking-wider">Chofer Operador</th>
                  <th className="px-6 py-4 font-black uppercase text-zinc-600 tracking-wider">Ruta (Origen ➔ Destino)</th>
                  <th className="px-6 py-4 font-black uppercase text-zinc-600 tracking-wider">Fecha y Horarios</th>
                  <th className="px-6 py-4 font-black uppercase text-zinc-600 tracking-wider text-center">Pasajeros QR</th>
                  <th className="px-6 py-4 font-black uppercase text-zinc-600 tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {filteredViajes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 font-bold">
                      No se encontraron rutas con el criterio de búsqueda.
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
                          <span>{viaje.pasajeros_subieron_a || 0} Pasajeros</span>
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedViajeModal(viaje)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs flex items-center gap-1 shadow-sm transition-all"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>Ver Nombres ({viaje.pasajeros_lista?.length || viaje.pasajeros_subieron_a || 0})</span>
                          </button>

                          <button
                            onClick={() => exportManifiestoPDF(viaje)}
                            className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl border border-zinc-200 transition-all"
                            title="Descargar PDF Manifiesto"
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

      {/* MODAL DETALLE DE PASAJEROS ESCANEADOS */}
      {selectedViajeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl border border-zinc-200">
            <div className="flex justify-between items-start border-b pb-3 border-zinc-100">
              <div>
                <span className="text-[10px] text-emerald-600 font-black uppercase tracking-wider flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> MANIFIESTO DE PASAJE QR
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
                <span className="text-[10px] text-zinc-400 block uppercase">Salida A</span>
                <strong className="text-zinc-900">{selectedViajeModal.hora_salida_a}</strong>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block uppercase">Llegada B</span>
                <strong className="text-zinc-900">{selectedViajeModal.hora_llegada_b || "Completado"}</strong>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block uppercase">Total a Bordo</span>
                <strong className="text-emerald-700">{selectedViajeModal.pasajeros_subieron_a || 0} Personas</strong>
              </div>
            </div>

            {/* Lista Detallada */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-black uppercase text-zinc-700 tracking-wider">
                  Personal Registrado con Credencial QR ({selectedViajeModal.pasajeros_lista?.length || 0})
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
                  Este viaje se registró con conteo general directo sin desglose de nombres individuales.
                </div>
              ) : (
                <div className="border border-zinc-200 rounded-2xl overflow-hidden divide-y divide-zinc-100 max-h-64 overflow-y-auto">
                  {selectedViajeModal.pasajeros_lista.map((p, idx) => (
                    <div key={idx} className="p-3 bg-white flex justify-between items-center text-xs hover:bg-zinc-50">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-black text-zinc-900">{p.nombre}</div>
                          <div className="text-[10px] text-zinc-500">
                            {p.puesto || "Personal"} • ID: {p.id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono text-[11px]">
                        <span className="font-bold text-zinc-700">{p.hora}</span>
                        <span className="block text-[9px] font-bold text-emerald-600 uppercase tracking-wider">{p.metodo || "QR"}</span>
                      </div>
                    </div>
                  ))}
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
