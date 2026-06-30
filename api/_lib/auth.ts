import { createHmac, timingSafeEqual } from 'node:crypto'
import type { ApiRequest, ApiResponse } from './http.js'

const COOKIE_NAME = 'car_tracker_session'
const SESSION_SECONDS = 60 * 60 * 24 * 30

function secret() {
  const value = process.env.SESSION_SECRET
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters.')
  return value
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function createSessionCookie() {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS
  const payload = String(expires)
  const token = `${payload}.${sign(payload)}`
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
}

export function hasValidSession(request: ApiRequest) {
  const cookies = request.headers.cookie || ''
  const token = cookies
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1)

  if (!token) return false
  const [expires, signature] = token.split('.')
  if (!expires || !signature || Number(expires) <= Math.floor(Date.now() / 1000)) return false
  return safeEqual(signature, sign(expires))
}

export function passcodeMatches(candidate: unknown) {
  const expected = process.env.APP_PASSCODE
  if (!expected || !/^\d{4}$/.test(expected)) throw new Error('APP_PASSCODE must be exactly 4 digits.')
  return typeof candidate === 'string' && /^\d{4}$/.test(candidate) && safeEqual(candidate, expected)
}

export function requireSession(request: ApiRequest, response: ApiResponse) {
  if (hasValidSession(request)) return true
  response.status(401).json({ error: 'Your session is locked.' })
  return false
}
