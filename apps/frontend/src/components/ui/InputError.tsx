import { ExclamationCircleOutlined } from '@ant-design/icons';

type InputErrorProps = {
  message?: string;
  id?: string;
};

export default function InputError({ message, id }: InputErrorProps) {
  if (!message) return null;

  return (
    <div className="input-error" id={id} role="alert">
      <ExclamationCircleOutlined
        style={{ fontSize: '12px' }}
        aria-hidden="true"
      />
      <p>{message}</p>
    </div>
  );
}
