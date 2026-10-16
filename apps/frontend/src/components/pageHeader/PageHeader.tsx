import './PageHeader.scss';
import { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  subtitle: string;
  actions?: ReactNode;
};

export default function PageHeader({
  title,
  subtitle,
  actions,
}: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header_content">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions}
    </div>
  );
}
