export type CheckStatus = 'good' | 'missing' | 'low' | 'bad' | 'not_checked'

export type CheckDefinition = {
  check_key: string
  label: string
  category: 'Essentials' | 'Fluids' | 'Maintenance'
  frequency_days: number
}

export type CheckSummary = CheckDefinition & {
  status: CheckStatus
  note: string | null
  last_checked: string | null
  next_due: string | null
  due_status: 'due' | 'not_due'
}

export type Car = {
  id: string
  name: string
  last_oil_change_mileage: number | null
  oil_change_interval: number
}

export type Entry = {
  id: string
  mileage: number
  fuel_level: string | null
  check_engine_light: boolean
  maintenance_minder_code: string | null
  note: string | null
  created_at: string
}

export type DashboardData = {
  car: Car
  latestEntry: Entry | null
  recentEntries: Entry[]
  checks: CheckSummary[]
}

export type CheckInput = {
  check_key: string
  label: string
  category: string
  status: CheckStatus
  note: string
}
