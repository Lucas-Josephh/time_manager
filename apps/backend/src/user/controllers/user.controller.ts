import { ApiResult } from '../../common/decorator/api-result.decorator';
import type { AuthRequest } from '../../auth/auth.types';
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
import { UserService } from '../services/user.service';
import {
  CreateUserDto,
  QueryUserDto,
  UpdateUserDto,
  UserDetailsDto,
  UserListDto,
} from '../dto/user.dto';
import { ResourceExists } from '../../common/guards/resource-exists.guard';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import {
  ApiUserController,
  ApiUserCreate,
  ApiUserList,
  ApiUserDetail,
  ApiUserUpdate,
  ApiUserDelete,
} from '../user.swagger';

@ApiUserController()
@Controller('users')
@UseGuards(AuthGuard, AdminGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Create a user account on behalf of the authenticated administrator.
   *
   * @param dto - Validated initial profile and credentials.
   * @param request - Authenticated request containing the administrator’s session.
   */
  @Post()
  @ApiUserCreate()
  @ApiResult({
    type: UserDetailsDto,
    status: HttpStatus.CREATED,
    message: 'user_created',
  })
  create(@Body() dto: CreateUserDto, @Req() request: AuthRequest) {
    return this.userService.create(dto, request.session!.user.id);
  }

  /**
   * List user profiles using the requested filters and pagination.
   *
   * @param query - Validated filters and pagination options.
   * @param request - Authenticated request containing the administrator’s session.
   */
  @Get()
  @ApiUserList()
  @ApiResult({
    type: UserListDto,
    status: HttpStatus.OK,
    message: 'users_listed',
  })
  findAll(@Query() query: QueryUserDto, @Req() request: AuthRequest) {
    return this.userService.findAll(query, request.session!.user.id);
  }

  /**
   * Return the requested user profile.
   *
   * @param id - ID of the requested user.
   * @param request - Authenticated request containing the administrator’s session.
   */
  @Get(':id')
  @ApiUserDetail()
  @ApiResult({
    type: UserDetailsDto,
    status: HttpStatus.OK,
  })
  findOne(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.userService.findOne(id, request.session!.user.id);
  }

  /**
   * Apply the supplied changes to an existing user profile.
   *
   * @param id - ID of the user to update.
   * @param dto - Validated profile changes.
   * @param request - Authenticated request containing the administrator’s session.
   */
  @Patch(':id')
  @ResourceExists('user')
  @ApiUserUpdate()
  @ApiResult({
    type: UserDetailsDto,
    status: HttpStatus.OK,
    message: 'user_updated',
  })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() request: AuthRequest) {
    return this.userService.update(id, dto, request.session!.user.id);
  }

  /**
   * Delete the requested user account.
   *
   * @param id - ID of the user to delete.
   * @param request - Authenticated request containing the administrator’s session.
   */
  @Delete(':id')
  @ApiUserDelete()
  @ApiResult({
    type: UserDetailsDto,
    status: HttpStatus.OK,
    message: 'user_deleted',
  })
  delete(@Param('id') id: string, @Req() request: AuthRequest) {
    return this.userService.delete(id, request.session!.user.id);
  }
}
