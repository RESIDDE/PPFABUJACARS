export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ServiceOrderStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "delivered"
  | "cancelled";

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export type StockMovementType = "in" | "out" | "adjustment";

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          email: string | null;
          address: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<
          Database["public"]["Tables"]["customers"]["Row"],
          "id" | "created_at" | "updated_at" >>;
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: any[];
      };
      vehicles: {
        Row: {
          id: string;
          customer_id: string;
          make: string;
          model: string;
          year: number | null;
          color: string | null;
          plate_number: string | null;
          vin: string | null;
          notes: string | null;
          parking_location: string | null;
          items_found: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<
          Database["public"]["Tables"]["vehicles"]["Row"],
          "id" | "created_at" | "updated_at" >>;
        Update: Partial<Database["public"]["Tables"]["vehicles"]["Insert"]>;
        Relationships: any[];
      };
      ppf_products: {
        Row: {
          id: string;
          name: string;
          brand: string;
          sku: string | null;
          unit: string;
          unit_cost: number;
          selling_price: number;
          stock_quantity: number;
          reorder_level: number;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<
          Database["public"]["Tables"]["ppf_products"]["Row"],
          "id" | "created_at" | "updated_at" >>;
        Update: Partial<Database["public"]["Tables"]["ppf_products"]["Insert"]>;
        Relationships: any[];
      };
      service_orders: {
        Row: {
          id: string;
          order_number: string;
          customer_id: string;
          status: ServiceOrderStatus;
          intake_date: string;
          estimated_completion: string | null;
          actual_completion: string | null;
          technician_name: string | null;
          notes: string | null;
          subtotal: number;
          discount: number;
          tax: number;
          service_charge: number;
          total_amount: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<
          Database["public"]["Tables"]["service_orders"]["Row"],
          "id" | "created_at" | "updated_at" >>;
        Update: Partial<Database["public"]["Tables"]["service_orders"]["Insert"]>;
        Relationships: any[];
      };
      service_order_items: {
        Row: {
          id: string;
          service_order_id: string;
          ppf_product_id: string;
          vehicle_id: string | null;
          area_description: string;
          quantity_used: number;
          unit_price: number;
          line_total: number;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Omit<
          Database["public"]["Tables"]["service_order_items"]["Row"],
          "id" | "created_at" >>;
        Update: Partial<Database["public"]["Tables"]["service_order_items"]["Insert"]>;
        Relationships: any[];
      };
      service_order_vehicles: {
        Row: {
          id: string;
          service_order_id: string;
          vehicle_id: string;
          created_at: string;
        };
        Insert: Partial<Omit<
          Database["public"]["Tables"]["service_order_vehicles"]["Row"],
          "id" | "created_at" >>;
        Update: Partial<Database["public"]["Tables"]["service_order_vehicles"]["Insert"]>;
        Relationships: any[];
      };
      invoices: {
        Row: {
          id: string;
          invoice_number: string;
          invoice_type: string | null;
          service_order_id: string | null;
          customer_id: string;
          issued_date: string;
          due_date: string | null;
          status: InvoiceStatus;
          amount_paid: number;
          payment_method: string | null;
          payment_date: string | null;
          notes: string | null;
          total_amount: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<
          Database["public"]["Tables"]["invoices"]["Row"],
          "id" | "created_at" | "updated_at" >>;
        Update: Partial<Database["public"]["Tables"]["invoices"]["Insert"]>;
        Relationships: any[];
      };
      stock_movements: {
        Row: {
          id: string;
          ppf_product_id: string;
          movement_type: StockMovementType;
          quantity: number;
          reference_id: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Omit<
          Database["public"]["Tables"]["stock_movements"]["Row"],
          "id" | "created_at" >>;
        Update: Partial<Database["public"]["Tables"]["stock_movements"]["Insert"]>;
        Relationships: any[];
      };
      expenses: {
        Row: {
          id: string;
          vehicle_id: string;
          expense_date: string;
          technician_name: string;
          job_description: string;
          amount: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<
          Database["public"]["Tables"]["expenses"]["Row"],
          "id" | "created_at" | "updated_at" >>;
        Update: Partial<Database["public"]["Tables"]["expenses"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

