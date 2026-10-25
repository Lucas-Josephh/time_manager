import { PaginatedDto, PaginationQueryDto } from '../../common/pagination/pagination.dto';
import { Trim } from '../../common/decorator/transform/trim.decorator';
import { Exclude, Expose } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Unique } from '../../common/decorator/unique.decorator';
import { Reference } from '../../common/decorator/reference.decorator';
import { IsPassword } from '../../common/decorator/password.decorator';
import { Lowercase } from '../../common/decorator/transform/lowercase.decorator';

@Exclude()
export class UserSummaryDto {
  @Expose()
  @ApiProperty({
    description: 'Identifiant unique de l’utilisateur.',
    example: 'user-alice',
  })
  id!: string;

  @Expose()
  @ApiProperty({
    description: 'Prénom de l’utilisateur.',
    example: 'Alice',
  })
  firstname!: string;

  @Expose()
  @ApiProperty({
    description: 'Nom de famille de l’utilisateur.',
    example: 'Martin',
  })
  lastname!: string;
}

@Exclude()
export class UserDetailsDto extends UserSummaryDto {
  @Expose()
  @ApiProperty({
    description: 'Nom d’affichage calculé à partir du prénom et du nom ; absent des DTO d’entrée.',
    example: 'Alice Martin',
    readOnly: true,
  })
  name!: string;

  @Expose()
  @ApiProperty({
    description: 'Adresse email de connexion.',
    format: 'email',
    example: 'alice.martin@example.com',
  })
  email!: string;

  @Expose()
  @ApiProperty({
    description: 'Téléphone, ou null si aucun numéro n’est renseigné.',
    type: String,
    nullable: true,
    example: '+33612345678',
  })
  phone!: string | null;

  @Expose()
  @ApiProperty({
    description: 'Image du profil Better Auth, ou null si absente.',
    type: String,
    nullable: true,
    example: 'https://example.com/avatar.png',
  })
  image!: string | null;

  @Expose()
  @ApiProperty({
    description: 'Identifiant de l’équipe actuelle. Relation non développée.',
    type: String,
    nullable: true,
    example: 'team-administration',
  })
  teamId!: string | null;

  @Expose()
  @ApiProperty({
    description: 'Identifiant de l’organisation actuelle. Relation non développée.',
    type: String,
    nullable: true,
    example: 'department-it',
  })
  organizationId!: string | null;

  @Expose()
  @ApiProperty({
    description: 'Indique si l’utilisateur dispose du rôle administrateur.',
    example: false,
  })
  isAdmin!: boolean;

  @Expose()
  @ApiProperty({
    description: 'Si true, un changement de mot de passe est requis avant l’accès aux routes protégées.',
    example: true,
  })
  mustChangePassword!: boolean;

  @Expose()
  @ApiProperty({
    description: 'Date de création du compte.',
    format: 'date-time',
    example: '2026-10-25T09:00:00.000Z',
  })
  createdAt!: Date;

  @Expose()
  @ApiProperty({
    description: 'Date de dernière modification du profil.',
    format: 'date-time',
    example: '2026-10-25T10:00:00.000Z',
  })
  updatedAt!: Date;
}

export class UserProfileDto {
  @ApiProperty({
    description: 'Prénom non vide après suppression des espaces en début et fin. Null interdit.',
    example: 'Alice',
    minLength: 1,
    maxLength: 255,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  firstname!: string;

  @ApiProperty({
    description: 'Nom de famille non vide après suppression des espaces en début et fin. Null interdit.',
    example: 'Martin',
    minLength: 1,
    maxLength: 255,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  lastname!: string;

  @ApiProperty({
    description: 'Adresse email unique, nettoyée et convertie en minuscules. Null interdit.',
    format: 'email',
    example: 'alice.martin@example.com',
  })
  @Trim()
  @Lowercase()
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({
    description: 'Numéro international valide. Null permet de ne pas renseigner ou d’effacer le téléphone.',
    type: String,
    nullable: true,
    example: '+33612345678',
  })
  @IsOptional()
  @IsPhoneNumber()
  phone?: string | null;

  @ApiPropertyOptional({
    description: 'Accorde ou retire le rôle administrateur. Omission : false à la création, valeur conservée à la modification. Null interdit.',
    example: false,
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isAdmin?: boolean;
}

export class CreateUserDto extends UserProfileDto {
  @Unique('user', 'email')
  declare email: string;

  @ApiPropertyOptional({
    description: 'Équipe initiale existante ; son organisation est affectée au nouvel utilisateur. Omission : aucune équipe ni organisation. Null interdit. Les changements ultérieurs passent par Team.',
    example: 'team-administration',
  })
  @Trim()
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @Reference('team')
  teamId?: string;

  @ApiProperty({
    description: 'Mot de passe temporaire à changer à la première connexion. 12 à 128 caractères, avec majuscule, minuscule, chiffre et caractère spécial. Les espaces sont conservés.',
    format: 'password',
    writeOnly: true,
    minLength: 12,
    maxLength: 128,
    example: 'TemporaryPassword123!',
  })
  @IsString()
  @IsPassword()
  password!: string;
}

export class UpdateUserDto extends PartialType(UserProfileDto, {
  skipNullProperties: false,
}) {}

export class QueryUserDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Recherche partielle sur l’email, sans distinction de casse. Espaces en début et fin supprimés ; chaîne vide interdite.',
    example: 'example.com',
  })
  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  email?: string;
  @ApiPropertyOptional({
    description: 'Recherche partielle sur le prénom, sans distinction de casse. Espaces en début et fin supprimés ; chaîne vide interdite.',
    example: 'ali',
  })
  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstname?: string;

  @ApiPropertyOptional({
    description: 'Recherche partielle sur le nom de famille, sans distinction de casse. Espaces en début et fin supprimés ; chaîne vide interdite.',
    example: 'mart',
  })
  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastname?: string;
}

export class UserListDto extends PaginatedDto(UserDetailsDto) {}
