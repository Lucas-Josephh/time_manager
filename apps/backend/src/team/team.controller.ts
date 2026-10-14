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
      'Route actuellement publique. Le nom doit être unique ; le département doit exister. Le responsable est optionnel.',
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
      'Route actuellement publique. Nom et département requis. Le responsable omis reste inchangé ; null le retire. Le nom actuel de cette équipe est autorisé.',
  })
  @ApiResourceId('team-administration')
  @ApiBody({ type: TeamDto })
  @ApiSuccessResponse({ type: TeamDetailsDto, status: 200, message: 'team_updated' })
  @ApiWriteErrors()
  @ApiNotFoundError('team_not_found')
  update(@Param('id') id: string, @Body() dto: TeamDto) {
    return this.teamService.replace(id, dto);
  }

  @ResponseMessage('team_partially_updated')
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  @ApiOperation({
    summary: 'Modifier partiellement une équipe',
    description:
      'Route actuellement publique. Seuls les champs fournis sont modifiés. Omettre les champs inchangés ; null peut retirer le responsable. Le nom actuel de cette équipe est autorisé.',
  })
  @ApiResourceId('team-administration')
  @ApiBody({ type: PartialTeamDto })
  @ApiSuccessResponse({ type: TeamDetailsDto, status: 200, message: 'team_partially_updated' })
  @ApiWriteErrors()
  @ApiNotFoundError('team_not_found')
  partialUpdate(@Param('id') id: string, @Body() dto: PartialTeamDto) {
    return this.teamService.update(id, dto);
  }

  @ResponseMessage('team_deleted')
  @HttpCode(HttpStatus.ACCEPTED)
  @Delete(':id')
  @ApiOperation({
    summary: 'Supprimer une équipe',
    description:
      'Route actuellement publique. Réaffecter ses membres avant la suppression. La suppression est exécutée avant la réponse 202.',
  })
  @ApiResourceId('team-administration')
  @ApiSuccessResponse({ type: TeamDetailsDto, status: 202, message: 'team_deleted' })
  @ApiNotFoundError('team_not_found')
  @ApiConflictError()
  delete(@Param('id') id: string) {
    return this.teamService.delete(id);
  }

  @Get()
  @ResponseMessage('team_listed')
  @HttpCode(HttpStatus.FOUND)
  @ApiOperation({
    summary: 'Lister les équipes',
    description:
      'Route actuellement publique. Tri par nom croissant, avec département, responsable et membres. Le statut actuel est 302.',
  })
  @ApiSuccessResponse({ type: TeamWithRelationsDto, status: 302, message: 'team_listed', isArray: true })
  @ApiValidationError()
  findAll(@Query() query: QueryTeamDto) {
    return this.teamService.findAll(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.FOUND)
  @ApiOperation({
    summary: 'Consulter une équipe',
    description:
      'Route actuellement publique. Inclut département, responsable et membres. Le statut actuel est 302 ; une équipe absente renvoie data: {} sans erreur 404.',
  })
  @ApiResourceId('team-administration')
  @ApiSuccessResponse({ type: TeamWithRelationsDto, status: 302, allowEmpty: true })
  findOne(@Param('id') id: string) {
    return this.teamService.findOne(id);
  }
}
