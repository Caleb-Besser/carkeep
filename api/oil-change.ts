import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { requireSession } from './_lib/auth.js'
import { getCar, getSupabase } from './_lib/supabase.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' })
  if (!requireSession(request, response)) return

  const mileage = Number(request.body?.mileage)
  if (!Number.isInteger(mileage) || mileage < 0) {
    return response.status(400).json({ error: 'Enter a valid oil change mileage.' })
  }

  try {
    const supabase = getSupabase()
    const car = await getCar()
    const { error } = await supabase.from('cars').update({ last_oil_change_mileage: mileage }).eq('id', car.id)
    if (error) throw error
    return response.status(200).json({ updated: true })
  } catch (error) {
    console.error(error)
    return response.status(500).json({ error: 'Could not update the oil change mileage.' })
  }
}
