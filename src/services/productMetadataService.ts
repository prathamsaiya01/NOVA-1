import { ProductItem } from '../types';
import { 
  getFirestore, 
  collection, 
  getDocs,
  query,
  where,
  limit
} from 'firebase/firestore';
import { app } from '../firebase';

export interface RuntimeProductMetadata {
  productId: string;
  category: string;
  subcategory: string;
  gender: string;
  primaryColor: string;
  secondaryColor: string;
  pattern: string;
  sleeveType: string;
  neckType: string;
  fit: string;
  material: string;
  confidence: number;
  searchableText: string;
  imageUrl?: string;
  name?: string;
  price?: number;
}

export interface RuntimeProductVectorMetadata extends RuntimeProductMetadata {
  embedding?: number[];
}

export type ProductMatchType = 'Exact Match' | 'Similar Match';

export interface ProductMatch extends RuntimeProductMetadata {
  matchType: ProductMatchType;
  similarityScore: number;
}

export interface ScannedProductAttributes {
  category?: unknown;
  primaryColor?: unknown;
  subcategory?: unknown;
  pattern?: unknown;
  sleeveType?: unknown;
  neckType?: unknown;
  fit?: unknown;
  material?: unknown;
}

const metadataCache = new Map<string, RuntimeProductMetadata>();

const normalizeText = (value: unknown) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const titleCase = (value: string) => value.replace(/\b\w/g, (char) => char.toUpperCase());

const safeArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
};

const safeNumber = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const safeProduct = (value: Record<string, unknown>, id: string): ProductItem => ({
  ...(value as Partial<ProductItem>),
  id,
  name: String(value.name || 'Unnamed product'),
  category: String(value.category || value.subcategory || 'Unknown'),
  price: safeNumber(value.price),
  rating: safeNumber(value.rating),
  reviewsCount: safeNumber(value.reviewsCount),
  imageUrl: String(value.imageUrl || value.mainImage || safeArray(value.images)[0] || ''),
  colors: safeArray(value.colors),
  sizes: safeArray(value.sizes),
  details: safeArray(value.details),
  tags: safeArray(value.tags),
  inStock: Boolean(value.inStock)
});

const imageFilename = (value: unknown) => {
  const url = String(value || '');
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.split('/').pop() || '');
  } catch {
    return decodeURIComponent(url.split(/[\\/]/).pop()?.split('?')[0] || '');
  }
};

const buildSearchableText = (product: ProductItem) => {
  const loose = product as ProductItem & Record<string, unknown>;
  return [
    product.name,
    product.description,
    product.category,
    product.subcategory,
    product.brand,
    product.fabric,
    product.fit,
    product.gender,
    product.pattern,
    product.sleeveType,
    product.neckType,
    ...safeArray(product.details),
    ...safeArray(product.tags),
    ...safeArray(loose.searchKeywords),
    ...safeArray(loose.keywords),
    loose.searchableText,
    imageFilename(product.imageUrl || product.mainImage || product.images?.[0])
  ].filter(Boolean).join(' ');
};

const colorNames = [
  'Navy Blue', 'Sky Blue', 'Royal Blue', 'Baby Blue', 'Denim Blue', 'Forest Green', 'Olive Green', 'Mint Green',
  'Off White', 'Cream', 'Beige', 'Charcoal', 'Silver', 'Maroon', 'Wine', 'Mustard', 'Lavender', 'Lilac',
  'Peach', 'Coral', 'Black', 'White', 'Grey', 'Gray', 'Blue', 'Green', 'Red', 'Pink', 'Purple', 'Yellow',
  'Orange', 'Brown', 'Tan'
];

const colorAliases = new Map<string, string>([
  ['navy', 'Navy Blue'],
  ['sky', 'Sky Blue'],
  ['royal', 'Royal Blue'],
  ['baby blue', 'Baby Blue'],
  ['denim', 'Denim Blue'],
  ['olive', 'Olive Green'],
  ['forest', 'Forest Green'],
  ['mint', 'Mint Green'],
  ['off white', 'Off White'],
  ['offwhite', 'Off White'],
  ['ivory', 'Off White'],
  ['gray', 'Grey'],
  ['wine', 'Wine'],
  ['maroon', 'Maroon'],
  ['mustard', 'Mustard'],
  ['lavender', 'Lavender'],
  ['lilac', 'Lilac'],
  ['peach', 'Peach'],
  ['coral', 'Coral']
]);

const inferColors = (product: ProductItem, text: string) => {
  const explicitColors = safeArray(product.colors).filter((color) => normalizeText(color) !== 'standard');
  const matches = colorNames.filter((color) => text.includes(normalizeText(color)));
  colorAliases.forEach((canonical, alias) => {
    if (text.includes(alias) && !matches.includes(canonical)) matches.push(canonical);
  });
  const colors = [...explicitColors, ...matches].filter((value, index, arr) => arr.findIndex((entry) => normalizeText(entry) === normalizeText(value)) === index);
  return {
    primaryColor: colors[0] || 'Standard',
    secondaryColor: colors[1] || colors[0] || 'Standard',
    confident: colors.length > 0
  };
};

const inferGender = (product: ProductItem, text: string) => {
  if (product.gender) return { value: product.gender, confident: true };
  if (/\b(women|woman|female|ladies|lady|womens)\b/.test(text)) return { value: 'Women', confident: true };
  if (/\b(men|man|male|mens|gentlemen|gents)\b/.test(text)) return { value: 'Men', confident: true };
  if (/\b(unisex)\b/.test(text)) return { value: 'Unisex', confident: true };
  return { value: 'Unisex', confident: false };
};

const normalizeSubcategory = (text: string, gender: string) => {
  if (text.includes('hooded sweatshirt')) return 'Hoodie';
  if (text.includes('oversize') || text.includes('oversized')) {
    if (text.includes('hood')) return 'Oversized Hoodie';
    if (text.includes('tee') || text.includes('tshirt') || text.includes('t shirt') || text.includes('tee shirt')) return 'Oversized T-Shirt';
  }
  if (text.includes('crop')) return 'Crop Top';
  if (text.includes('tube top')) return 'Tube Top';
  if (text.includes('tank')) return 'Tank Top';
  if (text.includes('tee shirt') || text.includes('tshirt') || text.includes('t shirt') || /\btee\b/.test(text)) return 'T-Shirt';
  if (text.includes('polo')) return 'Polo Shirt';
  if (text.includes('henley')) return 'Henley';
  if (text.includes('formal shirt')) return 'Formal Shirt';
  if (text.includes('casual shirt')) return 'Casual Shirt';
  if (text.includes('hoodie') || text.includes('hooded')) return 'Hoodie';
  if (text.includes('sweatshirt')) return 'Sweatshirt';
  if (text.includes('sweater')) return 'Sweater';
  if (text.includes('nehru')) return 'Nehru Jacket';
  if (text.includes('blazer')) return 'Blazer';
  if (text.includes('jacket') || text.includes('coat')) return 'Jacket';
  if (text.includes('ladies kurti') || text.includes('kurti')) return 'Kurti';
  if (text.includes('mens kurta') || text.includes('men kurta') || text.includes('kurta')) return normalizeText(gender) === 'women' ? 'Kurti' : 'Kurta';
  if (text.includes('sherwani')) return 'Sherwani';
  if (text.includes('pathani')) return 'Pathani Suit';
  if (text.includes('dhoti')) return 'Dhoti';
  if (text.includes('saree') || text.includes('sari')) return 'Saree';
  if (text.includes('lehenga')) return 'Lehenga';
  if (text.includes('salwar')) return 'Salwar Suit';
  if (text.includes('dupatta')) return 'Dupatta';
  if (text.includes('maxi')) return 'Maxi Dress';
  if (text.includes('mini')) return 'Mini Dress';
  if (text.includes('gown')) return 'Gown';
  if (text.includes('jumpsuit')) return 'Jumpsuit';
  if (text.includes('dress')) return 'Dress';
  if (text.includes('cargo')) return 'Cargo Pants';
  if (text.includes('jogger')) return 'Joggers';
  if (text.includes('track pant')) return 'Track Pants';
  if (text.includes('chino')) return 'Chinos';
  if (text.includes('palazzo')) return 'Palazzo';
  if (text.includes('legging')) return 'Leggings';
  if (text.includes('jean') || text.includes('denim pant')) return 'Jeans';
  if (text.includes('trouser') || text.includes('pant')) return 'Trousers';
  if (text.includes('shorts')) return 'Shorts';
  if (text.includes('skirt')) return 'Skirt';
  if (text.includes('blouse')) return 'Blouse';
  if (text.includes('shirt')) return 'Shirt';
  return '';
};

const topWear = new Set(['t shirt', 'oversized t shirt', 'polo shirt', 'henley', 'casual shirt', 'formal shirt', 'shirt', 'kurta', 'kurti', 'hoodie', 'oversized hoodie', 'sweatshirt', 'sweater', 'jacket', 'blazer', 'nehru jacket', 'crop top', 'tank top', 'tube top', 'blouse']);
const bottomWear = new Set(['jeans', 'cargo pants', 'joggers', 'track pants', 'shorts', 'trousers', 'chinos', 'palazzo', 'leggings', 'skirt', 'dhoti']);
const fullBody = new Set(['saree', 'lehenga', 'salwar suit', 'dress', 'maxi dress', 'mini dress', 'gown', 'jumpsuit', 'sherwani', 'pathani suit']);

const categoryForSubcategory = (subcategory: string, fallback: string) => {
  const normalized = normalizeText(subcategory || fallback);
  if (topWear.has(normalized)) return 'Top Wear';
  if (bottomWear.has(normalized)) return 'Bottom Wear';
  if (fullBody.has(normalized)) return 'Full Body';
  return titleCase(normalized || 'Unknown');
};

const inferPattern = (product: ProductItem, text: string) => {
  if (product.pattern) return { value: product.pattern, confident: true };
  if (text.includes('floral')) return { value: 'Floral', confident: true };
  if (text.includes('paisley')) return { value: 'Paisley', confident: true };
  if (text.includes('ethnic print')) return { value: 'Ethnic Print', confident: true };
  if (text.includes('graphic')) return { value: 'Graphic', confident: true };
  if (text.includes('stripe')) return { value: 'Striped', confident: true };
  if (text.includes('check')) return { value: 'Checked', confident: true };
  if (text.includes('embroider')) return { value: 'Embroidered', confident: true };
  if (text.includes('tie dye')) return { value: 'Tie Dye', confident: true };
  if (text.includes('abstract')) return { value: 'Abstract', confident: true };
  if (text.includes('texture')) return { value: 'Textured', confident: true };
  if (text.includes('print')) return { value: 'Printed', confident: true };
  if (text.includes('solid') || text.includes('plain')) return { value: 'Solid', confident: true };
  return { value: 'Solid', confident: false };
};

const inferSleeve = (product: ProductItem, text: string, subcategory: string) => {
  if (product.sleeveType) return { value: product.sleeveType, confident: true };
  if (bottomWear.has(normalizeText(subcategory))) return { value: 'Not applicable', confident: true };
  if (text.includes('sleeveless') || text.includes('tank') || text.includes('tube top')) return { value: 'Sleeveless', confident: true };
  if (text.includes('3 4 sleeve') || text.includes('three quarter')) return { value: '3/4 Sleeve', confident: true };
  if (text.includes('half sleeve') || text.includes('short sleeve')) return { value: 'Half Sleeve', confident: true };
  if (text.includes('full sleeve') || text.includes('long sleeve')) return { value: 'Full Sleeve', confident: true };
  if (['Hoodie', 'Oversized Hoodie', 'Sweatshirt', 'Sweater', 'Jacket', 'Blazer', 'Kurta', 'Kurti'].includes(subcategory)) return { value: 'Full Sleeve', false: true };
  return { value: 'Regular', confident: false };
};

const inferNeck = (product: ProductItem, text: string, subcategory: string) => {
  if (product.neckType) return { value: product.neckType, confident: true };
  if (text.includes('hood')) return { value: 'Hooded', confident: true };
  if (text.includes('v neck')) return { value: 'V Neck', confident: true };
  if (text.includes('crew')) return { value: 'Crew Neck', confident: true };
  if (text.includes('round')) return { value: 'Round Neck', confident: true };
  if (text.includes('mandarin') || ['Kurta', 'Kurti', 'Nehru Jacket'].includes(subcategory)) return { value: 'Mandarin', confident: text.includes('mandarin') };
  if (text.includes('collar') || ['Polo Shirt', 'Casual Shirt', 'Formal Shirt', 'Shirt', 'Blazer'].includes(subcategory)) return { value: 'Collar', confident: text.includes('collar') };
  return { value: 'Round Neck', confident: false };
};

const inferFit = (product: ProductItem, text: string) => {
  if (product.fit) return { value: product.fit, confident: true };
  if (text.includes('oversized') || text.includes('oversize')) return { value: 'Oversized', confident: true };
  if (text.includes('relaxed')) return { value: 'Relaxed Fit', confident: true };
  if (text.includes('slim')) return { value: 'Slim Fit', confident: true };
  if (text.includes('skinny')) return { value: 'Skinny', confident: true };
  if (text.includes('straight')) return { value: 'Straight', confident: true };
  if (text.includes('loose')) return { value: 'Loose', confident: true };
  return { value: 'Regular Fit', confident: false };
};

const inferMaterial = (product: ProductItem, text: string) => {
  if (product.fabric) return { value: product.fabric, confident: true };
  const materials = ['organic cotton', 'cotton', 'polyester', 'linen', 'rayon', 'denim', 'silk', 'wool', 'viscose', 'nylon', 'lycra', 'spandex', 'leather'];
  const match = materials.find((material) => text.includes(material));
  if (match) return { value: titleCase(match), confident: true };
  return { value: 'Blend', confident: false };
};

export const getRuntimeProductMetadata = (product: ProductItem): RuntimeProductMetadata => {
  const loose = product as ProductItem & Record<string, unknown>;
  const cacheKey = `${product.id}:${loose.updatedAt || product.createdAt || product.imageUrl || product.name}`;
  const cached = metadataCache.get(cacheKey);
  if (cached) return cached;

  const searchableText = buildSearchableText(product);
  const text = normalizeText(searchableText);
  const gender = inferGender(product, text);
  const subcategory = normalizeSubcategory(`${normalizeText(product.subcategory)} ${text}`, gender.value) || product.subcategory || product.category || 'Unknown';
  const category = categoryForSubcategory(subcategory, product.category);
  const colors = inferColors(product, text);
  const pattern = inferPattern(product, text);
  const sleeveType = inferSleeve(product, text, subcategory);
  const neckType = inferNeck(product, text, subcategory);
  const fit = inferFit(product, text);
  const material = inferMaterial(product, text);
  const confidenceSignals = [
    Boolean(subcategory && subcategory !== product.category),
    gender.confident,
    colors.confident,
    pattern.confident,
    sleeveType.confident,
    neckType.confident,
    fit.confident,
    material.confident
  ].filter(Boolean).length;

  const metadata: RuntimeProductMetadata = {
    productId: product.id,
    name: product.name,
    imageUrl: product.imageUrl,
    price: product.price,
    category,
    subcategory,
    gender: gender.value,
    primaryColor: colors.primaryColor,
    secondaryColor: colors.secondaryColor,
    pattern: pattern.value,
    sleeveType: sleeveType.value,
    neckType: neckType.value,
    fit: fit.value,
    material: material.value,
    confidence: Math.min(96, 48 + confidenceSignals * 6),
    searchableText
  };

  metadataCache.set(cacheKey, metadata);
  return metadata;
};

export const primeRuntimeProductMetadata = (products: ProductItem[]) => {
  products.forEach((product) => getRuntimeProductMetadata(product));
};

export const clearRuntimeProductMetadataCache = () => {
  metadataCache.clear();
};

function cosineSimilarity(vecA: unknown, vecB: unknown): number {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length || !vecA.length) return 0;
  if (!vecA.every((value) => Number.isFinite(value)) || !vecB.every((value) => Number.isFinite(value))) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    const valueA = Number(vecA[i]);
    const valueB = Number(vecB[i]);
    dotProduct += valueA * valueB;
    normA += valueA * valueA;
    normB += valueB * valueB;
  }
  return normA && normB ? dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

/**
 * Dynamic pairing logic: Top Wear -> Bottom Wear (and vice versa)
 */
export async function getPairedItem(scannedCategory: string, primaryColor: string) {
  let targetCategory = 'Bottom Wear';
  
  const categoryLower = (scannedCategory || '').toLowerCase();
  if (
    categoryLower.includes('bottom') || 
    categoryLower.includes('jeans') || 
    categoryLower.includes('pants') || 
    categoryLower.includes('skirt')
  ) {
    targetCategory = 'Top Wear';
  } else if (
    categoryLower.includes('top') || 
    categoryLower.includes('shirt') || 
    categoryLower.includes('kurti') ||
    categoryLower.includes('crop')
  ) {
    targetCategory = 'Bottom Wear';
  }

  try {
    const db = getFirestore(app);
    const productsRef = collection(db, 'products');
    const q = query(
      productsRef,
      where('category', '==', targetCategory),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data() as Record<string, unknown>;
      return safeProduct(data, doc.id);
    }
  } catch (error) {
    console.warn('⚠️ Error fetching paired item from Firestore:', error);
  }

  return {
    id: 'default-jeans',
    name: 'Blue Denim Jeans',
    category: 'Bottom Wear',
    price: 1299,
    imageUrl: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=500'
  };
}

/**
 * Executes visual comparison with exact match fallback logic.
 */
export const findSimilarProductsByVector = async (
  queryEmbedding: unknown,
  scannedAttributesOrLimit: ScannedProductAttributes | number = {},
  limitCount: number = 5
): Promise<ProductMatch[]> => {
  try {
    const scannedAttributes = typeof scannedAttributesOrLimit === 'number' ? {} : scannedAttributesOrLimit;
    const resultLimit = typeof scannedAttributesOrLimit === 'number' ? scannedAttributesOrLimit : limitCount;
    const db = getFirestore(app);
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);

    const products = snapshot.docs.map((productDoc) => {
      const data = productDoc.data() as Record<string, unknown>;
      const product = safeProduct(data, productDoc.id);
      return { data, metadata: getRuntimeProductMetadata(product) };
    });

    const requestedCategory = normalizeText(scannedAttributes.category);
    const requestedColor = normalizeText(scannedAttributes.primaryColor);
    
    const exactProducts = requestedCategory && requestedColor
      ? products.filter(({ metadata }) => (
        normalizeText(metadata.category) === requestedCategory &&
        normalizeText(metadata.primaryColor) === requestedColor
      ))
      : [];

    if (exactProducts.length > 0) {
      return exactProducts.slice(0, resultLimit).map(({ metadata }) => ({
        ...metadata,
        matchType: 'Exact Match',
        similarityScore: 100
      }));
    }

    const rankedProducts = products
      .map(({ data, metadata }) => ({
        product: metadata,
        score: cosineSimilarity(queryEmbedding, data.embedding)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, resultLimit)
      .map((item) => ({
        ...item.product,
        matchType: 'Similar Match' as const,
        similarityScore: Math.max(0, Math.min(100, Math.round(item.score * 100)))
      }));

    return rankedProducts;
  } catch (error) {
    console.error('Error fetching visually similar products from Firestore:', error);
    throw error;
  }
};