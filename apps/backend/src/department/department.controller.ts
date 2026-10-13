import { Controller, Get, Param } from '@nestjs/common';
import { DepartmentService } from './department.service';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  DepartmentListResponseDto,
  DepartmentResponseDto,
  DepartmentNotFoundResponseDto,
} from './dto/department-response.dto';

/**
 * TODO: Add the guard for this controller to restrict access to authorized users only. (waiting user crud feature for this)
 */

@ApiTags('Department')
@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les départements',
    description:
      'Retourne tous les départements triés par nom croissant. La liste est vide si aucun département n’existe. Cette route est actuellement publique.',
  })
  @ApiOkResponse({
    description: 'Liste des départements récupérée avec succès.',
    type: DepartmentListResponseDto,
  })
  findAll() {
    return this.departmentService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consulter un département',
    description:
      'Retourne le département correspondant à l’identifiant fourni dans l’URL. Cette route est actuellement publique.',
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: String,
    description: 'Identifiant unique du département à consulter.',
    example: 'department-it',
  })
  @ApiOkResponse({
    description: 'Département trouvé.',
    type: DepartmentResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Aucun département ne correspond à cet identifiant.',
    type: DepartmentNotFoundResponseDto,
  })
  findOne(@Param('id') id: string) {
    return this.departmentService.findOne(id);
  }
}
