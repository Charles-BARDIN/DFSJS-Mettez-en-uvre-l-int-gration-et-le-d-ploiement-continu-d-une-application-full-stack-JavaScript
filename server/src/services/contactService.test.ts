import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Contact } from '@prisma/client';
import { contactService } from './contactService';
import { contactRepository } from '../repositories/contactRepository';

vi.mock('../repositories/contactRepository', () => ({
  contactRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getStats: vi.fn(),
  },
}));

const repo = vi.mocked(contactRepository);

const sampleContact: Contact = {
  id: 'contact-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@orion.dev',
  phone: null,
  position: null,
  organizationId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('contactService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getContactById returns the contact when it exists', async () => {
    repo.findById.mockResolvedValue(sampleContact);
    await expect(contactService.getContactById('contact-1')).resolves.toEqual(sampleContact);
  });

  it('getContactById throws when the contact is missing', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(contactService.getContactById('missing')).rejects.toThrow('Contact not found');
  });

  it('updateContact rejects and never updates an unknown contact', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(contactService.updateContact('missing', { lastName: 'X' })).rejects.toThrow(
      'Contact not found',
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('deleteContact deletes an existing contact', async () => {
    repo.findById.mockResolvedValue(sampleContact);
    repo.delete.mockResolvedValue(sampleContact);
    await contactService.deleteContact('contact-1');
    expect(repo.delete).toHaveBeenCalledWith('contact-1');
  });

  it('getContactStats delegates to the repository', async () => {
    repo.getStats.mockResolvedValue({ total: 3 });
    await expect(contactService.getContactStats()).resolves.toEqual({ total: 3 });
  });
});
