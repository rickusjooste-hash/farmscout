import type { Metadata } from 'next'
import QcSwRegister from './QcSwRegister'

// Override root layout manifest — this is merged server-side into <head>
// so the browser sees /manifest-qc.json before any JS runs
export const metadata: Metadata = {
  title: 'Orchard QC',
  manifest: '/manifest-qc.json',
}

export default function QcLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <QcSwRegister />
      {children}
    </>
  )
}
