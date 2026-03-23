import type { Metadata } from 'next'
import PackshedJuiceSwRegister from './PackshedJuiceSwRegister'

export const metadata: Metadata = {
  title: 'allFarm Juice',
  manifest: '/manifest-packshed-juice.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-title': 'allFarm Juice',
  },
}

export default function PackshedJuiceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`html, body { background: #eae6df !important; overscroll-behavior: none; }`}</style>
      <PackshedJuiceSwRegister />
      {children}
    </>
  )
}
