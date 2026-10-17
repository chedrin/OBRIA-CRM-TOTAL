import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Building2,
  HardHat,
  Mic,
  Calculator,
  Receipt,
  FileSpreadsheet,
  Users,
  Percent,
  RefreshCw,
  Bell,
  Sparkles,
  Smartphone,
  ShieldCheck,
  LogOut
} from 'lucide-react';

export default function Navbar() {
  const {
    activeTab,
    setActiveTab,
    obras,
    mensajesInbox,
    subcontratasPresupuestos,
    resetAllData,
    currentUser,
    logout
  } = useApp();

  const activeObrasCount = obras.filter(o => o.estado === 'en_curso').length;
  const pendingInboxCount = mensajesInbox.filter(m => !m.estadoProcesado).length;
  const pendingSubPresCount = subcontratasPresupuestos.filter(s => s.estado === 'pendiente').length;

  const navItems = [
    { id: 'dashboard', label: 'Panel General', icon: Building2 },
    { id: 'obras', label: 'Obras y Reformas', icon: HardHat, badge: activeObrasCount },
    { id: 'inbox', label: 'Audio / Email IA', icon: Mic, badge: pendingInboxCount, badgeColor: 'bg-amber-500' },
    { id: 'presupuestos', label: 'Presupuestos IA', icon: Calculator, isSpecial: true },
    { id: 'facturas', label: 'Facturación', icon: Receipt },
    { id: 'gestoria', label: 'Gestoría & Trimestres', icon: FileSpreadsheet },
    { id: 'obreros', label: 'Obreros & Calificación', icon: Users },
    { id: 'subcontratas', label: 'Subcontratas & Precios', icon: Percent, badge: pendingSubPresCount, badgeColor: 'bg-indigo-500' },
    { id: 'portal_obrero', label: 'App Móvil Obrero', icon: Smartphone, badgeColor: 'bg-emerald-500' },
    { id: 'empresa_config', label: 'Config. Fiscal', icon: ShieldCheck, isSpecial: true },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 shadow-lg">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20">
              <HardHat className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-white">ObraMaster</span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">IA Constructor</span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Control de Obras, Presupuestos IA, Facturación y Gestoría</p>
            </div>
          </div>

          {/* Quick Info & Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden lg:flex items-center gap-3 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {activeObrasCount} Obras en curso
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-300">Margen objetivo: <strong className="text-amber-400 font-semibold">32%</strong></span>
            </div>

            {/* Current User Badge & Logout */}
            <div className="flex items-center gap-2 bg-slate-800/90 pl-2.5 pr-1.5 py-1 rounded-xl border border-slate-700 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="font-bold text-white text-[11px] hidden sm:inline">
                  {currentUser ? currentUser.fullName.split(' ')[0] : 'Admin'}
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono font-bold">
                  {currentUser?.role || 'admin'}
                </span>
              </div>
              <button
                onClick={() => {
                  if (window.confirm('¿Deseas cerrar la sesión actual?')) {
                    logout();
                  }
                }}
                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-700/80 rounded-lg transition"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Reset Demo Data Button */}
            <button
              onClick={resetAllData}
              title="Reiniciar datos de prueba"
              className="text-xs text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 p-2 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Reiniciar Demo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="bg-slate-900/95 border-t border-slate-800/70 overflow-x-auto scrollbar-none">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 flex gap-1 py-1.5 min-w-max">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all relative ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : item.isSpecial
                    ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : item.isSpecial ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.isSpecial && !isActive && (
                  <Sparkles className="w-3 h-3 text-amber-400 animate-pulse ml-0.5" />
                )}
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`ml-1 text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? 'bg-slate-950 text-amber-400'
                        : item.badgeColor ? `${item.badgeColor} text-slate-950` : 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
