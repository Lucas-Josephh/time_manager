import type { ComponentPropsWithoutRef } from 'react';
import { CalendarClock, LogIn, LogOut, type LucideIcon } from 'lucide-react';
import type { IconType } from 'react-icons';
import Link from 'next/link';
import './Button.scss';
import { tabs } from '@/config/navigation';

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?:
    'primary' | 'secondary' | 'clock_in' | 'clock_out' | 'timesheet' | 'logout';
  icon?: LucideIcon | IconType;
};

type LinkProps = ComponentPropsWithoutRef<'a'> & {
  variant?:
    'primary' | 'secondary' | 'clock_in' | 'clock_out' | 'timesheet' | 'logout';
  icon?: LucideIcon | IconType;
};

export default function Button({
  variant = 'primary',
  icon: Icon,
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps & LinkProps) {
  const isIconOnly = Boolean(Icon) && children == null;
  return (
    <>
      {variant === 'logout' ? (
        <button className="button-logout" {...props}>
          <LogOut size={17} />
        </button>
      ) : variant === 'clock_in' || variant === 'clock_out' ? (
        <button className={`button-${variant}`} {...props}>
          <LogIn size={17} />
          {children}
        </button>
      ) : variant === 'timesheet' ? (
        <Link
          href={tabs.timesheet.href}
          className="button-timesheet"
          {...props}
        >
          <CalendarClock size={17} />
          {children}
        </Link>
      ) : (
        <button
          type={type}
          className={[
            'button',
            variant,
            isIconOnly && 'button--icon-only',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        >
          {Icon && (
            <Icon className="button__icon" size={18} aria-hidden="true" />
          )}
          {children}
        </button>
      )}
    </>
  );
}
