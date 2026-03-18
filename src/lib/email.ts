import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM ?? 'onboarding@resend.dev'

const fmtTime = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return `${h > 12 ? h - 12 : h || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
const fmtDate = (d: string) =>
  new Date(d + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
const ROOM_NAMES: Record<string, string> = { '502': 'Conference Hall 502', aqua: 'Aqua', ignis: 'Ignis' }

type BookingData = {
  id: string; name: string; email: string; room: string
  date: string; startTime: string; endTime: string; duration: number
  cause: string; adminNote?: string
}

const wrap = (body: string) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f6f6;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
<tr><td align="center">
<table width="100%" style="max-width:460px;background:#ffffff;border-radius:8px;padding:36px 36px 28px">
<tr><td>
  <p style="margin:0 0 28px;font-size:15px;font-weight:700;color:#111">BookSpace</p>
  ${body}
  <hr style="border:none;border-top:1px solid #eeeeee;margin:28px 0 16px">
  <p style="margin:0;font-size:11px;color:#aaaaaa">BookSpace · Conference Room Booking</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`

const row = (label: string, value: string) =>
  `<tr>
    <td style="padding:7px 0;font-size:13px;color:#888888;width:80px;vertical-align:top">${label}</td>
    <td style="padding:7px 0;font-size:13px;color:#111111">${value}</td>
  </tr>`

export async function sendBookingReceived(b: BookingData) {
  if (!process.env.RESEND_API_KEY) return
  await resend.emails.send({
    from: FROM, to: b.email,
    subject: `Booking request received — ${ROOM_NAMES[b.room]}`,
    html: wrap(`
      <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111">Request received</p>
      <p style="margin:0 0 24px;font-size:14px;color:#555">Hi ${b.name}, your request is pending admin approval.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #eeeeee">
        ${row('Room', ROOM_NAMES[b.room])}
        ${row('Date', fmtDate(b.date))}
        ${row('Time', `${fmtTime(b.startTime)} – ${fmtTime(b.endTime)}`)}
        ${row('Purpose', b.cause)}
        ${row('Ref', `<span style="font-family:monospace;font-size:12px;color:#aaa">${b.id}</span>`)}
      </table>
    `),
  })
}

export async function sendBookingApproved(b: BookingData) {
  if (!process.env.RESEND_API_KEY) return
  await resend.emails.send({
    from: FROM, to: b.email,
    subject: `Booking approved — ${ROOM_NAMES[b.room]}`,
    html: wrap(`
      <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111">Booking confirmed ✓</p>
      <p style="margin:0 0 24px;font-size:14px;color:#555">Hi ${b.name}, your room is confirmed. See you there!</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #eeeeee">
        ${row('Room', ROOM_NAMES[b.room])}
        ${row('Date', fmtDate(b.date))}
        ${row('Time', `${fmtTime(b.startTime)} – ${fmtTime(b.endTime)}`)}
        ${row('Purpose', b.cause)}
        ${b.adminNote ? row('Note', b.adminNote) : ''}
        ${row('Ref', `<span style="font-family:monospace;font-size:12px;color:#aaa">${b.id}</span>`)}
      </table>
    `),
  })
}

export async function sendDailyReport(csvContent: string, todayStr: string, tomorrowStr: string) {
  if (!process.env.RESEND_API_KEY) return
  await resend.emails.send({
    from: FROM,
    to: 'shruti@elements.com',
    subject: `BookSpace Report — ${fmtDate(todayStr)} & ${fmtDate(tomorrowStr)}`,
    html: wrap(`
      <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111">Daily Booking Report</p>
      <p style="margin:0 0 24px;font-size:14px;color:#555">Today's and tomorrow's bookings are attached as a CSV.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #eeeeee">
        ${row('Today', fmtDate(todayStr))}
        ${row('Tomorrow', fmtDate(tomorrowStr))}
      </table>
    `),
    attachments: [{
      filename: `bookspace-${todayStr}.csv`,
      content: Buffer.from(csvContent),
    }],
  })
}

export async function sendBookingRejected(b: BookingData) {
  if (!process.env.RESEND_API_KEY) return
  await resend.emails.send({
    from: FROM, to: b.email,
    subject: `Booking request update — ${ROOM_NAMES[b.room]}`,
    html: wrap(`
      <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111">Request not approved</p>
      <p style="margin:0 0 24px;font-size:14px;color:#555">Hi ${b.name}, your booking request could not be approved.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #eeeeee">
        ${row('Room', ROOM_NAMES[b.room])}
        ${row('Date', fmtDate(b.date))}
        ${row('Time', `${fmtTime(b.startTime)} – ${fmtTime(b.endTime)}`)}
        ${row('Purpose', b.cause)}
        ${b.adminNote ? row('Reason', b.adminNote) : ''}
        ${row('Ref', `<span style="font-family:monospace;font-size:12px;color:#aaa">${b.id}</span>`)}
      </table>
      <p style="margin:20px 0 0;font-size:13px;color:#555">Feel free to submit a new request for a different time.</p>
    `),
  })
}
