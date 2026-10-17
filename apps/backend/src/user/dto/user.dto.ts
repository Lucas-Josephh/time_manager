import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
} from 'class-validator';
import { Unique } from '../../common/decorator/unique.decorator';
import { Reference } from 'src/common/decorator/reference.decorator';
import { Exclude, Expose, Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
// Assure-toi que le chemin d'import vers ton TeamDetailsDto est correct
import { TeamDetailsDto } from 'src/team/dto/team.dto';
import { IsPassword } from '../../common/decorator/password.decorator';

/**
 * DTO léger pour les listes ou les relations (ex: résumé d'un utilisateur)
 */
@Exclude()
export class UserSummaryDto {
  @Expose()
  @ApiProperty({ example: 'default-admin' })
  id!: string;

  @Expose()
  @ApiProperty({ example: 'Alice' })
  firstname!: string;

  @Expose()
  @ApiProperty({ example: 'Martin' })
  lastname!: string;

  @Expose()
  @ApiProperty({ type: String, nullable: true, example: null })
  image!: string | null;
}

/**
 * DTO complet pour les détails d'un utilisateur (Response DTO)
 */
@Exclude() // SÉCURITÉ : Ignore tout par défaut, seules les propriétés avec @Expose seront renvoyées
export class UserDetailsDto {
  @Expose()
  @ApiProperty({ example: 'default-admin' })
  id!: string;

  @Expose()
  @ApiProperty({ example: 'Alice', required: false })
  firstname?: string;

  @Expose()
  @ApiProperty({ example: 'Martin', required: false })
  lastname?: string;

  @Expose()
  @ApiProperty({ type: String, nullable: true, example: null })
  image?: string | null;

  @Expose()
  @ApiProperty({ example: 'alice.martin@example.com' })
  email!: string;

  @Expose()
  @ApiProperty({ example: '+33612345678', nullable: true })
  phone?: string | null;

  @Expose()
  @ApiProperty({ type: String, nullable: true, example: 'team-administration' })
  teamId?: string | null;

  @Expose()
  @ApiProperty({ type: String, nullable: true, example: 'default-admin' })
  managerId?: string | null;

  @Expose()
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'department-operations',
  })
  departmentId?: string | null;

  @Expose()
  @ApiProperty({ type: Boolean, example: false })
  isAdmin!: boolean;

  @Expose()
  @Type(() => TeamDetailsDto) // Indispensable pour transformer correctement les objets imbriqués
  @ApiProperty({ type: TeamDetailsDto, isArray: true, nullable: true })
  managedTeams?: TeamDetailsDto[];
}

export class CreateUserDto {
  @ApiProperty({
    description: 'The first name of the user',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  firstname!: string;

  @ApiProperty({
    description: 'The last name of the user',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  lastname!: string;

  @ApiProperty({
    description: 'The email address of the user',
    example: 'john.doe@example.com',
  })
  @IsEmail({})
  @IsNotEmpty()
  @Unique('user', 'email')
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @ApiProperty({
    description: 'Mot de passe de 12 à 128 caractères avec une majuscule, une minuscule, un chiffre et un caractère spécial.',
    example: 'Abcdefgh12!?',
    pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{12,128}$',
  })
  @IsString()
  @IsNotEmpty()
  @IsPassword()
  password!: string;

  @ApiProperty({
    description: 'The phone number of the user',
    example: '+33612345678',
    required: false,
  })
  @IsString()
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @ApiProperty({
    description: 'The ID of the team the user belongs to',
    example: 'team_id_123',
    required: false,
  })
  @IsString()
  @IsOptional() // Si c'est optionnel, on enlève @IsNotEmpty
  @Reference('team')
  teamId?: string; // On utilise '?' au lieu de '!'
}

export class UpdateUserDto {
  @ApiProperty({ example: 'Alice', required: false })
  @IsString()
  @IsOptional()
  firstname?: string;

  @ApiProperty({ example: 'Martin', required: false })
  @IsString()
  @IsOptional()
  lastname?: string;

  @ApiProperty({ example: 'alice.martin@example.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '+33612345678', required: false, nullable: true })
  @IsString()
  @IsOptional()
  phone?: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    required: false,
    example: 'team-administration',
  })
  @IsString()
  @IsOptional()
  teamId?: string | null;

  @ApiProperty({ type: Boolean, required: false, example: false })
  @IsBoolean()
  @IsOptional()
  isAdmin?: boolean;
}
