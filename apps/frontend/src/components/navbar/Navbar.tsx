import {
  ChartColumn,
  ClipboardList,
  Clock,
  LayoutDashboard,
  LucideIcon,
  Settings,
  UserRound,
  Users,
} from 'lucide-react';
import './Navbar.scss';
import { useState } from 'react';
import { IconType } from 'react-icons';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { tabs } from '@/config/navigation';
import Button from '../button/Button';
import { Avatar } from 'antd';

interface NavItem {
  logo: LucideIcon | IconType;
  name: string;
  link: string;
}

export default function Navbar() {
  const common = useTranslations('Common');
  const navigation = useTranslations('Navigation');
  const [select, setSelect] = useState(navigation('dashboard'));
  const navItems: NavItem[] = [
    {
      logo: LayoutDashboard,
      name: navigation('dashboard'),
      link: tabs.dashboard.href,
    },
    { logo: Clock, name: navigation('timeClock'), link: tabs.timeClock.href },
    {
      logo: ClipboardList,
      name: navigation('timesheet'),
      link: tabs.timesheet.href,
    },
    { logo: Users, name: navigation('teams'), link: tabs.teams.href },
    {
      logo: UserRound,
      name: navigation('employees'),
      link: tabs.employees.href,
    },
    {
      logo: ChartColumn,
      name: navigation('reports'),
      link: tabs.reports.href,
    },
  ];

  return (
    <div className="extranet-navbar">
      <div>
        <Link className="extranet-navbar-header" href={tabs.dashboard.href}>
          <div className="extranet-navbar-header__logo">
            <Clock size={18} color="white" />
          </div>
          <div>
            <h3>{common('appName')}</h3>
            <p className="text-uppercase">Workforce</p>
          </div>
        </Link>
        <div className="extranet-navbar-container">
          <div className="extranet-navbar-container__upper text-uppercase">
            Workspace
          </div>
          <ul>
            {navItems.map((value, index) => {
              return (
                <li key={index}>
                  <Link
                    href={value.link}
                    className={`extranet-navbar-container-link ${value.name === select ? 'extranet-navbar-container__selected' : ''}`}
                    onClick={() => setSelect(value.name)}
                  >
                    <div className="extranet-navbar-container-link-element">
                      <value.logo
                        className={`${
                          value.name === select
                            ? 'extranet-navbar-container-link-element-text__selected'
                            : ''
                        }`}
                        size={17}
                      />
                      <div
                        className={`extranet-navbar-container-link-element-text ${
                          value.name === select
                            ? 'extranet-navbar-container-link-element-text__selected'
                            : ''
                        }`}
                      >
                        {value.name}
                      </div>
                    </div>
                    {value.name === select && (
                      <div className="extranet-navbar-container__point"></div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="extranet-navbar-footer">
        <div className="extranet-navbar-footer-settings">
          <Link
            className={`extranet-navbar-footer-settings-btn ${
              tabs.settings.labelKey === select
                ? 'extranet-navbar-footer-settings-btn__selected'
                : ''
            }`}
            onClick={() => setSelect(tabs.settings.labelKey)}
            href={tabs.settings.href}
          >
            <Settings
              className="extranet-navbar-footer-settings__logo"
              size={17}
            />
            <span className="extranet-navbar-footer-settings-btn__text">
              {navigation('settings')}
            </span>
            {tabs.settings.labelKey === select && (
              <div className="extranet-navbar-container__point extranet-navbar-footer-settings-btn__point"></div>
            )}
          </Link>
        </div>
        <div>
          <div className="extranet-navbar-footer-logout">
            <Avatar className="extranet-navbar-footer__avatar">YB</Avatar>
            <div className="extranet-navbar-footer-logout-container">
              <div>
                <p>Yarelly Berger</p>
                <p className="extranet-navbar-footer-logout-container__role">
                  Frontend Developer
                </p>
              </div>
              <Button variant="logout" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
