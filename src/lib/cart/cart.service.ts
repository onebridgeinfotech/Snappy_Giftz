import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { isStorefrontFallbackAllowed, CatalogDatabaseError } from '@/lib/catalog/public-catalog.service';
import { INITIAL_PRODUCTS } from '@/data/initialData';

export class CartError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'CartError';
    this.statusCode = statusCode;
  }
}

export interface CartItemDTO {
  id: string;
  cartId: string;
  productId: string;
  productName: string;
  productSlug: string;
  productType: string;
  productImage: string;
  variantId?: string | null;
  variantName?: string | null;
  sku: string;
  unitPricePaise: number;
  quantity: number;
  lineSubtotalPaise: number;
  isCustomized: boolean;
  customizationFeePaise: number;
  customizationData?: any | null;
  uploads?: Array<{
    id: string;
    fileKey: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
  }>;
}

export interface CartSummaryDTO {
  id: string;
  userId?: string | null;
  sessionToken?: string | null;
  items: CartItemDTO[];
  itemCount: number;
  itemsSubtotalPaise: number;
  customizationTotalPaise: number;
  estimatedTotalPaise: number;
  updatedAt: string;
}

// In-Memory Dev Store for Cart Fallback when DB is offline
const DEV_CARTS = new Map<string, any>();
const DEV_CART_ITEMS = new Map<string, any>();

/**
 * Resolves or creates an authoritative Cart record.
 */
export async function getOrCreateCart(
  userId?: string | null,
  sessionToken?: string | null
): Promise<{ id: string; userId: string | null; sessionToken: string | null }> {
  if (!userId && !sessionToken) {
    throw new CartError('Either userId or sessionToken must be provided to access cart.', 400);
  }

  try {
    if (userId) {
      let cart = await prisma.cart.findFirst({
        where: { userId },
      });
      if (!cart) {
        cart = await prisma.cart.create({
          data: { userId },
        });
      }
      return { id: cart.id, userId: cart.userId, sessionToken: cart.sessionToken };
    } else {
      let cart = await prisma.cart.findUnique({
        where: { sessionToken: sessionToken! },
      });
      if (!cart) {
        cart = await prisma.cart.create({
          data: { sessionToken: sessionToken! },
        });
      }
      return { id: cart.id, userId: cart.userId, sessionToken: cart.sessionToken };
    }
  } catch (err: any) {
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database offline during cart lookup.');
    }

    const key = userId ? `user:${userId}` : `session:${sessionToken}`;
    let cart = DEV_CARTS.get(key);
    if (!cart) {
      cart = {
        id: `dev-cart-${crypto.randomBytes(6).toString('hex')}`,
        userId: userId || null,
        sessionToken: sessionToken || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      DEV_CARTS.set(key, cart);
    }
    return { id: cart.id, userId: cart.userId, sessionToken: cart.sessionToken };
  }
}

/**
 * Returns formatted cart summary with authoritative server-calculated pricing.
 */
export async function getCartSummary(
  userId?: string | null,
  sessionToken?: string | null
): Promise<CartSummaryDTO> {
  const cartInfo = await getOrCreateCart(userId, sessionToken);

  try {
    const cart = await prisma.cart.findUnique({
      where: { id: cartInfo.id },
      include: {
        items: {
          include: {
            product: {
              include: {
                galleryImages: { orderBy: { displayOrder: 'asc' } },
              },
            },
            variant: true,
            uploads: true,
          },
        },
      },
    });

    if (!cart) {
      throw new CartError('Cart not found.', 404);
    }

    const itemsDTO: CartItemDTO[] = cart.items.map((item) => {
      const unitPrice = item.variant ? item.variant.pricePaise : item.product.basePricePaise;
      const customFee = item.isCustomized ? (item.product.customizationFeePaise || 0) : 0;
      const primaryImage =
        (item.product.galleryImages && item.product.galleryImages[0]?.url) ||
        (Array.isArray(item.product.images) ? (item.product.images as string[])[0] : null) ||
        '/assets/snappy-gifts.png';

      return {
        id: item.id,
        cartId: item.cartId,
        productId: item.productId,
        productName: item.product.name,
        productSlug: item.product.slug,
        productType: item.product.productType || 'REGULAR',
        productImage: primaryImage,
        variantId: item.variantId,
        variantName: item.variant?.name || null,
        sku: item.variant?.sku || item.product.slug,
        unitPricePaise: unitPrice,
        quantity: item.quantity,
        lineSubtotalPaise: unitPrice * item.quantity,
        isCustomized: item.isCustomized,
        customizationFeePaise: customFee,
        customizationData: item.customizationData,
        uploads: item.uploads.map((u) => ({
          id: u.id,
          fileKey: u.fileKey,
          originalFilename: u.originalFilename,
          mimeType: u.mimeType,
          sizeBytes: u.sizeBytes,
        })),
      };
    });

    const itemsSubtotalPaise = itemsDTO.reduce((acc, it) => acc + it.lineSubtotalPaise, 0);
    const customizationTotalPaise = itemsDTO.reduce(
      (acc, it) => acc + it.customizationFeePaise * it.quantity,
      0
    );
    const itemCount = itemsDTO.reduce((acc, it) => acc + it.quantity, 0);

    return {
      id: cart.id,
      userId: cart.userId,
      sessionToken: cart.sessionToken,
      items: itemsDTO,
      itemCount,
      itemsSubtotalPaise,
      customizationTotalPaise,
      estimatedTotalPaise: itemsSubtotalPaise + customizationTotalPaise,
      updatedAt: cart.updatedAt.toISOString(),
    };
  } catch (err: any) {
    if (err instanceof CartError) throw err;
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database offline during cart summary calculation.');
    }

    // Dev Fallback
    const rawItems: any[] = Array.from(DEV_CART_ITEMS.values()).filter(
      (it) => it.cartId === cartInfo.id
    );

    const itemsDTO: CartItemDTO[] = rawItems.map((item) => {
      const prod = INITIAL_PRODUCTS.find((p) => p.id === item.productId) || {
        name: 'Curated Gift Item',
        slug: 'curated-gift-item',
        basePrice: 1299,
        images: ['/assets/snappy-gifts.png'],
      };
      const unitPricePaise = Math.round(prod.basePrice * 100);
      const customFeePaise = item.isCustomized ? 15000 : 0;

      return {
        id: item.id,
        cartId: item.cartId,
        productId: item.productId,
        productName: prod.name,
        productSlug: prod.slug || 'curated-gift',
        productType: item.isCustomized ? 'CUSTOMIZABLE' : 'REGULAR',
        productImage: prod.images?.[0] || '/assets/snappy-gifts.png',
        variantId: item.variantId || null,
        variantName: item.variantName || null,
        sku: item.sku || 'SKU-SNAPPY-DEV',
        unitPricePaise,
        quantity: item.quantity,
        lineSubtotalPaise: unitPricePaise * item.quantity,
        isCustomized: !!item.isCustomized,
        customizationFeePaise: customFeePaise,
        customizationData: item.customizationData || null,
        uploads: item.uploads || [],
      };
    });

    const itemsSubtotalPaise = itemsDTO.reduce((acc, it) => acc + it.lineSubtotalPaise, 0);
    const customizationTotalPaise = itemsDTO.reduce(
      (acc, it) => acc + it.customizationFeePaise * it.quantity,
      0
    );
    const itemCount = itemsDTO.reduce((acc, it) => acc + it.quantity, 0);

    return {
      id: cartInfo.id,
      userId: cartInfo.userId,
      sessionToken: cartInfo.sessionToken,
      items: itemsDTO,
      itemCount,
      itemsSubtotalPaise,
      customizationTotalPaise,
      estimatedTotalPaise: itemsSubtotalPaise + customizationTotalPaise,
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Adds an item to the persistent cart.
 * Validates product active status, variant existence, stock availability, and customization eligibility.
 */
export async function addItemToCart(input: {
  userId?: string | null;
  sessionToken?: string | null;
  productId: string;
  variantId?: string | null;
  quantity?: number;
  isCustomized?: boolean;
  customizationData?: any;
  uploadIds?: string[];
}): Promise<CartSummaryDTO> {
  const qty = typeof input.quantity === 'number' && input.quantity > 0 ? input.quantity : 1;
  const cartInfo = await getOrCreateCart(input.userId, input.sessionToken);

  try {
    // 1. Authoritatively verify product
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
      include: { variants: true },
    });

    if (!product || !product.isActive || product.isArchived) {
      throw new CartError('Product is not available for purchase.', 404);
    }

    if (input.isCustomized && !product.isCustomizable) {
      throw new CartError(`Product "${product.name}" is not eligible for customization.`, 400);
    }

    // 2. Authoritatively verify variant if specified
    let selectedVariant: any = null;
    if (input.variantId) {
      selectedVariant = product.variants.find((v) => v.id === input.variantId);
      if (!selectedVariant || !selectedVariant.isActive || selectedVariant.isArchived) {
        throw new CartError('Selected product variant is not available.', 404);
      }
      if (selectedVariant.stockQuantity < qty) {
        throw new CartError(
          `Insufficient stock for "${selectedVariant.name}". Only ${selectedVariant.stockQuantity} available.`,
          400
        );
      }
    }

    // 3. Check for existing identical item in cart (same product, same variant, same customized flag)
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cartInfo.id,
        productId: input.productId,
        variantId: input.variantId || null,
        isCustomized: !!input.isCustomized,
      },
    });

    let targetItemId: string;

    if (existingItem) {
      const newQuantity = existingItem.quantity + qty;
      if (selectedVariant && selectedVariant.stockQuantity < newQuantity) {
        throw new CartError(
          `Cannot add more. Stock limit of ${selectedVariant.stockQuantity} reached.`,
          400
        );
      }
      const updated = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQuantity,
          customizationData: input.customizationData
            ? input.customizationData
            : existingItem.customizationData,
        },
      });
      targetItemId = updated.id;
    } else {
      const created = await prisma.cartItem.create({
        data: {
          cartId: cartInfo.id,
          productId: input.productId,
          variantId: input.variantId || null,
          quantity: qty,
          isCustomized: !!input.isCustomized,
          customizationData: input.customizationData || null,
        },
      });
      targetItemId = created.id;
    }

    // 4. Attach any provided upload IDs
    if (Array.isArray(input.uploadIds) && input.uploadIds.length > 0) {
      await prisma.artworkUpload.updateMany({
        where: { id: { in: input.uploadIds } },
        data: {
          cartItemId: targetItemId,
          status: 'ATTACHED',
        },
      });
    }

    return getCartSummary(input.userId, input.sessionToken);
  } catch (err: any) {
    if (err instanceof CartError) throw err;
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database offline during add to cart.');
    }

    // Dev Fallback
    const existingKey = `${cartInfo.id}:${input.productId}:${input.variantId || 'novar'}:${!!input.isCustomized}`;
    const existing = DEV_CART_ITEMS.get(existingKey);
    if (existing) {
      existing.quantity += qty;
      if (input.customizationData) existing.customizationData = input.customizationData;
    } else {
      const newItem = {
        id: `dev-item-${crypto.randomBytes(6).toString('hex')}`,
        cartId: cartInfo.id,
        productId: input.productId,
        variantId: input.variantId || null,
        quantity: qty,
        isCustomized: !!input.isCustomized,
        customizationData: input.customizationData || null,
        uploads: [],
      };
      DEV_CART_ITEMS.set(existingKey, newItem);
    }

    return getCartSummary(input.userId, input.sessionToken);
  }
}

/**
 * Updates cart item quantity. If quantity <= 0, item is deleted.
 */
export async function updateCartItemQuantity(input: {
  userId?: string | null;
  sessionToken?: string | null;
  cartItemId: string;
  quantity: number;
}): Promise<CartSummaryDTO> {
  const cartInfo = await getOrCreateCart(input.userId, input.sessionToken);

  try {
    const item = await prisma.cartItem.findUnique({
      where: { id: input.cartItemId },
      include: { variant: true },
    });

    if (!item || item.cartId !== cartInfo.id) {
      throw new CartError('Cart item not found or does not belong to active cart.', 404);
    }

    if (input.quantity <= 0) {
      await prisma.cartItem.delete({
        where: { id: input.cartItemId },
      });
    } else {
      if (item.variant && item.variant.stockQuantity < input.quantity) {
        throw new CartError(
          `Cannot increase quantity. Available stock is ${item.variant.stockQuantity}.`,
          400
        );
      }
      await prisma.cartItem.update({
        where: { id: input.cartItemId },
        data: { quantity: input.quantity },
      });
    }

    return getCartSummary(input.userId, input.sessionToken);
  } catch (err: any) {
    if (err instanceof CartError) throw err;
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database offline during cart update.');
    }

    // Dev Fallback
    for (const [key, item] of DEV_CART_ITEMS.entries()) {
      if (item.id === input.cartItemId && item.cartId === cartInfo.id) {
        if (input.quantity <= 0) {
          DEV_CART_ITEMS.delete(key);
        } else {
          item.quantity = input.quantity;
        }
        break;
      }
    }

    return getCartSummary(input.userId, input.sessionToken);
  }
}

/**
 * Removes an item from the cart.
 */
export async function removeCartItem(input: {
  userId?: string | null;
  sessionToken?: string | null;
  cartItemId: string;
}): Promise<CartSummaryDTO> {
  return updateCartItemQuantity({ ...input, quantity: 0 });
}

/**
 * Clears all items from the cart.
 */
export async function clearCart(
  userId?: string | null,
  sessionToken?: string | null
): Promise<CartSummaryDTO> {
  const cartInfo = await getOrCreateCart(userId, sessionToken);

  try {
    await prisma.cartItem.deleteMany({
      where: { cartId: cartInfo.id },
    });
    return getCartSummary(userId, sessionToken);
  } catch (err: any) {
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database offline during clear cart.');
    }

    for (const [key, item] of DEV_CART_ITEMS.entries()) {
      if (item.cartId === cartInfo.id) {
        DEV_CART_ITEMS.delete(key);
      }
    }

    return getCartSummary(userId, sessionToken);
  }
}

/**
 * Merges an anonymous guest session cart into an authenticated customer cart upon login.
 */
export async function mergeGuestCartIntoUserCart(
  userId: string,
  guestSessionToken: string
): Promise<CartSummaryDTO> {
  if (!userId || !guestSessionToken) {
    throw new CartError('Both userId and guestSessionToken required for cart merge.', 400);
  }

  try {
    const guestCart = await prisma.cart.findUnique({
      where: { sessionToken: guestSessionToken },
      include: { items: true },
    });

    if (!guestCart || guestCart.items.length === 0) {
      return getCartSummary(userId, null);
    }

    const userCart = await getOrCreateCart(userId, null);

    for (const gItem of guestCart.items) {
      const existingUserItem = await prisma.cartItem.findFirst({
        where: {
          cartId: userCart.id,
          productId: gItem.productId,
          variantId: gItem.variantId,
          isCustomized: gItem.isCustomized,
        },
      });

      if (existingUserItem) {
        await prisma.cartItem.update({
          where: { id: existingUserItem.id },
          data: {
            quantity: existingUserItem.quantity + gItem.quantity,
          },
        });
        // Relink any uploads to the existing user cart item
        await prisma.artworkUpload.updateMany({
          where: { cartItemId: gItem.id },
          data: { cartItemId: existingUserItem.id },
        });
      } else {
        const newItem = await prisma.cartItem.create({
          data: {
            cartId: userCart.id,
            productId: gItem.productId,
            variantId: gItem.variantId,
            quantity: gItem.quantity,
            isCustomized: gItem.isCustomized,
            customizationData: gItem.customizationData as any,
          },
        });
        await prisma.artworkUpload.updateMany({
          where: { cartItemId: gItem.id },
          data: { cartItemId: newItem.id },
        });
      }
    }

    // Clean up empty guest cart
    await prisma.cart.delete({
      where: { id: guestCart.id },
    });

    return getCartSummary(userId, null);
  } catch (err: any) {
    if (process.env.NODE_ENV === 'production' || !isStorefrontFallbackAllowed()) {
      throw new CatalogDatabaseError('Database offline during cart merge.');
    }
    return getCartSummary(userId, null);
  }
}

