import { Exclude, Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

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
