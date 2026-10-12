import AuthHeader from '@/components/auth/AuthHeader';
import { ConfigProvider } from 'antd';
import RegisterForm from './RegisterForm';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function RegisterView() {
  const t = useTranslations('RegisterPage');
  return (
    <ConfigProvider
      theme={{
        token: {
          lineWidth: 1.5,
          colorSplit: 'var(--color-border)',
        },
      }}
    >
      <main>
        <div className="screen screen--centered">
          <div className="auth-container">
            <AuthHeader
              title={t('title')}
              subtitle={t('subtitle')}
            ></AuthHeader>
            <div className="card">
              <RegisterForm />
              {/* <Divider>
              <span className="surtitre">Or</span>
            </Divider> */}
              {/* <Button variant="secondary" className="full-width">
              <FcGoogle size={16}/>
              Continue with Google
            </Button> */}
            </div>
            <p>
              <Link href="/login">{t('backToEmployees')}</Link>
            </p>
          </div>
        </div>
      </main>
    </ConfigProvider>
  );
}
