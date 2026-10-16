import { AppController } from '../src/app.controller';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TeamController } from '../src/team/team.controller';
import { TeamService } from '../src/team/team.service';
import { DepartmentController } from '../src/department/department.controller';
import { DepartmentService } from '../src/department/department.service';
import { AuthGuard } from '../src/auth/auth.guard';

describe('Shared API documentation', () => {
  it('documents real envelopes, relations, filters and reusable errors', async () => {
    const module = await Test.createTestingModule({
      controllers: [TeamController, DepartmentController, AppController],
      providers: [
        { provide: TeamService, useValue: {} },
        { provide: DepartmentService, useValue: {} },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
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
      const departments = document.paths['/api/departments'];
      const department = document.paths['/api/departments/{id}'];
      for (const operation of [
        teams.get,
        teams.post,
        team.get,
        team.put,
        team.patch,
        team.delete,
        departments.get,
        department.get,
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
          ['name', 'departmentId', 'managerId', 'memberId'].map((name) =>
            expect.objectContaining({ name, in: 'query', required: false }),
          ),
        ),
      );
      expect(teams.get?.responses).toHaveProperty('400');
      expect(team.get?.responses).not.toHaveProperty('404');
      expect(team.get?.responses['200']).toMatchObject({
        content: {
          'application/json': {
            schema: {
              properties: {
                data: {
                  oneOf: [
                    { $ref: '#/components/schemas/TeamWithRelationsDto' },
                    { type: 'object', additionalProperties: false },
                  ],
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
      expect(department.get?.responses['404']).toMatchObject({
        content: {
          'application/json': {
            schema: {
              properties: { message: { enum: ['department_not_found'] } },
            },
          },
        },
      });
      expect(departments.get?.responses['200']).toMatchObject({
        content: {
          'application/json': {
            schema: {
              properties: {
                data: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/DepartmentDetailsDto' },
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
      expect(schemas?.DepartmentDetailsDto).toMatchObject({
        properties: { id: {}, name: {} },
      });
      expect(schemas?.DepartmentDetailsDto).not.toHaveProperty(
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
