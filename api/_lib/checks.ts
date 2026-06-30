export const CHECK_DEFINITIONS = [
  { check_key: 'jumper_cables', label: 'Jumper cables', category: 'Essentials', frequency_days: 7 },
  { check_key: 'registration', label: 'Registration', category: 'Essentials', frequency_days: 7 },
  { check_key: 'insurance', label: 'Insurance', category: 'Essentials', frequency_days: 7 },
  { check_key: 'washer_fluid_level', label: 'Washer fluid', category: 'Fluids', frequency_days: 7 },
  { check_key: 'engine_oil_level', label: 'Engine oil level', category: 'Fluids', frequency_days: 14 },
  { check_key: 'coolant_level', label: 'Coolant level', category: 'Fluids', frequency_days: 14 },
  { check_key: 'brake_fluid_level', label: 'Brake fluid level', category: 'Fluids', frequency_days: 30 },
  { check_key: 'tire_pressure', label: 'Tire pressure', category: 'Maintenance', frequency_days: 30 },
] as const

export const CHECK_KEYS = new Set(CHECK_DEFINITIONS.map((check) => check.check_key))
export const PHOTO_TYPES = new Set(['front', 'back', 'driver_side', 'passenger_side', 'extra'])

export function isAllowedStatus(category: string, status: string) {
  if (category === 'Essentials') return ['good', 'missing', 'not_checked'].includes(status)
  return ['good', 'low', 'bad', 'not_checked'].includes(status)
}
