import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiErrorResponse,
  ApiNotFoundError,
  ApiResourceId,
  ApiServerError,
  ApiSuccessResponse,
  ApiValidationError,
  ApiWriteErrors,
} from '../common/swagger/api-response.decorator';
import {
  CreateUserDto,
  UpdateUserDto,
  UserDetailsDto,
  UserListDto,
} from './dto/user.dto';

export function ApiUserController() {
  return applyDecorators(
    ApiTags('Users'),
    ApiServerError(),
    ApiErrorResponse(401, 'unauthorized', 'Session absente ou expirée.'),
    ApiErrorResponse(
      403,
      ['forbidden', 'password_change_required'],
      'Administrateur requis. Le mot de passe temporaire doit avoir été changé.',
    ),
  );
}
export function ApiUserCreate() {
  return applyDecorators(
    ApiOperation({
      summary: 'Créer un utilisateur',
      description:
        'Administrateur uniquement. Mot de passe temporaire à changer. firstname et lastname sont distincts ; name est un nom d’affichage calculé et ne peut pas être fourni. teamId optionnel pour l’équipe initiale : l’organisation est déduite de l’équipe et l’affectation est atomique avec la création. Modifications ultérieures depuis Team.',
    }),
    ApiBody({ type: CreateUserDto }),
    ApiSuccessResponse({
      type: UserDetailsDto,
      status: 201,
      message: 'user_created',
    }),
    ApiWriteErrors(),
  );
}
export function ApiUserList() {
  return applyDecorators(
    ApiOperation({
      summary: 'Lister les utilisateurs',
      description:
        'Pagination bornée à 100. Filtres partiels sur email, firstname et lastname. Résultat dans data.items et data.meta.',
    }),
    ApiSuccessResponse({ type: UserListDto, message: 'users_listed' }),
    ApiValidationError(),
  );
}
export function ApiUserDetail() {
  return applyDecorators(
    ApiOperation({ summary: 'Consulter un utilisateur' }),
    ApiResourceId('user-id'),
    ApiSuccessResponse({ type: UserDetailsDto }),
    ApiNotFoundError('not_found'),
  );
}
export function ApiUserUpdate() {
  return applyDecorators(
    ApiOperation({
      summary: 'Modifier un utilisateur',
      description:
        'Champs fournis uniquement. Modifier firstname ou lastname recalcule automatiquement le nom d’affichage name. phone: null efface le téléphone. Équipe et indicateur de changement de mot de passe non modifiables.',
    }),
    ApiResourceId('user-id'),
    ApiBody({ type: UpdateUserDto }),
    ApiSuccessResponse({ type: UserDetailsDto, message: 'user_updated' }),
    ApiNotFoundError('not_found'),
    ApiWriteErrors(),
  );
}
export function ApiUserDelete() {
  return applyDecorators(
    ApiOperation({ summary: 'Supprimer un utilisateur' }),
    ApiResourceId('user-id'),
    ApiSuccessResponse({ type: UserDetailsDto, message: 'user_deleted' }),
    ApiNotFoundError('not_found'),
    ApiWriteErrors(),
  );
}
