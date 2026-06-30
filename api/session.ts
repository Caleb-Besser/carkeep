import type { ApiRequest, ApiResponse } from './_lib/http.js'
import {
  clearSessionCookie,
  createSessionCookie,
  hasValidSession,
  passcodeMatches,
} from './_lib/auth.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  try {
    if (request.method === 'GET') {
      return response.status(200).json({ unlocked: hasValidSession(request) })
    }
    if (request.method === 'DELETE') {
      response.setHeader('Set-Cookie', clearSessionCookie())
      return response.status(200).json({ unlocked: false })
    }
    if (request.method === 'POST') {
      if (!passcodeMatches(request.body?.passcode)) {
        return response.status(401).json({ error: 'Incorrect PIN.' })
      }
      response.setHeader('Set-Cookie', createSessionCookie())
      return response.status(200).json({ unlocked: true })
    }
    return response.status(405).json({ error: 'Method not allowed.' })
  } catch (error) {
    console.error(error)
    return response.status(500).json({ error: 'The app is not configured yet.' })
  }
}
