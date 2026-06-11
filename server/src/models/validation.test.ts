import { describe, it, expect } from 'vitest';
import { CreateOrganizationSchema } from './organizationModel';
import { CreateContactSchema } from './contactModel';

// These schemas are the application's input-validation boundary (used by the
// controllers). Testing them proves invalid payloads are rejected as expected.
describe('CreateOrganizationSchema', () => {
  it('accepts a valid organization', () => {
    expect(CreateOrganizationSchema.safeParse({ name: 'Orion' }).success).toBe(true);
  });

  it('rejects an organization without a name', () => {
    expect(CreateOrganizationSchema.safeParse({}).success).toBe(false);
  });

  it('rejects an invalid website url', () => {
    expect(
      CreateOrganizationSchema.safeParse({ name: 'Orion', website: 'not-a-url' }).success,
    ).toBe(false);
  });

  it('allows an empty website string', () => {
    expect(CreateOrganizationSchema.safeParse({ name: 'Orion', website: '' }).success).toBe(true);
  });
});

describe('CreateContactSchema', () => {
  const validContact = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@orion.dev' };

  it('accepts a valid contact', () => {
    expect(CreateContactSchema.safeParse(validContact).success).toBe(true);
  });

  it('rejects an invalid email address', () => {
    expect(CreateContactSchema.safeParse({ ...validContact, email: 'nope' }).success).toBe(false);
  });

  it('rejects a non-uuid organizationId', () => {
    expect(
      CreateContactSchema.safeParse({ ...validContact, organizationId: '123' }).success,
    ).toBe(false);
  });
});
