import { ConfigProvider, Divider } from 'antd';
import { useTranslations } from 'next-intl';
import AuthHeader from '../auth/AuthHeader';
import Button from '@/components/button/Button';
import LoginForm from './LoginForm';

export default function LoginView() {
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
              title="Welcome back"
              subtitle="Login to your account"
            ></AuthHeader>
            <div className="card">
              <LoginForm />
              <Divider>
                <span className="surtitre">Or</span>
              </Divider>
              <Button variant="secondary" className="full-width">
                {/* <FcGoogle size={16} /> */}
                Continue with Microsoft
              </Button>
            </div>
          </div>
        </div>
      </main>
    </ConfigProvider>
  );
}
