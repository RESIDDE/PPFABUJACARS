ALTER TABLE public.service_order_items ALTER COLUMN ppf_product_id DROP NOT NULL;
ALTER TABLE public.service_order_items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'ppf';
