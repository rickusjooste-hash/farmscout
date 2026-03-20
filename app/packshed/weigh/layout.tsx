import type { Metadata } from 'next'
import PackshedWeighSwRegister from './PackshedWeighSwRegister'

export const metadata: Metadata = {
  title: 'allFarm Weigh',
  manifest: '/manifest-packshed-weigh.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-title': 'allFarm Weigh',
  },
}

export default function PackshedWeighLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`html, body { background: #eae6df !important; }`}</style>
      <PackshedWeighSwRegister />
      {children}
    </>
  )
}
