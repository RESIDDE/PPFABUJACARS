import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Search, CheckCircle2, Clock, AlertCircle, CreditCard, Trash2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatDateTime, formatCurrency, getStatusLabel } from "@/lib/utils";
import { CurrencyInput } from "@/components/ui/currency-input";
import type { InvoiceStatus } from "@/integrations/supabase/types";
import InvoiceDocument from "@/components/InvoiceDocument";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 15;

const paymentSchema = z.object({
  amount_paid: z.coerce.number().min(0),
  payment_method: z.string().min(1),
  payment_date: z.string().min(1),
});
type PaymentForm = z.infer<typeof paymentSchema>;

const STATUS_OPTIONS: InvoiceStatus[] = ["draft", "sent", "paid", "overdue"];
const PAYMENT_METHODS = ["Cash", "Bank Transfer", "POS", "Cheque", "USSD"];

export default function Invoices() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payInvoiceId, setPayInvoiceId] = useState<string | null>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", search, statusFilter, dateFilter, filterStartDate, filterEndDate],
    queryFn: async (): Promise<any> => {
      let q = supabase.from("invoices")
        .select("*, customers(full_name, phone), service_orders(order_number, total_amount, service_order_vehicles(vehicles(make, model)))")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter as InvoiceStatus);
      if (search) q = q.ilike("invoice_number", `%${search}%`);
      if (filterStartDate) {
        q = q.gte("created_at", filterStartDate);
      }
      if (filterEndDate) {
        q = q.lte("created_at", filterEndDate + "T23:59:59.999Z");
      } else if (!filterStartDate) {
        if (dateFilter === "week") {
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          q = q.gte("created_at", weekAgo);
        } else if (dateFilter === "month") {
          const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          q = q.gte("created_at", monthAgo);
        }
      }
      const { data } = await q;
      return data ?? [];
    },
  });

  const { register, control, handleSubmit, reset, setValue, formState: { errors } } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { payment_date: new Date().toISOString().split("T")[0] },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InvoiceStatus }) => {
      const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Invoice updated"); qc.invalidateQueries({ queryKey: ["invoices"] }); },
    onError: (e) => toast.error(e.message),
  });

  const payMutation = useMutation({
    mutationFn: async (data: PaymentForm) => {
      if (!payInvoiceId) return;
      
      // 1. Update the invoice to 'paid'
      const { data: updatedInvoice, error } = await supabase
        .from("invoices")
        .update({ ...data, status: "paid" })
        .eq("id", payInvoiceId)
        .select()
        .single();
        
      if (error) throw error;
      
      // 2. Also mark the associated service order as 'completed'
      if (updatedInvoice?.service_order_id) {
        const { error: soError } = await supabase
          .from("service_orders")
          .update({ status: "completed" })
          .eq("id", updatedInvoice.service_order_id);
          
        if (soError) throw soError;
      }
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setPayDialogOpen(false);
      reset();
      navigate("/receipts");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice deleted");
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const statusIcon = (status: string) => {
    if (status === "paid") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    if (status === "overdue") return <AlertCircle className="h-4 w-4 text-red-400" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-sm text-muted-foreground mt-1">{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search invoice #..." className="pl-9 w-56" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex items-center gap-1">
            <Input type="date" value={filterStartDate} onChange={(e) => { setFilterStartDate(e.target.value); setPage(1); }} className="h-[34px] text-xs w-[130px]" title="Start Date" />
            <span className="text-muted-foreground">-</span>
            <Input type="date" value={filterEndDate} onChange={(e) => { setFilterEndDate(e.target.value); setPage(1); }} className="h-[34px] text-xs w-[130px]" title="End Date" />
          </div>
          <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px] h-[34px] text-xs">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="week">Past Week</SelectItem>
              <SelectItem value="month">Past 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2 flex-wrap">
            {["all", ...STATUS_OPTIONS].map((s: any) => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {s === "all" ? "All" : getStatusLabel(s)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-lg shimmer" />)}</div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No invoices found</p>
          <p className="text-sm mt-1">Invoices are generated from service orders</p>
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Invoice #", "Type", "Customer", "Vehicle", "Order #", "Issued", "Due", "Status", "Amount", ""].map((h: any) => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((inv: any) => {
                  const customer = inv.customers as { full_name: string } | null;
                  const serviceOrder = inv.service_orders as any;
                  const amount = inv.total_amount ?? serviceOrder?.total_amount ?? 0;
                  const vehiclesList = serviceOrder?.service_order_vehicles?.map((sov: any) => sov.vehicles).filter(Boolean) || [];
                  const vehicleName = vehiclesList.length > 0 ? `${vehiclesList[0].make} ${vehiclesList[0].model}` : "—";
                  
                  // Identify duplicates and their order
                  const relatedInvoices = invoices
                    .filter((i: any) => i.service_order_id === inv.service_order_id && i.invoice_type === inv.invoice_type)
                    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                  
                  const duplicateIndex = relatedInvoices.findIndex((i: any) => i.id === inv.id);
                  const isDuplicate = duplicateIndex > 0;
                  const originalInvoice = isDuplicate ? relatedInvoices[0] : null;
                  
                  return (
                    <tr key={inv.id} className={`transition-colors ${isDuplicate ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-muted/30'}`}>
                      <td className="px-5 py-3.5 text-sm font-mono font-medium">
                        <div className="flex items-center gap-2">
                          <span className="text-primary">{inv.invoice_number}</span>
                          {isDuplicate && (
                            <Badge 
                              variant="outline" 
                              className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[9px] px-1.5 py-0 cursor-help"
                              title={`Duplicate of ${originalInvoice?.invoice_number}`}
                            >
                              Duplicate {duplicateIndex}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm">
                        <Badge variant="outline" className={inv.invoice_type === 'parking' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20 capitalize' : 'bg-primary/5 text-primary border-primary/20 capitalize'}>
                          {inv.invoice_type || 'Service'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-sm">{customer?.full_name ?? "—"}</td>
                      <td className="px-5 py-3.5 text-sm truncate max-w-[150px]">{vehicleName}</td>
                      <td className="px-5 py-3.5 text-sm font-mono text-muted-foreground">{serviceOrder?.order_number ?? "—"}</td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground whitespace-nowrap">{formatDateTime(inv.created_at)}</td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">{formatDate(inv.due_date)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {statusIcon(inv.status)}
                          <Badge variant={inv.status as "draft" | "sent" | "paid" | "overdue"}>{getStatusLabel(inv.status)}</Badge>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-semibold">{formatCurrency(amount)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setPreviewInvoiceId(inv.id)}>
                            <FileText className="h-3.5 w-3.5 mr-1" /> View & Print
                          </Button>
                          {inv.status !== "paid" && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: inv.id, status: "sent" })} disabled={inv.status === "sent"}>
                                Mark Sent
                              </Button>
                              <Button size="sm" onClick={() => { setPayInvoiceId(inv.id); reset({ payment_date: new Date().toISOString().split("T")[0] }); setPayDialogOpen(true); }}>
                                <CreditCard className="h-3.5 w-3.5" /> Pay
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive p-0 h-8 w-8 ml-1" onClick={() => { if(confirm("Are you sure you want to delete this invoice?")) deleteMutation.mutate(inv.id); }}>
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
            <Pagination page={page} totalPages={Math.ceil(invoices.length / PAGE_SIZE)} totalItems={invoices.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </Card>
      )}

      {/* Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => payMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount_paid">Amount Paid (₦)</Label>
              <Controller control={control} name="amount_paid" render={({ field }) => <CurrencyInput id="amount_paid" {...field} />} />
              {errors.amount_paid && <p className="text-xs text-destructive">{errors.amount_paid.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select onValueChange={(v) => setValue("payment_method", v)}>
                <SelectTrigger><SelectValue placeholder="Select method..." /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map((m: any) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
              {errors.payment_method && <p className="text-xs text-destructive">{errors.payment_method.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment Date</Label>
              <Input id="payment_date" type="date" {...register("payment_date")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={payMutation.isPending}>{payMutation.isPending ? "Saving..." : "Record Payment"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview & Print Dialog */}
      <Dialog open={!!previewInvoiceId} onOpenChange={(open) => !open && setPreviewInvoiceId(null)}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col">
          {previewInvoiceId && <InvoiceDocument invoiceId={previewInvoiceId} onClose={() => setPreviewInvoiceId(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
