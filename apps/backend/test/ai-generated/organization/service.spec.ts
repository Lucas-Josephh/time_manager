import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrganizationService } from '../../../src/organization/organization.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('OrganizationService', () => {
  let service: OrganizationService;
  const prisma = {
    $transaction: jest.fn(),
    organization: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const organization = {
    id: 'department-it',
    name: 'IT',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((queries) => Promise.all(queries));
    prisma.organization.count.mockResolvedValue(0);
    const module = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(OrganizationService);
  });

  describe('findAll', () => {
    it('requests organizations ordered by name and returns their data', async () => {
      const organizations = [
        organization,
        { ...organization, id: 'department-sales', name: 'Sales' },
      ];
      prisma.organization.findMany.mockResolvedValue(organizations);
      prisma.organization.count.mockResolvedValue(2);

      await expect(service.findAll()).resolves.toEqual({ items: organizations, meta: { total: 2, page: 1, limit: 10, totalPages: 1 } });
      expect(prisma.organization.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0, take: 10,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      });
      expect(prisma.organization.findMany).toHaveBeenCalledTimes(1);
    });

    it('returns an empty list when no organizations exist', async () => {
      prisma.organization.findMany.mockResolvedValue([]);

      await expect(service.findAll()).resolves.toEqual({ items: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } });
    });

    it('propagates database failures', async () => {
      const error = new Error('Database unavailable');
      prisma.organization.findMany.mockRejectedValue(error);

      await expect(service.findAll()).rejects.toBe(error);
    });
  });

  describe('findOne', () => {
    it('returns the organization matching the requested identifier', async () => {
      prisma.organization.findUnique.mockResolvedValue(organization);

      await expect(service.findOne(organization.id)).resolves.toEqual(organization);
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: organization.id },
      });
      expect(prisma.organization.findUnique).toHaveBeenCalledTimes(1);
    });

    it('throws a 404 when the organization is missing', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      const result = service.findOne('missing-organization');

      await expect(result).rejects.toBeInstanceOf(NotFoundException);
      await expect(result).rejects.toMatchObject({
        status: 404,
      });
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'missing-organization' },
      });
    });

    it('propagates database failures instead of reporting a missing organization', async () => {
      const error = new Error('Database unavailable');
      prisma.organization.findUnique.mockRejectedValue(error);

      await expect(service.findOne(organization.id)).rejects.toBe(error);
    });
  });
});
