import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { UiPreferencesProvider } from './context/UiPreferencesContext';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import Dashboard from './components/Dashboard';
import ObrasList from './components/Obras/ObrasList';
import AudioEmailInbox from './components/AudioInbox/AudioEmailInbox';
import PresupuestosList from './components/Presupuestos/PresupuestosList';
import FacturasList from './components/Facturas/FacturasList';
import GestoriaTrimestres from './components/Gestoria/GestoriaTrimestres';
import ObrerosList from './components/Obreros/ObrerosList';
import SubcontratasList from './components/Subcontratas/SubcontratasList';
import PortalObreroView from './components/PortalObrero/PortalObreroView';
import EmpresaConfig from './components/Configuracion/EmpresaConfig';
import PdfModal from './components/Common/PdfModal';
import LoginObreroView from './components/Auth/LoginObreroView';
import LoginAdminModal from './components/Auth/LoginAdminModal';
import { CheckCircle2, AlertCircle, HardHat, ArrowLeft, ShieldCheck, ExternalLink } from 'lucide-react';

function getInitialRoute() {
  const hash = (window.location.hash || '').toLowerCase();
  const path = (window.location.pathname || '').toLowerCase();
  if (hash.includes('empleados') || path.includes('empleados') || hash.includes('obrero')) {
    return 'empleados';
  }
  return 'admin';
}

function MainLayout() {
  const { activeTab = 'dashboard', setActiveTab = () => {}, notification, currentUser, logout = () => {}, activeRealtimeAlert, authReady = true, facturacionActivada = false } = useApp() || {};
  const [route, setRoute] = useState(getInitialRoute);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('obramaster_sidebar_collapsed') === 'true';
  });

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('obramaster_sidebar_collapsed', String(next));
      } catch (e) {}
      return next;
    });
  };

  // Sync route on hashchange / popstate
  useEffect(() => {
    const handleLocationChange = () => {
      setRoute(getInitialRoute());
    };

    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // RBAC GUARD: If an obrero is logged in and navigates to admin, force redirect to #empleados
  useEffect(() => {
    if (currentUser?.role === 'obrero' && route !== 'empleados') {
      window.location.hash = '#empleados';
      setRoute('empleados');
    }
  }, [currentUser, route]);

  // Navigate to route helper
  const navigateTo = (newRoute) => {
    window.location.hash = newRoute === 'empleados' ? '#empleados' : '#admin';
    setRoute(newRoute);
  };

  // Mientras se comprueba si hay una sesión guardada, no se muestra ni el login ni los datos.
  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center font-sans">
        <span className="text-sm font-semibold animate-pulse">Cargando ObraMaster…</span>
      </div>
    );
  }

  // ==========================================
  // CASE 1: WORKER ROUTE (/#empleados)
  // ==========================================
  if (route === 'empleados') {
    // If not logged in, show dedicated worker login
    if (!currentUser) {
      return (
        <LoginObreroView
          onSwitchToAdmin={() => navigateTo('admin')}
        />
      );
    }

    // If logged in as admin visiting #empleados, show supervisor banner
    if (currentUser.role === 'admin') {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
          {/* Admin Supervisor Top Bar */}
          <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
              <span>Modo Supervisor: Estás visualizando el Portal Móvil con tu cuenta de Administrador ({currentUser.fullName})</span>
            </div>
            <button
              onClick={() => navigateTo('admin')}
              className="px-3 py-1 bg-slate-950 hover:bg-slate-900 text-amber-400 font-bold rounded-lg transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver al Panel Admin</span>
            </button>
          </div>

          <main className="flex-1 w-full max-w-xl mx-auto p-4 sm:p-6">
            <PortalObreroView />
          </main>

          {/* Realtime Broadcast Banner */}
          {activeRealtimeAlert && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-slate-900/95 backdrop-blur-md border border-amber-500 text-white px-5 py-3 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 ring-4 ring-amber-500/20 max-w-md">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0"></span>
              <span className="text-xs sm:text-sm font-black text-amber-300 truncate">{activeRealtimeAlert.msg}</span>
            </div>
          )}

          {/* Toast Notification */}
          {notification && (
            <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-slate-900 border border-amber-500/40 text-white px-4 py-3 rounded-2xl shadow-2xl animate-in fade-in duration-300">
              {notification.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              )}
              <span className="text-xs sm:text-sm font-semibold">{notification.msg}</span>
            </div>
          )}
        </div>
      );
    }

    // Worker Logged In: 100% Mobile Isolated Layout (NO admin navbar, NO admin footer)
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans p-3 sm:p-5 selection:bg-amber-500 selection:text-slate-950">
        <main className="flex-1 w-full max-w-xl mx-auto py-2">
          <PortalObreroView />
        </main>

        {/* Minimal Worker Footer */}
        <footer className="text-center py-4 text-[11px] text-slate-600">
          ObraMaster Móvil v2.4 · Sesión activa como {currentUser.fullName}
        </footer>

        {/* Realtime Broadcast Banner */}
        {activeRealtimeAlert && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-slate-900/95 backdrop-blur-md border border-amber-500 text-white px-5 py-3 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 ring-4 ring-amber-500/20 max-w-md">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0"></span>
            <span className="text-xs sm:text-sm font-black text-amber-300 truncate">{activeRealtimeAlert.msg}</span>
          </div>
        )}

        {/* Toast Notification */}
        {notification && (
          <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-slate-900 border border-amber-500/40 text-white px-4 py-3 rounded-2xl shadow-2xl animate-in fade-in duration-300">
            {notification.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <span className="text-xs sm:text-sm font-semibold">{notification.msg}</span>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // CASE 2: ADMIN ROUTE (/admin o #admin o #dashboard)
  // ==========================================
  // If not logged in as admin, show login modal or banner
  const isAdminLoggedIn = currentUser && currentUser.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* If not logged in, prompt admin login modal */}
      {!isAdminLoggedIn && (
        <LoginAdminModal
          isOpen={true}
          onClose={() => {}}
          onSwitchToWorker={() => navigateTo('empleados')}
        />
      )}

      {/* Left Vertical Navigation Menu */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />

      {/* Main Content Column (Top Header + Main Content + Footer) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-slate-950">
        
        {/* Top Header Bar */}
        <TopHeader
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onNavigateToWorker={() => navigateTo('empleados')}
        />

        {/* Main Content Area */}
        <main key={activeTab} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 om-page-enter">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'obras' && <ObrasList />}
          {activeTab === 'inbox' && <AudioEmailInbox />}
          {activeTab === 'presupuestos' && <PresupuestosList />}
          {activeTab === 'facturas' && facturacionActivada && <FacturasList />}
          {activeTab === 'gestoria' && <GestoriaTrimestres />}
          {activeTab === 'obreros' && <ObrerosList />}
          {activeTab === 'subcontratas' && <SubcontratasList />}
          {activeTab === 'portal_obrero' && <PortalObreroView />}
          {activeTab === 'empresa_config' && <EmpresaConfig />}
        </main>

        {/* Footer */}
        <footer className="bg-slate-900 border-t border-slate-800 text-xs text-slate-500 py-6 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center text-slate-950 font-bold text-[10px]">
                OM
              </div>
              <span className="font-bold text-slate-300">ObraMaster AI</span>
              <span>— Software de Gestión Integral para Constructores y Reformas</span>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <span>Modelos 303/130 AEAT</span>
              <span>·</span>
              <span>REBT & LOE Normativa</span>
              <span>·</span>
              <span className="text-emerald-400 font-semibold">● Sistema Activo en la Nube</span>
            </div>
          </div>
        </footer>

      </div>

      {/* Realtime Broadcast Banner */}
      {activeRealtimeAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-slate-900/95 backdrop-blur-md border border-amber-500 text-white px-5 py-3 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 ring-4 ring-amber-500/20 max-w-md">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0"></span>
          <span className="text-xs sm:text-sm font-black text-amber-300 truncate">{activeRealtimeAlert.msg}</span>
        </div>
      )}

      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-slate-900 border border-amber-500/40 text-white px-4 py-3 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-300">
          {notification.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-semibold">{notification.msg}</span>
        </div>
      )}

      {/* Printable / Downloadable PDF Modal */}
      <PdfModal />

    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <UiPreferencesProvider>
        <MainLayout />
      </UiPreferencesProvider>
    </AppProvider>
  );
}
