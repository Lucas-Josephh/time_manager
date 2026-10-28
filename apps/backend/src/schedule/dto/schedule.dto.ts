import {
  IsArray,
  IsNotEmpty,
  IsString,
  IsDefined,
  IsObject,
  ValidateNested,
  MaxLength, IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Trim } from '../../common/decorator/transform/trim.decorator';
import { IsTime } from '../../common/validation/is-time.decorator';
import { TIME_PATTERN } from '../../common/validation/time.pattern';
import { Exclude, Expose, Type } from 'class-transformer';
import { DayOfWeek } from '../../generated/prisma/enums';
import { UserSummaryDto } from '../../user/dto/user.dto';
import { PaginatedDto, PaginationQueryDto } from '../../common/pagination/pagination.dto';

/**
 * TODO:
 * - Détails d'un schedule avec les totaux (heures, minutes, etc.)
 * - Détails d'un jour avec les totaux (heures, minutes, etc.)
 */

/**
 * DTO for a schedule time slot, including its start and end times.
 */
export class ScheduleTimeSlotDto {
  @ApiProperty({ example: '09:00', pattern: TIME_PATTERN.source })
  @IsString()
  @IsNotEmpty()
  @IsTime()
  startTime!: string;

  @ApiProperty({ example: '17:00', pattern: TIME_PATTERN.source })
  @IsString()
  @IsNotEmpty()
  @IsTime()
  endTime!: string;
}

/** Weekly time slots indexed by ISO weekday (1 = Monday, 7 = Sunday). */
export class WeeklyScheduleDto {
  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleTimeSlotDto)
  @ApiProperty({
    type: [ScheduleTimeSlotDto],
    description: 'Créneaux du lundi : tableau vide pour un jour non travaillé.',
  })
  '1'!: ScheduleTimeSlotDto[];

  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleTimeSlotDto)
  @ApiProperty({
    type: [ScheduleTimeSlotDto],
    description: 'Créneaux du mardi : tableau vide pour un jour non travaillé.',
  })
  '2'!: ScheduleTimeSlotDto[];

  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleTimeSlotDto)
  @ApiProperty({
    type: [ScheduleTimeSlotDto],
    description:
      'Créneaux du mercredi : tableau vide pour un jour non travaillé.',
  })
  '3'!: ScheduleTimeSlotDto[];

  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleTimeSlotDto)
  @ApiProperty({
    type: [ScheduleTimeSlotDto],
    description: 'Créneaux du jeudi : tableau vide pour un jour non travaillé.',
  })
  '4'!: ScheduleTimeSlotDto[];

  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleTimeSlotDto)
  @ApiProperty({
    type: [ScheduleTimeSlotDto],
    description:
      'Créneaux du vendredi : tableau vide pour un jour non travaillé.',
  })
  '5'!: ScheduleTimeSlotDto[];

  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleTimeSlotDto)
  @ApiProperty({
    type: [ScheduleTimeSlotDto],
    description:
      'Créneaux du samedi : tableau vide pour un jour non travaillé.',
  })
  '6'!: ScheduleTimeSlotDto[];

  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleTimeSlotDto)
  @ApiProperty({
    type: [ScheduleTimeSlotDto],
    description:
      'Créneaux du dimanche : tableau vide pour un jour non travaillé.',
  })
  '7'!: ScheduleTimeSlotDto[];
}

export class ScheduleDto {
  @IsString()
  @IsNotEmpty()
  @Trim()
  @MaxLength(255)
  @ApiProperty({ example: 'Planning équipe matin', maxLength: 255 })
  name!: string;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => WeeklyScheduleDto)
  @ApiProperty({
    type: WeeklyScheduleDto,
    description:
      'Semaine complète : les sept jours sont obligatoires. Remplace toute la semaine lorsqu’elle est fournie.',
  })
  weeklySchedule!: WeeklyScheduleDto;
}

export class ScheduleVersionDto extends ScheduleDto {
  @IsString()
  @IsNotEmpty()
  @Trim()
  @ApiPropertyOptional({ example: 'Europe/Paris' })
  timezone?: string;
}

export class CreateScheduleDto extends ScheduleDto {}

export class UpdateScheduleDto extends PartialType(CreateScheduleDto, {
  skipNullProperties: true,
}) {}

@Exclude()
export class ScheduleTimeSlotResponseDto extends ScheduleTimeSlotDto {
  @Expose()
  declare startTime: string;

  @Expose()
  declare endTime: string;

  @Expose()
  @ApiProperty()
  id!: string;
}

@Exclude()
export class ScheduleDayResponseDto {
  @Expose()
  @ApiProperty()
  id!: string;

  @Expose()
  @ApiProperty({ enum: DayOfWeek })
  dayOfWeek!: DayOfWeek;

  @Expose()
  @ApiProperty({ type: [ScheduleTimeSlotResponseDto] })
  @Type(() => ScheduleTimeSlotResponseDto)
  timeSlots!: ScheduleTimeSlotResponseDto[];
}

@Exclude()
export class ScheduleVersionResponseDto {
  @Expose()
  @ApiProperty({ example: 1 })
  version!: number;

  @Expose()
  @ApiProperty()
  id!: string;

  @Expose()
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @Expose()
  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  @Expose()
  @ApiProperty({ type: [ScheduleDayResponseDto] })
  @Type(() => ScheduleDayResponseDto)
  days!: ScheduleDayResponseDto[];
}

@Exclude()
export class ScheduleResponseDto {
  @Expose()
  @ApiProperty()
  id!: string;

  @Expose()
  @ApiProperty()
  name!: string;

  @Expose()
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @Expose()
  @ApiProperty({ type: UserSummaryDto })
  @Type(() => UserSummaryDto)
  createdBy!: UserSummaryDto;

  @Expose()
  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  @Expose()
  @ApiProperty({ type: [ScheduleVersionResponseDto] })
  @Type(() => ScheduleVersionResponseDto)
  versions!: ScheduleVersionResponseDto[];
}

export class QueryScheduleDto extends PaginationQueryDto {

  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({ description: 'Filtre par nom de planning.' })
  name?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({ description: 'Filtre par identifiant de créateur.' })
  createdByUserId?: string;

}
export class ScheduleListDto extends PaginatedDto(ScheduleResponseDto) {}
