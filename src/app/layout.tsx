import type { Metadata, Viewport } from 'next'
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
  weight: ['400', '500', '600'],
})

export const viewport: Viewport = { themeColor: '#F5F3EE' }

export const metadata: Metadata = {
  title: 'BookSpace — Conference Rooms',
  description: 'Book conference rooms at your workspace',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'BookSpace', statusBarStyle: 'default' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  )
}
