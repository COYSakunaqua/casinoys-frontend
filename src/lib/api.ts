export const apiUrl = (): string => {
  return process.env.NEXT_PUBLIC_API_URL?.trim() ?? ''
}

export const apiFetchPath = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${apiUrl() || ''}${normalizedPath}`
}
