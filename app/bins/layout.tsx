import type { Metadata } from 'next'
import BinsSwRegister from './BinsSwRegister'

export const metadata: Metadata = {
  title: 'BinsApp',
  manifest: '/manifest-bins.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-title': 'BinsApp',
  },
}

export default function BinsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`html, body { background: #eae6df !important; }`}</style>
      <BinsSwRegister />
      {children}
    </>
  )
}
