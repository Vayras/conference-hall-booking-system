import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { overlaps } from '@/lib/bookings'
import type { Booking } from '@prisma/client'

const auth = (req: NextRequest) =>
  req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD

type ConflictError = Error & { conflicts: Booking[] }

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { status, adminNote } = await req.json()
  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })
  }

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.findUnique({ where: { id: params.id } })
      if (!b) throw new Error('NOT_FOUND')

      if (status === 'approved') {
        // Re-check inside transaction to prevent race conditions
        const others = await tx.booking.findMany({
          where: { room: b.room, date: b.date, status: 'approved', id: { not: b.id } },
        })
        const conflicting = others.filter(o => overlaps(b.startTime, b.endTime, o.startTime, o.endTime))

        if (conflicting.length > 0) {
          const err = Object.assign(new Error('CONFLICT'), { conflicts: conflicting }) as ConflictError
          throw err
        }
      }

      return tx.booking.update({
        where: { id: params.id },
        data: { status, adminNote: adminNote ?? '', reviewedAt: new Date() },
      })
    })

    return NextResponse.json({ booking })
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === 'NOT_FOUND') return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
      if (e.message === 'CONFLICT') {
        const conflicts = (e as ConflictError).conflicts
        return NextResponse.json({
          error: 'Cannot approve: this slot conflicts with an already-approved booking.',
          conflicts: conflicts.map(c => ({ id: c.id, startTime: c.startTime, endTime: c.endTime, name: c.name })),
        }, { status: 409 })
      }
    }
    console.error(e)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
