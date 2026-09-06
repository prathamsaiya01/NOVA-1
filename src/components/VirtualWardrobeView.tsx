import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ScreenId, WardrobeDetectedAttributes, WardrobeGender, WardrobeItem, WardrobeProfile, WardrobeScanMethod, WardrobeSize } from '../types';
import accountService from '../services/accountService';
import aiService from "../services/aiService";
import { findSimilarProductsByVector, ProductMatch } from "../services/productMetadataService";

interface VirtualWardrobeViewProps {
  onNavigate: (screen: ScreenId) => void;
  userEmail: string;
  userName?: string;
  isDarkMode?: boolean;
}

const sizes: WardrobeSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const maleCategories = ['T-Shirt', 'Shirt', 'Polo', 'Hoodie', 'Sweatshirt', 'Jacket', 'Jeans', 'Trousers', 'Shorts', 'Ethnic Wear', 'Blazer'];
const femaleCategories = ['Kurti', 'Co-ord Set', 'Saree', 'Crop Top', 'T-Shirt', 'Shirt', 'Leggings', 'Jeans', 'Palazzo', 'Dress', 'Jacket', 'Hoodie'];
const categoryIcons: Record<string, string> = {
  'T-Shirt': 'apparel',
  Shirt: 'styler',
  Polo: 'apparel',
  Hoodie: 'checkroom',
  Sweatshirt: 'checkroom',
  Jacket: 'dry_cleaning',
  Jeans: 'laundry',
  Trousers: 'laundry',
  Shorts: 'apparel',
  'Ethnic Wear': 'style',
  Blazer: 'business_center',
  Kurti: 'apparel',
  'Co-ord Set': 'select_all',
  Saree: 'gesture',
  'Crop Top': 'apparel',
  Leggings: 'laundry',
  Palazzo: 'laundry',
  Dress: 'styler'
};

const svgImage = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const getScanSample = (category = 'Kurti') => {
  const isDenim = ['Jeans', 'Shorts', 'Trousers'].includes(category);
  const isOuter = ['Hoodie', 'Jacket', 'Blazer', 'Sweatshirt'].includes(category);
  const isShirt = ['Shirt', 'T-Shirt', 'Polo', 'Crop Top'].includes(category);
  const base = isDenim ? '#1e2f55' : isOuter ? '#6d4cc2' : isShirt ? '#c25783' : '#244c9a';
  const accent = isDenim ? '#8fb3ff' : isOuter ? '#d8b4fe' : isShirt ? '#ffe4f2' : '#f8e7b0';
  const stitch = isDenim ? '#c7d2fe' : '#f8fafc';
  const detail = isDenim
    ? `<path d="M42 72c70 28 143 24 238-14M38 316c88-30 158-26 244 8" stroke="${stitch}" stroke-width="5" opacity=".35"/><path d="M78 0l62 420M198 0l-38 420" stroke="#0f172a" stroke-width="3" opacity=".28"/>`
    : isOuter
      ? `<path d="M168 0v420" stroke="${accent}" stroke-width="8" opacity=".72"/><path d="M154 20h28v34h-28zM154 72h28v34h-28zM154 124h28v34h-28z" fill="#f8fafc" opacity=".82"/><path d="M42 82c90 50 175 44 240-16" stroke="#fff" stroke-width="3" opacity=".24"/>`
      : `<path d="M74 62c42 30 88 28 136 0 11 48 42 80 78 104-48 44-91 101-126 170-28-58-69-112-124-162 35-29 55-66 36-112Z" fill="none" stroke="${accent}" stroke-width="6" opacity=".8"/><path d="M90 114c54 36 102 34 150-2" stroke="#fff" stroke-width="3" opacity=".52"/>`;

  return svgImage(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 420">
      <defs>
        <linearGradient id="cloth" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${base}"/><stop offset=".55" stop-color="#111827"/><stop offset="1" stop-color="${base}"/></linearGradient>
        <radialGradient id="light" cx="38%" cy="22%" r="70%"><stop stop-color="#ffffff" stop-opacity=".38"/><stop offset=".45" stop-color="#ffffff" stop-opacity=".07"/><stop offset="1" stop-color="#000000" stop-opacity=".35"/></radialGradient>
        <pattern id="weave" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M0 8h18M8 0v18" stroke="#fff" stroke-opacity=".08" stroke-width="1"/><path d="M0 17h18" stroke="#000" stroke-opacity=".15"/></pattern>
        <pattern id="floral" width="56" height="56" patternUnits="userSpaceOnUse"><circle cx="18" cy="18" r="6" fill="${accent}" opacity=".88"/><path d="M18 6c10 7 10 18 0 24C8 24 8 13 18 6ZM6 18c7-10 18-10 24 0-6 10-17 10-24 0Z" fill="#fff" opacity=".48"/><path d="M34 38c16-11 28 6 14 14-10 5-24-1-14-14Z" fill="${accent}" opacity=".5"/></pattern>
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .12"/></feComponentTransfer></filter>
      </defs>
      <rect width="320" height="420" rx="34" fill="#0b1020"/>
      <rect x="18" y="18" width="284" height="384" rx="30" fill="url(#cloth)"/>
      <rect x="18" y="18" width="284" height="384" rx="30" fill="url(#weave)"/>
      <rect x="18" y="18" width="284" height="384" rx="30" fill="url(#floral)" opacity="${isDenim ? '.18' : '.78'}"/>
      ${detail}
      <rect x="18" y="18" width="284" height="384" rx="30" fill="url(#light)"/>
      <rect x="18" y="18" width="284" height="384" rx="30" filter="url(#grain)" opacity=".55"/>
    </svg>`
  );
};

const sampleScan = getScanSample('Kurti');

const makeId = () => `wardrobe-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const storageKey = (userId: string) => `nova_wardrobe_${userId}`;
const profileKey = (userId: string) => `nova_wardrobe_profile_${userId}`;
const outfitsKey = (userId: string) => `nova_wardrobe_outfits_${userId}`;

const colorHex: Record<string, string> = {
  Blue: '#4f46e5',
  Ivory: '#f8fafc',
  Rose: '#ec4899',
  Mint: '#5eead4',
  Charcoal: '#1e293b',
  Sand: '#d6b98c',
  Maroon: '#8a1238',
  Lilac: '#a78bfa'
};

const processingSteps = ['Detecting Pattern', 'Detecting Colors', 'Extracting Vectors', 'Matching Catalog', 'Complete'];

const topCategories = ['T-Shirt', 'Shirt', 'Polo', 'Hoodie', 'Sweatshirt', 'Jacket', 'Blazer', 'Kurti', 'Crop Top'];
const bottomCategories = ['Jeans', 'Trousers', 'Shorts', 'Leggings', 'Palazzo'];
const isBottomWear = (category: string) => bottomCategories.includes(category);

const photoSignals = async (dataUrl: string) => {
  const image = new Image();
  image.src = dataUrl;
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Unable to read photo')); });
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return { primary: 'Review needed', secondary: '—', pattern: 'Review needed' };
  context.clearRect(0, 0, 64, 64);
  context.drawImage(image, 0, 0, 64, 64);
  const classify = (red: number, green: number, blue: number) => {
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const value = maximum / 255;
    const saturation = maximum === 0 ? 0 : (maximum - minimum) / maximum;
    const lightness = (maximum + minimum) / 510;
    if (value < 0.2) return 'Black';
    if (saturation < 0.08 && lightness > 0.86) return 'White';
    if (saturation < 0.12) return lightness < 0.55 ? 'Charcoal' : 'Grey';

    let hue = 0;
    if (maximum !== minimum) {
      if (maximum === red) hue = 60 * (((green - blue) / (maximum - minimum)) % 6);
      else if (maximum === green) hue = 60 * ((blue - red) / (maximum - minimum) + 2);
      else hue = 60 * ((red - green) / (maximum - minimum) + 4);
    }
    if (hue < 0) hue += 360;
    if (saturation < 0.3 && lightness > 0.65) return hue < 55 ? 'Beige' : hue < 95 ? 'Mint' : 'Lavender';
    if (hue >= 345 || hue < 15) return 'Red';
    if (hue < 42) return lightness < 0.5 ? 'Brown' : 'Orange';
    if (hue < 75) return 'Yellow';
    if (hue < 165) return 'Green';
    if (hue < 205) return 'Cyan';
    if (hue < 255) return 'Blue';
    if (hue < 315) return 'Purple';
    return 'Pink';
  };
  const counts: Record<string, number> = {};
  const colorGrid: string[][] = [];
  const pixels = context.getImageData(0, 0, 64, 64).data;
  for (let y = 0; y < 64; y += 2) {
    const row: string[] = [];
    for (let x = 0; x < 64; x += 2) {
      const index = (y * 64 + x) * 4;
      if (pixels[index + 3] < 48) { row.push('transparent'); continue; }
      const color = classify(pixels[index], pixels[index + 1], pixels[index + 2]);
      const saturation = (Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) - Math.min(pixels[index], pixels[index + 1], pixels[index + 2])) / Math.max(1, Math.max(pixels[index], pixels[index + 1], pixels[index + 2]));
      counts[color] = (counts[color] || 0) + (saturation < 0.08 ? 0.65 : 1);
      row.push(color);
    }
    colorGrid.push(row);
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [primary = 'Review needed'] = ranked[0] || [];
  const secondary = ranked.find(([color]) => color !== primary)?.[0] || '—';
  const totalPixels = Object.values(counts).reduce((sum, value) => sum + value, 0) || 1;
  const secondaryShare = (counts[secondary] || 0) / totalPixels;
  let transitions = 0;
  let comparisons = 0;
  colorGrid.forEach((row, y) => row.forEach((color, x) => {
    if (color === 'transparent') return;
    if (x > 0 && row[x - 1] !== 'transparent') { comparisons += 1; if (row[x - 1] !== color) transitions += 1; }
    if (y > 0 && colorGrid[y - 1][x] !== 'transparent') { comparisons += 1; if (colorGrid[y - 1][x] !== color) transitions += 1; }
  }));
  const textureVariation = comparisons ? transitions / comparisons : 0;
  const pattern = primary === 'White' && secondary === 'Black' && secondaryShare > 0.04 ? 'Polka dot / printed'
    : secondary !== '—' && secondaryShare > 0.14 && textureVariation > 0.16 ? 'Patterned / printed' : 'Solid';
  return { primary, secondary, pattern };
};

// A square, well-lit preview makes a quick or crooked phone photo pleasant to browse.
const normalizePhoto = async (source: string) => {
  const image = new Image();
  image.src = source;
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Unable to read photo')); });
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 900;
  const context = canvas.getContext('2d');
  if (!context) return source;
  context.fillStyle = '#f8fafc'; context.fillRect(0, 0, 900, 900);
  const scale = Math.min(820 / image.width, 820 / image.height);
  const width = image.width * scale; const height = image.height * scale;
  context.drawImage(image, (900 - width) / 2, (900 - height) / 2, width, height);
  return canvas.toDataURL('image/jpeg', 0.9);
};

const toDataUrl = async (source: string) => {
  if (source.startsWith('data:')) return source;
  const response = await fetch(source);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Unable to read generated garment'));
    reader.readAsDataURL(blob);
  });
};

export const VirtualWardrobeView: React.FC<VirtualWardrobeViewProps> = ({ onNavigate, userEmail, userName, isDarkMode = false }) => {
  const userId = accountService.getUserDocId(userEmail);
  const username = userEmail ? userEmail.split('@')[0] : userId;
  const [profile, setProfile] = useState<WardrobeProfile>(() => {
    try {
      return JSON.parse(localStorage.getItem(profileKey(accountService.getUserDocId(userEmail))) || '{}');
    } catch {
      return {};
    }
  });
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [scanMethod, setScanMethod] = useState<WardrobeScanMethod>('Live Scan');
  const [scanImage, setScanImage] = useState(sampleScan);
  const [generatedItem, setGeneratedItem] = useState<WardrobeItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [matchedProducts, setMatchedProducts] = useState<ProductMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [colorFilter, setColorFilter] = useState('All');
  const [patternFilter, setPatternFilter] = useState('All');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [outfitIndex, setOutfitIndex] = useState(0);
  const [editDraft, setEditDraft] = useState<WardrobeItem | null>(null);
  const [outfitSeed, setOutfitSeed] = useState<WardrobeItem | null>(null);
  const [outfitPartnerId, setOutfitPartnerId] = useState<string>('');
  const [savedOutfitCount, setSavedOutfitCount] = useState(() => {
    try { return JSON.parse(localStorage.getItem(outfitsKey(accountService.getUserDocId(userEmail))) || '[]').length; } catch { return 0; }
  });

  useEffect(() => {
    const testConnection = async () => {
      try {
        const result = await aiService.checkConnection();
        console.log("✅ AI Server:", result);
      } catch (error) {
        console.error("❌ Could not connect to AI Server", error);
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    const loadWardrobe = async () => {
      setIsLoading(true);
      try {
        const saved = localStorage.getItem(storageKey(userId));
        if (saved) setItems(JSON.parse(saved));
        const snap = await getDocs(query(collection(db, 'users', userId, 'wardrobe'), orderBy('dateAdded', 'desc')));
        const remote = snap.docs.map((entry) => ({ ...(entry.data() as WardrobeItem), id: entry.id }));
        if (remote.length) {
          setItems(remote);
          localStorage.setItem(storageKey(userId), JSON.stringify(remote));
        }
      } catch {
        const saved = localStorage.getItem(storageKey(userId));
        setItems(saved ? JSON.parse(saved) : []);
      } finally {
        setIsLoading(false);
      }
    };
    loadWardrobe();
  }, [userId]);

  useEffect(() => {
    localStorage.setItem(profileKey(userId), JSON.stringify(profile));
    accountService.upsertUserProfile(
      {
        uid: userEmail || userId,
        username,
        name: userName || username,
        email: userEmail,
        gender: profile.gender,
        size: profile.size
      },
      { wardrobeCount: items.length }
    ).catch(() => undefined);
  }, [items.length, profile, userEmail, userId, userName, username]);

  const categories = profile.gender === 'Male' ? maleCategories : femaleCategories;
  const categoryOptions = ['All', ...new Set(items.map((item) => item.category))];
  const colorOptions = ['All', ...new Set(items.flatMap((item) => item.colors))];
  const patternOptions = ['All', ...new Set(items.map((item) => item.pattern))];

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => item.category.toLowerCase().includes(search.toLowerCase()) || item.tags.join(' ').toLowerCase().includes(search.toLowerCase()))
      .filter((item) => categoryFilter === 'All' || item.category === categoryFilter)
      .filter((item) => colorFilter === 'All' || item.colors.includes(colorFilter))
      .filter((item) => patternFilter === 'All' || item.pattern === patternFilter)
      .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
  }, [categoryFilter, colorFilter, items, patternFilter, search]);

  const persistItems = (next: WardrobeItem[]) => {
    setItems(next);
    localStorage.setItem(storageKey(userId), JSON.stringify(next));
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = String(reader.result || sampleScan);
      try { setScanImage(await normalizePhoto(raw)); } catch { setScanImage(raw); }
      setProcessedImage(null);
      setGeneratedItem(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!scanImage) {
      alert("Please upload or scan a garment first.");
      return;
    }

    try {
      setIsProcessing(true);
      setProcessingStep(0);

      const response = await fetch(scanImage);
      const blob = await response.blob();
      const file = new File([blob], `nova-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" });

      setProcessingStep(1);
      let result: any = null;
      try {
        result = await aiService.uploadGarment(file, selectedCategory || '');
        if (!result?.processed_image) throw new Error('The garment processor did not return an image.');
        setProcessedImage(result.processed_image);
      } catch (error) {
        // Keep the wardrobe flow usable when the optional Python processor is unavailable.
        result = { processed_image: scanImage };
        setProcessedImage(scanImage);
        setSaveStatus('AI processor unavailable. Used a local garment preview.');
      }

      setProcessingStep(2);
      // Generate vector embedding array from Python server
      let embedding: number[] = [];
      try { embedding = await aiService.getEmbedding(file); } catch { /* Catalog matching is optional. */ }

      setProcessingStep(3);
      const scannedAttributes = {
        category: selectedCategory || result?.category || result?.attributes?.category,
        primaryColor: result?.primaryColor ?? result?.attributes?.primaryColor,
        subcategory: result?.subcategory ?? result?.attributes?.subcategory,
        pattern: result?.pattern ?? result?.attributes?.pattern,
        sleeveType: result?.sleeveType ?? result?.attributes?.sleeveType,
        neckType: result?.neckType ?? result?.attributes?.neckType,
        fit: result?.fit ?? result?.attributes?.fit,
        material: result?.material ?? result?.attributes?.material
      };
      if (embedding.length) setMatchedProducts(await findSimilarProductsByVector(embedding, scannedAttributes, 5));

      // Analyze the garment crop, not the original person/background photo.
      let garmentForAnalysis = scanImage;
      try { garmentForAnalysis = await toDataUrl(result.processed_image); } catch { throw new Error('Could not read the isolated garment image.'); }
      const localSignals = await photoSignals(garmentForAnalysis);
      const color = result?.primaryColor ?? result?.attributes?.primaryColor ?? localSignals.primary;
      const secondaryColor = result?.secondaryColor ?? result?.attributes?.secondaryColor ?? localSignals.secondary;
      const pattern = result?.pattern ?? result?.attributes?.pattern ?? localSignals.pattern;
      const category = selectedCategory || result?.category || 'T-Shirt';
      const bottomWear = isBottomWear(category);
      const detected: WardrobeDetectedAttributes = {
        primaryColor: color, secondaryColor, pattern,
        fabric: result?.material ?? result?.attributes?.material ?? 'Review fabric',
        style: result?.fit ?? result?.attributes?.fit ?? 'Everyday',
        sleeveType: bottomWear ? 'Not applicable' : result?.sleeveType ?? result?.attributes?.sleeveType ?? 'Not specified',
        neckType: bottomWear ? 'Not applicable' : result?.neckType ?? result?.attributes?.neckType ?? 'Not specified',
        ...(bottomWear ? {
          rise: result?.rise ?? result?.attributes?.rise ?? 'Not specified',
          length: result?.length ?? result?.attributes?.length ?? 'Not specified'
        } : {})
      };
      setGeneratedItem({
        id: makeId(), category, gender: profile.gender || 'Female', size: profile.size || 'M',
        generatedImage: result.processed_image, originalScan: scanImage,
        colors: [color, ...(secondaryColor !== '—' ? [secondaryColor] : [])], pattern, fabric: detected.fabric,
        tags: [category, color, pattern, detected.style].filter(Boolean), dateAdded: new Date().toISOString(),
        timesWorn: 0, attributes: detected
      });

      setProcessingStep(4);
    } catch (error) {
      console.error("NOVA garment analysis failed:", error);
      setSaveStatus('We could not read that photo. Try a clearer garment image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const saveItem = async () => {
    if (!generatedItem) return;
    const next = [generatedItem, ...items.filter((item) => item.id !== generatedItem.id)];
    persistItems(next);
    setSaveStatus('Saved to wardrobe');
    try {
      const ref = await addDoc(collection(db, 'users', userId, 'wardrobe'), generatedItem);
      const savedWithRemoteId = { ...generatedItem, id: ref.id };
      const remoteNext = [savedWithRemoteId, ...items.filter((item) => item.id !== generatedItem.id)];
      await setDoc(doc(db, 'users', userId, 'wardrobe', ref.id), savedWithRemoteId);
      await accountService.upsertUserProfile(
        {
          uid: userEmail || userId,
          username,
          name: userName || username,
          email: userEmail,
          gender: profile.gender,
          size: profile.size
        },
        { wardrobeCount: remoteNext.length, wardrobeUpdatedAt: savedWithRemoteId.dateAdded }
      );
      persistItems(remoteNext);
    } catch {
      setSaveStatus('Saved locally. Firebase sync will retry when available.');
    }
    setSelectedCategory(null);
    setGeneratedItem(null);
    window.setTimeout(() => setSaveStatus(null), 2400);
  };

  const deleteItem = async (item: WardrobeItem) => {
    persistItems(items.filter((entry) => entry.id !== item.id));
    setSelectedItem(null);
    try {
      await deleteDoc(doc(db, 'users', userId, 'wardrobe', item.id));
      await accountService.upsertUserProfile(
        {
          uid: userEmail || userId,
          username,
          name: userName || username,
          email: userEmail,
          gender: profile.gender,
          size: profile.size
        },
        { wardrobeCount: Math.max(0, items.length - 1), wardrobeUpdatedAt: new Date().toISOString() }
      );
    } catch {
      setSaveStatus('Removed locally');
      window.setTimeout(() => setSaveStatus(null), 1800);
    }
  };

  const updateItem = (item: WardrobeItem) => {
    const next = items.map((entry) => (entry.id === item.id ? item : entry));
    persistItems(next);
    setSelectedItem(item);
    setDoc(doc(db, 'users', userId, 'wardrobe', item.id), item)
      .then(() => accountService.upsertUserProfile(
        {
          uid: userEmail || userId,
          username,
          name: userName || username,
          email: userEmail,
          gender: profile.gender,
          size: profile.size
        },
        { wardrobeCount: next.length, wardrobeUpdatedAt: new Date().toISOString() }
      ))
      .catch(() => undefined);
  };

  const markOutfitWorn = (outfitItems: WardrobeItem[]) => {
    const wornIds = new Set(outfitItems.map((item) => item.id));
    const now = new Date().toISOString();
    const next = items.map((item) => wornIds.has(item.id) ? { ...item, timesWorn: (item.timesWorn || 0) + 1, lastWorn: now } : item);
    persistItems(next);
    next.filter((item) => wornIds.has(item.id)).forEach((item) => setDoc(doc(db, 'users', userId, 'wardrobe', item.id), item).catch(() => undefined));
    setSaveStatus('Fit saved as worn — nice choice.');
    window.setTimeout(() => setSaveStatus(null), 2400);
  };

  const openOutfitBuilder = (item: WardrobeItem) => {
    setSelectedItem(null);
    setOutfitSeed(item);
    const complementary = topCategories.includes(item.category) ? bottoms : bottomCategories.includes(item.category) ? tops : items.filter((entry) => entry.id !== item.id);
    setOutfitPartnerId(complementary[0]?.id || '');
  };

  const saveCreatedOutfit = () => {
    if (!outfitSeed) return;
    const partner = items.find((item) => item.id === outfitPartnerId);
    if (!partner && (topCategories.includes(outfitSeed.category) || bottomCategories.includes(outfitSeed.category))) {
      setSaveStatus('Add a matching top or bottom first.'); return;
    }
    const key = outfitsKey(userId);
    let saved: Array<{ id: string; itemIds: string[]; createdAt: string }> = [];
    try { saved = JSON.parse(localStorage.getItem(key) || '[]'); } catch { /* Start a fresh local collection. */ }
    saved.unshift({ id: makeId(), itemIds: [outfitSeed.id, ...(partner ? [partner.id] : [])], createdAt: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(saved));
    setSavedOutfitCount(saved.length);
    setSaveStatus('Outfit saved to your closet.');
    window.setTimeout(() => setSaveStatus(null), 2400);
    setOutfitSeed(null);
  };

  const darkPanel = 'border border-white/10 bg-[#121322]/92 text-white shadow-[0_18px_48px_rgba(0,0,0,0.32)]';
  const purpleButton = 'bg-gradient-to-r from-[#8b4cf6] to-[#b45cf7] text-white shadow-lg shadow-purple-950/35';
  const muted = 'text-slate-400';
  const colorCounts = items.flatMap((item) => item.colors).reduce<Record<string, number>>((counts, color) => {
    counts[color] = (counts[color] || 0) + 1; return counts;
  }, {});
  const mostCommonColor = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  const colorStats = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([label, count]) => [label, Math.round((count / Math.max(1, items.length)) * 100), colorHex[label] || '#8b5cf6']);
  const tops = items.filter((item) => topCategories.includes(item.category));
  const bottoms = items.filter((item) => bottomCategories.includes(item.category));
  const onePieces = items.filter((item) => ['Dress', 'Saree', 'Co-ord Set', 'Ethnic Wear'].includes(item.category));
  const outfitIdeas = [
    ...tops.flatMap((top) => bottoms.map((bottom) => ({ title: `${top.colors[0]} ${top.category} + ${bottom.colors[0]} ${bottom.category}`, items: [top, bottom], note: 'A fresh pairing from your own closet.' }))),
    ...onePieces.map((item) => ({ title: `${item.colors[0]} ${item.category}`, items: [item], note: 'An easy one-piece look to revisit.' }))
  ].filter((idea, index, all) => all.findIndex((entry) => entry.title === idea.title) === index);
  const currentOutfit = outfitIdeas[outfitIndex % Math.max(1, outfitIdeas.length)];
  const totalOutfits = savedOutfitCount;

  return (
    <div className="min-h-full -mx-4 -my-3 space-y-5 bg-[#080913] px-4 py-4 text-white">
      {saveStatus && (
        <div className="fixed top-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#151426]/95 px-4 py-2 text-xs font-bold text-white shadow-xl backdrop-blur">
          {saveStatus}
        </div>
      )}

      <section className={`rounded-[28px] p-5 backdrop-blur-2xl ${darkPanel}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#b976ff]">NOVA</p>
            <h1 className="mt-1 text-3xl font-black leading-tight tracking-tight">Virtual Wardrobe</h1>
            <p className={`mt-3 max-w-[250px] text-sm leading-relaxed ${muted}`}>Scan. Store. Style. Your entire wardrobe, digitized with AI.</p>
          </div>
          <button onClick={() => onNavigate('scan-outfit')} className={`h-11 w-11 rounded-2xl ${purpleButton}`}>
            <span className="material-symbols-outlined text-xl leading-10">center_focus_strong</span>
          </button>
        </div>
        <div className="mt-5 grid gap-3">
          {[
            ['center_focus_strong', 'AI Smart Scan'],
            ['apparel', 'Virtual Garment Generation'],
            ['checkroom', 'Organized Wardrobe'],
            ['auto_awesome', 'Outfit & Styling Assistant'],
            ['donut_large', 'Closet Insights']
          ].map(([icon, label]) => (
            <div key={label} className="flex items-center gap-3 text-sm font-semibold text-slate-200">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#7c3aed]/45 bg-[#6d28d9]/15 text-[#c084fc]">
                <span className="material-symbols-outlined text-lg">{icon}</span>
              </span>
              {label}
            </div>
          ))}
        </div>
      </section>

      {!profile.gender && (
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className={`rounded-[28px] p-5 ${darkPanel}`}>
          <p className="text-center text-[11px] font-black uppercase tracking-[0.28em] text-[#b976ff]">NOVA</p>
          <h2 className="mt-5 text-center text-2xl font-black">Who are we styling today?</h2>
          <p className={`mt-1 text-center text-xs ${muted}`}>Choose your style profile</p>
          <div className="mt-5 grid gap-3">
            {(['Male', 'Female'] as WardrobeGender[]).map((gender) => (
              <button key={gender} onClick={() => setProfile({ gender })} className="flex min-h-24 items-center gap-4 rounded-xl border border-[#3b3158] bg-[#171827] p-3 text-left transition hover:border-[#a855f7]">
                <div className="flex h-16 w-20 items-center justify-center rounded-lg bg-gradient-to-br from-[#2b2145] to-[#090a13] text-[#d8b4fe]">
                  <span className="material-symbols-outlined text-4xl">{gender === 'Male' ? 'man_2' : 'woman_2'}</span>
                </div>
                <span className="flex-1">
                  <span className="block text-base font-black">{gender === 'Male' ? 'Menswear' : 'Womenswear'}</span>
                  <span className={`mt-1 block text-xs ${muted}`}>Style for {gender === 'Male' ? 'men' : 'women'}</span>
                </span>
                <span className="material-symbols-outlined text-[#a855f7]">check</span>
              </button>
            ))}
            <button onClick={() => setProfile({ gender: 'Female' })} className="flex min-h-24 items-center gap-4 rounded-xl border border-[#3b3158] bg-[#171827] p-3 text-left transition hover:border-[#a855f7]">
              <div className="flex h-16 w-20 items-center justify-center rounded-lg bg-gradient-to-br from-[#312047] to-[#090a13] text-[#d8b4fe]">
                <span className="material-symbols-outlined text-4xl">diversity_3</span>
              </div>
              <span className="flex-1">
                <span className="block text-base font-black">Both</span>
                <span className={`mt-1 block text-xs ${muted}`}>Style for everyone</span>
              </span>
            </button>
          </div>
        </motion.section>
      )}

      {profile.gender && !profile.size && (
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className={`rounded-[28px] p-5 ${darkPanel}`}>
          <h2 className="mt-4 text-center text-2xl font-black">What's your size?</h2>
          <p className={`mx-auto mt-1 max-w-[190px] text-center text-xs ${muted}`}>This helps us personalize your styling experience</p>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {sizes.map((size) => (
              <button key={size} onClick={() => setProfile((prev) => ({ ...prev, size }))} className={`h-16 rounded-xl border border-[#292940] bg-[#171827] text-lg font-black text-white transition hover:border-[#a855f7] ${size === 'M' ? purpleButton : ''}`}>
                {size}
              </button>
            ))}
          </div>
        </motion.section>
      )}

      {profile.gender && profile.size && (
        <>
          <section className={`rounded-[28px] p-4 ${darkPanel}`}>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="text-xl font-black leading-tight">Pick a category<br />to add items</h2>
                <p className={`mt-1 text-[11px] ${muted}`}>Build your virtual wardrobe</p>
              </div>
              <button onClick={() => setProfile({})} className="text-xs font-bold text-[#c084fc]">Reset</button>
            </div>
            <div className="mb-3 grid grid-cols-3 rounded-xl border border-[#27233d] bg-[#090a13] p-1 text-[11px] font-bold">
              <button onClick={() => setProfile((prev) => ({ ...prev, gender: 'Male' }))} className={`rounded-lg py-2 ${profile.gender === 'Male' ? 'bg-[#251a3b] text-[#d8b4fe]' : 'text-slate-400'}`}>Menswear</button>
              <button onClick={() => setProfile((prev) => ({ ...prev, gender: 'Female' }))} className={`rounded-lg py-2 ${profile.gender === 'Female' ? 'bg-[#251a3b] text-[#d8b4fe]' : 'text-slate-400'}`}>Womenswear</button>
              <button className="rounded-lg py-2 text-slate-400">Both</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {categories.map((category, index) => (
                <motion.button
                  key={category}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.025 }}
                  onClick={() => {
                    setSelectedCategory(category);
                    setGeneratedItem(null);
                    setScanImage(getScanSample(category));
                    setProcessingStep(0);
                    setMatchedProducts([]);
                  }}
                  className="min-h-24 rounded-xl border border-[#25253a] bg-[#171827] p-2 text-center shadow-sm transition-transform active:scale-[0.98]"
                >
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-[#0d0f1a] text-[#c084fc]">
                    <span className="material-symbols-outlined text-3xl">{categoryIcons[category] || 'checkroom'}</span>
                  </div>
                  <div className="text-[11px] font-black leading-tight">{category}</div>
                </motion.button>
              ))}
            </div>
          </section>

          <section className={`rounded-[28px] p-4 ${darkPanel}`}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">My Wardrobe</h2>
                <p className={`text-[11px] ${muted}`}>{items.length} {items.length === 1 ? 'item' : 'items'}</p>
              </div>
              <span className="rounded-full bg-[#251a3b] px-2.5 py-1 text-[10px] font-black text-[#d8b4fe]">{profile.size}</span>
            </div>
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#25253a] bg-[#0d0f1a] px-3 py-2">
              <span className="material-symbols-outlined text-base text-[#c084fc]">search</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your wardrobe" className="w-full bg-transparent text-xs font-semibold text-white outline-none placeholder:text-slate-500" />
            </div>
            <div className="mb-4 flex gap-2 overflow-x-auto hide-scrollbar">
              {[
                { value: categoryFilter, set: setCategoryFilter, options: categoryOptions, icon: 'category' },
                { value: colorFilter, set: setColorFilter, options: colorOptions, icon: 'palette' },
                { value: patternFilter, set: setPatternFilter, options: patternOptions, icon: 'texture' }
              ].map((filter) => (
                <label key={filter.icon} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#30264c] bg-[#201733] px-3 py-2 text-xs font-bold text-[#d8b4fe]">
                  <span className="material-symbols-outlined text-sm text-[#c084fc]">{filter.icon}</span>
                  <select value={filter.value} onChange={(e) => filter.set(e.target.value)} className="bg-[#201733] outline-none">
                    {filter.options.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>
              ))}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((item) => <div key={item} className="h-48 animate-pulse rounded-xl bg-[#171827]" />)}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#453066] bg-[#141020] p-6 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#201733] text-[#c084fc] shadow-sm">
                  <span className="material-symbols-outlined text-3xl">checkroom</span>
                </div>
                <p className="text-sm font-black">Your wardrobe is ready for its first scan.</p>
                <p className={`mt-1 text-xs ${muted}`}>Choose a category above and add a fabric detail, print, or front portion.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredItems.map((item) => (
                  <button key={item.id} onClick={() => { setEditDraft(null); setSelectedItem(item); }} className="overflow-hidden rounded-xl border border-[#25253a] bg-[#171827] text-left shadow-sm">
                    <div className="flex aspect-[4/5] items-center justify-center bg-[#0d0f1a]">
                      <img src={item.generatedImage} alt={item.category} className="h-full w-full object-contain p-3" />
                    </div>
                    <div className="p-3">
                      <div className="text-sm font-black">{item.category}</div>
                      <div className="mt-1 text-[11px] font-semibold text-slate-500">{item.colors[0]} - {new Date(item.dateAdded).toLocaleDateString()}</div>
                      <div className="mt-3 flex gap-1.5">
                        {['visibility', 'edit', 'delete'].map((icon) => <span key={icon} className="flex h-7 w-7 items-center justify-center rounded-full bg-[#251a3b] text-[#c084fc]"><span className="material-symbols-outlined text-sm">{icon}</span></span>)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className={`rounded-[28px] p-4 ${darkPanel}`}>
            <h2 className="text-lg font-black">My Closet Insights</h2>
            <p className={`text-[11px] ${muted}`}>Based on your wardrobe</p>
            <div className="mt-3 rounded-xl bg-[#171827] p-3">
              <div className="mb-2 text-xs font-black text-[#d8b4fe]">Overview</div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><div className="text-2xl font-black">{items.length}</div><div className="text-[10px] text-slate-400">Total Items</div></div>
                <div><div className="text-2xl font-black">{Math.max(0, categoryOptions.length - 1)}</div><div className="text-[10px] text-slate-400">Categories</div></div>
                <div><div className="text-2xl font-black">{totalOutfits}</div><div className="text-[10px] text-slate-400">Outfits Created</div></div>
              </div>
            </div>
            <div className="mt-3 space-y-2 rounded-xl bg-[#171827] p-3 text-xs font-semibold text-slate-200">
              {[
                ['apparel', `You own ${tops.length} tops.`],
                ['palette', `Most common color: ${mostCommonColor}`],
                ['schedule', items.length ? `${items.filter((item) => !item.timesWorn).length} pieces are waiting for their first wear.` : 'Add pieces to unlock wear insights.'],
                ['insights', items.length ? `${Math.round((tops.length / items.length) * 100)}% of your wardrobe is top wear.` : 'Your insights will appear here.']
              ].map(([icon, text]) => (
                <div key={text} className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-base text-[#c084fc]">{icon}</span>
                  <span className="flex-1">{text}</span>
                </div>
              ))}
              <div className="h-2 overflow-hidden rounded-full bg-[#0d0f1a]">
                <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-[#8b4cf6] to-[#e879f9]" />
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-[#171827] p-3">
              <div className="mb-3 text-xs font-black">Color Distribution</div>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-[conic-gradient(#8b5cf6_0_35%,#5468f4_35%_62%,#f8fafc_62%_78%,#111827_78%_100%)] p-4">
                  <div className="h-full w-full rounded-full bg-[#171827]" />
                </div>
                <div className="flex-1 space-y-1">
                  {colorStats.map(([label, value, color]) => (
                    <div key={label} className="flex items-center gap-2 text-[11px] text-slate-300">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: String(color) }} />
                      <span className="flex-1">{label}</span>
                      <span>{value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className={`rounded-[28px] p-4 ${darkPanel}`}>
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-lg font-black">New fits for you</h2><p className={`text-[11px] ${muted}`}>Made only from what you own</p></div>
              {outfitIdeas.length > 1 && <button onClick={() => setOutfitIndex((index) => index + 1)} className="rounded-lg bg-[#251a3b] px-3 py-2 text-[11px] font-black text-[#d8b4fe]">Shuffle</button>}
            </div>
            {currentOutfit ? (
              <div className="mt-3 rounded-2xl bg-[#171827] p-3">
                <div className="flex gap-2">{currentOutfit.items.map((item) => <img key={item.id} src={item.generatedImage} alt={item.category} className="h-20 w-16 rounded-xl bg-[#0d0f1a] object-contain p-1" />)}</div>
                <p className="mt-3 text-sm font-black">{currentOutfit.title}</p><p className={`mt-1 text-xs ${muted}`}>{currentOutfit.note}</p>
                <button onClick={() => markOutfitWorn(currentOutfit.items)} className={`mt-3 w-full rounded-xl py-2.5 text-xs font-black ${purpleButton}`}>I wore this fit</button>
              </div>
            ) : <div className="mt-3 rounded-2xl border border-dashed border-[#453066] p-4 text-center text-xs text-slate-400">Add a top and a bottom to unlock outfit ideas.</div>}
          </section>
        </>
      )}

      <AnimatePresence>
        {selectedCategory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3">
            <motion.section initial={{ y: 420 }} animate={{ y: 0 }} exit={{ y: 420 }} className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#080913] p-4 text-white shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-black">Add {selectedCategory}</h2>
                <button onClick={() => setSelectedCategory(null)} className="h-9 w-9 rounded-full bg-[#171827]"><span className="material-symbols-outlined text-base">close</span></button>
              </div>
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-[#111220] p-1">
                {(['Live Scan', 'Upload Photo'] as WardrobeScanMethod[]).map((method) => (
                  <button key={method} onClick={() => setScanMethod(method)} className={`rounded-lg py-2 text-xs font-black ${scanMethod === method ? purpleButton : 'text-slate-400'}`}>
                    <span className="material-symbols-outlined mr-1 align-middle text-sm">{method === 'Live Scan' ? 'camera_alt' : 'photo_library'}</span>{method}
                  </button>
                ))}
              </div>
              <label className="mb-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#7041a8] bg-[#201733] p-4 text-xs font-black text-[#d8b4fe]">
                <span className="material-symbols-outlined">{scanMethod === 'Live Scan' ? 'photo_camera' : 'upload'}</span>
                {scanMethod === 'Live Scan' ? 'Take a photo of your garment' : 'Upload a garment photo'}
                <input type="file" accept="image/*" capture={scanMethod === 'Live Scan' ? 'environment' : undefined} onChange={handleFile} className="hidden" />
              </label>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-3 shadow-2xl shadow-purple-950/20 backdrop-blur-2xl">
                <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-[#10111f]/85 p-3">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(168,85,247,.28),transparent_32%),radial-gradient(circle_at_100%_80%,rgba(59,130,246,.18),transparent_35%)]" />
                  <p className="relative z-10 mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Scanned Garment Detail</p>
                  <div className="relative z-10 aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-[#070812]">
                    <img src={scanImage} alt="Scanned garment detail" className="h-full w-full object-contain bg-[#f8fafc]"/>
                    <motion.div animate={{ y: ['-20%', '110%'] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }} className="absolute left-0 right-0 top-0 h-16 bg-gradient-to-b from-transparent via-[#c084fc]/35 to-transparent" />
                    {[
                      'left-3 top-3 border-l-2 border-t-2',
                      'right-3 top-3 border-r-2 border-t-2',
                      'bottom-3 left-3 border-b-2 border-l-2',
                      'bottom-3 right-3 border-b-2 border-r-2'
                    ].map((corner) => (
                      <span key={corner} className={`absolute h-10 w-10 rounded-sm border-[#d8b4fe] ${corner}`} />
                    ))}
                    <div className="absolute left-4 top-5 rounded-full border border-emerald-300/40 bg-emerald-400/15 px-2 py-1 text-[9px] font-black text-emerald-200">PATTERN LOCK</div>
                    <div className="absolute bottom-4 right-4 rounded-full border border-[#c084fc]/40 bg-[#a855f7]/20 px-2 py-1 text-[9px] font-black text-[#f5d0fe]">AI 98%</div>
                  </div>
                </div>

                <div className="relative my-4 flex items-center justify-center">
                  <div className="absolute h-px w-full bg-gradient-to-r from-transparent via-[#8b5cf6]/50 to-transparent" />
                  <motion.div animate={{ scale: [1, 1.08, 1], boxShadow: ['0 0 18px rgba(168,85,247,.35)', '0 0 34px rgba(168,85,247,.75)', '0 0 18px rgba(168,85,247,.35)'] }} transition={{ duration: 1.8, repeat: Infinity }} className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-[#d8b4fe]/40 bg-gradient-to-br from-[#7c3aed] to-[#e879f9]">
                    <span className="material-symbols-outlined text-2xl">keyboard_arrow_down</span>
                  </motion.div>
                </div>

                <div className="grid gap-2 rounded-2xl border border-[#30264c] bg-[#111220]/80 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c084fc]">AI Analysis</p>
                      <p className="mt-1 text-xs font-semibold text-slate-300">Fabric Detail to Garment Generation</p>
                    </div>
                    {isProcessing ? <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#a855f7] border-t-transparent" /> : <span className="material-symbols-outlined text-[#c084fc]">auto_awesome</span>}
                  </div>
                  <div className="space-y-2">
                    {processingSteps.map((step, index) => {
                      const isActive = index === processingStep && (isProcessing || matchedProducts.length > 0);
                      const isDone = matchedProducts.length > 0 ? true : index < processingStep;
                      return (
                        <div key={step} className="flex items-center gap-3 text-[11px] font-bold">
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${isDone ? 'border-emerald-300 bg-emerald-400/20 text-emerald-200' : isActive ? 'border-[#c084fc] bg-[#a855f7]/25 text-[#f5d0fe]' : 'border-slate-700 text-slate-600'}`}>
                            {isDone ? <span className="material-symbols-outlined text-[13px]">check</span> : index + 1}
                          </span>
                          <span className={isDone || isActive ? 'text-slate-100' : 'text-slate-500'}>{step}</span>
                          {isActive && isProcessing && <motion.span animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 1.1, repeat: Infinity }} className="ml-auto h-1.5 w-1.5 rounded-full bg-[#c084fc]" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-[20px] border border-white/10 bg-[#090a13] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Generated Garment</p>
                    <span className="rounded-full bg-[#251a3b] px-2 py-1 text-[9px] font-black text-[#d8b4fe]">Catalog Mockup</span>
                  </div>
                  <div className="relative flex aspect-[4/5] items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_50%_18%,rgba(168,85,247,.2),transparent_35%),linear-gradient(180deg,#141629,#090a13)]">
                    {isProcessing ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                        <div className="mx-auto mb-3 h-12 w-12 animate-spin rounded-full border-2 border-[#a855f7] border-t-transparent" />
                        <p className="text-xs font-black text-[#d8b4fe]">{processingSteps[processingStep]}</p>
                      </motion.div>
                    ) : processedImage ? (
                      <motion.img
                        initial={{ opacity: 0, y: 24, scale: 0.94 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.45 }}
                        src={processedImage}
                        alt="Processed garment"
                        className="h-full w-full object-contain p-4 drop-shadow-2xl"
                      />
                    ) : generatedItem ? (
                      <motion.img initial={{ opacity: 0, y: 24, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.45, ease: 'easeOut' }} src={generatedItem.generatedImage} alt="Generated garment" className="h-full w-full object-contain p-2 drop-shadow-2xl" />
                    ) : (
                      <div className="text-center text-[#6b4ba0]">
                        <span className="material-symbols-outlined text-5xl">auto_awesome</span>
                        <p className="mt-2 text-xs font-black text-slate-500">Ready to generate</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {matchedProducts.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-[20px] border border-[#30264c] bg-[#171827]/90 p-3">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#c084fc]">
                    {matchedProducts[0].matchType === 'Exact Match' ? 'Exact Matches' : 'Similar Matches (Vector Search)'}
                  </p>
                  <div className="space-y-2">
                    {matchedProducts.map((match) => (
                      <div key={match.productId} className="flex items-center justify-between rounded-xl bg-white/[0.05] p-2 text-xs">
                        <div>
                          <div className="font-bold text-slate-100">{match.subcategory}</div>
                          <div className="text-[10px] text-slate-400">{match.primaryColor} • {match.material}</div>
                        </div>
                        <span className="rounded-full bg-[#251a3b] px-2 py-0.5 text-[10px] font-black text-[#d8b4fe]">
                          {match.matchType} • {match.similarityScore}%
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              <div className="mt-4 flex gap-3">
                <button onClick={handleAnalyze} disabled={isProcessing} className="flex-1 rounded-xl border border-[#30264c] bg-[#171827] py-3 text-xs font-black text-white shadow-lg disabled:opacity-60">AI Smart Scan</button>
                <button onClick={saveItem} disabled={!generatedItem} className={`flex-1 rounded-xl py-3 text-xs font-black disabled:opacity-40 ${purpleButton}`}>Save Item</button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3">
            <motion.section initial={{ y: 420 }} animate={{ y: 0 }} exit={{ y: 420 }} className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#080913] p-4 text-white shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-black">{selectedItem.category}</h2>
                <button onClick={() => { setEditDraft(null); setSelectedItem(null); }} className="h-9 w-9 rounded-full bg-[#171827]"><span className="material-symbols-outlined text-base">close</span></button>
              </div>
              <div className="rounded-[24px] bg-[#0d0f1a] p-4">
                <img src={selectedItem.generatedImage} alt={selectedItem.category} className="mx-auto h-72 w-full object-contain" />
              </div>
              {editDraft ? (
                <div className="mt-4 space-y-3 rounded-2xl bg-[#171827] p-3">
                  <p className="text-xs font-black text-[#d8b4fe]">Correct the scan details</p>
                  {[
                    ['Category', 'category'], ['Primary color', 'primaryColor'], ['Secondary color', 'secondaryColor'],
                    ['Pattern', 'pattern'], ['Fabric', 'fabric'], ['Neckline', 'neckType'], ['Sleeve', 'sleeveType']
                  ].map(([label, field]) => {
                    const attributeFields = ['primaryColor', 'secondaryColor', 'neckType', 'sleeveType'];
                    const value = attributeFields.includes(field) ? editDraft.attributes[field as keyof WardrobeDetectedAttributes] : editDraft[field as keyof WardrobeItem] as string;
                    return <label key={field} className="block text-[10px] font-black uppercase tracking-wider text-slate-400">{label}
                      <input value={value || ''} onChange={(event) => setEditDraft((draft) => !draft ? draft : attributeFields.includes(field)
                        ? { ...draft, attributes: { ...draft.attributes, [field]: event.target.value }, ...(field === 'primaryColor' ? { colors: [event.target.value, ...draft.colors.slice(1)] } : {}) }
                        : { ...draft, [field]: event.target.value })} className="mt-1 w-full rounded-lg border border-[#37304d] bg-[#0d0f1a] px-3 py-2 text-xs font-semibold normal-case text-white outline-none focus:border-[#a855f7]" />
                    </label>;
                  })}
                  <div className="grid grid-cols-2 gap-2 pt-1"><button onClick={() => setEditDraft(null)} className="rounded-xl border border-[#334155] py-3 text-xs font-black">Cancel</button><button onClick={() => { if (editDraft) { updateItem({ ...editDraft, colors: [editDraft.attributes.primaryColor, ...(editDraft.attributes.secondaryColor !== '—' ? [editDraft.attributes.secondaryColor] : [])], pattern: editDraft.pattern, fabric: editDraft.fabric }); setEditDraft(null); setSaveStatus('Garment details updated.'); } }} className={`rounded-xl py-3 text-xs font-black ${purpleButton}`}>Save changes</button></div>
                </div>
              ) : <>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  ['Category', selectedItem.category],
                  ['Color', selectedItem.colors.join(', ')],
                  ['Pattern', selectedItem.pattern],
                  ['Fabric', selectedItem.fabric],
                  ...(isBottomWear(selectedItem.category)
                    ? [['Rise', selectedItem.attributes.rise || 'Not specified'], ['Length', selectedItem.attributes.length || 'Not specified']]
                    : [['Neck', selectedItem.attributes.neckType], ['Sleeve', selectedItem.attributes.sleeveType]]),
                  ['Size', selectedItem.size],
                  ['Date Added', new Date(selectedItem.dateAdded).toLocaleDateString()]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-[#171827] p-3">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</div>
                    <div className="mt-1 text-xs font-black text-slate-100">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => onNavigate('ar-tryon')} className={`rounded-xl py-3 text-xs font-black ${purpleButton}`}>Wear Virtually</button>
                <button onClick={() => openOutfitBuilder(selectedItem)} className="rounded-xl border border-[#7041a8] py-3 text-xs font-black text-white">Create Outfit</button>
                <button onClick={() => setEditDraft({ ...selectedItem, attributes: { ...selectedItem.attributes }, colors: [...selectedItem.colors], tags: [...selectedItem.tags] })} className="rounded-xl border border-[#334155] py-3 text-xs font-black text-slate-200">Edit</button>
                <button onClick={() => deleteItem(selectedItem)} className="rounded-xl border border-rose-500/35 bg-rose-950/20 py-3 text-xs font-black text-rose-400">Delete</button>
              </div>
              </>}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {outfitSeed && (() => {
          const needsBottom = topCategories.includes(outfitSeed.category);
          const needsTop = bottomCategories.includes(outfitSeed.category);
          const partners = items.filter((item) => item.id !== outfitSeed.id && (needsBottom ? bottomCategories.includes(item.category) : needsTop ? topCategories.includes(item.category) : true));
          return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/70 p-3">
            <motion.section initial={{ y: 420 }} animate={{ y: 0 }} exit={{ y: 420 }} className="max-h-[82vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#080913] p-4 text-white shadow-2xl">
              <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#c084fc]">Outfit builder</p><h2 className="mt-1 text-xl font-black">Complete this look</h2></div><button onClick={() => setOutfitSeed(null)} className="h-9 w-9 rounded-full bg-[#171827]"><span className="material-symbols-outlined">close</span></button></div>
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#171827] p-3"><img src={outfitSeed.generatedImage} alt={outfitSeed.category} className="h-20 w-16 rounded-xl bg-[#0d0f1a] object-contain"/><div><p className="font-black">{outfitSeed.colors[0]} {outfitSeed.category}</p><p className="mt-1 text-xs text-slate-400">Pick {needsBottom ? 'a bottom' : needsTop ? 'a top' : 'another piece'} from your wardrobe.</p></div></div>
              {partners.length ? <div className="mt-4 grid grid-cols-2 gap-3">{partners.map((item) => <button key={item.id} onClick={() => setOutfitPartnerId(item.id)} className={`overflow-hidden rounded-xl border p-2 text-left ${outfitPartnerId === item.id ? 'border-[#c084fc] bg-[#251a3b]' : 'border-[#30264c] bg-[#171827]'}`}><img src={item.generatedImage} alt={item.category} className="h-28 w-full rounded-lg bg-[#0d0f1a] object-contain"/><p className="mt-2 text-xs font-black">{item.colors[0]} {item.category}</p></button>)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-[#7041a8] p-5 text-center text-sm text-slate-400">You need to add {needsBottom ? 'a bottom' : needsTop ? 'a top' : 'another item'} before creating this outfit.</div>}
              <button disabled={!outfitPartnerId && partners.length > 0} onClick={partners.length ? saveCreatedOutfit : () => setOutfitSeed(null)} className={`mt-4 w-full rounded-xl py-3 text-sm font-black disabled:opacity-40 ${purpleButton}`}>{partners.length ? 'Save this outfit' : 'Close'}</button>
            </motion.section>
          </motion.div>;
        })()}
      </AnimatePresence>
    </div>
  );
};

export default VirtualWardrobeView;
