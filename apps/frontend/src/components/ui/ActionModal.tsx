'use client';

import { Modal } from 'antd';
import Button from './Button';

type ModalAction = {
  label: string;
  onClick: () => void;
};

type ActionModalProps = {
  open: boolean;
  onClose: () => void;
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  children?: React.ReactNode;
  primaryAction: ModalAction;
  secondaryAction: ModalAction;
};

export default function ActionModal({
  open,
  onClose,
  icon,
  title,
  description,
  children,
  primaryAction,
  secondaryAction,
}: ActionModalProps) {
  return (
    <Modal
      centered
      closable={{ 'aria-label': 'Custom Close Button' }}
      open={open}
      footer
      onCancel={onClose}
    >
      <div className="account-created-modal">
        <div className="account-created-modal__icon">{icon}</div>
        <h3>{title}</h3>
        <p>{description}</p>
        {children}
        <div className="account-created-modal__buttons">
          <Button className="full-width" onClick={primaryAction.onClick}>
            {primaryAction.label}
          </Button>
          <Button
            variant="secondary"
            className="full-width"
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.label}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
