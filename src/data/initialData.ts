import { Product, CorporateQuotation, Order, SupportTicket } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Royale Gold-Rim Ceramic Mug & Warmer Set',
    tagline: 'Custom laser engraved with recipient name or corporate monogram',
    description: 'Handcrafted ceramic mug featuring 24K gold lustre rim, matching saucer, and USB thermostatic electric warmer base. Keeps beverages at a steady 55°C. Includes gold stirring spoon and luxury gift box.',
    category: 'Personalized Gifts',
    subCategory: 'Custom Drinkware',
    occasion: ['Birthday', 'Corporate', 'Anniversary', 'Farewell'],
    recipient: ['For Him', 'For Her', 'Colleague', 'Boss'],
    basePrice: 1299,
    mrp: 1999,
    hsnCode: '69120010',
    taxRate: 18,
    rating: 4.9,
    reviewsCount: 342,
    images: [
      '/assets/categories/personalized.jpg',
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?auto=format&fit=crop&w=800&q=80'
    ],
    productType: 'CUSTOMIZABLE',
    isCustomizable: true,
    customizationType: 'engraving',
    customizationFields: [
      { label: 'Name or Monogram to Engrave', type: 'text', placeholder: 'e.g. Advait Sharma or Good Vibes Only', maxLength: 25 },
      { label: 'Engraving Typography Style', type: 'select', placeholder: 'Calligraphy Script / Classic Serif' }
    ],
    isB2BRecommended: true,
    minOrderQty: 1,
    bulkTiers: [
      { minQty: 20, maxQty: 49, discountPercentage: 15, pricePerUnit: 1104 },
      { minQty: 50, maxQty: 199, discountPercentage: 25, pricePerUnit: 974 },
      { minQty: 200, discountPercentage: 35, pricePerUnit: 844 }
    ],
    stock: 180,
    sku: 'AJM-MUG-001',
    warehouseLocation: 'Hyderabad Central Warehouse',
    dimensions: '12 x 9 x 10 cm',
    weight: '650g',
    estimatedDispatchDays: 1,
    badge: 'Best Seller'
  },
  {
    id: 'prod-2',
    name: 'Executive Vegan Leather Desk Organizer & Tech Mat',
    tagline: 'Custom foil stamped corporate or personal initials with wireless charging slot',
    description: 'Crafted from premium waterproof Saffiano vegan leather with contrast stitching. Features dedicated wireless 15W smartphone fast-charging dock, pen groove, document sleeve, and mouse glide zone.',
    category: 'Stationery & Desk',
    subCategory: 'Corporate Merchandise',
    occasion: ['Corporate', 'Promotion', 'New Job', 'Festive'],
    recipient: ['Colleague', 'Boss', 'Clients', 'For Him'],
    basePrice: 2499,
    mrp: 3499,
    hsnCode: '42023290',
    taxRate: 18,
    rating: 4.8,
    reviewsCount: 189,
    images: [
      '/assets/categories/stationery.jpg',
      'https://images.unsplash.com/photo-1585336261026-6b2f155990ee?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80'
    ],
    productType: 'CUSTOMIZABLE',
    isCustomizable: true,
    customizationType: 'logo',
    customizationFields: [
      { label: 'Company Logo or Name', type: 'text', placeholder: 'e.g. Infosys / TCS or Rohan K.', maxLength: 30 },
      { label: 'Foil Stamp Color', type: 'select', placeholder: 'Champagne Gold / Silver Chrome / Blind Deboss' }
    ],
    isB2BRecommended: true,
    minOrderQty: 5,
    bulkTiers: [
      { minQty: 10, maxQty: 49, discountPercentage: 18, pricePerUnit: 2049 },
      { minQty: 50, maxQty: 99, discountPercentage: 28, pricePerUnit: 1799 },
      { minQty: 100, discountPercentage: 38, pricePerUnit: 1549 }
    ],
    stock: 450,
    sku: 'AJM-LEATH-042',
    warehouseLocation: 'Jaipur Logistics Hub',
    dimensions: '80 x 40 x 0.4 cm',
    weight: '820g',
    estimatedDispatchDays: 2,
    badge: 'Corporate Pick'
  },
  {
    id: 'prod-3',
    name: 'Nawabi Heritage Scented Candle & Brass Lantern Hamper',
    tagline: 'Pure soy wax candle hand-poured in etched antique brass with rose & sandalwood',
    description: 'Inspired by the regal heritage of Rajasthan. Includes hand-cast brass lattice lantern with warm tea-light glow, 200g pure soy wax artisanal candle infused with Pushkar damask rose & Mysore sandalwood, match strike bottle, and gourmet roasted almonds.',
    category: 'Home Decor',
    subCategory: 'Luxury Hampers',
    occasion: ['Diwali', 'Wedding', 'Housewarming', 'Anniversary'],
    recipient: ['Family', 'For Her', 'Parents', 'Clients'],
    basePrice: 3299,
    mrp: 4500,
    hsnCode: '34060010',
    taxRate: 18,
    rating: 5.0,
    reviewsCount: 214,
    images: [
      '/assets/categories/homedecor.jpg',
      'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1543257580-7269da773bf5?auto=format&fit=crop&w=800&q=80'
    ],
    productType: 'REGULAR',
    isCustomizable: false,
    isB2BRecommended: true,
    minOrderQty: 1,
    bulkTiers: [
      { minQty: 15, maxQty: 49, discountPercentage: 15, pricePerUnit: 2804 },
      { minQty: 50, discountPercentage: 25, pricePerUnit: 2474 }
    ],
    stock: 85,
    sku: 'AJM-DECOR-891',
    warehouseLocation: 'Hyderabad Central Warehouse',
    dimensions: '25 x 25 x 15 cm',
    weight: '1.4kg',
    estimatedDispatchDays: 1,
    badge: 'Handcrafted'
  },
  {
    id: 'prod-4',
    name: 'Backlit Acrylic 3D Spotify Music & Photo Plaque',
    tagline: 'Custom acrylic frame with your favourite song code and memorable photo',
    description: 'High-definition UV printed clear acrylic crystal plaque mounted on a solid beechwood LED illuminated base. Scannable Spotify code plays your special memory tune instantly from any phone.',
    category: 'Personalized Gifts',
    subCategory: 'Photo Keepsakes',
    occasion: ['Anniversary', 'Valentine', 'Birthday', 'Farewell'],
    recipient: ['For Her', 'For Him', 'Best Friend', 'Couple'],
    basePrice: 899,
    mrp: 1499,
    hsnCode: '39269099',
    taxRate: 18,
    rating: 4.9,
    reviewsCount: 512,
    images: [
      'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80'
    ],
    productType: 'CUSTOMIZABLE',
    isCustomizable: true,
    customizationType: 'photo',
    customizationFields: [
      { label: 'Song Title & Artist', type: 'text', placeholder: 'e.g. Kesariya - Arijit Singh', maxLength: 40 },
      { label: 'Couple / Recipient Names', type: 'text', placeholder: 'e.g. Priya & Karan', maxLength: 30 },
      { label: 'Upload Cherished Photo', type: 'image', placeholder: 'Select high-res image for UV print' }
    ],
    isB2BRecommended: false,
    minOrderQty: 1,
    stock: 220,
    sku: 'AJM-PLAQUE-009',
    warehouseLocation: 'Hyderabad Central Warehouse',
    dimensions: '18 x 22 x 4 cm',
    weight: '450g',
    estimatedDispatchDays: 1,
    badge: 'Trending'
  },
  {
    id: 'prod-5',
    name: 'Day-One Employee Welcome Onboarding Kit (Box of 6)',
    tagline: 'Complete branded kit: Insulated tumbler, diary, metal stylus pen, badge, keychain & chocolates',
    description: 'Turn employee day-one into an unforgettable celebration. Custom matte-finish magnetic closure rigid box featuring company branding, 500ml double-wall temperature flask with digital LED readout, hardbound notebook with ribbon bookmark, metal pen, metal keychain, and Ferrero Rocher 4-pack.',
    category: 'Corporate Kits',
    subCategory: 'Employee Onboarding',
    occasion: ['Corporate', 'New Joinee', 'Rewards & Recognition'],
    recipient: ['Employees', 'Interns', 'Clients'],
    basePrice: 2899,
    mrp: 3999,
    hsnCode: '48201090',
    taxRate: 18,
    rating: 4.9,
    reviewsCount: 97,
    images: [
      '/assets/categories/hampers.jpg',
      'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=800&q=80'
    ],
    productType: 'CUSTOMIZABLE',
    isCustomizable: true,
    customizationType: 'combo',
    customizationFields: [
      { label: 'Company Name & Slogan', type: 'text', placeholder: 'e.g. Google Cloud / Welcome to the Team', maxLength: 45 },
      { label: 'Box Color Preference', type: 'select', placeholder: 'Midnight Matte Black / Royal Navy / Ivory Blush' }
    ],
    isB2BRecommended: true,
    minOrderQty: 10,
    bulkTiers: [
      { minQty: 10, maxQty: 49, discountPercentage: 15, pricePerUnit: 2464 },
      { minQty: 50, maxQty: 149, discountPercentage: 25, pricePerUnit: 2174 },
      { minQty: 150, discountPercentage: 35, pricePerUnit: 1884 }
    ],
    stock: 600,
    sku: 'AJM-ONBOARD-99',
    warehouseLocation: 'Delhi Hub & Fulfillment Center',
    dimensions: '32 x 26 x 11 cm',
    weight: '1.6kg',
    estimatedDispatchDays: 2,
    badge: 'Corporate Pick'
  },
  {
    id: 'prod-6',
    name: 'Vintage Roman Number Rose-Gold Desk Timepiece',
    tagline: 'Polished brushed brass clock with silent Japanese quartz movement',
    description: 'An elegant statement piece for study desks or mantlepieces. Hand-finished brass dial with delicate Roman numerals, bevelled glass lens, and silent non-ticking sweep second movement. Can be custom engraved on the back casing with retirement or congratulatory dates.',
    category: 'Luxury Gifts',
    subCategory: 'Desk & Decor',
    occasion: ['Anniversary', 'Retirement', 'Promotion', 'Wedding'],
    recipient: ['Parents', 'Boss', 'For Him', 'Grandparents'],
    basePrice: 1899,
    mrp: 2799,
    hsnCode: '91052100',
    taxRate: 18,
    rating: 4.7,
    reviewsCount: 78,
    images: [
      'https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?auto=format&fit=crop&w=800&q=80'
    ],
    productType: 'REGULAR',
    isCustomizable: false,
    isB2BRecommended: true,
    minOrderQty: 1,
    bulkTiers: [
      { minQty: 25, discountPercentage: 20, pricePerUnit: 1519 }
    ],
    stock: 75,
    sku: 'AJM-CLOCK-004',
    warehouseLocation: 'Hyderabad Central Warehouse',
    dimensions: '14 x 14 x 5 cm',
    weight: '700g',
    estimatedDispatchDays: 1,
    badge: 'New Arrival'
  },
  {
    id: 'prod-7',
    name: 'Artisan Huggable Cuddle Teddy with Embroidered Heart',
    tagline: 'Ultra-soft plush bear with custom embroidered recipient nickname or date',
    description: 'Made with baby-safe hypoallergenic plush microfibres. Features a soft blush satin ribbon bow and embroidered heart patch holding your custom embroidered message. Perfect for birthdays, baby showers, and romantic milestones.',
    category: 'Soft Toys',
    subCategory: 'Plush & Baby',
    occasion: ['Birthday', 'Valentine', 'Baby Shower', 'Get Well'],
    recipient: ['For Her', 'Kids', 'Girlfriend'],
    basePrice: 999,
    mrp: 1499,
    hsnCode: '95030030',
    taxRate: 12,
    rating: 4.9,
    reviewsCount: 420,
    images: [
      '/assets/categories/softtoys.jpg',
      'https://images.unsplash.com/photo-1559454403-b8fb88521f11?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=800&q=80'
    ],
    productType: 'CUSTOMIZABLE',
    isCustomizable: true,
    customizationType: 'engraving',
    customizationFields: [
      { label: 'Heart Embroidery Text', type: 'text', placeholder: 'e.g. Hugs from Aarav / Love You Mini', maxLength: 22 }
    ],
    isB2BRecommended: false,
    minOrderQty: 1,
    stock: 140,
    sku: 'AJM-BEAR-012',
    warehouseLocation: 'Hyderabad Central Warehouse',
    dimensions: '40 x 28 x 25 cm',
    weight: '550g',
    estimatedDispatchDays: 1,
    badge: 'Best Seller'
  },
  {
    id: 'prod-8',
    name: 'Grand Royal Gourmet Sweet & Savoury Festive Basket',
    tagline: 'Luxury wicker hamper packed with imported chocolates, dry fruits & brass diya',
    description: 'An artisanal hand-woven willow wicker basket tied with satin ribbon. Packed with roasted California pistachios, Mamra almonds, Turkish delight baklava, Lindt Excellence chocolate bars, and handcrafted brass diya with scented dhoop cones.',
    category: 'Gift Hampers',
    subCategory: 'Festive & Gourmet',
    occasion: ['Diwali', 'New Year', 'Corporate', 'Family Gathering'],
    recipient: ['Family', 'Corporate Clients', 'In-Laws', 'VIPs'],
    basePrice: 4499,
    mrp: 5999,
    hsnCode: '21069099',
    taxRate: 18,
    rating: 4.9,
    reviewsCount: 310,
    images: [
      'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1512909006721-3d6018887383?auto=format&fit=crop&w=800&q=80'
    ],
    productType: 'REGULAR',
    isCustomizable: false,
    isB2BRecommended: true,
    minOrderQty: 2,
    bulkTiers: [
      { minQty: 10, maxQty: 49, discountPercentage: 15, pricePerUnit: 3824 },
      { minQty: 50, discountPercentage: 25, pricePerUnit: 3374 }
    ],
    stock: 95,
    sku: 'AJM-HAMPER-330',
    warehouseLocation: 'Jaipur Logistics Hub',
    dimensions: '38 x 30 x 18 cm',
    weight: '2.8kg',
    estimatedDispatchDays: 1,
    badge: 'Best Seller'
  }
];

export const SERVICEABLE_PINCODES: Record<string, { city: string; state: string; days: number; expressAvailable: boolean }> = {
  '305001': { city: 'Ajmer', state: 'Rajasthan', days: 1, expressAvailable: true },
  '305002': { city: 'Ajmer (Nasirabad Rd)', state: 'Rajasthan', days: 1, expressAvailable: true },
  '305004': { city: 'Ajmer (Vaishali Nagar)', state: 'Rajasthan', days: 1, expressAvailable: true },
  '302001': { city: 'Jaipur', state: 'Rajasthan', days: 1, expressAvailable: true },
  '110001': { city: 'New Delhi (Connaught Place)', state: 'Delhi', days: 2, expressAvailable: true },
  '110016': { city: 'New Delhi (Hauz Khas)', state: 'Delhi', days: 2, expressAvailable: true },
  '122001': { city: 'Gurugram', state: 'Haryana', days: 2, expressAvailable: true },
  '201301': { city: 'Noida', state: 'Uttar Pradesh', days: 2, expressAvailable: true },
  '400001': { city: 'Mumbai (Fort)', state: 'Maharashtra', days: 2, expressAvailable: true },
  '400050': { city: 'Mumbai (Bandra)', state: 'Maharashtra', days: 2, expressAvailable: true },
  '411001': { city: 'Pune', state: 'Maharashtra', days: 2, expressAvailable: true },
  '560001': { city: 'Bengaluru (MG Road)', state: 'Karnataka', days: 2, expressAvailable: true },
  '560100': { city: 'Bengaluru (Electronic City)', state: 'Karnataka', days: 2, expressAvailable: true },
  '500001': { city: 'Hyderabad', state: 'Telangana', days: 2, expressAvailable: true },
  '600001': { city: 'Chennai', state: 'Tamil Nadu', days: 3, expressAvailable: true },
  '700001': { city: 'Kolkata', state: 'West Bengal', days: 3, expressAvailable: false },
  '380001': { city: 'Ahmedabad', state: 'Gujarat', days: 2, expressAvailable: true }
};

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-8812',
    orderNumber: 'AJM-2026-8812',
    date: '2026-10-22',
    customerName: 'Rohit Kulkarni',
    customerEmail: 'rohit.kulkarni@example.com',
    customerPhone: '+91 98201 12345',
    type: 'B2C',
    items: [
      {
        id: 'ci-1',
        productId: 'prod-1',
        product: INITIAL_PRODUCTS[0],
        quantity: 1,
        unitPrice: 1299,
        customization: {
          engravedText: 'Sneha & Rohit',
          fontFamily: 'Dancing Script',
          giftNote: 'Happy 5th Anniversary my love!',
          ribbonColor: 'Rose Gold Metallic'
        }
      }
    ],
    shippingAddress: {
      id: 'addr-1',
      name: 'Sneha Kulkarni',
      street: 'Flat 402, Sunrise Heights, Koregaon Park',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      phone: '+91 98201 12345'
    },
    subtotal: 1299,
    discountTotal: 100,
    couponApplied: 'WELCOME100',
    taxTotal: 215.82,
    shippingTotal: 0,
    grandTotal: 1414.82,
    paymentMethod: 'UPI',
    paymentStatus: 'Paid',
    orderStatus: 'In Transit',
    awbNumber: 'BLUEDART-8829103',
    courierPartner: 'BlueDart Express',
    estimatedDeliveryDate: '2026-10-25'
  },
  {
    id: 'ord-9041',
    orderNumber: 'CORP-AJM-2026-9041',
    date: '2026-10-20',
    customerName: 'Ananya Deshmukh',
    customerEmail: 'ananya.d@novatech.co.in',
    customerPhone: '+91 98110 55443',
    type: 'B2B',
    organizationName: 'NovaTech Solutions Pvt Ltd',
    gstin: '27AABCN8891P1ZX',
    items: [
      {
        id: 'ci-2',
        productId: 'prod-5',
        product: INITIAL_PRODUCTS[4],
        quantity: 65,
        unitPrice: 2174,
        isCorporateBulk: true,
        customization: {
          engravedText: 'NovaTech Q4 Stars',
          companyLogoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80',
          boxWrapStyle: 'Midnight Matte with Golden Hot-foil Seal'
        }
      }
    ],
    shippingAddress: {
      id: 'addr-2',
      name: 'Procurement Dept - NovaTech',
      company: 'NovaTech Solutions Pvt Ltd',
      street: '7th Floor, Cyber City, DLF Phase 2',
      city: 'Gurugram',
      state: 'Haryana',
      pincode: '122001',
      phone: '+91 98110 55443'
    },
    subtotal: 141310,
    discountTotal: 0,
    taxTotal: 25435.80,
    shippingTotal: 0,
    grandTotal: 166745.80,
    paymentMethod: 'CorporateCredit',
    paymentStatus: 'Net30 Approved',
    orderStatus: 'Quality Check',
    awbNumber: 'DELHIVERY-CORP-91024',
    courierPartner: 'Delhivery Surface Logistics',
    estimatedDeliveryDate: '2026-10-27',
    bulkRecipientsCount: 65
  }
];

export const INITIAL_QUOTATIONS: CorporateQuotation[] = [
  {
    id: 'rfq-101',
    rfqNumber: 'RFQ-AJM-2026-0042',
    companyName: 'Zephyr Cloud Labs India',
    contactPerson: 'Vikramaditya Roy',
    email: 'procurement@zephyrcloud.io',
    phone: '+91 98450 67890',
    gstin: '29AAACZ9901M1ZQ',
    items: [
      {
        productId: 'prod-2',
        productName: 'Executive Vegan Leather Desk Organizer & Tech Mat',
        quantity: 120,
        unitPrice: 1549,
        total: 185880,
        customizationNote: 'Deboss Zephyr logo in Champagne gold. Gift wrapped in luxury charcoal paper.'
      },
      {
        productId: 'prod-1',
        productName: 'Royale Gold-Rim Ceramic Mug & Warmer Set',
        quantity: 120,
        unitPrice: 844,
        total: 101280,
        customizationNote: 'Individual employee names laser etched on mugs.'
      }
    ],
    subtotal: 287160,
    negotiatedDiscountPercent: 5,
    taxAmount: 49104.36,
    shippingAmount: 0,
    grandTotal: 321906.36,
    validUntil: '2026-11-15',
    status: 'Sent for Review',
    notes: 'Includes individual packaging, personalized greeting card, and direct split dispatch across 4 branch offices.',
    paymentTerms: '50% Advance + 50% on Dispatch',
    createdAt: '2026-10-23'
  }
];

export const INITIAL_TICKETS: SupportTicket[] = [
  {
    id: 'tkt-1',
    ticketNumber: 'TKT-2026-302',
    customerName: 'Meera Sen',
    email: 'meera.sen@gmail.com',
    orderNumber: 'AJM-2026-8812',
    subject: 'Request to update gift message note on mug order',
    category: 'Personalization Issue',
    priority: 'Medium',
    status: 'In Progress',
    createdAt: '2026-10-23',
    messages: [
      { sender: 'customer', text: 'Hi team, can I add "Forever & Always" below Sneha & Rohit?', time: '10:15 AM' },
      { sender: 'agent', text: 'Sure Meera! We have relayed this to our SNAPPY GIFTZ engraving unit before final laser etching.', time: '10:45 AM' }
    ]
  }
];
