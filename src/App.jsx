import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Navbar from './components/Navbar';
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
import { CheckCircle2, AlertCircle, HardHat } from 'lucide-react';

function MainLayout() {
  const { activeTab, notification } = useApp();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Top Navigation */}
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'obras' && <ObrasList />}
        {activeTab === 'inbox' && <AudioEmailInbox />}
        {activeTab === 'presupuestos' && <PresupuestosList />}
        {activeTab === 'facturas' && <FacturasList />}
        {activeTab === 'gestoria' && <GestoriaTrimestres />}
        {activeTab === 'obreros' && <ObrerosList />}
        {activeTab === 'subcontratas' && <SubcontratasList />}
        {activeTab === 'portal_obrero' && <PortalObreroView />}
        {activeTab === 'empresa_config' && <EmpresaConfig />}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-xs text-slate-500 py-6">
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
      <MainLayout />
    </AppProvider>
  );
}
