import { ExclamationCircleOutlined } from '@ant-design/icons';

type InputMessageProps = {
  message?: string;
  id?: string;
  type: 'error' | 'info';
};

export default function InputMessage({ message, id, type }: InputMessageProps) {
  if (!message) return null;

  return (
    <div
      className={`input-message input-message--${type}`}
      id={id}
      role={type === 'error' ? 'alert' : undefined}
    >
      {type === 'error' && (
        <ExclamationCircleOutlined
          style={{ fontSize: '12px' }}
          aria-hidden="true"
        />
      )}
      <p>{message}</p>
    </div>
  );
}
