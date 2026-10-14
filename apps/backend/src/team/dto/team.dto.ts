import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Reference } from '../../common/decorator/reference.decorator';
import { Unique } from '../../common/decorator/unique.decorator';
import { PartialType } from '@nestjs/swagger';

export class TeamDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Unique('team', 'name')
  name!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Reference('user')
  managerId?: string | null;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @Reference('department')
  departmentId!: string;
}

export class PartialTeamDto extends PartialType(TeamDto, {}) {}
