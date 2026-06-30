import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { requireSession } from './_lib/auth.js'
import { CHECK_DEFINITIONS, CHECK_KEYS, PHOTO_TYPES, isAllowedStatus } from './_lib/checks.js'
import { getCar, getSupabase } from './_lib/supabase.js'

type CheckBody = {
  check_key?: string
  label?: string
  category?: string
  status?: string
  note?: string
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' })
  if (!requireSession(request, response)) return

  try {
    const mileage = Number(request.body?.mileage)
    if (!Number.isInteger(mileage) || mileage < 0) {
      return response.status(400).json({ error: 'Mileage must be a positive whole number.' })
    }

    const checks: CheckBody[] = Array.isArray(request.body?.checks) ? request.body.checks : []
    const definitions = new Map(CHECK_DEFINITIONS.map((item) => [item.check_key, item]))
    for (const check of checks) {
      const definition = check.check_key ? definitions.get(check.check_key as never) : undefined
      if (!definition || !CHECK_KEYS.has(check.check_key as never) || !check.status || !isAllowedStatus(definition.category, check.status)) {
        return response.status(400).json({ error: 'One of the checklist values is invalid.' })
      }
    }

    const requestedPhotos = Array.isArray(request.body?.photoTypes)
      ? [...new Set<string>(request.body.photoTypes)].filter((type) => PHOTO_TYPES.has(type))
      : []
    const supabase = getSupabase()
    const car = await getCar()
    const { data: entry, error: entryError } = await supabase
      .from('car_entries')
      .insert({
        car_id: car.id,
        mileage,
        fuel_level: String(request.body?.fuel_level || '').slice(0, 20) || null,
        check_engine_light: Boolean(request.body?.check_engine_light),
        maintenance_minder_code: String(request.body?.maintenance_minder_code || '').trim().slice(0, 30) || null,
        note: String(request.body?.note || '').trim().slice(0, 2000) || null,
      })
      .select('id')
      .single()
    if (entryError) throw entryError

    const checkInserts = checks.map((check) => {
      const definition = definitions.get(check.check_key as never)!
      return {
        entry_id: entry.id,
        car_id: car.id,
        check_key: definition.check_key,
        label: definition.label,
        category: definition.category,
        status: check.status,
        note: String(check.note || '').trim().slice(0, 500) || null,
      }
    })
    if (checkInserts.length) {
      const { error } = await supabase.from('car_checks').insert(checkInserts)
      if (error) throw error
    }

    const uploads = []
    for (const photoType of requestedPhotos) {
      const path = `acura-ilx/${entry.id}/${photoType}-${Date.now()}.jpg`
      const { data, error } = await supabase.storage.from('car-entry-photos').createSignedUploadUrl(path)
      if (error) throw error
      uploads.push({ photoType, path, token: data.token })
    }

    return response.status(201).json({ entryId: entry.id, uploads })
  } catch (error) {
    console.error(error)
    return response.status(500).json({ error: 'Could not save this entry.' })
  }
}
