import { ApiProperty } from '@nestjs/swagger';

export class DepartmentDetailsDto {
  @ApiProperty({
    description: 'Identifiant unique du département.',
    example: 'department-it',
  })
  id!: string;

  @ApiProperty({ description: 'Nom du département.', example: 'Informatique' })
  name!: string;

  @ApiProperty({
    description: 'Date de création du département.',
    format: 'date-time',
    example: '2026-01-01T00:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Date de dernière modification du département.',
    format: 'date-time',
    example: '2026-01-01T00:00:00.000Z',
  })
  updatedAt!: string;
}

class DepartmentSuccessResponseDto {
  @ApiProperty({ enum: [true], example: true })
  success!: boolean;

  @ApiProperty({ example: 'request_successful' })
  message!: string;
}

export class DepartmentListResponseDto extends DepartmentSuccessResponseDto {
  @ApiProperty({ type: [DepartmentDetailsDto] })
  data!: DepartmentDetailsDto[];
}

export class DepartmentResponseDto extends DepartmentSuccessResponseDto {
  @ApiProperty({ type: DepartmentDetailsDto })
  data!: DepartmentDetailsDto;
}

export class DepartmentNotFoundResponseDto {
  @ApiProperty({ enum: [false], example: false })
  success!: boolean;

  @ApiProperty({
    enum: ['department_not_found'],
    example: 'department_not_found',
  })
  message!: string;

  @ApiProperty({ type: 'object', additionalProperties: false, example: {} })
  data!: Record<string, never>;
}
