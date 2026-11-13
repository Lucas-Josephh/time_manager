import RegisterForm from './RegisterForm';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import AuthHeader from './AuthHeader';

export default function RegisterView() {
  const t = useTranslations('RegisterPage');
  return (
      <main>
        <div className="screen screen--centered">
          <div className="auth-container">
            <AuthHeader
              title={t('title')}
              subtitle={t('subtitle')}
            ></AuthHeader>
            <div className="card">
              <RegisterForm />
            </div>
            <p>
              <Link href="/login">{t('backToEmployees')}</Link>
            </p>
          </div>
        </div>
      </main>
  );
}
