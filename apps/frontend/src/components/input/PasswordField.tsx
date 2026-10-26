'use client';

import {
  EyeInvisibleOutlined,
  EyeOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import Input from '@/components/input/Input';
import { ComponentProps } from 'react';

type PasswordFieldProps = Omit<
  ComponentProps<typeof Input>,
  'type' | 'icon' | 'value'
> & {
  id: string;
  value: string;
  isVisible: boolean;
  onToggleVisibility: () => void;
};

export default function PasswordField({
  id,
  value,
  name = 'password',
  isVisible,
  onToggleVisibility,
  actions,
  ...inputProps
}: PasswordFieldProps) {
  const t = useTranslations('Common');
  const visibilityLabel = isVisible ? t('hidePassword') : t('showPassword');

  return (
    <Input
      {...inputProps}
      id={id}
      name={name}
      value={value}
      type={isVisible ? 'text' : 'password'}
      icon={<LockOutlined />}
      placeholder="••••••••"
      actions={
        <>
          <button
            type="button"
            aria-label={visibilityLabel}
            title={visibilityLabel}
            aria-controls={id}
            aria-pressed={isVisible}
            onClick={onToggleVisibility}
          >
            {isVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          </button>

          {actions}
        </>
      }
    />
  );
}
