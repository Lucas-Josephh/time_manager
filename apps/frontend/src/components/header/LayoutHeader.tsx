'use client';

import { useState } from 'react';
import Button from '@/components/button/Button';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { tabs } from '@/config/navigation';
import { Bell, ChevronDown, LogOut, Menu, Settings, User } from 'lucide-react';
import { Avatar, Dropdown, MenuProps } from 'antd';
import './LayoutHeader.scss';

export default function DashboardHeader() {
  const pathname = usePathname();
  const common = useTranslations('Common');
  const navigation = useTranslations('Navigation');

  const tabItems = Object.values(tabs);
  const menuItems: MenuProps['items'] = [
    {
      label: 'My profile',
      key: '0',
      icon: <User />,
    },
    {
      label: 'Settings',
      key: '1',
      icon: <Settings />,
    },
    {
      type: 'divider',
    },
    {
      label: 'Sign out',
      key: '2',
      icon: <LogOut />,
      danger: true,
    },
  ];

  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href != '/' && pathname.startsWith(`${href}/`));

  const currentTab = tabItems.find((tab) => isActive(tab.href));

  return (
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
      <Dropdown menu={{ items: menuItems }} trigger={['click']}>
        <div className="dashboard-header-actions">
          <Button variant="secondary" icon={Bell}></Button>
          <Button variant="secondary" className="user-actions">
            <Avatar>YB</Avatar>
            <div className="dashboard-header-actions-info">
              <p>Yarelly Berger</p>
              <p className="dashboard-header-actions-info__role">
                Frontend Developer
              </p>
            </div>

            <ChevronDown />
          </Button>
        </div>
      </Dropdown>
    </header>
  );
}
