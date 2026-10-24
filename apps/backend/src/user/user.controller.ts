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
  Patch,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { ResponseMessage } from '../common/decorator/response-message.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un nouvel utilisateur' })
  @ApiResponse({ status: 201, description: 'Utilisateur créé avec succès.' })
  @ApiResponse({ status: 400, description: 'Données invalides.' })
  @ResponseMessage('user_created_successfully')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Récupérer la liste des utilisateurs avec pagination et filtres',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des utilisateurs récupérée avec succès.',
  })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('email') email?: string,
    @Query('username') username?: string,
  ) {
    return this.userService.findAll({ page, limit, email, username });
  }

  @Get(':id')
  @ApiOperation({
    summary: "Récupérer les détails d'un utilisateur par son ID",
  })
  @ApiResponse({
    status: 200,
    description: 'Détails de l utilisateur récupérés avec succès.',
  })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé.' })
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  // @Put(':id')
  // @ApiOperation({
  //   summary: "Mettre à jour les informations d'un utilisateur par son ID",
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Utilisateur mis à jour avec succès.',
  // })
  // @ApiResponse({ status: 404, description: 'Utilisateur non trouvé.' })
  // update(
  //   @Param('id') id: string,
  //   @Body() updateUserDto: UpdateUserDto, // Utilisation propre du Request DTO
  // ) {
  //   return this.userService.update(id, updateUserDto);
  // }

  @Patch(':id')
  @ApiOperation({
    summary: "Mettre à jour les champs détaillés d'un utilisateur par son ID",
  })
  @ApiParam({ name: 'id', description: "ID de l'utilisateur à modifier" })
  async updateParamUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto, // ⚠️ On utilise un Request DTO et non un Response DTO
  ) {
    try {
      return await this.userService.updateParamUser(id, updateUserDto);
    } catch (error) {
      throw new NotFoundException(`Utilisateur avec l'ID ${id} introuvable.`);
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un utilisateur par son ID' })
  @ApiResponse({
    status: 200,
    description: 'Utilisateur supprimé avec succès.',
  })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé.' })
  @ResponseMessage('user_deleted_successfully')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
