import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  CreateScheduleDto,
  QueryScheduleDto,
  UpdateScheduleDto,
} from './schedule.dto';
import { validationOptions } from '../../common/validation/validation.config';

function validSchedule() {
  return {
    name: 'Matin',
    weeklySchedule: {
      '1': [{ startTime: '09:00', endTime: '17:00' }],
      '2': [],
      '3': [],
      '4': [],
      '5': [],
      '6': [],
      '7': [],
    },
  };
}

// Exercise transformation and nested validation as an incoming request would.
const pipe = new ValidationPipe(validationOptions);
const create = (body: unknown) =>
  pipe.transform(body, { type: 'body', metatype: CreateScheduleDto });
const update = (body: unknown) =>
  pipe.transform(body, { type: 'body', metatype: UpdateScheduleDto });
const query = (value: unknown) =>
  pipe.transform(value, { type: 'query', metatype: QueryScheduleDto });

describe('Schedule DTO validation', () => {
  describe('creation', () => {
    it('accepts a complete week and trims its name', async () => {
      const result = await create({ ...validSchedule(), name: '  Matin  ' });
      expect(result.name).toBe('Matin');
      expect(result.weeklySchedule['1'][0].startTime).toBe('09:00');
    });

    it.each([undefined, null, '', '   ', 12, 'a'.repeat(256)])(
      'rejects an invalid name: %p',
      async (name) => {
        await expect(
          create({ ...validSchedule(), name }),
        ).rejects.toBeInstanceOf(BadRequestException);
      },
    );

    it('accepts a name at the maximum length', async () => {
      await expect(
        create({ ...validSchedule(), name: 'a'.repeat(255) }),
      ).resolves.toBeDefined();
    });

    it.each([undefined, null, [], 'week'])(
      'rejects an invalid week: %p',
      async (weeklySchedule) => {
        await expect(
          create({ name: 'Matin', weeklySchedule }),
        ).rejects.toBeInstanceOf(BadRequestException);
      },
    );

    it.each(['1', '2', '3', '4', '5', '6', '7'] as const)(
      'requires weekday %s even when it has no slots',
      async (day) => {
        const body = validSchedule();
        Reflect.deleteProperty(body.weeklySchedule, day);
        await expect(create(body)).rejects.toBeInstanceOf(BadRequestException);
      },
    );

    it.each([null, {}, '09:00'])(
      'rejects a day that is not an array: %p',
      async (slots) => {
        const body = validSchedule();
        await expect(
          create({
            ...body,
            weeklySchedule: { ...body.weeklySchedule, '1': slots },
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      },
    );

    it.each(['0:00', '9:00', '09:00', '23:59'])(
      'accepts a valid time: %s',
      async (time) => {
        const body = validSchedule();
        body.weeklySchedule['1'][0].startTime = time;
        await expect(create(body)).resolves.toBeDefined();
      },
    );

    it.each(['24:00', '09:60', '9:0', '09:00:00', '', null, 900, undefined])(
      'rejects invalid nested slot times: %p',
      async (time) => {
        const body = validSchedule();
        for (const field of ['startTime', 'endTime']) {
          const slot = { startTime: '09:00', endTime: '17:00', [field]: time };
          await expect(
            create({
              ...body,
              weeklySchedule: { ...body.weeklySchedule, '1': [slot] },
            }),
          ).rejects.toBeInstanceOf(BadRequestException);
        }
      },
    );

    it('rejects a creator supplied in the request body', async () => {
      await expect(
        create({ ...validSchedule(), createdByUserId: 'someone-else' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects unexpected weekdays and nested slot properties', async () => {
      const body = validSchedule();
      await expect(
        create({
          ...body,
          weeklySchedule: { ...body.weeklySchedule, '8': [] },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        create({
          ...body,
          weeklySchedule: {
            ...body.weeklySchedule,
            '1': [{ startTime: '09:00', endTime: '17:00', extra: true }],
          },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('partial update', () => {
    it.each([
      {},
      { name: 'Soir' },
      { weeklySchedule: validSchedule().weeklySchedule },
    ])('accepts omitted fields: %p', async (body) => {
      await expect(update(body)).resolves.toBeDefined();
    });

    it('still requires every weekday when the week is supplied', async () => {
      await expect(
        update({ weeklySchedule: { '1': [] } }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('still validates supplied names and nested times', async () => {
      await expect(update({ name: '   ' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      const week = validSchedule().weeklySchedule;
      week['1'][0].endTime = '25:00';
      await expect(update({ weeklySchedule: week })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('list query', () => {
    it('converts pagination strings to numbers and trims filters', async () => {
      const result = await query({
        page: '2',
        limit: '20',
        name: ' Matin ',
        createdByUserId: ' user-1 ',
      });
      expect(result).toMatchObject({
        page: 2,
        limit: 20,
        name: 'Matin',
        createdByUserId: 'user-1',
      });
    });

    it('accepts omitted pagination and filters', async () => {
      await expect(query({})).resolves.toBeDefined();
    });

    it.each([
      { page: '0' },
      { page: '1.5' },
      { page: 'abc' },
      { limit: '0' },
      { limit: '101' },
      { limit: '2.5' },
      { name: '   ' },
      { createdByUserId: '' },
    ])('rejects invalid query parameters: %p', async (filters) => {
      await expect(query(filters)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
