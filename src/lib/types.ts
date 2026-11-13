export type Product = {
  id: string;
  name: string;
  item_code: string;
  barcode: string | null;
  description: string | null;
  unit: string;
  base_price: number;
  cost_price: number | null;
  min_stock: number;
  status: string;
  category_id: string | null;
  image_url: string | null;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  code: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
};

export type Customer = {
  id: string;
  customer_code: string;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  tier: string;
  credit_limit: number;
  current_balance: number;
  status: string;
  created_at: string;
};

export type Supplier = {
  id: string;
  supplier_code: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  current_balance: number;
};

export type Order = {
  id: string;
  order_number: string;
  customer_id: string;
  status: string;
  total_amount: number;
  total_items: number;
  notes: string | null;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  item_code: string;
  product_name_snapshot: string;
  unit_snapshot: string | null;
  quantity: number;
  unit_price_snapshot: number;
  line_total: number;
};

export type InventoryBalance = {
  id: string;
  product_id: string;
  warehouse_id: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  reorder_point: number;
};

export type PricingRule = {
  id: string;
  name: string;
  scope_type: string;
  adjustment_type: string;
  adjustment_value: number;
  is_active: boolean;
  priority: number;
};

export type Promotion = {
  id: string;
  title: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

export type AiAlert = {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_resolved: boolean;
  created_at: string;
};

export type AiTask = {
  id: string;
  title: string;
  description: string | null;
  task_type: string | null;
  priority: string;
  status: string;
  created_at: string;
  completed_at: string | null;
};

export type Notification = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
};

export type AdminSetting = {
  id: string;
  organization_id: string;
  key: string;
  value: unknown;
  category: string;
  updated_at: string;
};

export type ImportJob = {
  id: string;
  organization_id: string;
  job_type: string;
  file_name: string | null;
  file_hash: string | null;
  file_size: number | null;
  status: string;
  total_rows: number;
  processed_rows: number;
  success_rows: number;
  failed_rows: number;
  data_quality_score: number | null;
  error_summary: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
};

export type ImportJobRow = {
  id: string;
  import_job_id: string;
  row_number: number;
  status: string;
  data: Record<string, unknown> | null;
  errors: string[] | null;
  created_at: string;
};

export type TrackedOrder = OrderWithCustomer & {
  items?: OrderItem[];
  status_history?: { to_status: string; notes: string | null; created_at: string }[];
};

export type ProductWithInventory = Product & {
  inventory?: InventoryBalance;
  category?: Category;
};

export type OrderWithCustomer = Order & {
  customer?: Customer;
};

export type CashAccount = {
  id: string;
  organization_id: string;
  name: string;
  type: string;
  currency: string;
  opening_balance: number;
  is_active: boolean;
  created_at: string;
};

export type CashMovement = {
  id: string;
  cash_account_id: string;
  direction: 'in' | 'out';
  amount: number;
  currency: string;
  source_type: string | null;
  reason: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  payment_number: string;
  direction: 'receipt' | 'payment';
  party_type: 'customer' | 'supplier';
  party_id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  method: string;
  cash_account_id: string | null;
  notes: string | null;
  created_at: string;
};

export type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier_id: string | null;
  status: string;
  total_amount: number;
  currency: string;
  expected_date: string | null;
  notes: string | null;
  created_at: string;
};

export type PurchaseOrderItem = {
  id: string;
  purchase_order_id: string;
  product_id: string | null;
  item_code: string | null;
  product_name_snapshot: string;
  unit_snapshot: string | null;
  quantity: number;
  unit_cost: number;
  line_total: number;
};
