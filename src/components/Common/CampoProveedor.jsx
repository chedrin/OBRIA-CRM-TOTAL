import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/avisosApi';
import ComboCrear from './ComboCrear';
import { useQuickCreate } from './QuickCreate';

/**
 * Campo "Proveedor / Subcontrata" de un gasto o factura recibida. Sugiere proveedores (Avisos >
 * Proveedores), subcontratas y nombres ya usados en facturas, y termina con "Crear nuevo
 * proveedor" y "Crear nueva subcontrata". onElegir({ proveedor, cif, origen }) al elegir o crear.
 */
export default function CampoProveedor({ value, onChange, onElegir, className, placeholder, required }) {
  const { subcontractors = [], facturasProveedores = [] } = useApp();
  const { crear } = useQuickCreate();
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    let vivo = true;
    api('/api/suppliers').then((d) => { if (vivo && Array.isArray(d)) setSuppliers(d); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const sugerencias = useMemo(() => {
    const vistos = new Set();
    const out = [];
    const add = (s) => {
      const k = s.valor.trim().toLowerCase();
      if (!k || vistos.has(k)) return;
      vistos.add(k);
      out.push(s);
    };
    suppliers.filter((s) => s.is_active !== false).forEach((s) => add({ key: `p-${s.id}`, valor: s.name, detalle: 'Proveedor', cif: '', origen: 'proveedor' }));
    subcontractors.forEach((s) => add({ key: `s-${s.id}`, valor: s.razonSocial || s.nombreComercial || '', detalle: 'Subcontrata', cif: s.cif || '', origen: 'subcontrata' }));
    facturasProveedores.forEach((f) => f.proveedor && add({ key: `f-${f.id}`, valor: f.proveedor, detalle: f.cif || '', cif: f.cif || '', origen: 'historial' }));
    return out.sort((a, b) => a.valor.localeCompare(b.valor, 'es'));
  }, [suppliers, subcontractors, facturasProveedores]);

  const elegir = (datos) => (onElegir ? onElegir(datos) : onChange(datos.proveedor));

  const acciones = [
    {
      key: 'proveedor',
      label: 'Crear nuevo proveedor',
      onClick: async (texto) => {
        const p = await crear('proveedor', { name: texto || '' });
        if (!p) return;
        setSuppliers((prev) => [...prev, p]);
        elegir({ proveedor: p.name, cif: '', origen: 'proveedor' });
      }
    },
    {
      key: 'subcontrata',
      label: 'Crear nueva subcontrata',
      onClick: async (texto) => {
        const s = await crear('subcontrata', { razonSocial: texto || '' });
        if (s) elegir({ proveedor: s.razonSocial, cif: s.cif || '', origen: 'subcontrata' });
      }
    }
  ];

  return (
    <ComboCrear
      value={value}
      onChange={onChange}
      sugerencias={sugerencias}
      onElegir={(s) => elegir({ proveedor: s.valor, cif: s.cif, origen: s.origen })}
      acciones={acciones}
      className={className}
      placeholder={placeholder}
      required={required}
    />
  );
}
