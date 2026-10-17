import React from 'react';
import SendDocumentModal from '../Common/SendDocumentModal';

export default function EnvioClienteModal({ isOpen, onClose, quote, onSent }) {
  if (!isOpen || !quote) return null;

  return (
    <SendDocumentModal
      isOpen={isOpen}
      onClose={onClose}
      document={quote}
      documentType="presupuesto"
      onSent={onSent}
    />
  );
}
