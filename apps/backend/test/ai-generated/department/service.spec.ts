import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DepartmentService } from '../../../src/department/department.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('DepartmentService', () => {
  let service: DepartmentService;
  const prisma = {
    department: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const department = {
    id: 'department-it',
    name: 'IT',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        DepartmentService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(DepartmentService);
  });

  describe('findAll', () => {
    it('requests departments ordered by name and returns their data', async () => {
      const departments = [
        department,
        { ...department, id: 'department-sales', name: 'Sales' },
      ];
      prisma.department.findMany.mockResolvedValue(departments);

      await expect(service.findAll()).resolves.toEqual(departments);
      expect(prisma.department.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
      expect(prisma.department.findMany).toHaveBeenCalledTimes(1);
    });

    it('returns an empty list when no departments exist', async () => {
      prisma.department.findMany.mockResolvedValue([]);

      await expect(service.findAll()).resolves.toEqual([]);
    });

    it('propagates database failures', async () => {
      const error = new Error('Database unavailable');
      prisma.department.findMany.mockRejectedValue(error);

      await expect(service.findAll()).rejects.toBe(error);
    });
  });

  describe('findOne', () => {
    it('returns the department matching the requested identifier', async () => {
      prisma.department.findUnique.mockResolvedValue(department);

      await expect(service.findOne(department.id)).resolves.toEqual(department);
      expect(prisma.department.findUnique).toHaveBeenCalledWith({
        where: { id: department.id },
      });
      expect(prisma.department.findUnique).toHaveBeenCalledTimes(1);
    });

    it('throws a 404 with department_not_found when the department is missing', async () => {
      prisma.department.findUnique.mockResolvedValue(null);

      const result = service.findOne('missing-department');

      await expect(result).rejects.toBeInstanceOf(NotFoundException);
      await expect(result).rejects.toMatchObject({
        message: 'department_not_found',
        status: 404,
      });
      expect(prisma.department.findUnique).toHaveBeenCalledWith({
        where: { id: 'missing-department' },
      });
    });

    it('propagates database failures instead of reporting a missing department', async () => {
      const error = new Error('Database unavailable');
      prisma.department.findUnique.mockRejectedValue(error);

      await expect(service.findOne(department.id)).rejects.toBe(error);
    });
  });
});
