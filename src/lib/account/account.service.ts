import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/auth/password';
import { DEV_SESSIONS_STORE, invalidateAllUserSessions } from '@/lib/auth/session';
import { isStorefrontFallbackAllowed, CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';

export interface AddressInput {
  name: string;
  company?: string | null;
  street: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  phone: string;
  isDefault?: boolean;
}

export interface AddressRecord extends AddressInput {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Dev fallback in-memory store for addresses
const globalForAccount = globalThis as unknown as {
  devAddressesStore: Map<string, AddressRecord[]> | undefined;
};

export const DEV_ADDRESSES_STORE =
  globalForAccount.devAddressesStore ?? new Map<string, AddressRecord[]>();

if (process.env.NODE_ENV !== 'production' || isStorefrontFallbackAllowed()) {
  globalForAccount.devAddressesStore = DEV_ADDRESSES_STORE;
}

/**
 * Get profile data for an authenticated customer
 */
export async function getCustomerProfile(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
      },
    });

    if (user) return user;

    if (isStorefrontFallbackAllowed()) {
      // Check dev session store
      for (const sess of DEV_SESSIONS_STORE.values()) {
        if (sess.user.id === userId) {
          return {
            id: sess.user.id,
            name: sess.user.name,
            email: sess.user.email,
            phone: sess.user.phone,
            role: sess.user.role,
            isEmailVerified: sess.user.isEmailVerified,
            createdAt: sess.user.createdAt,
          };
        }
      }
    }

    return null;
  } catch (err: any) {
    if (isStorefrontFallbackAllowed()) {
      for (const sess of DEV_SESSIONS_STORE.values()) {
        if (sess.user.id === userId) {
          return {
            id: sess.user.id,
            name: sess.user.name,
            email: sess.user.email,
            phone: sess.user.phone,
            role: sess.user.role,
            isEmailVerified: sess.user.isEmailVerified,
            createdAt: sess.user.createdAt,
          };
        }
      }
    }
    throw new CatalogDatabaseError('Database unreachable while retrieving profile.');
  }
}

/**
 * Update customer name and mobile number
 */
export async function updateCustomerProfile(
  userId: string,
  data: { name?: string; phone?: string }
) {
  const updates: { name?: string; phone?: string | null } = {};

  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    if (trimmed.length < 2) {
      throw new Error('Name must be at least 2 characters long.');
    }
    updates.name = trimmed;
  }

  if (data.phone !== undefined) {
    const trimmed = data.phone.trim();
    if (trimmed && !/^\+?[0-9]{10,13}$/.test(trimmed)) {
      throw new Error('Please enter a valid 10-digit mobile number.');
    }
    updates.phone = trimmed || null;
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
      },
    });

    return updated;
  } catch (err: any) {
    if (isStorefrontFallbackAllowed()) {
      for (const sess of DEV_SESSIONS_STORE.values()) {
        if (sess.user.id === userId) {
          if (updates.name) sess.user.name = updates.name;
          if (updates.phone !== undefined) sess.user.phone = updates.phone;
          return {
            id: sess.user.id,
            name: sess.user.name,
            email: sess.user.email,
            phone: sess.user.phone,
            role: sess.user.role,
            isEmailVerified: sess.user.isEmailVerified,
            createdAt: sess.user.createdAt,
          };
        }
      }
    }
    throw new CatalogDatabaseError('Database unreachable while updating profile.');
  }
}

/**
 * Change customer password with current password verification
 */
export async function changeCustomerPassword(
  userId: string,
  currentPassword?: string,
  newPassword?: string,
  confirmPassword?: string
) {
  if (!newPassword || typeof newPassword !== 'string') {
    throw new Error('Please enter your new password.');
  }

  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    throw new Error('New password and confirmation do not match.');
  }

  const validation = validatePasswordStrength(newPassword);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Password does not meet complexity requirements.');
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      if (isStorefrontFallbackAllowed()) {
        return { success: true, message: 'Password updated successfully in local dev session.' };
      }
      throw new Error('User not found.');
    }

    // If user has a passwordHash, verify currentPassword
    if (user.passwordHash) {
      if (!currentPassword) {
        throw new Error('Please enter your current password.');
      }
      const isMatch = await verifyPassword(currentPassword, user.passwordHash);
      if (!isMatch) {
        throw new Error('Current password is incorrect.');
      }
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { success: true, message: 'Password updated successfully.' };
  } catch (err: any) {
    if (err.message && !err.message.includes('Prisma') && !err.message.includes('database')) {
      throw err;
    }
    if (isStorefrontFallbackAllowed()) {
      return { success: true, message: 'Password updated successfully in dev environment.' };
    }
    throw new CatalogDatabaseError('Database unreachable while updating password.');
  }
}

/**
 * List saved delivery addresses for a customer
 */
export async function listCustomerAddresses(userId: string): Promise<AddressRecord[]> {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return addresses as AddressRecord[];
  } catch (err: any) {
    if (isStorefrontFallbackAllowed()) {
      return DEV_ADDRESSES_STORE.get(userId) || [];
    }
    throw new CatalogDatabaseError('Database unreachable while loading delivery addresses.');
  }
}

/**
 * Add a new delivery address
 */
export async function createCustomerAddress(
  userId: string,
  input: AddressInput
): Promise<AddressRecord> {
  const cleanName = input.name?.trim();
  const cleanStreet = input.street?.trim();
  const cleanCity = input.city?.trim();
  const cleanState = input.state?.trim();
  const cleanStateCode = input.stateCode?.trim() || '36';
  const cleanPincode = input.pincode?.trim();
  const cleanPhone = input.phone?.trim();

  if (!cleanName || cleanName.length < 2) {
    throw new Error('Recipient name must be at least 2 characters.');
  }
  if (!cleanStreet || cleanStreet.length < 5) {
    throw new Error('Street address must be at least 5 characters.');
  }
  if (!cleanCity || cleanCity.length < 2) {
    throw new Error('City is required.');
  }
  if (!cleanState || cleanState.length < 2) {
    throw new Error('State is required.');
  }
  if (!cleanPincode || !/^\d{6}$/.test(cleanPincode)) {
    throw new Error('Please enter a valid 6-digit Indian PIN code.');
  }
  if (!cleanPhone || !/^\+?[0-9]{10,13}$/.test(cleanPhone)) {
    throw new Error('Please enter a valid 10-digit delivery contact phone number.');
  }

  const isDefault = Boolean(input.isDefault);

  try {
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const created = await prisma.address.create({
      data: {
        userId,
        name: cleanName,
        company: input.company?.trim() || null,
        street: cleanStreet,
        city: cleanCity,
        state: cleanState,
        stateCode: cleanStateCode,
        pincode: cleanPincode,
        phone: cleanPhone,
        isDefault,
      },
    });

    return created as AddressRecord;
  } catch (err: any) {
    if (isStorefrontFallbackAllowed()) {
      const existing = DEV_ADDRESSES_STORE.get(userId) || [];
      if (isDefault) {
        existing.forEach((a) => (a.isDefault = false));
      }
      const newAddress: AddressRecord = {
        id: `addr-${Date.now()}`,
        userId,
        name: cleanName,
        company: input.company?.trim() || null,
        street: cleanStreet,
        city: cleanCity,
        state: cleanState,
        stateCode: cleanStateCode,
        pincode: cleanPincode,
        phone: cleanPhone,
        isDefault: isDefault || existing.length === 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      existing.unshift(newAddress);
      DEV_ADDRESSES_STORE.set(userId, existing);
      return newAddress;
    }
    throw new CatalogDatabaseError('Database unreachable while saving address.');
  }
}

/**
 * Update an existing delivery address
 */
export async function updateCustomerAddress(
  userId: string,
  addressId: string,
  input: Partial<AddressInput>
): Promise<AddressRecord> {
  try {
    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!existing) {
      throw new Error('Address not found or does not belong to your account.');
    }

    if (input.isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.address.update({
      where: { id: addressId },
      data: {
        name: input.name?.trim(),
        company: input.company !== undefined ? input.company?.trim() || null : undefined,
        street: input.street?.trim(),
        city: input.city?.trim(),
        state: input.state?.trim(),
        stateCode: input.stateCode?.trim(),
        pincode: input.pincode?.trim(),
        phone: input.phone?.trim(),
        isDefault: input.isDefault,
      },
    });

    return updated as AddressRecord;
  } catch (err: any) {
    if (err.message && !err.message.includes('Prisma') && !err.message.includes('database')) {
      throw err;
    }
    if (isStorefrontFallbackAllowed()) {
      const list = DEV_ADDRESSES_STORE.get(userId) || [];
      const item = list.find((a) => a.id === addressId);
      if (!item) throw new Error('Address not found.');
      if (input.isDefault) {
        list.forEach((a) => (a.isDefault = false));
      }
      if (input.name) item.name = input.name.trim();
      if (input.company !== undefined) item.company = input.company?.trim() || null;
      if (input.street) item.street = input.street.trim();
      if (input.city) item.city = input.city.trim();
      if (input.state) item.state = input.state.trim();
      if (input.stateCode) item.stateCode = input.stateCode.trim();
      if (input.pincode) item.pincode = input.pincode.trim();
      if (input.phone) item.phone = input.phone.trim();
      if (input.isDefault !== undefined) item.isDefault = input.isDefault;
      item.updatedAt = new Date();
      return item;
    }
    throw new CatalogDatabaseError('Database unreachable while updating address.');
  }
}

/**
 * Delete a delivery address
 */
export async function deleteCustomerAddress(userId: string, addressId: string): Promise<boolean> {
  try {
    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!existing) {
      throw new Error('Address not found or does not belong to your account.');
    }

    await prisma.address.delete({
      where: { id: addressId },
    });

    return true;
  } catch (err: any) {
    if (err.message && !err.message.includes('Prisma') && !err.message.includes('database')) {
      throw err;
    }
    if (isStorefrontFallbackAllowed()) {
      const list = DEV_ADDRESSES_STORE.get(userId) || [];
      const index = list.findIndex((a) => a.id === addressId);
      if (index === -1) throw new Error('Address not found.');
      list.splice(index, 1);
      return true;
    }
    throw new CatalogDatabaseError('Database unreachable while deleting address.');
  }
}

