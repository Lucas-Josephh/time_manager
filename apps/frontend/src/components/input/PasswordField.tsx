'use client';

import {
  EyeInvisibleOutlined,
  EyeOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import Input from '@/components/input/Input';
import { ComponentProps, useState } from 'react';

type PasswordFieldProps = Omit<
  ComponentProps<typeof Input>,
  'type' | 'icon' | 'value'
> & {
  id: string;
  value: string;
  onToggleVisibility?: () => void;
};

export default function PasswordField({
  id,
  value,
  name = 'password',
  onToggleVisibility,
  actions,
  ...inputProps
}: PasswordFieldProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const t = useTranslations('Common');
  const visibilityLabel = isPasswordVisible
    ? t('hidePassword')
    : t('showPassword');

  const handleToggleVisibility = () => {
    onToggleVisibility?.();
    setIsPasswordVisible((previous) => !previous);
  };

  return (
    <Input
      {...inputProps}
      id={id}
      name={name}
      value={value}
      type={isPasswordVisible ? 'text' : 'password'}
      icon={<LockOutlined />}
      placeholder="••••••••"
      actions={
        <>
          <button
            type="button"
            aria-label={visibilityLabel}
            title={visibilityLabel}
            aria-controls={id}
            aria-pressed={isPasswordVisible}
            onClick={handleToggleVisibility}
          >
            {isPasswordVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          </button>

          {actions}
        </>
      }
    />
  );
}
