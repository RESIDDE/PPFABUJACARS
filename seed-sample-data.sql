-- Seed Sample Data for PPF Abuja Cars
-- Paste this into your Supabase Dashboard -> SQL Editor -> Run

DO $$
DECLARE
  cust_id UUID;
  veh_id UUID;
  order_id UUID;
BEGIN
  -- Insert Customers
  INSERT INTO customers (full_name, phone, email, address) VALUES
    ('Alhaji Danladi Usman', '+234 803 123 4567', 'danladi@usmangroup.com', 'Maitama, Abuja'),
    ('Chief Femi Adebayo', '+234 802 987 6543', 'femi@adebayoholdings.ng', 'Asokoro, Abuja'),
    ('Sen. Charles Okonjo', '+234 809 555 4433', 'charles@okonjolaw.com', 'Guzape, Abuja'),
    ('Dr. Ibrahim Bello', '+234 805 444 3322', 'ibrahim@bellomedical.org', 'Jabi, Abuja'),
    ('Engr. Nnamdi Eze', '+234 818 222 1100', 'nnamdi@ezebuilders.com', 'Gwarinpa, Abuja')
  ON CONFLICT DO NOTHING;

  -- Create Sample Expenses
  INSERT INTO expenses (expense_date, technician_name, job_description, amount) VALUES
    ('2026-07-22', 'Lead Master Tech', 'XPEL & SunTek PPF Bulk Roll Shipment', 4850000),
    ('2026-07-18', 'Shop Manager', 'Gtechniq Ceramic Stock & Graphtec Plotter Maintenance', 3200000),
    ('2026-07-12', 'Equipment Specialist', 'Precision Heat Guns, Steamers, & Blades', 2150000),
    ('2026-07-05', 'Facility Manager', 'Workshop Utilities, Power Backup & Logistics', 1537244)
  ON CONFLICT DO NOTHING;

END $$;
