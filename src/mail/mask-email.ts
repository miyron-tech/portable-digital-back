/** `john.doe@example.com` → `j***@example.com` — для логов, где полный адрес не нужен. */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf('@');
  if (at <= 0) return '***';
  return `${address[0]}***${address.slice(at)}`;
}
