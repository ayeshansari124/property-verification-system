/**
 * The set of Property fields a Data Checker / Admin
 * is allowed to propose changes to.
 *
 * This list is the single source of truth for:
 *  - which DTO fields get merged into a property review proposal
 *  - which fields get diffed when a review is approved
 *  - which fields get diffed on a direct admin PUT /properties/:id
 *
 * Keeping this in one place avoids the previous bug surface where
 * assignments.service.ts and reviews.service.ts each hard-coded
 * their own copy of this list and could silently drift apart.
 */
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

/**
 * Merges a partial DTO onto an existing property snapshot,
 * producing the full "proposed" record plus the list of
 * fields that were actually supplied by the caller.
 *
 * Used when a Data Checker submits an update: the DTO only
 * contains the fields they touched, but a Property Review
 * always stores a full before/after snapshot.
 */
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

/**
 * Compares two full property snapshots field-by-field and
 * returns only the fields whose values actually differ.
 *
 * Used at approval time (and on direct admin edits) so that
 * the audit log and the Property UPDATE only ever touch
 * fields that truly changed - even if the proposal was
 * created against stale data.
 */
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
