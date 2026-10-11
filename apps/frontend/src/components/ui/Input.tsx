import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import InputError from './InputError';
import styles from './Input.module.scss';

type InputProps = ComponentPropsWithoutRef<'input'> & {
  label: string;
  icon?: ReactNode;
  error?: string;
};

export default function Input({
  label,
  icon,
  error,
  className,
  ...props
}: InputProps) {
  return (
    <div className={styles.field}>
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
          className={[styles.input, icon && styles['input--with-icon'], className]
            .filter(Boolean)
            .join(' ')}
        />
      </div>
      <InputError
        message={error}
        id={props.id ? `${props.id}-error` : undefined}
      />
    </div>
  );
}
