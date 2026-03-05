import type { Metadata } from 'next'
import QcSwRegister from './QcSwRegister'

export const metadata: Metadata = {
  title: 'Orchard QC',
  manifest: '/manifest-qc.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-title': 'Orchard QC',
  },
}

export default function QcLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`html, body { background: #1a2e1a !important; }`}</style>
      <QcSwRegister />
      {children}
    </>
  )
}
