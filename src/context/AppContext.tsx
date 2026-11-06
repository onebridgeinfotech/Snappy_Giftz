'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Product,
  CartItem,
  Order,
  CorporateQuotation,
  UserRole,
  Organization,
  SupportTicket,
  Address,
  BulkRecipient,
  CustomizationOption
} from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
  INITIAL_QUOTATIONS,
  INITIAL_TICKETS,
  SERVICEABLE_PINCODES
} from '../data/initialData';

interface AppContextType {
  mode: 'b2c' | 'b2b' | 'admin';
  setMode: (mode: 'b2c' | 'b2b' | 'admin') => void;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  
  // Products
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  selectedProduct: Product | null;
  setSelectedProduct: (p: Product | null) => void;
  
  // Cart & Wishlist
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, customization?: CustomizationOption, isCorporateBulk?: boolean, bulkRecipients?: BulkRecipient[], isGiftWrapped?: boolean) => void;
  updateCartQuantity: (cartItemId: string, quantity: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  toggleItemGiftWrap: (cartItemId: string) => void;
  updateCartItemCustomization: (cartItemId: string, customization: CustomizationOption) => void;
  setBulkRecipientsForCartItem: (cartItemId: string, recipients: BulkRecipient[]) => void;
  
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  
  // Coupon
  appliedCoupon: string | null;
  couponDiscount: number;
  applyCoupon: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;
  
  // PIN code checker
  checkPincode: (pin: string) => { serviceable: boolean; city?: string; state?: string; days?: number; message: string };
  currentPincode: string;
  setCurrentPincode: (pin: string) => void;
  
  // Orders
  orders: Order[];
  createOrder: (orderData: Omit<Order, 'id' | 'orderNumber' | 'date'>) => Order;
  updateOrderStatus: (orderId: string, status: Order['orderStatus'], awb?: string) => void;
  selectedOrder: Order | null;
  setSelectedOrder: (order: Order | null) => void;
  
  // Quotations (B2B)
  quotations: CorporateQuotation[];
  createQuotation: (rfq: Omit<CorporateQuotation, 'id' | 'rfqNumber' | 'createdAt'>) => CorporateQuotation;
  updateQuotationStatus: (id: string, status: CorporateQuotation['status'], notes?: string) => void;
  selectedQuotation: CorporateQuotation | null;
  setSelectedQuotation: (q: CorporateQuotation | null) => void;
  
  // Corporate Org Info
  organization: Organization;
  updateOrganization: (orgUpdates: Partial<Organization>) => void;
  
  // Support Tickets
  tickets: SupportTicket[];
  addTicket: (subject: string, category: SupportTicket['category'], message: string, orderNumber?: string) => void;
  addTicketReply: (ticketId: string, text: string, sender: 'customer' | 'agent') => void;
  
  // UI Navigation & Modals
  activeModal: 'none' | 'cart' | 'wishlist' | 'checkout' | 'product_detail' | 'personalize' | 'rfq' | 'order_track' | 'invoice_view' | 'onboarding';
  setActiveModal: (m: 'none' | 'cart' | 'wishlist' | 'checkout' | 'product_detail' | 'personalize' | 'rfq' | 'order_track' | 'invoice_view' | 'onboarding') => void;
  
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  activeOccasion: string;
  setActiveOccasion: (occ: string) => void;
  
  toast: { message: string; type: 'success' | 'info' | 'error' } | null;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  navigateToCatalog: (options?: { category?: string; occasion?: string; query?: string }) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_PRODUCTS = 'snappy_giftz_products_v1';
const LOCAL_STORAGE_KEY_ORDERS = 'snappy_giftz_orders_v1';
const LOCAL_STORAGE_KEY_QUOTATIONS = 'snappy_giftz_rfqs_v1';
const LOCAL_STORAGE_KEY_CART = 'snappy_giftz_cart_v1';
const LOCAL_STORAGE_KEY_WISHLIST = 'snappy_giftz_wishlist_v1';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<'b2c' | 'b2b' | 'admin'>('b2c');
  const [currentRole, setCurrentRole] = useState<UserRole>('b2c_customer');
  
  const [isHydrated, setIsHydrated] = useState(false);
  
  // Safe initial state matching server-rendered markup (prevents hydration mismatch)
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [quotations, setQuotations] = useState<CorporateQuotation[]>(INITIAL_QUOTATIONS);

  // Restore persisted state from localStorage once client has hydrated (prevents SSR hydration errors)
  useEffect(() => {
    try {
      const savedProducts = localStorage.getItem(LOCAL_STORAGE_KEY_PRODUCTS);
      if (savedProducts) setProducts(JSON.parse(savedProducts));

      const savedCart = localStorage.getItem(LOCAL_STORAGE_KEY_CART);
      if (savedCart) setCart(JSON.parse(savedCart));

      const savedWishlist = localStorage.getItem(LOCAL_STORAGE_KEY_WISHLIST);
      if (savedWishlist) setWishlist(JSON.parse(savedWishlist));

      const savedOrders = localStorage.getItem(LOCAL_STORAGE_KEY_ORDERS);
      if (savedOrders) setOrders(JSON.parse(savedOrders));

      const savedQuotations = localStorage.getItem(LOCAL_STORAGE_KEY_QUOTATIONS);
      if (savedQuotations) setQuotations(JSON.parse(savedQuotations));
    } catch (e) {
      console.warn('[APP_CONTEXT] Error restoring from localStorage:', e);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  const [tickets, setTickets] = useState<SupportTicket[]>(INITIAL_TICKETS);
  
  const [organization, setOrganization] = useState<Organization>({
    id: 'org-default',
    companyName: 'NovaTech Solutions Pvt Ltd',
    gstin: '27AABCN8891P1ZX',
    businessEmail: 'procurement@novatech.co.in',
    contactPerson: 'Ananya Deshmukh',
    phone: '+91 98110 55443',
    industry: 'Information Technology & SaaS',
    annualBudget: '₹15,00,000 - ₹25,00,000',
    creditLimit: 500000,
    creditUsed: 166745.80,
    approved: true,
    department: 'People Operations & Procurement'
  });

  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [currentPincode, setCurrentPincode] = useState<string>('500062');

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedQuotation, setSelectedQuotation] = useState<CorporateQuotation | null>(null);

  const [activeModal, setActiveModal] = useState<'none' | 'cart' | 'wishlist' | 'checkout' | 'product_detail' | 'personalize' | 'rfq' | 'order_track' | 'invoice_view' | 'onboarding'>('none');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeOccasion, setActiveOccasion] = useState('All');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Sync state to localStorage only after client hydration
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_PRODUCTS, JSON.stringify(products));
    } catch (e) {
      console.error(e);
    }
  }, [products, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_CART, JSON.stringify(cart));
    } catch (e) {
      console.error(e);
    }
  }, [cart, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_WISHLIST, JSON.stringify(wishlist));
    } catch (e) {
      console.error(e);
    }
  }, [wishlist, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_ORDERS, JSON.stringify(orders));
    } catch (e) {
      console.error(e);
    }
  }, [orders, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_QUOTATIONS, JSON.stringify(quotations));
    } catch (e) {
      console.error(e);
    }
  }, [quotations, isHydrated]);

  // Product mutations
  const addProduct = (p: Omit<Product, 'id'>) => {
    const newProduct: Product = {
      ...p,
      id: `prod-${Date.now()}`
    };
    setProducts(prev => [newProduct, ...prev]);
    showToast(`Added product "${newProduct.name}" to catalog!`);
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    showToast('Product updated successfully.');
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    showToast('Product removed from catalog.', 'info');
  };

  // Wishlist
  const toggleWishlist = (productId: string) => {
    setWishlist(prev => {
      if (prev.includes(productId)) {
        showToast('Removed from wishlist', 'info');
        return prev.filter(id => id !== productId);
      } else {
        showToast('Saved to your wishlist ❤️');
        return [...prev, productId];
      }
    });
  };

  // Cart operations with tiered bulk pricing support
  const calculateUnitPrice = (product: Product, quantity: number, isBulk?: boolean): number => {
    if (!isBulk || !product.bulkTiers || product.bulkTiers.length === 0) {
      return product.basePrice;
    }
    // Find matching bulk tier
    for (const tier of [...product.bulkTiers].reverse()) {
      if (quantity >= tier.minQty) {
        return tier.pricePerUnit;
      }
    }
    return product.basePrice;
  };

  const addToCart = (
    product: Product, 
    quantity: number = 1, 
    customization?: CustomizationOption, 
    isCorporateBulk: boolean = false,
    bulkRecipients?: BulkRecipient[],
    isGiftWrapped?: boolean
  ) => {
    const finalGiftWrap = Boolean(isGiftWrapped || customization?.giftWrap);
    setCart(prev => {
      const unitPrice = calculateUnitPrice(product, quantity, isCorporateBulk);
      // Check if identical item already in cart
      const existingIndex = prev.findIndex(item => 
        item.productId === product.id && 
        JSON.stringify(item.customization) === JSON.stringify(customization) &&
        item.isCorporateBulk === isCorporateBulk &&
        Boolean(item.isGiftWrapped || item.customization?.giftWrap) === finalGiftWrap
      );

      if (existingIndex > -1) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + quantity;
        updated[existingIndex].quantity = newQty;
        updated[existingIndex].unitPrice = calculateUnitPrice(product, newQty, isCorporateBulk);
        if (bulkRecipients) {
          updated[existingIndex].recipientList = bulkRecipients;
        }
        return updated;
      } else {
        const newItem: CartItem = {
          id: `ci-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          productId: product.id,
          product,
          quantity,
          unitPrice,
          customization,
          isGiftWrapped: finalGiftWrap,
          isCorporateBulk,
          recipientList: bulkRecipients
        };
        return [...prev, newItem];
      }
    });
    showToast(`Added ${product.name} to cart!`);
  };

  const toggleItemGiftWrap = (cartItemId: string) => {
    setCart(prev => prev.map(item => {
      if (item.id === cartItemId) {
        const currentWrapped = Boolean(item.isGiftWrapped || item.customization?.giftWrap);
        const newWrapped = !currentWrapped;
        return {
          ...item,
          isGiftWrapped: newWrapped,
          customization: item.customization ? { ...item.customization, giftWrap: newWrapped } : undefined,
        };
      }
      return item;
    }));
  };

  const updateCartQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setCart(prev => prev.map(item => {
      if (item.id === cartItemId) {
        const newUnitPrice = calculateUnitPrice(item.product, quantity, item.isCorporateBulk);
        return {
          ...item,
          quantity,
          unitPrice: newUnitPrice
        };
      }
      return item;
    }));
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(prev => prev.filter(item => item.id !== cartItemId));
    showToast('Item removed from cart', 'info');
  };

  const clearCart = () => {
    setCart([]);
    setAppliedCoupon(null);
    setCouponDiscount(0);
  };

  const updateCartItemCustomization = (cartItemId: string, customization: CustomizationOption) => {
    setCart(prev => prev.map(item => item.id === cartItemId ? { ...item, customization } : item));
    showToast('Customization details updated');
  };

  const setBulkRecipientsForCartItem = (cartItemId: string, recipients: BulkRecipient[]) => {
    setCart(prev => prev.map(item => {
      if (item.id === cartItemId) {
        const qty = recipients.length || item.quantity;
        const newPrice = calculateUnitPrice(item.product, qty, true);
        return {
          ...item,
          quantity: qty,
          unitPrice: newPrice,
          isCorporateBulk: true,
          recipientList: recipients
        };
      }
      return item;
    }));
    showToast(`Configured dispatch for ${recipients.length} recipients!`);
  };

  // Coupons
  const applyCoupon = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (clean === 'WELCOME100') {
      setAppliedCoupon(clean);
      setCouponDiscount(100);
      showToast('₹100 discount applied! 🎉');
      return { success: true, message: '₹100 discount applied!' };
    }
    if (clean === 'FESTIVE15') {
      setAppliedCoupon(clean);
      setCouponDiscount(250);
      showToast('15% festive discount activated! 🎉');
      return { success: true, message: '15% discount activated!' };
    }
    if (clean === 'CORP20') {
      setAppliedCoupon(clean);
      setCouponDiscount(500);
      showToast('Corporate partner discount applied! 🎉');
      return { success: true, message: 'Corporate discount applied!' };
    }
    return { success: false, message: 'Invalid coupon code. Try WELCOME100, FESTIVE15, or CORP20' };
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    showToast('Coupon removed', 'info');
  };

  // PIN code verification
  const checkPincode = (pin: string) => {
    const cleaned = pin.trim();
    if (SERVICEABLE_PINCODES[cleaned]) {
      const info = SERVICEABLE_PINCODES[cleaned];
      return {
        serviceable: true,
        city: info.city,
        state: info.state,
        days: info.days,
        message: `Serviceable! Estimated delivery to ${info.city}, ${info.state} in ${info.days} business ${info.days === 1 ? 'day' : 'days'}.`
      };
    }
    if (cleaned.length === 6 && /^\d+$/.test(cleaned)) {
      return {
        serviceable: true,
        city: 'Verified Postal Hub',
        state: 'India',
        days: 3,
        message: `Standard Express serviceable! Estimated 3-4 business days dispatch.`
      };
    }
    return {
      serviceable: false,
      message: 'Please enter a valid 6-digit Indian PIN code (e.g. 305001, 110001, 400001).'
    };
  };

  // Order management
  const createOrder = (orderData: Omit<Order, 'id' | 'orderNumber' | 'date'>): Order => {
    const isB2B = orderData.type === 'B2B';
    const prefix = isB2B ? 'CORP-AJM-2026' : 'AJM-2026';
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `${prefix}-${randomSeq}`;
    
    // Generate tracking AWB
    const awbPrefix = isB2B ? 'DELHIVERY-CORP' : 'BLUEDART';
    const awbNumber = `${awbPrefix}-${Math.floor(100000 + Math.random() * 900000)}`;

    const newOrder: Order = {
      ...orderData,
      id: `ord-${Date.now()}`,
      orderNumber,
      date: new Date().toISOString().split('T')[0],
      awbNumber,
      courierPartner: isB2B ? 'Delhivery Surface Logistics' : 'BlueDart Air Express'
    };

    setOrders(prev => [newOrder, ...prev]);

    // Deduct stock from inventory
    setProducts(prev => prev.map(p => {
      const orderedItem = orderData.items.find(i => i.productId === p.id);
      if (orderedItem) {
        return {
          ...p,
          stock: Math.max(0, p.stock - orderedItem.quantity)
        };
      }
      return p;
    }));

    clearCart();
    return newOrder;
  };

  const updateOrderStatus = (orderId: string, status: Order['orderStatus'], awb?: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          orderStatus: status,
          ...(awb ? { awbNumber: awb } : {})
        };
      }
      return o;
    }));
    showToast(`Order status updated to: ${status}`);
  };

  // Corporate RFQs
  const createQuotation = (rfqData: Omit<CorporateQuotation, 'id' | 'rfqNumber' | 'createdAt'>): CorporateQuotation => {
    const rfqNumber = `RFQ-AJM-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newQuotation: CorporateQuotation = {
      ...rfqData,
      id: `rfq-${Date.now()}`,
      rfqNumber,
      createdAt: new Date().toISOString().split('T')[0]
    };
    setQuotations(prev => [newQuotation, ...prev]);
    showToast(`Quotation ${rfqNumber} generated successfully!`);
    return newQuotation;
  };

  const updateQuotationStatus = (id: string, status: CorporateQuotation['status'], notes?: string) => {
    setQuotations(prev => prev.map(q => {
      if (q.id === id) {
        return {
          ...q,
          status,
          ...(notes ? { notes } : {})
        };
      }
      return q;
    }));
    showToast(`Quotation status changed to "${status}"`);
  };

  // Organization
  const updateOrganization = (orgUpdates: Partial<Organization>) => {
    setOrganization(prev => ({ ...prev, ...orgUpdates }));
    showToast('Corporate profile updated');
  };

  // Support
  const addTicket = (subject: string, category: SupportTicket['category'], message: string, orderNumber?: string) => {
    const newTicket: SupportTicket = {
      id: `tkt-${Date.now()}`,
      ticketNumber: `TKT-2026-${Math.floor(100 + Math.random() * 900)}`,
      customerName: organization.contactPerson || 'Customer',
      email: organization.businessEmail || 'customer@example.com',
      orderNumber,
      subject,
      category,
      priority: 'Medium',
      status: 'Open',
      createdAt: new Date().toISOString().split('T')[0],
      messages: [
        { sender: 'customer', text: message, time: 'Just now' }
      ]
    };
    setTickets(prev => [newTicket, ...prev]);
    showToast('Support ticket raised. Our gifting desk will respond shortly!');
  };

  const addTicketReply = (ticketId: string, text: string, sender: 'customer' | 'agent') => {
    setTickets(prev => prev.map(t => {
      if (t.id === ticketId) {
        return {
          ...t,
          messages: [...t.messages, { sender, text, time: 'Just now' }]
        };
      }
      return t;
    }));
  };

  const navigateToCatalog = (options?: { category?: string; occasion?: string; query?: string }) => {
    setMode('b2c');
    if (options?.category !== undefined) {
      setActiveCategory(options.category);
    }
    if (options?.occasion !== undefined) {
      setActiveOccasion(options.occasion);
    }
    if (options?.query !== undefined) {
      setSearchQuery(options.query);
    }

    if (typeof window !== 'undefined') {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // Slight timeout to allow React to update mode and render catalog if coming from B2B/Admin
      setTimeout(() => {
        const el = document.getElementById('catalog-section');
        if (el) {
          el.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'start'
          });
        }
      }, 60);
    }
  };

  return (
    <AppContext.Provider
      value={{
        mode,
        setMode,
        currentRole,
        setCurrentRole,
        products,
        setProducts,
        addProduct,
        updateProduct,
        deleteProduct,
        selectedProduct,
        setSelectedProduct,
        cart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        toggleItemGiftWrap,
        updateCartItemCustomization,
        setBulkRecipientsForCartItem,
        wishlist,
        toggleWishlist,
        appliedCoupon,
        couponDiscount,
        applyCoupon,
        removeCoupon,
        checkPincode,
        currentPincode,
        setCurrentPincode,
        orders,
        createOrder,
        updateOrderStatus,
        selectedOrder,
        setSelectedOrder,
        quotations,
        createQuotation,
        updateQuotationStatus,
        selectedQuotation,
        setSelectedQuotation,
        organization,
        updateOrganization,
        tickets,
        addTicket,
        addTicketReply,
        activeModal,
        setActiveModal,
        searchQuery,
        setSearchQuery,
        activeCategory,
        setActiveCategory,
        activeOccasion,
        setActiveOccasion,
        toast,
        showToast,
        navigateToCatalog
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
