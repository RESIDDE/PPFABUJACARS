import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Package, AlertTriangle, Pencil, TrendingDown, TrendingUp, Printer } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CurrencyInput } from "@/components/ui/currency-input";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  brand: z.string().min(1, "Brand is required"),
  sku: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  unit_cost: z.coerce.number().min(0),
  selling_price: z.coerce.number().min(0),
  stock_quantity: z.coerce.number().min(0),
  reorder_level: z.coerce.number().min(0),
  description: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const PPF_BRANDS = ["XPEL", "3M", "SunTek", "LLumar", "Avery Dennison", "STEK", "Hexis", "Other"];
const UNITS = ["meter", "sqft", "roll", "piece"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [brandValue, setBrandValue] = useState("");
  const [unitValue, setUnitValue] = useState("");
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [stockProductId, setStockProductId] = useState<string | null>(null);
  const [stockQty, setStockQty] = useState(0);
  const [stockType, setStockType] = useState<"in" | "out" | "adjustment">("in");
  const [isCustomBrand, setIsCustomBrand] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedHistoryProduct, setSelectedHistoryProduct] = useState<any>(null);
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const qc = useQueryClient();

  const { data: productHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ["product-history", selectedHistoryProduct?.id, historyStartDate, historyEndDate],
    queryFn: async (): Promise<any[]> => {
      if (!selectedHistoryProduct) return [];
      let q = supabase
        .from("service_order_items")
        .select(`
          id,
          quantity_used,
          created_at,
          service_orders!inner (
            id,
            order_number,
            intake_date,
            customers (
              full_name
            ),
            service_order_vehicles (
              vehicles (
                make,
                model,
                plate_number,
                vin
              )
            )
          )
        `)
        .eq("ppf_product_id", selectedHistoryProduct.id)
        .order("created_at", { ascending: false });

      if (historyStartDate) {
        q = q.gte("service_orders.intake_date", historyStartDate);
      }
      if (historyEndDate) {
        q = q.lte("service_orders.intake_date", historyEndDate);
      }

      const { data } = await q;
      return data || [];
    },
    enabled: !!selectedHistoryProduct,
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["ppf-products", search],
    queryFn: async (): Promise<any> => {
      let q = supabase.from("ppf_products").select("*").order("brand");
      if (search) q = q.or(`name.ilike.%${search}%,brand.ilike.%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { register, control, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = { ...data, sku: data.sku || null, description: data.description || null };
      if (editingId) {
        const { error } = await supabase.from("ppf_products").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ppf_products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Product updated" : "Product added");
      qc.invalidateQueries({ queryKey: ["ppf-products"] });
      setDialogOpen(false);
      reset();
      setEditingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const stockMutation = useMutation({
    mutationFn: async () => {
      if (!stockProductId) return;
      const product = products.find((p: any) => p.id === stockProductId);
      if (!product) return;
      let newQty = product.stock_quantity;
      if (stockType === "in") newQty += stockQty;
      else if (stockType === "out") newQty = Math.max(0, newQty - stockQty);
      else newQty = stockQty;
      const { error: pe } = await supabase.from("ppf_products").update({ stock_quantity: newQty }).eq("id", stockProductId);
      if (pe) throw pe;
      const { error: me } = await supabase.from("stock_movements").insert({ ppf_product_id: stockProductId, movement_type: stockType, quantity: stockQty, notes: `Manual ${stockType}` });
      if (me) throw me;
    },
    onSuccess: () => {
      toast.success("Stock updated");
      qc.invalidateQueries({ queryKey: ["ppf-products"] });
      setStockDialogOpen(false);
      setStockQty(0);
    },
    onError: (e) => toast.error(e.message),
  });

  const openEdit = (p: typeof products[0]) => {
    reset({ name: p.name, brand: p.brand, sku: p.sku ?? "", unit: p.unit, unit_cost: p.unit_cost, selling_price: p.selling_price, stock_quantity: p.stock_quantity, reorder_level: p.reorder_level, description: p.description ?? "" });
    
    const isCustom = !PPF_BRANDS.includes(p.brand);
    setIsCustomBrand(isCustom);
    setBrandValue(isCustom ? "Other" : p.brand);
    
    setUnitValue(p.unit);
    setEditingId(p.id);
    setDialogOpen(true);
  };

  const openAdd = () => { reset(); setBrandValue(""); setUnitValue(""); setIsCustomBrand(false); setEditingId(null); setDialogOpen(true); };

  const openHistory = (p: any) => {
    setSelectedHistoryProduct(p);
    setHistoryStartDate("");
    setHistoryEndDate("");
    setHistoryDialogOpen(true);
  };

  const handleMonthSelect = (monthStr: string) => {
    if (monthStr === "all") {
      setHistoryStartDate("");
      setHistoryEndDate("");
      return;
    }
    
    const month = parseInt(monthStr, 10);
    const year = new Date().getFullYear();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); // last day of the month

    const formatYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    setHistoryStartDate(formatYMD(startDate));
    setHistoryEndDate(formatYMD(endDate));
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    // Get the base URL so the image loads correctly in the new window
    const baseUrl = window.location.origin;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Usage History - ${selectedHistoryProduct?.brand} ${selectedHistoryProduct?.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
            body { font-family: 'Inter', system-ui, sans-serif; color: #0f172a; margin: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .container { position: relative; max-width: 800px; margin: 0 auto; padding: 40px; min-height: 100vh; overflow: hidden; }
            
            /* Watermark */
            .watermark { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: url('${baseUrl}/logo.jpeg'); background-position: center; background-size: 60%; background-repeat: no-repeat; opacity: 0.03; z-index: 0; pointer-events: none; }
            
            .content { position: relative; z-index: 10; }
            
            /* Header */
            .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid rgba(59, 130, 246, 0.15); margin-bottom: 24px; }
            .header-left { display: flex; align-items: center; gap: 16px; }
            .logo { width: 64px; height: 64px; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; flex-shrink: 0; background: white; }
            .logo img { width: 100%; height: 100%; object-fit: cover; }
            .company-info h3 { font-weight: 900; font-size: 16px; text-transform: uppercase; margin: 0 0 2px 0; color: #0f172a; }
            .company-info p { font-size: 11px; color: #64748b; margin: 0 0 2px 0; line-height: 1.3; }
            .header-right { text-align: right; }
            .header-right h1 { font-size: 28px; font-weight: 900; color: #3b82f6; text-transform: uppercase; margin: 0; letter-spacing: -0.5px; line-height: 1; }
            .header-right p { font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin: 6px 0 0 0; }
            
            /* Meta Info */
            .meta-info { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e2e8f0; margin-bottom: 24px; }
            .meta-section { font-size: 12px; }
            .meta-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0; }
            .meta-value { font-size: 13px; font-weight: 600; color: #0f172a; margin: 0 0 4px 0; }
            .meta-value span { font-weight: 400; }
            
            /* Table */
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; font-size: 12px; }
            th, td { padding: 10px 8px; text-align: left; }
            th { border-bottom: 2px solid #cbd5e1; font-weight: 600; text-transform: uppercase; color: #64748b; font-size: 11px; letter-spacing: 0.5px; }
            td { border-bottom: 1px solid #e2e8f0; }
            .right { text-align: right; }
            .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #3b82f6; }
            .vehicle-plate { font-size: 11px; color: #64748b; margin-left: 6px; }
            
            .footer { position: absolute; bottom: 40px; left: 40px; right: 40px; text-align: center; font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="watermark"></div>
            
            <div class="content">
              <div class="header">
                <div class="header-left">
                  <div class="logo">
                    <img src="${baseUrl}/logo.jpeg" alt="PPF Abuja Cars Logo" />
                  </div>
                  <div class="company-info">
                    <h3>PPF ABUJACAR</h3>
                    <p>Plot 5 Bala Kona Street, off Ahmadu Bello</p>
                    <p>Expressway, Kado, FCT Abuja</p>
                    <p>+234 808 535 9774</p>
                  </div>
                </div>
                <div class="header-right">
                  <h1>Usage History</h1>
                  <p>Product Report</p>
                </div>
              </div>
              
              <div class="meta-info">
                <div class="meta-section">
                  <p class="meta-label">Product Details</p>
                  <p class="meta-value">Brand: <span>${selectedHistoryProduct?.brand}</span></p>
                  <p class="meta-value">Name: <span>${selectedHistoryProduct?.name}</span></p>
                  ${historyStartDate || historyEndDate ? `<p class="meta-value mt-2">Period: <span>${historyStartDate || 'Beginning'} to ${historyEndDate || 'Present'}</span></p>` : ''}
                </div>
                <div class="meta-section" style="text-align: right;">
                  <p class="meta-label">Generated On</p>
                  <p class="meta-value">${new Date().toLocaleDateString()}</p>
                  <p class="meta-label" style="margin-top: 12px;">Total Records</p>
                  <p class="meta-value">${productHistory.length} entry(s)</p>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="width: 15%;">Date</th>
                    <th style="width: 15%;">Order #</th>
                    <th style="width: 25%;">Customer</th>
                    <th style="width: 35%;">Vehicle</th>
                    <th class="right" style="width: 10%;">Qty Used</th>
                  </tr>
                </thead>
                <tbody>
                  ${productHistory.map(h => {
                    const v = h.service_orders?.service_order_vehicles?.[0]?.vehicles;
                    return `
                    <tr>
                      <td>${formatDate(h.service_orders?.intake_date || h.created_at)}</td>
                      <td class="font-mono">${h.service_orders?.order_number}</td>
                      <td>${h.service_orders?.customers?.full_name || 'Unknown'}</td>
                      <td>
                        <strong>${v?.make || 'Unknown'} ${v?.model || ''}</strong>
                        <span class="vehicle-plate">(${v?.plate_number || 'No Plate'})</span>
                        ${v?.vin ? `<br/><span style="font-size: 10px; color: #94a3b8; font-family: monospace;">VIN: ${v.vin}</span>` : ''}
                      </td>
                      <td class="right" style="font-weight: 600;">${h.quantity_used} ${selectedHistoryProduct?.unit}</td>
                    </tr>
                  `}).join('')}
                  ${productHistory.length === 0 ? `<tr><td colspan="5" style="text-align: center; padding: 40px; color: #94a3b8;">No usage records found for this product.</td></tr>` : ''}
                </tbody>
              </table>
            </div>
            
            <div class="footer">
              Generated by PPF Abuja Cars Inventory System
            </div>
          </div>
          
          <script>
            window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); }
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">PPF Inventory</h1>
          <p className="text-sm text-muted-foreground mt-1">{products.length} product{products.length !== 1 ? "s" : ""} in stock</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Product</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search products..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-44 rounded-xl shimmer" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No products in inventory</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p: any) => {
            const isLow = p.stock_quantity <= p.reorder_level;
            return (
              <Card key={p.id} className={`hover:border-primary/30 transition-colors group cursor-pointer ${isLow ? "border-amber-500/30" : ""}`} onClick={() => openHistory(p)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider">{p.brand}</span>
                        {isLow && <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded"><AlertTriangle className="h-2.5 w-2.5" />Low</span>}
                      </div>
                      <p className="font-semibold text-sm">{p.name}</p>
                      {p.sku && <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="p-1.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"><Pencil className="h-3.5 w-3.5" /></button>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stock</span>
                      <span className={`font-bold ${isLow ? "text-amber-400" : "text-emerald-400"}`}>{p.stock_quantity} {p.unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cost</span>
                      <span>{formatCurrency(p.unit_cost)}/{p.unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sell Price</span>
                      <span className="font-semibold text-primary">{formatCurrency(p.selling_price)}/{p.unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Low Stock Threshold</span>
                      <span>{p.reorder_level} {p.unit}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button onClick={(e) => { e.stopPropagation(); setStockProductId(p.id); setStockType("in"); setStockDialogOpen(true); }} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                      <TrendingUp className="h-3 w-3" /> Stock In
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setStockProductId(p.id); setStockType("out"); setStockDialogOpen(true); }} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                      <TrendingDown className="h-3 w-3" /> Stock Out
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editingId ? "Edit Product" : "Add PPF Product"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Brand *</Label>
                <Select value={brandValue} onValueChange={(v) => { 
                  setBrandValue(v); 
                  if (v === "Other") {
                    setIsCustomBrand(true);
                    setValue("brand", "");
                  } else {
                    setIsCustomBrand(false);
                    setValue("brand", v); 
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="Select brand..." /></SelectTrigger>
                  <SelectContent>{PPF_BRANDS.map((b: any) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
                {isCustomBrand && (
                  <Input 
                    className="mt-2" 
                    placeholder="Enter custom brand name..." 
                    {...register("brand")} 
                  />
                )}
                {errors.brand && <p className="text-xs text-destructive">{errors.brand.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-name">Product Name *</Label>
                <Input id="p-name" placeholder="Ultimate Plus, Paint Protection" {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="p-sku">SKU</Label>
                <Input id="p-sku" placeholder="XPEL-ULT-60" {...register("sku")} />
              </div>
              <div className="space-y-2">
                <Label>Unit *</Label>
                <Select value={unitValue} onValueChange={(v) => { setUnitValue(v); setValue("unit", v); }}>
                  <SelectTrigger><SelectValue placeholder="Select unit..." /></SelectTrigger>
                  <SelectContent>{UNITS.map((u: any) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
                {errors.unit && <p className="text-xs text-destructive">{errors.unit.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="unit_cost">Cost Price (₦)</Label>
                <Controller control={control} name="unit_cost" render={({ field }) => <CurrencyInput id="unit_cost" {...field} />} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="selling_price">Selling Price (₦)</Label>
                <Controller control={control} name="selling_price" render={({ field }) => <CurrencyInput id="selling_price" {...field} />} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="stock_quantity">Stock Quantity</Label>
                <Input id="stock_quantity" type="number" {...register("stock_quantity")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reorder_level">Low Stock Threshold</Label>
                <Input id="reorder_level" type="number" {...register("reorder_level")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-desc">Description</Label>
              <Textarea id="p-desc" placeholder="Product description..." {...register("description")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving..." : editingId ? "Update" : "Add Product"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock Movement Dialog */}
      <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{stockType === "in" ? "📦 Stock In" : stockType === "out" ? "📤 Stock Out" : "🔄 Adjust Stock"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Movement Type</Label>
              <Select value={stockType} onValueChange={(v) => setStockType(v as "in" | "out" | "adjustment")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Stock In (receive)</SelectItem>
                  <SelectItem value="out">Stock Out (use/issue)</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" step="0.1" min="0" value={stockQty} onChange={(e) => setStockQty(parseFloat(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => stockMutation.mutate()} disabled={stockMutation.isPending || stockQty <= 0}>
              {stockMutation.isPending ? "Updating..." : "Update Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl">Usage History</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1 font-medium">{selectedHistoryProduct?.brand} {selectedHistoryProduct?.name}</p>
              </div>
              <div className="flex items-center gap-3 pr-6">
                <div className="flex items-center gap-2">
                  <Select onValueChange={handleMonthSelect}>
                    <SelectTrigger className="h-9 text-xs w-[120px]">
                      <SelectValue placeholder="Filter Month..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={m} value={i.toString()}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-1 border-l border-border pl-2">
                    <Input 
                      type="date" 
                      value={historyStartDate} 
                      onChange={(e) => setHistoryStartDate(e.target.value)}
                      className="h-9 text-xs w-[130px]"
                      title="Start Date"
                    />
                    <span className="text-muted-foreground text-xs">-</span>
                    <Input 
                      type="date" 
                      value={historyEndDate} 
                      onChange={(e) => setHistoryEndDate(e.target.value)}
                      className="h-9 text-xs w-[130px]"
                      title="End Date"
                    />
                  </div>
                </div>
                <Button size="sm" onClick={handlePrint} className="gap-2">
                  <Printer className="h-4 w-4" /> Print Record
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          {historyLoading ? (
            <div className="flex justify-center py-8 text-muted-foreground">Loading history...</div>
          ) : productHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No usage history found for this product.
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2">Date</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2">Order #</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2">Customer</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2">Vehicle</th>
                      <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2">Qty Used</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {productHistory.map((h: any) => {
                      const v = h.service_orders?.service_order_vehicles?.[0]?.vehicles;
                      return (
                      <tr key={h.id}>
                        <td className="py-2.5">{formatDate(h.service_orders?.intake_date || h.created_at)}</td>
                        <td className="py-2.5 font-mono text-xs text-primary">{h.service_orders?.order_number}</td>
                        <td className="py-2.5 font-medium">{h.service_orders?.customers?.full_name || "Unknown"}</td>
                        <td className="py-2.5">
                          <span className="font-medium">{v?.make || 'Unknown'} {v?.model || ''}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({v?.plate_number || "No Plate"})
                          </span>
                          {v?.vin && (
                            <div className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                              VIN: {v.vin}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 text-right font-medium">{h.quantity_used} {selectedHistoryProduct?.unit}</td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

