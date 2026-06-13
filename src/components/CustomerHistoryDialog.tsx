import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { isSameWeek, isSameMonth, subMonths } from "date-fns";
import { Loader2, FileText, User } from "lucide-react";
import BatchInvoiceDocument from "./BatchInvoiceDocument";

export default function CustomerHistoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [batchInvoiceIds, setBatchInvoiceIds] = useState<string[] | null>(null);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list-history"],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, full_name").order("full_name");
      return data || [];
    }
  });

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["customer-history", selectedCustomerId],
    queryFn: async () => {
      if (selectedCustomerId === "all" || !selectedCustomerId) return [];
      const { data } = await supabase
        .from("service_orders")
        .select("*, invoices(*), vehicles(make, model, plate_number)")
        .eq("customer_id", selectedCustomerId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: selectedCustomerId !== "all" && !!selectedCustomerId
  });

  const filteredHistory = useMemo(() => {
    const now = new Date();
    if (timeFilter === "all") return history;
    return history.filter((o: any) => {
      const d = new Date(o.intake_date || o.created_at);
      if (timeFilter === "this_week") return isSameWeek(d, now);
      if (timeFilter === "this_month") return isSameMonth(d, now);
      if (timeFilter === "last_month") return isSameMonth(d, subMonths(now, 1));
      return true;
    });
  }, [history, timeFilter]);

  const handleGenerateInvoices = () => {
    // Collect all invoice IDs from the filtered history
    const ids: string[] = [];
    filteredHistory.forEach((order: any) => {
      if (order.invoices && order.invoices.length > 0) {
        order.invoices.forEach((inv: any) => ids.push(inv.id));
      }
    });
    setBatchInvoiceIds(ids);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Customer History & Invoices</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/30 rounded-lg border border-border">
            <div className="space-y-2 flex-1">
              <Label>Select Customer</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a customer..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">-- Select Customer --</SelectItem>
                  {customers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:w-[200px]">
              <Label>Time Period</Label>
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto mt-4 border rounded-md">
            {isLoading ? (
              <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" /></div>
            ) : selectedCustomerId === "all" ? (
              <div className="flex flex-col items-center justify-center h-full p-12 text-muted-foreground text-center">
                <User className="h-12 w-12 mb-4 opacity-20" />
                <p>Select a customer to view their service history.</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">No service orders found for this period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-xs">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-xs">Order #</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-xs">Vehicle</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-xs">Status</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">Total</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground uppercase tracking-wider text-xs">Invoices</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredHistory.map((order: any) => (
                      <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(order.intake_date)}</td>
                        <td className="px-4 py-3 font-mono text-primary">{order.order_number}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{order.vehicles ? `${order.vehicles.make} ${order.vehicles.model}` : '—'}</td>
                        <td className="px-4 py-3 capitalize"><span className="bg-muted px-2 py-1 rounded-md text-xs">{order.status.replace('_', ' ')}</span></td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(order.total_amount)}</td>
                        <td className="px-4 py-3 text-center">
                          {order.invoices && order.invoices.length > 0 ? (
                            <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 font-bold rounded-full">{order.invoices.length}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <Button 
              disabled={selectedCustomerId === "all" || filteredHistory.length === 0} 
              onClick={handleGenerateInvoices}
            >
              <FileText className="h-4 w-4 mr-2" /> Generate All Invoices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!batchInvoiceIds} onOpenChange={(open) => !open && setBatchInvoiceIds(null)}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col">
          {batchInvoiceIds && batchInvoiceIds.length > 0 ? (
            <BatchInvoiceDocument invoiceIds={batchInvoiceIds} onClose={() => setBatchInvoiceIds(null)} />
          ) : (
            <div className="flex flex-col items-center justify-center p-12 h-full text-center">
              <FileText className="h-12 w-12 mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-medium">No Invoices Found</h3>
              <p className="text-muted-foreground">None of the selected service orders have generated invoices yet.</p>
              <Button className="mt-6" variant="outline" onClick={() => setBatchInvoiceIds(null)}>Go Back</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
