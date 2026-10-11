'use client';

import Input from '@/components/ui/Input';
import Button from '../ui/Button';
import TemporaryPasswordField from './TemporaryPasswordField';
import {
  CheckCircleTwoTone,
  MailOutlined,
  PhoneOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { authClient } from '@/lib/auth-client';
import { useState } from 'react';
import InputMessage from '../ui/InputMessage';
import useAppNotification from '@/hooks/useAppNotification';
import { Modal } from 'antd';

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
  type FormErrors = Partial<Record<keyof typeof formData | 'names', string>>;

  const [errors, setErrors] = useState<FormErrors>({});
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
    // confirmPassword: '',
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
      nextErrors.names = 'Please enter a first name and a last name.';
      isValid = false;
    } else {
      if (!firstName) {
        nextErrors.firstName = 'Please enter a first name.';
        isValid = false;
      } else if (!lettersOnly.test(firstName)) {
        nextErrors.firstName = 'First name must contain only letters.';
        isValid = false;
      }

      if (!lastName) {
        nextErrors.lastName = 'Please enter a last name.';
        isValid = false;
      } else if (!lettersOnly.test(lastName)) {
        nextErrors.lastName = 'Last name must contain only letters.';
        isValid = false;
      }
    }

    if (!phone) {
      nextErrors.phone = 'Please enter a phone number.';
      isValid = false;
    } else if (!digitsOnly.test(phone)) {
      nextErrors.phone = 'Phone number must contain only digits.';
      isValid = false;
    }

    if (!email) {
      nextErrors.email = 'Please enter an email.';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Invalid email.';
      isValid = false;
    }

    // if (!formData.password) {
    //   nextErrors.password = 'Please enter a password.';
    //   isValid = false;
    // } else if (formData.password.length < PASSWORD_LENGTH) {
    //   nextErrors.password = `The password must be at least ${PASSWORD_LENGTH} characters long.`;
    //   isValid = false;
    // }

    // if (!formData.confirmPassword) {
    //   nextErrors.confirmPassword = 'Please confirm the password.';
    //   isValid = false;
    // } else if (formData.confirmPassword !== formData.password) {
    //   nextErrors.confirmPassword = 'The passwords are not the same.';
    //   isValid = false;
    // }

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
      notify('success', {
        title: 'Password copied',
        description: 'The password has been copied to your clipboard.',
      });
    } catch {
      notify('error', {
        title: 'Unable to copy password',
        description: 'Show the password and copy it manually.',
      });
    }
  };

  const showModal = () => {
    setIsModalOpen(true);
  };

  const handleOk = () => {
    setIsModalOpen(false);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const handleSubmit: React.SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    // POST USER BLABLABLI.
    // notify('success', {
    //   title: 'Please check the form',
    //   description: 'Correct the highlighted fields before continuing.',
    // });

    showModal();
  };

  return (
    <form
      onSubmit={handleSubmit}
      onFocus={handleFormFocus}
      autoComplete="off"
      noValidate
    >
      <div className="register-form__name-group">
        <div className="register-form__name-fields">
          <Input
            id="firstName"
            name="firstName"
            label="First Name"
            type="text"
            placeholder="John"
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
            label="Last Name"
            type="text"
            placeholder="Doe"
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
        label="Phone"
        type="text"
        placeholder="e.g. 06 12 34 56 78"
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
        label="Email"
        type="email"
        placeholder="you@example.com"
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
        message={
          formData.password
            ? 'A temporary password has been generated automatically. The employee will be asked to change it upon their first login.'
            : undefined
        }
        aria-invalid={Boolean(errors.password)}
        aria-describedby={errors.password ? 'password-error' : undefined}
      />
      {/* <Input
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm Password"
        type="password"
        placeholder="••••••••"
        icon={<LockOutlined />}
        required
        value={formData.confirmPassword}
        error={errors.confirmPassword}
        aria-invalid={Boolean(errors.confirmPassword)}
        aria-describedby={
          errors.confirmPassword ? 'confirmPassword-error' : undefined
        }
        onChange={(event) =>
          updateField('confirmPassword', event.currentTarget.value)
        }
      ></Input> */}
      <Button type="submit" className="full-width">
        Create account
      </Button>
      <Modal
        centered
        closable={{ 'aria-label': 'Custom Close Button' }}
        open={isModalOpen}
        footer
        onOk={handleOk}
        onCancel={handleCancel}
      >
        <div className="account-created-modal">
          <div className="account-created-modal__icon">
            <CheckCircleTwoTone
              twoToneColor={[
                'var(--color-success)',
                'var(--color-card-background)',
              ]}
              style={{ fontSize: '35px' }}
            />
          </div>
          <h3>Employee account created!</h3>
          <p>
            {formData.firstName} {formData.lastName}&apos;s account is ready.
            Share the temporary password with the employee so they can sign in.
          </p>
          <TemporaryPasswordField
            id="account-created-password"
            value={formData.password}
            wrapperClassName="account-created-modal__password-field"
            isVisible={isPasswordVisible}
            onToggleVisibility={() =>
              setIsPasswordVisible((previous) => !previous)
            }
            onCopy={handleCopyPassword}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
          />
          <div className="warning-card">
            <WarningOutlined />
            <div>
              <h4>
                Save this password before continuing <br />
              </h4>
              <p>
                This password will only be shown once. Make sure to copy it
                before closing this window.
              </p>
            </div>
          </div>
          <InputMessage
            type="info"
            message="The employee must change this password on their first login."
            id="names-error"
          />
        </div>
      </Modal>
    </form>
  );
}
