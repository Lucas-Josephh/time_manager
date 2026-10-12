import type { LucideIcon } from 'lucide-react';
import './card.scss';

export function Card({
  children,
  title,
  subtitle,
  footer,
  icon: Icon,
  iconColor,
  element,
  type = 'info',
}: {
  children?: React.ReactNode;
  title?: string;
  subtitle?: string;
  footer?: string;
  icon?: LucideIcon;
  iconColor?: '#000' | string;
  element?: React.ReactNode;
  type?: 'info' | 'table';
}) {
  return (
    <div className="extranet-card card">
      <div className="extranet-card-header">
        <div className="extranet-card-header-content">
          <h3>{title}</h3>
          {subtitle && (
            <p className="extranet-card-header-content__subtitle">{subtitle}</p>
          )}
        </div>
        {Icon ? (
          <div
            className="extranet-card-header-content-icon"
            style={{ backgroundColor: `${iconColor}1a` }}
          >
            <Icon
              className="extranet-card-header-content-icon__element"
              color={iconColor}
              size={16}
            />
          </div>
        ) : (
          element && element
        )}
      </div>
      <div
        className="extranet-card-body"
        style={
          type === 'table'
            ? { borderTop: `1px solid #5a6b8530`, marginTop: '0.75rem' }
            : undefined
        }
      >
        {children}
      </div>
      {footer && <p className="extranet-card__footer">{footer}</p>}
    </div>
  );
}
