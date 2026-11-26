/**
 * TRUST-MED AI — API helpers
 * Supabase removed. All data goes through the local store.
 * This file is kept for compatibility but is no longer used for data calls.
 */

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}
