import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { requireSession } from './_lib/auth.js'
import { CHECK_DEFINITIONS } from './_lib/checks.js'
import { getCar, getSupabase } from './_lib/supabase.js'

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' })
  if (!requireSession(request, response)) return

  try {
    const supabase = getSupabase()
    const car = await getCar()
    const [{ data: entries, error: entriesError }, { data: checkRows, error: checksError }] = await Promise.all([
      supabase.from('car_entries').select('*').eq('car_id', car.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('car_checks').select('*').eq('car_id', car.id).neq('status', 'not_checked').order('created_at', { ascending: false }),
    ])
    if (entriesError) throw entriesError
    if (checksError) throw checksError

    const latestByKey = new Map<string, (typeof checkRows)[number]>()
    for (const row of checkRows || []) {
      if (!latestByKey.has(row.check_key)) latestByKey.set(row.check_key, row)
    }

    const now = Date.now()
    const checks = CHECK_DEFINITIONS.map((definition) => {
      const latest = latestByKey.get(definition.check_key)
      const checkedAt = latest ? new Date(latest.created_at) : null
      const nextDue = checkedAt
        ? new Date(checkedAt.getTime() + definition.frequency_days * 86_400_000)
        : null
      return {
        ...definition,
        status: latest?.status || 'not_checked',
        note: latest?.note || null,
        last_checked: latest?.created_at || null,
        next_due: nextDue?.toISOString() || null,
        due_status: !nextDue || nextDue.getTime() <= now ? 'due' : 'not_due',
      }
    })

    return response.status(200).json({
      car: {
        id: car.id,
        name: car.name,
        last_oil_change_mileage: car.last_oil_change_mileage,
        oil_change_interval: car.oil_change_interval,
      },
      latestEntry: entries?.[0] || null,
      recentEntries: entries || [],
      checks,
    })
  } catch (error) {
    console.error(error)
    return response.status(500).json({ error: 'Could not load your car data.' })
  }
}
