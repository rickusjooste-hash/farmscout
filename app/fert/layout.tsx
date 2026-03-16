import type { Metadata } from 'next'
import FertSwRegister from './FertSwRegister'

export const metadata: Metadata = {
  title: 'FertApp',
  manifest: '/manifest-fert.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-title': 'FertApp',
  },
}

export default function FertLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`html, body { background: #1a2a1a !important; }`}</style>
      <FertSwRegister />
      {children}
    </>
  )
}
