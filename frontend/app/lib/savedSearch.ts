// Saved-list search: case-insensitive substring match on the application name, with
// the query trimmed. An empty (or whitespace-only) query matches everything.
export function matchesSearch(name: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  return q === '' || name.toLowerCase().includes(q)
}
