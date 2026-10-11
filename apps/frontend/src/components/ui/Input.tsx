import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import InputMessage from './InputMessage';
import styles from './Input.module.scss';

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
    <div className={[styles.field, wrapperClassName].filter(Boolean).join(' ')}>
      <label htmlFor={props.id}>
        {label}
        {props.required && (
          <span className={styles.required} aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      <div className={styles.wrapper}>
        {icon && (
          <span className={styles.icon} aria-hidden="true">
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
            styles.input,
            icon && styles['input--with-icon'],
            actions && styles['input--with-actions'],
            className,
          ]
            .filter(Boolean)
            .join(' ')}
        />
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      <InputMessage
        type={error ? 'error' : 'info'}
        message={error || message}
        id={messageId}
      />
    </div>
  );
}
