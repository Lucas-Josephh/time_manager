'use client';

import { ReactNode } from 'react';
import './page.scss';
import DashboardHeader from '../../components/header/LayoutHeader';
import Navbar from '@/components/navbar/Navbar';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="screen screen--dashboard">
      <DashboardHeader />
      <aside className="dashboard-menu">
        <Navbar />
      </aside>
      <main className="dashboard-content">{children}</main>
    </div>
  );
}
