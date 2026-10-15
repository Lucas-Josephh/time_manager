import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  IsPhoneNumber,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Unique } from '../../common/decorator/unique.decorator';
import { Reference } from 'src/common/decorator/reference.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: any }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  firstname!: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: any }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  lastname!: string;

  @IsEmail({})
  @IsNotEmpty()
  @Unique('user', 'email')
  @Transform(({ value }: { value: any }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsString()
  @IsOptional()
  // Optionnel : tu peux aussi utiliser @IsPhoneNumber() pour valider le format si besoin
  phone?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(12)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @Reference('team')
  @IsOptional()
  teamId!: string; // ID de l'équipe à laquelle l'utilisateur appartient
}
