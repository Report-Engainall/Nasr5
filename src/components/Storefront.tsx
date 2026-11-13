import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Minus, Plus, Search, ShoppingCart, Trash2,
  Package, Tag, Phone, MapPin, Mail, Check, ChevronLeft, Menu,
  Heart, GitCompare, ArrowRight, Truck, Landmark, SlidersHorizontal, ClipboardList,
} from 'lucide-react';
import { fetchProducts, fetchCategories, fetchPromotions, fetchSettingsMap, fetchOrderByNumber, placeOrder } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import type { ProductWithInventory, Category, Promotion, TrackedOrder } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { supabase, ORG_ID } from '@/lib/supabase';

type CartItem = { product: ProductWithInventory; quantity: number };
type StoreView = 'shop' | 'product' | 'wishlist' | 'compare' | 'cart' | 'checkout' | 'confirm' | 'track';
type SortKey = 'featured' | 'price_asc' | 'price_desc' | 'name';

function loadIds(key: string): string[] {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem('aghbari_cart');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function Storefront({ onExit }: { onExit: () => void }) {
  const { data: products } = useFetch(fetchProducts);
  const { data: categories } = useFetch(fetchCategories);
  const { data: promotions } = useFetch(fetchPromotions);
  const { data: settings } = useFetch(fetchSettingsMap);
  const [view, setView] = useState<StoreView>('shop');
  const [cart, setCart] = useState<CartItem[]>(loadCart);
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState<string>('');
  const [sort, setSort] = useState<SortKey>('featured');
  const [maxPrice, setMaxPrice] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [lastOrderNo, setLastOrderNo] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductWithInventory | null>(null);
  const [wishlist, setWishlist] = useState<string[]>(() => loadIds('aghbari_wishlist'));
  const [compare, setCompare] = useState<string[]>(() => loadIds('aghbari_compare'));

  useEffect(() => { try { localStorage.setItem('aghbari_cart', JSON.stringify(cart)); } catch { /* storage unavailable */ } }, [cart]);
  useEffect(() => { try { localStorage.setItem('aghbari_wishlist', JSON.stringify(wishlist)); } catch { /* storage unavailable */ } }, [wishlist]);
  useEffect(() => { try { localStorage.setItem('aghbari_compare', JSON.stringify(compare)); } catch { /* storage unavailable */ } }, [compare]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [view, selectedProduct]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.product.base_price * i.quantity, 0);

  function addToCart(product: ProductWithInventory, quantity = 1) {
    const available = product.inventory?.quantity_available ?? 0;
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      const current = existing?.quantity ?? 0;
      const next = Math.min(current + quantity, available);
      if (next <= 0) return existing ? prev : prev;
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: next } : i);
      return [...prev, { product, quantity: next }];
    });
  }
  function setQty(productId: string, quantity: number) {
    setCart((prev) => {
      const item = prev.find((i) => i.product.id === productId);
      if (!item) return prev;
      const available = item.product.inventory?.quantity_available ?? 0;
      const clamped = Math.min(Math.max(1, quantity), available);
      return prev.map((i) => i.product.id === productId ? { ...i, quantity: clamped } : i);
    });
  }
  function updateQty(productId: string, delta: number) {
    setCart((prev) => prev
      .map((i) => {
        if (i.product.id !== productId) return i;
        const available = i.product.inventory?.quantity_available ?? 0;
        return { ...i, quantity: Math.min(Math.max(0, i.quantity + delta), available) };
      })
      .filter((i) => i.quantity > 0));
  }
  function removeFromCart(productId: string) { setCart((prev) => prev.filter((i) => i.product.id !== productId)); }
  function toggleWishlist(productId: string) { setWishlist((prev) => prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]); }
  function toggleCompare(productId: string) { setCompare((prev) => prev.includes(productId) ? prev.filter((id) => id !== productId) : prev.length >= 3 ? prev : [...prev, productId]); }
  function openProduct(product: ProductWithInventory) { setSelectedProduct(product); setView('product'); }

  const filtered = useMemo(() => {
    let list = products ?? [];
    if (activeCat) list = list.filter((p) => p.category_id === activeCat);
    if (query.trim()) list = list.filter((p) => `${p.name} ${p.item_code} ${p.barcode ?? ''}`.toLowerCase().includes(query.toLowerCase()));
    if (maxPrice.trim() && !Number.isNaN(Number(maxPrice))) list = list.filter((p) => p.base_price <= Number(maxPrice));
    if (inStockOnly) list = list.filter((p) => (p.inventory?.quantity_available ?? 0) > 0);
    switch (sort) {
      case 'price_asc': return [...list].sort((a, b) => a.base_price - b.base_price);
      case 'price_desc': return [...list].sort((a, b) => b.base_price - a.base_price);
      case 'name': return [...list].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      default: return list;
    }
  }, [products, activeCat, query, maxPrice, inStockOnly, sort]);

  const tickerMessages = (settings?.ticker_messages as string[]) ?? [];
  const tickerEnabled = settings?.ticker_enabled as boolean ?? true;

  function navigate(next: StoreView) { setView(next); setMobileMenu(false); }

  return (
    <div className="storefront" dir="rtl">
      <header className="sf-header">
        <div className="sf-header-inner">
          <div className="sf-brand" onClick={() => navigate('shop')} style={{ cursor: 'pointer' }}><div className="sf-brand-icon"><Activity size={22} /></div><div><strong>{(settings?.store_name as string) ?? 'الأغبري'}</strong><span>{(settings?.store_tagline as string) ?? 'مواد غذائية بالجملة'}</span></div></div>
          <button className="sf-admin-btn" onClick={onExit}><Activity size={16} /> لوحة التحكم</button>
          <div className="sf-search"><Search size={17} /><input value={query} onChange={(e) => { setQuery(e.target.value); if (view !== 'shop') navigate('shop'); }} placeholder="ابحث عن منتج..." /></div>
          <div className="sf-header-links">
            <button onClick={() => navigate('track')}><ClipboardList size={16} /> تتبع طلبك</button>
            <button onClick={() => navigate('wishlist')}><Heart size={16} /> المفضلة <b>{wishlist.length}</b></button>
            <button onClick={() => navigate('compare')}><GitCompare size={16} /> مقارنة</button>
          </div>
          <button className="sf-cart-btn" onClick={() => navigate('cart')}><ShoppingCart size={20} /> {cartCount > 0 && <b>{cartCount}</b>}</button>
          <button className="sf-mobile-toggle" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={22} /></button>
        </div>
      </header>

      {tickerEnabled && tickerMessages.length > 0 && (
        <div className="sf-ticker"><div className="sf-ticker-track">{tickerMessages.map((msg, i) => <span key={i}>{msg}</span>)}</div></div>
      )}

      <nav className={`sf-cats ${mobileMenu ? 'open' : ''}`}>
        <button className={activeCat === '' ? 'active' : ''} onClick={() => { setActiveCat(''); setMobileMenu(false); }}>كل المنتجات</button>
        {categories?.map((c: Category) => <button key={c.id} className={activeCat === c.id ? 'active' : ''} onClick={() => { setActiveCat(c.id); setMobileMenu(false); if (view !== 'shop') setView('shop'); }}>{c.name}</button>)}
      </nav>

      <main className="sf-main">
        {view === 'shop' && (
          <>
            <section className="sf-hero" style={{ background: `linear-gradient(120deg, ${(settings?.theme_primary as string) ?? '#087f8d'}, ${(settings?.theme_accent as string) ?? '#0eaa97'})` }}>
              <div><span className="sf-hero-kicker">عرض خاص</span><h1>{(settings?.hero_title as string) ?? 'الأغبري — موردك الموثوق'}</h1><p>{(settings?.hero_subtitle as string) ?? 'مواد غذائية بالجملة بأسعار تنافسية وتوصيل سريع'}</p></div>
              <div className="sf-hero-badge"><Package size={28} /><div><strong>{formatNumber(products?.length ?? 0)}</strong><span>منتج متوفر</span></div></div>
            </section>

            {promotions && promotions.filter((p: Promotion) => p.is_active).length > 0 && (
              <section className="sf-promos">{promotions.filter((p) => p.is_active).map((p: Promotion) => <div className="sf-promo" key={p.id}><Tag size={16} /> <strong>{p.title}</strong> <span>{p.discount_value}% خصم</span></div>)}</section>
            )}

            <section className="sf-products">
              <div className="sf-products-head">
                <div><h2>المنتجات</h2><span>{formatNumber(filtered.length)} صنف متاح حسب بحثك وتصنيفك</span></div>
                <div className="sf-discovery-links">
                  <button onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={15} /> تصفية وترتيب</button>
                  <button onClick={() => navigate('wishlist')}><Heart size={15} /> المفضلة</button>
                  <button onClick={() => navigate('compare')}><GitCompare size={15} /> المقارنة ({compare.length}/3)</button>
                </div>
              </div>

              {showFilters && (
                <div className="sf-filters">
                  <label className="sf-filter-field"><span>الترتيب</span>
                    <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                      <option value="featured">المميز</option>
                      <option value="price_asc">السعر: من الأقل</option>
                      <option value="price_desc">السعر: من الأعلى</option>
                      <option value="name">الاسم أبجدياً</option>
                    </select>
                  </label>
                  <label className="sf-filter-field"><span>أقصى سعر (ر.ي)</span><input type="number" min="0" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="بدون حد" /></label>
                  <label className="sf-filter-check"><input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} /> المتوفر فقط</label>
                  <button className="sf-filter-clear" onClick={() => { setSort('featured'); setMaxPrice(''); setInStockOnly(false); }}>مسح الفلاتر</button>
                </div>
              )}

              <ProductGrid products={filtered} wishlist={wishlist} compare={compare} onOpen={openProduct} onAdd={addToCart} onWishlist={toggleWishlist} onCompare={toggleCompare} />
            </section>
          </>
        )}

        {view === 'product' && selectedProduct && <ProductDetail product={selectedProduct} inWishlist={wishlist.includes(selectedProduct.id)} inCompare={compare.includes(selectedProduct.id)} onBack={() => navigate('shop')} onAdd={addToCart} onWishlist={() => toggleWishlist(selectedProduct.id)} onCompare={() => toggleCompare(selectedProduct.id)} />}
        {view === 'wishlist' && <CollectionView title="المفضلة" icon={Heart} products={(products ?? []).filter((p) => wishlist.includes(p.id))} wishlist={wishlist} compare={compare} onOpen={openProduct} onAdd={addToCart} onWishlist={toggleWishlist} onCompare={toggleCompare} onBack={() => navigate('shop')} empty="لم تضف أي منتج إلى المفضلة بعد" />}
        {view === 'compare' && <CollectionView title="مقارنة المنتجات" icon={GitCompare} products={(products ?? []).filter((p) => compare.includes(p.id))} wishlist={wishlist} compare={compare} onOpen={openProduct} onAdd={addToCart} onWishlist={toggleWishlist} onCompare={toggleCompare} onBack={() => navigate('shop')} empty="اختر حتى ثلاثة منتجات من الكتالوج للمقارنة" />}

        {view === 'cart' && (
          <section className="sf-cart-page">
            <h2>سلة المشتريات</h2>
            {!cart.length ? <div className="sf-empty"><ShoppingCart size={30} /><span>سلتك فارغة</span><button className="sf-link" onClick={() => navigate('shop')}>تصفح المنتجات</button></div> :
            <>
              <div className="sf-cart-list">
                {cart.map((item) => {
                  const available = item.product.inventory?.quantity_available ?? 0;
                  return (
                    <div className="sf-cart-row" key={item.product.id}>
                      <div className="sf-cart-info"><div className="sf-cart-img"><Package size={20} /></div><div><strong>{item.product.name}</strong><span>{formatCurrency(item.product.base_price)} / {item.product.unit}</span></div></div>
                      <div className="sf-cart-qty"><button onClick={() => updateQty(item.product.id, -1)}><Minus size={14} /></button><input type="number" min="1" max={available} value={item.quantity} onChange={(e) => setQty(item.product.id, Number(e.target.value) || 1)} /><button onClick={() => updateQty(item.product.id, 1)} disabled={item.quantity >= available}><Plus size={14} /></button></div>
                      <strong className="sf-cart-line">{formatCurrency(item.product.base_price * item.quantity)}</strong>
                      <button className="sf-cart-remove" onClick={() => removeFromCart(item.product.id)}><Trash2 size={16} /></button>
                    </div>
                  );
                })}
              </div>
              <div className="sf-cart-total"><span>الإجمالي</span><strong>{formatCurrency(cartTotal)}</strong></div>
              <div className="sf-cart-actions"><button className="sf-btn-secondary" onClick={() => navigate('shop')}>متابعة التسوق</button><button className="sf-btn-primary" onClick={() => navigate('checkout')}>إتمام الطلب <ChevronLeft size={16} /></button></div>
            </>
            }
          </section>
        )}

        {view === 'checkout' && (cart.length
          ? <Checkout cart={cart} total={cartTotal} onBack={() => navigate('cart')} onComplete={(orderNo) => { setLastOrderNo(orderNo); navigate('confirm'); setCart([]); }} />
          : <div className="sf-empty"><ShoppingCart size={30} /><span>سلتك فارغة</span><button className="sf-link" onClick={() => navigate('shop')}>تصفح المنتجات</button></div>)}
        {view === 'confirm' && <OrderConfirm orderNo={lastOrderNo} onContinue={() => navigate('shop')} onTrack={() => navigate('track')} />}
        {view === 'track' && <OrderTracker onBack={() => navigate('shop')} />}
      </main>

      <footer className="sf-footer">
        <div className="sf-footer-inner">
          <div className="sf-footer-brand"><Activity size={20} /> <strong>{(settings?.store_name as string) ?? 'الأغبري'}</strong></div>
          <button className="sf-footer-info sf-footer-link" onClick={() => navigate('track')}><ClipboardList size={15} /> تتبع طلبك</button>
          <div className="sf-footer-info"><Phone size={15} /> {(settings?.store_phone as string) ?? '+967-1-234-567'}</div>
          <div className="sf-footer-info"><Mail size={15} /> {(settings?.store_email as string) ?? 'info@aghbari.ye'}</div>
          <div className="sf-footer-info"><MapPin size={15} /> {(settings?.store_address as string) ?? 'صنعاء، اليمن'}</div>
        </div>
      </footer>
    </div>
  );
}

function ProductGrid({ products, wishlist, compare, onOpen, onAdd, onWishlist, onCompare }: { products: ProductWithInventory[]; wishlist: string[]; compare: string[]; onOpen: (product: ProductWithInventory) => void; onAdd: (product: ProductWithInventory) => void; onWishlist: (id: string) => void; onCompare: (id: string) => void }) {
  if (!products.length) return <div className="sf-empty"><Package size={30} /><span>لا توجد منتجات مطابقة</span><small>جرّب تغيير البحث أو الفلاتر</small></div>;
  return <div className="sf-product-grid">{products.map((product) => { const qty = product.inventory?.quantity_available ?? 0; const out = qty <= 0; const liked = wishlist.includes(product.id); const compared = compare.includes(product.id); return <article className="sf-product-card" key={product.id}><div className="sf-product-img" onClick={() => onOpen(product)}>{product.image_url ? <img src={product.image_url} alt={product.name} /> : <Package size={36} />}<div className="sf-card-actions"><button aria-label="إضافة للمفضلة" className={liked ? 'active' : ''} onClick={(event) => { event.stopPropagation(); onWishlist(product.id); }}><Heart size={16} fill={liked ? 'currentColor' : 'none'} /></button><button aria-label="إضافة للمقارنة" className={compared ? 'active' : ''} onClick={(event) => { event.stopPropagation(); onCompare(product.id); }}><GitCompare size={16} /></button></div></div><button className="sf-product-body sf-product-open" onClick={() => onOpen(product)}><h3>{product.name}</h3><p>{product.category?.name ?? 'غير مصنف'} · {product.item_code}</p><div className="sf-product-price"><strong>{formatCurrency(product.base_price)}</strong><span>{product.unit}</span></div><div className="sf-product-stock">{out ? <span className="sf-out">نفد المخزون</span> : <span className="sf-in">{formatNumber(qty)} متوفر</span>}</div></button><button className="sf-add-btn" disabled={out} onClick={() => onAdd(product)}>{out ? 'غير متوفر' : <><Plus size={16} /> أضف للسلة</>}</button></article>; })}</div>;
}

function ProductDetail({ product, inWishlist, inCompare, onBack, onAdd, onWishlist, onCompare }: { product: ProductWithInventory; inWishlist: boolean; inCompare: boolean; onBack: () => void; onAdd: (product: ProductWithInventory, quantity: number) => void; onWishlist: () => void; onCompare: () => void }) {
  const quantity = product.inventory?.quantity_available ?? 0;
  const [qty, setQty] = useState(1);
  useEffect(() => { setQty(1); }, [product.id]);
  const clamped = Math.min(Math.max(1, qty), Math.max(quantity, 1));
  return <section className="sf-product-detail"><button className="sf-back-link" onClick={onBack}><ArrowRight size={16} /> العودة للكتالوج</button><div className="sf-detail-layout"><div className="sf-detail-image">{product.image_url ? <img src={product.image_url} alt={product.name} /> : <Package size={72} />}<span className="sf-detail-code">SKU: {product.item_code}</span></div><div className="sf-detail-content"><span className="sf-detail-category">{product.category?.name ?? 'غير مصنف'}</span><h2>{product.name}</h2><p className="sf-detail-description">{product.description || 'منتج متوفر للطلب بالجملة من متجر الأغبري.'}</p><div className="sf-detail-price"><strong>{formatCurrency(product.base_price)}</strong><span>لكل {product.unit}</span></div><div className={`sf-detail-stock ${quantity > 0 ? 'available' : 'unavailable'}`}>{quantity > 0 ? `متوفر حالياً: ${formatNumber(quantity)} ${product.unit}` : 'هذا المنتج غير متوفر حالياً'}</div>{quantity > 0 && <div className="sf-detail-qty"><span>الكمية</span><button onClick={() => setQty(clamped - 1)} disabled={clamped <= 1}><Minus size={14} /></button><input type="number" min="1" max={quantity} value={clamped} onChange={(e) => setQty(Number(e.target.value) || 1)} /><button onClick={() => setQty(clamped + 1)} disabled={clamped >= quantity}><Plus size={14} /></button></div>}<div className="sf-detail-actions"><button className="sf-btn-primary" disabled={quantity <= 0} onClick={() => onAdd(product, clamped)}><ShoppingCart size={17} /> إضافة إلى السلة</button><button className={`sf-icon-action ${inWishlist ? 'active' : ''}`} onClick={onWishlist}><Heart size={18} fill={inWishlist ? 'currentColor' : 'none'} /> {inWishlist ? 'في المفضلة' : 'أضف للمفضلة'}</button><button className={`sf-icon-action ${inCompare ? 'active' : ''}`} onClick={onCompare}><GitCompare size={18} /> مقارنة</button></div><div className="sf-detail-facts"><div><strong>الوحدة</strong><span>{product.unit}</span></div><div><strong>الحد الأدنى</strong><span>حسب اتفاق العميل</span></div><div><strong>السعر</strong><span>يُعاد التحقق منه عند تأكيد الطلب</span></div></div></div></div></section>;
}

function CollectionView({ title, icon: Icon, products, wishlist, compare, onOpen, onAdd, onWishlist, onCompare, onBack, empty }: { title: string; icon: typeof Heart; products: ProductWithInventory[]; wishlist: string[]; compare: string[]; onOpen: (product: ProductWithInventory) => void; onAdd: (product: ProductWithInventory) => void; onWishlist: (id: string) => void; onCompare: (id: string) => void; onBack: () => void; empty: string }) {
  return <section className="sf-collection"><button className="sf-back-link" onClick={onBack}><ArrowRight size={16} /> العودة للمتجر</button><div className="sf-products-head"><div><h2><Icon size={21} /> {title}</h2><span>{products.length} منتجات</span></div></div>{products.length ? <ProductGrid products={products} wishlist={wishlist} compare={compare} onOpen={onOpen} onAdd={onAdd} onWishlist={onWishlist} onCompare={onCompare} /> : <div className="sf-empty"><Icon size={32} /><span>{empty}</span><button className="sf-link" onClick={onBack}>تصفح الكتالوج</button></div>}</section>;
}

const PAYMENT_METHODS = [
  { id: 'cash_on_delivery', label: 'الدفع عند الاستلام', note: 'ادفع نقداً عند وصول الطلب', icon: Truck },
  { id: 'bank_transfer', label: 'تحويل بنكي', note: 'سنرسل تفاصيل الحساب بعد التأكيد', icon: Landmark },
];

function Checkout({ cart, total, onBack, onComplete }: { cart: CartItem[]; total: number; onBack: () => void; onComplete: (orderNo: string) => void }) {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState('');
  const [business, setBusiness] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [payment, setPayment] = useState('cash_on_delivery');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // One key per checkout session: retries never duplicate the order
  const idempotencyKey = useRef(`web-${crypto.randomUUID()}`);

  async function submit() {
    if (!name.trim() || !phone.trim()) { setError('الاسم ورقم الهاتف مطلوبان'); return; }
    if (!address.trim()) { setError('عنوان التوصيل مطلوب'); return; }
    setSubmitting(true); setError('');
    try {
      const { data: existing } = await supabase.from('customers').select('id').eq('business_name', business || name).limit(1).maybeSingle();
      let customerId = existing?.id;
      if (!customerId) {
        const { data: newCust } = await supabase.from('customers').insert({
          organization_id: ORG_ID,
          customer_code: `CUST-${Date.now().toString().slice(-6)}`,
          business_name: business || name,
          contact_name: name,
          phone,
          tier: 'retail',
          status: 'pending',
        }).select().single();
        customerId = newCust?.id;
      }
      if (!customerId) throw new Error('تعذر إنشاء العميل');
      const result = await placeOrder({
        customer_id: customerId,
        items: cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
        notes,
        payment_method: payment,
        delivery_address: address,
        phone,
      });
      onComplete(result.order_number);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إرسال الطلب');
    } finally { setSubmitting(false); }
  }

  return (
    <section className="sf-checkout">
      <h2>إتمام الطلب</h2>
      <div className="sf-checkout-layout">
        <div className="sf-checkout-form">
          <label className="sf-form-field"><span>الاسم الكامل *</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك الكامل" /></label>
          <label className="sf-form-field"><span>رقم الهاتف *</span><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="7XX XXX XXX" inputMode="tel" /></label>
          <label className="sf-form-field"><span>اسم المنشأة</span><input value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="اسم المتجر أو الشركة" /></label>
          <label className="sf-form-field"><span>عنوان التوصيل *</span><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="المدينة، الحي، أقرب معلم" /></label>
          <div className="sf-form-field"><span>طريقة الدفع *</span><div className="sf-payment-options">{PAYMENT_METHODS.map(({ id, label, note, icon: Icon }) => <label key={id} className={`sf-payment-option ${payment === id ? 'selected' : ''}`}><input type="radio" name="payment" value={id} checked={payment === id} onChange={() => setPayment(id)} /><Icon size={18} /><div><strong>{label}</strong><span>{note}</span></div></label>)}</div></div>
          <label className="sf-form-field"><span>ملاحظات</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="أي ملاحظات على الطلب..." /></label>
          {error && <div className="sf-form-error">{error}</div>}
          <div className="sf-checkout-actions"><button className="sf-btn-secondary" onClick={onBack}>رجوع</button><button className="sf-btn-primary" onClick={submit} disabled={submitting}>{submitting ? 'جار الإرسال...' : 'تأكيد الطلب'}</button></div>
        </div>
        <aside className="sf-checkout-summary">
          <h3>ملخص الطلب</h3>
          {cart.map((i) => <div className="sf-summary-row" key={i.product.id}><span>{i.product.name}</span><small>{i.quantity} × {formatCurrency(i.product.base_price)}</small></div>)}
          <div className="sf-summary-total"><span>الإجمالي</span><strong>{formatCurrency(total)}</strong></div>
        </aside>
      </div>
    </section>
  );
}

function OrderConfirm({ orderNo, onContinue, onTrack }: { orderNo: string; onContinue: () => void; onTrack: () => void }) {
  return (
    <section className="sf-confirm">
      <div className="sf-confirm-icon"><Check size={40} /></div>
      <h2>تم استلام طلبك بنجاح!</h2>
      <p>رقم الطلب: <strong>{orderNo}</strong></p>
      <p>سنتواصل معك قريباً لتأكيد الطلب وتفاصيل التوصيل.</p>
      <div className="sf-confirm-actions"><button className="sf-btn-primary" onClick={onContinue}>متابعة التسوق</button><button className="sf-btn-secondary" onClick={onTrack}>تتبع الطلب</button></div>
    </section>
  );
}

const STATUS_STEPS = [
  { id: 'pending', label: 'تم الاستلام' },
  { id: 'confirmed', label: 'مؤكد' },
  { id: 'processing', label: 'قيد التجهيز' },
  { id: 'delivered', label: 'تم التسليم' },
];

function OrderTracker({ onBack }: { onBack: () => void }) {
  const [orderNo, setOrderNo] = useState('');
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!orderNo.trim()) { setError('أدخل رقم الطلب'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const found = await fetchOrderByNumber(orderNo, phone);
      setResult(found);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر العثور على الطلب');
    } finally { setLoading(false); }
  }

  const currentStep = result ? STATUS_STEPS.findIndex((s) => s.id === result.status) : -1;

  return (
    <section className="sf-track">
      <button className="sf-back-link" onClick={onBack}><ArrowRight size={16} /> العودة للمتجر</button>
      <h2><ClipboardList size={22} /> تتبع طلبك</h2>
      <div className="sf-track-form">
        <label className="sf-form-field"><span>رقم الطلب *</span><input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="ORD-XXXXXX-XXXXXX" dir="ltr" /></label>
        <label className="sf-form-field"><span>رقم الهاتف (للتحقق)</span><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="7XX XXX XXX" inputMode="tel" /></label>
        <button className="sf-btn-primary" onClick={search} disabled={loading}>{loading ? 'جار البحث...' : 'بحث'}</button>
      </div>
      {error && <div className="sf-form-error">{error}</div>}
      {result && (
        <div className="sf-track-result">
          <div className="sf-track-head"><strong>الطلب #{result.order_number}</strong><span className={`badge ${result.status === 'delivered' ? 'success' : 'info'}`}>{STATUS_STEPS.find((s) => s.id === result.status)?.label ?? result.status}</span></div>
          {currentStep >= 0 ? (
            <div className="sf-track-steps">
              {STATUS_STEPS.map((step, i) => (
                <div className={`sf-track-step ${i <= currentStep ? 'done' : ''}`} key={step.id}>
                  <span className="sf-step-dot">{i <= currentStep ? <Check size={12} /> : i + 1}</span>
                  <span>{step.label}</span>
                </div>
              ))}
            </div>
          ) : <div className="sf-form-error">حالة الطلب غير معروفة، تواصل معنا للاستفسار.</div>}
          <div className="sf-track-items">
            {result.items?.map((item) => <div key={item.id}><span>{item.product_name_snapshot}</span><small>{formatNumber(item.quantity)} × {formatCurrency(item.unit_price_snapshot)}</small></div>)}
          </div>
          <div className="sf-track-foot">
            <span>الإجمالي: <strong>{formatCurrency(result.total_amount)}</strong></span>
            <span>تاريخ الطلب: {formatDate(result.created_at)}</span>
          </div>
        </div>
      )}
    </section>
  );
}
