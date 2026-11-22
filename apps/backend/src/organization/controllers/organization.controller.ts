import { ApiResult } from '../../common/decorator/api-result.decorator';
import {
  ApiOrganizationController,
  ApiOrganizationCreate,
  ApiOrganizationFindAll,
  ApiOrganizationTree,
  ApiOrganizationSubtree,
  ApiOrganizationFindOne,
  ApiOrganizationUpdate,
  ApiOrganizationDelete,
} from '../organization.swagger';
import {
  HttpStatus,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrganizationService } from '../services/organization.service';
import {
  OrganizationDetailsDto,
  OrganizationListDto,
  OrganizationDto,
  OrganizationTreeDto,
  PartialOrganizationDto,
  QueryOrganizationListDto,
} from '../dto/organization.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { AuthRequest } from '../../auth/auth.types';

@ApiOrganizationController()
@Controller('organizations')
@UseGuards(AuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @ApiOrganizationCreate()
  @ApiResult({
    type: OrganizationDetailsDto,
    status: HttpStatus.CREATED,
    message: 'organization_created',
  })
  create(@Body() dto: OrganizationDto, @Req() request: AuthRequest) {
    return this.organizationService.create(dto, request.session!.user.id);
  }

  @Get()
  @ApiOrganizationFindAll()
  @ApiResult({
    type: OrganizationListDto,
    status: HttpStatus.OK,
  })
  findAll(@Query() query: QueryOrganizationListDto) {
    return this.organizationService.findAll(query);
  }

  @Get('tree')
  @ApiOrganizationTree()
  @ApiResult({
    type: OrganizationTreeDto,
    status: HttpStatus.OK,
    message: 'organization_tree_retrieved',
    isArray: true,
  })
  tree(@Req() request: AuthRequest) {
    return this.organizationService.tree(request.session!.user.id);
  }

  @Get(':id/tree')
  @ApiOrganizationSubtree()
  @ApiResult({
    type: OrganizationTreeDto,
    status: HttpStatus.OK,
    message: 'specific_organization_tree_retrieved',
    isArray: true,
  })
  subtree(
    @Param('id') id: string,
    @Req() request: AuthRequest,
  ) {
    return this.organizationService.tree(request.session!.user.id, id);
  }

  @Get(':id')
  @ApiOrganizationFindOne()
  @ApiResult({
    type: OrganizationDetailsDto,
    status: HttpStatus.OK,
  })
  findOne(@Param('id') id: string) {
    return this.organizationService.findOne(id);
  }

  @Patch(':id')
  @ApiOrganizationUpdate()
  @ApiResult({
    type: OrganizationDetailsDto,
    status: HttpStatus.OK,
    message: 'organization_updated',
  })
  update(@Param('id') id: string, @Body() dto: PartialOrganizationDto, @Req() request: AuthRequest) {
    return this.organizationService.update(id, dto, request.session!.user.id);
  }

  @Delete(':id')
  @ApiOrganizationDelete()
  @ApiResult({
    type: OrganizationDetailsDto,
    status: HttpStatus.OK,
    message: 'organization_deleted',
  })
  delete(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.organizationService.delete(id, request.session!.user.id);
  }
}
