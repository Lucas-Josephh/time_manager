import { Suspense } from 'react';
import LoginView from '../features/login/LoginView';
import { useTranslations } from 'next-intl';

export default function RegisterPage() {
  const common = useTranslations('Common');

  return (
    <Suspense fallback={<p>{common('loading')}</p>}>
      <LoginView />
    </Suspense>
  );
}
