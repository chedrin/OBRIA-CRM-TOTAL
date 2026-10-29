import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Send,
  Share2,
  X,
  Phone,
  Mail,
  ShieldCheck,
  Copy,
  MessageSquare,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  sendTemplateEmail,
  sendWhatsAppCloudMessage,
  buildWhatsAppDirectUrl
} from '../../services/documentDispatchService';
import { renderEmail } from '../../utils/emailTemplates';
import { documentPdfAttachment } from '../../utils/documentPdf';

const eur = (n) => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SendDocumentModal({
  isOpen,
  onClose,
  document,
  documentType = 'presupuesto',
  onSent
}) {
  const { empresaConfig, facturacion, facturas = [], showNotification, addAuditLog, updatePresupuesto, updateFactura } = useApp();
  const backdropRef = useRef(null);

  if (!isOpen || !document) return null;

  const handleBackdropClick = (e) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  const isInvoice = documentType === 'factura';
  const typeLabel = isInvoice ? 'Factura' : 'Presupuesto';
  const docNumber = document.numero || 'DOC-001';
  const docTitle = document.obraTitulo || document.titulo || 'Reforma';
  const docClient = document.cliente || 'Cliente';
  const totalConIva = isInvoice ? (document.totalFactura || document.totalConIva || 0) : (document.totalConIva || 0);
  const baseImponible = document.baseImponible || 0;
  const cuotaIva = isInvoice ? (document.cuotaIva || 0) : (document.cuotaIva || document.ivaImporte || 0);
  const ivaPct = document.tipoIvaPct || 10;

  const [channel, setChannel] = useState('both');
  const [telefono, setTelefono] = useState(document.telefono || '+34 620 445 112');
  const [email, setEmail] = useState(document.email || 'cliente@ejemplo.es');
  const [whatsAppMethod, setWhatsAppMethod] = useState('direct');
  const [isSending, setIsSending] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const signatureLink = isInvoice
    ? `https://obramaster.app/facturas/${document.id || 'f-1'}/verifactu`
    : `https://obramaster.app/presupuestos/${document.id || 'p-1'}/firmar-digital`;

  const defaultMsg = isInvoice
    ? `Hola ${docClient}, te adjuntamos la ${typeLabel} formal ${docNumber} por un importe de ${Number(totalConIva).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} correspondiente a ${docTitle}.\n\nPuedes consultar el documento oficial y el código VeriFactu aquí:\n${signatureLink}\n\nQuedamos a tu entera disposición. Un cordial saludo,\n${empresaConfig.directorNombre || 'Director de Obra'} - ${empresaConfig.nombreEmpresa || 'ObraMaster'}`
    : `Hola ${docClient}, te adjunto el ${typeLabel} técnico formal ${docNumber} para ${docTitle} por un importe total de ${Number(totalConIva).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}.\n\nPuedes revisarlo y firmarlo digitalmente con plena validez legal LOE en este enlace:\n${signatureLink}\n\nQuedo a tu disposición para cualquier duda o ajuste. Saludos cordiales,\n${empresaConfig.directorNombre || 'Director de Obra'} - ${empresaConfig.nombreEmpresa || 'ObraMaster'}`;

  const [customMsg, setCustomMsg] = useState(defaultMsg);

  // Correo: sale de la plantilla de Ajustes > Correos y se puede retocar para este envío.
  const emailVariables = {
    cliente: docClient,
    numero: docNumber,
    obra: docTitle,
    base: eur(baseImponible),
    iva: eur(cuotaIva),
    total: eur(totalConIva),
    fecha: isInvoice ? (document.fechaEmision || '') : (document.fecha || ''),
    vencimiento: document.fechaVencimiento || '',
    iban: empresaConfig.iban || '',
    enlace: ''
  };
  const [emailDraft] = useState(() => renderEmail(documentType, emailVariables, { templates: empresaConfig.plantillasCorreo, empresa: empresaConfig }));
  const [emailAsunto, setEmailAsunto] = useState(emailDraft.subject);
  const [emailCuerpo, setEmailCuerpo] = useState(emailDraft.text);
  const [adjuntarPdf, setAdjuntarPdf] = useState(true);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(signatureLink);
    setCopiedLink(true);
    showNotification('Enlace oficial copiado al portapapeles');
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleSend = async () => {
    setIsSending(true);

    try {
      if (channel === 'email' || channel === 'both') {
        const attachments = adjuntarPdf
          ? [await documentPdfAttachment({ type: documentType, data: document, empresaConfig, facturacion, facturas })]
          : undefined;
        const sent = await sendTemplateEmail({
          tipo: documentType === 'factura' ? 'factura' : 'presupuesto',
          to: email,
          variables: emailVariables,
          asunto: emailAsunto,
          cuerpo: emailCuerpo,
          attachments
        });
        if (sent.provider === 'simulated_smtp') showNotification(sent.message, 'warning');
      }

      if (channel === 'whatsapp' || channel === 'both') {
        if (whatsAppMethod === 'cloud') {
          await sendWhatsAppCloudMessage({
            phone: telefono,
            messageText: customMsg
          });
        } else {
          const directUrl = buildWhatsAppDirectUrl({
            phone: telefono,
            messageText: customMsg
          });
          window.open(directUrl, '_blank');
        }
      }

      const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 16);
      const envioData = {
        fecha: nowIso,
        canal: channel === 'whatsapp' ? 'WhatsApp' : channel === 'email' ? 'Email' : 'WhatsApp & Email',
        destinatario: channel === 'email' ? email : telefono,
        enlace: signatureLink,
        estadoEnvio: 'entregado'
      };

      if (!isInvoice) {
        updatePresupuesto(document.id, {
          estado: 'enviado_cliente',
          envioCliente: envioData
        });
        addAuditLog('PRESUPUESTO_ENVIADO', `${docNumber} enviado a ${docClient} vía ${envioData.canal}`);
      } else {
        if (updateFactura) {
          updateFactura(document.id, {
            envioCliente: envioData
          });
        }
        addAuditLog('FACTURA_ENVIADA', `${docNumber} enviada a ${docClient} vía ${envioData.canal}`);
      }

      confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
      showNotification(`✨ ¡${typeLabel} ${docNumber} enviado con éxito!`);

      setIsSending(false);
      onClose();
      if (onSent) onSent();
    } catch (err) {
      console.error('Error enviando documento:', err);
      setIsSending(false);
      showNotification(`Error en el envío: ${err.message}`, 'error');
    }
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto transition-all duration-200 ease-out"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl shadow-2xl p-5 sm:p-6 space-y-4 text-slate-100 my-auto transform transition-all duration-200 ease-out scale-100">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">Enviar {typeLabel} al Cliente</h3>
              <p className="text-xs text-slate-400">{docNumber} · {docClient}</p>
            </div>
          </div>

          <button
            onClick={onClose} aria-label="Cerrar"
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Amount & Legal Stamp Banner */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/40 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Importe Total con IVA ({ivaPct}%)</span>
            <span className="text-xl sm:text-2xl font-black text-white">
              {Number(totalConIva).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </span>
          </div>

          <div className="text-right text-[11px] text-emerald-400 flex items-center gap-1.5 font-semibold bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
            <ShieldCheck className="w-4 h-4" />
            <span>{isInvoice ? 'VeriFactu Ready' : 'Firma Digital LOE'}</span>
          </div>
        </div>

        {/* Channel Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 block">Canal de Envío:</label>
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
            <label className="text-slate-400 block mb-1">Móvil del Cliente (WhatsApp):</label>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2">
              <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full bg-transparent text-white focus:outline-none"
                placeholder="+34 600 000 000"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Email del Cliente:</label>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2">
              <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent text-white focus:outline-none"
                placeholder="cliente@ejemplo.es"
              />
            </div>
          </div>
        </div>

        {/* Signature / Document Link Preview */}
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
            <span>{copiedLink ? '¡Copiado!' : 'Copiar'}</span>
          </button>
        </div>

        {/* Correo (plantilla de Ajustes > Correos) */}
        {channel !== 'whatsapp' && (
          <div className="space-y-2 text-xs">
            <label className="text-slate-400 block">Asunto del correo:</label>
            <input
              type="text"
              value={emailAsunto}
              onChange={(e) => setEmailAsunto(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-400"
            />
            <label className="text-slate-400 block">Texto del correo (plantilla de Ajustes &gt; Correos):</label>
            <textarea
              rows="6"
              value={emailCuerpo}
              onChange={(e) => setEmailCuerpo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-400 font-sans"
            ></textarea>
            <label className="flex items-center gap-2 text-slate-300">
              <input type="checkbox" checked={adjuntarPdf} onChange={(e) => setAdjuntarPdf(e.target.checked)} className="accent-emerald-500" />
              Adjuntar el PDF ({docNumber}.pdf)
            </label>
          </div>
        )}

        {/* Message preview */}
        {channel !== 'email' && <div>
          <label className="text-slate-400 text-xs block mb-1">Texto del WhatsApp:</label>
          <textarea
            rows="3"
            value={customMsg}
            onChange={(e) => setCustomMsg(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-400 font-sans"
          ></textarea>
        </div>}

        {/* Actions - Positioned bottom right as specified in AGENTS.md */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition active:scale-95 disabled:opacity-50"
          >
            {isSending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4 fill-slate-950" />
                <span>Enviar Documento Ahora</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
