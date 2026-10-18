import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { TeamService } from './team.service';
import {
  PartialTeamDto,
  QueryTeamDto,
  TeamDto,
  TeamDetailsDto,
  TeamWithRelationsDto,
} from './dto/team.dto';
import { ResponseMessage } from '../common/decorator/response-message.decorator';
import { SerializeResponse } from '../common/serialization/serialize-response.decorator';
import {
  ApiBody,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiConflictError,
  ApiResourceId,
  ApiNotFoundError,
  ApiServerError,
  ApiSuccessResponse,
  ApiWriteErrors,
  ApiValidationError,
} from '../common/swagger/api-response.decorator';

// TODO: Implement the guard by admin or manager of the organization or its parent organizations

@ApiTags('Team')
@ApiServerError()
@Controller('team')
@SerializeResponse(TeamWithRelationsDto)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @ResponseMessage('team_created')
  @HttpCode(HttpStatus.CREATED)
  @Post()
  @ApiOperation({
    summary: 'Créer une équipe',
    description:
      'Session requise ; contrôle du périmètre de management non implémenté. Le nom doit être unique ; le organisation doit exister. Le responsable est optionnel.',
  })
  @ApiBody({ type: TeamDto })
  @ApiSuccessResponse({ type: TeamDetailsDto, status: 201, message: 'team_created' })
  @ApiWriteErrors()
  create(@Body() dto: TeamDto) {
    return this.teamService.create(dto);
  }

  @ResponseMessage('team_updated')
  @HttpCode(HttpStatus.OK)
  @Put(':id')
  @ApiOperation({
    summary: 'Mettre à jour une équipe',
    description:
      'Session requise ; contrôle du périmètre de management non implémenté. Nom et organisation requis. Le responsable omis reste inchangé ; null le retire. Le nom actuel de cette équipe est autorisé.',
  })
  @ApiResourceId('team-administration')
  @ApiBody({ type: TeamDto })
  @ApiSuccessResponse({ type: TeamDetailsDto, status: 200, message: 'team_updated' })
  @ApiWriteErrors()
  @ApiNotFoundError('not_found')
  update(@Param('id') id: string, @Body() dto: TeamDto) {
    return this.teamService.replace(id, dto);
  }

  @ResponseMessage('team_partially_updated')
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  @ApiOperation({
    summary: 'Modifier partiellement une équipe',
    description:
      'Session requise ; contrôle du périmètre de management non implémenté. Seuls les champs fournis sont modifiés. Omettre les champs inchangés ; null peut retirer le responsable. Le nom actuel de cette équipe est autorisé.',
  })
  @ApiResourceId('team-administration')
  @ApiBody({ type: PartialTeamDto })
  @ApiSuccessResponse({ type: TeamDetailsDto, status: 200, message: 'team_partially_updated' })
  @ApiWriteErrors()
  @ApiNotFoundError('not_found')
  partialUpdate(@Param('id') id: string, @Body() dto: PartialTeamDto) {
    return this.teamService.update(id, dto);
  }

  @ResponseMessage('team_deleted')
  @HttpCode(HttpStatus.ACCEPTED)
  @Delete(':id')
  @ApiOperation({
    summary: 'Supprimer une équipe',
    description:
      'Session requise ; contrôle du périmètre de management non implémenté. Réaffecter ses membres avant la suppression. La suppression est exécutée avant la réponse 202.',
  })
  @ApiResourceId('team-administration')
  @ApiSuccessResponse({ type: TeamDetailsDto, status: 202, message: 'team_deleted' })
  @ApiNotFoundError('not_found')
  @ApiConflictError()
  delete(@Param('id') id: string) {
    return this.teamService.delete(id);
  }

  @Get()
  @ResponseMessage('team_listed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lister les équipes',
    description:
      'Session requise ; contrôle du périmètre de management non implémenté. Tri par nom croissant, avec organisation, responsable et membres. ',
  })
  @ApiSuccessResponse({ type: TeamWithRelationsDto, status: HttpStatus.OK, message: 'team_listed', isArray: true })
  @ApiValidationError()
  findAll(@Query() query: QueryTeamDto) {
    return this.teamService.findAll(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Consulter une équipe',
    description:
      'Session requise ; contrôle du périmètre de management non implémenté. Inclut organisation, responsable et membres. Une équipe absente renvoie une erreur 404.',
  })
  @ApiResourceId('team-administration')
  @ApiSuccessResponse({ type: TeamWithRelationsDto, status: HttpStatus.OK })
  @ApiNotFoundError('not_found')
  findOne(@Param('id') id: string) {
    return this.teamService.findOne(id);
  }
}
