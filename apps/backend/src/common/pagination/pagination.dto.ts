import type { Type as NestType } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Numéro de page, à partir de 1.', default: 1, minimum: 1, type: Number })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Nombre maximum de résultats par page.', default: 10, minimum: 1, maximum: 100, type: Number })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

@Exclude()
export class PaginationMetaDto {
  @Expose()
  @ApiProperty({ description: 'Nombre total de résultats correspondant aux filtres.', example: 24, minimum: 0 })
  total!: number;

  @Expose()
  @ApiProperty({ description: 'Page demandée.', example: 1, minimum: 1 })
  page!: number;

  @Expose()
  @ApiProperty({ description: 'Taille de page demandée.', example: 10, minimum: 1, maximum: 100 })
  limit!: number;

  @Expose()
  @ApiProperty({ description: 'Nombre total de pages ; 0 si aucun résultat.', example: 3, minimum: 0 })
  totalPages!: number;
}

/** Keep Swagger and serialization aware of the concrete item DTO. */
export function PaginatedDto<T>(item: NestType<T>) {
  @Exclude()
  class PageDto {
    @Expose()
    @Type(() => item)
    @ApiProperty({ type: [item], description: 'Résultats de la page demandée.' })
    items!: T[];

    @Expose()
    @Type(() => PaginationMetaDto)
    @ApiProperty({ type: PaginationMetaDto })
    meta!: PaginationMetaDto;
  }
  return PageDto;
}
