import { createClient } from '@supabase/supabase-js'

export function getSupabase() {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase server environment variables are missing.')
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function getCar() {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('cars').select('*').limit(1).maybeSingle()
  if (error) throw error
  if (data) return data

  const { data: created, error: createError } = await supabase
    .from('cars')
    .insert({
      name: '2016 Acura ILX 4D',
      make: 'Acura',
      model: 'ILX',
      year: 2016,
      body_style: '4D',
      oil_change_interval: 5000,
    })
    .select('*')
    .single()
  if (createError) throw createError
  return created
}
