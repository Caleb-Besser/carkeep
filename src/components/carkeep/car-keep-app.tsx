"use client";

import {
  AlertTriangle, ArrowLeft, ArrowRight, Battery, Camera, Car, Check,
  CheckCircle2, ChevronRight, CircleHelp, ClipboardCheck, Droplets,
  Gauge, History, Home, Lightbulb, Minus, PackageOpen, Settings2,
  ShieldCheck, Sparkles, SprayCan, Trash2, Wind,
} from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";

type Tab = "home" | "history" | "issues" | "car";
type SessionKind = "Weekly Check" | "Monthly Refresh";
type Result = "good" | "attention" | "skip" | "unsure" | "light" | "supplies";
type CheckItem = { id: string; title: string; instruction: string; icon: ComponentType<{ size?: number; strokeWidth?: number }>; kind?: "mileage" | "tires" | "cleaning" };
type Answer = { result?: Result; note?: string; photo?: string; mileage?: string; psi?: Record<string, string> };
type SavedSession = { id: string; kind: SessionKind; date: string; answers: Record<string, Answer> };
type Issue = { id: string; title: string; date: string; status: "Watching" | "Needs Fix" | "Fixed"; note?: string; photo?: string };
type Store = { sessions: SavedSession[]; issues: Issue[]; targets: Record<string, string>; units: "US" | "Metric" };

const weekly: CheckItem[] = [
  { id: "mileage", title: "Mileage", instruction: "Record the current odometer reading.", icon: Gauge, kind: "mileage" },
  { id: "warnings", title: "Dashboard warning lights", instruction: "Start the car and look for any warning lights that stay on.", icon: Lightbulb },
  { id: "oil", title: "Oil", instruction: "Check the oil level on flat ground with a cool engine.", icon: Droplets },
  { id: "coolant", title: "Coolant", instruction: "Check that the coolant sits between the minimum and maximum marks.", icon: Droplets },
  { id: "brake-fluid", title: "Brake fluid", instruction: "Look through the reservoir and check that the level is in range.", icon: Droplets },
  { id: "wiper-fluid", title: "Wiper fluid", instruction: "Check the washer fluid level and top it up if needed.", icon: SprayCan },
  { id: "tire-pressure", title: "Tire pressure", instruction: "Check all four tires while they are cold, if possible.", icon: Gauge, kind: "tires" },
  { id: "tire-condition", title: "Tire condition", instruction: "Walk around the car and look for cuts, bulges, or visible damage.", icon: CircleHelp },
  { id: "leaks", title: "Leaks under car", instruction: "Look beneath the car for fresh spots or drips.", icon: Droplets },
  { id: "wipers", title: "Wipers and washer spray", instruction: "Test the wipers and make sure the spray reaches the windshield.", icon: Wind },
  { id: "registration", title: "Registration present", instruction: "Confirm the current registration is in the car.", icon: ClipboardCheck },
  { id: "insurance", title: "Insurance present", instruction: "Confirm your current insurance card is easy to find.", icon: ShieldCheck },
  { id: "window-cover", title: "Front window cover", instruction: "Make sure the sunshade is in the car and ready to use.", icon: ShieldCheck },
  { id: "vacuum", title: "Vacuum interior", instruction: "Give the seats and floor a quick reset.", icon: Sparkles, kind: "cleaning" },
  { id: "trash", title: "Clear trash and organize", instruction: "Remove loose trash and put everyday items back in place.", icon: Trash2, kind: "cleaning" },
  { id: "wash", title: "Wash exterior", instruction: "Clean the exterior if it needs a reset.", icon: SprayCan, kind: "cleaning" },
  { id: "windows", title: "Clean windows", instruction: "Clear fingerprints and haze inside and out.", icon: Sparkles, kind: "cleaning" },
  { id: "ac", title: "AC smell and airflow", instruction: "Run the climate system and notice weak airflow or unusual smells.", icon: Wind },
];

const monthlyExtra: CheckItem[] = [
  { id: "tread", title: "Tire tread and wear", instruction: "Look for low tread or uneven wear across all four tires.", icon: Gauge },
  { id: "lights", title: "Exterior lights", instruction: "Check headlights, brake lights, turn signals, and reverse lights.", icon: Lightbulb },
  { id: "blades", title: "Wiper blade condition", instruction: "Look for cracks, splits, or streaking rubber.", icon: Wind },
  { id: "emergency", title: "Spare tire and emergency supplies", instruction: "Confirm the spare, jack, and essentials are present.", icon: PackageOpen },
  { id: "battery", title: "Battery visual check", instruction: "Look for corrosion, swelling, or loose connections.", icon: Battery },
  { id: "trunk", title: "Trunk organization", instruction: "Remove clutter and secure loose items.", icon: PackageOpen, kind: "cleaning" },
  { id: "belts", title: "Seat belts and floor mats", instruction: "Check belt movement and make sure floor mats are secure.", icon: ShieldCheck },
  { id: "damage", title: "Exterior damage check", instruction: "Walk around slowly and note new scratches, chips, or dents.", icon: Car },
];

const initialStore: Store = { sessions: [], issues: [], targets: { fl: "33", fr: "33", rl: "32", rr: "32" }, units: "US" };
const choiceCopy: Record<Result, string> = { good: "Good", attention: "Needs Attention", skip: "Skip", unsure: "Not Sure", light: "Light cleanup only", supplies: "Needs supplies" };

function useStore() {
  const [store, setStore] = useState<Store>(initialStore);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("carkeep-v2");
      if (saved) setStore({ ...initialStore, ...JSON.parse(saved) });
    } finally { setReady(true); }
  }, []);
  useEffect(() => { if (ready) localStorage.setItem("carkeep-v2", JSON.stringify(store)); }, [store, ready]);
  return [store, setStore] as const;
}

export default function CarKeepApp() {
  const [tab, setTab] = useState<Tab>("home");
  const [store, setStore] = useStore();
  const [session, setSession] = useState<{ kind: SessionKind; step: number; answers: Record<string, Answer> } | null>(null);
  const [completed, setCompleted] = useState<SavedSession | null>(null);
  const [detail, setDetail] = useState<SavedSession | null>(null);

  const begin = (kind: SessionKind) => { setCompleted(null); setSession({ kind, step: -1, answers: {} }); };
  if (session) {
    const items = session.kind === "Weekly Check" ? weekly : [...weekly, ...monthlyExtra];
    if (session.step === -1) return <SessionIntro kind={session.kind} onBack={() => setSession(null)} onStart={() => setSession({ ...session, step: 0 })} />;
    if (session.step >= items.length) {
      const saved = completed ?? { id: crypto.randomUUID(), kind: session.kind, date: new Date().toISOString(), answers: session.answers };
      if (!completed) {
        const newIssues = items.filter(i => session.answers[i.id]?.result === "attention" || session.answers[i.id]?.result === "supplies").map(i => ({
          id: crypto.randomUUID(), title: i.title, date: saved.date, status: "Watching" as const,
          note: session.answers[i.id]?.note, photo: session.answers[i.id]?.photo,
        }));
        setStore(s => ({ ...s, sessions: [saved, ...s.sessions], issues: [...newIssues, ...s.issues] }));
        setCompleted(saved);
      }
      return <SessionComplete session={saved} items={items} onDone={() => { setSession(null); setCompleted(null); setTab("home"); }} onSummary={() => setDetail(saved)} />;
    }
    const item = items[session.step];
    return <SessionStep item={item} index={session.step} total={items.length} answer={session.answers[item.id] ?? {}} onChange={answer => setSession({ ...session, answers: { ...session.answers, [item.id]: answer } })} onBack={() => setSession({ ...session, step: session.step - 1 })} onNext={() => setSession({ ...session, step: session.step + 1 })} />;
  }

  return (
    <div className="ck-shell">
      <Sidebar tab={tab} setTab={t => { setDetail(null); setTab(t); }} />
      <main className="ck-main">
        {detail ? <SessionDetail session={detail} onBack={() => setDetail(null)} /> :
          tab === "home" ? <HomeView store={store} begin={begin} setTab={setTab} /> :
          tab === "history" ? <HistoryView sessions={store.sessions} open={setDetail} /> :
          tab === "issues" ? <IssuesView issues={store.issues} update={issues => setStore(s => ({ ...s, issues }))} /> :
          <CarView store={store} begin={begin} update={patch => setStore(s => ({ ...s, ...patch }))} />}
      </main>
    </div>
  );
}

function Sidebar({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  const nav: [Tab, string, ComponentType<{ size?: number }>][] = [["home", "Home", Home], ["history", "History", History], ["issues", "Issues", AlertTriangle], ["car", "Car", Car]];
  return <nav className="ck-nav"><div className="ck-brand"><div className="ck-logo"><Check size={19} /></div><span>CarKeep</span></div><div className="ck-nav-items">{nav.map(([id, label, Icon]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={20} /><span>{label}</span></button>)}</div><div className="ck-nav-car"><span>2016 Acura</span><strong>ILX · 4D</strong></div></nav>;
}

function PageHead({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: React.ReactNode }) {
  return <header className="ck-page-head"><div><p>{eyebrow}</p><h1>{title}</h1></div>{aside}</header>;
}

function HomeView({ store, begin, setTab }: { store: Store; begin: (k: SessionKind) => void; setTab: (t: Tab) => void }) {
  const lastWeekly = store.sessions.find(s => s.kind === "Weekly Check");
  const lastMonthly = store.sessions.find(s => s.kind === "Monthly Refresh");
  const open = store.issues.filter(i => i.status !== "Fixed");
  return <div className="ck-page ck-home"><PageHead eyebrow="2016 Acura ILX · 4D" title="Good evening" aside={<div className="ck-car-orb"><Car size={28} /></div>} />
    <div className="home-checks">
      <section className="hero-card"><div className="hero-glow" /><div className="hero-copy"><span className="section-kicker"><CheckCircle2 size={16} /> Your weekly routine</span><h2>Weekly Car Reset</h2><p>{completionAge(lastWeekly)}</p></div><button className="primary-action" onClick={() => begin("Weekly Check")}><span><Check size={24} /></span>Start Weekly Check<ArrowRight size={21} /></button></section>
      <section className="monthly-home-card"><div><span className="section-kicker"><Sparkles size={16} /> Deeper reset</span><h2>Monthly Refresh</h2><p>{completionAge(lastMonthly)}</p></div><button className="primary-action monthly-action" onClick={() => begin("Monthly Refresh")}><span><Sparkles size={22} /></span>Start Monthly Refresh<ArrowRight size={21} /></button></section>
    </div>
    <button className="attention-card" onClick={() => setTab("issues")}><span className="attention-icon"><AlertTriangle size={22} /></span><span><strong>Needs Attention</strong><small>{open.length ? `${open.length} open · ${open[0].title}` : "Nothing needs your attention"}</small></span><ChevronRight size={20} /></button>
  </div>;
}

function SessionIntro({ kind, onBack, onStart }: { kind: SessionKind; onBack: () => void; onStart: () => void }) {
  const count = kind === "Weekly Check" ? weekly.length : weekly.length + monthlyExtra.length;
  return <div className="focus-screen"><div className="focus-top"><button className="icon-btn" onClick={onBack}><ArrowLeft /></button><span>Start {kind}</span><span /></div><div className="intro-visual"><Car size={88} strokeWidth={1.1} /></div><div className="intro-body"><span className="section-kicker"><ClipboardCheck size={16} /> {count} simple checks</span><h1>{kind}</h1><p>Take it one item at a time. There’s no rush, and you can skip anything you can’t check today.</p><label className="mileage-preview">Starting note <textarea placeholder="Anything you want to remember before you begin?" /></label><button className="wide-primary" onClick={onStart}>Start Check <ArrowRight size={20} /></button></div></div>;
}

function SessionStep({ item, index, total, answer, onChange, onBack, onNext }: { item: CheckItem; index: number; total: number; answer: Answer; onChange: (a: Answer) => void; onBack: () => void; onNext: () => void }) {
  const Icon = item.icon;
  const cleaning = item.kind === "cleaning";
  const choices: { value: Result; label: string; icon: ComponentType<{ size?: number }>; tone: string }[] = cleaning
    ? [{ value: "good", label: "Done", icon: Check, tone: "good" }, { value: "light", label: "Light cleanup only", icon: Sparkles, tone: "" }, { value: "skip", label: "Skipped", icon: Minus, tone: "" }, { value: "supplies", label: "Needs supplies", icon: AlertTriangle, tone: "warn" }]
    : [{ value: "good", label: "Good", icon: Check, tone: "good" }, { value: "attention", label: "Needs Attention", icon: AlertTriangle, tone: "warn" }, { value: "skip", label: "Skip", icon: Minus, tone: "" }, { value: "unsure", label: "Not Sure", icon: CircleHelp, tone: "" }];
  const showExtra = ["attention", "unsure", "supplies"].includes(answer.result ?? "");
  const canNext = item.kind === "mileage" ? Boolean(answer.mileage) : Boolean(answer.result);
  return <div className="focus-screen step-screen"><div className="focus-top"><button className="icon-btn" onClick={onBack}><ArrowLeft /></button><div><strong>{index < total ? (total === weekly.length ? "Weekly Check" : "Monthly Refresh") : ""}</strong><small>Step {index + 1} of {total}</small></div><span /></div><div className="progress-track"><span style={{ width: `${((index + 1) / total) * 100}%` }} /></div><div className="check-content"><div className="check-icon"><Icon size={42} strokeWidth={1.5} /></div><h1>{item.title}</h1><p>{item.instruction}</p>
    {item.kind === "mileage" ? <label className="odometer"><input autoFocus inputMode="numeric" value={answer.mileage ?? ""} onChange={e => onChange({ ...answer, mileage: e.target.value.replace(/\D/g, "") })} placeholder="108432" /><span>mi</span></label> :
      <><div className="status-grid">{choices.map(({ value, label, icon: ChoiceIcon, tone }) => <button key={value} className={`status-choice ${tone} ${answer.result === value ? "selected" : ""}`} onClick={() => onChange({ ...answer, result: value })}><ChoiceIcon size={29} /><span>{label}</span></button>)}</div>
      {item.kind === "tires" && <TireInputs value={answer.psi ?? {}} onChange={psi => onChange({ ...answer, psi })} />}
      {showExtra && <div className="extra-fields"><label>Note <textarea value={answer.note ?? ""} onChange={e => onChange({ ...answer, note: e.target.value })} placeholder="What did you notice?" /></label><label className="photo-button"><Camera size={19} />{answer.photo ? "Photo added" : "Add a photo"}<input type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (file) onChange({ ...answer, photo: file.name }); }} /></label></div>}</>}
  </div><div className="step-actions"><button className="secondary-action" onClick={onBack}>Back</button><button className="wide-primary" disabled={!canNext} onClick={onNext}>{index === total - 1 ? "Finish" : "Next"} <ArrowRight size={19} /></button></div></div>;
}

function TireInputs({ value, onChange }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  return <div className="tire-panel"><div className="car-silhouette"><Car size={62} strokeWidth={1.2} /></div>{[["fl","Front left"],["fr","Front right"],["rl","Rear left"],["rr","Rear right"]].map(([id,label]) => <label key={id}><span>{label}</span><span><input inputMode="numeric" value={value[id] ?? ""} onChange={e => onChange({ ...value, [id]: e.target.value.replace(/\D/g, "").slice(0, 2) })} placeholder="—" /> PSI</span></label>)}</div>;
}

function SessionComplete({ session, items, onDone, onSummary }: { session: SavedSession; items: CheckItem[]; onDone: () => void; onSummary: () => void }) {
  const counts = summary(session);
  return <div className="focus-screen complete-screen"><div className="celebrate"><span className="success-ring"><Check size={50} /></span><h1>{session.kind}<br />Complete!</h1><p>{items.length} checks completed</p><div className="summary-counts"><div><strong>{counts.good}</strong><span>Good</span></div><div><strong>{counts.attention}</strong><span>Needs attention</span></div><div><strong>{counts.skipped}</strong><span>Skipped</span></div></div></div><div className="complete-actions"><button className="wide-primary" onClick={onSummary}>View Summary</button><button className="secondary-action" onClick={onDone}>Done</button></div></div>;
}

function HistoryView({ sessions, open }: { sessions: SavedSession[]; open: (s: SavedSession) => void }) {
  return <div className="ck-page"><PageHead eyebrow="Your car-care record" title="History" /><div className="list-stack">{sessions.length ? sessions.map(s => { const counts = summary(s); return <button className="history-card" key={s.id} onClick={() => open(s)}><span className="history-date"><strong>{new Date(s.date).getDate()}</strong><small>{new Date(s.date).toLocaleDateString("en-US",{month:"short"})}</small></span><span><strong>{s.kind}</strong><small>{counts.good} good · {counts.attention} needs attention · {counts.skipped} skipped</small></span><ChevronRight /></button>; }) : <Empty icon={History} title="No checks yet" text="Your completed weekly and monthly sessions will appear here." />}</div></div>;
}

function IssuesView({ issues, update }: { issues: Issue[]; update: (i: Issue[]) => void }) {
  const open = issues.filter(i => i.status !== "Fixed"), fixed = issues.filter(i => i.status === "Fixed");
  const card = (issue: Issue) => <article className="issue-card" key={issue.id}><div className="issue-top"><span className="attention-icon"><AlertTriangle size={20} /></span><div><h3>{issue.title}</h3><p>Found {friendlyDate(issue.date)}</p></div><span className={`issue-status ${issue.status === "Fixed" ? "fixed" : ""}`}>{issue.status}</span></div>{issue.note && <p className="issue-note">{issue.note}</p>}{issue.photo && <span className="photo-tag"><Camera size={15} /> 1 photo</span>}{issue.status !== "Fixed" && <div className="issue-actions"><select value={issue.status} onChange={e => update(issues.map(i => i.id === issue.id ? { ...i, status: e.target.value as Issue["status"] } : i))}><option>Watching</option><option>Needs Fix</option></select><button onClick={() => update(issues.map(i => i.id === issue.id ? { ...i, status: "Fixed" } : i))}><Check size={17} /> Mark fixed</button></div>}</article>;
  return <div className="ck-page"><PageHead eyebrow={`${open.length} open ${open.length === 1 ? "item" : "items"}`} title="Issues" /><section><h2 className="list-heading">Needs attention</h2><div className="list-stack">{open.length ? open.map(card) : <Empty icon={CheckCircle2} title="All clear" text="Anything marked during a check will show up here." />}</div></section>{fixed.length > 0 && <section className="resolved"><h2 className="list-heading">Resolved</h2><div className="list-stack">{fixed.map(card)}</div></section>}</div>;
}

function CarView({ store, begin, update }: { store: Store; begin: (k: SessionKind) => void; update: (s: Partial<Store>) => void }) {
  return <div className="ck-page"><PageHead eyebrow="Your garage" title="2016 Acura ILX 4D" aside={<div className="ck-car-orb"><Car size={29} /></div>} /><section className="settings-card"><div className="settings-title"><Gauge /><div><h2>Tire pressure targets</h2><p>Used as a quiet reference during tire checks.</p></div></div><div className="target-grid">{[["fl","Front left"],["fr","Front right"],["rl","Rear left"],["rr","Rear right"]].map(([id,label]) => <label key={id}>{label}<span><input inputMode="numeric" value={store.targets[id]} onChange={e => update({ targets: { ...store.targets, [id]: e.target.value } })} /> PSI</span></label>)}</div></section><button className="settings-row" onClick={() => update({ units: store.units === "US" ? "Metric" : "US" })}><span><Settings2 /><span><strong>Units</strong><small>Mileage and pressure display</small></span></span><span>{store.units}<ChevronRight /></span></button><button className="monthly-card" onClick={() => begin("Monthly Refresh")}><span><Sparkles /></span><span><strong>Start Monthly Refresh</strong><small>Weekly routine plus 8 deeper checks</small></span><ArrowRight /></button><p className="car-footnote">CarKeep is for your personal check-in records. It won’t add service schedules or maintenance reminders.</p></div>;
}

function SessionDetail({ session, onBack }: { session: SavedSession; onBack: () => void }) {
  const items = session.kind === "Weekly Check" ? weekly : [...weekly, ...monthlyExtra];
  return <div className="ck-page"><button className="back-link" onClick={onBack}><ArrowLeft size={18} /> History</button><PageHead eyebrow={friendlyDate(session.date)} title={session.kind} /><div className="detail-list">{items.map(item => { const a = session.answers[item.id]; return <div key={item.id}><span>{item.title}</span><strong className={a?.result === "attention" || a?.result === "supplies" ? "amber" : ""}>{a?.mileage ? `${Number(a.mileage).toLocaleString()} mi` : a?.result ? choiceCopy[a.result] : "Skipped"}</strong>{a?.note && <small>{a.note}</small>}</div>; })}</div></div>;
}

function Empty({ icon: Icon, title, text }: { icon: ComponentType<{ size?: number }>; title: string; text: string }) {
  return <div className="empty-state"><Icon size={34} /><h3>{title}</h3><p>{text}</p></div>;
}

function summary(session: SavedSession) {
  const values = Object.values(session.answers);
  return { good: values.filter(a => a.result === "good" || a.result === "light" || a.mileage).length, attention: values.filter(a => a.result === "attention" || a.result === "supplies").length, skipped: values.filter(a => a.result === "skip" || a.result === "unsure").length };
}
function friendlyDate(date: string) { return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: new Date(date).getFullYear() === new Date().getFullYear() ? undefined : "numeric" }); }
function completionAge(session?: SavedSession) {
  if (!session) return "Not completed yet";
  const elapsed = Math.max(0, Date.now() - new Date(session.date).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Last completed just now";
  if (minutes < 60) return `Last completed ${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last completed ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Last completed ${days} ${days === 1 ? "day" : "days"} ago`;
  const months = Math.floor(days / 30);
  return `Last completed ${months} ${months === 1 ? "month" : "months"} ago`;
}
