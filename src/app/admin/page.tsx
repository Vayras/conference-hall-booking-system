'use client'

import { useState, useEffect, useCallback } from 'react'

type Booking = {
  id: string; room: string; date: string; startTime: string; endTime: string
  duration: number; name: string; email: string; cause: string; justification: string
  status: 'pending' | 'approved' | 'rejected'; adminNote: string; createdAt: string
}
type Filter = 'all' | 'pending' | 'approved' | 'rejected'

const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const fmtTime = (t: string) => {
  const m = toMins(t), h = Math.floor(m / 60), min = m % 60
  return `${h > 12 ? h - 12 : h || 12}:${String(min).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
const fmtDate = (d: string) =>
  new Date(d + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const ROOM_NAMES: Record<string, string> = { '502': 'Conf. Hall 502', aqua: 'Aqua', ignis: 'Ignis' }
const ROOM_CLS: Record<string, string> = { '502': 'r502', aqua: 'raqu', ignis: 'rign' }
const roomName = (id: string) => ROOM_NAMES[id] ?? id
const roomCls = (id: string) => ROOM_CLS[id] ?? ''
const fmtDur = (min: number) => min >= 60 ? (min % 60 === 0 ? min / 60 + 'h' : (min / 60).toFixed(1) + 'h') : min + 'm'

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState<Filter>('all')

  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState('')

  const showToast = (msg: string, type = '') => {
    setToast(msg); setToastType(type)
    setTimeout(() => setToast(''), 3200)
  }

  const fetchBookings = useCallback(async (pw: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/bookings', { headers: { 'x-admin-password': pw } })
      if (res.status === 401) { setAuthed(false); return }
      const data = await res.json()
      setBookings(data.bookings ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  const doLogin = async () => {
    setLoginError(false)
    const res = await fetch('/api/admin/bookings', { headers: { 'x-admin-password': password } })
    if (res.ok) {
      sessionStorage.setItem('bs_admin_pw', password)
      setAuthed(true)
      const data = await res.json()
      setBookings(data.bookings ?? [])
    } else {
      setLoginError(true)
      setTimeout(() => setLoginError(false), 2000)
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('bs_admin_pw')
    if (saved) { setPassword(saved); setAuthed(true); fetchBookings(saved) }
  }, [fetchBookings])

  const openReview = (b: Booking) => {
    setReviewBooking(b)
    setAdminNote(b.adminNote || '')
    setActionError('')
  }

  const doAction = async (action: 'approved' | 'rejected') => {
    if (!reviewBooking) return
    setActionLoading(true)
    setActionError('')
    try {
      const res = await fetch(`/api/admin/bookings/${reviewBooking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ status: action, adminNote }),
      })
      const data = await res.json()

      if (res.ok) {
        setBookings(prev => prev.map(b => b.id === reviewBooking.id ? data.booking : b))
        setReviewBooking(null)
        showToast(action === 'approved' ? 'Booking approved ✓' : 'Booking rejected', action === 'approved' ? 'ok' : 'err')
      } else if (res.status === 409) {
        const conflictTimes = (data.conflicts as { startTime: string; endTime: string }[])
          ?.map(c => `${fmtTime(c.startTime)}–${fmtTime(c.endTime)}`).join(', ')
        setActionError(`Conflict: room already approved for ${conflictTimes}. Reject that booking first.`)
      } else {
        setActionError(data.error ?? 'Something went wrong.')
      }
    } finally {
      setActionLoading(false)
    }
  }

  const sendDailyReport = async () => {
    const res = await fetch('/api/admin/daily-report', { headers: { 'x-admin-password': password } })
    if (res.ok) showToast('Daily report sent to shruti@elements.com ✓', 'ok')
    else showToast('Failed to send report', 'err')
  }

  const counts = {
    pending: bookings.filter(b => b.status === 'pending').length,
    approved: bookings.filter(b => b.status === 'approved').length,
    rejected: bookings.filter(b => b.status === 'rejected').length,
  }

  const displayed = [...bookings]
    .sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1
      if (b.status === 'pending' && a.status !== 'pending') return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    .filter(b => activeFilter === 'all' || b.status === activeFilter)

  if (!authed) return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">Book<span>Space</span> Admin</div>
        <p>Enter the admin password to continue</p>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            type={showPw ? 'text' : 'password'}
            className={loginError ? 'err' : ''}
            placeholder={loginError ? 'Wrong password' : '••••••••'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doLogin()}
            style={{ marginBottom: 0, paddingRight: 52 }}
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13, padding: 0 }}
          >
            {showPw ? 'Hide' : 'Show'}
          </button>
        </div>
        <button className="login-btn" onClick={doLogin}>Access Dashboard</button>
      </div>
    </div>
  )

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
          <div>BookSpace <small>Admin Dashboard</small></div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn-sm" onClick={sendDailyReport}>↗ Send Report</button>
          <a href="/" className="btn-sm">← App</a>
          <button
            className="btn-sm"
            onClick={() => { sessionStorage.removeItem('bs_admin_pw'); setAuthed(false); setPassword('') }}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="admin-main">
        <div style={{ display: 'flex', gap: 10, margin: '24px 0 20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="stats" style={{ flex: '0 0 auto', minWidth: 280, maxWidth: 400 }}>
            {(['pending', 'approved', 'rejected'] as const).map(s => (
              <div
                key={s}
                className={`stat${activeFilter === s ? ' active' : ''}`}
                onClick={() => setActiveFilter(prev => prev === s ? 'all' : s)}
              >
                <span className={`stat-num ${s}`}>{counts[s]}</span>
                <span className="stat-label">{s.charAt(0).toUpperCase() + s.slice(1)}</span>
              </div>
            ))}
          </div>
          <div className="filters" style={{ flex: 1, marginBottom: 0 }}>
            {(['all', 'pending', 'approved', 'rejected'] as Filter[]).map(f => (
              <button
                key={f}
                className={`filter-btn${activeFilter === f ? ' active' : ''}`}
                onClick={() => setActiveFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <button
              className="filter-btn"
              onClick={() => fetchBookings(password)}
              style={{ marginLeft: 'auto' }}
            >
              ↺ Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Loading…</div>
        ) : displayed.length === 0 ? (
          <div className="empty">
            <span>📋</span>
            {activeFilter === 'all' ? 'No booking requests yet.' : `No ${activeFilter} requests.`}
          </div>
        ) : (
          <div className="booking-list">
            <div className="list-header">
              <span>Status</span>
              <span>Room</span>
              <span>Meeting</span>
              <span>Date & Time</span>
              <span style={{ textAlign: 'right' }}>Actions</span>
            </div>
            {displayed.map(b => (
              <div key={b.id} className="booking-row">
                <span className={`badge ${b.status}`}>{b.status}</span>
                <span className={`room-tag ${roomCls(b.room)}`}>{roomName(b.room)}</span>
                <div className="row-main">
                  <div className="row-cause">
                    {b.cause}
                    {b.duration <= 120 && b.status === 'approved' && !b.adminNote && (
                      <span className="auto-badge">auto</span>
                    )}
                  </div>
                  <div className="row-person">{b.name} · {b.email}</div>
                  {b.adminNote && <div className="row-note-inline">Note: &quot;{b.adminNote}&quot;</div>}
                </div>
                <div className="row-time">
                  <div className="row-time-main">{fmtDate(b.date)}</div>
                  <div className="row-time-sub">{fmtTime(b.startTime)} – {fmtTime(b.endTime)} · {fmtDur(b.duration)}</div>
                </div>
                <div className="row-actions">
                  {b.status === 'pending' && (
                    <button className="btn-row approve" onClick={() => openReview(b)}>✓ Approve</button>
                  )}
                  {b.status === 'pending' && (
                    <button className="btn-row reject" onClick={() => openReview(b)}>✕ Reject</button>
                  )}
                  {b.status !== 'pending' && (
                    <button className="btn-row review" onClick={() => openReview(b)}>✎ Review</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Review Modal */}
      {reviewBooking && (
        <div
          className="overlay show"
          onClick={e => { if (e.target === e.currentTarget) { setReviewBooking(null); setActionError('') } }}
        >
          <div className="modal-card review-modal">
            <h2>Review Request</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16, textAlign: 'left' }}>
              <strong>{reviewBooking.cause}</strong><br />
              {roomName(reviewBooking.room)} · {fmtDate(reviewBooking.date)}<br />
              {fmtTime(reviewBooking.startTime)} – {fmtTime(reviewBooking.endTime)} · {fmtDur(reviewBooking.duration)}
            </p>
            <div className="field">
              <label>Admin Note (optional)</label>
              <textarea
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                placeholder="Add a note for the requester…"
                rows={3}
              />
            </div>
            {actionError && (
              <div className="error-box" style={{ marginTop: 12, textAlign: 'left' }}>
                {actionError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-modal-approve" onClick={() => doAction('approved')} disabled={actionLoading}>
                {actionLoading ? '…' : '✓ Approve'}
              </button>
              <button className="btn-modal-reject" onClick={() => doAction('rejected')} disabled={actionLoading}>
                {actionLoading ? '…' : '✕ Reject'}
              </button>
            </div>
            <span className="modal-cancel" onClick={() => { setReviewBooking(null); setActionError('') }}>
              Cancel
            </span>
          </div>
        </div>
      )}

      {toast && <div className={`toast show ${toastType}`}>{toast}</div>}
    </>
  )
}
