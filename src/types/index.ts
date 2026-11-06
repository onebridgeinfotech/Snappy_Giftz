export type UserRole = 
  | 'b2c_customer' 
  | 'b2b_client' 
  | 'corporate_procurement' 
  | 'admin' 
  | 'warehouse_staff' 
  | 'sales_rep';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  organization?: Organization;
  savedAddresses: Address[];
}

export interface Organization {
  id: string;
  companyName: string;
  gstin: string;
  businessEmail: string;
  contactPerson: string;
  phone: string;
  industry: string;
  annualBudget: string;
  creditLimit: number;
  creditUsed: number;
  approved: boolean;
  department?: string;
}

export interface Address {
  id: string;
  name: string;
  company?: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  isDefault?: boolean;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  attributes: Record<string, string>; // e.g. { Color: 'Rose Gold', Size: 'Large' }
}

export interface BulkPricingTier {
  minQty: number;
  maxQty?: number;
  discountPercentage: number;
  pricePerUnit: number;
}

export type ProductType = 'REGULAR' | 'CUSTOMIZABLE';

export interface Product {
  id: string;
  slug?: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  subCategory?: string;
  productType?: 'REGULAR' | 'CUSTOMIZABLE';
  occasion: string[];
  recipient: string[];
  basePrice: number;
  mrp: number;
  hsnCode: string;
  taxRate: number; // e.g. 18 for 18% GST
  rating: number;
  reviewsCount: number;
  images: string[];
  isCustomizable: boolean;
  customizationType?: 'engraving' | 'photo' | 'logo' | 'combo';
  customizationFields?: {
    label: string;
    type: 'text' | 'image' | 'select';
    placeholder?: string;
    maxLength?: number;
  }[];
  isB2BRecommended?: boolean;
  minOrderQty?: number;
  bulkTiers?: BulkPricingTier[];
  stock: number;
  sku: string;
  warehouseLocation: string;
  dimensions?: string;
  weight?: string;
  estimatedDispatchDays: number;
  badge?: 'Best Seller' | 'Trending' | 'Handcrafted' | 'Corporate Pick' | 'New Arrival';
}

export interface CustomizationOption {
  personalizationType?: 'TEXT_ENGRAVING' | 'PHOTO_PRINT' | 'LOGO_BRANDING' | 'BESPOKE_COMBO';
  engravedText?: string;
  fontFamily?: string;
  photoUrl?: string;
  companyLogoUrl?: string;
  giftNote?: string;
  ribbonColor?: string;
  boxWrapStyle?: string;
  waxSealColor?: string;
  specialInstructions?: string;
  artworkUploadId?: string;
  artworkPreviewUrl?: string;
  artworkFilename?: string;
  artworkUploadIds?: string[];
  artworkUploads?: Array<{
    id: string;
    originalFilename: string;
    previewUrl?: string;
  }>;
  cropSettings?: {
    x: number;
    y: number;
    width: number;
    height: number;
    zoom?: number;
    rotation?: number;
  };
  placementSettings?: {
    position?: string;
    scale?: number;
    offsetX?: number;
    offsetY?: number;
  };
  proofApproved?: boolean;
  proofVersion?: number;
  clientProofDataUrl?: string;
  requireProof?: boolean;
  giftWrap?: boolean;
}

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  variant?: ProductVariant;
  quantity: number;
  unitPrice: number;
  customization?: CustomizationOption;
  isGiftWrapped?: boolean;
  isCorporateBulk?: boolean;
  recipientList?: BulkRecipient[];
}

export interface BulkRecipient {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  customGiftNote?: string;
  department?: string;
  status?: 'Pending' | 'Ready' | 'Dispatched' | 'Delivered';
  awbNumber?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  date: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  type: 'B2C' | 'B2B';
  organizationName?: string;
  gstin?: string;
  items: CartItem[];
  shippingAddress: Address;
  subtotal: number;
  discountTotal: number;
  couponApplied?: string;
  taxTotal: number; // GST (CGST + SGST or IGST)
  shippingTotal: number;
  grandTotal: number;
  paymentMethod: 'UPI' | 'Razorpay' | 'CreditCard' | 'CorporateCredit' | 'PurchaseOrder' | 'COD';
  paymentStatus: 'Paid' | 'Pending Verification' | 'Net30 Approved' | 'Refunded';
  orderStatus: 
    | 'Order Placed' 
    | 'Artwork Approval' 
    | 'In Customization' 
    | 'Quality Check' 
    | 'Dispatched' 
    | 'In Transit' 
    | 'Delivered';
  awbNumber?: string;
  courierPartner?: string;
  trackingUrl?: string;
  estimatedDeliveryDate: string;
  bulkRecipientsCount?: number;
}

export interface CorporateQuotation {
  id: string;
  rfqNumber: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  gstin: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
    customizationNote: string;
  }[];
  subtotal: number;
  negotiatedDiscountPercent: number;
  taxAmount: number;
  shippingAmount: number;
  grandTotal: number;
  validUntil: string;
  status: 'Draft' | 'Sent for Review' | 'Customer Accepted' | 'Converted to PO' | 'Rejected';
  notes: string;
  paymentTerms: '100% Advance' | '50% Advance + 50% on Dispatch' | 'Net 30 Days Credit';
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  customerName: string;
  email: string;
  orderNumber?: string;
  subject: string;
  category: 'Order Status' | 'Personalization Issue' | 'Corporate Enquiry' | 'Damage & Return' | 'Billing';
  priority: 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Resolved';
  createdAt: string;
  messages: {
    sender: 'customer' | 'agent';
    text: string;
    time: string;
  }[];
}
