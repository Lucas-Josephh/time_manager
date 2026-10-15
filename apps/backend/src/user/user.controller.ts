import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ResponseMessage } from '../common/decorator/response-message.decorator';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // POST /api/users (Inscription / Création)
  @Post()
  @ResponseMessage('user_created_successfully')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  // GET /api/users?page=1&limit=10&email=...
  @Get()
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('email') email?: string,
    @Query('username') username?: string,
  ) {
    return this.userService.findAll({ page, limit, email, username });
  }

  // GET /api/users/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  // PUT /api/users/:id
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      email?: string;
      username?: string;
      firstname?: string;
      lastname?: string;
    },
  ) {
    return this.userService.update(id, body);
  }

  // DELETE /api/users/:id
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
