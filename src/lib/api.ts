import { supabase, ORG_ID, WAREHOUSE_ID } from './supabase';
import type {
  Product, Category, Customer, Supplier, Order, OrderItem,
  InventoryBalance, PricingRule, Promotion, AiAlert, AiTask, Notification,
  ProductWithInventory, OrderWithCustomer, AdminSetting, ImportJob, ImportJobRow,
} from './types';

// ─── Products ───
export async function fetchProducts(): Promise<ProductWithInventory[]> {
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('name');
  if (error) throw error;

  const { data: inventory, error: inventoryError } = await supabase
    .from('inventory_balances')
    .select('*')
    .eq('warehouse_id', WAREHOUSE_ID);
  if (inventoryError) throw inventoryError;

  const invMap = new Map<string, InventoryBalance>();
  inventory?.forEach((inv: InventoryBalance) => invMap.set(inv.product_id, inv));

  const { data: categories, error: categoryError } = await supabase
    .from('categories')
    .select('*')
    .eq('organization_id', ORG_ID);
  if (categoryError) throw categoryError;
  const catMap = new Map<string, Category>();
  categories?.forEach((cat: Category) => catMap.set(cat.id, cat));

  return (products as Product[]).map((p) => ({
    ...p,
    inventory: invMap.get(p.id),
    category: catMap.get(p.category_id || ''),
  }));
}

export async function createProduct(p: Partial<Product>): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({ ...p, organization_id: ORG_ID })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

// ─── Categories ───
export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('sort_order');
  if (error) throw error;
  return data as Category[];
}

export async function createCategory(c: Partial<Category>): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ ...c, organization_id: ORG_ID })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

// ─── Customers ───
export async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Customer[];
}

export async function createCustomer(c: Partial<Customer>): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert({ ...c, organization_id: ORG_ID })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCustomerStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ status, approved_at: status === 'approved' ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

// ─── Suppliers ───
export async function fetchSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('name');
  if (error) throw error;
  return data as Supplier[];
}

export async function createSupplier(s: Partial<Supplier>): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ ...s, organization_id: ORG_ID })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Orders ───
export async function fetchOrders(): Promise<OrderWithCustomer[]> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .eq('organization_id', ORG_ID);
  const custMap = new Map<string, Customer>();
  customers?.forEach((c: Customer) => custMap.set(c.id, c));

  return (orders as Order[]).map((o) => ({
    ...o,
    customer: custMap.get(o.customer_id),
  }));
}

export async function fetchOrderItems(orderId: string): Promise<OrderItem[]> {
  const { data, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);
  if (error) throw error;
  return data as OrderItem[];
}

export async function updateOrderStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from('orders').update({ status }).eq('id', id);
  if (error) throw error;
  await supabase.from('order_status_history').insert({
    order_id: id,
    to_status: status,
    notes: `Status changed to ${status}`,
  });
}

export async function createOrder(order: {
  customer_id: string;
  items: { product_id: string; item_code: string; product_name: string; unit: string; quantity: number; unit_price: number }[];
  notes?: string;
}): Promise<Order> {
  const totalAmount = order.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;

  const { data: newOrder, error: orderError } = await supabase
    .from('orders')
    .insert({
      organization_id: ORG_ID,
      customer_id: order.customer_id,
      order_number: orderNumber,
      status: 'pending',
      total_amount: totalAmount,
      total_items: order.items.length,
      notes: order.notes ?? null,
    })
    .select()
    .single();
  if (orderError) throw orderError;

  const orderItems = order.items.map((item) => ({
    order_id: newOrder.id,
    product_id: item.product_id,
    item_code: item.item_code,
    product_name_snapshot: item.product_name,
    unit_snapshot: item.unit,
    quantity: item.quantity,
    unit_price_snapshot: item.unit_price,
    line_total: item.unit_price * item.quantity,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) throw itemsError;

  return newOrder;
}

// ─── Pricing rules ───
export async function fetchPricingRules(): Promise<PricingRule[]> {
  const { data, error } = await supabase
    .from('pricing_rules')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('priority');
  if (error) throw error;
  return data as PricingRule[];
}

export async function togglePricingRule(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('pricing_rules').update({ is_active: isActive }).eq('id', id);
  if (error) throw error;
}

// ─── Promotions ───
export async function fetchPromotions(): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Promotion[];
}

export async function togglePromotion(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('promotions').update({ is_active: isActive }).eq('id', id);
  if (error) throw error;
}

// ─── AI Alerts ───
export async function fetchAiAlerts(): Promise<AiAlert[]> {
  const { data, error } = await supabase
    .from('ai_alerts')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as AiAlert[];
}

export async function resolveAiAlert(id: string): Promise<void> {
  const { error } = await supabase.from('ai_alerts').update({ is_resolved: true }).eq('id', id);
  if (error) throw error;
}

// ─── AI Tasks ───
export async function fetchAiTasks(): Promise<AiTask[]> {
  const { data, error } = await supabase
    .from('ai_tasks')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as AiTask[];
}

export async function toggleAiTaskStatus(id: string, status: string): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (status === 'completed') updates.completed_at = new Date().toISOString();
  const { error } = await supabase.from('ai_tasks').update(updates).eq('id', id);
  if (error) throw error;
}

// ─── Notifications ───
export async function fetchNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('organization_id', ORG_ID)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data as Notification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('organization_id', ORG_ID)
    .eq('is_read', false);
  if (error) throw error;
}

// ─── Admin Settings ───
export async function fetchSettings(): Promise<AdminSetting[]> {
  const { data, error } = await supabase
    .from('admin_settings')
    .select('*')
    .eq('organization_id', ORG_ID);
  if (error) throw error;
  return data as AdminSetting[];
}

export async function updateSetting(key: string, value: unknown, category: string): Promise<void> {
  const { error } = await supabase
    .from('admin_settings')
    .upsert(
      { organization_id: ORG_ID, key, value, category, updated_at: new Date().toISOString() },
      { onConflict: 'organization_id,key' }
    );
  if (error) throw error;
}

export async function fetchSettingsMap(): Promise<Record<string, unknown>> {
  const settings = await fetchSettings();
  const map: Record<string, unknown> = {};
  settings.forEach((s) => { map[s.key] = s.value; });
  return map;
}

// ─── Unified import engine ───
export async function createImportJob(input: {
  fileName: string;
  fileHash: string;
  fileSize: number;
  jobType: string;
  totalRows: number;
}): Promise<ImportJob> {
  const { data, error } = await supabase.from('import_jobs').insert({
    organization_id: ORG_ID,
    file_name: input.fileName,
    file_hash: input.fileHash,
    file_size: input.fileSize,
    job_type: input.jobType,
    total_rows: input.totalRows,
    status: 'staging',
    processed_rows: 0,
    success_rows: 0,
    failed_rows: 0,
  }).select().single();
  if (error) throw error;
  return data as ImportJob;
}

export async function insertImportRows(jobId: string, rows: Array<{ rowNumber: number; data: Record<string, unknown>; status: string; errors?: string[] }>): Promise<void> {
  const { error } = await supabase.from('import_job_rows').insert(rows.map((row) => ({
    import_job_id: jobId,
    row_number: row.rowNumber,
    data: row.data,
    status: row.status,
    errors: row.errors ?? null,
  })));
  if (error) throw error;
}

export async function updateImportJob(id: string, updates: Partial<ImportJob>): Promise<void> {
  const { error } = await supabase.from('import_jobs').update(updates).eq('id', id).eq('organization_id', ORG_ID);
  if (error) throw error;
}

export async function fetchImportJobs(): Promise<ImportJob[]> {
  const { data, error } = await supabase.from('import_jobs').select('*').eq('organization_id', ORG_ID).order('created_at', { ascending: false }).limit(30);
  if (error) throw error;
  return data as ImportJob[];
}

export async function fetchImportRows(jobId: string): Promise<ImportJobRow[]> {
  const { data, error } = await supabase.from('import_job_rows').select('*').eq('import_job_id', jobId).order('row_number').limit(100000);
  if (error) throw error;
  return data as ImportJobRow[];
}

// ─── Server-verified checkout ───
export type PlaceOrderInput = {
  customer_id: string;
  items: { product_id: string; quantity: number }[];
  notes?: string;
  payment_method?: string;
  delivery_address?: string;
  phone?: string;
};

export type PlaceOrderResult = {
  order_id: string;
  order_number: string;
  total_amount: number;
  duplicate: boolean;
};

function checkoutErrorMessage(raw: string): string {
  if (raw.startsWith('INSUFFICIENT_STOCK:')) return `المخزون غير كافٍ للمنتج: ${raw.split(':')[1] ?? ''}`;
  if (raw.startsWith('PRODUCT_UNAVAILABLE:')) return `المنتج غير متاح حالياً: ${raw.split(':')[1] ?? ''}`;
  if (raw === 'INVALID_QUANTITY') return 'الكمية المحددة غير صالحة';
  if (raw === 'EMPTY_ORDER') return 'السلة فارغة';
  return 'تعذر إرسال الطلب، حاول مرة أخرى';
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const { data, error } = await supabase.rpc('place_order', {
    p_organization_id: ORG_ID,
    p_customer_id: input.customer_id,
    p_warehouse_id: WAREHOUSE_ID,
    p_items: input.items,
    p_notes: input.notes ?? null,
    p_payment_method: input.payment_method ?? 'cash_on_delivery',
    p_delivery_address: input.delivery_address ?? null,
    p_phone: input.phone ?? null,
    p_idempotency_key: `web-${crypto.randomUUID()}`,
  });
  if (error) throw new Error(checkoutErrorMessage(error.message));
  return data as PlaceOrderResult;
}

// ─── Order tracking (guest or customer) ───
export type TrackedOrder = OrderWithCustomer & {
  items?: OrderItem[];
  status_history?: { to_status: string; notes: string | null; created_at: string }[];
};

export async function fetchOrderByNumber(orderNumber: string, phone?: string): Promise<TrackedOrder> {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('organization_id', ORG_ID)
    .eq('order_number', orderNumber.trim().toUpperCase())
    .maybeSingle();
  if (error) throw error;
  if (!order) throw new Error('لا يوجد طلب بهذا الرقم');
  if (phone && order.contact_phone && phone.trim() && order.contact_phone !== phone.trim()) {
    throw new Error('رقم الهاتف لا يطابق الطلب');
  }

  const [{ data: items }, { data: history }] = await Promise.all([
    supabase.from('order_items').select('*').eq('order_id', order.id),
    supabase.from('order_status_history').select('to_status, notes, created_at').eq('order_id', order.id).order('created_at'),
  ]);

  return { ...order, status_history: history ?? [] } as TrackedOrder;
}

// ─── Dashboard stats ───
export async function fetchDashboardStats() {
  const [products, customers, orders, alerts, lowStock] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('organization_id', ORG_ID).eq('status', 'active'),
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('organization_id', ORG_ID),
    supabase.from('orders').select('id, status, total_amount', { count: 'exact' }).eq('organization_id', ORG_ID),
    supabase.from('ai_alerts').select('id', { count: 'exact', head: true }).eq('organization_id', ORG_ID).eq('is_resolved', false),
    supabase.from('inventory_balances').select('quantity_on_hand, reorder_point, product_id').eq('warehouse_id', WAREHOUSE_ID),
  ]);

  const lowStockCount = (lowStock.data || []).filter(
    (inv: { quantity_on_hand: number; reorder_point: number }) => inv.quantity_on_hand <= inv.reorder_point
  ).length;

  const ordersData = orders.data || [];
  const totalSales = ordersData.reduce((sum: number, o: { total_amount: number }) => sum + (o.total_amount || 0), 0);
  const processingCount = ordersData.filter((o: { status: string }) => o.status === 'processing' || o.status === 'pending').length;

  return {
    productCount: products.count || 0,
    customerCount: customers.count || 0,
    orderCount: orders.count || 0,
    totalSales,
    processingCount,
    alertCount: alerts.count || 0,
    lowStockCount,
  };
}
