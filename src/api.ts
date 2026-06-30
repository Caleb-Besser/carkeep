import { createClient } from '@supabase/supabase-js'
import type { CheckInput, DashboardData } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Something went wrong.')
  return body
}

export const api = {
  session: () => request<{ unlocked: boolean }>('/api/session'),
  unlock: (passcode: string) =>
    request<{ unlocked: boolean }>('/api/session', {
      method: 'POST',
      body: JSON.stringify({ passcode }),
    }),
  lock: () => request<void>('/api/session', { method: 'DELETE' }),
  dashboard: () => request<DashboardData>('/api/dashboard'),
  markOilChanged: (mileage: number) =>
    request<void>('/api/oil-change', {
      method: 'POST',
      body: JSON.stringify({ mileage }),
    }),
  createEntry: (payload: {
    mileage: number
    fuel_level: string
    check_engine_light: boolean
    maintenance_minder_code: string
    note: string
    checks: CheckInput[]
    photoTypes: string[]
  }) =>
    request<{
      entryId: string
      uploads: { photoType: string; path: string; token: string }[]
    }>('/api/entries', { method: 'POST', body: JSON.stringify(payload) }),
  savePhotos: (entryId: string, photos: { photo_type: string; photo_path: string }[]) =>
    request<void>('/api/photos', {
      method: 'POST',
      body: JSON.stringify({ entryId, photos }),
    }),
}

export async function uploadEntryPhotos(
  uploads: { photoType: string; path: string; token: string }[],
  files: Record<string, File>,
) {
  if (!uploads.length) return []

  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Photo upload environment variables are missing.')

  const storage = createClient(url, anonKey).storage.from('car-entry-photos')
  const completed: { photo_type: string; photo_path: string }[] = []

  for (const upload of uploads) {
    const file = files[upload.photoType]
    if (!file) continue
    const { error } = await storage.uploadToSignedUrl(upload.path, upload.token, file, {
      contentType: file.type || 'image/jpeg',
    })
    if (error) throw error
    completed.push({ photo_type: upload.photoType, photo_path: upload.path })
  }

  return completed
}
