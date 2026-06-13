import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Package, AlertTriangle, Pencil, TrendingDown, TrendingUp } from "lucide-react";
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
  const qc = useQueryClient();

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
    setBrandValue(p.brand);
    setUnitValue(p.unit);
    setEditingId(p.id);
    setDialogOpen(true);
  };

  const openAdd = () => { reset(); setBrandValue(""); setUnitValue(""); setEditingId(null); setDialogOpen(true); };

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
              <Card key={p.id} className={`hover:border-primary/30 transition-colors group ${isLow ? "border-amber-500/30" : ""}`}>
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
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"><Pencil className="h-3.5 w-3.5" /></button>
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
                      <span className="text-muted-foreground">Reorder Level</span>
                      <span>{p.reorder_level} {p.unit}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button onClick={() => { setStockProductId(p.id); setStockType("in"); setStockDialogOpen(true); }} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                      <TrendingUp className="h-3 w-3" /> Stock In
                    </button>
                    <button onClick={() => { setStockProductId(p.id); setStockType("out"); setStockDialogOpen(true); }} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
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
                <Select value={brandValue} onValueChange={(v) => { setBrandValue(v); setValue("brand", v); }}>
                  <SelectTrigger><SelectValue placeholder="Select brand..." /></SelectTrigger>
                  <SelectContent>{PPF_BRANDS.map((b: any) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
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
                <Label htmlFor="reorder_level">Reorder Level</Label>
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
    </div>
  );
}

