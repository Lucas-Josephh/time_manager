'use client';

import { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import './page.scss';
import DashboardHeader from '../../components/header/LayoutHeader';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const navigation = useTranslations('Navigation');

  return (
    <div className="screen screen--dashboard">
      <DashboardHeader />
      <aside className="dashboard-menu">
        <p>{navigation('menu')}</p>
      </aside>
      <main className="dashboard-content">{children}</main>
    </div>
  );
}
