ALTER TABLE invoices
ADD COLUMN invoice_type TEXT DEFAULT 'service',
ADD COLUMN total_amount NUMERIC(12,2);
