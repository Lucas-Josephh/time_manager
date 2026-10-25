import { Exclude } from 'class-transformer';
import { UserSummaryDto } from '../../user/dto/user.dto';

@Exclude()
export class AvailableTeamUserDto extends UserSummaryDto {}
