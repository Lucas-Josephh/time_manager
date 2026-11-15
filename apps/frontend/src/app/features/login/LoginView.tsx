'use client';

import './LoginView.scss';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ConfigProvider, Divider } from 'antd';
import { useTranslations } from 'next-intl';
import { authClient } from '@/lib/auth-client';
import AuthHeader from '../auth/AuthHeader';
import Button from '@/components/button/Button';
import LoginForm from './LoginForm';
import MessageCard from '@/components/message-card/MessageCard';
import { LoadingOutlined, WindowsFilled } from '@ant-design/icons';

export default function LoginView() {
  const t = useTranslations('LoginPage');
  const common = useTranslations('Common');
  const searchParams = useSearchParams();

  const [isMicrosoftPending, setIsMicrosoftPending] = useState(false);
  const [microsoftError, setMicrosoftError] = useState<string | null>(null);
  const [callbackErrorDismissed, setCallbackErrorDismissed] = useState(false);

  // Erreur reçue après le retour de Microsoft
  const callbackError =
    !callbackErrorDismissed && searchParams.get('microsoft') === 'failed'
      ? t('errors.microsoftCallbackError')
      : null;

  const displayedError = microsoftError || callbackError;

  async function handleMicrosoftSignIn() {
    if (isMicrosoftPending) return;

    setIsMicrosoftPending(true);
    setMicrosoftError(null);
    setCallbackErrorDismissed(true);

    try {
      const { error } = await authClient.signIn.social({
        provider: 'microsoft',
        callbackURL: `${window.location.origin}/`,
        errorCallbackURL: `${window.location.origin}/login?microsoft=failed`,
      });

      if (error) {
        setMicrosoftError(error.message || t('errors.microsoftSignInFailed'));
      }
    } catch {
      setMicrosoftError(t('errors.serverUnavailable'));
    } finally {
      setIsMicrosoftPending(false);
    }
  }

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

            <div className="card card--login">
              <LoginForm />
              <Divider>
                <span className="surtitre">{common('or')}</span>
              </Divider>
              <Button
                variant="secondary"
                className="full-width"
                disabled={isMicrosoftPending}
                aria-busy={isMicrosoftPending}
                onClick={handleMicrosoftSignIn}
              >
                {isMicrosoftPending ? (
                  <LoadingOutlined />
                ) : (
                  <>
                    <WindowsFilled /> {t('signInWithMicrosoft')}
                  </>
                )}
              </Button>

              {displayedError && (
                <MessageCard type="error" message={displayedError} />
              )}
            </div>
          </div>
        </div>
      </main>
    </ConfigProvider>
  );
}
