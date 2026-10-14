import { ApiSuccessResponse, ApiNotFoundError, ApiResourceId, ApiServerError } from '../common/swagger/api-response.decorator';
import { Controller, Get, Param } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { SerializeResponse } from '../common/serialization/serialize-response.decorator';
import {
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  DepartmentDetailsDto,
} from './dto/department.dto';

/**
 * TODO: Add the guard for this controller to restrict access to authorized users only. (waiting user crud feature for this)
 */

@ApiTags('Department')
@ApiServerError()
@Controller('departments')
@SerializeResponse(DepartmentDetailsDto)
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les départements',
    description:
      'Retourne tous les départements triés par nom croissant. La liste est vide si aucun département n’existe. Cette route est actuellement publique.',
  })
  @ApiSuccessResponse({ type: DepartmentDetailsDto, isArray: true })
  findAll() {
    return this.departmentService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consulter un département',
    description:
      'Retourne le département correspondant à l’identifiant fourni dans l’URL. Cette route est actuellement publique.',
  })
  @ApiResourceId('department-it')
  @ApiSuccessResponse({ type: DepartmentDetailsDto })
  @ApiNotFoundError('department_not_found')
  findOne(@Param('id') id: string) {
    return this.departmentService.findOne(id);
  }
}
