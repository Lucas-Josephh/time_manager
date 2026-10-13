'use client';

import { ReactNode, useState } from 'react';
import Button from '@/components/button/Button';
import { MenuOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { tabs } from '@/config/navigation';

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
        <Button
          className="dashboard-menu-toggle"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation"
          aria-expanded={menuOpen}
        >
          {/* icon={<MenuOutlined />} */}
        </Button>
        <div dashboard-header-nav>
          <div>
            <p>
              {common('appName')}
              {currentTab && <span> / {navigation(currentTab.labelKey)}</span>}
            </p>
          </div>
          {currentTab && <h4> {navigation(currentTab.labelKey)}</h4>}
        </div>
      </header>
      <aside className="dashboard-menu">
        <p>{navigation('menu')}</p>
      </aside>
      <main className="dashboard-content">{children}</main>
    </div>
  );
}
