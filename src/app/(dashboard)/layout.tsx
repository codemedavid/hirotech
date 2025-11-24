import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Providers } from './providers';
import { PageAccessCheck } from './page-access-check';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <Providers>
      <PageAccessCheck />
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto bg-muted/30 p-8">
            {children}
          </main>
        </div>
      </div>
    </Providers>
  );
}

