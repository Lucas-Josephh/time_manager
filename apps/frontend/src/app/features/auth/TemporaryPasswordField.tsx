'use client';

import { CopyOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { ComponentProps } from 'react';
import PasswordField from '@/components/input/PasswordField';

type TemporaryPasswordFieldProps = Omit<
  ComponentProps<typeof PasswordField>,
  'label' | 'readOnly' | 'actions' | 'error' | 'aria-invalid'
> & {
  onCopy: () => void;
};

export default function TemporaryPasswordField({
  value,
  onCopy,
  ...passwordFieldProps
}: TemporaryPasswordFieldProps) {
  const t = useTranslations('Common');

  return (
    <PasswordField
      {...passwordFieldProps}
      value={value}
      label={t('temporaryPassword')}
      readOnly
      actions={
        <button
          type="button"
          aria-label={t('copyPassword')}
          title={t('copyPassword')}
          disabled={!value}
          onClick={onCopy}
        >
          <CopyOutlined />
        </button>
      }
    />
  );
}
