import {
  ApiOrganizationController,
  ApiOrganizationCreate,
  ApiOrganizationFindAll,
  ApiOrganizationFindOne,
  ApiOrganizationUpdate,
  ApiOrganizationDelete,
} from './organization.swagger';
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

// TODO: Implement the guard by admin or manager of the organization or its parent organizations

@ApiOrganizationController()
@Controller('organizations')
@UseGuards(AuthGuard)
@SerializeResponse(OrganizationDetailsDto)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @ApiOrganizationCreate()
  @ResponseMessage('organization_created')
  create(@Body() dto: OrganizationDto) {
    return this.organizationService.create(dto);
  }

  @Get()
  @ApiOrganizationFindAll()
  findAll(@Query() query: QueryOrganizationDto) {
    return this.organizationService.findAll(query);
  }

  @Get(':id')
  @ApiOrganizationFindOne()
  findOne(@Param('id') id: string) {
    return this.organizationService.findOne(id);
  }

  @Patch(':id')
  @ApiOrganizationUpdate()
  @ResponseMessage('organization_updated')
  update(@Param('id') id: string, @Body() dto: PartialOrganizationDto) {
    return this.organizationService.update(id, dto);
  }

  @Delete(':id')
  @ApiOrganizationDelete()
  @ResponseMessage('organization_deleted')
  delete(@Param('id') id: string) {
    return this.organizationService.delete(id);
  }
}
