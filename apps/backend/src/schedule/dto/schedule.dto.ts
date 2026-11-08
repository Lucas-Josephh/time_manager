import { isValidTimezone, isValidWeek } from '../schedule-validation';
import {
  IsArray,
  ValidateBy,
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
import { Exclude, Expose, Transform, Type } from 'class-transformer';
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
  @ApiPropertyOptional({ example: 'Europe/Paris', default: 'Europe/Paris' })
  @IsOptional()
  @IsString()
  @ValidateBy({
    name: 'isScheduleTimezone',
    validator: { validate: isValidTimezone },
  })
  timezone?: string;

  @IsString()
  @IsNotEmpty()
  @Trim()
  @MaxLength(255)
  @ApiProperty({ example: 'Planning équipe matin', maxLength: 255 })
  name!: string;

  @IsDefined()
  @ValidateBy({
    name: 'isValidScheduleWeek',
    validator: { validate: isValidWeek },
  })
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
export class ScheduleResponseDto {
  @Expose()
  @ApiProperty({ example: 'Europe/Paris' })
  timezone!: string;

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
  @ApiProperty({ type: WeeklyScheduleDto })
  @Transform(({ obj }) => {
    const week: WeeklyScheduleDto = {
      '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [],
    };
    const weekdays: DayOfWeek[] = [
      'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
    ];
    for (const day of (obj.days ?? []) as ScheduleDayResponseDto[]) {
      const key = String(weekdays.indexOf(day.dayOfWeek) + 1) as keyof WeeklyScheduleDto;
      if (key in week) {
        week[key] = day.timeSlots.map(({ startTime, endTime }) => ({ startTime, endTime }));
      }
    }
    return week;
  }, { toClassOnly: true })
  weeklySchedule!: WeeklyScheduleDto;

  @Expose()
  @ApiProperty({ nullable: true })
  sourceWorkScheduleId!: string | null;
}

@Exclude()
export class ScheduleTreeDto extends ScheduleResponseDto {
  @Expose()
  @Type(() => ScheduleTreeDto)
  @ApiProperty({ type: () => [ScheduleTreeDto] })
  children!: ScheduleTreeDto[];
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
  createdBy?: string;

}
export class ScheduleListDto extends PaginatedDto(ScheduleResponseDto) {}
