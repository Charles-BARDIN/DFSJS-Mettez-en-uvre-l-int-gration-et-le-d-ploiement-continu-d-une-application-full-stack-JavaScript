import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Organization } from '@prisma/client';
import { organizationService } from './organizationService';
import { organizationRepository } from '../repositories/organizationRepository';

// The repository is the boundary to the database: we mock it so these tests
// exercise the service's business logic in isolation (no DB required).
vi.mock('../repositories/organizationRepository', () => ({
  organizationRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getStats: vi.fn(),
  },
}));

const repo = vi.mocked(organizationRepository);

const sampleOrg: Organization = {
  id: 'org-1',
  name: 'Orion',
  industry: null,
  website: null,
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('organizationService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getAllOrganizations delegates to the repository', async () => {
    repo.findAll.mockResolvedValue([sampleOrg]);
    await expect(organizationService.getAllOrganizations()).resolves.toEqual([sampleOrg]);
    expect(repo.findAll).toHaveBeenCalledOnce();
  });

  it('getOrganizationById returns the organization when it exists', async () => {
    repo.findById.mockResolvedValue(sampleOrg);
    await expect(organizationService.getOrganizationById('org-1')).resolves.toEqual(sampleOrg);
  });

  it('getOrganizationById throws when the organization is missing', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(organizationService.getOrganizationById('missing')).rejects.toThrow(
      'Organization not found',
    );
  });

  it('updateOrganization rejects and never updates an unknown organization', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(
      organizationService.updateOrganization('missing', { name: 'X' }),
    ).rejects.toThrow('Organization not found');
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('updateOrganization updates an existing organization', async () => {
    repo.findById.mockResolvedValue(sampleOrg);
    repo.update.mockResolvedValue({ ...sampleOrg, name: 'New name' });
    const result = await organizationService.updateOrganization('org-1', { name: 'New name' });
    expect(result.name).toBe('New name');
    expect(repo.update).toHaveBeenCalledWith('org-1', { name: 'New name' });
  });

  it('deleteOrganization rejects and never deletes an unknown organization', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(organizationService.deleteOrganization('missing')).rejects.toThrow(
      'Organization not found',
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('deleteOrganization deletes an existing organization', async () => {
    repo.findById.mockResolvedValue(sampleOrg);
    repo.delete.mockResolvedValue(sampleOrg);
    await organizationService.deleteOrganization('org-1');
    expect(repo.delete).toHaveBeenCalledWith('org-1');
  });
});
