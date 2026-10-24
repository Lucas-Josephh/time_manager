import { Trim } from '../../common/decorator/trim.decorator';
import { Exclude, Expose, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Unique } from '../../common/decorator/unique.decorator';
import { Reference } from '../../common/decorator/reference.decorator';
import { IsPassword } from '../../common/decorator/password.decorator';

const lowercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toLowerCase() : value;

@Exclude()
export class UserSummaryDto {
  @Expose() @ApiProperty() id!: string;
  @Expose() @ApiProperty() firstname!: string;
  @Expose() @ApiProperty() lastname!: string;
}

@Exclude()
export class UserDetailsDto extends UserSummaryDto {
  @Expose()
  @ApiProperty({
    description: 'Nom d’affichage calculé à partir du prénom et du nom.',
    example: 'Alice Martin',
  })
  name!: string;

  @Expose()
  @ApiProperty()
  email!: string;

  @Expose()
  @ApiProperty({ type: String, nullable: true })
  phone!: string | null;

  @Expose()
  @ApiProperty({ type: String, nullable: true })
  image!: string | null;

  @Expose()
  @ApiProperty({ type: String, nullable: true })
  teamId!: string | null;

  @Expose()
  @ApiProperty({ type: String, nullable: true })
  organizationId!: string | null;

  @Expose()
  @ApiProperty()
  isAdmin!: boolean;

  @Expose()
  @ApiProperty()
  mustChangePassword!: boolean;

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @Expose()
  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class UserProfileDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  firstname!: string;

  @ApiProperty()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  lastname!: string;

  @ApiProperty()
  @Trim()
  @Transform(lowercase)
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsPhoneNumber()
  phone?: string | null;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isAdmin?: boolean;
}

export class CreateUserDto extends UserProfileDto {
  @Unique('user', 'email')
  declare email: string;

  @ApiPropertyOptional({
    description:
      'Équipe initiale. Son organisation devient celle du nouvel utilisateur. Les changements ultérieurs passent par Team.',
  })
  @Trim()
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @Reference('team')
  teamId?: string;

  @ApiProperty({
    description:
      '12 à 128 caractères, avec majuscule, minuscule, chiffre et caractère spécial.',
  })
  @IsString()
  @IsPassword()
  password!: string;
}

export class UpdateUserDto extends PartialType(UserProfileDto, {
  skipNullProperties: false,
}) {}

export class QueryUserDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 10, maximum: 100 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  email?: string;
  @ApiPropertyOptional()
  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstname?: string;

  @ApiPropertyOptional()
  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastname?: string;
}

@Exclude()
export class UserPaginationDto {
  @Expose()
  @ApiProperty()
  total!: number;

  @Expose()
  @ApiProperty()
  page!: number;

  @Expose()
  @ApiProperty()
  limit!: number;

  @Expose()
  @ApiProperty()
  totalPages!: number;
}

@Exclude()
export class UserListDto {
  @Expose()
  @Type(() => UserDetailsDto)
  @ApiProperty({ type: [UserDetailsDto] })
  items!: UserDetailsDto[];

  @Expose()
  @Type(() => UserPaginationDto)
  @ApiProperty({ type: UserPaginationDto })
  meta!: UserPaginationDto;
}
