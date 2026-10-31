import React from 'react';

// Vista previa en pantalla del presupuesto o la factura. Pinta el mismo modelo que el PDF
// (buildDocumentModel) con el mismo diseño, en una sola hoja continua.

const eur = (n) => {
  const v = Number(n || 0);
  const [ent, dec] = Math.abs(v).toFixed(2).split('.');
  return `${v < 0 ? '-' : ''}${ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec} €`;
};

function Barra({ color, children, className = '' }) {
  return (
    <div className={`rounded-md text-white text-[10px] font-bold uppercase tracking-wide ${className}`} style={{ backgroundColor: color }}>
      {children}
    </div>
  );
}

function Campo({ label, valor, color, className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <Barra color={color} className="px-2 py-1 text-center">{label}</Barra>
      <div className="mt-1 border border-slate-300 rounded-md px-2 py-1 text-[11px] text-slate-800 min-h-[24px] break-words">{valor || ' '}</div>
    </div>
  );
}

export default function DocumentSheet({ model, assets = {}, huella = '' }) {
  const { colores, emisor, cliente, impuestos } = model;
  const principal = colores.principal;
  const oscuro = colores.oscuro;
  const conQr = model.esFactura && assets.qrDataUrl;

  return (
    <div className="theme-native bg-white text-slate-900 rounded-xl shadow-lg max-w-3xl mx-auto p-4 sm:p-8 text-xs font-sans space-y-4">
      {model.avisos.length > 0 && (
        <p className="text-center text-[11px] font-black uppercase text-rose-600">{model.avisos.join(' · ')}</p>
      )}

      {/* Cabecera: emisor, QR tributario y cliente */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
        <div className="sm:flex-1 min-w-0">
          {assets.logoDataUrl ? (
            <img src={assets.logoDataUrl} alt="Logotipo" className="max-h-16 max-w-[220px] object-contain" />
          ) : (
            <p className="text-2xl font-black leading-tight" style={{ color: principal }}>{emisor.nombreComercial}</p>
          )}
          <div className="mt-2 text-[11px] leading-snug text-slate-800">
            <p className="font-bold">{emisor.razonSocial}</p>
            <p>{emisor.nif}</p>
            {emisor.lineas.map((l) => <p key={l}>{l}</p>)}
          </div>
        </div>

        {conQr && (
          <div className="shrink-0 text-center self-center sm:self-start">
            <span className="text-[10px] text-slate-700 block">QR tributario:</span>
            <img src={assets.qrDataUrl} alt="QR tributario de la AEAT" className="w-[120px] h-[120px] mx-auto" />
            <span className="text-[11px] font-bold text-slate-800 block">VERI*FACTU</span>
          </div>
        )}

        <div className="sm:w-[44%] shrink-0 rounded-xl p-4 border-2" style={{ borderColor: principal, backgroundColor: '#eeeef0' }}>
          <p className="text-[10px] font-bold uppercase" style={{ color: principal }}>{model.esFactura ? 'Facturar a' : 'Cliente'}</p>
          <p className="font-bold text-sm text-slate-900">{cliente.nombre || '—'}</p>
          {cliente.nif && <p className="text-[11px] text-slate-700">NIF: {cliente.nif}</p>}
          {cliente.direccion && <p className="text-[11px] text-slate-700">{cliente.direccion}</p>}
          {(cliente.telefono || cliente.email) && <p className="text-[11px] text-slate-700">{[cliente.telefono, cliente.email].filter(Boolean).join(' · ')}</p>}
        </div>
      </div>

      {/* Documento / número / fecha y contacto */}
      <div className="flex flex-col md:flex-row gap-3 md:items-end">
        <div className="grid grid-cols-3 gap-1.5 md:w-[48%]">
          <Campo label="Documento" valor={model.tipoDoc} color={oscuro} />
          <Campo label="Número" valor={model.numero} color={oscuro} />
          <Campo label="Fecha" valor={model.fecha} color={oscuro} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-800 md:flex-1">
          {emisor.movil && <p><strong style={{ color: oscuro }}>Telf. Móvil:</strong> {emisor.movil}</p>}
          {emisor.email && <p className="break-words"><strong style={{ color: oscuro }}>Email:</strong> {emisor.email}</p>}
          {emisor.oficina && <p><strong style={{ color: oscuro }}>Telf. Oficina:</strong> {emisor.oficina}</p>}
          {emisor.web && <p className="break-words"><strong style={{ color: oscuro }}>Web:</strong> {emisor.web}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.8fr_2.6fr] gap-1.5">
        <Campo label="N.I.F. cliente" valor={cliente.nif} color={oscuro} />
        <Campo label="Obra" valor={model.obra} color={oscuro} />
        <Campo label="Forma de pago" valor={model.formaPago} color={oscuro} />
      </div>

      {/* Tabla */}
      <div>
        <Barra color={principal} className="flex px-2 py-1.5 gap-2">
          <span className="w-12 shrink-0">Artículo</span>
          <span className="flex-1 text-center">Descripción</span>
          {model.modoDetalle && <span className="w-16 text-center hidden sm:block">Cant.</span>}
          <span className="w-20 text-right hidden sm:block">Precio ud.</span>
          <span className="w-20 text-right">Total</span>
        </Barra>
        <div className="mt-1 border border-slate-300 rounded-md px-2 py-2 space-y-1">
          {model.grupos.map((g, gi) => (
            <div key={`${g.codigo}-${gi}`} className="space-y-1.5 pb-1">
              {g.conTitulo && (
                <div className="flex gap-2 pt-1 font-bold text-[12px]">
                  <span className="w-12 shrink-0" style={{ color: principal }}>{g.codigo}</span>
                  <span className="flex-1 text-slate-900">{g.nombre}</span>
                </div>
              )}
              {g.lineas.map((l, li) => (
                <div key={li} className="flex gap-2 text-[11.5px] text-slate-700 leading-snug">
                  <span className="w-12 shrink-0 text-[10px] text-slate-500 break-all">{model.modoDetalle ? l.codigo : ''}</span>
                  <p className="flex-1">
                    {l.texto}
                    {model.modoDetalle && l.cantidad && <span className="sm:hidden text-slate-500"> · {l.cantidad} × {eur(l.precio)}</span>}
                  </p>
                  {model.modoDetalle && <span className="w-16 text-center hidden sm:block">{l.cantidad}</span>}
                  {model.modoDetalle ? (
                    <>
                      <span className="w-20 text-right hidden sm:block">{l.precio !== null ? eur(l.precio) : ''}</span>
                      <span className="w-20 text-right font-bold text-slate-900">{l.total !== null ? eur(l.total) : ''}</span>
                    </>
                  ) : (
                    <>
                      <span className="w-20 hidden sm:block" />
                      <span className="w-20" />
                    </>
                  )}
                </div>
              ))}
              {g.conTitulo && (
                <div className="flex gap-2 border-t border-slate-200 pt-1 font-bold italic text-[11.5px] text-slate-900">
                  <span className="w-12 shrink-0" />
                  <span className="flex-1">TOTAL {g.nombre}</span>
                  {model.modoDetalle && <span className="w-16 hidden sm:block" />}
                  <span className="w-20 text-right hidden sm:block">{model.modoDetalle ? '' : eur(g.total)}</span>
                  <span className="w-20 text-right">{eur(g.total)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Impuestos */}
      <div>
        <Barra color={oscuro} className={`grid ${impuestos.retencion ? 'grid-cols-5' : 'grid-cols-4'} px-1 py-1 text-center text-[9px] sm:text-[10px]`}>
          <span>Tipo I.V.A.</span><span>Importe</span><span>Base imponible</span><span>Cuota I.V.A.</span>
          {Boolean(impuestos.retencion) && <span>Ret. IRPF ({impuestos.retencionPct}%)</span>}
        </Barra>
        <div className={`mt-1 border border-slate-300 rounded-md grid ${impuestos.retencion ? 'grid-cols-5' : 'grid-cols-4'} px-1 py-1.5 text-center text-[11px] text-slate-800`}>
          <span>{impuestos.tipo}</span><span>{eur(impuestos.base)}</span><span>{eur(impuestos.base)}</span><span>{eur(impuestos.cuota)}</span>
          {Boolean(impuestos.retencion) && <span>-{eur(impuestos.retencion)}</span>}
        </div>
      </div>

      {/* Observaciones y total */}
      <div>
        <div className="flex gap-2">
          <Barra color={oscuro} className="flex-1 px-3 py-1.5">Observaciones:</Barra>
          <div className="rounded-md text-white font-black text-sm px-3 py-1 flex items-center justify-between gap-4 w-48 sm:w-56" style={{ backgroundColor: principal }}>
            <span>TOTAL:</span><span>{eur(impuestos.total)}</span>
          </div>
        </div>
        <div className="mt-1 border border-slate-300 rounded-md px-3 py-2 space-y-1 text-[11px] text-slate-800">
          {model.observaciones.map((o, i) => (
            <p key={i} className={`${o.negrita ? 'font-bold' : ''} ${o.subrayado ? 'underline' : ''} ${o.aviso ? 'text-rose-600' : ''}`}>{o.texto}</p>
          ))}
          {model.esFactura && model.qr && (
            <p className="text-[10px] text-slate-500 text-right">Factura verificable en la sede electrónica de la AEAT</p>
          )}
          {huella && <p className="font-mono text-[9px] text-slate-400 break-all">Huella: {huella}</p>}
        </div>
      </div>

      {model.firma && (
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-2">
          <div className="border border-slate-300 rounded-md p-2 min-h-[70px] flex flex-col justify-between text-[11px] text-slate-800">
            <span>{model.textoFirma}</span>
            <span className="text-[10px] text-slate-500">Fecha:</span>
          </div>
          <div className="border border-slate-300 rounded-md p-2 min-h-[70px] text-[11px] text-slate-800">
            <span className="block">POR LA EMPRESA</span>
            {assets.firmaDataUrl && <img src={assets.firmaDataUrl} alt="Firma de la empresa" className="h-12 max-w-[180px] object-contain mt-1" />}
          </div>
        </div>
      )}

      {model.pie && <p className="text-[9px] leading-snug text-slate-500">{model.pie}</p>}
    </div>
  );
}
