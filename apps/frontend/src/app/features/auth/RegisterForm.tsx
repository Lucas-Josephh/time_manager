'use client';

import Input from '@/components/input/Input';
import TemporaryPasswordField from './TemporaryPasswordField';
import {
  CheckCircleTwoTone,
  MailOutlined,
  PhoneOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import useAppNotification from '@/hooks/useAppNotification';
import Button from '@/components/button/Button';
import InputMessage from '@/components/input/InputMessage';
import ActionModal from '@/components/modal/ActionModal';

const PASSWORD_LENGTH = 12;

function generatePassword(): string {
  const characters =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';

  const randomValues = new Uint32Array(PASSWORD_LENGTH);

  crypto.getRandomValues(randomValues);

  return Array.from(
    randomValues,
    (value) => characters[value % characters.length],
  ).join('');
}

export default function RegisterForm() {
  const t = useTranslations('RegisterPage');
  const common = useTranslations('Common');
  type FormErrors = Partial<Record<keyof typeof formData | 'names', string>>;

  const [errors, setErrors] = useState<FormErrors>({});
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // const [isPasswordWarningOpen, setIsPasswordWarningOpen] = useState(false);
  // const [hasCopiedPassword, setHasCopiedPassword] = useState(false);
  // const [pendingAction, setPendingAction] = useState<
  //   'close' | 'createAnother' | null
  // >(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
  });

  const { notify } = useAppNotification();

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const validateForm = (): boolean => {
    let isValid = true;
    const nextErrors: FormErrors = {};

    const lettersOnly = /^\p{L}+$/u;
    const digitsOnly = /^[0-9]+$/;

    const firstName = formData.firstName.trim();
    const lastName = formData.lastName.trim();
    const phone = formData.phone.trim();
    const email = formData.email.trim();

    if (!lastName && !firstName) {
      nextErrors.names = t('validation.namesRequired');
      isValid = false;
    } else {
      if (!firstName) {
        nextErrors.firstName = t('validation.firstNameRequired');
        isValid = false;
      } else if (!lettersOnly.test(firstName)) {
        nextErrors.firstName = t('validation.firstNameLettersOnly');
        isValid = false;
      }

      if (!lastName) {
        nextErrors.lastName = t('validation.lastNameRequired');
        isValid = false;
      } else if (!lettersOnly.test(lastName)) {
        nextErrors.lastName = t('validation.lastNameLettersOnly');
        isValid = false;
      }
    }

    if (!phone) {
      nextErrors.phone = t('validation.phoneRequired');
      isValid = false;
    } else if (!digitsOnly.test(phone)) {
      nextErrors.phone = t('validation.phoneDigitsOnly');
      isValid = false;
    }

    if (!email) {
      nextErrors.email = t('validation.emailRequired');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = t('validation.emailInvalid');
      isValid = false;
    }

    setErrors(nextErrors);
    return isValid;
  };

  const handleFormFocus = () => {
    if (formData.password) return;

    const password = generatePassword();

    setFormData((previous) => ({
      ...previous,
      password,
    }));
  };

  const handleCopyPassword = async () => {
    if (!formData.password) return;

    try {
      await navigator.clipboard.writeText(formData.password);
      // setHasCopiedPassword(true);
      notify('success', {
        title: t('notifications.passwordCopiedTitle'),
        description: t('notifications.passwordCopiedDescription'),
      });
    } catch {
      notify('error', {
        title: t('notifications.passwordCopyFailedTitle'),
        description: t('notifications.passwordCopyFailedDescription'),
      });
    }
  };

  const showModal = () => {
    setIsModalOpen(true);
  };

  const resetForAnotherAccount = () => {
    setFormData({
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      password: '',
    });
    setErrors({});
    setIsPasswordVisible(false);
    setIsModalOpen(false);
  };

  const handleCreateAnother = () => {
    resetForAnotherAccount();
  };

  const handleCloseAccountModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit: React.SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    // POST USER BLABLABLI.

    showModal();
  };

  return (
    <form
      onSubmit={handleSubmit}
      onFocus={handleFormFocus}
      autoComplete="off"
      noValidate
      className="register-form"
    >
      <div className="register-form__name-group">
        <div className="register-form__name-fields">
          <Input
            id="firstName"
            name="firstName"
            label={common('firstName')}
            type="text"
            placeholder={t('placeholders.firstName')}
            icon={<UserOutlined />}
            required
            value={formData.firstName}
            error={errors.firstName}
            onChange={(event) =>
              updateField('firstName', event.currentTarget.value)
            }
            aria-invalid={Boolean(errors.firstName || errors.names)}
            aria-describedby={
              errors.names
                ? 'names-error'
                : errors.firstName
                  ? 'firstName-error'
                  : undefined
            }
          ></Input>
          <Input
            id="lastName"
            name="lastName"
            label={common('lastName')}
            type="text"
            placeholder={t('placeholders.lastName')}
            icon={<UserOutlined />}
            required
            value={formData.lastName}
            error={errors.lastName}
            onChange={(event) =>
              updateField('lastName', event.currentTarget.value)
            }
            aria-invalid={Boolean(errors.lastName || errors.names)}
            aria-describedby={
              errors.names
                ? 'names-error'
                : errors.lastName
                  ? 'lastName-error'
                  : undefined
            }
          ></Input>
        </div>
        <InputMessage type="error" message={errors.names} id="names-error" />
      </div>
      <Input
        id="phone"
        name="phone"
        label={common('phone')}
        type="text"
        placeholder={t('placeholders.phone')}
        icon={<PhoneOutlined />}
        required
        value={formData.phone}
        error={errors.phone}
        onChange={(event) => updateField('phone', event.currentTarget.value)}
        aria-invalid={Boolean(errors.phone)}
        aria-describedby={errors.phone ? 'phone-error' : undefined}
      ></Input>
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
        onChange={(event) => updateField('email', event.currentTarget.value)}
        aria-invalid={Boolean(errors.email)}
        aria-describedby={errors.email ? 'email-error' : undefined}
      ></Input>
      <TemporaryPasswordField
        id="register-password"
        value={formData.password}
        isVisible={isPasswordVisible}
        onToggleVisibility={() => setIsPasswordVisible((previous) => !previous)}
        onCopy={handleCopyPassword}
        message={formData.password ? t('temporaryPasswordHelp') : undefined}
        aria-invalid={Boolean(errors.password)}
        aria-describedby={errors.password ? 'password-error' : undefined}
      />
      <Button type="submit" className="full-width">
        {t('createAccount')}
      </Button>
      <ActionModal
        open={isModalOpen}
        onClose={handleCloseAccountModal}
        icon={
          <CheckCircleTwoTone
            twoToneColor={[
              'var(--color-success)',
              'var(--color-card-background)',
            ]}
            style={{ fontSize: '35px' }}
          />
        }
        title={t('success.title')}
        description={t('success.description', {
          firstName: formData.firstName,
          lastName: formData.lastName,
        })}
        primaryAction={{
          label: common('done'),
          onClick: handleCloseAccountModal,
        }}
        secondaryAction={{
          label: t('success.createAnother'),
          onClick: handleCreateAnother,
        }}
      >
        <TemporaryPasswordField
          id="account-created-password"
          value={formData.password}
          wrapperClassName="account-created-modal__password-field"
          isVisible={isPasswordVisible}
          onToggleVisibility={() =>
            setIsPasswordVisible((previous) => !previous)
          }
          onCopy={handleCopyPassword}
        />

        <div className="warning-card">
          <WarningOutlined />
          <div>
            <h4>{t('success.savePasswordTitle')}</h4>
            <p>{t('success.savePasswordDescription')}</p>
          </div>
        </div>

        <InputMessage
          type="info"
          message={t('success.passwordChangeRequired')}
          id="account-created-password-info"
        />
      </ActionModal>
    </form>
  );
}
