import React, { useState, useEffect } from 'react';
import { Product, CustomizationOption } from '../types';
import {
  Sparkles,
  Type,
  Gift,
  Check,
  X,
  Eye,
  MessageSquareHeart,
  ShieldCheck,
  Crown,
  Palette,
  Stamp,
  Upload,
  Image as ImageIcon,
  Sliders,
  AlertCircle,
  Trash2,
  Loader2,
  CheckSquare,
  Square
} from 'lucide-react';

interface PersonalizationStudioProps {
  product: Product;
  initialCustomization?: CustomizationOption;
  onSave: (customization: CustomizationOption) => void;
  onClose: () => void;
}

export const PersonalizationStudio: React.FC<PersonalizationStudioProps> = ({
  product,
  initialCustomization,
  onSave,
  onClose
}) => {
  const [engravedText, setEngravedText] = useState(
    initialCustomization?.engravedText || 'Sneha & Rohan'
  );
  const [fontFamily, setFontFamily] = useState(
    initialCustomization?.fontFamily || 'Dancing Script'
  );
  const [giftNote, setGiftNote] = useState(
    initialCustomization?.giftNote || 'Wishing you a lifetime of joy, laughter, and celebrated memories together!'
  );
  const [ribbonColor, setRibbonColor] = useState(
    initialCustomization?.ribbonColor || 'Rose Gold Silk'
  );
  const [isCrateApproved, setIsCrateApproved] = useState<boolean>(() => {
    return (
      (typeof process !== 'undefined' &&
        (process.env.NEXT_PUBLIC_WOODEN_CRATE_SURCHARGE_APPROVED === 'true' ||
          process.env.WOODEN_CRATE_SURCHARGE_APPROVED === 'true')) ||
      false
    );
  });

  // Query server authoritative configuration endpoint to guarantee frontend/backend consistency
  useEffect(() => {
    let isMounted = true;
    fetch('/api/personalization/config')
      .then((res) => res.json())
      .then((payload) => {
        if (isMounted && payload?.success && payload?.data?.packaging?.woodenCrate) {
          setIsCrateApproved(Boolean(payload.data.packaging.woodenCrate.available));
        }
      })
      .catch(() => {
        // Safe fail-closed fallback
        if (isMounted) setIsCrateApproved(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const [boxWrapStyle, setBoxWrapStyle] = useState(() => {
    const initial = initialCustomization?.boxWrapStyle || 'Blush Pink with Gold Foil';
    if (initial.toLowerCase().includes('wooden') && !isCrateApproved) {
      return 'Blush Pink with Gold Foil';
    }
    return initial;
  });
  const [waxSealColor, setWaxSealColor] = useState<'crimson' | 'gold' | 'navy' | 'emerald'>('gold');
  const [giftWrap, setGiftWrap] = useState(Boolean(initialCustomization?.giftWrap));
  const [activeTab, setActiveTab] = useState<'engrave' | 'artwork' | 'giftnote' | 'packaging'>('engrave');

  // Batch 7: Artwork Upload, Crop & Placement State
  const [artworkUploadId, setArtworkUploadId] = useState<string | null>(
    initialCustomization?.artworkUploadId || null
  );
  const [artworkPreviewUrl, setArtworkPreviewUrl] = useState<string | null>(
    initialCustomization?.artworkPreviewUrl || null
  );
  const [artworkFilename, setArtworkFilename] = useState<string | null>(
    initialCustomization?.artworkFilename || null
  );
  const [artworkScale, setArtworkScale] = useState<number>(
    initialCustomization?.placementSettings?.scale || 1.0
  );
  const [artworkOffsetX, setArtworkOffsetX] = useState<number>(
    initialCustomization?.placementSettings?.offsetX || 0
  );
  const [artworkOffsetY, setArtworkOffsetY] = useState<number>(
    initialCustomization?.placementSettings?.offsetY || 0
  );
  const [artworkPosition, setArtworkPosition] = useState<string>(
    initialCustomization?.placementSettings?.position || 'CENTER'
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [proofApproved, setProofApproved] = useState<boolean>(
    initialCustomization?.proofApproved ?? true
  );

  const fontOptions = [
    { name: 'Dancing Script', label: 'Calligraphy Romance', className: 'font-script italic text-2xl' },
    { name: 'Playfair Display', label: 'Royal Serif Monogram', className: 'font-serif text-xl tracking-wider' },
    { name: 'Cormorant Garamond', label: 'Atelier Classic Serif', className: 'font-serif text-xl tracking-wide' },
    { name: 'Great Vibes', label: 'Flourished Script', className: 'font-script italic text-2xl' },
    { name: 'Plus Jakarta Sans', label: 'Modern Minimalist', className: 'font-sans font-bold text-lg uppercase tracking-widest' },
    { name: 'Alex Brush', label: 'Vintage Hand-Etched', className: 'font-script text-2xl' }
  ];

  const getFontCssFamily = (fontName: string) => {
    switch (fontName) {
      case 'Playfair Display':
        return "'Playfair Display', serif";
      case 'Cormorant Garamond':
        return "'Cormorant Garamond', serif";
      case 'Great Vibes':
        return "'Great Vibes', cursive";
      case 'Dancing Script':
        return "'Dancing Script', cursive";
      case 'Alex Brush':
        return "'Alex Brush', cursive";
      case 'Plus Jakarta Sans':
      default:
        return "'Plus Jakarta Sans', sans-serif";
    }
  };

  const ribbonColors = [
    { name: 'Rose Gold Silk', bg: 'bg-[#b76e79]', border: 'border-[#914d57]' },
    { name: 'Champagne Gold', bg: 'bg-[#dfba73]', border: 'border-[#b59247]' },
    { name: 'Burgundy Velvet', bg: 'bg-[#58111a]', border: 'border-[#3c0910]' },
    { name: 'Midnight Navy', bg: 'bg-[#1b2a47]', border: 'border-[#0f172a]' },
    { name: 'Emerald Forest', bg: 'bg-[#1b4332]', border: 'border-[#081c15]' }
  ];

  const waxSeals = [
    { id: 'gold', name: '24K Antique Gold', bg: 'bg-[#C5A059]', ring: 'ring-[#D4AF37]' },
    { id: 'crimson', name: 'Imperial Crimson', bg: 'bg-[#881337]', ring: 'ring-[#9F1239]' },
    { id: 'navy', name: 'Royal Peacock Navy', bg: 'bg-[#1E293B]', ring: 'ring-[#334155]' },
    { id: 'emerald', name: 'Maharani Emerald', bg: 'bg-[#064E3B]', ring: 'ring-[#047857]' }
  ];

  const boxOptions = [
    {
      id: 'Blush Pink with Gold Foil',
      label: 'Blush Pink & Gold Foil Lid',
      desc: 'Handcrafted rigid keepsake case with 24K hot-stamped gold trim',
      available: true,
    },
    {
      id: 'Midnight Matte Rigid Box',
      label: 'Midnight Matte Royal Case',
      desc: 'High-density luxury magnetic closure case with satin bed',
      available: true,
    },
    {
      id: 'Vintage Wooden Keepsake Crate',
      label: 'Artisanal Pine Wood Crate',
      desc: isCrateApproved
        ? 'Sustainably sourced pine wood slider box with brass latch (+₹150)'
        : 'Artisanal pine wood crate (+₹150) — Unavailable pending store owner price approval',
      available: isCrateApproved,
    },
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size exceeds the 5 MB limit.');
      return;
    }

    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type)) {
      setUploadError('Invalid format. Please upload JPEG, PNG, or WebP artwork.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/personalization/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Artwork upload failed.');
      }

      setArtworkUploadId(data.data.id);
      setArtworkFilename(data.data.originalFilename);
      setArtworkPreviewUrl(URL.createObjectURL(file));
    } catch (err: any) {
      setUploadError(err.message || 'Network error during artwork upload.');
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Exports the actual customer-facing preview canvas as an authentic PNG data URL.
   * Accurately captures natively decoded artwork (JPEG/PNG/WebP) and exact typography as seen by the customer.
   */
  const generateCanvasPreviewProof = async (): Promise<string | null> => {
    try {
      if (typeof document === 'undefined') return null;
      const canvas = document.createElement('canvas');
      canvas.width = 500;
      canvas.height = 380;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // 1. Dark Luxury Base & Outer Atelier Border
      ctx.fillStyle = '#08090B';
      ctx.fillRect(0, 0, 500, 380);
      ctx.fillStyle = '#D5A34A';
      ctx.fillRect(4, 4, 492, 372);
      ctx.fillStyle = '#17181C';
      ctx.fillRect(5, 5, 490, 370);

      // 2. Atelier Banner Header
      ctx.fillStyle = '#121316';
      ctx.fillRect(5, 5, 490, 32);
      ctx.fillStyle = '#F5BD48';
      ctx.font = 'bold 13px serif';
      ctx.fillText('SNAPPY ATELIER BESPOKE PROOF', 18, 26);
      ctx.fillText('v1', 460, 26);

      // 3. Product Subheader
      ctx.fillStyle = '#24252A';
      ctx.fillRect(5, 37, 490, 26);
      ctx.fillStyle = '#F1F5F9';
      ctx.font = '11px sans-serif';
      ctx.fillText(`ITEM: ${product.name.slice(0, 48)}`, 18, 54);

      // 4. Laser Bed Plate
      ctx.fillStyle = '#D5A34A';
      ctx.fillRect(25, 68, 450, 180);
      ctx.fillStyle = '#08090B';
      ctx.fillRect(28, 71, 444, 174);

      // 5. Draw Artwork if present (Browser natively decodes JPEG, PNG, and WebP!)
      if (artworkPreviewUrl) {
        try {
          const artImg = new Image();
          artImg.crossOrigin = 'anonymous';
          await new Promise<void>((resolve) => {
            artImg.onload = () => resolve();
            artImg.onerror = () => resolve();
            artImg.src = artworkPreviewUrl;
          });

          if (artImg.complete && artImg.naturalWidth > 0) {
            const scale = Math.max(0.5, Math.min(2.0, artworkScale));
            const artW = 60 * scale;
            const artH = 50 * scale;
            const artX = Math.max(35, Math.min(415, 250 + artworkOffsetX - artW / 2));
            const artY = Math.max(78, Math.min(200, 120 + artworkOffsetY - artH / 2));

            ctx.strokeStyle = '#D4AF37';
            ctx.lineWidth = 1;
            ctx.strokeRect(artX - 2, artY - 2, artW + 4, artH + 4);
            ctx.drawImage(artImg, artX, artY, artW, artH);
          }
        } catch {
          // Safe fallback
        }
      }

      // 6. Engraved Text with Exact Selected Typeface
      if (engravedText && engravedText.trim()) {
        const cleanText = engravedText.trim();
        const fontCss = getFontCssFamily(fontFamily);
        let fontSize = '22px';
        if (fontFamily.includes('Script') || fontFamily.includes('Vibes') || fontFamily.includes('Brush')) {
          fontSize = '26px';
        }

        ctx.font = `bold ${fontSize} ${fontCss}`;
        ctx.textAlign = 'center';
        const textY = artworkPreviewUrl ? 215 : 160;

        // Deboss drop shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillText(cleanText, 251, textY + 1);

        // Radiant Gold
        ctx.fillStyle = '#F5DC82';
        ctx.fillText(cleanText, 250, textY);

        // Typography label
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#C5A059';
        ctx.fillText(`Typography: ${fontFamily}`, 250, textY + 18);
        ctx.textAlign = 'start';
      }

      // 7. Greeting Card Band
      ctx.fillStyle = '#17181C';
      ctx.fillRect(25, 254, 450, 48);
      ctx.strokeStyle = '#D5A34A';
      ctx.strokeRect(25, 254, 450, 48);
      ctx.fillStyle = '#D5A34A';
      ctx.fillRect(25, 254, 3, 48);
      ctx.fillStyle = '#F5BD48';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('300 GSM TEXTURED COTTON GIFT CARD', 36, 268);
      ctx.fillStyle = '#CBD5E1';
      ctx.font = 'italic 11px serif';
      const note = giftNote && giftNote.trim() ? `"${giftNote.trim().slice(0, 52)}"` : '"No personal message requested"';
      ctx.fillText(note, 36, 288);

      // 8. Packaging & Ribbon Band
      ctx.fillStyle = '#24252A';
      ctx.fillRect(25, 308, 450, 36);
      ctx.strokeStyle = '#D5A34A';
      ctx.strokeRect(25, 308, 450, 36);
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#CBD5E1';
      ctx.fillText(`Ribbon: ${ribbonColor} Silk`, 40, 330);
      ctx.fillText(`Box: ${boxWrapStyle.slice(0, 32)}`, 250, 330);

      // 9. Watermark Footer
      ctx.font = '9px sans-serif';
      ctx.fillStyle = '#94A3B8';
      ctx.textAlign = 'center';
      ctx.fillText('PREVIEW PROOF (v1) - APPROVAL REFERENCE ONLY - NOT A MANUFACTURING VECTOR FILE', 250, 365);
      ctx.textAlign = 'start';

      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  };

  const handleApply = async () => {
    let finalBoxWrap = boxWrapStyle;
    if (finalBoxWrap.toLowerCase().includes('wooden') && !isCrateApproved) {
      finalBoxWrap = 'Blush Pink with Gold Foil';
    }

    const clientProofDataUrl = await generateCanvasPreviewProof();

    onSave({
      personalizationType: artworkUploadId
        ? (engravedText ? 'BESPOKE_COMBO' : 'PHOTO_PRINT')
        : 'TEXT_ENGRAVING',
      engravedText,
      fontFamily,
      giftNote,
      ribbonColor,
      boxWrapStyle: finalBoxWrap,
      waxSealColor,
      giftWrap,
      artworkUploadId: artworkUploadId || undefined,
      artworkPreviewUrl: artworkPreviewUrl || undefined,
      artworkFilename: artworkFilename || undefined,
      clientProofDataUrl: clientProofDataUrl || undefined,
      cropSettings: artworkUploadId ? {
        x: 0,
        y: 0,
        width: 500,
        height: 500,
        zoom: artworkScale,
      } : undefined,
      placementSettings: artworkUploadId ? {
        position: artworkPosition,
        scale: artworkScale,
        offsetX: artworkOffsetX,
        offsetY: artworkOffsetY,
      } : undefined,
      proofApproved,
      proofVersion: 1,
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Lock body scroll while studio is open
  useEffect(() => {
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, []);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[90] overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Snappy Bespoke Atelier"
    >
      <div className="relative w-full max-w-4xl bg-[#08090B] rounded-3xl shadow-2xl border border-[#D5A34A]/30 overflow-hidden my-6 text-[#F1F5F9]">
        
        {/* Atelier Top Header */}
        <div className="bg-gradient-to-r from-[#17181C] via-[#24252A] to-[#17181C] text-[#F1F5F9] px-6 py-4 flex items-center justify-between border-b border-[#D5A34A]/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#D5A34A]/10 border border-[#D5A34A]/30 flex items-center justify-center text-[#F5BD48] shadow-xs">
              <Crown className="w-5 h-5 text-[#F5BD48]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg font-bold tracking-tight text-[#F1F5F9]">Snappy Bespoke Atelier</h3>
                <span className="text-[9.5px] bg-[#D5A34A]/10 text-[#F5BD48] border border-[#D5A34A]/30 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">
                  Fiber Laser 0.05mm
                </span>
              </div>
              <p className="text-xs text-[#94A3B8]">
                Personalizing: <span className="font-semibold text-[#F1F5F9]">{product.name}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#24252A] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Studio Body: Split View */}
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[520px]">
          
          {/* Left Column: Live Realistic Hot-Foil & Engraving Simulation */}
          <div className="md:col-span-6 bg-gradient-to-b from-[#121316] to-[#0D0E11] p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-[#24252A]">
            <div>
              <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-3">
                <span className="flex items-center gap-1.5 font-bold text-[#F5BD48]">
                  <Eye className="w-3.5 h-3.5 text-[#D5A34A]" />
                  <span>Real-time Laser & Foil Simulation</span>
                </span>
                <span className="text-[10px] bg-[#17181C] px-2.5 py-0.5 rounded-full border border-[#D5A34A]/40 text-[#F5BD48] font-medium">
                  24K Gold Deboss
                </span>
              </div>

              {/* Mockup Canvas */}
              <div className="relative aspect-4/3 rounded-2xl overflow-hidden shadow-xl border-2 border-[#24252A] bg-[#17181C]">
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />

                {/* Simulated Engraved / Hot-Foil & Artwork Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 pointer-events-none">
                  {artworkPreviewUrl && (
                    <div
                      className="mb-2 transition-transform duration-100 ease-out"
                      style={{
                        transform: `translate(${artworkOffsetX}px, ${artworkOffsetY}px) scale(${artworkScale})`,
                      }}
                    >
                      <img
                        src={artworkPreviewUrl}
                        alt="Customer Artwork Preview"
                        className="max-h-24 max-w-[120px] object-contain drop-shadow-md rounded border border-[#D5A34A]/40"
                      />
                    </div>
                  )}

                  {engravedText && (
                    <div className="backdrop-blur-[2px] bg-black/60 px-5 py-2.5 rounded-2xl text-center shadow-2xl border border-[#D5A34A]/40 transform -rotate-1 max-w-[85%] transition-all">
                      <div
                        className="text-amber-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] tracking-wide font-normal foil-deboss"
                        style={{
                          fontFamily: getFontCssFamily(fontFamily)
                        }}
                      >
                        <span className="text-xl sm:text-2xl font-bold text-gold-gradient">{engravedText}</span>
                      </div>
                      <div className="text-[8.5px] text-[#F5BD48]/90 tracking-[0.25em] uppercase mt-1">
                        ✦ Handcrafted at Snappy Atelier ✦
                      </div>
                    </div>
                  )}
                </div>

                {/* Ribbon Tag Pill */}
                <div className="absolute bottom-3 left-3 bg-[#17181C]/95 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-[#F1F5F9] font-semibold shadow-xs border border-[#D5A34A]/30 flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-[#D5A34A]" />
                  <span>{ribbonColor} Silk</span>
                </div>
              </div>

              {/* Artisan Approval Representation Notice */}
              <div className="mt-3 text-[10.5px] text-[#CBD5E1] bg-[#17181C] p-2.5 rounded-xl border border-[#D5A34A]/30 flex items-start gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#D5A34A] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#F1F5F9]">Approval Representation:</strong> This digital preview simulates styling and placement. Final precision fiber laser engraving (0.05mm tolerance) is handcrafted at the Snappy Atelier.
                </span>
              </div>
            </div>

            {/* Deckle Edge Handmade Cotton Greeting Card Preview */}
            <div className="mt-4 p-4 rounded-2xl bg-[#17181C] border border-[#24252A] shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-xs font-bold text-[#F5BD48] mb-1.5">
                <span className="flex items-center gap-1.5">
                  <MessageSquareHeart className="w-3.5 h-3.5 text-[#D5A34A]" />
                  <span>300 GSM Textured Cotton Card</span>
                </span>
                
                {/* Simulated Wax Seal Motif */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[#94A3B8] font-normal">Sealed with:</span>
                  <div className={`w-4 h-4 rounded-full ${
                    waxSealColor === 'gold' ? 'bg-[#D5A34A]' :
                    waxSealColor === 'crimson' ? 'bg-[#EC3E98]' :
                    waxSealColor === 'navy' ? 'bg-[#1E293B]' : 'bg-[#064E3B]'
                  } shadow-xs border border-white/20 flex items-center justify-center text-[8px] text-white font-bold`}>
                    ✦
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-[#CBD5E1] font-script text-base italic leading-relaxed pl-2 border-l-2 border-[#D5A34A]">
                "{giftNote || 'No message provided'}"
              </p>
            </div>
          </div>

          {/* Right Column: Customization Controls */}
          <div className="md:col-span-6 p-6 flex flex-col justify-between bg-[#08090B]">
            <div>
              {/* Step Tabs with Gold Underline */}
              <div className="flex border-b border-[#24252A] gap-2 sm:gap-4 mb-5 text-xs font-bold overflow-x-auto pb-1">
                <button
                  onClick={() => setActiveTab('engrave')}
                  className={`pb-2.5 transition-all flex items-center gap-1.5 border-b-2 shrink-0 ${
                    activeTab === 'engrave'
                      ? 'border-[#D5A34A] text-[#F5BD48]'
                      : 'border-transparent text-[#94A3B8] hover:text-[#F1F5F9]'
                  }`}
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>1. Inscription</span>
                </button>
                <button
                  onClick={() => setActiveTab('artwork')}
                  className={`pb-2.5 transition-all flex items-center gap-1.5 border-b-2 shrink-0 ${
                    activeTab === 'artwork'
                      ? 'border-[#D5A34A] text-[#F5BD48]'
                      : 'border-transparent text-[#94A3B8] hover:text-[#F1F5F9]'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>2. Artwork / Logo</span>
                </button>
                <button
                  onClick={() => setActiveTab('giftnote')}
                  className={`pb-2.5 transition-all flex items-center gap-1.5 border-b-2 shrink-0 ${
                    activeTab === 'giftnote'
                      ? 'border-[#D5A34A] text-[#F5BD48]'
                      : 'border-transparent text-[#94A3B8] hover:text-[#F1F5F9]'
                  }`}
                >
                  <MessageSquareHeart className="w-3.5 h-3.5" />
                  <span>3. Card</span>
                </button>
                <button
                  onClick={() => setActiveTab('packaging')}
                  className={`pb-2.5 transition-all flex items-center gap-1.5 border-b-2 shrink-0 ${
                    activeTab === 'packaging'
                      ? 'border-[#D5A34A] text-[#F5BD48]'
                      : 'border-transparent text-[#94A3B8] hover:text-[#F1F5F9]'
                  }`}
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>4. Box</span>
                </button>
              </div>

              {/* Tab 1: Engraving */}
              {activeTab === 'engrave' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#CBD5E1] uppercase tracking-wider mb-1.5">
                      Enter Name or Custom Inscription
                    </label>
                    <input
                      type="text"
                      maxLength={32}
                      value={engravedText}
                      onChange={(e) => setEngravedText(e.target.value)}
                      placeholder="e.g. Sneha & Rohan or Good Vibes Only"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#24252A] bg-[#17181C] text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-hidden focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A]/40 text-sm font-semibold"
                    />
                    <div className="flex justify-between text-[11px] text-[#94A3B8] mt-1">
                      <span>Laser engraved permanently with zero fading</span>
                      <span>{engravedText.length}/32 chars</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#CBD5E1] uppercase tracking-wider mb-2">
                      Select Typography & Script
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {fontOptions.map((font) => (
                        <button
                          key={font.name}
                          type="button"
                          onClick={() => setFontFamily(font.name)}
                          className={`p-3 rounded-2xl border text-left transition-all ${
                            fontFamily === font.name
                              ? 'border-[#D5A34A] bg-[#24252A] shadow-xs ring-1 ring-[#D5A34A] text-[#F1F5F9]'
                              : 'border-[#24252A] bg-[#17181C] text-[#CBD5E1] hover:border-[#D5A34A]/40'
                          }`}
                        >
                          <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1">
                            {font.label}
                          </div>
                          <div className={font.className}>
                            {engravedText || 'Sneha & Rohan'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Artwork / Logo Upload */}
              {activeTab === 'artwork' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#CBD5E1] uppercase tracking-wider mb-1.5">
                      Upload Logo or Vector Artwork
                    </label>
                    <p className="text-[11px] text-[#94A3B8] mb-2">
                      Upload company logo, couple crest, or custom motif. Accepted: PNG, JPEG, WebP (Max 5 MB).
                    </p>

                    {uploadError && (
                      <div className="mb-2 p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{uploadError}</span>
                      </div>
                    )}

                    {!artworkUploadId ? (
                      <label className="border-2 border-dashed border-[#24252A] hover:border-[#D5A34A]/60 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer bg-[#17181C]/50 hover:bg-[#24252A]/50 transition-all text-center">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleFileUpload}
                          disabled={isUploading}
                          className="hidden"
                        />
                        {isUploading ? (
                          <div className="flex flex-col items-center gap-2 text-[#94A3B8]">
                            <Loader2 className="w-6 h-6 animate-spin text-[#F5BD48]" />
                            <span className="text-xs font-semibold">Validating signature & uploading...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-[#94A3B8]">
                            <Upload className="w-6 h-6 text-[#D5A34A]" />
                            <span className="text-xs font-bold text-[#F1F5F9]">Click to Upload Artwork</span>
                            <span className="text-[10px] text-[#64748B]">PNG with transparency recommended</span>
                          </div>
                        )}
                      </label>
                    ) : (
                      <div className="p-3 rounded-2xl bg-[#17181C] border border-[#24252A] flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ImageIcon className="w-4 h-4 text-[#F5BD48] shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#F1F5F9] truncate">
                              {artworkFilename || 'Custom Artwork Attached'}
                            </div>
                            <div className="text-[10px] text-[#94A3B8] font-mono">
                              ID: {artworkUploadId}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setArtworkUploadId(null);
                            setArtworkPreviewUrl(null);
                            setArtworkFilename(null);
                          }}
                          className="p-1.5 text-red-400 hover:bg-red-950/40 rounded-lg transition-colors"
                          title="Remove artwork"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {artworkUploadId && (
                    <div className="space-y-3 pt-2 border-t border-[#24252A]">
                      <div className="flex items-center justify-between text-xs font-bold text-[#CBD5E1]">
                        <span className="flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-[#D5A34A]" />
                          <span>Placement & Scale Adjustments</span>
                        </span>
                        <span className="text-[10px] text-[#94A3B8] font-mono">
                          Zoom: {artworkScale.toFixed(1)}x
                        </span>
                      </div>

                      {/* Scale Slider */}
                      <div>
                        <div className="flex justify-between text-[11px] text-[#94A3B8] mb-1">
                          <span>Scale / Zoom</span>
                          <span className="text-[#F5BD48]">{artworkScale}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.1"
                          value={artworkScale}
                          onChange={(e) => setArtworkScale(parseFloat(e.target.value))}
                          className="w-full accent-[#D5A34A]"
                        />
                      </div>

                      {/* Horizontal Offset */}
                      <div>
                        <div className="flex justify-between text-[11px] text-[#94A3B8] mb-1">
                          <span>Horizontal Position (X)</span>
                          <span className="text-[#F5BD48]">{artworkOffsetX}px</span>
                        </div>
                        <input
                          type="range"
                          min="-80"
                          max="80"
                          step="5"
                          value={artworkOffsetX}
                          onChange={(e) => setArtworkOffsetX(parseInt(e.target.value))}
                          className="w-full accent-[#D5A34A]"
                        />
                      </div>

                      {/* Vertical Offset */}
                      <div>
                        <div className="flex justify-between text-[11px] text-[#94A3B8] mb-1">
                          <span>Vertical Position (Y)</span>
                          <span className="text-[#F5BD48]">{artworkOffsetY}px</span>
                        </div>
                        <input
                          type="range"
                          min="-80"
                          max="80"
                          step="5"
                          value={artworkOffsetY}
                          onChange={(e) => setArtworkOffsetY(parseInt(e.target.value))}
                          className="w-full accent-[#D5A34A]"
                        />
                      </div>

                      {/* Preset Placement Buttons */}
                      <div>
                        <span className="block text-[11px] text-[#94A3B8] mb-1">Position Preset</span>
                        <div className="grid grid-cols-4 gap-1.5 text-[10.5px]">
                          {(['CENTER', 'TOP_CENTER', 'LID', 'PLAQUE'] as const).map((pos) => (
                            <button
                              key={pos}
                              type="button"
                              onClick={() => {
                                setArtworkPosition(pos);
                                if (pos === 'CENTER') { setArtworkOffsetX(0); setArtworkOffsetY(0); }
                                if (pos === 'TOP_CENTER') { setArtworkOffsetX(0); setArtworkOffsetY(-40); }
                                if (pos === 'LID') { setArtworkOffsetX(0); setArtworkOffsetY(-60); }
                                if (pos === 'PLAQUE') { setArtworkOffsetX(0); setArtworkOffsetY(40); }
                              }}
                              className={`p-1.5 rounded-lg border text-center font-semibold transition-all ${
                                artworkPosition === pos
                                  ? 'bg-[#D5A34A]/10 border-[#D5A34A] text-[#F5BD48]'
                                  : 'border-[#24252A] bg-[#17181C] text-[#CBD5E1] hover:bg-[#24252A]'
                              }`}
                            >
                              {pos.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Greeting Card & Wax Seal */}
              {activeTab === 'giftnote' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#CBD5E1] uppercase tracking-wider mb-1.5">
                      Personal Message for Gift Card
                    </label>
                    <textarea
                      rows={4}
                      maxLength={200}
                      value={giftNote}
                      onChange={(e) => setGiftNote(e.target.value)}
                      placeholder="Write your heartfelt note here..."
                      className="w-full px-4 py-2.5 rounded-xl border border-[#24252A] bg-[#17181C] text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-hidden focus:border-[#D5A34A] focus:ring-1 focus:ring-[#D5A34A]/40 text-sm font-medium"
                    />
                    <div className="flex justify-between text-[11px] text-[#94A3B8] mt-1">
                      <span>Printed on textured 300 GSM ivory cardstock</span>
                      <span>{giftNote.length}/200 chars</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#CBD5E1] uppercase tracking-wider mb-2">
                      Select Hand-Poured Wax Seal Color
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {waxSeals.map((ws) => (
                        <button
                          key={ws.id}
                          type="button"
                          onClick={() => setWaxSealColor(ws.id as any)}
                          className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs font-semibold transition-all ${
                            waxSealColor === ws.id
                              ? 'border-[#D5A34A] bg-[#24252A] ring-1 ring-[#D5A34A] text-[#F1F5F9]'
                              : 'border-[#24252A] bg-[#17181C] text-[#CBD5E1] hover:bg-[#24252A]'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded-full ${ws.bg} shadow-xs border border-white/20`} />
                          <span className="text-[11px]">{ws.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Packaging & Ribbon */}
              {activeTab === 'packaging' && (
                <div className="space-y-4">
                  {/* Signature Gift Wrapping Option (₹20) */}
                  <div className="p-3.5 rounded-2xl bg-[#24252A] border border-[#D5A34A]/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#D5A34A]/20 flex items-center justify-center text-[#F5BD48]">
                        <Gift className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>Signature Gift Wrapping</span>
                          <span className="text-[10px] bg-[#D5A34A]/20 text-[#F5BD48] px-1.5 py-0.2 rounded font-mono">+₹20</span>
                        </div>
                        <div className="text-[11px] text-[#CBD5E1]">Handcrafted decorative gold-trim wrapping with satin ribbon</div>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={giftWrap}
                        onChange={(e) => setGiftWrap(e.target.checked)}
                        className="w-4 h-4 rounded text-[#D5A34A] focus:ring-[#D5A34A] accent-[#D5A34A] cursor-pointer"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#CBD5E1] uppercase tracking-wider mb-2">
                      Pure Mulberry Silk Ribbon
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ribbonColors.map((r) => (
                        <button
                          key={r.name}
                          type="button"
                          onClick={() => setRibbonColor(r.name)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                            ribbonColor === r.name
                              ? 'border-[#D5A34A] bg-[#24252A] text-[#F5BD48] ring-1 ring-[#D5A34A] font-bold'
                              : 'border-[#24252A] bg-[#17181C] text-[#CBD5E1] hover:border-[#D5A34A]/40'
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded-full ${r.bg} ${r.border} border`} />
                          <span>{r.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#CBD5E1] uppercase tracking-wider mb-2">
                      Gift Keepsake Box Style
                    </label>
                    <div className="space-y-2">
                      {boxOptions.map((box) => (
                        <label
                          key={box.id}
                          onClick={() => {
                            if (box.available) setBoxWrapStyle(box.id);
                          }}
                          className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${
                            !box.available
                              ? 'opacity-50 cursor-not-allowed bg-[#17181C]/40 border-[#24252A]'
                              : boxWrapStyle === box.id
                              ? 'border-[#D5A34A] bg-[#24252A] ring-1 ring-[#D5A34A] cursor-pointer'
                              : 'border-[#24252A] bg-[#17181C] hover:border-[#D5A34A]/40 cursor-pointer'
                          }`}
                        >
                          <input
                            type="radio"
                            name="boxWrapStyle"
                            disabled={!box.available}
                            checked={boxWrapStyle === box.id}
                            onChange={() => {
                              if (box.available) setBoxWrapStyle(box.id);
                            }}
                            className="mt-1 text-[#D5A34A] focus:ring-[#D5A34A] accent-[#D5A34A] disabled:cursor-not-allowed"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#F1F5F9]">{box.label}</span>
                              {!box.available && (
                                <span className="text-[9.5px] bg-[#D5A34A]/10 text-[#F5BD48] px-2 py-0.5 rounded-full font-semibold border border-[#D5A34A]/30">
                                  Unavailable (Pending Approval)
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#94A3B8]">{box.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Proof Approval Checkbox & Bottom Actions */}
            <div className="mt-6 pt-4 border-t border-[#24252A] space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#CBD5E1] select-none">
                <input
                  type="checkbox"
                  checked={proofApproved}
                  onChange={(e) => setProofApproved(e.target.checked)}
                  className="mt-0.5 rounded text-[#D5A34A] focus:ring-[#D5A34A] accent-[#D5A34A]"
                />
                <span className="text-[11px] leading-snug text-[#94A3B8]">
                  I have verified and approve this preview proof for production. I understand this digital proof represents styling and placement for artisan crafting.
                </span>
              </label>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#17181C] transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!proofApproved}
                  onClick={handleApply}
                  className="px-7 py-3 rounded-full bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] hover:from-[#E5AD38] hover:to-[#C5933A] text-[#08090B] text-xs sm:text-sm font-bold shadow-lg shadow-amber-950/20 flex items-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4 text-[#08090B]" />
                  <span>Save Bespoke Customization</span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
