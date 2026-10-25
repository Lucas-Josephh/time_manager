import { CanManageOrganizations } from './guards/can-manage-organizations.guard';
import { ResourceExists } from '../common/guards/resource-exists.guard';
import {
  ApiOrganizationController,
  ApiOrganizationCreate,
  ApiOrganizationFindAll,
  ApiOrganizationTree,
  ApiOrganizationSubtree,
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
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import {
  OrganizationDetailsDto,
  OrganizationListDto,
  OrganizationDto,
  OrganizationTreeDto,
  PartialOrganizationDto,
  QueryOrganizationDto,
  QueryOrganizationListDto,
} from './dto/organization.dto';
import { SerializeResponse } from '../common/serialization/serialize-response.decorator';
import { ResponseMessage } from '../common/decorator/response-message.decorator';
import { AuthGuard, type AuthRequest } from '../auth/guards/auth.guard';

@ApiOrganizationController()
@Controller('organizations')
@SerializeResponse(OrganizationDetailsDto)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @CanManageOrganizations()
  @Post()
  @ApiOrganizationCreate()
  @ResponseMessage('organization_created')
  create(@Body() dto: OrganizationDto) {
    return this.organizationService.create(dto);
  }

  @UseGuards(AuthGuard)
  @Get()
  @ApiOrganizationFindAll()
  @SerializeResponse(OrganizationListDto)
  findAll(@Query() query: QueryOrganizationListDto) {
    return this.organizationService.findAll(query);
  }

  @UseGuards(AuthGuard)
  @Get('tree')
  @ResponseMessage('organization_tree_retrieved')
  @SerializeResponse(OrganizationTreeDto)
  @ApiOrganizationTree()
  tree(@Query() query: QueryOrganizationDto, @Req() request: AuthRequest) {
    return this.organizationService.tree(request.session!.user.id, query);
  }

  @ResourceExists('organization')
  @UseGuards(AuthGuard)
  @Get(':id/tree')
  @ResponseMessage('specific_organization_tree_retrieved')
  @SerializeResponse(OrganizationTreeDto)
  @ApiOrganizationSubtree()
  subtree(
    @Param('id') id: string,
    @Query() query: QueryOrganizationDto,
    @Req() request: AuthRequest,
  ) {
    return this.organizationService.tree(request.session!.user.id, {
      ...query,
      parentId: id,
    });
  }

  @ResourceExists('organization')
  @UseGuards(AuthGuard)
  @Get(':id')
  @ApiOrganizationFindOne()
  findOne(@Param('id') id: string) {
    return this.organizationService.findOne(id);
  }

  @CanManageOrganizations({ organizationId: 'id' })
  @Patch(':id')
  @ApiOrganizationUpdate()
  @ResponseMessage('organization_updated')
  update(@Param('id') id: string, @Body() dto: PartialOrganizationDto) {
    return this.organizationService.update(id, dto);
  }

  @CanManageOrganizations({ organizationId: 'id' })
  @Delete(':id')
  @ApiOrganizationDelete()
  @ResponseMessage('organization_deleted')
  delete(@Param('id') id: string) {
    return this.organizationService.delete(id);
  }
}
