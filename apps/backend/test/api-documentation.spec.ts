import { AuthService } from '../src/auth/auth.service';
import { AppController } from '../src/app.controller';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TeamController } from '../src/team/team.controller';
import { TeamService } from '../src/team/team.service';
import { OrganizationController } from '../src/organization/organization.controller';
import { OrganizationService } from '../src/organization/organization.service';

describe('Shared API documentation', () => {
  it('documents real envelopes, relations, filters and reusable errors', async () => {
    const module = await Test.createTestingModule({
      controllers: [TeamController, OrganizationController, AppController],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: TeamService, useValue: {} },
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
      const teams = document.paths['/api/team'];
      const team = document.paths['/api/team/{id}'];
      const organizations = document.paths['/api/organizations'];
      const organization = document.paths['/api/organizations/{id}'];
      for (const operation of [
        teams.get,
        teams.post,
        team.get,
        team.put,
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
                data: { $ref: '#/components/schemas/TeamDetailsDto' },
              },
            },
          },
        },
      });
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
      for (const operation of [teams.post, team.put, team.patch]) {
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
                data: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/OrganizationDetailsDto' },
                },
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
