import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ScrollText, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/utils";
import ReceiptDocument from "@/components/ReceiptDocument";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 15;

export default function Receipts() {
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ["receipts", search, dateFilter, filterStartDate, filterEndDate],
    queryFn: async (): Promise<any> => {
      let q = supabase.from("invoices")
        .select("*, customers(full_name, phone), service_orders(order_number, total_amount, service_order_vehicles(vehicles(make, model)))")
        .eq("status", "paid")
        .order("payment_date", { ascending: false }); // Sort by payment date

      if (search) q = q.ilike("invoice_number", `%${search}%`);
      if (filterStartDate) {
        q = q.gte("payment_date", filterStartDate);
      }
      if (filterEndDate) {
        q = q.lte("payment_date", filterEndDate + "T23:59:59.999Z");
      } else if (!filterStartDate) {
        if (dateFilter === "week") {
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          q = q.gte("payment_date", weekAgo);
        } else if (dateFilter === "month") {
          const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          q = q.gte("payment_date", monthAgo);
        }
      }
      const { data } = await q;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Receipts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {receipts.length} recorded payment{receipts.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search receipt #..." 
            className="pl-9 w-56" 
            value={search} 
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
          />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex items-center gap-1">
            <Input 
              type="date" 
              value={filterStartDate} 
              onChange={(e) => { setFilterStartDate(e.target.value); setPage(1); }} 
              className="h-[34px] text-xs w-[130px]" 
              title="Start Date" 
            />
            <span className="text-muted-foreground">-</span>
            <Input 
              type="date" 
              value={filterEndDate} 
              onChange={(e) => { setFilterEndDate(e.target.value); setPage(1); }} 
              className="h-[34px] text-xs w-[130px]" 
              title="End Date" 
            />
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
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-lg shimmer" />)}</div>
      ) : receipts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ScrollText className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No receipts found</p>
          <p className="text-sm mt-1">Recorded payments will appear here</p>
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Receipt #", "Customer", "Vehicle", "Order #", "Amount Paid", "Method", "Date Paid", ""].map((h: any) => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {receipts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((receipt: any) => {
                  const customer = receipt.customers as { full_name: string } | null;
                  const serviceOrder = receipt.service_orders as any;
                  const vehiclesList = serviceOrder?.service_order_vehicles?.map((sov: any) => sov.vehicles).filter(Boolean) || [];
                  const vehicleName = vehiclesList.length > 0 ? `${vehiclesList[0].make} ${vehiclesList[0].model}` : "—";
                  
                  return (
                    <tr key={receipt.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 text-sm font-mono font-medium text-primary">RCPT-{receipt.invoice_number}</td>
                      <td className="px-5 py-3.5 text-sm">{customer?.full_name ?? "—"}</td>
                      <td className="px-5 py-3.5 text-sm truncate max-w-[150px]">{vehicleName}</td>
                      <td className="px-5 py-3.5 text-sm font-mono text-muted-foreground">{serviceOrder?.order_number ?? "—"}</td>
                      <td className="px-5 py-3.5 text-sm font-bold text-emerald-600">{formatCurrency(receipt.amount_paid || 0)}</td>
                      <td className="px-5 py-3.5 text-sm">{receipt.payment_method || "—"}</td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(receipt.updated_at)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button size="sm" variant="secondary" onClick={() => setPreviewInvoiceId(receipt.id)}>
                          <FileText className="h-3.5 w-3.5 mr-1" /> View & Print
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 pb-4">
            <Pagination page={page} totalPages={Math.ceil(receipts.length / PAGE_SIZE)} totalItems={receipts.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </Card>
      )}

      {/* Preview & Print Dialog */}
      <Dialog open={!!previewInvoiceId} onOpenChange={(open) => !open && setPreviewInvoiceId(null)}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col">
          {previewInvoiceId && <ReceiptDocument invoiceId={previewInvoiceId} onClose={() => setPreviewInvoiceId(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
