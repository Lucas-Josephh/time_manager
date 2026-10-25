import type { ComponentPropsWithoutRef } from 'react';
import { LogOut, type LucideIcon } from 'lucide-react';
import type { IconType } from 'react-icons';
import './Button.scss';

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'logout';
  icon?: LucideIcon | IconType;
};

export default function Button({
  variant = 'primary',
  icon: Icon,
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps) {
  const isIconOnly = Boolean(Icon) && children == null;
  return (
    <>
      {variant === 'logout' ? (
        <button className="button-logout" {...props}>
          <LogOut size={17} />
        </button>
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
