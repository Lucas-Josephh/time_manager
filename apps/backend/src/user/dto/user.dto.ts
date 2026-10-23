import { Exclude, Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
// Assure-toi que le chemin d'import vers ton TeamDetailsDto est correct
import { TeamDetailsDto } from 'src/team/dto/team.dto';

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
