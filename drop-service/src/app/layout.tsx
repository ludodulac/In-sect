import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Assistant Demandes & Devis',
  description: 'Centralisez les demandes clients de votre entreprise artisanale.'
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
