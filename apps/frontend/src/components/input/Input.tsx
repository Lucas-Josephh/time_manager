import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import './Input.scss';
import InputMessage from './InputMessage';

type InputProps = ComponentPropsWithoutRef<'input'> & {
  label: string;
  icon?: ReactNode;
  actions?: ReactNode;
  message?: string;
  error?: string;
  wrapperClassName?: string;
};

export default function Input({
  label,
  icon,
  actions,
  message,
  error,
  className,
  wrapperClassName,

  ...props
}: InputProps) {
  const messageId = props.id
    ? `${props.id}-${error ? 'error' : 'message'}`
    : undefined;

  return (
    <div className={["field", wrapperClassName].filter(Boolean).join(' ')}>
      <label htmlFor={props.id}>
        {label}
        {props.required && (
          <span className={"required"} aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      <div className={"wrapper"}>
        {icon && (
          <span className={"icon"} aria-hidden="true">
            {icon}
          </span>
        )}
        <input
          {...props}
          aria-describedby={
            props['aria-describedby'] ??
            (error || message ? messageId : undefined)
          }
          className={[
            "input",
            icon && ['input--with-icon'],
            actions && ['input--with-actions'],
            className,
          ]
            .filter(Boolean)
            .join(' ')}
        />
        {actions && <div className={"actions"}>{actions}</div>}
      </div>
      <InputMessage
        type={error ? 'error' : 'info'}
        message={error || message}
        id={messageId}
      />
    </div>
  );
}
