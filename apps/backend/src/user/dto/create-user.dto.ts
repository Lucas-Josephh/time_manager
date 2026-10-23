import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  IsPhoneNumber,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Reference } from 'src/common/decorator/reference.decorator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'The first name of the user',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  firstname!: string;

  @ApiProperty({
    description: 'The last name of the user',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  lastname!: string;

  @ApiProperty({
    description: 'The email address of the user',
    example: 'john.doe@example.com',
  })
  @IsEmail({})
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsString()
  @MinLength(6) // Par exemple, un minimum de 6 caractères
  password!: string;

  @ApiProperty({
    description: 'The phone number of the user',
    example: '+33612345678',
    required: false,
  })
  @IsString()
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @ApiProperty({
    description: 'The secure password for the account',
    example: 'SecurePassword123!',
    minLength: 12,
  })
  @ApiProperty({
    description: 'The ID of the team the user belongs to',
    example: 'team_id_123',
    required: false,
  })
  @IsString()
  @IsOptional() // Si c'est optionnel, on enlève @IsNotEmpty
  @Reference('team')
  teamId?: string; // On utilise '?' au lieu de '!'
}
