'use client'

import { useState, useEffect, useMemo } from 'react'

type Booking = {
  id: string; room: string; date: string; startTime: string; endTime: string
  duration: number; name: string; email: string; cause: string; justification: string
  status: 'pending' | 'approved' | 'rejected'; adminNote: string; createdAt: string
}

const ROOMS = [
  { id: '502', cls: 'r502', name: 'Conf. Hall 502', icon: '🏛️' },
  { id: 'aqua', cls: 'raqu', name: 'Aqua', icon: '🫧' },
  { id: 'ignis', cls: 'rign', name: 'Ignis', icon: '🔥' },
]
const DURATIONS = [
  { value: 30, label: '30 min' }, { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hrs' }, { value: 120, label: '2 hours' },
  { value: 150, label: '2.5 hrs' }, { value: 180, label: '3 hours' },
  { value: 210, label: '3.5 hrs' }, { value: 240, label: '4 hours' },
]

const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const fromMins = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const fmtTime = (t: string) => {
  const m = toMins(t), h = Math.floor(m / 60), min = m % 60
  return `${h > 12 ? h - 12 : h || 12}:${String(min).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
const fmtDate = (d: string) =>
  new Date(d + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const today = () => new Date().toISOString().split('T')[0]
const roomName = (id: string) => ROOMS.find(r => r.id === id)?.name ?? id
const roomCls = (id: string) => ROOMS.find(r => r.id === id)?.cls ?? ''

export default function BookingPage() {
  const [room, setRoom] = useState('')
  const [date, setDate] = useState('')
  const [duration, setDuration] = useState(60)
  const [startTime, setStartTime] = useState('')
  const [cause, setCause] = useState('')
  const [justification, setJustification] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const [conflicts, setConflicts] = useState<{ startTime: string; endTime: string }[]>([])
  const [successId, setSuccessId] = useState('')

  const [lookupEmail, setLookupEmail] = useState('')
  const [myBookings, setMyBookings] = useState<Booking[]>([])
  const [lookupDone, setLookupDone] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)

  const startTimes = useMemo(() => {
    const times: string[] = []
    for (let t = 9 * 60; t + duration <= 19 * 60; t += 30) times.push(fromMins(t))
    return times
  }, [duration])

  useEffect(() => {
    if (!startTimes.includes(startTime)) setStartTime(startTimes[0] ?? '')
  }, [startTimes, startTime])

  const endTime = startTime ? fromMins(toMins(startTime) + duration) : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!room) { setError('Please select a room first.'); setStatus('error'); return }

    setStatus('loading')
    setError('')
    setConflicts([])

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, date, startTime, duration, name, email, cause, justification }),
      })
      const data = await res.json()

      if (res.ok) {
        setSuccessId(data.booking.id)
        setStatus('success')
        setRoom(''); setDate(''); setCause(''); setJustification(''); setName(''); setEmail('')
      } else if (res.status === 409) {
        setConflicts(data.conflicts ?? [])
        setError(data.error)
        setStatus('error')
      } else {
        setError(data.error ?? 'Something went wrong. Please try again.')
        setStatus('error')
      }
    } catch {
      setError('Network error. Please try again.')
      setStatus('error')
    }
  }

  const lookupBookings = async () => {
    if (!lookupEmail.trim()) return
    setLookupLoading(true)
    try {
      const res = await fetch(`/api/bookings?email=${encodeURIComponent(lookupEmail)}`)
      const data = await res.json()
      setMyBookings(data.bookings ?? [])
      setLookupDone(true)
    } finally {
      setLookupLoading(false)
    }
  }

  return (
    <>
      <header className="header">
        <div className="logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="7" fill="#4361EE"/>
            <rect x="6" y="8" width="16" height="12" rx="2" stroke="white" strokeWidth="1.5"/>
            <rect x="9" y="13" width="4" height="4" rx="1" fill="white"/>
            <rect x="15" y="13" width="4" height="4" rx="1" fill="white"/>
            <rect x="11" y="10" width="6" height="2" rx="1" fill="white" opacity=".6"/>
          </svg>
          BookSpace
        </div>
        <a href="/admin" className="admin-link">Admin →</a>
      </header>

      <main className="main">
        <div className="hero">
          <h1>Reserve your<br /><em>space</em></h1>
          <p>Submit a request for one of three conference rooms.</p>
        </div>

        <div style={{ marginBottom: 32 }}>
          <div className="section-label">Choose a room</div>
          <div className="rooms-grid">
            {ROOMS.map(r => (
              <div
                key={r.id}
                className={`room-card ${r.cls}${room === r.id ? ' selected' : ''}`}
                onClick={() => { setRoom(r.id); setStatus('idle') }}
              >
                <div className="room-info">
                  <strong>{r.name}</strong>
                </div>
                <div className="room-check" />
              </div>
            ))}
          </div>
        </div>

        <form className="booking-form" onSubmit={handleSubmit}>
          <div className="form-block">
            <h3>When?</h3>
            <div className="row">
              <div className="field">
                <label>Date</label>
                <input type="date" min={today()} value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div className="field">
                <label>Duration</label>
                <select value={duration} onChange={e => setDuration(Number(e.target.value))} required>
                  {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Start Time</label>
              <select value={startTime} onChange={e => setStartTime(e.target.value)} required>
                {startTimes.map(t => <option key={t} value={t}>{fmtTime(t)}</option>)}
              </select>
            </div>
            {startTime && endTime && (
              <div className="time-pill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                {fmtTime(startTime)} – {fmtTime(endTime)}
              </div>
            )}
          </div>

          <div className="form-block">
            <h3>Your event</h3>
            <div className="field">
              <label>Event Title / Cause</label>
              <input type="text" value={cause} onChange={e => setCause(e.target.value)} placeholder="e.g. Q2 Planning Meeting" required />
            </div>
            <div className="field">
              <label>Justification</label>
              <textarea value={justification} onChange={e => setJustification(e.target.value)} placeholder="Why do you need this space? Who will attend?" rows={3} required />
            </div>
          </div>

          <div className="form-block">
            <h3>Your details</h3>
            <div className="field">
              <label>Full Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" required />
            </div>
            <div className="field">
              <label>Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
            </div>
          </div>

          {status === 'error' && (
            <div className="error-box">
              <strong>{error}</strong>
              {conflicts.length > 0 && (
                <ul>
                  {conflicts.map((c, i) => (
                    <li key={i}>Already booked: {fmtTime(c.startTime)} – {fmtTime(c.endTime)}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button type="submit" className="btn-submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Checking availability…' : 'Request Booking →'}
          </button>
        </form>

        <div className="lookup-section">
          <h3>Track your request</h3>
          <p>Enter your email to see all your booking requests and their status.</p>
          <div className="lookup-row">
            <input
              type="email"
              value={lookupEmail}
              onChange={e => setLookupEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookupBookings()}
              placeholder="you@company.com"
            />
            <button type="button" onClick={lookupBookings} disabled={lookupLoading}>
              {lookupLoading ? '…' : 'Check'}
            </button>
          </div>
          {lookupDone && (
            <div className="lookup-results">
              {myBookings.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: 14, padding: '8px 0' }}>
                  No bookings found for this email.
                </p>
              ) : (
                myBookings.map(b => (
                  <div key={b.id} className={`status-card ${b.status}`}>
                    <div className="status-card-head">
                      <strong>{b.cause}</strong>
                      <span className={`badge ${b.status}`}>{b.status}</span>
                    </div>
                    <span className={`room-tag ${roomCls(b.room)}`}>{roomName(b.room)}</span>
                    <div className="status-card-meta">
                      <span>{fmtDate(b.date)} · {fmtTime(b.startTime)} – {fmtTime(b.endTime)}</span>
                      {b.adminNote && <span className="admin-note-text">Note: &quot;{b.adminNote}&quot;</span>}
                    </div>
                    <div className="booking-id">{b.id}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* Success Modal */}
      {status === 'success' && (
        <div className="overlay show" onClick={() => setStatus('idle')}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">✓</div>
            <h2>Request Submitted!</h2>
            <p>Your booking is now <strong>pending admin review</strong>. You&apos;ll be notified once it&apos;s approved.</p>
            <p>Your reference code:</p>
            <div className="ref-code">{successId}</div>
            <button className="modal-close" onClick={() => setStatus('idle')}>Done</button>
          </div>
        </div>
      )}
    </>
  )
}
