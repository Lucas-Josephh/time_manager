import { UserController } from '../src/user/controllers/user.controller';
import { UserService } from '../src/user/services/user.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { AppController } from '../src/app.controller';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TeamController } from '../src/team/controllers/team.controller';
import { TeamService } from '../src/team/services/team.service';
import { OrganizationController } from '../src/organization/controllers/organization.controller';
import { OrganizationService } from '../src/organization/services/organization.service';

describe('Shared API documentation', () => {
  it('documents real envelopes, relations, filters and reusable errors', async () => {
    const module = await Test.createTestingModule({
      controllers: [TeamController, OrganizationController, UserController, AppController],
      providers: [
        { provide: PrismaService, useValue: {} },
        { provide: AuthService, useValue: {} },
        { provide: TeamService, useValue: {} },
        { provide: UserService, useValue: {} },
        { provide: OrganizationService, useValue: {} },
      ],
    }).compile();
    const app = module.createNestApplication();
    app.setGlobalPrefix('api');
    try {
      await app.init();
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().build(),
      );
      const users = document.paths['/api/users'];
      expect(users.post?.requestBody).toMatchObject({
        content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateUserDto' } } },
      });
      expect(users.get?.parameters).toEqual(expect.arrayContaining(
        ['page', 'limit', 'email', 'firstname', 'lastname'].map(name =>
          expect.objectContaining({ name, in: 'query', required: false }),
        ),
      ));
      expect(document.components?.schemas?.CreateUserDto).toMatchObject({
        required: expect.arrayContaining(['firstname', 'lastname', 'email', 'password']),
        properties: {
          firstname: { maxLength: 255 },
          password: { writeOnly: true, minLength: 12, maxLength: 128 },
          teamId: { example: 'team-administration' },
        },
      });
      expect(document.components?.schemas?.CreateUserDto).not.toHaveProperty('properties.name');
      expect(document.components?.schemas?.UpdateUserDto).not.toHaveProperty('properties.teamId');
      expect(document.components?.schemas?.UserDetailsDto).toMatchObject({
        properties: { name: { readOnly: true }, phone: { nullable: true } },
      });
      const teams = document.paths['/api/team'];
      const team = document.paths['/api/team/{id}'];
      const availableUsers = document.paths['/api/team/available-users'].get;
      expect(availableUsers?.responses['200']).toMatchObject({
        content: {
          'application/json': {
            schema: {
              properties: {
                message: { enum: ['team_available_users_listed'] },
                data: { type: 'array', items: { $ref: '#/components/schemas/UserSummaryDto' } },
              },
            },
          },
        },
      });
      for (const status of ['401', '403', '500']) {
        expect(availableUsers?.responses).toHaveProperty(status);
      }
      expect(availableUsers?.parameters).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'usage', required: true }), expect.objectContaining({ name: 'teamId', required: true })]));
      expect(document.paths).not.toHaveProperty('/api/team/{id}/available-users');
      expect(document.components?.schemas?.UserSummaryDto).toMatchObject({
        properties: { id: {}, firstname: {}, lastname: {} },
      });
      const organizations = document.paths['/api/organizations'];
      const organization = document.paths['/api/organizations/{id}'];
      for (const operation of [
        teams.get,
        teams.post,
        team.get,
        team.patch,
        team.delete,
        organizations.get,
        organization.get,
      ]) {
        expect(operation?.responses['500']).toMatchObject({
          content: {
            'application/json': {
              schema: {
                properties: {
                  success: { enum: [false] },
                  message: { enum: ['internal_server_error'] },
                },
              },
            },
          },
        });
      }
      expect(teams.post?.responses['201']).toMatchObject({
        content: {
          'application/json': {
            schema: {
              properties: {
                message: { enum: ['team_created'] },
                data: { $ref: '#/components/schemas/TeamWithRelationsDto' },
              },
            },
          },
        },
      });
      for (const status of ['401', '403']) {
        expect(teams.post?.responses).toHaveProperty(status);
      }
      expect(document.components?.schemas?.UserSummaryDto).not.toHaveProperty('properties.image');
      expect(teams.get?.parameters).toEqual(
        expect.arrayContaining(
          ['name', 'organizationId', 'managerId', 'memberId'].map((name) =>
            expect.objectContaining({ name, in: 'query', required: false }),
          ),
        ),
      );
      expect(teams.get?.responses).toHaveProperty('400');
      expect(team.get?.responses).toHaveProperty('404');
      expect(team.get?.responses['200']).toMatchObject({
        content: {
          'application/json': {
            schema: {
              properties: {
                data: {
                  $ref: '#/components/schemas/TeamWithRelationsDto',
                },
              },
            },
          },
        },
      });
      for (const operation of [teams.post, team.patch]) {
        expect(operation?.responses).toHaveProperty('400');
        expect(operation?.responses).toHaveProperty('409');
      }
      expect(organization.get?.responses['404']).toMatchObject({
        content: {
          'application/json': {
            schema: {
              properties: { message: { enum: ['not_found'] } },
            },
          },
        },
      });
      expect(organizations.get?.responses['200']).toMatchObject({
        content: {
          'application/json': {
            schema: {
              properties: {
                data: { $ref: '#/components/schemas/OrganizationListDto' },
              },
            },
          },
        },
      });
      expect(document.paths['/api/health'].get?.responses['200']).toMatchObject(
        {
          content: {
            'application/json': {
              schema: {
                properties: {
                  message: { enum: ['health_check_successful'] },
                  data: { $ref: '#/components/schemas/HealthDto' },
                },
              },
            },
          },
        },
      );
      const schemas = document.components?.schemas;
      expect(schemas?.OrganizationDetailsDto).toMatchObject({
        properties: { id: {}, name: {} },
      });
      expect(schemas?.OrganizationDetailsDto).toHaveProperty(
        'properties.createdAt',
      );
      expect(schemas?.UserSummaryDto).not.toHaveProperty('properties.email');
      expect(schemas?.TeamWithRelationsDto).toMatchObject({
        properties: {
          members: { items: { $ref: '#/components/schemas/UserSummaryDto' } },
        },
      });
    } finally {
      await app.close();
    }
  });
});
