import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Building2,
  HardHat,
  Upload,
  CheckCircle2,
  FileSignature,
  Award
} from 'lucide-react';

export default function PerfilDirectorConfig() {
  const { empresaConfig, updateEmpresaConfig, showNotification } = useApp();

  const [form, setForm] = useState({
    razonSocial: empresaConfig?.razonSocial || 'ObraMaster AI Construcciones y Reformas SL',
    nombreComercial: empresaConfig?.nombreComercial || 'ObraMaster AI',
    cifNif: empresaConfig?.cifNif || 'B87654321',
    direccion: empresaConfig?.direccion || 'Calle Velázquez 102, Planta 3',
    codigoPostal: empresaConfig?.codigoPostal || '28006',
    localidad: empresaConfig?.localidad || 'Madrid',
    provincia: empresaConfig?.provincia || 'Madrid',
    telefono: empresaConfig?.telefono || '+34 91 234 5678',
    email: empresaConfig?.email || 'administracion@obramaster.es',
    iban: empresaConfig?.iban || 'ES91 2100 0418 45 0200051234',
    bicSwift: empresaConfig?.bicSwift || 'CAIXESMMXXX',
    registroMercantil: empresaConfig?.registroMercantil || 'Mercantil de Madrid, Tomo 38.412, Folio 110, Sección 8, Hoja M-683102',
    directorNombre: empresaConfig?.directorNombre || 'Manuel Gómez Castillo',
    directorTitulacion: empresaConfig?.directorTitulacion || 'Arquitecto Técnico & Aparejador Colegiado',
    directorColegiado: empresaConfig?.directorColegiado || 'COAATM-4821',
    logoUrl: empresaConfig?.logoUrl || 'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f8?auto=format&fit=crop&w=200&q=80',
    firmaUrl: empresaConfig?.firmaUrl || 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=300&q=80'
  });

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (field, e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleChange(field, reader.result);
        showNotification(`Archivo cargado para ${field === 'logoUrl' ? 'el logotipo' : 'la firma/sello'}`);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateEmpresaConfig(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 p-5 rounded-2xl border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Identidad Corporativa & Acreditación Técnica</span>
          </div>
          <h3 className="text-xl font-black text-white">Perfil del Director de Obra y Datos de Empresa</h3>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Estos datos, junto con el logotipo y la firma digitalizada, se estamparán automáticamente en la cabecera y pie de tus presupuestos, facturas oficiales y certificaciones técnicas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* COLUMNA 1: DATOS FISCALES Y DE EMPRESA */}
        <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-sm">Datos Fiscales de la Empresa / Autónomo</h4>
              <p className="text-[11px] text-slate-400">Emisor de facturas y presupuestos</p>
            </div>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="text-slate-300 font-bold block mb-1">Razón Social / Nombre Fiscal *</label>
              <input
                type="text"
                required
                value={form.razonSocial}
                onChange={(e) => handleChange('razonSocial', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-medium focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Nombre Comercial</label>
                <input
                  type="text"
                  value={form.nombreComercial}
                  onChange={(e) => handleChange('nombreComercial', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-medium focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">NIF / CIF Fiscal *</label>
                <input
                  type="text"
                  required
                  value={form.cifNif}
                  onChange={(e) => handleChange('cifNif', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">Dirección Fiscal Completa</label>
              <input
                type="text"
                value={form.direccion}
                onChange={(e) => handleChange('direccion', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-medium focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-slate-400 block mb-1">C.P.</label>
                <input
                  type="text"
                  value={form.codigoPostal}
                  onChange={(e) => handleChange('codigoPostal', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Localidad</label>
                <input
                  type="text"
                  value={form.localidad}
                  onChange={(e) => handleChange('localidad', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Provincia</label>
                <input
                  type="text"
                  value={form.provincia}
                  onChange={(e) => handleChange('provincia', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Teléfono Centralita / WhatsApp</label>
                <input
                  type="text"
                  value={form.telefono}
                  onChange={(e) => handleChange('telefono', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-300 font-bold block mb-1">Email de Facturación</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <label className="text-slate-300 font-bold block mb-1">Cuenta Bancaria para Cobro (IBAN) *</label>
              <input
                type="text"
                required
                value={form.iban}
                onChange={(e) => handleChange('iban', e.target.value)}
                placeholder="ESXX XXXX XXXX XX XXXXXXXXXX"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-emerald-400 font-mono font-bold"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Aparece en el pie de página de facturas para transferencias de clientes.</span>
            </div>

            {/* LOGOTIPO CORPORATIVO */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <label className="text-slate-300 font-bold block">Logotipo Corporativo (Cabecera PDF)</label>
              
              <div className="flex items-center gap-4 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                  {form.logoUrl ? (
                    <img src={form.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <Building2 className="w-8 h-8 text-slate-600" />
                  )}
                </div>

                <div className="space-y-1.5 flex-1">
                  <input
                    type="file"
                    id="logo-input"
                    accept="image/*"
                    onChange={(e) => handleFileUpload('logoUrl', e)}
                    className="hidden"
                  />
                  <label
                    htmlFor="logo-input"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg cursor-pointer inline-flex items-center gap-1.5 transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Subir imagen de Logo</span>
                  </label>
                  <p className="text-[10px] text-slate-500">Recomendado: PNG con fondo transparente o SVG (mínimo 300x100px).</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* COLUMNA 2: DIRECTOR DE OBRA Y FIRMA */}
        <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <HardHat className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-sm">Acreditación del Director / Jefe de Obra</h4>
              <p className="text-[11px] text-slate-400">Responsable técnico y firma de contratos</p>
            </div>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="text-slate-300 font-bold block mb-1">Nombre y Apellidos del Director de Obra *</label>
              <input
                type="text"
                required
                value={form.directorNombre}
                onChange={(e) => handleChange('directorNombre', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-bold focus:outline-none focus:border-amber-400 text-sm"
              />
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">Titulación Oficial / Cargo</label>
              <input
                type="text"
                value={form.directorTitulacion}
                onChange={(e) => handleChange('directorTitulacion', e.target.value)}
                placeholder="Ej: Arquitecto Técnico / Ingeniero de Edificación / Aparejador"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-medium focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">Nº Colegiado Profesional (si aplica)</label>
              <input
                type="text"
                value={form.directorColegiado}
                onChange={(e) => handleChange('directorColegiado', e.target.value)}
                placeholder="Ej: COAATM-4821 / COAM-1290"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-amber-400 font-mono font-bold"
              />
            </div>

            {/* SELLO Y FIRMA DIGITALIZADA */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <label className="text-slate-300 font-bold block flex items-center gap-1.5">
                <FileSignature className="w-4 h-4 text-amber-400" />
                <span>Firma Digitalizada / Sello de Obra</span>
              </label>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="h-28 bg-slate-900 border border-dashed border-slate-700 rounded-xl flex items-center justify-center p-2 relative overflow-hidden group">
                  {form.firmaUrl ? (
                    <img
                      src={form.firmaUrl}
                      alt="Firma"
                      className="max-h-full max-w-full object-contain filter drop-shadow"
                    />
                  ) : (
                    <div className="text-center text-slate-500">
                      <FileSignature className="w-8 h-8 mx-auto mb-1 opacity-50" />
                      <span className="text-[11px]">Sin firma configurada</span>
                    </div>
                  )}

                  <div className="absolute top-2 right-2 bg-slate-950/80 px-2 py-0.5 rounded text-[9px] font-mono text-emerald-400 border border-slate-800">
                    Estampa Activa
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <input
                    type="file"
                    id="firma-input"
                    accept="image/*"
                    onChange={(e) => handleFileUpload('firmaUrl', e)}
                    className="hidden"
                  />
                  <label
                    htmlFor="firma-input"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg cursor-pointer inline-flex items-center gap-1.5 transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Cargar Sello / Firma PNG</span>
                  </label>

                  <span className="text-[10px] text-slate-500 text-right">
                    Se estampará al pie de presupuestos y certificaciones LOE.
                  </span>
                </div>
              </div>
            </div>

            {/* Vista previa estampa técnica */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Previsualización de pie técnico:</span>
              <p className="font-bold text-white text-xs">{form.directorNombre}</p>
              <p className="text-[11px] text-amber-400">{form.directorTitulacion} {form.directorColegiado && `· ${form.directorColegiado}`}</p>
              <p className="text-[10px] text-slate-500 font-mono">Conforme a la Ley 38/1999 de Ordenación de la Edificación (LOE)</p>
            </div>

          </div>
        </div>

      </div>

      {/* Único botón de guardar, siempre visible al desplazarse */}
      <div className="sticky bottom-4 z-10 flex justify-end pt-2">
        <button
          type="submit"
          className="px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm rounded-xl transition shadow-lg shadow-amber-500/25 active:scale-95 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
          <span>Guardar perfil y empresa</span>
        </button>
      </div>

    </form>
  );
}
