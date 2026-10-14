'use client';

import { ReactNode, useState } from 'react';
import Button from '@/components/button/Button';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { tabs } from '@/config/navigation';
import { Bell, ChevronDown, Menu } from 'lucide-react';
import { Avatar } from 'antd';
import './page.scss';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const common = useTranslations('Common');
  const navigation = useTranslations('Navigation');

  const items = Object.values(tabs);

  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href != '/' && pathname.startsWith(`${href}/`));

  const currentTab = items.find((tab) => isActive(tab.href));

  return (
    <div className="screen screen--dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-main">
          <Button
            className="dashboard-menu-toggle"
            variant="secondary"
            icon={Menu}
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
            aria-expanded={menuOpen}
          ></Button>
          <div className="dashboard-header-nav">
            <p>
              {common('appName')}
              {currentTab && <span> / {navigation(currentTab.labelKey)}</span>}
            </p>
            {currentTab && <h4> {navigation(currentTab.labelKey)}</h4>}
          </div>
        </div>
        <div className="dashboard-header-actions">
          <Button variant="secondary" icon={Bell}></Button>
          <Button variant="secondary" className="user-actions">
            <Avatar>YB</Avatar>
            <div>
              <p>Yarelly Berger</p>
              <p>Role</p>
            </div>
            <ChevronDown />
          </Button>
        </div>
      </header>

      <aside className="dashboard-menu">
        <p>{navigation('menu')}</p>
      </aside>
      <main className="dashboard-content">{children}</main>
    </div>
  );
}
