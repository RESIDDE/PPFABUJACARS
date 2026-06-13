-- PPF Abuja Cars Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  color TEXT,
  plate_number TEXT,
  vin TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PPF Products / Inventory
CREATE TABLE IF NOT EXISTS ppf_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  sku TEXT,
  unit TEXT NOT NULL DEFAULT 'meter',
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  reorder_level NUMERIC(10,2) NOT NULL DEFAULT 5,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service Orders
CREATE TYPE service_order_status AS ENUM ('pending', 'in_progress', 'completed', 'delivered', 'cancelled');

CREATE TABLE IF NOT EXISTS service_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  status service_order_status NOT NULL DEFAULT 'pending',
  intake_date DATE NOT NULL DEFAULT CURRENT_DATE,
  estimated_completion DATE,
  actual_completion DATE,
  technician_name TEXT,
  notes TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service Order Items (PPF films applied per job)
CREATE TABLE IF NOT EXISTS service_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  ppf_product_id UUID NOT NULL REFERENCES ppf_products(id),
  area_description TEXT NOT NULL,
  quantity_used NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoices
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue');

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT NOT NULL UNIQUE,
  service_order_id UUID NOT NULL REFERENCES service_orders(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status invoice_status NOT NULL DEFAULT 'draft',
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  payment_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stock Movements
CREATE TYPE stock_movement_type AS ENUM ('in', 'out', 'adjustment');

CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ppf_product_id UUID NOT NULL REFERENCES ppf_products(id),
  movement_type stock_movement_type NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER ppf_products_updated_at BEFORE UPDATE ON ppf_products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER service_orders_updated_at BEFORE UPDATE ON service_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppf_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Policies: only authenticated users can read/write
CREATE POLICY "Authenticated users can access customers" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can access vehicles" ON vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can access ppf_products" ON ppf_products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can access service_orders" ON service_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can access service_order_items" ON service_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can access invoices" ON invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can access stock_movements" ON stock_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed some sample PPF products
INSERT INTO ppf_products (name, brand, sku, unit, unit_cost, selling_price, stock_quantity, reorder_level, description) VALUES
  ('Ultimate Plus', 'XPEL', 'XPEL-ULT-60', 'meter', 8500, 15000, 25, 5, 'Self-healing TPU film, 60" wide, glossy finish'),
  ('Stealth', 'XPEL', 'XPEL-STL-60', 'meter', 9000, 16000, 15, 5, 'Matte/satin finish PPF, 60" wide'),
  ('Pro Series', '3M', '3M-PRO-60', 'meter', 7000, 13000, 20, 5, '3M Pro Series paint protection film'),
  ('ClearBra Elite', 'SunTek', 'STK-CLR-60', 'meter', 7500, 13500, 18, 5, 'SunTek ClearBra Elite, high clarity'),
  ('Platinum', 'LLumar', 'LLU-PLT-60', 'meter', 6500, 12000, 10, 5, 'LLumar Platinum PPF series');
