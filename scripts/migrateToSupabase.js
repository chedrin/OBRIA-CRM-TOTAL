/**
 * Script de Migración de Datos de ObraMaster a Supabase
 * Convierte los datos locales de `src/data/initialData.js` a registros en las tablas de Supabase.
 *
 * INSTRUCCIONES PASO A PASO PARA EJECUTAR LA MIGRACIÓN:
 * 1. Accede al SQL Editor de tu proyecto Supabase (https://rgwgjystfzlcogxyaksx.supabase.co) y ejecuta el script SQL completo.
 * 2. Define las variables de entorno en tu terminal antes de ejecutar:
 *    export SUPABASE_URL="https://rgwgjystfzlcogxyaksx.supabase.co"
 *    export SUPABASE_SERVICE_ROLE_KEY="tu_clave_service_role_secret_de_supabase"
 * 3. Ejecuta el script de migración con Node.js:
 *    node scripts/migrateToSupabase.js
 */

import { createClient } from '@supabase/supabase-js';
import {
  INITIAL_EMPRESA_CONFIG,
  INITIAL_OBRAS,
  INITIAL_OBREROS,
  INITIAL_BASE_PRECIOS,
  INITIAL_PRESUPUESTOS,
  INITIAL_USERS,
  INITIAL_EMPLOYEES,
  INITIAL_SUBCONTRACTORS,
  INITIAL_AVISOS_TECNICOS
} from '../src/data/initialData.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://rgwgjystfzlcogxyaksx.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ Error: Debes definir la clave SUPABASE_SERVICE_ROLE_KEY (o VITE_SUPABASE_ANON_KEY) en tus variables de entorno para ejecutar el script.');
  console.error('Ejemplo: export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..." && node scripts/migrateToSupabase.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log(`🚀 Iniciando migración de datos hacia el proyecto Supabase: ${supabaseUrl}`);

  try {
    // 1. Datos de Empresa (company_settings)
    console.log('📦 Migrando datos de la empresa...');
    const { error: companyErr } = await supabase.from('company_settings').upsert({
      company_name: INITIAL_EMPRESA_CONFIG.razonSocial,
      commercial_name: INITIAL_EMPRESA_CONFIG.nombreComercial,
      tax_id: INITIAL_EMPRESA_CONFIG.cifNif,
      address: `${INITIAL_EMPRESA_CONFIG.direccion}, ${INITIAL_EMPRESA_CONFIG.codigoPostal} ${INITIAL_EMPRESA_CONFIG.localidad}`,
      phone: INITIAL_EMPRESA_CONFIG.telefono,
      email: INITIAL_EMPRESA_CONFIG.email,
      logo_url: INITIAL_EMPRESA_CONFIG.logoUrl,
      director_name: INITIAL_EMPRESA_CONFIG.directorNombre,
      director_title: INITIAL_EMPRESA_CONFIG.directorTitulacion,
      signature_url: INITIAL_EMPRESA_CONFIG.firmaUrl,
      bank_account_iban: INITIAL_EMPRESA_CONFIG.iban
    });

    if (companyErr) console.warn('⚠️ Error en company_settings:', companyErr.message);
    else console.log('✅ Datos de empresa migrados.');

    // 2. Configuración e Integración de IA Gemini (ai_integration_settings)
    console.log('🧠 Migrando configuración de API Key de Gemini e IA...');
    const { error: aiErr } = await supabase.from('ai_integration_settings').upsert({
      provider: INITIAL_EMPRESA_CONFIG.aiConfig?.provider || 'google',
      encrypted_api_key: INITIAL_EMPRESA_CONFIG.aiConfig?.apiKey || '',
      model_name: INITIAL_EMPRESA_CONFIG.aiConfig?.modelName || 'gemini-1.5-flash',
      is_active: true,
      last_tested_at: new Date().toISOString()
    });

    if (aiErr) console.warn('⚠️ Error en ai_integration_settings:', aiErr.message);
    else console.log('✅ Configuración de Gemini migrada.');

    // 3. Usuarios y Empleados (users & employees)
    console.log('👥 Migrando usuarios y empleados...');
    for (const u of INITIAL_USERS) {
      const { error: userErr } = await supabase.from('users').upsert({
        username: u.username,
        email: u.email,
        password_hash: u.password,
        role: u.role,
        full_name: u.fullName,
        trade: u.trade,
        phone: u.phone,
        is_active: u.isActive
      }, { onConflict: 'username' });

      if (userErr) console.warn(`⚠️ Error usuario ${u.username}:`, userErr.message);
    }

    for (const emp of INITIAL_EMPLOYEES) {
      const { error: empErr } = await supabase.from('employees').upsert({
        first_name: emp.nombre,
        last_name: emp.apellidos,
        dni_nie: emp.dni,
        naf_ss: emp.naf,
        birth_date: emp.fechaNacimiento,
        address: emp.direccion,
        phone: emp.telefono,
        email: emp.email,
        iban: emp.iban,
        professional_category: emp.categoria,
        main_trade: emp.especialidad,
        contract_type: emp.tipoContrato,
        monthly_base_salary: emp.salarioBaseMensual,
        hire_date: emp.fechaAlta,
        status: emp.estado === 'baja' ? 'despedido' : emp.estado
      }, { onConflict: 'dni_nie' });

      if (empErr) console.warn(`⚠️ Error empleado ${emp.nombre}:`, empErr.message);
    }
    console.log('✅ Usuarios y empleados migrados.');

    // 4. Subcontratas (subcontractors)
    console.log('🏗️ Migrando subcontratas...');
    for (const sub of INITIAL_SUBCONTRACTORS) {
      const { error: subErr } = await supabase.from('subcontractors').upsert({
        legal_name: sub.razonSocial,
        commercial_name: sub.nombreComercial,
        cif_nif: sub.cif,
        trade: sub.gremio,
        contact_person: sub.personaContacto,
        phone: sub.telefono,
        emergency_phone: sub.telefonoUrgencias,
        email: sub.email,
        fiscal_address: sub.direccion,
        insurance_company: sub.prl?.seguroRCCompania,
        insurance_policy_number: sub.prl?.seguroRCPoliza,
        insurance_insured_sum: sub.prl?.seguroRCSuma,
        insurance_expiry_date: sub.prl?.seguroRCFechaCaducidad,
        is_approved_for_site: sub.prl?.aptoEntrarObra ?? true,
        rating_average: sub.scoring?.media || 5.0
      }, { onConflict: 'cif_nif' });

      if (subErr) console.warn(`⚠️ Error subcontrata ${sub.razonSocial}:`, subErr.message);
    }
    console.log('✅ Subcontratas migradas.');

    // 5. Obras y Proyectos (projects)
    console.log('🏚️ Migrando obras y proyectos...');
    for (const obra of INITIAL_OBRAS) {
      const { error: projErr } = await supabase.from('projects').upsert({
        code: obra.codigo,
        title: obra.titulo,
        client_name: obra.cliente,
        client_phone: obra.telefono,
        client_email: obra.email,
        address: obra.direccion,
        status: obra.estado === 'presupuestada' ? 'estudio' : obra.estado,
        progress_percentage: obra.progreso,
        direct_cost: obra.costeRealActual,
        expected_margin_pct: obra.margenEsperadoPct
      }, { onConflict: 'code' });

      if (projErr) console.warn(`⚠️ Error obra ${obra.codigo}:`, projErr.message);
    }
    console.log('✅ Obras y proyectos migrados.');

    // 6. Presupuestos (quotes)
    console.log('📄 Migrando presupuestos...');
    for (const pres of INITIAL_PRESUPUESTOS) {
      const { error: quoteErr } = await supabase.from('quotes').upsert({
        quote_number: pres.numero,
        client_name: pres.cliente,
        client_email: pres.email || '',
        property_address: pres.direccion,
        subtotal: pres.baseImponible,
        tax_rate: pres.tipoIvaPct,
        tax_amount: pres.cuotaIva,
        total: pres.totalConIva,
        commercial_margin_pct: pres.margenGlobalPct || 35,
        status: pres.estado === 'aceptado' ? 'aceptado' : 'enviado_cliente'
      }, { onConflict: 'quote_number' });

      if (quoteErr) console.warn(`⚠️ Error presupuesto ${pres.numero}:`, quoteErr.message);
    }
    console.log('✅ Presupuestos migrados.');

    console.log('🎉 ¡Migración completada con éxito en tu proyecto Supabase!');
  } catch (err) {
    console.error('❌ Error durante la migración:', err);
  }
}

runMigration();
