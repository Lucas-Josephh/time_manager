import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsString,
  ValidateIf,
} from 'class-validator';
import {
  PaginatedDto,
  PaginationQueryDto,
} from '../../common/pagination/pagination.dto';
import { ScheduleResponseDto } from './schedule.dto';

export class AssignScheduleDto {
  @ApiProperty({ type: [String], minItems: 1, maxItems: 500 })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  userIds!: string[];

  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Instant ISO avec offset. Omettre pour une prise d’effet immédiate.',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  effectiveFrom?: string;

  @ApiPropertyOptional({
    description:
      'Confirmation obligatoire pour une affectation rétroactive, réservée aux administrateurs.',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  confirmRetroactive?: boolean;
}

export class ScheduleAtQueryDto {
  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Instant ISO avec offset ; maintenant par défaut.',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  at?: string;
}

@Exclude()
export class ScheduleAssignmentResponseDto {
  @Expose()
  @ApiProperty()
  id!: string;

  @Expose()
  @ApiProperty()
  userId!: string;

  @Expose()
  @ApiProperty()
  workScheduleId!: string;

  @Expose()
  @ApiProperty({ type: String, format: 'date-time' })
  effectiveFrom!: Date;

  @Expose()
  @Type(() => ScheduleResponseDto)
  @ApiProperty({ type: ScheduleResponseDto })
  workSchedule!: ScheduleResponseDto;
}

export class ScheduleAssignmentListDto extends PaginatedDto(
  ScheduleAssignmentResponseDto,
) {}
export class ScheduleAssignmentQueryDto extends PaginationQueryDto {}

@Exclude()
export class UserScheduleResponseDto {
  @Expose()
  @Type(() => ScheduleAssignmentResponseDto)
  @ApiProperty({ type: ScheduleAssignmentResponseDto, nullable: true })
  assignment!: ScheduleAssignmentResponseDto | null;
}
