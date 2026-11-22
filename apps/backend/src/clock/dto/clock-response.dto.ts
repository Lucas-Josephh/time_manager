import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
class ClockSessionDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @Expose()
  @ApiProperty({ type: String, format: 'date-time' })
  startedAt!: Date;

  @Expose()
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  endedAt!: Date | null;
}

@Exclude()
export class ClockResponseDto {
  @Expose()
  @Type(() => ClockSessionDto)
  @ApiProperty({ type: ClockSessionDto, nullable: true })
  session!: ClockSessionDto | null;
}
