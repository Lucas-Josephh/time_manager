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
import { SerializeResponse } from '../../common/serialization/serialize-response.decorator';
import { ResponseMessage } from '../../common/decorator/response-message.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { AuthRequest } from '../../auth/auth.types';

@ApiOrganizationController()
@Controller('organizations')
@UseGuards(AuthGuard)
@SerializeResponse(OrganizationDetailsDto)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @ApiOrganizationCreate()
  @ResponseMessage('organization_created')
  create(@Body() dto: OrganizationDto, @Req() request: AuthRequest) {
    return this.organizationService.create(dto, request.session!.user.id);
  }

  @Get()
  @ApiOrganizationFindAll()
  @SerializeResponse(OrganizationListDto)
  findAll(@Query() query: QueryOrganizationListDto) {
    return this.organizationService.findAll(query);
  }

  @Get('tree')
  @ResponseMessage('organization_tree_retrieved')
  @SerializeResponse(OrganizationTreeDto)
  @ApiOrganizationTree()
  tree(@Req() request: AuthRequest) {
    return this.organizationService.tree(request.session!.user.id);
  }

  @Get(':id/tree')
  @ResponseMessage('specific_organization_tree_retrieved')
  @SerializeResponse(OrganizationTreeDto)
  @ApiOrganizationSubtree()
  subtree(
    @Param('id') id: string,
    @Req() request: AuthRequest,
  ) {
    return this.organizationService.tree(request.session!.user.id, id);
  }

  @Get(':id')
  @ApiOrganizationFindOne()
  findOne(@Param('id') id: string) {
    return this.organizationService.findOne(id);
  }

  @Patch(':id')
  @ApiOrganizationUpdate()
  @ResponseMessage('organization_updated')
  update(@Param('id') id: string, @Body() dto: PartialOrganizationDto, @Req() request: AuthRequest) {
    return this.organizationService.update(id, dto, request.session!.user.id);
  }

  @Delete(':id')
  @ApiOrganizationDelete()
  @ResponseMessage('organization_deleted')
  delete(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.organizationService.delete(id, request.session!.user.id);
  }
}
