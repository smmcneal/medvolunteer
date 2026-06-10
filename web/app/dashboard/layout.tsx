import { redirect } from 'next/navigation'
import { getAuthUser, getAdminUser } from '@/lib/auth'
import DashboardShell from './DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  // Authenticated but not an admin (e.g. a volunteer) — send them to their
  // own portal instead of the admin dashboard.
  const adminUser = await getAdminUser()
  if (!adminUser) redirect('/volunteer/home')

  return <DashboardShell>{children}</DashboardShell>
}
