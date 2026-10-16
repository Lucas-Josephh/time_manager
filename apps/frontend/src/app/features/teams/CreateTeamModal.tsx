'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, UserRoundGroup, X } from 'lucide-react';
import { Form, Select } from 'antd';
import ActionModal from '@/components/modal/ActionModal';
import Button from '@/components/button/Button';
import { Card } from '@/components/card/card';
import Input from '@/components/input/Input';
import UserSummary from '@/components/userSummary/UserSummary';
import { Person } from './TeamsView';

type CreateTeamModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export default function CreateTeamModal({
  open,
  onClose,
  onCreated,
}: CreateTeamModalProps) {
  const t = useTranslations('TeamsPage.createTeam');
  const [isEmployeeSelectVisible, setIsEmployeeSelectVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [employeesWithoutTeam, setEmployeesWithoutTeam] = useState<Person[]>(
    [],
  );
  const [selectedEmployees, setSelectedEmployees] = useState<Person[]>([]);
  const [managerId, setManagerId] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<string>('');

  const [formData, setFormData] = useState({
    name: '',
    // managerId: '',
    // departmentId: '',
  });

  // Keep employees without a team who haven't already been selected
  const availableEmployees = employeesWithoutTeam.filter(
    (employee) =>
      !selectedEmployees.some((selected) => selected.id === employee.id),
  );

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const getEmployeesWithoutTeam = () => {
    // do a GET /api/users/available-for-team
    // setEmployeesWithoutTeam(employees)
  };

  const getManagerInfo = () => {
    // do a GET to get the ManagerId and DepartmentId from the current session
  };

  const handleAddEmployee = (employeeId: string) => {
    const employee = availableEmployees.find(
      (person) => person.id === employeeId,
    );

    if (!employee) return;

    // Double check to see if the employee is already selected
    setSelectedEmployees((previous) =>
      previous.some((person) => person.id === employeeId)
        ? previous
        : [...previous, employee],
    );

    setIsEmployeeSelectVisible(false);
  };

  const handleRemoveEmployee = (employeeId: string) => {
    setSelectedEmployees((previous) =>
      previous.filter((employee) => employee.id !== employeeId),
    );
  };

  const resetForm = () => {
    setFormData({
      name: '',
      // managerId: '',
      // departmentId: '',
    });

    setSelectedEmployees([]);
    setIsEmployeeSelectVisible(false);
    setSubmitError(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;

    resetForm();
    onClose();
  };

  async function createTeam() {
    try {
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          managerId: managerId,
          departmentId: departmentId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create the team.');
      }

      onCreated();
      resetForm();
      onClose();
    } catch {
      setSubmitError(t('createFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const name = formData.name.trim();

    if (!name) {
      setSubmitError(t('validation.nameRequired'));
      return;
    }

    if (name.length > 255) {
      setSubmitError(t('validation.nameTooLong'));
      return;
    }

    setSubmitError(null);

    setIsSubmitting(true);

    await createTeam();
  };

  return (
    <ActionModal
      open={open}
      onClose={handleClose}
      icon={<UserRoundGroup />}
      title="Create team"
      description="Enter the team's details to create one."
      primaryAction={{
        label: t('create'),
        onClick: handleSubmit,
        disabled: isSubmitting,
      }}
      secondaryAction={{
        label: t('cancel'),
        onClick: handleClose,
        disabled: isSubmitting,
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
              placeholder={t('selectEmployee')}
              style={{ height: 'var(--button-height)' }}
              notFoundContent={t('noEmployeesAvailable')}
              options={availableEmployees.map((employee) => ({
                label: `${employee.firstName} ${employee.lastName}`,
                value: employee.id,
              }))}
              onChange={handleAddEmployee}
            />{' '}
          </Form.Item>
        )}
        {selectedEmployees.map((employee) => (
          <Card key={employee.id} className="teams-form_employee-card">
            <UserSummary
              userName={`${employee.firstName} ${employee.lastName}`}
            />
            <Button
              icon={X}
              className="teams-form_employee-card-close"
              aria-label={t('removeEmployee', {
                firstName: employee.firstName,
                lastName: employee.lastName,
              })}
              onClick={() => handleRemoveEmployee(employee.id)}
            />
          </Card>
        ))}
        {submitError && (
          <p role="alert" className="input-message input-message--error">
            {submitError}
          </p>
        )}
      </form>
    </ActionModal>
  );
}
