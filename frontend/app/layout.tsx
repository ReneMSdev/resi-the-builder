import type { Metadata } from 'next'
import { Geist, Geist_Mono, Roboto_Mono } from 'next/font/google'
import { DemoModeProvider } from './lib/DemoModeContext'
import { DemoModeToggle } from './components/DemoModeToggle'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const robotoMono = Roboto_Mono({
  variable: '--font-roboto-mono',
  weight: '700',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Resume Builder',
  description: 'Generate, revise, and manage tailored resumes and cover letters.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang='en'
      className={`${geistSans.variable} ${geistMono.variable} ${robotoMono.variable} h-full overflow-hidden antialiased`}
    >
      <body className='h-full flex flex-col overflow-hidden'>
        <DemoModeProvider>
          {children}
          <DemoModeToggle />
        </DemoModeProvider>
      </body>
    </html>
  )
}
