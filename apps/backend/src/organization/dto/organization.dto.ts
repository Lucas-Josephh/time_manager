import { PaginatedDto, PaginationQueryDto } from '../../common/pagination/pagination.dto';
import { Trim } from '../../common/decorator/transform/trim.decorator';
import { Reference } from '../../common/validation/reference.decorator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class OrganizationDto {
  @ApiProperty({ example: 'Technique', minLength: 1, maxLength: 255 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      "Parent existant. null rend l'organisation racine. Les cycles sont interdits.",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Reference('organization')
  @Trim()
  parentId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Responsable existant. null retire le responsable.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Reference('user')
  @Trim()
  managerId?: string | null;
}

export class PartialOrganizationDto extends PartialType(OrganizationDto, {
  skipNullProperties: false,
}) {}

export class QueryOrganizationListDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Recherche partielle sur le nom, sans distinction de casse.',
  })
  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description:
      'Filtrer par organisation parente directe.',
  })
  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Filtrer par responsable.' })
  @Trim()
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

@Exclude()
export class OrganizationTreeDto extends OrganizationDetailsDto {
  @Expose()
  @Type(() => OrganizationTreeDto)
  @ApiProperty({ type: () => [OrganizationTreeDto] })
  children!: OrganizationTreeDto[];
}

export class OrganizationListDto extends PaginatedDto(OrganizationDetailsDto) {}
