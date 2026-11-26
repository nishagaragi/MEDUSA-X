import { Handler } from '@netlify/functions'
import { authenticate, successResponse, unauthorizedResponse, optionsResponse } from '../lib/middleware'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse()

  const user = await authenticate(event)
  if (!user) return unauthorizedResponse()

  return successResponse({ data: user })
}
