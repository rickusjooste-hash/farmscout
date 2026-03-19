import type { Metadata } from 'next'
import RainSwRegister from './RainSwRegister'

export const metadata: Metadata = {
  title: 'allFarm Rain',
  manifest: '/manifest-rain.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-title': 'allFarm Rain',
  },
}

export default function RainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`html, body { background: #eae6df !important; }`}</style>
      <RainSwRegister />
      {children}
    </>
  )
}
