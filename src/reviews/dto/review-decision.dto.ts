import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewerNotes?: string;
}
