'use client';

import Input from '@/components/input/Input';
import { MailOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/button/Button';
import PasswordField from '@/components/input/PasswordField';

export default function LoginForm() {
  type FormErrors = Partial<Record<keyof typeof formData, string>>;

  const t = useTranslations('RegisterPage');
  const common = useTranslations('Common');
  const formRef = useRef<HTMLFormElement>(null);

  const [errors, setErrors] = useState<FormErrors>({});
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

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
      nextErrors.password = "Veuillez saisir un mot de passe";
      isValid = false;
    }

    setErrors(nextErrors);
    return isValid;
  };

  const handleSubmit: React.SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }
    // POST USER BLABLABLI.
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
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
          console.log('Email changed');
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
          console.log('Password changed');
          updateField('password', event.currentTarget.value);
        }}
        isVisible={isPasswordVisible}
        onToggleVisibility={handleTogglePasswordVisibility}
        autoComplete="current-password"
      />
      <Button type="submit" className="full-width">
        Log in
      </Button>
    </form>
  );
}
