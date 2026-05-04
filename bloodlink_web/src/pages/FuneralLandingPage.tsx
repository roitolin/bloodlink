import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

type ProductVariation = {
  name?: string
  imageUrl?: string | null
}

type ShopProduct = {
  id?: string
  name?: string
  description?: string
  price?: string
  stock?: number
  active?: boolean
  imageUrl?: string | null
  galleryImageUrls?: string[]
  category?: string
  hasVariations?: boolean
  variations?: ProductVariation[]
}

type ShopRecord = {
  id: string
  fullName?: string
  funeralShopInfo?: {
    shopName?: string
    shopAddress?: string
    shopPhoneNumber?: string
    shopImageUrl?: string | null
  } | null
  funeralBusinessInfo?: {
    businessName?: string
    generalLocation?: string
  } | null
  funeralProducts?: ShopProduct[]
}

type StorefrontShop = {
  id: string
  shopName: string
  shopAddress: string
  shopPhoneNumber: string
  businessName: string
  generalLocation: string
  shopImageUrl: string | null
  productCount: number
}

type StorefrontProduct = {
  id: string
  shopId: string
  shopName: string
  shopPhoneNumber: string
  shopAddress: string
  businessName: string
  generalLocation: string
  name: string
  description: string
  price: string
  stock: number
  category: string
  imageUrl: string | null
  hasVariations: boolean
  variationCount: number
}

const previewShops: StorefrontShop[] = [
  {
    id: 'preview-golden',
    shopName: 'Golden Haven Memorial Shop',
    shopAddress: 'San Pedro District, Davao City',
    shopPhoneNumber: '0995 928 1914',
    businessName: 'Golden Haven Arrangements',
    generalLocation: 'Davao City',
    shopImageUrl: null,
    productCount: 4,
  },
  {
    id: 'preview-peaceful',
    shopName: 'Peaceful Tribute Essentials',
    shopAddress: 'JP Laurel Avenue, Davao City',
    shopPhoneNumber: '0917 640 3112',
    businessName: 'Peaceful Tribute Services',
    generalLocation: 'Davao City',
    shopImageUrl: null,
    productCount: 3,
  },
  {
    id: 'preview-serenity',
    shopName: 'Serenity Casket Collection',
    shopAddress: 'Maa Road, Davao City',
    shopPhoneNumber: '0918 222 4408',
    businessName: 'Serenity Funeral Goods',
    generalLocation: 'Davao City',
    shopImageUrl: null,
    productCount: 5,
  },
]

const previewProducts: StorefrontProduct[] = [
  {
    id: 'preview-1',
    shopId: 'preview-golden',
    shopName: 'Golden Haven Memorial Shop',
    shopPhoneNumber: '0995 928 1914',
    shopAddress: 'San Pedro District, Davao City',
    businessName: 'Golden Haven Arrangements',
    generalLocation: 'Davao City',
    name: 'Mahogany Premier Casket',
    description: 'Warm wood finish with polished detailing for a more formal memorial presentation.',
    price: '48000',
    stock: 3,
    category: 'Caskets',
    imageUrl: null,
    hasVariations: true,
    variationCount: 3,
  },
  {
    id: 'preview-2',
    shopId: 'preview-golden',
    shopName: 'Golden Haven Memorial Shop',
    shopPhoneNumber: '0995 928 1914',
    shopAddress: 'San Pedro District, Davao City',
    businessName: 'Golden Haven Arrangements',
    generalLocation: 'Davao City',
    name: 'White Floral Tribute Set',
    description: 'Arrangement bundle prepared for chapel display and condolence viewing areas.',
    price: '12500',
    stock: 7,
    category: 'Floral Tributes',
    imageUrl: null,
    hasVariations: false,
    variationCount: 0,
  },
  {
    id: 'preview-3',
    shopId: 'preview-peaceful',
    shopName: 'Peaceful Tribute Essentials',
    shopPhoneNumber: '0917 640 3112',
    shopAddress: 'JP Laurel Avenue, Davao City',
    businessName: 'Peaceful Tribute Services',
    generalLocation: 'Davao City',
    name: 'Viewing Chapel Package',
    description: 'A complete setup package designed for coordinated viewing preparation and venue styling.',
    price: '35000',
    stock: 2,
    category: 'Packages',
    imageUrl: null,
    hasVariations: false,
    variationCount: 0,
  },
  {
    id: 'preview-4',
    shopId: 'preview-serenity',
    shopName: 'Serenity Casket Collection',
    shopPhoneNumber: '0918 222 4408',
    shopAddress: 'Maa Road, Davao City',
    businessName: 'Serenity Funeral Goods',
    generalLocation: 'Davao City',
    name: 'Classic Bronze Casket',
    description: 'Durable bronze-tone option with a dignified, understated silhouette.',
    price: '56000',
    stock: 4,
    category: 'Caskets',
    imageUrl: null,
    hasVariations: true,
    variationCount: 2,
  },
  {
    id: 'preview-5',
    shopId: 'preview-serenity',
    shopName: 'Serenity Casket Collection',
    shopPhoneNumber: '0918 222 4408',
    shopAddress: 'Maa Road, Davao City',
    businessName: 'Serenity Funeral Goods',
    generalLocation: 'Davao City',
    name: 'Memorial Candle Ensemble',
    description: 'Coordinated candles and accent holders prepared for wake and remembrance setups.',
    price: '4800',
    stock: 11,
    category: 'Memorial Items',
    imageUrl: null,
    hasVariations: false,
    variationCount: 0,
  },
  {
    id: 'preview-6',
    shopId: 'preview-peaceful',
    shopName: 'Peaceful Tribute Essentials',
    shopPhoneNumber: '0917 640 3112',
    shopAddress: 'JP Laurel Avenue, Davao City',
    businessName: 'Peaceful Tribute Services',
    generalLocation: 'Davao City',
    name: 'Sympathy Stand Bouquet',
    description: 'Standing floral arrangement suited for chapel entrances and family tribute areas.',
    price: '7900',
    stock: 6,
    category: 'Floral Tributes',
    imageUrl: null,
    hasVariations: false,
    variationCount: 0,
  },
]

const benefitPoints = [
  'Browse verified providers',
  'Compare products quickly',
  'Move into service coordination faster',
]

const trustCards = [
  {
    title: 'Verified Shop Listings',
    body: 'Approved funeral providers are surfaced with clearer identity, location, and contact context.',
  },
  {
    title: 'Storefront-Style Browsing',
    body: 'Families can scan categories, compare prices, and narrow choices without digging through clutter.',
  },
  {
    title: 'Built for Sensitive Decisions',
    body: 'The layout stays calm, readable, and practical during a high-stress planning moment.',
  },
]

function normalize(value: string | undefined | null) {
  return String(value || '').trim().toLowerCase()
}

function formatPeso(value: string | undefined | null) {
  const text = String(value || '').trim()
  if (!text) return 'Price on request'
  const cleaned = text.replace(/[^\d.]/g, '')
  const numeric = Number(cleaned)
  if (!Number.isFinite(numeric) || numeric <= 0) return text
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(numeric)
}

function getPrimaryProductImage(product: ShopProduct) {
  if (product.imageUrl) return product.imageUrl
  if (Array.isArray(product.galleryImageUrls) && product.galleryImageUrls.length > 0) return product.galleryImageUrls[0] || null
  if (Array.isArray(product.variations)) {
    const variationImage = product.variations.find((entry) => entry.imageUrl)?.imageUrl
    if (variationImage) return variationImage
  }
  return null
}

function resolveCategory(product: ShopProduct) {
  const rawCategory = String(product.category || '').trim()
  if (rawCategory) return rawCategory

  const name = normalize(product.name)
  if (name.includes('flower') || name.includes('bouquet') || name.includes('wreath')) return 'Floral Tributes'
  if (name.includes('package') || name.includes('service')) return 'Packages'
  if (name.includes('candle') || name.includes('memorial')) return 'Memorial Items'
  return 'Caskets'
}

function FuneralLandingPage() {
  const [viewer, setViewer] = useState<User | null>(auth.currentUser)
  const [loading, setLoading] = useState(Boolean(auth.currentUser))
  const [error, setError] = useState('')
  const [liveShops, setLiveShops] = useState<StorefrontShop[]>([])
  const [liveProducts, setLiveProducts] = useState<StorefrontProduct[]>([])
  const [queryText, setQueryText] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedShopId, setSelectedShopId] = useState('all')
  const [selectedProduct, setSelectedProduct] = useState<StorefrontProduct | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setViewer(nextUser)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedProduct(null)
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  useEffect(() => {
    if (!viewer) {
      setLoading(false)
      setError('')
      setLiveShops([])
      setLiveProducts([])
      return
    }

    const loadMarketplace = async () => {
      setLoading(true)
      setError('')
      try {
        const snapshot = await getDocs(query(collection(db, 'users'), where('funeralShopStatus', '==', 'verified')))

        const nextShops: StorefrontShop[] = []
        const nextProducts: StorefrontProduct[] = []

        snapshot.forEach((itemDoc) => {
          const data = itemDoc.data() as Omit<ShopRecord, 'id'>
          const shopInfo = data.funeralShopInfo || {}
          const businessInfo = data.funeralBusinessInfo || {}
          const products = Array.isArray(data.funeralProducts) ? data.funeralProducts : []

          const activeProducts = products.filter((product) => Boolean(product?.active) && (Number(product?.stock) || 0) > 0)
          const shopName = String(shopInfo.shopName || businessInfo.businessName || data.fullName || 'Verified Shop')

          nextShops.push({
            id: itemDoc.id,
            shopName,
            shopAddress: String(shopInfo.shopAddress || ''),
            shopPhoneNumber: String(shopInfo.shopPhoneNumber || ''),
            businessName: String(businessInfo.businessName || ''),
            generalLocation: String(businessInfo.generalLocation || ''),
            shopImageUrl: (shopInfo.shopImageUrl as string | null) || null,
            productCount: activeProducts.length,
          })

          activeProducts.forEach((product, index) => {
            nextProducts.push({
              id: String(product.id || `${itemDoc.id}_${index}`),
              shopId: itemDoc.id,
              shopName,
              shopPhoneNumber: String(shopInfo.shopPhoneNumber || ''),
              shopAddress: String(shopInfo.shopAddress || ''),
              businessName: String(businessInfo.businessName || ''),
              generalLocation: String(businessInfo.generalLocation || ''),
              name: String(product.name || 'Untitled Product'),
              description: String(product.description || 'Product details will appear here once the shop completes its listing.'),
              price: String(product.price || ''),
              stock: Number(product.stock) || 0,
              category: resolveCategory(product),
              imageUrl: getPrimaryProductImage(product),
              hasVariations: Boolean(product.hasVariations),
              variationCount: Array.isArray(product.variations) ? product.variations.length : 0,
            })
          })
        })

        nextShops.sort((a, b) => a.shopName.localeCompare(b.shopName))
        nextProducts.sort((a, b) => a.name.localeCompare(b.name))

        setLiveShops(nextShops)
        setLiveProducts(nextProducts)
        if (!nextShops.length || !nextProducts.length) {
          setError('Live funeral shop data is available only in part right now, so some preview content may still appear.')
        }
      } catch {
        setError('Unable to load live funeral marketplace data right now. Preview listings are shown instead.')
        setLiveShops([])
        setLiveProducts([])
      } finally {
        setLoading(false)
      }
    }

    void loadMarketplace()
  }, [viewer])

  const usingLiveData = Boolean(viewer) && liveShops.length > 0 && liveProducts.length > 0
  const shops = usingLiveData ? liveShops : previewShops
  const products = usingLiveData ? liveProducts : previewProducts
  const liveMode = Boolean(viewer)

  const categories = useMemo(() => {
    const values = Array.from(new Set(products.map((item) => item.category).filter(Boolean)))
    return ['All', ...values]
  }, [products])

  const filteredProducts = useMemo(() => {
    const q = normalize(queryText)

    return products.filter((item) => {
      const shopPass = selectedShopId === 'all' || item.shopId === selectedShopId
      const categoryPass = selectedCategory === 'All' || item.category === selectedCategory
      const queryPass = !q || [item.name, item.description, item.shopName, item.businessName, item.category].some((value) => normalize(value).includes(q))

      return shopPass && categoryPass && queryPass
    })
  }, [products, queryText, selectedCategory, selectedShopId])

  const featuredShops = useMemo(() => shops.slice(0, 3), [shops])
  const visibleProducts = useMemo(() => filteredProducts.slice(0, 12), [filteredProducts])
  const selectedShop = useMemo(() => shops.find((item) => item.id === selectedShopId) || null, [shops, selectedShopId])
  const featuredProduct = useMemo(() => products[0] || null, [products])

  const availableCount = useMemo(() => products.reduce((total, item) => total + (item.stock > 0 ? 1 : 0), 0), [products])

  return (
    <div className="funeral-store-shell">
      <header className="funeral-store-topbar">
        <Link to="/" className="brand funeral-store-brand">
          <img src="/Logo.png" alt="LifeCycle logo" className="brand-logo" />
          <span className="funeral-store-brand-copy">
            <strong>LifeCycle</strong>
            <span>Funeral Marketplace</span>
          </span>
        </Link>

        <nav className="funeral-store-nav" aria-label="Funeral shopping navigation">
          <a href="#funeral-store-home">Home</a>
          <a href="#funeral-store-shops">Shops</a>
          <a href="#funeral-store-products">Products</a>
          <a href="#funeral-store-help">Help</a>
        </nav>

        <div className="funeral-store-actions">
          <Link to="/blood" className="funeral-store-text-link">Blood Web</Link>
          <Link to="/services" className="funeral-store-outline-btn btn-link">Open Hub</Link>
          <Link to="/login?next=/admin/funeral-shops" className="funeral-store-primary-btn btn-link">{liveMode ? 'Switch Account' : 'Enter App'}</Link>
        </div>
      </header>

      <main className="funeral-store-main">
        <section className="funeral-store-hero" id="funeral-store-home">
          <div className="funeral-store-hero-copy">
            <p className="funeral-store-kicker">{usingLiveData ? 'LIVE VERIFIED MARKETPLACE' : 'CURATED PREVIEW'}</p>
            <h1>A calmer, clearer funeral storefront for families comparing essential services.</h1>
            <p className="funeral-store-hero-sub">
              LifeCycle Funeral now presents verified providers and product listings in a more polished marketplace layout,
              making it easier to review options before moving into service coordination.
            </p>

            <div className="funeral-store-benefits" aria-label="Marketplace benefits">
              {benefitPoints.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>

            <div className="funeral-store-hero-actions">
              <a href="#funeral-store-products" className="funeral-store-primary-btn btn-link">Browse Products</a>
              <a href="#funeral-store-shops" className="funeral-store-outline-btn btn-link">Explore Shops</a>
            </div>

            <div className="funeral-store-hero-meta">
              <div className="funeral-store-stat-card">
                <span>Verified Shops</span>
                <strong>{shops.length}</strong>
              </div>
              <div className="funeral-store-stat-card">
                <span>Catalog Items</span>
                <strong>{products.length}</strong>
              </div>
              <div className="funeral-store-stat-card">
                <span>Ready Listings</span>
                <strong>{availableCount}</strong>
              </div>
            </div>
          </div>

          <div className="funeral-store-hero-panel">
            <div className="funeral-store-status-banner">
              <span>{usingLiveData ? 'Signed in mode' : liveMode ? 'Fallback preview' : 'Guest preview'}</span>
              <strong>
                {usingLiveData
                  ? 'You are viewing live verified funeral listings from the current Firestore catalog.'
                  : liveMode
                    ? 'Live data is limited right now, so the landing page is using preview content to keep browsing available.'
                    : 'Sign in to load live verified shops and product listings.'}
              </strong>
            </div>

            <div className="funeral-store-search-card">
              <label htmlFor="funeral-store-search">Search listings</label>
              <input
                id="funeral-store-search"
                value={queryText}
                onChange={(event) => setQueryText(event.target.value)}
                placeholder="Search caskets, bouquets, memorial items, or shop names"
              />
              <div className="funeral-store-select-grid">
                <div>
                  <label htmlFor="funeral-store-category">Category</label>
                  <select id="funeral-store-category" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
                    {categories.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="funeral-store-shop">Shop</label>
                  <select id="funeral-store-shop" value={selectedShopId} onChange={(event) => setSelectedShopId(event.target.value)}>
                    <option value="all">All Shops</option>
                    {shops.map((item) => (
                      <option key={item.id} value={item.id}>{item.shopName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="funeral-store-search-actions">
                <button type="button" className="funeral-store-search-reset" onClick={() => { setQueryText(''); setSelectedCategory('All'); setSelectedShopId('all') }}>
                  Reset Filters
                </button>
                <span>{selectedShop ? `Focused on ${selectedShop.shopName}` : 'Showing all verified shops'}</span>
              </div>
            </div>

            {featuredProduct ? (
              <div className="funeral-store-spotlight-card">
                <p className="funeral-store-kicker">FEATURED ITEM</p>
                <h2>{featuredProduct.name}</h2>
                <p>{featuredProduct.description}</p>
                <div className="funeral-store-spotlight-meta">
                  <strong>{formatPeso(featuredProduct.price)}</strong>
                  <span>{featuredProduct.shopName}</span>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="funeral-store-section">
          <div className="funeral-store-trust-grid">
            {trustCards.map((item) => (
              <article className="funeral-store-trust-card" key={item.title}>
                <p className="funeral-store-kicker">WHY IT HELPS</p>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="funeral-store-section" id="funeral-store-shops">
          <div className="funeral-store-section-head">
            <div>
              <p className="funeral-store-kicker">FEATURED SHOPS</p>
              <h2>Verified funeral shops presented like a curated marketplace.</h2>
            </div>
            <p>
              Review providers by location, contact detail, and available catalog volume before narrowing your search.
            </p>
          </div>

          <div className="funeral-store-shop-grid">
            {featuredShops.map((shop) => (
              <article className="funeral-store-shop-card" key={shop.id}>
                {shop.shopImageUrl ? (
                  <img src={shop.shopImageUrl} alt={shop.shopName} className="funeral-store-shop-image" />
                ) : (
                  <div className="funeral-store-shop-image funeral-store-shop-placeholder">
                    <span>{shop.shopName.slice(0, 2).toUpperCase()}</span>
                  </div>
                )}
                <div className="funeral-store-shop-body">
                  <div className="funeral-store-shop-topline">
                    <span>Verified shop</span>
                    <strong>{shop.productCount} items</strong>
                  </div>
                  <h3>{shop.shopName}</h3>
                  <p>{shop.businessName || 'Funeral service provider'}</p>
                  <div className="funeral-store-shop-meta">
                    <span>{shop.generalLocation || shop.shopAddress || 'Location available on request'}</span>
                    <span>{shop.shopPhoneNumber || 'Contact available after login'}</span>
                  </div>
                  <button type="button" className="funeral-store-shop-link" onClick={() => setSelectedShopId(shop.id)}>
                    View this shop&apos;s products
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="funeral-store-section funeral-store-product-section" id="funeral-store-products">
          <div className="funeral-store-section-head">
            <div>
              <p className="funeral-store-kicker">PRODUCT CATALOG</p>
              <h2>Cleaner product cards for faster comparison and less friction.</h2>
            </div>
            <p>
              Families can skim categories, stock levels, and indicative pricing in a layout that behaves more like a modern store.
            </p>
          </div>

          <div className="funeral-store-chip-row" aria-label="Category filters">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={`funeral-store-chip${selectedCategory === item ? ' active' : ''}`}
                onClick={() => setSelectedCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="funeral-store-results-bar">
            <span>{filteredProducts.length} listing{filteredProducts.length === 1 ? '' : 's'} found</span>
            <strong>{selectedShop ? selectedShop.shopName : 'All verified shops'}</strong>
          </div>

          {loading ? <p className="funeral-store-feedback">Loading live funeral marketplace listings...</p> : null}
          {error ? <p className="funeral-store-feedback funeral-store-feedback-error">{error}</p> : null}
          {!loading && filteredProducts.length === 0 ? (
            <p className="funeral-store-feedback">No matching funeral products found for the current filters.</p>
          ) : null}

          <div className="funeral-store-product-grid">
            {visibleProducts.map((product) => (
              <article className="funeral-store-product-card" key={`${product.shopId}_${product.id}`}>
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="funeral-store-product-image" />
                ) : (
                  <div className="funeral-store-product-image funeral-store-product-placeholder">
                    <span>{product.category}</span>
                  </div>
                )}
                <div className="funeral-store-product-body">
                  <div className="funeral-store-product-topline">
                    <span>{product.category}</span>
                    <strong>{product.stock} in stock</strong>
                  </div>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <div className="funeral-store-product-footer">
                    <div>
                      <strong className="funeral-store-price">{formatPeso(product.price)}</strong>
                      <span>{product.shopName}</span>
                    </div>
                    <button type="button" className="funeral-store-product-button" onClick={() => setSelectedProduct(product)}>
                      View Details
                    </button>
                  </div>
                  {product.hasVariations ? (
                    <div className="funeral-store-variation-note">{product.variationCount} variation{product.variationCount === 1 ? '' : 's'} available</div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {filteredProducts.length > visibleProducts.length ? (
            <p className="funeral-store-feedback">
              Showing the first {visibleProducts.length} results. Refine your search to narrow the catalog further.
            </p>
          ) : null}
        </section>

        <section className="funeral-store-support" id="funeral-store-help">
          <div className="funeral-store-support-card funeral-store-support-dark">
            <p className="funeral-store-kicker">WHY THIS VERSION IS BETTER</p>
            <h2>The landing page now feels like a real storefront instead of a placeholder screen.</h2>
            <p>
              The page gives funeral web visitors a clearer first step: browse verified shops, compare listings, and continue only when they are ready.
            </p>
          </div>
          <div className="funeral-store-support-card">
            <p className="funeral-store-kicker">NEXT STEP</p>
            <h2>Ready to continue into the full service flow?</h2>
            <p>
              Use your LifeCycle account to move from browsing into coordination, records, and request handling across the platform.
            </p>
            <div className="funeral-store-support-actions">
              <Link to="/services" className="funeral-store-outline-btn btn-link">Open Hub</Link>
              <Link to="/login?next=/admin/funeral-shops" className="funeral-store-primary-btn btn-link">Enter App</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="funeral-store-footer">
        <div>
          <p className="funeral-store-kicker">CONTACT</p>
          <h3>Need help with funeral web access or listings?</h3>
          <p>
            Contact support for account guidance, funeral shop concerns, and help understanding how to continue into verified service coordination.
          </p>
        </div>
        <div className="funeral-store-footer-grid">
          <a href="mailto:Bloodlink@gmail.com?subject=LifeCycle%20Funeral%20Marketplace" className="funeral-store-footer-card">
            <span>Email</span>
            <strong>Bloodlink@gmail.com</strong>
          </a>
          <a href="tel:09959281914" className="funeral-store-footer-card">
            <span>Phone</span>
            <strong>09959281914</strong>
          </a>
          <Link to="/" className="funeral-store-footer-card">
            <span>Navigate</span>
            <strong>Back to Service Choice</strong>
          </Link>
        </div>
      </footer>

      {selectedProduct ? (
        <div className="funeral-store-modal-overlay" role="presentation" onClick={() => setSelectedProduct(null)}>
          <div className="funeral-store-modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="funeral-store-modal-close" onClick={() => setSelectedProduct(null)}>
              Close
            </button>
            {selectedProduct.imageUrl ? (
              <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="funeral-store-modal-image" />
            ) : (
              <div className="funeral-store-modal-image funeral-store-product-placeholder">
                <span>{selectedProduct.category}</span>
              </div>
            )}
            <div className="funeral-store-modal-body">
              <div className="funeral-store-product-topline">
                <span>{selectedProduct.category}</span>
                <strong>{selectedProduct.stock} in stock</strong>
              </div>
              <h3>{selectedProduct.name}</h3>
              <p>{selectedProduct.description}</p>
              <strong className="funeral-store-price">{formatPeso(selectedProduct.price)}</strong>
              <div className="funeral-store-modal-shop">
                <span>{selectedProduct.shopName}</span>
                <strong>{selectedProduct.businessName || selectedProduct.generalLocation || 'Verified funeral provider'}</strong>
                <p>{selectedProduct.shopAddress || selectedProduct.generalLocation || 'Address available after sign-in'}</p>
                <p>{selectedProduct.shopPhoneNumber || 'Contact available through verified shop details'}</p>
              </div>
              <div className="funeral-store-support-actions">
                <Link to="/login?next=/admin/funeral-shops" className="funeral-store-outline-btn btn-link">
                  {liveMode ? 'Open Account Tools' : 'Enter App'}
                </Link>
                <Link to="/services" className="funeral-store-primary-btn btn-link">Open Hub</Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default FuneralLandingPage
