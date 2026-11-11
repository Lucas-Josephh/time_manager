'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { tabs } from '@/config/navigation';

export default function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const isPublicRoute =
    pathname === tabs.register.href || pathname === tabs.login.href;
  const isAuthenticated = Boolean(session?.user);

  useEffect(() => {
    if (!isPending && !isAuthenticated && !isPublicRoute) {
      router.replace(tabs.register.href);
    }
  }, [isAuthenticated, isPending, isPublicRoute, router]);

  if (isPublicRoute) return children;
  if (isPending || !isAuthenticated) return null;

  return children;
}
