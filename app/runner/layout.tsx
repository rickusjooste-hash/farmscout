import type { Metadata } from 'next'
import QcSwRegister from '../qc/QcSwRegister'

export const metadata: Metadata = {
  title: 'Orchard Runner',
  manifest: '/manifest-runner.json',
}

export default function RunnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`html, body { background: #1a2e1a !important; }`}</style>
      <QcSwRegister />
      {children}
    </>
  )
}
