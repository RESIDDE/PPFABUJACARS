import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ClipboardList, Eye, Calendar, History, Car, Trash2 } from "lucide-react";
import { isSameWeek, isSameMonth, subMonths } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatCurrency, getStatusLabel, generateOrderNumber, confirmDelete } from "@/lib/utils";
import type { ServiceOrderStatus } from "@/integrations/supabase/types";
import CustomerHistoryDialog from "@/components/CustomerHistoryDialog";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 15;

const schema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  vehicle_ids: z.array(z.string()).min(1, "Select at least one vehicle"),
  intake_date: z.string().min(1, "Intake date is required"),
  estimated_completion: z.string().optional(),
  technician_name: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed", "delivered", "cancelled"]).default("pending"),
});
type FormData = z.infer<typeof schema>;

const STATUS_OPTIONS: ServiceOrderStatus[] = ["pending", "in_progress", "completed", "delivered", "cancelled"];

export default function ServiceOrders() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: ordersData = [], isLoading } = useQuery({
    queryKey: ["service-orders", statusFilter],
    queryFn: async (): Promise<any> => {
      let q = supabase.from("service_orders")
        .select("*, customers(full_name, phone), service_order_vehicles(vehicles(make, model, plate_number, vin))")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter as ServiceOrderStatus);
      const { data } = await q;
      return data ?? [];
    },
  });

  const orders = useMemo(() => {
    const now = new Date();
    let filtered = ordersData;
    
    if (filterStartDate || filterEndDate) {
      filtered = filtered.filter((o: any) => {
        const dStr = (o.intake_date || o.created_at).split("T")[0];
        if (filterStartDate && dStr < filterStartDate) return false;
        if (filterEndDate && dStr > filterEndDate) return false;
        return true;
      });
    } else if (timeFilter !== "all") {
      filtered = filtered.filter((o: any) => {
        const d = new Date(o.intake_date || o.created_at);
        if (timeFilter === "this_week") return isSameWeek(d, now);
        if (timeFilter === "this_month") return isSameMonth(d, now);
        if (timeFilter === "last_month") return isSameMonth(d, subMonths(now, 1));
        return true;
      });
    }

    if (!search) return filtered;
    const s = search.toLowerCase();
    return filtered.filter((o: any) => {
      const customer = o.customers as { full_name: string } | null;
      const vehicles = o.service_order_vehicles?.map((sov: any) => sov.vehicles).filter(Boolean) || [];
      
      const vehicleMatch = vehicles.some((v: any) => 
        v.plate_number?.toLowerCase().includes(s) ||
        v.vin?.toLowerCase().includes(s) ||
        v.make?.toLowerCase().includes(s) ||
        v.model?.toLowerCase().includes(s)
      );

      return (
        o.order_number?.toLowerCase().includes(s) ||
        customer?.full_name?.toLowerCase().includes(s) ||
        vehicleMatch
      );
    });
  }, [ordersData, search, timeFilter]);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async (): Promise<any> => { const { data } = await supabase.from("customers").select("id, full_name").order("full_name"); return data ?? []; },
  });

  const { data: customerVehicles = [] } = useQuery({
    queryKey: ["customer-vehicles", selectedCustomer],
    queryFn: async (): Promise<any> => {
      if (!selectedCustomer) return [];
      const { data } = await supabase.from("vehicles").select("id, make, model, plate_number").eq("customer_id", selectedCustomer);
      return data ?? [];
    },
    enabled: !!selectedCustomer,
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "pending", intake_date: new Date().toISOString().split("T")[0], vehicle_ids: [] },
  });

  const watchedVehicleIds = watch("vehicle_ids") || [];

  const toggleVehicle = (id: string) => {
    const current = watchedVehicleIds;
    if (current.includes(id)) {
      setValue("vehicle_ids", current.filter(v => v !== id));
    } else {
      setValue("vehicle_ids", [...current, id]);
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      // 1. Insert service order
      const { data: order, error } = await supabase.from("service_orders").insert({
        customer_id: data.customer_id,
        status: data.status,
        intake_date: data.intake_date,
        order_number: generateOrderNumber(),
        estimated_completion: data.estimated_completion || null,
        technician_name: data.technician_name || null,
        notes: data.notes || null,
        subtotal: 0,
        discount: 0,
        tax: 0,
        service_charge: 0,
        total_amount: 0,
      }).select().single();
      
      if (error) throw error;

      // 2. Insert into service_order_vehicles for each vehicle_id
      const vehicleInserts = data.vehicle_ids.map(vid => ({
        service_order_id: order.id,
        vehicle_id: vid
      }));

      const { error: vError } = await supabase.from("service_order_vehicles").insert(vehicleInserts);
      if (vError) throw vError;
    },
    onSuccess: () => {
      toast.success("Service order created");
      qc.invalidateQueries({ queryKey: ["service-orders"] });
      setDialogOpen(false);
      reset();
      setSelectedCustomer("");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Service order deleted");
      qc.invalidateQueries({ queryKey: ["service-orders"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Service Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">{orders.length} order{orders.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setHistoryDialogOpen(true)} className="hidden sm:flex">
            <History className="h-4 w-4 mr-2" /> History & Invoices
          </Button>
          <Button variant="outline" size="icon" onClick={() => setHistoryDialogOpen(true)} className="sm:hidden">
            <History className="h-4 w-4" />
          </Button>
          <Button onClick={() => { reset({ status: "pending", intake_date: new Date().toISOString().split("T")[0], vehicle_ids: [] }); setSelectedCustomer(""); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline ml-2">New Order</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search order, customer, VIN, plate..." className="pl-9 w-64" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="flex items-center gap-1">
          <Input type="date" value={filterStartDate} onChange={(e) => { setFilterStartDate(e.target.value); setPage(1); }} className="w-[130px]" title="Start Date" />
          <span className="text-muted-foreground">-</span>
          <Input type="date" value={filterEndDate} onChange={(e) => { setFilterEndDate(e.target.value); setPage(1); }} className="w-[130px]" title="End Date" />
        </div>
        
        <Select value={timeFilter} onValueChange={(v) => { setTimeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Time Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2 flex-wrap items-center">
          {["all", ...STATUS_OPTIONS].map((s: any) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {s === "all" ? "All" : getStatusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {/* Orders table */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-lg shimmer" />)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No service orders</p>
        </div>
      ) : (
        <>
          {/* Mobile view (Cards) */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((o: any) => {
              const customer = o.customers as { full_name: string } | null;
              const vehicles = o.service_order_vehicles?.map((sov: any) => sov.vehicles).filter(Boolean) || [];
              const vehiclesText = vehicles.length > 0 
                ? vehicles.map((v: any) => `${v.make} ${v.model}`).join(", ")
                : "—";

              return (
                <Card key={o.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate(`/service-orders/${o.id}`)}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-mono font-bold text-primary mb-1">{o.order_number}</p>
                        <p className="font-medium text-base">{customer?.full_name ?? "—"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={o.status.replace("-", "_") as "pending" | "in_progress" | "completed" | "delivered" | "cancelled"}>{getStatusLabel(o.status)}</Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={(e) => { e.stopPropagation(); if(confirmDelete("service order")) deleteMutation.mutate(o.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Vehicles</p>
                        <p className="text-foreground line-clamp-2">{vehiclesText}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Date & Total</p>
                        <div className="flex items-center gap-1 text-foreground mb-0.5"><Calendar className="h-3 w-3 text-muted-foreground" />{formatDate(o.intake_date)}</div>
                        <p className="font-bold text-emerald-500">{formatCurrency(o.total_amount)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="md:hidden">
            <Pagination page={page} totalPages={Math.ceil(orders.length / PAGE_SIZE)} totalItems={orders.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>

          {/* Desktop view (Table) */}
          <Card className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Order #</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Customer</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Vehicles</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Date</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Status</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Total</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((o: any) => {
                    const customer = o.customers as { full_name: string } | null;
                    const vehicles = o.service_order_vehicles?.map((sov: any) => sov.vehicles).filter(Boolean) || [];
                    const vehiclesText = vehicles.length > 0 
                      ? vehicles.map((v: any) => `${v.make} ${v.model}`).join(", ")
                      : "—";

                    return (
                      <tr key={o.id} className="table-row-hover" onClick={() => navigate(`/service-orders/${o.id}`)}>
                        <td className="px-5 py-3.5 text-sm font-mono font-medium text-primary">{o.order_number}</td>
                        <td className="px-5 py-3.5 text-sm">{customer?.full_name ?? "—"}</td>
                        <td className="px-5 py-3.5 text-sm text-muted-foreground max-w-[200px] truncate" title={vehiclesText}>
                          {vehiclesText}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-muted-foreground"><div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{formatDate(o.intake_date)}</div></td>
                        <td className="px-5 py-3.5"><Badge variant={o.status.replace("-", "_") as "pending" | "in_progress" | "completed" | "delivered" | "cancelled"}>{getStatusLabel(o.status)}</Badge></td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-right">{formatCurrency(o.total_amount)}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/service-orders/${o.id}`); }}><Eye className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={(e) => { e.stopPropagation(); if(confirmDelete("service order")) deleteMutation.mutate(o.id); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 pb-4">
              <Pagination page={page} totalPages={Math.ceil(orders.length / PAGE_SIZE)} totalItems={orders.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </div>
          </Card>
        </>
      )}

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Create Service Order</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Customer *</Label>
                <Select onValueChange={(v) => { 
                  setSelectedCustomer(v); 
                  setValue("customer_id", v); 
                  setValue("vehicle_ids", []); 
                }}>
                  <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                  <SelectContent>{customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                </Select>
                {errors.customer_id && <p className="text-xs text-destructive">{errors.customer_id.message}</p>}
              </div>
              
              <div className="space-y-2">
                <Label>Vehicles *</Label>
                <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto p-2 border border-border rounded-md bg-muted/10">
                  {!selectedCustomer ? (
                    <p className="text-xs text-muted-foreground p-1">Select a customer first</p>
                  ) : customerVehicles.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-1">No vehicles found</p>
                  ) : (
                    customerVehicles.map((v: any) => (
                      <label key={v.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/30 p-1 rounded">
                        <input 
                          type="checkbox" 
                          checked={watchedVehicleIds.includes(v.id)}
                          onChange={() => toggleVehicle(v.id)}
                          className="accent-primary w-4 h-4 rounded"
                        />
                        <span className="truncate flex-1">{v.make} {v.model} {v.plate_number ? `· ${v.plate_number}` : ""}</span>
                      </label>
                    ))
                  )}
                </div>
                {errors.vehicle_ids && <p className="text-xs text-destructive">{errors.vehicle_ids.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="intake_date">Intake Date *</Label>
                <Input id="intake_date" type="date" {...register("intake_date")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimated_completion">Est. Completion</Label>
                <Input id="estimated_completion" type="date" {...register("estimated_completion")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="technician_name">Technician</Label>
                <Input id="technician_name" placeholder="Technician name" {...register("technician_name")} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select defaultValue="pending" onValueChange={(v) => setValue("status", v as ServiceOrderStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map((s: any) => <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="so-notes">Notes</Label>
              <Textarea id="so-notes" placeholder="Service notes..." {...register("notes")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Creating..." : "Create Order"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CustomerHistoryDialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen} />
    </div>
  );
}
