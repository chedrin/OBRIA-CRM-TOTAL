import {
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
  BellRing,
  ListChecks
} from 'lucide-react';

// Menú principal: cada módulo tiene su icono y su color para reconocerlo de un vistazo.
// Las clases van escritas completas para que Tailwind las genere.
export const NAV_TONES = {
  sky: {
    tile: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    tileActive: 'bg-sky-500 text-white border-sky-500 shadow-sky-500/30',
    bar: 'bg-sky-500',
    ring: 'ring-sky-500/30'
  },
  amber: {
    tile: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    tileActive: 'bg-amber-500 text-white border-amber-500 shadow-amber-500/30',
    bar: 'bg-amber-500',
    ring: 'ring-amber-500/30'
  },
  violet: {
    tile: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    tileActive: 'bg-violet-500 text-white border-violet-500 shadow-violet-500/30',
    bar: 'bg-violet-500',
    ring: 'ring-violet-500/30'
  },
  indigo: {
    tile: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    tileActive: 'bg-indigo-500 text-white border-indigo-500 shadow-indigo-500/30',
    bar: 'bg-indigo-500',
    ring: 'ring-indigo-500/30'
  },
  emerald: {
    tile: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    tileActive: 'bg-emerald-500 text-white border-emerald-500 shadow-emerald-500/30',
    bar: 'bg-emerald-500',
    ring: 'ring-emerald-500/30'
  },
  teal: {
    tile: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    tileActive: 'bg-teal-500 text-white border-teal-500 shadow-teal-500/30',
    bar: 'bg-teal-500',
    ring: 'ring-teal-500/30'
  },
  orange: {
    tile: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    tileActive: 'bg-orange-500 text-white border-orange-500 shadow-orange-500/30',
    bar: 'bg-orange-500',
    ring: 'ring-orange-500/30'
  },
  rose: {
    tile: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    tileActive: 'bg-rose-500 text-white border-rose-500 shadow-rose-500/30',
    bar: 'bg-rose-500',
    ring: 'ring-rose-500/30'
  },
  cyan: {
    tile: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    tileActive: 'bg-cyan-500 text-white border-cyan-500 shadow-cyan-500/30',
    bar: 'bg-cyan-500',
    ring: 'ring-cyan-500/30'
  },
  red: {
    tile: 'bg-red-500/10 text-red-400 border-red-500/20',
    tileActive: 'bg-red-500 text-white border-red-500 shadow-red-500/30',
    bar: 'bg-red-500',
    ring: 'ring-red-500/30'
  },
  slate: {
    tile: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    tileActive: 'bg-slate-600 text-white border-slate-600 shadow-slate-500/30 om-solid',
    bar: 'bg-slate-500',
    ring: 'ring-slate-500/30'
  }
};

export const NAV_SECTIONS = [
  {
    title: 'Operaciones',
    items: [
      { id: 'dashboard', label: 'Panel General', desc: 'KPIs y estado global', icon: Building2, tone: 'sky' },
      { id: 'obras', label: 'Obras y Reformas', desc: 'Fases, costes y partes', icon: HardHat, tone: 'amber' },
      { id: 'avance', label: 'Avance de Obra', desc: 'Asignaciones, avance y certificación', icon: ListChecks, tone: 'emerald' },
      { id: 'avisos', label: 'Avisos y Pedidos', desc: 'Necesidades, material y subcontratas', icon: BellRing, tone: 'red' },
      { id: 'inbox', label: 'Audio / Email IA', desc: 'Captura y transcripción', icon: Mic, tone: 'violet' }
    ]
  },
  {
    title: 'Económico',
    items: [
      { id: 'presupuestos', label: 'Presupuestos IA', desc: 'Asistente y partidas', icon: Calculator, tone: 'indigo' },
      { id: 'facturas', label: 'Facturación', desc: 'Emitidas y certificaciones', icon: Receipt, tone: 'emerald' },
      { id: 'gestoria', label: 'Gestoría & Trimestres', desc: 'Modelos 303 / 130', icon: FileSpreadsheet, tone: 'teal' }
    ]
  },
  {
    title: 'Equipo',
    items: [
      { id: 'obreros', label: 'RRHH & Nóminas', desc: 'Plantilla y accesos', icon: Users, tone: 'orange' },
      { id: 'subcontratas', label: 'Subcontratas & PRL', desc: 'Ofertas y scoring', icon: Percent, tone: 'rose' }
    ]
  },
  {
    title: 'Sistema',
    items: [
      { id: 'portal_obrero', label: 'Portal Obrero Móvil', desc: 'Vista previa operario', icon: Smartphone, tone: 'cyan' },
      { id: 'empresa_config', label: 'Ajustes', desc: 'Empresa, IA, usuarios y apariencia', icon: ShieldCheck, tone: 'slate' }
    ]
  }
];

export const NAV_ITEMS = NAV_SECTIONS.flatMap(s => s.items);
