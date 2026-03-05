import React, { useState, useMemo, useEffect } from 'react';
import { 
  UploadCloud, Calendar, User, Search, CheckCircle, 
  Clock, AlertCircle, Zap, Activity, Users, LogOut,
  Settings, UserPlus, Trash2, CheckSquare, Bell, Download, PlusCircle
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';

// =====================================================================
// ⚠️ CABLE 1: AQUÍ VAN TUS LLAVES DE FIREBASE (Para que guarde los datos)
// =====================================================================
const firebaseConfig = {
  apiKey: "AIzaSyCTrJeO9uPDpw3OhbGTSEHYzdX6ALsakY4",
  authDomain: "crm-capillas.firebaseapp.com",
  projectId: "crm-capillas",
  storageBucket: "crm-capillas.firebasestorage.app",
  messagingSenderId: "1046562415612",
  appId: "1:1046562415612:web:7bdb7f1778337ee0a98879"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =====================================================================
// ⚠️ CABLE 2: AQUÍ VA EL LINK DE ZAPIER (Para el Google Calendar)
// =====================================================================
const LINK_WEBHOOK_ZAPIER = "PIDELE_A_ZAPIER_ESTE_LINK_Y_PEGALO_AQUI";

// ==========================================
// DATOS DE CAPILLAS DE LA FE
// ==========================================
const JEFA = { nombre: "Ana Carolina Ramirez", correo: "directoracomercial01@capillasdelafe.com", rol: "Directora Comercial" };
const ASESORES_INICIALES = [
  "Jose Corredor", "Jhon Rodriguez", "Andres Rojas", "Viviana Bohorquez", 
  "Johana Patiño", "Anyis Ortega", "Cristina Quintero", "Juan Loaiza", 
  "Andres Avendaño", "Marco Antonio Gomez"
];
const ESTADOS = [
  { id: 'asignada', label: 'Asignada (Nueva)', color: 'bg-blue-100 text-blue-800' },
  { id: 'seguimiento', label: 'Seguimiento', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'cierre', label: 'Cierre Exitoso', color: 'bg-green-100 text-green-800' },
  { id: 'no_cierre', label: 'No Cierre', color: 'bg-red-100 text-red-800' },
  { id: 'reagendar', label: 'Reagendar', color: 'bg-orange-100 text-orange-800' }
];

const getHoy = () => new Date().toISOString().split('T')[0];
const restarDias = (fecha, dias) => { const d = new Date(fecha); d.setDate(d.getDate() - dias); return d.toISOString().split('T')[0]; };

export default function CRMCapillas() {
  const [user, setUser] = useState(null);
  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [usuarioActual, setUsuarioActual] = useState(JEFA.nombre); 
  const [vistaActual, setVistaActual] = useState('dashboard');
  const [notificacion, setNotificacion] = useState(null);
  const [asesoresActivos, setAsesoresActivos] = useState(ASESORES_INICIALES);
  const [nuevoAsesor, setNuevoAsesor] = useState("");
  const [terminoBusqueda, setTerminoBusqueda] = useState("");

  // Estado para el formulario manual
  const [formManual, setFormManual] = useState({ cliente: '', asesor: ASESORES_INICIALES[0], notas: '' });

  // Conexión a Base de Datos
  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const citasRef = collection(db, 'citas_comerciales');
    const unsubscribe = onSnapshot(citasRef, (snapshot) => {
      const datosCitas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      datosCitas.sort((a, b) => b.createdAt - a.createdAt);
      setCitas(datosCitas);
      setCargando(false);
    }, (error) => {
      console.error("Error al conectar Firebase. ¿Pusiste las llaves?", error);
      setCargando(false);
    });
    return () => unsubscribe();
  }, [user]);

  const esJefa = usuarioActual === JEFA.nombre;
  const usuariosDisponibles = useMemo(() => [JEFA.nombre, ...asesoresActivos], [asesoresActivos]);

  const citasFiltradas = useMemo(() => {
    let filtradas = citas;
    if (!esJefa) filtradas = filtradas.filter(c => c.asesor === usuarioActual);
    if (terminoBusqueda) {
      const b = terminoBusqueda.toLowerCase();
      filtradas = filtradas.filter(c => c.cliente.toLowerCase().includes(b) || c.fechaCita.includes(b) || (c.seguimiento && c.seguimiento.includes(b)));
    }
    return filtradas;
  }, [citas, usuarioActual, esJefa, terminoBusqueda]);

  const alarmas = useMemo(() => {
    const hoy = getHoy();
    const seguimientosUrgentes = citasFiltradas.filter(c => c.seguimiento && c.seguimiento <= hoy && !['cierre', 'no_cierre'].includes(c.estado));
    const peligroGps = citasFiltradas.filter(c => {
      if (['cierre', 'no_cierre'].includes(c.estado)) return false;
      return new Date(c.ultimaModificacion || c.fechaCita) <= new Date(restarDias(hoy, 25));
    });
    return { seguimientosUrgentes, peligroGps };
  }, [citasFiltradas]);

  const mostrarNotificacion = (mensaje, tiempo = 4000) => { setNotificacion(mensaje); setTimeout(() => setNotificacion(null), tiempo); };

  const notificarAZapier = async (cita) => {
    mostrarNotificacion(`⚡ Avisando a Zapier para agendar en el Google Calendar de ${cita.asesor}...`);
    try {
      if(LINK_WEBHOOK_ZAPIER !== "PIDELE_A_ZAPIER_ESTE_LINK_Y_PEGALO_AQUI") {
        await fetch(LINK_WEBHOOK_ZAPIER, { method: 'POST', body: JSON.stringify(cita), headers: { 'Content-Type': 'application/json' } });
        mostrarNotificacion(`✅ Zapier completó la tarea. Copia enviada a Ana Carolina.`);
      }
    } catch (e) { console.error("Falta conectar Zapier", e); }
  };

  const exportarAExcel = () => {
    const encabezados = ['Empresa', 'Asesor', 'Estado Actual', 'Fecha de Carga', 'Fecha Siguiente Seguimiento', 'Notas / Avances', 'Última Edición'];
    const filas = citasFiltradas.map(c => [
      `"${c.cliente}"`, `"${c.asesor}"`, `"${ESTADOS.find(e => e.id === c.estado)?.label || c.estado}"`, `"${c.fechaCita}"`, `"${c.seguimiento}"`, `"${(c.notas || '').replace(/"/g, '""')}"`, `"${c.ultimaModificacion}"`
    ]);
    const csvContent = [encabezados.join(','), ...filas.map(f => f.join(','))].join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); 
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Reporte_Capillas_${getHoy()}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    mostrarNotificacion("📊 Reporte descargado exitosamente.");
  };

  // 1. CARGA MANUAL DE CLIENTE
  const guardarCitaManual = async (e) => {
    e.preventDefault();
    if (!formManual.cliente.trim() || !formManual.asesor) return;
    mostrarNotificacion("⏳ Registrando empresa manualmente...");
    
    const nuevaCita = {
      cliente: formManual.cliente.trim(),
      asesor: formManual.asesor,
      estado: 'asignada',
      fechaCita: getHoy(),
      seguimiento: '',
      notas: formManual.notas.trim(),
      ultimaModificacion: getHoy(),
      createdAt: Date.now()
    };
    
    try {
      await addDoc(collection(db, 'citas_comerciales'), nuevaCita);
      mostrarNotificacion(`✅ Empresa ${nuevaCita.cliente} asignada a ${nuevaCita.asesor}.`);
      setFormManual({ cliente: '', asesor: asesoresActivos[0], notas: '' }); // Limpiar formulario
    } catch (e) { console.error(e); alert("Error al guardar."); }
  };

  // 2. CARGA MASIVA (EXCEL CSV)
  const procesarArchivoCSV = (e) => {
    e.preventDefault();
    const archivo = document.getElementById('fileUpload').files[0];
    if (!archivo) return alert("Selecciona un archivo primero.");
    
    mostrarNotificacion("⏳ Leyendo archivo y asignando a asesores...", 3000);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const texto = event.target.result;
      const lineas = texto.split('\n');
      let cargadas = 0;
      for (let i = 1; i < lineas.length; i++) {
        if (!lineas[i].trim()) continue;
        const columnas = lineas[i].split(','); 
        if (columnas.length >= 2) {
          const nuevaCita = {
            cliente: columnas[0].trim(), asesor: columnas[1].trim(), estado: 'asignada', fechaCita: getHoy(), seguimiento: '', notas: '', ultimaModificacion: getHoy(), createdAt: Date.now() + i
          };
          try { await addDoc(collection(db, 'citas_comerciales'), nuevaCita); cargadas++; } catch (e) { console.error(e); }
        }
      }
      mostrarNotificacion(`✅ ${cargadas} clientes cargados por Excel.`);
      setVistaActual('dashboard');
    };
    reader.readAsText(archivo);
  };

  const actualizarGestion = async (id, campo, valor) => {
    try {
      const citaRef = doc(db, 'citas_comerciales', id);
      await updateDoc(citaRef, { [campo]: valor, ultimaModificacion: getHoy() });
      if (campo === 'seguimiento' && valor !== '') {
        const citaModificada = citas.find(c => c.id === id);
        notificarAZapier({ ...citaModificada, [campo]: valor });
      }
    } catch (e) { alert("Error al guardar."); }
  };

  const eliminarCita = async (id) => { if(window.confirm("¿Eliminar registro para siempre?")) await deleteDoc(doc(db, 'citas_comerciales', id)); };
  const agregarAsesor = (e) => { e.preventDefault(); if (nuevoAsesor.trim() && !asesoresActivos.includes(nuevoAsesor)) { setAsesoresActivos([...asesoresActivos, nuevoAsesor.trim()]); setNuevoAsesor(""); mostrarNotificacion("✅ Asesor agregado."); } };
  const eliminarAsesor = (nombre) => { if (window.confirm(`¿Desactivar a ${nombre}?`)) setAsesoresActivos(asesoresActivos.filter(a => a !== nombre)); };

  if (cargando) return <div className="min-h-screen flex items-center justify-center font-bold text-blue-800">Cargando Motor CRM Capillas de la Fe...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 pb-10">
      
      {/* BARRA DE ACCESO (SIMULADOR) */}
      <div className="bg-slate-900 text-white p-2 flex justify-between items-center text-sm px-6">
        <span className="font-medium text-slate-400">Panel de Control Interno</span>
        <div className="flex items-center gap-2">
          <span>Ver como:</span>
          <select className="bg-slate-800 border border-slate-700 rounded px-3 py-1 text-white font-bold outline-none" value={usuarioActual} onChange={(e) => { setUsuarioActual(e.target.value); setVistaActual('dashboard'); }}>
            {usuariosDisponibles.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {/* HEADER CAPILLAS */}
      <nav className="bg-blue-800 text-white p-4 shadow-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Activity className="text-blue-300" size={32} />
            <h1 className="text-xl font-bold">CAPILLAS DE LA FE <span className="font-light text-blue-300">| Hub Comercial</span></h1>
          </div>
          <div className="relative w-full md:w-96">
            <input type="text" placeholder="Buscar por cliente o fecha..." className="w-full bg-blue-900 border border-blue-700 rounded-full py-2 pl-10 pr-4 text-white placeholder-blue-300 outline-none" value={terminoBusqueda} onChange={(e) => setTerminoBusqueda(e.target.value)} />
            <Search className="absolute left-3 top-2.5 text-blue-300" size={18} />
          </div>
          <div className="hidden md:flex items-center gap-3">
            <div className="text-right"><p className="text-sm font-bold">{usuarioActual}</p><p className="text-xs text-blue-300">{esJefa ? JEFA.rol : 'Asesor Comercial'}</p></div>
          </div>
        </div>
      </nav>

      {/* NOTIFICACIONES EMERGENTES */}
      {notificacion && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold z-50 animate-bounce">
          {notificacion}
        </div>
      )}

      {/* CUERPO PRINCIPAL */}
      <div className="flex flex-col md:flex-row max-w-7xl mx-auto w-full mt-6 gap-6 px-4">
        
        {/* MENÚ LATERAL */}
        <aside className="w-full md:w-64 flex flex-col gap-2 shrink-0">
          <button onClick={() => setVistaActual('dashboard')} className={`p-3 rounded-xl font-bold flex items-center gap-3 transition-all ${vistaActual === 'dashboard' ? 'bg-blue-100 text-blue-800 shadow border border-blue-200' : 'bg-white hover:bg-slate-100'}`}><Activity size={20}/> Monitor de Gestiones</button>
          
          {esJefa && (
            <>
              <button onClick={() => setVistaActual('cargar')} className={`p-3 rounded-xl font-bold flex items-center gap-3 transition-all ${vistaActual === 'cargar' ? 'bg-blue-100 text-blue-800 shadow border border-blue-200' : 'bg-white hover:bg-slate-100'}`}><UploadCloud size={20}/> Asignar Citas</button>
              <button onClick={() => setVistaActual('config')} className={`p-3 rounded-xl font-bold flex items-center gap-3 transition-all ${vistaActual === 'config' ? 'bg-blue-100 text-blue-800 shadow border border-blue-200' : 'bg-white hover:bg-slate-100'}`}><Settings size={20}/> Equipo y Asesores</button>
            </>
          )}

          <div className="mt-4 p-4 bg-slate-800 rounded-xl text-xs text-slate-300">
            <p className="font-bold mb-2 flex items-center gap-1 text-white"><Zap size={16} className="text-yellow-400"/> Sistema Zapier</p>
            <ul className="space-y-1">
              <li>✅ Envía copias a Jefatura</li>
              <li>✅ Sincroniza G. Calendar</li>
              <li>✅ Alerta de 25 días (GPS)</li>
            </ul>
          </div>
        </aside>

        {/* CONTENIDO DERECHO */}
        <main className="flex-1 min-w-0">
          
          {/* VISTA: CONFIGURAR EQUIPO */}
          {vistaActual === 'config' && esJefa && (
            <div className="bg-white rounded-2xl p-8 shadow border">
              <h2 className="text-2xl font-bold border-b pb-4 mb-6">Gestión de Asesores</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <form onSubmit={agregarAsesor} className="bg-slate-50 p-6 rounded-xl border">
                  <h3 className="font-bold mb-4">Agregar Nuevo Asesor</h3>
                  <input type="text" required placeholder="Nombre completo" className="w-full p-3 border rounded-lg mb-3" value={nuevoAsesor} onChange={e => setNuevoAsesor(e.target.value)} />
                  <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700">Guardar Asesor</button>
                </form>
                <div>
                  <h3 className="font-bold mb-4">Asesores Activos ({asesoresActivos.length})</h3>
                  <ul className="border rounded-xl divide-y max-h-64 overflow-y-auto">
                    {asesoresActivos.map(a => (
                      <li key={a} className="p-3 flex justify-between items-center hover:bg-slate-50">
                        <span className="font-medium">{a}</span>
                        <button onClick={() => eliminarAsesor(a)} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* VISTA: CARGAR / ASIGNAR CITAS (ACTUALIZADA CON DOS OPCIONES) */}
          {vistaActual === 'cargar' && esJefa && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* OPCIÓN 1: MANUAL */}
              <div className="bg-white rounded-2xl p-8 shadow border border-slate-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">UNO A UNO</div>
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 text-slate-800"><PlusCircle className="text-blue-600"/> Registro Manual</h2>
                <p className="text-slate-500 text-sm mb-6">Ingresa una nueva empresa y asígnala directamente a un asesor.</p>
                
                <form onSubmit={guardarCitaManual} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Nombre de la Empresa / Cliente</label>
                    <input type="text" required placeholder="Ej. Constructora Andina" className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formManual.cliente} onChange={e => setFormManual({...formManual, cliente: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Asignar a Asesor</label>
                    <select className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 bg-slate-50" value={formManual.asesor} onChange={e => setFormManual({...formManual, asesor: e.target.value})}>
                      {asesoresActivos.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Notas iniciales (Opcional)</label>
                    <textarea rows="2" placeholder="Ej. Tienen interés en los planes corporativos..." className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formManual.notas} onChange={e => setFormManual({...formManual, notas: e.target.value})}></textarea>
                  </div>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-colors">Guardar y Asignar</button>
                </form>
              </div>

              {/* OPCIÓN 2: EXCEL MASIVO */}
              <div className="bg-slate-50 rounded-2xl p-8 shadow-inner border border-slate-200 text-center flex flex-col justify-center relative overflow-hidden">
                 <div className="absolute top-0 right-0 bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">MASIVO</div>
                <UploadCloud size={50} className="mx-auto text-emerald-600 mb-4" />
                <h2 className="text-2xl font-bold mb-2 text-slate-800">Cargar Excel (CSV)</h2>
                <p className="text-slate-500 mb-6 text-sm">Ideal para la carga del día. Sube un archivo con 2 columnas: "Empresa" y "Asesor".</p>
                <form onSubmit={procesarArchivoCSV} className="max-w-md mx-auto p-6 bg-white border-2 border-dashed border-emerald-300 rounded-xl w-full">
                  <input type="file" id="fileUpload" accept=".csv" required className="w-full mb-4 text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer" />
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold shadow-md shadow-emerald-200">Subir Citas</button>
                </form>
              </div>

            </div>
          )}

          {/* VISTA: MONITOR PRINCIPAL */}
          {vistaActual === 'dashboard' && (
            <div className="space-y-6">
              
              {/* ALARMAS DE 25 DÍAS Y SEGUIMIENTO */}
              {(alarmas.seguimientosUrgentes.length > 0 || (esJefa && alarmas.peligroGps.length > 0)) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {alarmas.seguimientosUrgentes.length > 0 && (
                    <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-5 shadow-sm">
                      <h3 className="text-orange-800 font-bold flex items-center gap-2 mb-3"><Bell className="animate-bounce"/> Visitas para Hoy</h3>
                      <ul className="space-y-2 max-h-32 overflow-y-auto">
                        {alarmas.seguimientosUrgentes.map(c => (
                          <li key={c.id} className="text-sm bg-white p-2 rounded border border-orange-200 flex justify-between">
                            <span className="font-bold">{c.cliente} <span className="font-normal text-slate-500">({esJefa ? c.asesor : c.estado})</span></span>
                            <span className="text-orange-600 font-bold">{c.seguimiento}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {alarmas.peligroGps.length > 0 && esJefa && (
                    <div className="bg-red-50 border-2 border-red-300 rounded-xl p-5 shadow-sm">
                      <h3 className="text-red-800 font-bold flex items-center gap-2 mb-3"><AlertCircle /> Alerta 25 Días (Riesgo GPS)</h3>
                      <ul className="space-y-2 max-h-32 overflow-y-auto">
                        {alarmas.peligroGps.map(c => (
                          <li key={c.id} className="text-sm bg-white p-2 rounded border border-red-200 flex justify-between">
                            <span className="font-bold">{c.cliente}</span>
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-bold">Asesor: {c.asesor}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* ENCABEZADO LISTA DE EMPRESAS Y BOTÓN EXCEL */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-2 gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">{esJefa ? 'Todas las Gestiones' : 'Mis Empresas'}</h2>
                  <span className="bg-slate-200 px-3 py-1 rounded-full text-sm font-bold mt-1 inline-block">{citasFiltradas.length} Registros</span>
                </div>
                {esJefa && (
                  <button onClick={exportarAExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm">
                    <Download size={18} /> Exportar a Excel
                  </button>
                )}
              </div>

              {citasFiltradas.length === 0 ? (
                <div className="bg-white rounded-xl border p-12 text-center text-slate-500"><Search className="mx-auto mb-4 opacity-50" size={40}/> No hay citas para mostrar.</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {citasFiltradas.map(cita => (
                    <div key={cita.id} className={`bg-white border rounded-xl shadow-sm p-4 ${['cierre'].includes(cita.estado) ? 'border-green-400 bg-green-50' : ''}`}>
                      <div className="flex justify-between items-start mb-4 border-b pb-3">
                        <div>
                          <h3 className="font-bold text-lg">{cita.cliente}</h3>
                          <p className="text-xs text-slate-500 mt-1">Creación: {cita.fechaCita}</p>
                        </div>
                        {esJefa && <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold">{cita.asesor}</span>}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Resultado de Visita</label>
                          <select className="w-full p-2 border rounded-lg font-bold text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" value={cita.estado} onChange={(e) => actualizarGestion(cita.id, 'estado', e.target.value)}>
                            {ESTADOS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-blue-700 mb-1 flex items-center gap-1"><Zap size={10}/> Agendar Calendar</label>
                          <input type="date" className="w-full p-2 border border-blue-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 font-bold text-blue-800" value={cita.seguimiento} onChange={(e) => actualizarGestion(cita.id, 'seguimiento', e.target.value)} disabled={['cierre', 'no_cierre'].includes(cita.estado)} />
                        </div>
                      </div>
                      
                      <textarea className="w-full p-3 border rounded-lg text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500" rows="2" placeholder="Escribe los avances de la negociación..." value={cita.notas} onChange={(e) => actualizarGestion(cita.id, 'notas', e.target.value)}></textarea>
                      <p className="text-[10px] text-slate-400 mt-1 text-right">Última edición: {cita.ultimaModificacion}</p>
                      
                      {esJefa && <button onClick={() => eliminarCita(cita.id)} className="text-red-500 text-xs font-bold mt-2 hover:underline"><Trash2 size={12} className="inline mr-1"/>Borrar Empresa</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}