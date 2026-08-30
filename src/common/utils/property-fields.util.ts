export const EDITABLE_PROPERTY_FIELDS = [
  'address',
  'city',
  'state',
  'zip',
  'bedrooms',
  'bathrooms',
  'propertyType',
  'yearBuilt',
  'livingArea',
  'lotSize',
  'heating',
  'cooling',
  'water',
  'sewer',
  'appliances',
  'features',
  'listingAgent',
  'buyerAgent',
  'status',
] as const;

export type EditablePropertyField = (typeof EDITABLE_PROPERTY_FIELDS)[number];

export type PartialPropertyValues = Partial<
  Record<EditablePropertyField, unknown>
>;

export interface PropertyFieldDiff {
  changedFields: string[];
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
}

export function buildProposedValues(
  existing: Record<string, unknown>,
  dto: PartialPropertyValues,
): { newValues: Record<string, unknown>; changedFields: string[] } {
  const newValues: Record<string, unknown> = { ...existing };
  const changedFields: string[] = [];

  for (const field of EDITABLE_PROPERTY_FIELDS) {
    if (dto[field] !== undefined) {
      newValues[field] = dto[field];
      changedFields.push(field);
    }
  }

  return { newValues, changedFields };
}

export function diffPropertyValues(
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
): PropertyFieldDiff {
  const changedFields: string[] = [];
  const oldDiff: Record<string, unknown> = {};
  const newDiff: Record<string, unknown> = {};

  for (const field of EDITABLE_PROPERTY_FIELDS) {
    const oldValue = oldValues[field];
    const newValue = newValues[field];

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changedFields.push(field);
      oldDiff[field] = oldValue;
      newDiff[field] = newValue;
    }
  }

  return { changedFields, oldValues: oldDiff, newValues: newDiff };
}
