import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter         = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://stacks-quest-ten.vercel.app'

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor:   '#000000',
}

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),

  title: {
    default:  'Stacks Quest — Daily On-Chain Puzzle Game',
    template: '%s | Stacks Quest',
  },

  description:
    'Guess real blockchain data from Stacks, bet $B2S tokens, earn NFT badges. ' +
    'A new puzzle every day — powered by Clarity smart contracts on Stacks mainnet.',

  keywords: [
    'Stacks', 'blockchain', 'puzzle', 'game', 'B2S', 'NFT',
    'Clarity', 'DeFi', 'crypto', 'daily', 'on-chain', 'Farcaster',
  ],

  authors: [{ name: 'wkalidev', url: 'https://github.com/wkalidev' }],

  manifest: '/site.webmanifest',

  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },

  openGraph: {
    title:       'Stacks Quest — Daily On-Chain Puzzle Game',
    description: 'Guess real blockchain data, bet $B2S tokens, earn NFT badges. New puzzle every day on Stacks mainnet.',
    url:         BASE_URL,
    siteName:    'Stacks Quest',
    images: [{
      url:    '/og-banner.png',
      width:  1200,
      height: 630,
      alt:    'Stacks Quest — Daily On-Chain Puzzle Game',
    }],
    locale: 'en_US',
    type:   'website',
  },

  twitter: {
    card:        'summary_large_image',
    title:       'Stacks Quest — Daily On-Chain Puzzle',
    description: 'Guess real Stacks blockchain data. Bet $B2S. Earn NFT badges. New puzzle every day.',
    creator:     '@willycodexwar',
    images:      ['/og-banner.png'],
  },

  robots: {
    index:  true,
    follow: true,
    googleBot: {
      index:               true,
      follow:              true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet':       -1,
    },
  },

  other: {
    'talentapp:project_verification': '9939685310adea5849d1b4bacf031ca8f948ad9b7e0fc064a1dc44aa47a252c0369a56991ab715f157c9f49f622c709eb5ed6e06a7ebf76ee7da606d341a3ea8',
    'apple-mobile-web-app-capable':          'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className={inter.className}>
        <div className="min-h-screen bg-black">
          {children}
        </div>
      </body>
    </html>
  )
}