import {
  IsArray,
  ArrayUnique,
  IsIn,
  IsNotEmpty,
  IsString,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Trim } from '../../common/decorator/transform/trim.decorator';
export class AddMembersDto {
  @Trim({ each: true })
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  memberIds!: string[];
}
export class TransferMemberDto {
  @ApiProperty()
  @Trim()
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({
    description:
      'Équipe source du transfert. La destination est le paramètre :id de la route.',
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  teamId!: string;
}
export class SetManagerDto {
  @ApiProperty({ type: String, nullable: true })
  @ValidateIf((_o, value) => value !== null)
  @Trim()
  @IsString()
  @IsNotEmpty()
  managerId!: string | null;
}
export class AvailableUsersQueryDto {
  @ApiProperty({ enum: ['member', 'transfer', 'manager'] })
  @IsIn(['member', 'transfer', 'manager'])
  usage!: 'member' | 'transfer' | 'manager';

  @ApiProperty()
  @Trim()
  @IsString()
  @IsNotEmpty()
  teamId!: string;
}
