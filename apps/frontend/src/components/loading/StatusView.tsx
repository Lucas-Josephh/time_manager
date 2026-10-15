import type { LoadingOutlined } from '@ant-design/icons';
import './StatusView.scss';

type StatusViewProps = {
  status: 'loading' | 'error';
  message: string;
  icon?: typeof LoadingOutlined;
};

export default function LoadingView({
  status,
  message,
  icon: Icon,
}: StatusViewProps) {
  return (
    <div
      className="loading-view"
      role={status === 'error' ? 'alert' : 'status'}
    >
      <p>{message}</p>
      {Icon && <Icon />}
    </div>
  );
}
