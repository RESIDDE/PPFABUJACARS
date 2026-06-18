-- Update expenses table for "Other Expenses" support
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS expense_type TEXT DEFAULT 'job';
ALTER TABLE public.expenses ALTER COLUMN vehicle_id DROP NOT NULL;
ALTER TABLE public.expenses ALTER COLUMN technician_name DROP NOT NULL;
