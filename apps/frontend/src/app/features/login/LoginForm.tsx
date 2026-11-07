'use client';

import Input from '@/components/input/Input';
import { LoadingOutlined, MailOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import Button from '@/components/button/Button';
import PasswordField from '@/components/input/PasswordField';
import MessageCard from '@/components/message-card/MessageCard';

export default function LoginForm() {
  type FormErrors = Partial<Record<keyof typeof formData, string>>;

  const t = useTranslations('RegisterPage');
  const common = useTranslations('Common');
  const login = useTranslations('LoginPage');
  
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const [errors, setErrors] = useState<FormErrors>({});
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleTogglePasswordVisibility = () => {
    const form = formRef.current;

    if (!form) return;

    const emailInput = form.elements.namedItem('email');
    const passwordInput = form.elements.namedItem('password');

    if (
      emailInput instanceof HTMLInputElement &&
      passwordInput instanceof HTMLInputElement
    ) {
      const email = emailInput.value;
      const password = passwordInput.value;

      setFormData((previous) => ({
        ...previous,
        email,
        password,
      }));

      setIsPasswordVisible((previous) => !previous);
    }
  };

  const validateForm = (): boolean => {
    let isValid = true;
    const nextErrors: FormErrors = {};

    const email = formData.email.trim();

    if (!email) {
      nextErrors.email = t('validation.emailRequired');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = t('validation.emailInvalid');
      isValid = false;
    }

    if (!formData.password) {
      nextErrors.password = login('validation.passwordRequired');
      isValid = false;
    }

    setErrors(nextErrors);
    return isValid;
  };

  const handleSubmit: React.SubmitEventHandler<HTMLFormElement> = async (
    event,
  ) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await authClient.signIn.email({
        email: formData.email.trim(),
        password: formData.password,
      });

      if (error) {
        setSubmitError(error.message ?? login('errors.signInFailed'));
        return;
      }

      router.replace('/');
      router.refresh();
    } catch {
      setSubmitError(login('errors.serverUnavailable'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="login-form"
    >
      <Input
        id="email"
        name="email"
        label={common('email')}
        type="email"
        placeholder={t('placeholders.email')}
        icon={<MailOutlined />}
        required
        value={formData.email}
        error={errors.email}
        onChange={(event) => {
          updateField('email', event.currentTarget.value);
        }}
        aria-invalid={Boolean(errors.email)}
        aria-describedby={errors.email ? 'email-error' : undefined}
        autoComplete="username"
      ></Input>
      <PasswordField
        id="login-password"
        label="Mot de passe"
        value={formData.password}
        error={errors.password}
        onChange={(event) => {
          updateField('password', event.currentTarget.value);
        }}
        isVisible={isPasswordVisible}
        onToggleVisibility={handleTogglePasswordVisibility}
        autoComplete="current-password"
      />
      {submitError && <MessageCard type="error" message={submitError} />}
      <Button type="submit" className="full-width" disabled={isSubmitting}>
        {isSubmitting ? <LoadingOutlined /> : common('signIn')}
      </Button>
    </form>
  );
}
