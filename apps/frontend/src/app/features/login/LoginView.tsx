import { ConfigProvider, Divider } from 'antd';
import { useTranslations } from 'next-intl';
import AuthHeader from '../auth/AuthHeader';
import Button from '@/components/button/Button';
import LoginForm from './LoginForm';

export default function LoginView() {
  const t = useTranslations('LoginPage');
  const common = useTranslations('Common');

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
              <LoginForm />
              <Divider>
                <span className="surtitre">{common('or')}</span>
              </Divider>
              <Button variant="secondary" className="full-width">
                {/* <FcGoogle size={16} /> */}
                {t('signInWithMicrosoft')}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </ConfigProvider>
  );
}
