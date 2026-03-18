export const toMins = (t: string): number => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export const fromMins = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export const addMins = (time: string, mins: number): string =>
  fromMins(toMins(time) + mins)

/** True if interval [s1, e1) overlaps [s2, e2) */
export const overlaps = (s1: string, e1: string, s2: string, e2: string): boolean =>
  toMins(s1) < toMins(e2) && toMins(e1) > toMins(s2)
