import { mockFindUniqueOrThrow } from '../support/mock-find-unique-or-throw';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../../src/user/user.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TeamService } from '../../src/team/team.service';
import * as auth from '../../src/lib/auth';

describe('User provisioning', () => {
  afterEach(() => jest.restoreAllMocks());
  it('creates credentials and saves the complete profile within the same transaction', async () => {
    const signUpEmail = jest
      .fn()
      .mockResolvedValue({ user: { id: 'new-user' } });
    const createAuth = jest
      .spyOn(auth, 'createAuth')
      .mockReturnValue({ api: { signUpEmail } } as unknown as ReturnType<
        typeof auth.createAuth
      >);
    const tx = {
      user: {
        findUniqueOrThrow: mockFindUniqueOrThrow, findUnique: jest.fn().mockResolvedValue({
          id: 'new-user',
          phone: '+33612345678',
          mustChangePassword: true,
        }),
      },
    };
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    };
    const config = new ConfigService();
    const service = new UserService(
      prisma as unknown as PrismaService,
      config,
      {} as TeamService,
    );
    const dto = {
      firstname: 'Alice',
      lastname: 'Martin',
      email: 'alice@example.com',
      password: 'Temporary123!',
      phone: '+33612345678',
      isAdmin: true,
    };
    await expect(service.create(dto)).resolves.toMatchObject({
      id: 'new-user',
      mustChangePassword: true,
    });
    expect(createAuth).toHaveBeenCalledWith(tx, config, {
      provisionUsers: true,
    });
    expect(signUpEmail).toHaveBeenCalledWith({
      body: {
        email: dto.email,
        password: dto.password,
        name: `${dto.firstname} ${dto.lastname}`,
        firstname: dto.firstname,
        lastname: dto.lastname,
        phone: dto.phone,
        isAdmin: true,
        mustChangePassword: true,
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(tx.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'new-user' },
    });
  });
  it('rejects a missing team before creating authentication credentials', async () => {
    const tx = { team: { findUniqueOrThrow: mockFindUniqueOrThrow, findUnique: jest.fn().mockResolvedValue(null) } };
    const prisma = {
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    };
    const signup = jest.spyOn(auth, 'createAuth');
    const service = new UserService(
      prisma as unknown as PrismaService,
      new ConfigService(),
      new TeamService(prisma as unknown as PrismaService),
    );
    await expect(
      service.create({
        firstname: 'Alice',
        lastname: 'Martin',
        email: 'alice@example.com',
        password: 'Temporary123!',
        teamId: 'missing',
      }),
    ).rejects.toMatchObject({ code: 'P2025' });
    expect(signup).not.toHaveBeenCalled();
  });
});
