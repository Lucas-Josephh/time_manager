export class DepartmentDto {
  @ApiProperty({
    description:
      'Le nom de votre département, par exemple : "Informatique", "Ressources Humaines", "Marketing", etc.',
    minimum: 1,
    maximum: 255,
    example: 'Informatique',
  })
  name!: string;
}

import { ApiProperty } from '@nestjs/swagger';
