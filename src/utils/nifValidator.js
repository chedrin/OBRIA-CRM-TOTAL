// Validación de identificadores fiscales españoles: DNI (NIF de persona física), NIE y CIF.

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

function isValidDni(value) {
  const m = value.match(/^(\d{8})([A-Z])$/);
  return !!m && DNI_LETTERS[Number(m[1]) % 23] === m[2];
}

function isValidNie(value) {
  const m = value.match(/^([XYZ])(\d{7})([A-Z])$/);
  if (!m) return false;
  const num = Number(`${'XYZ'.indexOf(m[1])}${m[2]}`);
  return DNI_LETTERS[num % 23] === m[3];
}

function isValidCif(value) {
  const m = value.match(/^([ABCDEFGHJKLMNPQRSUVW])(\d{7})([0-9A-J])$/);
  if (!m) return false;
  const digits = m[2].split('').map(Number);
  let sum = 0;
  digits.forEach((d, i) => {
    if (i % 2 === 0) {
      const doubled = d * 2;
      sum += Math.floor(doubled / 10) + (doubled % 10);
    } else {
      sum += d;
    }
  });
  const control = (10 - (sum % 10)) % 10;
  const letter = 'JABCDEFGHI'[control];
  const type = m[1];
  if ('PQRSNW'.includes(type)) return m[3] === letter;
  if ('ABEH'.includes(type)) return m[3] === String(control);
  return m[3] === String(control) || m[3] === letter;
}

export function normalizeNif(value) {
  return String(value || '').toUpperCase().replace(/[\s.-]/g, '');
}

// Devuelve 'DNI', 'NIE' o 'CIF' si es válido; null si no lo es.
export function nifType(value) {
  const v = normalizeNif(value);
  if (isValidDni(v)) return 'DNI';
  if (isValidNie(v)) return 'NIE';
  if (isValidCif(v)) return 'CIF';
  return null;
}

export function isValidNif(value) {
  return nifType(value) !== null;
}
