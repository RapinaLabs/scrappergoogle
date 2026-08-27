/**
 * Parses a Brazilian address string into Street, City and State
 */
export function parseAddress(rawAddress = '') {
  if (!rawAddress || typeof rawAddress !== 'string') {
    return { endereco: '', cidade: '', estado: '' };
  }

  const parts = rawAddress.split(',').map(p => p.trim());
  let cidade = '';
  let estado = '';

  // Regex para Estado Brasileiro no final (ex: "SP", "RS", "SC", "PR", "RJ")
  const stateRegex = /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i;

  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    
    // Tenta achar estado com hífen (ex: "Porto Alegre - RS")
    if (part.includes('-')) {
      const subParts = part.split('-').map(s => s.trim());
      const possibleState = subParts[subParts.length - 1];
      const match = possibleState.match(stateRegex);
      if (match) {
        estado = match[1].toUpperCase();
        cidade = subParts[0];
        break;
      }
    }

    const match = part.match(stateRegex);
    if (match && !estado) {
      estado = match[1].toUpperCase();
      if (i > 0) {
        cidade = parts[i - 1];
      }
      break;
    }
  }

  return {
    endereco: rawAddress,
    cidade: cidade.replace(/\d{5}-?\d{3}/g, '').trim(),
    estado: estado
  };
}

/**
 * Standardizes phone numbers to standard E.164 without special characters
 */
export function formatPhoneNumber(rawPhone = '') {
  if (!rawPhone) return '';
  let clean = String(rawPhone).replace(/\D/g, '');
  if (clean.length === 10 || clean.length === 11) {
    clean = '55' + clean;
  }
  return clean;
}
