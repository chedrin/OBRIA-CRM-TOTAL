// Llamadas a la API de avisos, necesidades, pedidos y enlaces (ver backend/notificaciones.js).
// La cabecera de sesión la añade installApiAuthHeader() automáticamente.

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
  return data;
}

export const NEED_CATEGORIES = [
  { value: 'material', label: 'Material' },
  { value: 'herramienta', label: 'Herramienta' },
  { value: 'maquinaria', label: 'Maquinaria' },
  { value: 'bloqueo', label: 'Tajo bloqueado' },
  { value: 'coordinacion', label: 'Coordinación' },
  { value: 'seguridad', label: 'Seguridad' },
  { value: 'otro', label: 'Otro' }
];

export const NEED_STATUS = {
  nueva: { label: 'Nueva', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  en_revision: { label: 'En revisión', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  pedido_tramitado: { label: 'Pedido tramitado · pendiente de entrega', cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
  entregado: { label: 'Entregado', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  resuelto: { label: 'Resuelto', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  descartada: { label: 'Descartada', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' }
};

export const ORDER_STATUS = {
  borrador: { label: 'Borrador', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  enviado: { label: 'Enviado', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  confirmado: { label: 'Confirmado', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  entregado: { label: 'Entregado', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  cancelado: { label: 'Cancelado', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
  error: { label: 'Error al enviar', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' }
};

export const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export const fmtDate = (iso) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export const inputCls = 'w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500';
export const btnPrimary = 'inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-2 text-sm transition disabled:opacity-50';
export const btnGhost = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-200 font-semibold px-3 py-2 text-sm transition disabled:opacity-50';
