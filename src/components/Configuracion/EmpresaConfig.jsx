import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Building2,
  ShieldCheck,
  QrCode,
  FileText,
  Key,
  Database,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Settings,
  Lock,
  History,
  Send,
  Sparkles,
  Download,
  Info
} from 'lucide-react';

export default function EmpresaConfig() {
  const { empresaConfig, updateEmpresaConfig, auditLogs, showNotification } = useApp();

  const [form, setForm] = useState({ ...empresaConfig });
  const [activeSubTab, setActiveSubTab] = useState('fiscal_data'); // fiscal_data, verifactu, ticketbai, sii_facturae, audit

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    updateEmpresaConfig(form);
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Normativa Fiscal Española · Ley 11/2021 & VeriFactu</span>
          </div>
          <h1 className="text-2xl font-black text-white">Configuración Fiscal de la Empresa</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Datos fiscales para presupuestos, facturas, certificados digitales, VeriFactu (AEAT), TicketBAI y Facturae.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition shadow-lg shadow-amber-500/20 active:scale-95 flex items-center gap-2"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Guardar Configuración Fiscal</span>
        </button>
      </div>

      {/* Subtabs Navigation */}
      <div className="flex gap-2 border-b border-slate-800 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'fiscal_data', label: 'Identificación y Datos Fiscales', icon: Building2 },
          { id: 'verifactu', label: 'VeriFactu (AEAT Ley 11/2021)', icon: ShieldCheck, badge: 'Obligatorio' },
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
              className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
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

      {/* TAB 1: IDENTIFICACIÓN Y DATOS FISCALES */}
      {activeSubTab === 'fiscal_data' && (
        <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-400" />
              <span>Identificación Fiscal de la Empresa o Autónomo</span>
            </h3>
            <span className="text-xs text-slate-400">Se usará en la cabecera de presupuestos, certificaciones y facturas PDF</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Razón Social / Nombre Oficial *</label>
              <input
                type="text"
                required
                value={form.razonSocial || ''}
                onChange={(e) => handleChange('razonSocial', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400 font-semibold"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-medium">Nombre Comercial</label>
              <input
                type="text"
                value={form.nombreComercial || ''}
                onChange={(e) => handleChange('nombreComercial', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-medium">NIF / CIF *</label>
              <input
                type="text"
                required
                value={form.cifNif || ''}
                onChange={(e) => handleChange('cifNif', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-amber-400 font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-medium">Régimen Fiscal Ley IVA</label>
              <select
                value={form.regimenFiscal || 'Regimen General de Ley 37/1992 del IVA'}
                onChange={(e) => handleChange('regimenFiscal', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
              >
                <option value="Regimen General de Ley 37/1992 del IVA">Régimen General del IVA (10% / 21%)</option>
                <option value="Régimen de REBU / Bienes Usados">Régimen Especial Bienes Usados (REBU)</option>
                <option value="Régimen de Criterio de Caja">Régimen Especial del Criterio de Caja</option>
                <option value="Régimen Simplificado (Módulos)">Régimen Simplificado (Módulos)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-medium">Dirección Fiscal *</label>
              <input
                type="text"
                required
                value={form.direccion || ''}
                onChange={(e) => handleChange('direccion', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-slate-400 block mb-1 font-medium">C.P.</label>
                <input
                  type="text"
                  value={form.codigoPostal || ''}
                  onChange={(e) => handleChange('codigoPostal', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Localidad</label>
                <input
                  type="text"
                  value={form.localidad || ''}
                  onChange={(e) => handleChange('localidad', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Provincia</label>
                <input
                  type="text"
                  value={form.provincia || ''}
                  onChange={(e) => handleChange('provincia', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-medium">Teléfono de Contacto</label>
              <input
                type="text"
                value={form.telefono || ''}
                onChange={(e) => handleChange('telefono', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-medium">Email Oficial Facturación</label>
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-medium">IBAN Cobros Transferencia</label>
              <input
                type="text"
                value={form.iban || ''}
                onChange={(e) => handleChange('iban', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-medium">Datos Registro Mercantil (Pie de Factura)</label>
              <input
                type="text"
                value={form.registroMercantil || ''}
                onChange={(e) => handleChange('registroMercantil', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs"
              />
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: VERIFACTU (AEAT LEY 11/2021) */}
      {activeSubTab === 'verifactu' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Módulo de Facturación Garante VeriFactu (AEAT)</span>
              </h3>
              <p className="text-xs text-slate-400">Reglamento Antifraude de la Ley 11/2021 y RD 1007/2023</p>
            </div>
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold">
              ● VeriFactu Activo
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">

            {/* Box 1: Requisitos de Encadenamiento */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="font-bold text-amber-400 uppercase tracking-wider block flex items-center gap-2">
                <Lock className="w-4 h-4" />
                <span>1. Encadenamiento y Registro Inalterable</span>
              </span>
              <p className="text-slate-300">
                Cada factura genera un **hash SHA-256** derivado del número de factura, NIF expedidor, fecha y total, encadenado matemáticamente con la huella de la factura anterior.
              </p>
              <div className="p-2.5 bg-slate-900 rounded-lg font-mono text-[11px] text-emerald-400 border border-slate-800 break-all">
                Hash Enlace: sha256(FAC2026024 + B87654321 + 2026-10-16 + 10720.00 + [HashAnterior])
              </div>
            </div>

            {/* Box 2: Huella y QR en Facturas */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="font-bold text-amber-400 uppercase tracking-wider block flex items-center gap-2">
                <QrCode className="w-4 h-4" />
                <span>2. Código QR y Cotejo Público AEAT</span>
              </span>
              <p className="text-slate-300">
                Todas las facturas impresas o en PDF incorporan obligatoriamente el código QR oficial conforme al formato especificado por la Agencia Tributaria.
              </p>
              <div className="flex items-center gap-3 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <div className="w-12 h-12 bg-white rounded p-1 flex items-center justify-center shrink-0">
                  <QrCode className="w-10 h-10 text-slate-950" />
                </div>
                <div className="text-[10px] text-slate-400">
                  URL Cotejo AEAT: <span className="text-amber-400">https://www2.agenciatributaria.gob.es/vf/fac?...</span>
                </div>
              </div>
            </div>

          </div>

          {/* Declaración Responsable Software Garante */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/20 p-4 rounded-xl border border-amber-500/30 text-xs space-y-2">
            <span className="font-bold text-amber-400 uppercase tracking-wider block">Declaración Responsable de Software Garante</span>
            <p className="text-slate-300">
              ObraMaster garantiza la conservación, legibilidad, trazabilidad, inalterabilidad e integridad de los registros sin interpolaciones ni eliminaciones físicas.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-[11px] text-slate-400 font-mono">
              <div>Software: <strong className="text-white">{form.softwareNombre}</strong></div>
              <div>Versión: <strong className="text-white">{form.softwareVersion}</strong></div>
              <div>Licencia Garante: <strong className="text-amber-400">{form.softwareLicencia}</strong></div>
            </div>
          </div>
        </div>
      )}

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
