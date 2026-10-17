import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Send,
  CheckCircle2,
  Share2,
  X,
  Phone,
  Mail,
  ExternalLink,
  ShieldCheck,
  FileCheck2,
  Copy,
  MessageSquare,
  QrCode
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function EnvioClienteModal({ isOpen, onClose, quote, onSent }) {
  const { approveAndSendQuote, empresaConfig, showNotification } = useApp();

  if (!isOpen || !quote) return null;

  const [channel, setChannel] = useState('whatsapp'); // whatsapp, email, both
  const [telefono, setTelefono] = useState(quote.telefono || '+34 600 000 000');
  const [email, setEmail] = useState(quote.email || 'cliente@ejemplo.es');
  const [copiedLink, setCopiedLink] = useState(false);

  const signatureLink = `https://obramaster.app/presupuestos/${quote.id || 'p-1'}/firmar-digital`;

  const defaultWhatsappMsg = `Hola ${quote.cliente}, te adjunto el presupuesto técnico formal ${quote.numero} para ${quote.obraTitulo} por un importe total de ${quote.totalConIva?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) || '0,00 €'}.\n\nPuedes revisarlo y firmarlo digitalmente con plena validez legal LOE en este enlace:\n${signatureLink}\n\nQuedo a tu disposición para cualquier duda. Saludos cordiales,\n${empresaConfig.directorNombre || 'Director de Obra'} - ${empresaConfig.nombreEmpresa || 'ObraMaster'}`;

  const [customMsg, setCustomMsg] = useState(defaultWhatsappMsg);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(signatureLink);
    setCopiedLink(true);
    showNotification('Enlace interactivo de firma copiado al portapapeles');
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleSendToClient = () => {
    approveAndSendQuote(quote.id, {
      canal: channel === 'whatsapp' ? 'WhatsApp' : channel === 'email' ? 'Email' : 'WhatsApp & Email',
      destinatario: channel === 'email' ? email : telefono
    });

    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.6 }
    });

    // If WhatsApp, open wa.me link
    if (channel === 'whatsapp' || channel === 'both') {
      const cleanPhone = telefono.replace(/\D/g, '');
      const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(customMsg)}`;
      window.open(waUrl, '_blank');
    }

    onClose();
    if (onSent) onSent();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-5 text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">Aprobar y Enviar al Cliente</h3>
              <p className="text-xs text-slate-400">Presupuesto {quote.numero} · {quote.cliente}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Amount & Legal Stamp Banner */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/30 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Importe Total con IVA (10%)</span>
            <span className="text-xl font-black text-white">
              {quote.totalConIva?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </span>
          </div>

          <div className="text-right text-[11px] text-emerald-400 flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>Firma LOE Lista</span>
          </div>
        </div>

        {/* Channel Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 block">Canal de Envío al Cliente:</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
              { id: 'email', label: 'Email', icon: Mail },
              { id: 'both', label: 'Ambos Canales', icon: Share2 }
            ].map(ch => {
              const Icon = ch.icon;
              const isSel = channel === ch.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setChannel(ch.id)}
                  className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                    isSel
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/30'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-bold">{ch.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Contact Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">Móvil del Cliente:</label>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2">
              <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full bg-transparent text-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Email del Cliente:</label>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2">
              <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent text-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Signature Link Preview */}
        <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl flex items-center justify-between gap-3 text-xs">
          <div className="min-w-0">
            <span className="text-[10px] text-slate-500 block">Enlace de Firma con Trazabilidad:</span>
            <span className="text-emerald-400 font-mono truncate block text-[11px]">{signatureLink}</span>
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg shrink-0 font-bold flex items-center gap-1 transition"
          >
            <Copy className="w-3 h-3" />
            <span>{copiedLink ? 'Copiado!' : 'Copiar'}</span>
          </button>
        </div>

        {/* Message preview */}
        <div>
          <label className="text-slate-400 text-xs block mb-1">Mensaje de acompañamiento:</label>
          <textarea
            rows="3"
            value={customMsg}
            onChange={(e) => setCustomMsg(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
          ></textarea>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSendToClient}
            className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition active:scale-95"
          >
            <Send className="w-4 h-4 fill-slate-950" />
            <span>Aprobar y Enviar Ahora</span>
          </button>
        </div>

      </div>
    </div>
  );
}
