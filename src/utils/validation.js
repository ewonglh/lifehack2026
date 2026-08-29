export function required(value, label) {
  return String(value || '').trim() ? null : `${label} is required.`;
}

export function email(value) {
  return /^\S+@\S+\.\S+$/.test(String(value || '')) ? null : 'Enter a valid email address.';
}

export function minLength(value, length, label) {
  return String(value || '').length >= length
    ? null
    : `${label} must be at least ${length} characters.`;
}
