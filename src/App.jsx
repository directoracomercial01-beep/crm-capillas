import React, { useState, useMemo, useEffect } from 'react';
import { 
  UploadCloud, Calendar, Search, 
  AlertCircle, Zap, Activity, Settings, Trash2, Bell, Download, 
  PlusCircle, X, ChevronRight, ChevronLeft, CheckCircle, Clock, Mail, CheckSquare, 
  User, ListTodo, BarChart3, TrendingUp, PieChart, Lock
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';

// =====================================================================
// ⚠️ CABLE 1: AQUÍ VAN TUS LLAVES DE FIREBASE
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
// ⚠️ CABLE 2: AQUÍ VA EL LINK DE ZAPIER
// =====================================================================
const LINK_WEBHOOK_ZAPIER = "https://hooks.zapier.com/hooks/catch/26692144/u07hskk"

// =====================================================================
// 🔒 CABLE 3: TU CLAVE DE SEGURIDAD (Cámbiala por la que quieras)
// =====================================================================
const PIN_SECRETO = "654321";

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
  { id: 'reagendar', label: 'Devuelto al Call (Revisión Jefa)', color: 'bg-orange-100 text-orange-800' }
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
  
  const [citaSeleccionada, setCitaSeleccionada] = useState(null);
  const [formManual, setFormManual] = useState({ cliente: '', asesor: ASESORES_INICIALES[0], notas: '', fechaVisita: getHoy() });

  // ESTADOS PARA EL CALENDARIO
  const [mesCalendario, setMesCalendario] = useState(new Date().getMonth());
  const [anioCalendario, setAnioCalendario] = useState(new Date().getFullYear());

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
      console.error("Error Firebase", error);
      setCargando(false);
    });
    return () => unsubscribe();
  }, [user]);

  const esJefa = usuarioActual === JEFA.nombre;
  const usuariosDisponibles = useMemo(() => [JEFA.nombre, ...asesoresActivos], [asesoresActivos]);

  const citasFiltradas = useMemo(() => {
    let filtradas = citas;
    if (!esJefa) {
      filtradas = filtradas.filter(c => c.asesor === usuarioActual && c.estado !== 'reagendar');
    }
    if (terminoBusqueda) {
      const b = terminoBusqueda.toLowerCase();
      filtradas = filtradas.filter(c => c.cliente.toLowerCase().includes(b) || (c.fechaVisita && c.fechaVisita.includes(b)));
    }
    return filtradas;
  }, [citas, usuarioActual, esJefa, terminoBusqueda]);

  const alarmas = useMemo(() => {
    const hoy = getHoy();
    const seguimientosUrgentes = citasFiltradas.filter(c => 
      ((c.fechaVisita && c.fechaVisita <= hoy && c.estado === 'asignada') || 
      (c.seguimiento && c.seguimiento <= hoy)) && 
      !['cierre', 'no_cierre'].includes(c.estado)
    );
    const peligroGps = citasFiltradas.filter(c => {
      if (['cierre', 'no_cierre', 'reagendar'].includes(c.estado)) return false;
      return new Date(c.fechaAsignacion) <= new Date(restarDias(hoy, 25));
    });
    return { seguimientosUrgentes, peligroGps };
  }, [citasFiltradas]);

  const agendaAgrupada = useMemo(() => {
    const grupos = {};
    citasFiltradas.forEach(cita => {
      if (['cierre', 'no_cierre', 'reagendar'].includes(cita.estado)) return;
      const fechaClave = cita.seguimiento || cita.fechaVisita || 'Sin Fecha';
      if (!grupos[fechaClave]) grupos[fechaClave] = [];
      grupos[fechaClave].push(cita);
    });
    const fechasOrdenadas = Object.keys(grupos).sort((a, b) => {
      if (a === 'Sin Fecha') return 1;
      if (b === 'Sin Fecha') return -1;
      return new Date(a) - new Date(b);
    });
    return { grupos, fechasOrdenadas };
  }, [citasFiltradas]);

  const metricasAsesores = useMemo(() => {
    return asesoresActivos.map(asesor => {
      const citasDelAsesor = citas.filter(c => c.asesor === asesor && c.estado !== 'reagendar');
      const total = citasDelAsesor.length;
      const nuevas = citasDelAsesor.filter(c => c.estado === 'asignada').length;
      const seguimientos = citasDelAsesor.filter(c => c.estado === 'seguimiento').length;
      const cierres = citasDelAsesor.filter(c => c.estado === 'cierre').length;
      const perdidas = citasDelAsesor.filter(c => c.estado === 'no_cierre').length;
      
      // MAGIA: Aquí contamos las propuestas enviadas
      const propuestas = citasDelAsesor.filter(c => c.propuestaEnviada).length;

      const efectividad = total === 0 ? 0 : Math.round((cierres / total) * 100);
      return { asesor, total, nuevas, seguimientos, propuestas, cierres, perdidas, efectividad };
    }).sort((a, b) => b.efectividad - a.efectividad); 
  }, [citas, asesoresActivos]);

  const mostrarNotificacion = (mensaje, tiempo = 4000) => { setNotificacion(mensaje); setTimeout(() => setNotificacion(null), tiempo); };

  const manejarCambioUsuario = (nuevoUsuario) => {
    if (nuevoUsuario === JEFA.nombre) {
      const intento = window.prompt("🔒 Acceso Restringido a Jefatura.\n\nPor favor, ingrese el PIN de seguridad:");
      if (intento !== PIN_SECRETO) {
        alert("❌ PIN Incorrecto. Acceso denegado.");
        return; 
      }
    }
    setUsuarioActual(nuevoUsuario);
    setVistaActual('dashboard');
    setCitaSeleccionada(null);
  };

  const notificarAZapier = async (cita) => {
    mostrarNotificacion(`⚡ Avisando a Zapier para agendar en el Google Calendar de ${cita.asesor}...`);
    try {
      if(LINK_WEBHOOK_ZAPIER !== "PIDELE_A_ZAPIER_ESTE_LINK_Y_PEGALO_AQUI") {
        const tituloParaCalendario = `${cita.asesor} - ${cita.cliente}`; 
        const horaInicio7AM = `${cita.seguimiento}T07:00:00-05:00`; 
        const horaFin8AM = `${cita.seguimiento}T08:00:00-05:00`;

        const datosParaZapier = {
          ...cita,
          zapierTitulo: tituloParaCalendario,
          zapierInicio: horaInicio7AM,
          zapierFin: horaFin8AM
        };

        await fetch(LINK_WEBHOOK_ZAPIER, { method: 'POST', body: JSON.stringify(datosParaZapier) });
        mostrarNotificacion(`✅ Zapier completó la tarea. Copia enviada al calendario.`);
      } else {
        mostrarNotificacion("⚠️ Falta pegar el link de Zapier en la línea 32.");
      }
    } catch (e) { 
      console.error("Error al conectar Zapier:", e); 
      mostrarNotificacion("❌ Error al conectar con Zapier.");
    }
  };

  const exportarAExcel = () => {
    const encabezados = ['Empresa', 'Asesor', 'Estado Actual', 'Fecha Asignacion', 'Fecha Programada Visita', 'Fecha Siguiente Seguimiento', 'Notas / Avances', 'Propuesta Enviada', 'Correo de Propuesta'];
    const filas = citasFiltradas.map(c => [
      `"${c.cliente}"`, `"${c.asesor}"`, `"${ESTADOS.find(e => e.id === c.estado)?.label || c.estado}"`, `"${c.fechaAsignacion}"`, `"${c.fechaVisita}"`, `"${c.seguimiento}"`, `"${(c.notas || '').replace(/"/g, '""')}"`, `"${c.propuestaEnviada ? 'SI' : 'NO'}"`, `"${c.correoPropuesta || ''}"`
    ]);
    const csvContent = [encabezados.join(','), ...filas.map(f => f.join(','))].join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); 
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Reporte_Capillas_${getHoy()}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    mostrarNotificacion("📊 Reporte descargado exitosamente.");
  };

  const guardarCitaManual = async (e) => {
    e.preventDefault();
    if (!formManual.cliente.trim() || !formManual.asesor) return;
    mostrarNotificacion("⏳ Registrando empresa manualmente...");
    
    const nuevaCita = {
      cliente: formManual.cliente.trim(), asesor: formManual.asesor, estado: 'asignada',
      fechaAsignacion: getHoy(), fechaVisita: formManual.fechaVisita, seguimiento: '',
      notas: formManual.notas.trim(), propuestaEnviada: false, correoPropuesta: '',
      ultimaModificacion: getHoy(), createdAt: Date.now()
    };
    
    try {
      await addDoc(collection(db, 'citas_comerciales'), nuevaCita);
      mostrarNotificacion(`✅ Empresa ${nuevaCita.cliente} agendada para el ${nuevaCita.fechaVisita}.`);
      setFormManual({ cliente: '', asesor: asesoresActivos[0], notas: '', fechaVisita: getHoy() }); 
    } catch (e) { console.error(e); alert("Error al guardar."); }
  };

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
          let fechaProgramada = getHoy();
          if (columnas.length >= 3 && columnas[2].trim() !== '') {
            fechaProgramada = columnas[2].trim();
          }
          const nuevaCita = {
            cliente: columnas[0].trim(), asesor: columnas[1].trim(), estado: 'asignada', 
            fechaAsignacion: getHoy(), fechaVisita: fechaProgramada, seguimiento: '', 
            notas: '', propuestaEnviada: false, correoPropuesta: '', 
            ultimaModificacion: getHoy(), createdAt: Date.now() + i
          };
          try { await addDoc(collection(db, 'citas_comerciales'), nuevaCita); cargadas++; } catch (e) { console.error(e); }
        }
      }
      mostrarNotificacion(`✅ ${cargadas} clientes cargados por Excel exitosamente.`);
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

      if (campo === 'estado' && valor === 'reagendar') {
        setCitaSeleccionada(null);
        mostrarNotificacion("⏳ Empresa devuelta. Esperando revisión de Jefatura.");
      }
    } catch (e) { alert("Error al guardar."); }
  };

  const eliminarCita = async (id) => { 
    const intento = window.prompt("🔒 Acción de Jefatura.\n\nIngresa tu PIN de seguridad para borrar esta empresa definitivamente:");
    if (intento === PIN_SECRETO) {
      if(window.confirm("PIN Correcto. ¿Confirmas la eliminación permanente?")) {
        try {
          await deleteDoc(doc(db, 'citas_comerciales', id)); 
          setCitaSeleccionada(null); 
          mostrarNotificacion("🗑️ Empresa eliminada de la base de datos.");
        } catch(e) { alert("Error al eliminar"); }
      }
    } else if (intento !== null) {
      alert("❌ PIN Incorrecto. Operación cancelada.");
    }
  };
  
  const agregarAsesor = (e) => { e.preventDefault(); if (nuevoAsesor.trim() && !asesoresActivos.includes(nuevoAsesor)) { setAsesoresActivos([...asesoresActivos, nuevoAsesor.trim()]); setNuevoAsesor(""); mostrarNotificacion("✅ Asesor agregado."); } };
  const eliminarAsesor = (nombre) => { if (window.confirm(`¿Desactivar a ${nombre}?`)) setAsesoresActivos(asesoresActivos.filter(a => a !== nombre)); };

  const obtenerEtiquetaVisual = (cita) => {
    if (['cierre', 'no_cierre'].includes(cita.estado)) return { text: 'Finalizada', color: 'bg-gray-100 text-gray-500 border-gray-200' };
    if (cita.estado === 'reagendar') return { text: 'Revisión Pendiente', color: 'bg-orange-100 text-orange-800' };
    const hoy = getHoy();
    const fechaClave = cita.seguimiento || cita.fechaVisita;
    if (!fechaClave) return { text: 'Sin Fecha', color: 'bg-slate-100 text-slate-600 border-slate-200' };
    if (fechaClave < hoy) return { text: '¡Vencida!', color: 'bg-red-50 text-red-700 border-red-200 animate-pulse' };
    if (fechaClave === hoy) return { text: 'Para Hoy', color: 'bg-yellow-50 text-yellow-700 border-yellow-300' };
    return { text: 'A tiempo', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  };

  const TarjetaEmpresa = ({ cita, etiqueta }) => (
    <div className={`bg-white border rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden ${cita.estado === 'reagendar' ? 'border-orange-300 ring-2 ring-orange-100' : 'border-slate-200'}`}>
      <div className="p-5 flex-grow">
        <div className="flex justify-between items-start mb-2">
          <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${etiqueta.color}`}>{etiqueta.text}</span>
          {esJefa && <span className="text-xs font-bold text-slate-400"><User size={12} className="inline mr-1"/>{cita.asesor}</span>}
        </div>
        {new Date(cita.fechaAsignacion) <= new Date(restarDias(getHoy(), 25)) && !['cierre', 'no_cierre', 'reagendar'].includes(cita.estado) && (
          <div className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded mb-2 flex items-center gap-1 w-max animate-pulse">
            <AlertCircle size={12}/> ¡GPS en Riesgo (+25 Días)!
          </div>
        )}
        <h3 className="font-bold text-lg text-slate-800 mb-1 truncate" title={cita.cliente}>{cita.cliente}</h3>
        <div className="text-xs text-slate-500 space-y-1">
          <p><Clock size={12} className="inline mr-1"/> Agendada para: <strong className="text-slate-700">{cita.seguimiento || cita.fechaVisita}</strong></p>
          <p>Estado: {ESTADOS.find(e => e.id === cita.estado)?.label}</p>
          {cita.propuestaEnviada && (
            <p className="text-emerald-600 font-bold flex items-center gap-1 mt-1 bg-emerald-50 px-2 py-1 rounded w-max"><CheckSquare size={12}/> Propuesta Enviada</p>
          )}
        </div>
      </div>
      <button onClick={() => setCitaSeleccionada(cita.id)} className="w-full bg-slate-50 hover:bg-blue-50 text-blue-700 font-bold py-3 text-sm border-t border-slate-100 transition-colors flex justify-center items-center gap-1">
        {cita.estado === 'reagendar' ? 'Revisar Devolución' : 'Gestionar Visita'} <ChevronRight size={16}/>
      </button>
    </div>
  );

  if (cargando) return <div className="min-h-screen flex items-center justify-center font-bold text-blue-800">Cargando Motor CRM Capillas de la Fe...</div>;

  const citaActiva = citas.find(c => c.id === citaSeleccionada);

  const diasDelMes = new Date(anioCalendario, mesCalendario + 1, 0).getDate();
  const primerDiaDelMes = new Date(anioCalendario, mesCalendario, 1).getDay();
  const dias = Array.from({length: diasDelMes}, (_, i) => i + 1);
  const espacios = Array.from({length: primerDiaDelMes}, (_, i) => i);
  const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const cambiarMes = (direccion) => {
    let nuevoMes = mesCalendario + direccion;
    let nuevoAnio = anioCalendario;
    if (nuevoMes > 11) { nuevoMes = 0; nuevoAnio++; }
    if (nuevoMes < 0) { nuevoMes = 11; nuevoAnio--; }
    setMesCalendario(nuevoMes);
    setAnioCalendario(nuevoAnio);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 pb-10">
      
      <div className="bg-slate-900 text-white p-2 flex justify-between items-center text-sm px-6">
        <span className="font-medium text-slate-400">Panel de Control Interno</span>
        <div className="flex items-center gap-2">
          <span>Ver como:</span>
          <select 
            className="bg-slate-800 border border-slate-700 rounded px-3 py-1 text-white font-bold outline-none" 
            value={usuarioActual} 
            onChange={(e) => manejarCambioUsuario(e.target.value)}
          >
            <option value={JEFA.nombre}>🔒 {JEFA.nombre} (Jefatura)</option>
            <optgroup label="Asesores (Público)">
              {asesoresActivos.map(u => <option key={u} value={u}>{u}</option>)}
            </optgroup>
          </select>
        </div>
      </div>

      <nav className="bg-blue-800 text-white p-4 shadow-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Activity className="text-blue-300" size={32} />
            <h1 className="text-xl font-bold">CAPILLAS DE LA FE <span className="font-light text-blue-300">| Hub Comercial</span></h1>
          </div>
          <div className="relative w-full md:w-96">
            <input type="text" placeholder="Buscar empresa..." className="w-full bg-blue-900 border border-blue-700 rounded-full py-2 pl-10 pr-4 text-white placeholder-blue-300 outline-none" value={terminoBusqueda} onChange={(e) => setTerminoBusqueda(e.target.value)} />
            <Search className="absolute left-3 top-2.5 text-blue-300" size={18} />
          </div>
          <div className="hidden md:flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold flex items-center gap-1 justify-end">
                {esJefa && <Lock size={12} className="text-blue-300"/>} {usuarioActual}
              </p>
              <p className="text-xs text-blue-300">{esJefa ? JEFA.rol : 'Asesor Comercial'}</p>
            </div>
          </div>
        </div>
      </nav>

      {notificacion && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold z-50 animate-bounce">
          {notificacion}
        </div>
      )}

      <div className="flex flex-col md:flex-row max-w-7xl mx-auto w-full mt-6 gap-6 px-4">
        
        <aside className="w-full md:w-64 flex flex-col gap-2 shrink-0">
          <button onClick={() => setVistaActual('dashboard')} className={`p-3 rounded-xl font-bold flex items-center gap-3 transition-all ${vistaActual === 'dashboard' ? 'bg-blue-100 text-blue-800 shadow border border-blue-200' : 'bg-white hover:bg-slate-100 shadow-sm border border-slate-200'}`}><Activity size={20}/> Monitor General</button>
          
          <button onClick={() => setVistaActual('agenda')} className={`p-3 rounded-xl font-bold flex items-center gap-3 transition-all ${vistaActual === 'agenda' ? 'bg-blue-100 text-blue-800 shadow border border-blue-200' : 'bg-white hover:bg-slate-100 shadow-sm border border-slate-200'}`}><ListTodo size={20}/> Mi Agenda</button>

          {esJefa && (
            <>
              <button onClick={() => setVistaActual('metricas')} className={`p-3 rounded-xl font-bold flex items-center gap-3 transition-all ${vistaActual === 'metricas' ? 'bg-blue-100 text-blue-800 shadow border border-blue-200' : 'bg-white hover:bg-slate-100 shadow-sm border border-slate-200'}`}><BarChart3 size={20}/> Reportes y Métricas</button>
              
              <button onClick={() => setVistaActual('cargar')} className={`p-3 rounded-xl font-bold flex items-center gap-3 transition-all ${vistaActual === 'cargar' ? 'bg-blue-100 text-blue-800 shadow border border-blue-200' : 'bg-white hover:bg-slate-100 shadow-sm border border-slate-200'}`}><UploadCloud size={20}/> Asignar Citas</button>
              <button onClick={() => setVistaActual('config')} className={`p-3 rounded-xl font-bold flex items-center gap-3 transition-all ${vistaActual === 'config' ? 'bg-blue-100 text-blue-800 shadow border border-blue-200' : 'bg-white hover:bg-slate-100 shadow-sm border border-slate-200'}`}><Settings size={20}/> Equipo y Asesores</button>
            </>
          )}

          <div className="mt-4 p-4 bg-slate-800 rounded-xl text-xs text-slate-300 shadow-lg">
            <p className="font-bold mb-2 flex items-center gap-1 text-white"><Zap size={16} className="text-yellow-400"/> Sistema Inteligente</p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2"><CheckCircle size={12} className="text-emerald-400"/> Etiquetas de atrasos</li>
              <li className="flex items-center gap-2"><CheckCircle size={12} className="text-emerald-400"/> Sincroniza Calendar</li>
              <li className="flex items-center gap-2"><CheckCircle size={12} className="text-emerald-400"/> Alerta 25 días (GPS)</li>
            </ul>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          
          {vistaActual === 'metricas' && esJefa && (
             <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
               <div className="flex items-center gap-3 mb-6 border-b pb-4">
                 <div className="bg-blue-100 p-3 rounded-full"><TrendingUp className="text-blue-600" size={24}/></div>
                 <div>
                    <h2 className="text-2xl font-bold text-slate-800">Rendimiento Comercial</h2>
                    <p className="text-sm text-slate-500">Métricas en tiempo real de tu equipo de asesores.</p>
                 </div>
               </div>

               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="bg-slate-50 text-slate-600 text-sm uppercase tracking-wider border-b border-slate-200">
                       <th className="p-4 font-bold rounded-tl-xl">Asesor</th>
                       <th className="p-4 font-bold text-center">Total Asignadas</th>
                       <th className="p-4 font-bold text-center">Nuevas</th>
                       <th className="p-4 font-bold text-center">En Seguimiento</th>
                       <th className="p-4 font-bold text-center text-purple-600">Propuestas</th>
                       <th className="p-4 font-bold text-center text-red-600">Perdidas</th>
                       <th className="p-4 font-bold text-center text-emerald-600">Cierres</th>
                       <th className="p-4 font-bold text-center rounded-tr-xl">% Efectividad</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {metricasAsesores.map((metrica, index) => (
                       <tr key={metrica.asesor} className="hover:bg-slate-50 transition-colors">
                         <td className="p-4 font-bold text-slate-800 flex items-center gap-2">
                           <span className="text-slate-400 text-xs">#{index + 1}</span> {metrica.asesor}
                         </td>
                         <td className="p-4 text-center font-medium text-slate-600">{metrica.total}</td>
                         <td className="p-4 text-center font-medium text-blue-600 bg-blue-50/50">{metrica.nuevas}</td>
                         <td className="p-4 text-center font-medium text-yellow-600 bg-yellow-50/50">{metrica.seguimientos}</td>
                         <td className="p-4 text-center font-bold text-purple-600 bg-purple-50/50">{metrica.propuestas}</td>
                         <td className="p-4 text-center font-medium text-red-500">{metrica.perdidas}</td>
                         <td className="p-4 text-center font-bold text-emerald-600 bg-emerald-50/50">{metrica.cierres}</td>
                         <td className="p-4 text-center">
                           <div className="flex items-center justify-center gap-2">
                             <div className="w-full bg-slate-200 rounded-full h-2.5 max-w-[60px]">
                               <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${metrica.efectividad}%` }}></div>
                             </div>
                             <span className="font-bold text-slate-700 text-sm">{metrica.efectividad}%</span>
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
               <div className="mt-6 bg-slate-50 p-4 rounded-xl text-sm text-slate-500 flex items-start gap-2 border border-slate-200">
                 <PieChart size={18} className="shrink-0 text-slate-400"/>
                 <p><strong>Nota:</strong> El % de Efectividad se calcula dividiendo Cierres entre Total de Asignadas. (Las empresas Devueltas al Call Center se descuentan automáticamente y no penalizan al asesor).</p>
               </div>
             </div>
          )}

          {vistaActual === 'agenda' && (
             <div className="space-y-8">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-4 gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Agenda de Trabajo</h2>
                    <p className="text-sm text-slate-500">
                      {esJefa ? `Viendo los compromisos de: ${usuarioActual}` : 'Tus próximos seguimientos organizados por fecha.'}
                    </p>
                  </div>
               </div>

               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-800 capitalize">{nombresMeses[mesCalendario]} {anioCalendario}</h3>
                    <div className="flex gap-2">
                       <button onClick={() => cambiarMes(-1)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"><ChevronLeft size={20}/></button>
                       <button onClick={() => cambiarMes(1)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"><ChevronRight size={20}/></button>
                    </div>
                 </div>
                 <div className="grid grid-cols-7 gap-2 text-center">
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => <div key={d} className="font-bold text-slate-400 text-xs py-2 uppercase tracking-wider">{d}</div>)}
                    {espacios.map(e => <div key={`espacio-${e}`} className="p-2"></div>)}
                    {dias.map(dia => {
                       const fechaStr = `${anioCalendario}-${String(mesCalendario+1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                       const citasDelDia = agendaAgrupada.grupos[fechaStr];
                       const esHoy = fechaStr === getHoy();

                       return (
                          <div key={dia} className={`p-2 rounded-xl border ${esHoy ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-slate-50'} min-h-[70px] flex flex-col items-center justify-start relative transition-all hover:shadow-md`}>
                             <span className={`text-sm font-bold ${esHoy ? 'text-blue-700' : 'text-slate-700'}`}>{dia}</span>
                             {citasDelDia && (
                                <div className="mt-auto mb-1 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm w-[90%] truncate">
                                   {citasDelDia.length} citas
                                </div>
                             )}
                          </div>
                       )
                    })}
                 </div>
               </div>

               {agendaAgrupada.fechasOrdenadas.length === 0 ? (
                 <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-16 text-center text-slate-500">
                   <Calendar className="mx-auto mb-4 opacity-30" size={60}/> 
                   <h3 className="text-xl font-bold text-slate-700 mb-1">Agenda Despejada</h3>
                   <p>No hay seguimientos ni visitas programadas pendientes.</p>
                 </div>
               ) : (
                 agendaAgrupada.fechasOrdenadas.map(fecha => {
                   const citasDelDia = agendaAgrupada.grupos[fecha];
                   
                   let estiloCabecera = "bg-slate-200 text-slate-700";
                   let iconoCabecera = <Calendar size={18} />;
                   let textoFecha = fecha;

                   if (fecha !== 'Sin Fecha') {
                     if (fecha < getHoy()) {
                       estiloCabecera = "bg-red-100 text-red-800 border-l-4 border-red-500";
                       textoFecha = `${fecha} (Atrasado)`;
                       iconoCabecera = <AlertCircle size={18} />;
                     } else if (fecha === getHoy()) {
                       estiloCabecera = "bg-yellow-100 text-yellow-800 border-l-4 border-yellow-500 font-bold";
                       textoFecha = `HOY - ${fecha}`;
                       iconoCabecera = <Zap size={18} className="text-yellow-600"/>;
                     } else {
                       estiloCabecera = "bg-blue-50 text-blue-800 border-l-4 border-blue-500";
                     }
                   }

                   return (
                     <div key={fecha} className="mb-8">
                       <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 ${estiloCabecera}`}>
                         {iconoCabecera}
                         <h3 className="text-lg font-bold">{textoFecha}</h3>
                         <span className="ml-auto bg-white/50 px-2 py-1 rounded text-xs font-bold">{citasDelDia.length} tareas</span>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                         {citasDelDia.map(cita => (
                           <TarjetaEmpresa key={cita.id} cita={cita} etiqueta={obtenerEtiquetaVisual(cita)} />
                         ))}
                       </div>
                     </div>
                   );
                 })
               )}
             </div>
          )}

          {vistaActual === 'config' && esJefa && (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
              <h2 className="text-2xl font-bold border-b pb-4 mb-6">Gestión de Asesores</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <form onSubmit={agregarAsesor} className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                  <h3 className="font-bold mb-4">Agregar Nuevo Asesor</h3>
                  <input type="text" required placeholder="Nombre completo" className="w-full p-3 border rounded-lg mb-3" value={nuevoAsesor} onChange={e => setNuevoAsesor(e.target.value)} />
                  <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700">Guardar Asesor</button>
                </form>
                <div>
                  <h3 className="font-bold mb-4">Asesores Activos ({asesoresActivos.length})</h3>
                  <ul className="border rounded-xl divide-y max-h-64 overflow-y-auto bg-white">
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

          {vistaActual === 'cargar' && esJefa && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">UNO A UNO</div>
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 text-slate-800"><PlusCircle className="text-blue-600"/> Agendar Visita</h2>
                <p className="text-slate-500 text-sm mb-6">Asigna una empresa y la fecha exacta en la que el asesor debe ir.</p>
                
                <form onSubmit={guardarCitaManual} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Empresa / Cliente</label>
                    <input type="text" required placeholder="Ej. Constructora Andina" className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formManual.cliente} onChange={e => setFormManual({...formManual, cliente: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Asesor</label>
                      <select className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 bg-slate-50" value={formManual.asesor} onChange={e => setFormManual({...formManual, asesor: e.target.value})}>
                        {asesoresActivos.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Fecha de Visita</label>
                      <input type="date" required className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold text-blue-700 bg-blue-50" value={formManual.fechaVisita} onChange={e => setFormManual({...formManual, fechaVisita: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Notas (Opcional)</label>
                    <textarea rows="2" placeholder="Ej. Preguntar por el Gerente..." className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formManual.notas} onChange={e => setFormManual({...formManual, notas: e.target.value})}></textarea>
                  </div>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-colors shadow-md shadow-blue-200">Agendar Cita</button>
                </form>
              </div>

              <div className="bg-slate-50 rounded-2xl p-8 shadow-inner border border-slate-200 text-center flex flex-col justify-center relative overflow-hidden">
                 <div className="absolute top-0 right-0 bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">MASIVO</div>
                <UploadCloud size={50} className="mx-auto text-emerald-600 mb-4" />
                <h2 className="text-2xl font-bold mb-2 text-slate-800">Carga Rápida (CSV)</h2>
                <p className="text-slate-500 mb-6 text-sm">
                  Sube un archivo con 3 columnas: <strong>Empresa</strong>, <strong>Asesor</strong> y <strong>Fecha</strong> (Formato: YYYY-MM-DD). Si dejas la fecha en blanco, se agendará para hoy por defecto.
                </p>
                <form onSubmit={procesarArchivoCSV} className="max-w-md mx-auto p-6 bg-white border-2 border-dashed border-emerald-300 rounded-xl w-full">
                  <input type="file" id="fileUpload" accept=".csv" required className="w-full mb-4 text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer" />
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold shadow-md shadow-emerald-200">Subir Citas</button>
                </form>
              </div>
            </div>
          )}

          {vistaActual === 'dashboard' && (
            <div className="space-y-6">
              {(alarmas.seguimientosUrgentes.length > 0 || (esJefa && alarmas.peligroGps.length > 0)) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {alarmas.seguimientosUrgentes.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 shadow-sm">
                      <h3 className="text-orange-800 font-bold flex items-center gap-2 mb-2"><Bell size={18} className="animate-bounce"/> Visitas Vencidas o Para Hoy</h3>
                      <p className="text-xs text-orange-600 mb-2">Tienen visitas programadas o seguimientos que requieren atención inmediata.</p>
                    </div>
                  )}
                  {alarmas.peligroGps.length > 0 && esJefa && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
                      <h3 className="text-red-800 font-bold flex items-center gap-2 mb-2"><AlertCircle size={18}/> Alerta 25 Días (Riesgo GPS)</h3>
                      <p className="text-xs text-red-600 mb-2">Empresas sin movimiento reciente que podrían perderse en el GPS general.</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-2 gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">{esJefa ? 'Monitor General' : 'Todas mis empresas'}</h2>
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold mt-1 inline-block">Lista Completa ({citasFiltradas.length})</span>
                </div>
                {esJefa && (
                  <button onClick={exportarAExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm">
                    <Download size={18} /> Exportar a Excel
                  </button>
                )}
              </div>

              {citasFiltradas.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-16 text-center text-slate-500">
                  <Activity className="mx-auto mb-4 opacity-30" size={60}/> 
                  <h3 className="text-xl font-bold text-slate-700 mb-1">Tu lista está limpia</h3>
                  <p>No hay empresas pendientes por mostrar en este momento.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {citasFiltradas.map(cita => (
                    <TarjetaEmpresa key={cita.id} cita={cita} etiqueta={obtenerEtiquetaVisual(cita)} />
                  ))}
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {citaActiva && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-blue-800 text-white rounded-t-3xl">
              <div>
                <span className="bg-blue-700 text-blue-100 text-[10px] uppercase font-bold px-2 py-1 rounded">Expediente Comercial</span>
                <h2 className="text-2xl font-bold mt-2 leading-tight">{citaActiva.cliente}</h2>
                <p className="text-sm text-blue-200 mt-1">Asesor: {citaActiva.asesor}</p>
              </div>
              <button onClick={() => setCitaSeleccionada(null)} className="text-blue-200 hover:text-white bg-blue-900 rounded-full p-2 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Resultado de Visita</label>
                  <select 
                    className="w-full p-3 border border-slate-200 rounded-xl font-bold text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" 
                    value={citaActiva.estado} 
                    onChange={(e) => actualizarGestion(citaActiva.id, 'estado', e.target.value)}
                  >
                    {ESTADOS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-600 mb-1 uppercase flex items-center gap-1"><Calendar size={12}/> Reprogramar Visita</label>
                  <input 
                    type="date" 
                    className="w-full p-3 border border-blue-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 font-bold text-blue-800 bg-blue-50 transition-all" 
                    value={citaActiva.fechaVisita} 
                    onChange={(e) => {
                      actualizarGestion(citaActiva.id, 'fechaVisita', e.target.value);
                      actualizarGestion(citaActiva.id, 'seguimiento', e.target.value);
                    }} 
                    disabled={['cierre', 'no_cierre'].includes(citaActiva.estado)} 
                  />
                  <p className="text-[10px] text-slate-400 mt-1 leading-tight">Cambiar la fecha actualiza la tarjeta y avisa a Zapier.</p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer mb-3">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    checked={citaActiva.propuestaEnviada || false}
                    onChange={(e) => actualizarGestion(citaActiva.id, 'propuestaEnviada', e.target.checked)}
                  />
                  ¿Se envió propuesta formal?
                </label>
                
                {citaActiva.propuestaEnviada && (
                  <div className="animate-fade-in">
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase flex items-center gap-1"><Mail size={12}/> Correo al que se envió</label>
                    <input 
                      type="email" 
                      placeholder="ejemplo@empresa.com"
                      className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                      value={citaActiva.correoPropuesta || ''} 
                      onChange={(e) => actualizarGestion(citaActiva.id, 'correoPropuesta', e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Bitácora / Avances de la negociación</label>
                <textarea 
                  className="w-full p-4 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                  rows="4" 
                  placeholder="¿Qué conversaron? ¿Qué falta para el cierre?" 
                  value={citaActiva.notas} 
                  onChange={(e) => actualizarGestion(citaActiva.id, 'notas', e.target.value)}
                ></textarea>
              </div>

              {esJefa && (
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                   <button onClick={() => eliminarCita(citaActiva.id)} className="text-red-500 text-sm font-bold flex items-center gap-1 hover:text-red-700 bg-red-50 px-3 py-2 rounded-lg">
                     <Trash2 size={16}/> Borrar Empresa
                   </button>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-3xl flex justify-between items-center">
              <span className="text-[10px] text-slate-400 flex items-center gap-1"><CheckCircle size={12}/> Guardado automático en Firebase</span>
              <button 
                onClick={() => setCitaSeleccionada(null)} 
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-8 rounded-xl transition-transform transform hover:scale-105 shadow-lg"
              >
                Cerrar Panel
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}