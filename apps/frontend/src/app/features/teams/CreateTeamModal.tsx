'use client';

import { useState } from 'react';
import { Plus, UserRoundGroup } from 'lucide-react';
import { Form, Select } from 'antd';
import ActionModal from '@/components/modal/ActionModal';
import Button from '@/components/button/Button';
import { Card } from '@/components/card/card';
import Input from '@/components/input/Input';
import UserSummary from '@/components/userSummary/UserSummary';

type CreateTeamModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function CreateTeamModal({
  open,
  onClose,
}: CreateTeamModalProps) {
  const [isEmployeeSelectVisible, setIsEmployeeSelectVisible] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    managerId: '',
    departmentId: '',
  });

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSubmit = () => {
    return;
  };

  return (
    <ActionModal
      open={open}
      onClose={onClose}
      icon={<UserRoundGroup />}
      title="Create team"
      description="Enter the team's details to create one."
      primaryAction={{ label: 'Create', onClick: handleSubmit }}
      secondaryAction={{
        label: 'Cancel',
        onClick: onClose,
      }}
    >
      <form className="teams-form">
        <Input
          id="name"
          name="name"
          label="Name"
          type="text"
          placeholder="e.g. Marketing"
          required
          value={formData.name}
          onChange={(event) => updateField('name', event.currentTarget.value)}
        ></Input>
        <Button
          variant="secondary"
          icon={Plus}
          style={{ alignSelf: 'flex-start' }}
          onClick={() => setIsEmployeeSelectVisible(true)}
        >
          Add employee
        </Button>
        {isEmployeeSelectVisible && (
          <Form.Item>
            <Select
              placeholder="Select and employee"
              style={{ height: 'var(--button-height' }}
              options={[
                { label: 'Employee 1 · Role', value: 'employee1' },
                { label: 'Employee 2 · Role ', value: 'employee2' },
              ]}
            />{' '}
          </Form.Item>
        )}
        <Card className="teams-form_employee-card">
          <UserSummary />
        </Card>
      </form>
    </ActionModal>
  );
}
