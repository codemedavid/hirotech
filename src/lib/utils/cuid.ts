/**
 * Generate a CUID (Collision-resistant Unique Identifier)
 * This is a simple implementation for client-side usage
 */
export function cuid(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 15)
  const counter = (Math.random() * 1000000).toString(36)
  
  return `c${timestamp}${random}${counter}`
}

