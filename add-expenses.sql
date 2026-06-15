-- Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  technician_name TEXT NOT NULL,
  job_description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add Row Level Security (RLS) policies
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" 
ON public.expenses FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Enable insert access for all authenticated users" 
ON public.expenses FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Enable update access for all authenticated users" 
ON public.expenses FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Enable delete access for all authenticated users" 
ON public.expenses FOR DELETE 
TO authenticated 
USING (true);

-- Create updated_at trigger if it doesn't already exist from other tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
