/**
 * ObraMaster - Validación de NIF españoles (DNI, NIE, CIF y NIF especiales K/L/M)
 * comprobando la letra o el dígito de control.
 */

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";
const CIF_CONTROL_LETTERS = "JABCDEFGHI";

/** Quita espacios, guiones y puntos y pasa a mayúsculas. */
export function normalizarNif(value) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cifControl(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const n = Number(digits[i]);
    if (i % 2 === 0) {
      const doubled = n * 2;
      sum += Math.floor(doubled / 10) + (doubled % 10);
    } else {
      sum += n;
    }
  }
  return (10 - (sum % 10)) % 10;
}

/** Devuelve { valido, nif, tipo } con tipo "DNI" | "NIE" | "CIF" | "NIF especial". */
export function validarNif(value) {
  const nif = normalizarNif(value);

  if (/^\d{8}[A-Z]$/.test(nif)) {
    return { valido: DNI_LETTERS.charAt(Number(nif.slice(0, 8)) % 23) === nif.charAt(8), nif, tipo: "DNI" };
  }
  if (/^[XYZ]\d{7}[A-Z]$/.test(nif)) {
    const num = Number("XYZ".indexOf(nif.charAt(0)) + nif.slice(1, 8));
    return { valido: DNI_LETTERS.charAt(num % 23) === nif.charAt(8), nif, tipo: "NIE" };
  }
  if (/^[KLM]\d{7}[A-Z]$/.test(nif)) {
    return { valido: DNI_LETTERS.charAt(Number(nif.slice(1, 8)) % 23) === nif.charAt(8), nif, tipo: "NIF especial" };
  }
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(nif)) {
    const control = cifControl(nif.slice(1, 8));
    const first = nif.charAt(0);
    const last = nif.charAt(8);
    const asDigit = String(control);
    const asLetter = CIF_CONTROL_LETTERS.charAt(control);
    let valido;
    if ("PQRSNW".includes(first)) valido = last === asLetter;
    else if ("ABEH".includes(first)) valido = last === asDigit;
    else valido = last === asDigit || last === asLetter;
    return { valido, nif, tipo: "CIF" };
  }
  return { valido: false, nif, tipo: null };
}
