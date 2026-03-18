import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { overlaps, addMins, toMins } from '@/lib/bookings'
import { sendBookingReceived, sendBookingApproved } from '@/lib/email'

const VALID_ROOMS = ['502', 'aqua', 'ignis']
const VALID_DURATIONS = [30, 60, 90, 120, 150, 180, 210, 240]
const ROOM_NAMES: Record<string, string> = { '502': 'Conference Hall 502', aqua: 'Aqua', ignis: 'Ignis' }

export async function POST(req: NextRequest) {
  try {
    const { room, date, startTime, duration, name, email, cause, justification } = await req.json()

    // — Validation —
    if (!room || !date || !startTime || !duration || !name || !email || !cause || !justification) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
    }
    if (!VALID_ROOMS.includes(room)) {
      return NextResponse.json({ error: 'Invalid room.' }, { status: 400 })
    }
    const dur = Number(duration)
    if (!VALID_DURATIONS.includes(dur)) {
      return NextResponse.json({ error: 'Invalid duration.' }, { status: 400 })
    }
    const endTime = addMins(startTime, dur)
    if (toMins(startTime) < 9 * 60 || toMins(endTime) > 19 * 60) {
      return NextResponse.json({ error: 'Bookings must be between 9:00 AM and 7:00 PM.' }, { status: 400 })
    }
    const bookingDate = new Date(date + 'T00:00:00')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    if (bookingDate < today) {
      return NextResponse.json({ error: 'Cannot book dates in the past.' }, { status: 400 })
    }

    // — Conflict check against APPROVED bookings —
    const approved = await prisma.booking.findMany({ where: { room, date, status: 'approved' } })
    const conflicting = approved.filter(b => overlaps(startTime, endTime, b.startTime, b.endTime))

    if (conflicting.length > 0) {
      return NextResponse.json({
        error: `${ROOM_NAMES[room]} is already booked during this time.`,
        conflicts: conflicting.map(b => ({ startTime: b.startTime, endTime: b.endTime })),
      }, { status: 409 })
    }

    // Auto-approve bookings ≤ 2 hours; longer ones need admin review
    const autoApprove = dur <= 120
    const booking = await prisma.booking.create({
      data: { room, date, startTime, endTime, duration: dur, name, email: email.toLowerCase().trim(), cause, justification, status: autoApprove ? 'approved' : 'pending' },
    })

    // Send email (non-blocking)
    if (autoApprove) {
      sendBookingApproved({ ...booking, adminNote: '' }).catch(console.error)
    } else {
      sendBookingReceived(booking).catch(console.error)
    }

    return NextResponse.json({ booking, autoApproved: autoApprove }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'Email required.' }, { status: 400 })

  const bookings = await prisma.booking.findMany({
    where: { email: email.toLowerCase().trim() },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ bookings })
}
