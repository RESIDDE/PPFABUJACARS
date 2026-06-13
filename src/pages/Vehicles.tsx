import { useState, useMemo } from "react";
import { isSameWeek, isSameMonth, subMonths } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Car, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
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
import { formatDate } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 10;

const schema = z.object({
  customer_id: z.string().optional(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  customer_email: z.string().email("Invalid email").optional().or(z.literal("")),
  customer_address: z.string().optional(),
  customer_notes: z.string().optional(),

  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  year: z.coerce.number().min(1980).max(new Date().getFullYear() + 1).optional(),
  color: z.string().optional(),
  plate_number: z.string().optional(),
  vin: z.string().toUpperCase().trim().refine(val => !val || val.length === 17, "VIN must be exactly 17 characters").optional().or(z.literal("")),
  notes: z.string().optional(),
  
  parking_location: z.string().optional(),
  items_found: z.array(z.string()).optional(),
  custom_items: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const CAR_MAKES = ["Toyota", "Lexus", "Mercedes-Benz", "BMW", "Audi", "Honda", "Ford", "Range Rover", "Porsche", "Kia", "Hyundai", "Nissan", "Peugeot", "Volkswagen", "Bentley", "Other"];
const PARKING_LOCATIONS = ["Inside view", "Outside view"];
const CAR_ITEMS = [
  "Spare tire", "Jack", "Wheel spanner", "Floor mats", 
  "First aid kit", "Fire extinguisher", "Car documents", "Warning triangle", "Umbrella", "Jumper cables"
];

export default function Vehicles() {
  const [search, setSearch] = useState("");
  const [filterMake, setFilterMake] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");
  const [filterDate, setFilterDate] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  
  // Customer selection mode
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [customerSelect, setCustomerSelect] = useState("");

  const qc = useQueryClient();

  const { data: vehiclesRaw = [], isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async (): Promise<any> => {
      const { data } = await supabase.from("vehicles").select("*, customers(full_name, phone)").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const vehicles = useMemo(() => {
    let filtered = vehiclesRaw;
    
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter((v: any) => 
        v.make?.toLowerCase().includes(s) || 
        v.model?.toLowerCase().includes(s) || 
        v.plate_number?.toLowerCase().includes(s) ||
        v.vin?.toLowerCase().includes(s) ||
        v.customers?.full_name?.toLowerCase().includes(s)
      );
    }

    if (filterMake !== "all") {
      filtered = filtered.filter((v: any) => v.make === filterMake);
    }
    
    if (filterLocation !== "all") {
      filtered = filtered.filter((v: any) => v.parking_location === filterLocation);
    }

    if (filterDate !== "all") {
      const now = new Date();
      filtered = filtered.filter((v: any) => {
        const d = new Date(v.created_at);
        if (filterDate === "this_week") return isSameWeek(d, now);
        if (filterDate === "this_month") return isSameMonth(d, now);
        if (filterDate === "last_month") {
           const lastMonth = subMonths(now, 1);
           return isSameMonth(d, lastMonth);
        }
        return true;
      });
    }

    return filtered;
  }, [vehiclesRaw, search, filterMake, filterLocation, filterDate]);

  const totalPages = Math.ceil(vehicles.length / PAGE_SIZE);
  const paginated = vehicles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async (): Promise<any> => {
      const { data } = await supabase.from("customers").select("id, full_name, phone").order("full_name");
      return data ?? [];
    },
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const phoneValue = watch("customer_phone");
  const matchedCustomer = customers.find(c => c.phone && phoneValue && c.phone.replace(/\D/g, '') === phoneValue.replace(/\D/g, '') && phoneValue.length >= 8);

  const mutation = useMutation({
    mutationFn: async ({ data, isNew }: { data: FormData; isNew: boolean }) => {
      let finalCustomerId = data.customer_id;
      
      if (isNew) {
        if (!data.customer_name || data.customer_name.trim() === "") {
          throw new Error("Customer Full Name is required when adding manually");
        }
        // Create new customer
        const { data: newCust, error: cErr } = await supabase.from("customers").insert({
          full_name: data.customer_name,
          phone: data.customer_phone || null,
          email: data.customer_email || null,
          address: data.customer_address || null,
          notes: data.customer_notes || null,
        }).select("id").single();
        if (cErr) throw cErr;
        finalCustomerId = newCust.id;
      } else {
        if (!finalCustomerId) {
          throw new Error("Please select an existing customer or add a new one");
        }
      }

      let items = data.items_found || [];
      if (data.custom_items) {
        const customArr = data.custom_items.split(',').map(s => s.trim()).filter(s => s);
        items = [...items, ...customArr];
      }

      const payload = { 
        customer_id: finalCustomerId, 
        make: data.make, 
        model: data.model,
        year: data.year || null, 
        color: data.color || null, 
        plate_number: data.plate_number || null, 
        vin: data.vin || null, 
        notes: data.notes || null,
        parking_location: data.parking_location || null,
        items_found: items.length > 0 ? items : null,
      };

      if (editingId) {
        const { error } = await supabase.from("vehicles").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vehicles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Vehicle updated" : "Vehicle added");
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["customers-list"] }); // refresh customer list in case a new one was added
      setDialogOpen(false);
      reset();
      setEditingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Vehicle deleted"); qc.invalidateQueries({ queryKey: ["vehicles"] }); },
    onError: (e) => toast.error(e.message),
  });

  const openAdd = () => { 
    reset({ 
      customer_id: "", customer_name: "", customer_phone: "", customer_email: "", customer_address: "", customer_notes: "", 
      make: "", model: "", year: undefined, color: "", plate_number: "", vin: "", notes: "",
      parking_location: undefined, items_found: [], custom_items: ""
    }); 
    setCustomerSelect("");
    setIsNewCustomer(false);
    setEditingId(null); 
    setDialogOpen(true); 
  };

  const openEdit = (v: any) => {
    const dbItems = v.items_found || [];
    const standardItems = dbItems.filter((i: string) => CAR_ITEMS.includes(i));
    const customItems = dbItems.filter((i: string) => !CAR_ITEMS.includes(i));

    reset({ 
      customer_id: v.customer_id, 
      make: v.make, 
      model: v.model, 
      year: v.year ?? undefined, 
      color: v.color ?? "", 
      plate_number: v.plate_number ?? "", 
      vin: v.vin ?? "", 
      notes: v.notes ?? "",
      parking_location: v.parking_location ?? undefined,
      items_found: standardItems,
      custom_items: customItems.join(", ")
    });
    setCustomerSelect(v.customer_id);
    setIsNewCustomer(false);
    setEditingId(v.id); 
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vehicles</h1>
          <p className="text-sm text-muted-foreground mt-1">{vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""} in registry</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Vehicle</Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by customer, make, model, plate, VIN..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filterDate} onValueChange={(v) => { setFilterDate(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Time Period" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterMake} onValueChange={(v) => { setFilterMake(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Makes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Makes</SelectItem>
              {CAR_MAKES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterLocation} onValueChange={(v) => { setFilterLocation(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Locations" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {PARKING_LOCATIONS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 rounded-xl shimmer" />)}
        </div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Car className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No vehicles found</p>
          <p className="text-sm mt-1">Add vehicles to start tracking service records</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginated.map((v) => {
              const customer = v.customers as { full_name: string; phone: string } | null;
              return (
                <Card key={v.id} className="hover:border-primary/30 transition-colors group">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <Car className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{v.make} {v.model}</p>
                          <p className="text-xs text-muted-foreground">{v.year ?? "—"} · {v.color ?? "Unknown color"}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(v)} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => { if (confirm("Delete this vehicle?")) deleteMutation.mutate(v.id); }} className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {v.plate_number && <div className="font-mono bg-muted/50 rounded px-2 py-1 text-foreground inline-block">{v.plate_number}</div>}
                      {customer && <p className="mt-2">👤 {customer.full_name}</p>}
                      <p>Added {formatDate(v.created_at)}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} totalItems={vehicles.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Vehicle" : "Add New Vehicle"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => mutation.mutate({ data: d, isNew: isNewCustomer }))} className="space-y-6">
            
            {/* Customer Section */}
            <div className="space-y-4 border border-border rounded-lg p-4 bg-muted/20">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">Customer Details</Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsNewCustomer(!isNewCustomer)}
                  className="h-8 text-xs text-primary hover:text-primary/80"
                >
                  {isNewCustomer ? "Select Existing Customer" : "+ Add Customer Manually"}
                </Button>
              </div>

              {!isNewCustomer ? (
                <div className="space-y-2">
                  <Label>Select Customer *</Label>
                  <Select 
                    value={customerSelect} 
                    onValueChange={(v) => { 
                      setCustomerSelect(v); 
                      setValue("customer_id", v); 
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Search or select..." /></SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.phone || "No phone"})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="customer_name">Full Name *</Label>
                      <Input id="customer_name" placeholder="Ibrahim Aliyu" {...register("customer_name")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer_phone">Phone</Label>
                      <Input id="customer_phone" placeholder="08012345678" {...register("customer_phone")} />
                      {matchedCustomer && (
                        <div className="mt-2 p-2 bg-primary/10 border border-primary/20 rounded-md flex items-center justify-between">
                          <div className="text-xs text-foreground">
                            <span className="font-semibold text-primary">Match found:</span> {matchedCustomer.full_name}
                          </div>
                          <Button 
                            type="button" 
                            size="sm" 
                            variant="secondary" 
                            className="h-6 text-xs px-2 bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={() => {
                              setIsNewCustomer(false);
                              setCustomerSelect(matchedCustomer.id);
                              setValue("customer_id", matchedCustomer.id);
                            }}
                          >
                            Select
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer_email">Email</Label>
                    <Input id="customer_email" type="email" placeholder="customer@email.com" {...register("customer_email")} />
                    {errors.customer_email && <p className="text-xs text-destructive">{errors.customer_email.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer_address">Address</Label>
                    <Input id="customer_address" placeholder="Maitama, Abuja" {...register("customer_address")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer_notes">Customer Notes</Label>
                    <Textarea id="customer_notes" placeholder="Any notes about this customer..." {...register("customer_notes")} />
                  </div>
                </div>
              )}
            </div>

            {/* Vehicle Section */}
            <div className="space-y-4 border border-border rounded-lg p-4 bg-muted/20">
              <Label className="text-base font-semibold mb-2 block">Vehicle Details</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Make *</Label>
                  <Select onValueChange={(v) => setValue("make", v)} defaultValue={editingId ? undefined : undefined}>
                    <SelectTrigger><SelectValue placeholder="Select make..." /></SelectTrigger>
                    <SelectContent>{CAR_MAKES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                  {errors.make && <p className="text-xs text-destructive">{errors.make.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model *</Label>
                  <Input id="model" placeholder="Camry, X5..." {...register("model")} />
                  {errors.model && <p className="text-xs text-destructive">{errors.model.message}</p>}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input id="year" type="number" placeholder="2023" {...register("year")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <Input id="color" placeholder="Pearl White" {...register("color")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="plate_number">Plate Number</Label>
                  <Input id="plate_number" placeholder="ABC-123-XY" {...register("plate_number")} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="vin">VIN</Label>
                    <span className={`text-xs ${watch("vin")?.length === 17 ? "text-emerald-500 font-medium" : "text-muted-foreground"}`}>
                      {watch("vin")?.length || 0}/17
                    </span>
                  </div>
                  <Input 
                    id="vin" 
                    placeholder="17-character VIN" 
                    maxLength={17}
                    className="uppercase"
                    {...register("vin", {
                      onChange: (e) => {
                        e.target.value = e.target.value.toUpperCase();
                      }
                    })} 
                  />
                  {errors.vin && <p className="text-xs text-destructive">{errors.vin.message}</p>}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Parking Lot</Label>
                  <Select onValueChange={(v) => setValue("parking_location", v)} defaultValue={editingId ? undefined : undefined}>
                    <SelectTrigger><SelectValue placeholder="Select location..." /></SelectTrigger>
                    <SelectContent>{PARKING_LOCATIONS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Label>Items Found in the Car</Label>
                <div className="grid grid-cols-2 gap-3">
                  {CAR_ITEMS.map((item) => (
                    <div key={item} className="flex items-center space-x-2">
                      <input 
                         type="checkbox"
                         id={`item-${item}`} 
                         className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary bg-background accent-primary cursor-pointer"
                         checked={watch("items_found")?.includes(item)}
                         onChange={(e) => {
                           const current = watch("items_found") || [];
                           if (e.target.checked) setValue("items_found", [...current, item]);
                           else setValue("items_found", current.filter(i => i !== item));
                         }}
                      />
                      <label htmlFor={`item-${item}`} className="text-sm font-medium leading-none cursor-pointer select-none text-muted-foreground">{item}</label>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 mt-4">
                  <Label htmlFor="custom_items">Other Items (comma separated)</Label>
                  <Input id="custom_items" placeholder="e.g., Sunglasses, Umbrella..." {...register("custom_items")} />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="v-notes">Notes</Label>
                <Textarea id="v-notes" placeholder="Any additional notes..." {...register("notes")} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving..." : editingId ? "Update" : "Add Vehicle"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
