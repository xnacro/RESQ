// Joins truthy class names, keeps JSX readable
export function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}
