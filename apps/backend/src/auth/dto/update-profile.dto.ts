import { PartialType, PickType } from '@nestjs/swagger';
import { UserProfileDto } from '../../user/dto/user.dto';

/**
 * Represents the data transfer object for updating a user's profile. It extends
 * the `UserProfileDto` by picking only the `firstname`, `lastname`, and `phone`
 * properties, allowing for partial updates of these fields.
 *
 * The `skipNullProperties` option is set to false, meaning that null values
 * will not be skipped during validation.
 */
export class UpdateProfileDto extends PartialType(
  PickType(UserProfileDto, ['firstname', 'lastname', 'phone'] as const),
  { skipNullProperties: false },
) {}
