import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import {
  OrganizationDetailsDto,
  OrganizationDto,
  PartialOrganizationDto,
  QueryOrganizationDto,
} from './dto/organization.dto';
import { SerializeResponse } from '../common/serialization/serialize-response.decorator';
import { ResponseMessage } from '../common/decorator/response-message.decorator';
import { AuthGuard } from '../auth/auth.guard';
import {
  ApiConflictError,
  ApiNotFoundError,
  ApiResourceId,
  ApiServerError,
  ApiSuccessResponse,
  ApiValidationError,
  ApiWriteErrors,
} from '../common/swagger/api-response.decorator';

// TODO: Implement the guard by admin or manager of the organization or its parent organizations

@ApiTags('Organization')
@ApiServerError()
@ApiUnauthorizedResponse({ description: 'Session absente ou expirée.' })
@Controller('organizations')
@UseGuards(AuthGuard)
@SerializeResponse(OrganizationDetailsDto)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @ApiOperation({
    summary: 'Créer une organisation',
    description:
      'Session requise. Contrôle du périmètre de management non implémenté. Nom obligatoire. Parent, description et responsable optionnels. Sans parent, crée une racine.',
  })
  @ResponseMessage('organization_created')
  @ApiWriteErrors()
  @ApiSuccessResponse({
    type: OrganizationDetailsDto,
    status: 201,
    message: 'organization_created',
  })
  create(@Body() dto: OrganizationDto) {
    return this.organizationService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lister les organisations',
    description:
      'Session requise. Contrôle du périmètre de management non implémenté. Filtres par nom, parent direct et responsable. Tri par nom puis identifiant. Sans pagination ni filtrage par périmètre.',
  })
  @ApiValidationError()
  @ApiSuccessResponse({ type: OrganizationDetailsDto, isArray: true })
  findAll(@Query() query: QueryOrganizationDto) {
    return this.organizationService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consulter une organisation',
    description:
      'Session requise. Contrôle du périmètre de management non implémenté. Retourne les champs sans développer les relations.',
  })
  @ApiResourceId('department-it')
  @ApiNotFoundError('not_found')
  @ApiSuccessResponse({ type: OrganizationDetailsDto })
  findOne(@Param('id') id: string) {
    return this.organizationService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modifier une organisation',
    description:
      'Session requise. Contrôle du périmètre de management non implémenté. Champs omis conservés. null retire description, parent ou responsable, mais est interdit pour le nom. Les cycles sont refusés en validation avec le code de champ organization_cycle (400), puis contrôlés à nouveau dans la transaction (409 si nécessaire). Une modification concurrente peut produire concurrent_modification (409), réessayer la requête.',
  })
  @ResponseMessage('organization_updated')
  @ApiResourceId('department-it')
  @ApiNotFoundError('organization_not_found')
  @ApiWriteErrors()
  @ApiSuccessResponse({
    type: OrganizationDetailsDto,
    message: 'organization_updated',
  })
  update(@Param('id') id: string, @Body() dto: PartialOrganizationDto) {
    return this.organizationService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Supprimer une organisation',
    description:
      'Session requise. Contrôle du périmètre de management non implémenté. Refus si des équipes ou organisations enfants existent. Les utilisateurs directement rattachés sont détachés et conservés.',
  })
  @ResponseMessage('organization_deleted')
  @ApiResourceId('department-it')
  @ApiNotFoundError('organization_not_found')
  @ApiConflictError()
  @ApiSuccessResponse({
    type: OrganizationDetailsDto,
    message: 'organization_deleted',
  })
  delete(@Param('id') id: string) {
    return this.organizationService.delete(id);
  }
}
