import { Trim } from '../../common/decorator/trim.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { UserSummaryDto } from '../../user/dto/user.dto';

export class AvailableTeamUsersParamsDto {
  @ApiProperty({
    description:
      "Identifiant de l'équipe ciblée, nettoyé des espaces aux extrémités.",
    example: 'team-administration',
    minLength: 1,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  id!: string;
}

@Exclude()
export class AvailableTeamUserDto extends UserSummaryDto {}
