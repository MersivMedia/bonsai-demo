import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bonsai 8B Demo - 1-bit LLM in Your Browser',
  description: 'Run the revolutionary 1-bit Bonsai 8B model directly in your browser using WebGPU. Only 1.15GB for full 8B intelligence.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white">{children}</body>
    </html>
  )
}
