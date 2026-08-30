import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Partial set of editable Property fields.
 *
 * Used by:
 *  - PATCH /assignments/:assignmentId/properties/:propertyId
 *    (Data Checker proposes a change -> creates a Property Review)
 *  - PUT /properties/:id
 *    (Admin direct override -> updates the master record immediately)
 *
 * Keep this in sync with EDITABLE_PROPERTY_FIELDS in
 * common/utils/property-fields.util.ts.
 */
export class UpdatePropertyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  zip?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  bedrooms?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bathrooms?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  propertyType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  yearBuilt?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  livingArea?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lotSize?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  heating?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  cooling?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  water?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sewer?: string;

  @IsOptional()
  @IsArray()
  appliances?: unknown[];

  @IsOptional()
  @IsArray()
  features?: unknown[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  listingAgent?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  buyerAgent?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  status?: string;
}
