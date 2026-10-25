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
import { UserService } from './user.service';
import {
  CreateUserDto,
  QueryUserDto,
  UpdateUserDto,
  UserDetailsDto,
  UserListDto,
} from './dto/user.dto';
import { ResponseMessage } from '../common/decorator/response-message.decorator';
import { SerializeResponse } from '../common/serialization/serialize-response.decorator';
import { ResourceExists } from '../common/guards/resource-exists.guard';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import {
  ApiUserController,
  ApiUserCreate,
  ApiUserList,
  ApiUserDetail,
  ApiUserUpdate,
  ApiUserDelete,
} from './user.swagger';

@ApiUserController()
@Controller('users')
@UseGuards(AuthGuard, AdminGuard)
@SerializeResponse(UserDetailsDto)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiUserCreate()
  @ResponseMessage('user_created')
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Get()
  @ApiUserList()
  @ResponseMessage('users_listed')
  @SerializeResponse(UserListDto)
  findAll(@Query() query: QueryUserDto) {
    return this.userService.findAll(query);
  }

  @Get(':id')
  @ApiUserDetail()
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @ResourceExists('user')
  @ApiUserUpdate()
  @ResponseMessage('user_updated')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  @ApiUserDelete()
  @ResponseMessage('user_deleted')
  delete(@Param('id') id: string) {
    return this.userService.delete(id);
  }
}
