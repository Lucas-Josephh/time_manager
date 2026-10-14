import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DepartmentDto {
  @ApiProperty({
    description:
      'Le nom de votre département, par exemple : "Informatique", "Ressources Humaines", "Marketing", etc.',
    minimum: 1,
    maximum: 255,
    example: 'Informatique',
  })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}

@Exclude()
export class DepartmentDetailsDto {
  @Expose()
  @ApiProperty({
    description: 'Identifiant unique du département.',
    example: 'department-it',
  })
  id!: string;

  @Expose()
  @ApiProperty({ description: 'Nom du département.', example: 'Informatique' })
  name!: string;

}
