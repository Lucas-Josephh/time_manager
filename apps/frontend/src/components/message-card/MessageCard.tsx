import { CloseCircleOutlined, WarningOutlined } from '@ant-design/icons';
import './MessageCard.scss';

type MessageCardProps = {
  type: 'error' | 'warning';
  title?: string;
  message: string;
};

export default function MessageCard({
  type,
  title,
  message,
}: MessageCardProps) {
  const Icon = type === 'error' ? CloseCircleOutlined : WarningOutlined;

  return (
    <div
      className={`message-card message-card--${type}`}
      role={type === 'error' ? 'alert' : undefined}
    >
      <Icon aria-hidden="true" />
      <div>
        {title && <h4>{title}</h4>}
        <p>{message}</p>
      </div>
    </div>
  );
}
