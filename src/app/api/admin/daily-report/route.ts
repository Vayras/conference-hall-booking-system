import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendDailyReport } from '@/lib/email'

const auth = (req: NextRequest) =>
  req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD

const ROOM_NAMES: Record<string, string> = { '502': 'Conference Hall 502', aqua: 'Aqua', ignis: 'Ignis' }

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return 'No bookings'
  const headers = ['ID', 'Name', 'Email', 'Room', 'Date', 'Start', 'End', 'Duration (min)', 'Purpose', 'Justification', 'Status', 'Admin Note']
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const data = rows.map(b => [
    b.id, b.name, b.email,
    ROOM_NAMES[b.room as string] ?? b.room,
    b.date, b.startTime, b.endTime, b.duration,
    b.cause, b.justification, b.status, b.adminNote,
  ].map(escape).join(','))
  return [headers.map(escape).join(','), ...data].join('\n')
}

function localDateStr(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = localDateStr(0)
  const tomorrow = localDateStr(1)

  const [todayBookings, tomorrowBookings] = await Promise.all([
    prisma.booking.findMany({ where: { date: today }, orderBy: [{ room: 'asc' }, { startTime: 'asc' }] }),
    prisma.booking.findMany({ where: { date: tomorrow }, orderBy: [{ room: 'asc' }, { startTime: 'asc' }] }),
  ])

  const csv = [
    `"=== TODAY: ${today} ==="`,
    toCSV(todayBookings as Record<string, unknown>[]),
    '',
    `"=== TOMORROW: ${tomorrow} ==="`,
    toCSV(tomorrowBookings as Record<string, unknown>[]),
  ].join('\n')

  await sendDailyReport(csv, today, tomorrow)

  return NextResponse.json({
    ok: true,
    sent: `shruti@elements.com`,
    today: todayBookings.length,
    tomorrow: tomorrowBookings.length,
  })
}
