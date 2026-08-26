import {
  ArrayNotEmpty,
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateAssignmentDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  propertyIds: string[];
}
