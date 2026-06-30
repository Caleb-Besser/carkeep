import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { requireSession } from './_lib/auth.js'
import { PHOTO_TYPES } from './_lib/checks.js'
import { getCar, getSupabase } from './_lib/supabase.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' })
  if (!requireSession(request, response)) return

  try {
    const entryId = String(request.body?.entryId || '')
    const photos = Array.isArray(request.body?.photos) ? request.body.photos : []
    if (!/^[0-9a-f-]{36}$/i.test(entryId) || photos.length > 5) {
      return response.status(400).json({ error: 'Invalid photo request.' })
    }

    const supabase = getSupabase()
    const car = await getCar()
    const rows = photos.map((photo: { photo_type?: string; photo_path?: string }) => {
      const type = String(photo.photo_type || '')
      const path = String(photo.photo_path || '')
      const expectedPrefix = `acura-ilx/${entryId}/${type}-`
      if (!PHOTO_TYPES.has(type) || !path.startsWith(expectedPrefix)) throw new Error('Invalid photo path.')
      return { entry_id: entryId, car_id: car.id, photo_type: type, photo_path: path }
    })

    if (rows.length) {
      const { error } = await supabase.from('car_entry_photos').insert(rows)
      if (error) throw error
    }
    return response.status(200).json({ saved: rows.length })
  } catch (error) {
    console.error(error)
    return response.status(400).json({ error: 'Could not attach the uploaded photos.' })
  }
}
