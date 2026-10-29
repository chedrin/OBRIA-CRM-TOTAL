import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Building2,
  ShieldCheck,
  QrCode,
  FileText,
  FileSpreadsheet,
  History,
  Sparkles,
  KeyRound,
  Brain,
  Palette,
  Database,
  BellRing
} from 'lucide-react';
import GestionUsuarios from './GestionUsuarios';
import PerfilDirectorConfig from './PerfilDirectorConfig';
import MotorIaConfig from './MotorIaConfig';
import AiMemoryConfig from './AiMemoryConfig';
import PresupuestosModeloConfig from './PresupuestosModeloConfig';
import FacturacionConfig from './FacturacionConfig';
import AparienciaConfig from './AparienciaConfig';
import DatosEjemploConfig from './DatosEjemploConfig';
import NotificacionesConfig from './NotificacionesConfig';

export default function EmpresaConfig() {
  const { empresaConfig, updateEmpresaConfig, auditLogs, referenceBudgets, showNotification, facturacionActivada, demoDataCount } = useApp();

  const [form, setForm] = useState({ ...empresaConfig });
  const [activeSubTab, setActiveSubTab] = useState('perfil_director'); // perfil_director, motor_ia, presupuestos_modelo, usuarios, verifactu, ticketbai, sii_facturae, audit

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    updateEmpresaConfig(form);
  };

  const activeRefsCount = (referenceBudgets || []).filter(b => b.is_active).length;

  return (
    <div className="space-y-6">

      {/* Guardar: solo TicketBAI y SII/Facturae usan este formulario; las demás pestañas tienen su propio botón. */}
      {['ticketbai', 'sii_facturae'].includes(activeSubTab) && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition shadow-lg shadow-amber-500/20 active:scale-95 flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Guardar configuración</span>
          </button>
        </div>
      )}

      {/* Subtabs Navigation */}
      <div role="tablist" aria-label="Secciones de ajustes" className="flex flex-nowrap md:flex-wrap gap-1.5 border-b border-slate-800 pb-2 min-w-0 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        {[
          { id: 'perfil_director', label: 'Perfil Director & Empresa', icon: Building2, badge: 'Acreditado' },
          { id: 'motor_ia', label: 'Motor Central IA (BYOK)', icon: Sparkles, badge: 'Multimodal' },
          { id: 'memoria_ia', label: 'Memoria de la IA', icon: Brain, badge: 'Aprende' },
          { id: 'presupuestos_modelo', label: 'Presupuestos Modelo (PDFs IA)', icon: FileText, badge: `${activeRefsCount} Activos` },
          { id: 'usuarios', label: 'Gestión de Usuarios y Accesos', icon: KeyRound, badge: 'RBAC' },
          { id: 'apariencia', label: 'Apariencia y Vistas', icon: Palette, badge: 'Nuevo' },
          { id: 'notificaciones', label: 'Notificaciones', icon: BellRing },
          { id: 'datos_ejemplo', label: 'Datos de ejemplo', icon: Database, count: demoDataCount },
          { id: 'verifactu', label: 'Facturación (VeriFactu)', icon: ShieldCheck, badge: facturacionActivada ? 'Activada' : 'Desactivada' },
          { id: 'ticketbai', label: 'TicketBAI (País Vasco)', icon: QrCode },
          { id: 'sii_facturae', label: 'SII & Facturae B2B', icon: FileSpreadsheet },
          { id: 'audit', label: 'Registro de Auditoría e Inalterabilidad', icon: History, count: auditLogs?.length }
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeSubTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id)}
              role="tab"
              aria-selected={isActive}
              className={`shrink-0 whitespace-nowrap px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2 border-b-2 ${
                isActive
                  ? 'border-amber-400 text-amber-400 bg-slate-900/80 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.badge && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono font-bold">
                  {t.badge}
                </span>
              )}
              {t.count !== undefined && (
                <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded-full font-bold">
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB PERFIL DIRECTOR & EMPRESA */}
      {activeSubTab === 'perfil_director' && <PerfilDirectorConfig />}

      {/* TAB MOTOR CENTRAL IA (BYOK) */}
      {activeSubTab === 'motor_ia' && <MotorIaConfig />}

      {/* TAB MEMORIA DE LA IA (instrucciones y correcciones) */}
      {activeSubTab === 'memoria_ia' && <AiMemoryConfig />}

      {/* TAB PRESUPUESTOS MODELO (PDFs RAG) */}
      {activeSubTab === 'presupuestos_modelo' && <PresupuestosModeloConfig />}

      {/* TAB USUARIOS & ACCESOS */}
      {activeSubTab === 'usuarios' && <GestionUsuarios />}

      {activeSubTab === 'apariencia' && <AparienciaConfig />}

      {activeSubTab === 'notificaciones' && <NotificacionesConfig />}

      {activeSubTab === 'datos_ejemplo' && <DatosEjemploConfig />}

      {/* TAB 2: FACTURACIÓN LEGAL (VERIFACTU) */}
      {activeSubTab === 'verifactu' && <FacturacionConfig />}

      {/* TAB 3: TICKETBAI */}
      {activeSubTab === 'ticketbai' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-indigo-400" />
                <span>Módulo TicketBAI (Haciendas Forales País Vasco)</span>
              </h3>
              <p className="text-xs text-slate-400">Obligatorio en ÁLava, Bizkaia y Gipuzkoa</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-white text-sm">
                <input
                  type="checkbox"
                  checked={form.modoTicketBai || false}
                  onChange={(e) => handleChange('modoTicketBai', e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
                <span>Activar Generación de Ficheros XML TicketBAI</span>
              </label>

              {form.modoTicketBai && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-slate-400">Territorio Foral:</span>
                  <select
                    value={form.provinciaTicketBai || 'Bizkaia'}
                    onChange={(e) => handleChange('provinciaTicketBai', e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-white font-bold"
                  >
                    <option value="Araba">Araba / Álava</option>
                    <option value="Bizkaia">Bizkaia (Batuz)</option>
                    <option value="Gipuzkoa">Gipuzkoa</option>
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="font-bold text-amber-400 block mb-1">Código Identificador TBAI</span>
                <p className="text-slate-400 text-[11px]">Firma con certificado FNMT/Izenpe e inclusión de código identificador TBAI de 28 caracteres.</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="font-bold text-amber-400 block mb-1">LBR (Libro Registro Batuz)</span>
                <p className="text-slate-400 text-[11px]">Modelo 140 para personas físicas y Modelo 240 para personas jurídicas en Bizkaia.</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="font-bold text-amber-400 block mb-1">Certificado de Software</span>
                <p className="text-slate-400 text-[11px]">Software garante registrado en la lista oficial de desarrolladores de las Diputaciones.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SII & FACTURAE B2B */}
      {activeSubTab === 'sii_facturae' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-purple-400" />
                <span>SII (Suministro Inmediato) y Factura Electrónica B2B (Facturae)</span>
              </h3>
              <p className="text-xs text-slate-400">Ley Crea y Crece & Plataforma Pública de Intercambio de Facturas</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">

            {/* SII */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="font-bold text-amber-400 uppercase tracking-wider block">SII (Suministro Inmediato de Información)</span>
              <p className="text-slate-300">
                Envío de libros registro de facturas emitidas y recibidas en un plazo máximo de 4 días hábiles desde la expedición.
              </p>
              <label className="flex items-center gap-2 font-semibold text-white">
                <input
                  type="checkbox"
                  checked={form.modoSII || false}
                  onChange={(e) => handleChange('modoSII', e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
                <span>Envío Automático a la Sede Electrónica SII AEAT</span>
              </label>
            </div>

            {/* Facturae B2B */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="font-bold text-purple-400 uppercase tracking-wider block">Facturae v3.2.2 / Factura Electrónica B2B</span>
              <p className="text-slate-300">
                Generación del estándar Facturae XML con firma XAdES-BES para Administraciones Públicas y empresas B2B.
              </p>
              <label className="flex items-center gap-2 font-semibold text-white">
                <input
                  type="checkbox"
                  checked={form.modoFacturae || false}
                  onChange={(e) => handleChange('modoFacturae', e.target.checked)}
                  className="w-4 h-4 accent-purple-500 rounded"
                />
                <span>Habilitar Descarga y Envío de XML Facturae</span>
              </label>
            </div>

          </div>
        </div>
      )}

      {/* TAB 5: TRAZABILIDAD Y REGISTRO DE AUDITORÍA */}
      {activeSubTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                <span>Registro de Auditoría e Inalterabilidad Fiscal (Logs Inmutables)</span>
              </h3>
              <p className="text-xs text-slate-400">Pista de auditoría de todas las operaciones realizadas sobre presupuestos y facturas</p>
            </div>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Fecha / Hora</th>
                    <th className="py-2.5 px-3">Usuario</th>
                    <th className="py-2.5 px-3">Acción Fiscal</th>
                    <th className="py-2.5 px-3">Recurso / Factura</th>
                    <th className="py-2.5 px-3">IP</th>
                    <th className="py-2.5 px-3 font-mono">Hash Auditoría</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {(auditLogs || []).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-mono text-slate-400">{log.timestamp}</td>
                      <td className="py-2 px-3 font-semibold text-white">{log.usuario}</td>
                      <td className="py-2 px-3">
                        <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded font-mono font-bold text-[10px]">
                          {log.accion}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-bold text-white">{log.recurso}</td>
                      <td className="py-2 px-3 font-mono text-slate-400">{log.ip}</td>
                      <td className="py-2 px-3 font-mono text-[10px] text-emerald-400 truncate max-w-xs">{log.hash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
