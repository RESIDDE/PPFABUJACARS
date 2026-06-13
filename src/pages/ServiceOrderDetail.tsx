import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, Trash2, FileText, User, Car,
  Calendar, Wrench, CheckCircle2, Loader2, MapPin, Edit
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatCurrency, getStatusLabel, generateInvoiceNumber } from "@/lib/utils";
import { CurrencyInput } from "@/components/ui/currency-input";
import type { ServiceOrderStatus } from "@/integrations/supabase/types";

const itemSchema = z.object({
  ppf_product_id: z.string().min(1, "Product is required"),
  area_description: z.string().min(1, "Area is required"),
  quantity_used: z.coerce.number().min(0.1, "Quantity must be > 0"),
  unit_price: z.coerce.number().min(0),
  notes: z.string().optional(),
});
type ItemForm = z.infer<typeof itemSchema>;

const STATUS_OPTIONS: ServiceOrderStatus[] = ["pending", "in_progress", "completed", "delivered", "cancelled"];

export default function ServiceOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; selling_price: number } | null>(null);
  
  const [feesOpen, setFeesOpen] = useState(false);
  const [feesForm, setFeesForm] = useState({ service_charge: 0, discount: 0, taxPercent: 0, includeServiceCharge: false });

  // Parking Invoice State
  const [parkingInvoiceOpen, setParkingInvoiceOpen] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["service-order", id],
    queryFn: async (): Promise<any> => {
      const { data } = await supabase.from("service_orders")
        .select("*, customers(*), vehicles(*), service_order_items(*, ppf_products(name, brand, unit))")
        .eq("id", id!)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["ppf-products-list"],
    queryFn: async (): Promise<any> => {
      const { data } = await supabase.from("ppf_products").select("id, name, brand, selling_price, unit").order("name");
      return data ?? [];
    },
  });

  const { register, control, handleSubmit, reset, setValue, formState: { errors } } = useForm<ItemForm>({
    resolver: zodResolver(itemSchema),
  });

  const statusMutation = useMutation({
    mutationFn: async (status: ServiceOrderStatus) => {
      const patch: any = { status };
      if (status === "completed" || status === "delivered") patch.actual_completion = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("service_orders")
        .update(patch)
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["service-order", id] }); },
    onError: (e) => toast.error(e.message),
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: ItemForm) => {
      const line_total = data.quantity_used * data.unit_price;
      const { error } = await supabase.from("service_order_items").insert({
        service_order_id: id!,
        ppf_product_id: data.ppf_product_id,
        area_description: data.area_description,
        quantity_used: data.quantity_used,
        unit_price: data.unit_price,
        line_total,
        notes: data.notes || null,
      });
      if (error) throw error;
      // Recalc order total
      const items = [...(order?.service_order_items ?? []), { line_total }];
      const subtotal = items.reduce((s: any, i: any) => s + ((i as { line_total: number }).line_total ?? 0), 0);
      const total_amount = subtotal + (order?.service_charge || 0) - (order?.discount || 0) + (order?.tax || 0);
      await supabase.from("service_orders").update({ subtotal, total_amount }).eq("id", id!);
    },
    onSuccess: () => {
      toast.success("Item added");
      qc.invalidateQueries({ queryKey: ["service-order", id] });
      setAddItemOpen(false);
      reset();
      setSelectedProduct(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("service_order_items").delete().eq("id", itemId);
      if (error) throw error;
      const items = (order?.service_order_items ?? []).filter((i: any) => i.id !== itemId);
      const subtotal = items.reduce((s: any, i: any) => s + ((i as { line_total: number }).line_total ?? 0), 0);
      const total_amount = subtotal + (order?.service_charge || 0) - (order?.discount || 0) + (order?.tax || 0);
      await supabase.from("service_orders").update({ subtotal, total_amount }).eq("id", id!);
    },
    onSuccess: () => { toast.success("Item removed"); qc.invalidateQueries({ queryKey: ["service-order", id] }); },
    onError: (e) => toast.error(e.message),
  });

  const updateFeesMutation = useMutation({
    mutationFn: async (data: { service_charge: number; discount: number; taxPercent: number; includeServiceCharge: boolean }) => {
      const subtotal = order?.subtotal || 0;
      const appliedServiceCharge = data.includeServiceCharge ? data.service_charge : 0;
      const taxAmount = Math.round(((subtotal + appliedServiceCharge) * data.taxPercent) / 100 * 100) / 100;
      const total_amount = subtotal + appliedServiceCharge - data.discount + taxAmount;
      const { error } = await supabase.from("service_orders").update({
        service_charge: appliedServiceCharge,
        discount: data.discount,
        tax: taxAmount,
        total_amount
      }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fees updated");
      qc.invalidateQueries({ queryKey: ["service-order", id] });
      setFeesOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error("No order loaded");
      const { error } = await supabase.from("invoices").insert({
        invoice_number: generateInvoiceNumber(),
        service_order_id: order.id,
        customer_id: order.customer_id,
        issued_date: new Date().toISOString().split("T")[0],
        status: "draft",
        amount_paid: 0,
        invoice_type: "service",
        total_amount: order.total_amount
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Invoice created — check Invoices page"); qc.invalidateQueries({ queryKey: ["invoices"] }); },
    onError: (e) => toast.error(e.message),
  });

  const vehicle = order?.vehicles as { make: string; model: string; color: string | null; plate_number: string | null; year: number | null; parking_location: string | null; items_found: string[] | null } | null;

  const insidePrice = Number(localStorage.getItem("insideParkingPrice")) || 0;
  const outsidePrice = Number(localStorage.getItem("outsideParkingPrice")) || 0;

  const getParkingPrice = () => {
    if (vehicle?.parking_location === "Inside view") return insidePrice;
    if (vehicle?.parking_location === "Outside view") return outsidePrice;
    return 0;
  };

  const createParkingInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error("No order loaded");
      const flatPrice = getParkingPrice();
      if (flatPrice === 0) throw new Error(`Parking price is not set for '${vehicle?.parking_location}'. Please configure it in Settings.`);

      const { error } = await supabase.from("invoices").insert({
        invoice_number: generateInvoiceNumber(),
        service_order_id: order.id,
        customer_id: order.customer_id,
        issued_date: new Date().toISOString().split("T")[0],
        status: "draft",
        amount_paid: 0,
        invoice_type: "parking",
        total_amount: flatPrice,
        notes: `Parking fee (${vehicle?.parking_location})`,
      });
      if (error) throw error;
    },
    onSuccess: () => { 
      toast.success("Parking invoice created"); 
      qc.invalidateQueries({ queryKey: ["invoices"] }); 
      setParkingInvoiceOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary opacity-40" /></div>;
  if (!order) return <div className="text-center py-16 text-muted-foreground">Order not found</div>;

  const customer = order.customers as { full_name: string; phone: string; email: string | null } | null;
  const items = (order.service_order_items ?? []) as Array<{ id: string; area_description: string; quantity_used: number; unit_price: number; line_total: number; notes: string | null; ppf_products: { name: string; brand: string; unit: string } | null }>;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/service-orders")}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono">{order.order_number}</h1>
            <Badge variant={order.status.replace("-", "_") as "pending" | "in_progress" | "completed" | "delivered" | "cancelled"}>{getStatusLabel(order.status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Created {formatDate(order.created_at)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Info cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3 text-muted-foreground"><User className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Customer</span></div>
                <p className="font-semibold">{customer?.full_name}</p>
                <p className="text-sm text-muted-foreground mt-1">{customer?.phone}</p>
                {customer?.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Car className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Vehicle</span>
                  </div>
                </div>
                <p className="font-semibold">{vehicle?.make} {vehicle?.model}</p>
                <p className="text-sm text-muted-foreground mt-1">{vehicle?.year} · {vehicle?.color}</p>
                <div className="flex items-center flex-wrap gap-2 mt-2">
                  {vehicle?.plate_number && <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">{vehicle.plate_number}</span>}
                  {vehicle?.parking_location && (
                    <Badge variant="outline" className="text-xs font-normal border-primary/20 text-primary bg-primary/5 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {vehicle.parking_location}
                    </Badge>
                  )}
                </div>
                
                {vehicle?.items_found && vehicle.items_found.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border/50">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Items Found in Car</p>
                    <div className="flex flex-wrap gap-1.5">
                      {vehicle.items_found.map(item => (
                        <span key={item} className="text-xs bg-muted/50 px-2 py-1 rounded text-muted-foreground border border-border/50">{item}</span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Calendar className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Intake Date</p>
                <p className="text-sm font-semibold mt-1">{formatDate(order.intake_date)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Est. Completion</p>
                <p className="text-sm font-semibold mt-1">{formatDate(order.estimated_completion)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Wrench className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Technician</p>
                <p className="text-sm font-semibold mt-1">{order.technician_name ?? "—"}</p>
              </CardContent>
            </Card>
          </div>

          {/* PPF Items */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">PPF Service Items</CardTitle>
                <Button size="sm" onClick={() => setAddItemOpen(true)}><Plus className="h-3.5 w-3.5" /> Add Item</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground text-sm">No items added yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-y border-border"><th className="text-left text-xs text-muted-foreground px-5 py-2.5 font-semibold uppercase tracking-wider">Product</th><th className="text-left text-xs text-muted-foreground px-5 py-2.5 font-semibold uppercase tracking-wider">Area</th><th className="text-right text-xs text-muted-foreground px-5 py-2.5 font-semibold uppercase tracking-wider">Qty</th><th className="text-right text-xs text-muted-foreground px-5 py-2.5 font-semibold uppercase tracking-wider">Price</th><th className="text-right text-xs text-muted-foreground px-5 py-2.5 font-semibold uppercase tracking-wider">Total</th><th className="px-3 py-2.5" /></tr></thead>
                    <tbody className="divide-y divide-border">
                      {items.map((item: any) => (
                        <tr key={item.id}>
                          <td className="px-5 py-3"><p className="font-medium">{item.ppf_products?.name}</p><p className="text-xs text-muted-foreground">{item.ppf_products?.brand}</p></td>
                          <td className="px-5 py-3 text-muted-foreground">{item.area_description}</td>
                          <td className="px-5 py-3 text-right">{item.quantity_used} {item.ppf_products?.unit}</td>
                          <td className="px-5 py-3 text-right">{formatCurrency(item.unit_price)}</td>
                          <td className="px-5 py-3 text-right font-semibold">{formatCurrency(item.line_total)}</td>
                          <td className="px-3 py-3"><button onClick={() => removeItemMutation.mutate(item.id)} className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Actions + Total */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Order Summary</CardTitle>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => {
                  const scIncluded = (order?.service_charge || 0) > 0;
                  setFeesForm({
                    service_charge: order?.service_charge || 0,
                    discount: order?.discount || 0,
                    taxPercent: order?.subtotal > 0
                      ? Math.round((((order?.tax || 0) / (order.subtotal + (order?.service_charge || 0))) * 100) * 100) / 100
                      : 0,
                    includeServiceCharge: scIncluded,
                  });
                  setFeesOpen(true);
                }}>
                  <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
              {(order.service_charge > 0 || order.discount > 0 || order.tax > 0) && <div className="border-t border-border pt-2 pb-1 space-y-2">
                {order.service_charge > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      Service Charge
                      <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">Included</span>
                    </span>
                    <span>{formatCurrency(order.service_charge)}</span>
                  </div>
                )}
                {order.discount > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Discount</span><span className="text-emerald-500">-{formatCurrency(order.discount)}</span></div>}
                {order.tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      VAT / Tax
                      {order.subtotal > 0 && (
                        <span className="ml-1.5 text-[10px] font-mono text-muted-foreground/70">
                          ({Math.round(((order.tax / (order.subtotal + (order.service_charge || 0))) * 100) * 100) / 100}%)
                        </span>
                      )}
                    </span>
                    <span>{formatCurrency(order.tax)}</span>
                  </div>
                )}
              </div>}
              <div className="flex justify-between border-t border-border pt-3 font-bold"><span>Total</span><span className="text-primary">{formatCurrency(order.total_amount)}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Update Status</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {STATUS_OPTIONS.map((s: any) => (
                <button key={s} onClick={() => statusMutation.mutate(s)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${order.status === s ? "bg-primary/15 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}>
                  {getStatusLabel(s)}
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Button className="w-full" variant="outline" onClick={() => createInvoiceMutation.mutate()} disabled={createInvoiceMutation.isPending}>
              <FileText className="h-4 w-4" />
              {createInvoiceMutation.isPending ? "Creating..." : "Generate Service Invoice"}
            </Button>
            
            <Button className="w-full" variant="outline" onClick={() => setParkingInvoiceOpen(true)} disabled={createParkingInvoiceMutation.isPending}>
              <Car className="h-4 w-4" />
              Generate Parking Invoice
            </Button>
          </div>

          {order.notes && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">Notes</p>
                <p className="text-sm">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Item Dialog */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add PPF Service Item</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => addItemMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>PPF Product *</Label>
              <Select onValueChange={(v) => {
                setValue("ppf_product_id", v);
                const p = products.find((p: any) => p.id === v);
                if (p) { setSelectedProduct(p); setValue("unit_price", p.selling_price); }
              }}>
                <SelectTrigger><SelectValue placeholder="Select PPF film..." /></SelectTrigger>
                <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.brand} — {p.name}</SelectItem>)}</SelectContent>
              </Select>
              {errors.ppf_product_id && <p className="text-xs text-destructive">{errors.ppf_product_id.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="area_description">Area / Coverage *</Label>
              <Input id="area_description" placeholder="e.g. Full Hood, Front Bumper, Door Edges" {...register("area_description")} />
              {errors.area_description && <p className="text-xs text-destructive">{errors.area_description.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="quantity_used">Quantity *</Label>
                <Input id="quantity_used" type="number" step="0.1" placeholder="1.5" {...register("quantity_used")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit_price">Unit Price (₦) *</Label>
                <Controller control={control} name="unit_price" render={({ field }) => <CurrencyInput id="unit_price" placeholder={selectedProduct ? String(selectedProduct.selling_price) : "0"} {...field} />} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-notes">Notes</Label>
              <Input id="item-notes" placeholder="Optional notes..." {...register("notes")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddItemOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addItemMutation.isPending}>{addItemMutation.isPending ? "Adding..." : "Add Item"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Fees Dialog */}
      <Dialog open={feesOpen} onOpenChange={setFeesOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Service Fees</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">

            {/* Include Service Charge Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
              <div>
                <p className="text-sm font-medium">Include Service Charge</p>
                <p className="text-xs text-muted-foreground mt-0.5">Add a service charge to this order</p>
              </div>
              <button
                type="button"
                onClick={() => setFeesForm(prev => ({ ...prev, includeServiceCharge: !prev.includeServiceCharge }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  feesForm.includeServiceCharge ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    feesForm.includeServiceCharge ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {feesForm.includeServiceCharge && (
              <div className="space-y-2">
                <Label>Service Charge (₦)</Label>
                <CurrencyInput 
                  id="fee-service" 
                  value={feesForm.service_charge} 
                  onChange={(val) => setFeesForm(prev => ({ ...prev, service_charge: val || 0 }))} 
                  placeholder="0"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Discount (₦)</Label>
              <CurrencyInput 
                id="fee-discount" 
                value={feesForm.discount} 
                onChange={(val) => setFeesForm(prev => ({ ...prev, discount: val || 0 }))} 
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label>VAT / Tax (%)</Label>
              <div className="relative">
                <input
                  id="fee-tax"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={feesForm.taxPercent || ""}
                  onChange={(e) => setFeesForm(prev => ({ ...prev, taxPercent: parseFloat(e.target.value) || 0 }))}
                  placeholder="e.g. 7.5"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm">%</span>
              </div>
              {feesForm.taxPercent > 0 && (
                <p className="text-xs text-muted-foreground">
                  = {formatCurrency(Math.round(((order?.subtotal || 0) + (feesForm.includeServiceCharge ? feesForm.service_charge : 0)) * feesForm.taxPercent / 100 * 100) / 100)} automatically applied
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeesOpen(false)}>Cancel</Button>
            <Button onClick={() => updateFeesMutation.mutate(feesForm)} disabled={updateFeesMutation.isPending}>
              {updateFeesMutation.isPending ? "Saving..." : "Save Fees"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Parking Invoice Dialog */}
      <Dialog open={parkingInvoiceOpen} onOpenChange={setParkingInvoiceOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate Parking Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm p-3 bg-muted/50 rounded-lg border border-border">
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Location:</span>
                <span className="font-medium">{vehicle?.parking_location || "Not specified"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rate:</span>
                <span className="font-medium">{formatCurrency(getParkingPrice())}</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="font-semibold text-muted-foreground">Total to Invoice:</span>
              <span className="text-lg font-bold text-primary">
                {formatCurrency(getParkingPrice())}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setParkingInvoiceOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => createParkingInvoiceMutation.mutate()} 
              disabled={createParkingInvoiceMutation.isPending || getParkingPrice() === 0}
            >
              {createParkingInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



