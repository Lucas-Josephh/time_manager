import { PaginatedDto, PaginationQueryDto } from '../../common/pagination/pagination.dto';
import { Trim } from '../../common/decorator/transform/trim.decorator';
import { Reference } from '../../common/decorator/reference.decorator';
import { OrganizationDetailsDto } from '../../organization/dto/organization.dto';
import { UserSummaryDto } from '../../user/dto/user.dto';
import { Exclude, Expose, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class SetTeamDto {
  @ApiProperty({
    description:
      'Nom unique, nettoyé des espaces aux extrémités. En modification, le nom actuel de cette équipe est autorisé.',
    example: 'Support',
    minLength: 1,
    maxLength: 255,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    minLength: 1,
    description:
      'Utilisateur éligible selon les droits de l’auteur : transfert autorisé pour un administrateur ou un manager d’organisation dans son périmètre ; utilisateur disponible du périmètre pour un responsable d’équipe. Ajouté automatiquement aux membres. null retire uniquement le rôle de responsable ; omis le conserve.',
    example: 'default-admin',
  })
  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Reference('user')
  managerId?: string | null;

  @ApiProperty({
    description: "Identifiant d'un organisation existant.",
    example: 'department-it',
    minLength: 1,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @Reference('organization')
  organizationId!: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['user-1', 'user-2'],
    description:
      'Identifiants uniques des membres. Administrateur : affectation libre ; manager d’organisation : transferts dans son périmètre ; responsable d’équipe : utilisateurs sans équipe de son organisation ou de ses descendantes. L’organisation des utilisateurs est conservée. Remplace la liste fournie ; [] conserve uniquement le responsable si managerId est conservé ou défini ; [] avec managerId: null dans la même requête vide complètement l\'équipe. Omis conserve les membres existants et ajoute le nouveau responsable si défini. Le responsable est toujours inclus.',
  })
  @Trim({ each: true })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  memberIds?: string[];
}

export class PartialSetTeamDto extends PartialType(SetTeamDto, {
  skipNullProperties: false,
}) {}

export class QuerySetTeamDto extends PaginationQueryDto {
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @ApiPropertyOptional({ description: "Recherche partielle sur le nom, sans distinction de casse." })
  name?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({ description: "Identifiant de l'organisation." })
  organizationId?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({ description: "Identifiant du responsable." })
  managerId?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({
    description: "Identifiant d'un utilisateur membre de l'équipe.",
  })
  memberId?: string;
}

@Exclude()
export class TeamDetailsDto {
  @Expose()
  @ApiProperty({ example: 'team-administration' })
  id!: string;

  @Expose()
  @ApiProperty({ example: 'Administration' })
  name!: string;

  @Expose()
  @ApiProperty({ example: 'department-operations' })
  organizationId!: string;

  @Expose()
  @ApiProperty({ type: String, nullable: true, example: 'default-admin' })
  managerId!: string | null;

  @Expose()
  @ApiProperty({ format: 'date-time', example: '2026-10-14T12:00:00.000Z' })
  createdAt!: string;

  @Expose()
  @ApiProperty({ format: 'date-time', example: '2026-10-14T12:00:00.000Z' })
  updatedAt!: string;
}

@Exclude()
export class TeamWithRelationsDto extends TeamDetailsDto {
  @Expose()
  @ApiProperty({ type: OrganizationDetailsDto })
  @Type(() => OrganizationDetailsDto)
  organization!: OrganizationDetailsDto;

  @Expose()
  @ApiProperty({
    type: UserSummaryDto,
    nullable: true,
    description:
      'Profil utilisateur du responsable, ou null si aucun responsable.',
    example: {
      id: 'default-admin',
      firstname: 'Admin',
      lastname: 'Time Manager',
    },
  })
  @Type(() => UserSummaryDto)
  manager!: UserSummaryDto | null;

  @Expose()
  @ApiProperty({
    type: [UserSummaryDto],
    description: "Profils utilisateurs des membres de l'équipe.",
    example: [],
  })
  @Type(() => UserSummaryDto)
  members!: UserSummaryDto[];
}

export class TeamListDto extends PaginatedDto(TeamWithRelationsDto) {}
