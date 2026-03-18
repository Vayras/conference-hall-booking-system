import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const auth = (req: NextRequest) =>
  req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bookings = await prisma.booking.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ bookings })
}
