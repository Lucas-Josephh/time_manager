import { ValidOrganizationParent } from '../../common/decorator/valid-organization-parent.decorator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Reference } from '../../common/decorator/reference.decorator';

export class OrganizationDto {
  @ApiProperty({ example: 'Technique', minLength: 1, maxLength: 255 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Parent existant. null rend l’organisation racine. Les cycles sont interdits.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ValidOrganizationParent()
  @Reference('organization')
  parentId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Responsable existant. null retire le responsable.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Reference('user')
  managerId?: string | null;
}

export class PartialOrganizationDto extends PartialType(OrganizationDto, { skipNullProperties: false }) {}

export class QueryOrganizationDto {
  @ApiPropertyOptional({ description: 'Recherche partielle sur le nom, sans distinction de casse.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Filtrer les enfants directs d’une organisation.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Filtrer par responsable.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  managerId?: string;
}

@Exclude()
export class OrganizationDetailsDto {
  @Expose()
  @ApiProperty({ example: 'department-it' })
  id!: string;

  @Expose()
  @ApiProperty({ example: 'Technique' })
  name!: string;

  @Expose()
  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @Expose()
  @ApiProperty({ type: String, nullable: true })
  parentId!: string | null;

  @Expose()
  @ApiProperty({ type: String, nullable: true })
  managerId!: string | null;

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @Expose()
  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
