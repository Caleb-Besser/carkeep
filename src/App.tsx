import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Camera,
  CarFront,
  ChevronDown,
  CircleGauge,
  ClipboardCheck,
  Droplets,
  Fuel,
  KeyRound,
  Lock,
  NotebookPen,
  Plus,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react'
import { api, uploadEntryPhotos } from './api'
import { PHOTO_TYPES } from './checks'
import type { CheckInput, CheckStatus, CheckSummary, DashboardData } from './types'
import './App.css'

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const numberFormatter = new Intl.NumberFormat('en-US')

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : 'Never checked'
}

function relativeDue(check: CheckSummary) {
  if (check.due_status === 'due') return 'Due now'
  const days = Math.max(1, Math.ceil((new Date(check.next_due!).getTime() - Date.now()) / 86_400_000))
  return `In ${days} day${days === 1 ? '' : 's'}`
}

function statusLabel(status: CheckStatus) {
  return status.replace('_', ' ')
}

function StatusPill({ status }: { status: string }) {
  return <span className={`pill pill-${status}`}>{status.replace('_', ' ')}</span>
}

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pin.length !== 4) return
    setBusy(true)
    setError('')
    try {
      await api.unlock(pin)
      onUnlock()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That PIN did not work.')
      setPin('')
      inputRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="gate">
      <div className="gate-card">
        <div className="brand-mark"><img src="/carkeep-icon.png" alt="" /></div>
        <p className="eyebrow">Personal garage</p>
        <h1>CarKeep</h1>
        <p className="muted">Enter your 4-digit PIN to check in on your ILX.</p>
        <form onSubmit={submit}>
          <label htmlFor="pin">App PIN</label>
          <input
            ref={inputRef}
            id="pin"
            className="pin-input"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            maxLength={4}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
            autoFocus
          />
          {error && <p className="form-error">{error}</p>}
          <button className="primary full" disabled={pin.length !== 4 || busy}>
            <KeyRound size={18} /> {busy ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>
      </div>
    </main>
  )
}

function CheckRow({ check }: { check: CheckSummary }) {
  return (
    <div className="check-row">
      <div>
        <strong>{check.label}</strong>
        <span>{formatDate(check.last_checked)} · {relativeDue(check)}</span>
      </div>
      <StatusPill status={check.status} />
    </div>
  )
}

function OilEstimate({ data, onMark }: { data: DashboardData; onMark: () => void }) {
  const latestMileage = data.latestEntry?.mileage
  const lastChange = data.car.last_oil_change_mileage
  let message = 'Add your last oil change mileage when you know it.'

  if (latestMileage != null && lastChange != null) {
    const remaining = lastChange + data.car.oil_change_interval - latestMileage
    if (remaining <= 0) message = `Estimate: overdue by ${numberFormatter.format(Math.abs(remaining))} miles`
    else if (remaining <= 500) message = `Estimate: due soon, ${numberFormatter.format(remaining)} miles left`
    else message = `Estimate: due in ${numberFormatter.format(remaining)} miles`
  }

  return (
    <div className="oil-box">
      <div><Wrench size={18} /><strong>{message}</strong></div>
      <p>Use the Acura Maintenance Minder as the official service reminder.</p>
      {latestMileage != null && <button className="text-button" onClick={onMark}>Mark oil changed</button>}
    </div>
  )
}

function Dashboard({
  data,
  onNewEntry,
  onLock,
  onRefresh,
}: {
  data: DashboardData
  onNewEntry: () => void
  onLock: () => void
  onRefresh: () => void
}) {
  const [markingOil, setMarkingOil] = useState(false)
  const latest = data.latestEntry
  const due = data.checks.filter((check) => check.due_status === 'due')
  const essentials = data.checks.filter((check) => check.category === 'Essentials')
  const maintenance = data.checks.filter((check) => check.category !== 'Essentials')

  async function markOil() {
    const suggested = latest?.mileage?.toString() ?? ''
    const value = window.prompt('Oil change mileage', suggested)
    if (!value) return
    const mileage = Number(value.replace(/,/g, ''))
    if (!Number.isInteger(mileage) || mileage < 0) return window.alert('Enter a valid mileage.')
    setMarkingOil(true)
    try {
      await api.markOilChanged(mileage)
      onRefresh()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not update oil mileage.')
    } finally {
      setMarkingOil(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div><p className="eyebrow">CarKeep</p><h1>{data.car.name}</h1></div>
        <button className="icon-button" onClick={onLock} aria-label="Lock app"><Lock size={19} /></button>
      </header>

      <section className="hero-card card">
        <div className="hero-stat">
          <span>Latest mileage</span>
          <strong>{latest ? numberFormatter.format(latest.mileage) : 'No entries yet'}</strong>
          {latest && <small>miles · {formatDate(latest.created_at)}</small>}
        </div>
        <div className="signal-grid">
          <div>
            <CircleGauge size={19} />
            <span>Maintenance Minder</span>
            <strong>{latest?.maintenance_minder_code || 'Not logged'}</strong>
          </div>
          <div className={latest?.check_engine_light ? 'warning-signal' : ''}>
            <AlertTriangle size={19} />
            <span>Check engine</span>
            <strong>{latest ? (latest.check_engine_light ? 'On' : 'Off') : 'Not logged'}</strong>
          </div>
        </div>
        <OilEstimate data={data} onMark={markOil} />
        {markingOil && <p className="saving-note">Updating...</p>}
      </section>

      <button className="primary new-entry" onClick={onNewEntry}><Plus size={21} /> New Entry</button>

      <section className="card due-card">
        <div className="section-heading">
          <div><p className="eyebrow">Checklist</p><h2>Due now</h2></div>
          <span className="count-badge">{due.length}</span>
        </div>
        {due.length ? due.map((check) => <CheckRow key={check.check_key} check={check} />) : (
          <div className="empty-state"><ShieldCheck size={24} /><p>Everything is current.</p></div>
        )}
      </section>

      <section className="card">
        <div className="section-heading"><div><p className="eyebrow">Reminder</p><h2>Last note</h2></div><NotebookPen size={21} /></div>
        <p className={latest?.note ? 'note-copy' : 'muted'}>{latest?.note || 'No reminder from your latest entry.'}</p>
      </section>

      <section className="card">
        <div className="section-heading"><div><p className="eyebrow">In the car</p><h2>Essentials</h2></div><ClipboardCheck size={21} /></div>
        {essentials.map((check) => <CheckRow key={check.check_key} check={check} />)}
      </section>

      <section className="card">
        <div className="section-heading"><div><p className="eyebrow">Under the hood</p><h2>Fluids & maintenance</h2></div><Droplets size={21} /></div>
        {maintenance.map((check) => <CheckRow key={check.check_key} check={check} />)}
      </section>

      <section className="card">
        <div className="section-heading"><div><p className="eyebrow">History</p><h2>Recent entries</h2></div></div>
        {data.recentEntries.length ? data.recentEntries.map((entry) => (
          <div className="entry-row" key={entry.id}>
            <div><strong>{numberFormatter.format(entry.mileage)} mi</strong><span>{formatDate(entry.created_at)}</span></div>
            <div className="entry-meta">{entry.fuel_level && <span><Fuel size={14} /> {entry.fuel_level}</span>}</div>
          </div>
        )) : <p className="muted">Your first check-in will appear here.</p>}
      </section>
      <footer>Personal reminder only · Follow your Acura Maintenance Minder</footer>
    </main>
  )
}

function CheckEditor({
  check,
  value,
  onChange,
}: {
  check: CheckSummary
  value: CheckInput
  onChange: (value: CheckInput) => void
}) {
  const [open, setOpen] = useState(check.due_status === 'due')
  const statuses = check.category === 'Essentials'
    ? ['good', 'missing', 'not_checked']
    : ['good', 'low', 'bad', 'not_checked']

  return (
    <div className={`check-editor ${check.due_status === 'due' ? 'is-due' : ''}`}>
      <button type="button" className="check-editor-head" onClick={() => setOpen(!open)}>
        <div>
          <strong>{check.label}</strong>
          <span>{check.due_status === 'due' ? 'Due now' : `Not due · ${relativeDue(check)}`}</span>
        </div>
        <ChevronDown className={open ? 'rotated' : ''} size={19} />
      </button>
      {open && (
        <div className="check-editor-body">
          <div className="choice-grid">
            {statuses.map((status) => (
              <button
                type="button"
                key={status}
                className={value.status === status ? `choice selected status-${status}` : 'choice'}
                onClick={() => onChange({ ...value, status: status as CheckStatus })}
              >
                {statusLabel(status as CheckStatus)}
              </button>
            ))}
          </div>
          <input
            aria-label={`${check.label} note`}
            placeholder="Optional note"
            value={value.note}
            onChange={(event) => onChange({ ...value, note: event.target.value })}
          />
        </div>
      )}
    </div>
  )
}

function NewEntry({
  data,
  onCancel,
  onSaved,
}: {
  data: DashboardData
  onCancel: () => void
  onSaved: () => void
}) {
  const [mileage, setMileage] = useState(data.latestEntry?.mileage?.toString() ?? '')
  const [fuel, setFuel] = useState('1/2')
  const [engineLight, setEngineLight] = useState(false)
  const [minder, setMinder] = useState('')
  const [note, setNote] = useState('')
  const [files, setFiles] = useState<Record<string, File>>({})
  const [checks, setChecks] = useState<Record<string, CheckInput>>(() =>
    Object.fromEntries(data.checks.map((check) => [check.check_key, {
      check_key: check.check_key,
      label: check.label,
      category: check.category,
      status: 'not_checked',
      note: '',
    }]))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dueChecks = data.checks.filter((check) => check.due_status === 'due')
  const optionalChecks = data.checks.filter((check) => check.due_status !== 'due')

  function updateCheck(key: string, value: CheckInput) {
    setChecks((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const numericMileage = Number(mileage.replace(/,/g, ''))
    if (!Number.isInteger(numericMileage) || numericMileage < 0) {
      setError('Enter a valid mileage.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const result = await api.createEntry({
        mileage: numericMileage,
        fuel_level: fuel,
        check_engine_light: engineLight,
        maintenance_minder_code: minder.trim(),
        note: note.trim(),
        checks: Object.values(checks),
        photoTypes: Object.keys(files),
      })
      try {
        const photos = await uploadEntryPhotos(result.uploads, files)
        if (photos.length) await api.savePhotos(result.entryId, photos)
      } catch (photoError) {
        window.alert(`Your entry was saved, but the photos could not be attached. ${photoError instanceof Error ? photoError.message : ''}`)
      }
      onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this entry.')
      setSaving(false)
    }
  }

  return (
    <main className="app-shell entry-page">
      <header className="app-header">
        <div><p className="eyebrow">2016 Acura ILX 4D</p><h1>New entry</h1></div>
        <button className="icon-button" onClick={onCancel} aria-label="Close entry"><X size={21} /></button>
      </header>
      <form onSubmit={submit}>
        <section className="card form-card">
          <div className="section-heading"><div><p className="eyebrow">Step 1</p><h2>Basic stats</h2></div><CircleGauge size={21} /></div>
          <label>Mileage <span>Required</span><input required inputMode="numeric" placeholder="e.g. 82,450" value={mileage} onChange={(e) => setMileage(e.target.value)} /></label>
          <label>Fuel level
            <select value={fuel} onChange={(e) => setFuel(e.target.value)}>
              <option>Empty</option><option>1/4</option><option>1/2</option><option>3/4</option><option>Full</option>
            </select>
          </label>
          <label>Maintenance Minder code <input placeholder="e.g. A1" value={minder} onChange={(e) => setMinder(e.target.value.toUpperCase())} /></label>
          <label className="toggle-row">
            <div><strong>Check engine light</strong><span>{engineLight ? 'Light is on' : 'Light is off'}</span></div>
            <input type="checkbox" checked={engineLight} onChange={(e) => setEngineLight(e.target.checked)} />
          </label>
          <label>Note or reminder <textarea rows={3} placeholder="What should I remember next time?" value={note} onChange={(e) => setNote(e.target.value)} /></label>
        </section>

        <section className="card form-card">
          <div className="section-heading"><div><p className="eyebrow">Optional</p><h2>Outside photos</h2></div><Camera size={21} /></div>
          <p className="muted section-intro">Add only the angles useful today.</p>
          <div className="photo-grid">
            {PHOTO_TYPES.map(([key, label]) => (
              <label className={files[key] ? 'photo-input has-file' : 'photo-input'} key={key}>
                <Camera size={19} /><span>{files[key]?.name || label}</span>
                <input type="file" accept="image/*" capture="environment" onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setFiles((current) => ({ ...current, [key]: file }))
                }} />
              </label>
            ))}
          </div>
        </section>

        <section className="card form-card due-card">
          <div className="section-heading"><div><p className="eyebrow">Checklist</p><h2>Due now</h2></div><span className="count-badge">{dueChecks.length}</span></div>
          {dueChecks.length ? dueChecks.map((check) => <CheckEditor key={check.check_key} check={check} value={checks[check.check_key]} onChange={(value) => updateCheck(check.check_key, value)} />) : <p className="muted">Nothing is due today.</p>}
        </section>

        {optionalChecks.length > 0 && (
          <section className="card form-card optional-card">
            <div className="section-heading"><div><p className="eyebrow">Optional today</p><h2>Not due</h2></div></div>
            <p className="muted section-intro">Open any item you want to check early.</p>
            {optionalChecks.map((check) => <CheckEditor key={check.check_key} check={check} value={checks[check.check_key]} onChange={(value) => updateCheck(check.check_key, value)} />)}
          </section>
        )}

        {error && <p className="form-error submit-error">{error}</p>}
        <button className="primary full save-button" disabled={saving}>{saving ? 'Saving entry...' : 'Save entry'}</button>
        <button type="button" className="secondary full" onClick={onCancel} disabled={saving}>Cancel</button>
      </form>
    </main>
  )
}

function App() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [entryOpen, setEntryOpen] = useState(false)
  const [error, setError] = useState('')

  async function loadDashboard() {
    setError('')
    try {
      setData(await api.dashboard())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load your car.')
    }
  }

  useEffect(() => {
    api.session()
      .then(({ unlocked: active }) => {
        setUnlocked(active)
        if (active) loadDashboard()
      })
      .catch(() => setUnlocked(false))
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [entryOpen])

  const content = useMemo(() => {
    if (unlocked === null) return <div className="loading-screen"><CarFront size={34} /><p>Starting CarKeep...</p></div>
    if (!unlocked) return <PinGate onUnlock={() => { setUnlocked(true); loadDashboard() }} />
    if (error) return <main className="gate"><div className="gate-card"><AlertTriangle size={30} /><h1>Could not load</h1><p className="muted">{error}</p><button className="primary full" onClick={loadDashboard}>Try again</button></div></main>
    if (!data) return <div className="loading-screen"><CarFront size={34} /><p>Loading your ILX...</p></div>
    if (entryOpen) return <NewEntry data={data} onCancel={() => setEntryOpen(false)} onSaved={() => { setEntryOpen(false); loadDashboard() }} />
    return <Dashboard data={data} onNewEntry={() => setEntryOpen(true)} onRefresh={loadDashboard} onLock={async () => { await api.lock(); setUnlocked(false); setData(null) }} />
  }, [data, entryOpen, error, unlocked])

  return content
}

export default App
