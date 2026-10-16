import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ example: 'Alice', required: false })
  @IsString()
  @IsOptional()
  firstname?: string;

  @ApiProperty({ example: 'Martin', required: false })
  @IsString()
  @IsOptional()
  lastname?: string;

  @ApiProperty({ example: 'alice.martin@example.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '+33612345678', required: false, nullable: true })
  @IsString()
  @IsOptional()
  phone?: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    required: false,
    example: 'team-administration',
  })
  @IsString()
  @IsOptional()
  teamId?: string | null;

  @ApiProperty({ type: Boolean, required: false, example: false })
  @IsBoolean()
  @IsOptional()
  isAdmin?: boolean;
}
