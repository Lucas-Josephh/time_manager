'use client';

import {
  CopyOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LockOutlined,
} from '@ant-design/icons';
import Input from '@/components/ui/Input';
import { useTranslations } from 'next-intl';

type TemporaryPasswordFieldProps = {
  id: string;
  value: string;
  message?: string;
  wrapperClassName?: string;
  isVisible: boolean;
  onToggleVisibility: () => void;
  onCopy: () => void;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
};

export default function TemporaryPasswordField({
  id,
  value,
  message,
  wrapperClassName,
  isVisible,
  onToggleVisibility,
  onCopy,
  ...accessibilityProps
}: TemporaryPasswordFieldProps) {
  const t = useTranslations('Common');
  const visibilityLabel = isVisible ? t('hidePassword') : t('showPassword');

  return (
    <Input
      {...accessibilityProps}
      id={id}
      name="password"
      label={t('temporaryPassword')}
      type={isVisible ? 'text' : 'password'}
      placeholder="••••••••"
      icon={<LockOutlined />}
      wrapperClassName={wrapperClassName}
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
          <button
            type="button"
            aria-label={t('copyPassword')}
            title={t('copyPassword')}
            disabled={!value}
            onClick={onCopy}
          >
            <CopyOutlined />
          </button>
        </>
      }
      readOnly
      value={value}
      message={message}
    />
  );
}
