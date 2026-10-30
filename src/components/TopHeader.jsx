import React from 'react';
import { useApp } from '../context/AppContext';
import { NAV_ITEMS, NAV_TONES } from './navigation/navConfig';
import { useNotifications } from '../context/NotificationsContext';
import { Menu, Building2, Sparkles, Bell, Mic, Calculator, LogOut } from 'lucide-react';

// Título y descripción largos de cada módulo (el icono y el color salen de navConfig).
const TAB_TEXT = {
  dashboard: { title: 'Panel General', desc: 'Visión ejecutiva de obras, tesorería y avance operativo' },
  obras: { title: 'Obras y Reformas', desc: 'Gestión de proyectos, fases constructivas, partes diarios y costes' },
  avance: { title: 'Avance de Obra', desc: 'Asignaciones por partida, avance real y certificación' },
  avisos: { title: 'Avisos, Necesidades y Pedidos', desc: 'Avisos de obra en tiempo real, pedidos de material a proveedores y enlaces para subcontratas' },
  inbox: { title: 'Bandeja Audio / Email IA', desc: 'Captura por voz de visitas de obra y correos de clientes procesados con IA' },
  presupuestos: { title: 'Presupuestos & Mediciones IA', desc: 'Creación automática de partidas, capítulos e importes vinculados a obra', special: true },
  facturas: { title: 'Facturación & Certificaciones', desc: 'Facturas emitidas a clientes, facturas recibidas y certificaciones por avance' },
  gestoria: { title: 'Gestoría & Trimestres AEAT', desc: 'Estimación trimestral Modelos 303 (IVA) y 130 (IRPF), retenciones y balances' },
  obreros: { title: 'RRHH, Plantilla & Nóminas', desc: 'Fichas de operarios, confección de nóminas, categorías y accesos PWA' },
  subcontratas: { title: 'Subcontratas & Homologación PRL', desc: 'Presupuestos comparativos, asignación a partidas y scoring de proveedores' },
  portal_obrero: { title: 'Simulador Portal Obrero (PWA)', desc: 'Vista previa de la interfaz móvil que utilizan los operarios en pie de obra' },
  empresa_config: { title: 'Ajustes de Empresa & Motor IA', desc: 'Datos fiscales de cabecera, API Key de Inteligencia Artificial y usuarios' }
};

function saludo() {
  const h = new Date().getHours();
  if (h < 14) return 'Buenos días';
  if (h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function TopHeader({ onOpenMobileMenu = () => {} }) {
  const { activeTab, setActiveTab, currentUser, logout, obras, mensajesInbox } = useApp();
  const { unreadCount, available: avisosAvailable } = useNotifications();

  const navItem = NAV_ITEMS.find(i => i.id === activeTab);
  let text = TAB_TEXT[activeTab] || { title: 'ObraMaster', desc: 'Gestión integral para construcción y reformas' };
  // En el Panel General la cabecera hace de bienvenida: saludo y resumen del día.
  const isDashboard = activeTab === 'dashboard';
  if (isDashboard) {
    const enCurso = (obras || []).filter(o => o.estado === 'en_curso').length;
    const pendientes = (mensajesInbox || []).filter(m => !m.estadoProcesado).length;
    text = {
      title: `${saludo()}, ${currentUser?.fullName || 'Administrador'}`,
      desc: `Panel General · ${enCurso} obras en ejecución y ${pendientes} audios/mensajes de obra pendientes de procesar`
    };
  }
  const Icon = navItem?.icon || Building2;
  const tone = NAV_TONES[navItem?.tone || 'amber'];
  const avisosLabel = unreadCount ? `${unreadCount} avisos sin leer` : 'Avisos';
  const userName = currentUser?.fullName || 'Administrador';
  const initial = userName.charAt(0).toUpperCase();
  const roleLabel = currentUser?.role === 'admin' ? 'Director de obra' : currentUser?.role || 'Admin';

  const handleLogout = () => {
    if (window.confirm('¿Deseas cerrar la sesión del panel administrativo?')) logout();
  };

  return (
    <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-3">
      <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto w-full">

        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition border border-slate-700/60 shrink-0"
            aria-label="Abrir menú de navegación"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div key={activeTab} className={`hidden sm:flex w-9 h-9 rounded-xl border items-center justify-center shrink-0 shadow-sm animate-in zoom-in fade-in ${tone.tile}`}>
            <Icon className="w-4 h-4 stroke-[2.2]" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold text-white truncate tracking-tight">{text.title}</h1>
              {text.special && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40 px-1.5 py-0.5 rounded">
                  <Sparkles className="w-3 h-3" />
                  IA Activa
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate hidden md:block" title={text.desc}>{text.desc}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
        {isDashboard && (
          <>
            <button
              onClick={() => setActiveTab('inbox')}
              title="Grabar audio IA"
              aria-label="Grabar audio IA"
              className="flex items-center gap-2 p-2 sm:px-3 sm:py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition shadow-lg shadow-amber-500/20 active:scale-95"
            >
              <Mic className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Grabar audio IA</span>
            </button>
            <button
              onClick={() => setActiveTab('presupuestos')}
              title="Presupuesto IA"
              aria-label="Presupuesto IA"
              className="flex items-center gap-2 p-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold text-xs sm:text-sm rounded-xl border border-amber-500/30 transition active:scale-95"
            >
              <Calculator className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Presupuesto IA</span>
            </button>
          </>
        )}

        {currentUser?.role === 'admin' && avisosAvailable && (
          <button
            onClick={() => setActiveTab('avisos')}
            title={avisosLabel}
            aria-label={avisosLabel}
            className="relative p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition border border-slate-700/60 shrink-0"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        )}

        {/* Sesión */}
        <div className="flex items-center gap-2 pl-2 ml-1 border-l border-slate-800">
          <div
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shrink-0"
            title={`${userName} (${roleLabel})`}
          >
            {initial}
          </div>
          <div className="min-w-0 max-w-[10rem] hidden md:block">
            <p className="text-xs font-bold text-white truncate">{userName}</p>
            <p className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              {roleLabel}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition border border-slate-700/60 shrink-0"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        </div>

      </div>
    </header>
  );
}
