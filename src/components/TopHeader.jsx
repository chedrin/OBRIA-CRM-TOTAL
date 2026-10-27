import React from 'react';
import { useApp } from '../context/AppContext';
import { NAV_ITEMS, NAV_TONES } from './navigation/navConfig';
import { useNotifications } from '../context/NotificationsContext';
import {
  Menu,
  Building2,
  HardHat,
  Mic,
  Calculator,
  Receipt,
  FileSpreadsheet,
  Users,
  Percent,
  Smartphone,
  ShieldCheck,
  ExternalLink,
  Sparkles,
  TrendingUp,
  Bell,
  BellRing
} from 'lucide-react';

const TAB_CONFIG = {
  dashboard: {
    title: 'Panel General',
    desc: 'Visión ejecutiva de obras, tesorería y avance operativo',
    icon: Building2,
  },
  obras: {
    title: 'Obras y Reformas',
    desc: 'Gestión de proyectos, fases constructivas, partes diarios y costes',
    icon: HardHat,
  },
  avisos: {
    title: 'Avisos, Necesidades y Pedidos',
    desc: 'Avisos de obra en tiempo real, pedidos de material a proveedores y enlaces para subcontratas',
    icon: BellRing,
  },
  inbox: {
    title: 'Bandeja Audio / Email IA',
    desc: 'Captura por voz de visitas de obra y correos de clientes procesados con IA',
    icon: Mic,
  },
  presupuestos: {
    title: 'Presupuestos & Mediciones IA',
    desc: 'Creación automática de partidas, capítulos e importes vinculados a obra',
    icon: Calculator,
    special: true
  },
  facturas: {
    title: 'Facturación & Certificaciones',
    desc: 'Facturas emitidas a clientes, facturas recibidas y certificaciones por avance',
    icon: Receipt,
  },
  gestoria: {
    title: 'Gestoría & Trimestres AEAT',
    desc: 'Estimación trimestral Modelos 303 (IVA) y 130 (IRPF), retenciones y balances',
    icon: FileSpreadsheet,
  },
  obreros: {
    title: 'RRHH, Plantilla & Nóminas',
    desc: 'Fichas de operarios, confección de nóminas, categorías y accesos PWA',
    icon: Users,
  },
  subcontratas: {
    title: 'Subcontratas & Homologación PRL',
    desc: 'Presupuestos comparativos, asignación a partidas y scoring de proveedores',
    icon: Percent,
  },
  portal_obrero: {
    title: 'Simulador Portal Obrero (PWA)',
    desc: 'Vista previa de la interfaz móvil que utilizan los operarios en pie de obra',
    icon: Smartphone,
  },
  empresa_config: {
    title: 'Ajustes de Empresa & Motor IA',
    desc: 'Datos fiscales de cabecera, API Key de Inteligencia Artificial y usuarios',
    icon: ShieldCheck,
  },
};

export default function TopHeader({
  onOpenMobileMenu = () => {},
  onNavigateToWorker = () => {}
}) {
  const {
    activeTab,
    setActiveTab,
    obras,
    currentUser
  } = useApp();
  const { unreadCount, available: avisosAvailable } = useNotifications();

  const currentTabInfo = TAB_CONFIG[activeTab] || {
    title: 'ObraMaster AI',
    desc: 'Software de Gestión Integral para Construcción y Reformas',
    icon: Building2
  };

  const Icon = currentTabInfo.icon;
  const tone = NAV_TONES[NAV_ITEMS.find(i => i.id === activeTab)?.tone || 'amber'];
  const activeObrasCount = obras.filter(o => o.estado === 'en_curso').length;

  return (
    <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-3.5 transition-all">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto w-full">
        
        {/* Left: Hamburger (Mobile) + Current View Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition border border-slate-700/60 shrink-0"
            aria-label="Abrir menú de navegación"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 min-w-0">
            <div key={activeTab} className={`hidden sm:flex w-9 h-9 rounded-xl border items-center justify-center shrink-0 shadow-sm animate-in zoom-in fade-in ${tone.tile}`}>
              <Icon className="w-4 h-4 stroke-[2.2]" />
            </div>
            
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold text-white truncate tracking-tight">
                  {currentTabInfo.title}
                </h1>
                {currentTabInfo.special && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40 px-1.5 py-0.5 rounded">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    IA Activa
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate hidden md:block">
                {currentTabInfo.desc}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Quick Stats & Portal Obrero Link */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          
          {/* Quick Metrics (Desktop) */}
          <div className="hidden xl:flex items-center gap-3 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {activeObrasCount} en ejecución
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1 text-slate-300">
              <TrendingUp className="w-3 h-3 text-amber-400" />
              Margen obj: <strong className="text-amber-400 font-semibold">32%</strong>
            </span>
          </div>

          {/* Avisos sin leer */}
          {currentUser?.role === 'admin' && avisosAvailable && (
            <button
              onClick={() => setActiveTab('avisos')}
              title={unreadCount ? `${unreadCount} avisos sin leer` : 'Avisos'}
              aria-label={unreadCount ? `${unreadCount} avisos sin leer` : 'Avisos'}
              className="relative p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition border border-slate-700/60"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          )}

          {/* Quick Access to Mobile Portal */}
          <button
            onClick={onNavigateToWorker}
            title="Ir al portal móvil independiente para operarios"
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs shadow-md shadow-amber-500/20 transition-all hover:scale-105 active:scale-95"
          >
            <Smartphone className="w-3.5 h-3.5 stroke-[2.4]" />
            <span className="hidden sm:inline">Portal Obrero Móvil</span>
            <span className="sm:hidden">App Móvil</span>
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
          </button>

          {/* User mini badge */}
          <div className="hidden sm:flex items-center gap-2 bg-slate-800/60 pl-2 pr-2.5 py-1 rounded-xl border border-slate-700/50 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="font-semibold text-slate-200 text-[11px] truncate max-w-[100px]">
              {currentUser?.fullName?.split(' ')[0] || 'Admin'}
            </span>
          </div>

        </div>

      </div>
    </header>
  );
}
