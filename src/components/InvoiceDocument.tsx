import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Printer, Image as ImageIcon, Loader2 } from "lucide-react";
// @ts-ignore
import html2canvas from "html2canvas";

// ─── Amount to Words ──────────────────────────────────────────────────────────
const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function numToWords(n: number): string {
  if (n === 0) return "Zero";
  if (n < 0) return "Minus " + numToWords(-n);
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + numToWords(n % 100) : "");
  if (n < 1_000_000) return numToWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + numToWords(n % 1000) : "");
  if (n < 1_000_000_000) return numToWords(Math.floor(n / 1_000_000)) + " Million" + (n % 1_000_000 ? " " + numToWords(n % 1_000_000) : "");
  return numToWords(Math.floor(n / 1_000_000_000)) + " Billion" + (n % 1_000_000_000 ? " " + numToWords(n % 1_000_000_000) : "");
}

function amountInWords(amount: number): string {
  const naira = Math.floor(amount);
  const kobo = Math.round((amount - naira) * 100);
  let result = numToWords(naira) + " Naira";
  if (kobo > 0) result += " and " + numToWords(kobo) + " Kobo";
  return result + " Only";
}
// ─────────────────────────────────────────────────────────────────────────────

export default function InvoiceDocument({ invoiceId, onClose, hideHeader }: { invoiceId: string; onClose?: () => void; hideHeader?: boolean }) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice-detail", invoiceId],
    queryFn: async (): Promise<any> => {
      const { data: inv, error: invErr } = await supabase
        .from("invoices")
        .select("*, customers(*), service_orders(*, vehicles(*), service_order_items(*, ppf_products(*)))")
        .eq("id", invoiceId)
        .single();
      if (invErr) throw invErr;
      return inv;
    },
  });

  // ── Print: same-window visibility trick so all Vite styles are available ──
  const handlePrint = () => {
    document.body.classList.add('is-printing-invoice');
    window.print();
    // Remove class after a short delay to cover the print dialog closing
    setTimeout(() => {
      document.body.classList.remove('is-printing-invoice');
    }, 1500);
  };

  // ── Download PNG ──────────────────────────────────────────────────────────
  const handleDownloadPng = async () => {
    if (!invoiceRef.current) return;
    try {
      setDownloading(true);
      const canvas = await html2canvas(invoiceRef.current, { scale: 2, useCORS: true });
      const link = document.createElement("a");
      link.download = `Invoice-${invoice?.invoice_number}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Failed to generate PNG", error);
      alert("Failed to download PNG. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" /></div>;
  if (!invoice) return <div>Invoice not found</div>;

  const customer = invoice.customers as any;
  const order = invoice.service_orders as any;
  const vehicle = order?.vehicles as any;
  const items = order?.service_order_items || [];

  const isParking = invoice.invoice_type === "parking";
  const displayAmount = invoice.total_amount ?? order?.total_amount ?? 0;
  const balanceDue = Math.max(0, displayAmount - (invoice.amount_paid || 0));

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar — hidden on print */}
      {!hideHeader && (
        <div className="no-print flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 pr-12 border-b border-border bg-muted/30 sticky top-0 z-10 gap-4">
          <div>
            <h2 className="text-lg font-semibold">Invoice Preview</h2>
            <p className="text-sm text-muted-foreground">Print to PDF or Download as PNG</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={handleDownloadPng} disabled={downloading} className="flex-1 sm:flex-none whitespace-nowrap">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ImageIcon className="h-4 w-4 mr-2" />}
              Save PNG
            </Button>
            <Button onClick={handlePrint} className="flex-1 sm:flex-none whitespace-nowrap">
              <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
            </Button>
          </div>
        </div>
      )}

      {/* Scrollable preview wrapper */}
      <div className="print-scroll-wrapper overflow-y-auto p-4 md:p-6 flex-1 bg-muted/10">
        {/* ─── The actual invoice document ─── */}
        <div
          ref={invoiceRef}
          className="print-invoice relative overflow-hidden max-w-[780px] mx-auto bg-card text-card-foreground p-7 md:p-9 shadow-sm border border-border rounded-xl"
        >
          {/* Watermark */}
          <div
            className="absolute inset-0 pointer-events-none z-0 opacity-[0.03]"
            style={{ backgroundImage: "url(/logo.jpeg)", backgroundPosition: "center", backgroundSize: "60%", backgroundRepeat: "no-repeat" }}
          />

          <div className="relative z-10 space-y-4">

            {/* ── HEADER ── */}
            <div className="flex justify-between items-start pb-4 border-b-2 border-primary/10">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg overflow-hidden shadow-sm shrink-0 bg-white border border-border">
                  <img src="/logo.jpeg" alt="PPF Abuja Cars Logo" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="font-black text-base text-foreground uppercase tracking-wide">PPF Abuja Cars</h3>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">Plot 5 Bala Kona Street, off Ahmadu Bello</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">Expressway, Kado, FCT Abuja</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">+234 808 535 9774</p>
                </div>
              </div>
              <div className="text-right">
                <h1 className="text-3xl font-black text-primary tracking-tight uppercase">Invoice</h1>
                <p className="text-sm text-muted-foreground font-mono mt-1">#{invoice.invoice_number}</p>
                {isParking && (
                  <span className="inline-block mt-2 px-2.5 py-0.5 bg-blue-500/10 text-blue-600 text-[10px] font-bold tracking-wider rounded border border-blue-500/20 uppercase">
                    Parking Invoice
                  </span>
                )}
              </div>
            </div>

            {/* ── BILLED TO + DATES + VEHICLE ── */}
            <div className="grid grid-cols-2 gap-6 py-3 border-b border-border/50">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Billed To</p>
                <p className="font-semibold text-base">{customer?.full_name}</p>
                {customer?.phone && <p className="text-xs text-muted-foreground">{customer.phone}</p>}
                {customer?.email && <p className="text-xs text-muted-foreground">{customer.email}</p>}
                {customer?.address && <p className="text-xs text-muted-foreground mt-0.5">{customer.address}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Date Issued</p>
                  <p className="font-medium text-xs">{formatDate(invoice.issued_date)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Due Date</p>
                  <p className="font-medium text-xs">{invoice.due_date ? formatDate(invoice.due_date) : "Upon receipt"}</p>
                </div>
                {vehicle && (
                  <div className="col-span-2 mt-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Vehicle</p>
                    <p className="font-medium text-xs">{vehicle.make} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ""}</p>
                    <p className="text-xs text-muted-foreground">Plate: {vehicle.plate_number || "N/A"}{vehicle.color ? ` · ${vehicle.color}` : ""}</p>
                    <p className="text-xs text-muted-foreground">Chassis: {vehicle.vin || "N/A"}</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── ITEMS TABLE ── */}
            <div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-border/80">
                    <th className="text-left py-2 font-semibold text-muted-foreground">Description</th>
                    <th className="text-right py-2 font-semibold text-muted-foreground">Qty</th>
                    <th className="text-right py-2 font-semibold text-muted-foreground">Rate</th>
                    <th className="text-right py-2 font-semibold text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {isParking ? (
                    <tr>
                      <td className="py-2.5">
                        <p className="font-semibold text-foreground">Parking Service</p>
                        {invoice.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{invoice.notes}</p>}
                      </td>
                      <td className="py-2.5 text-right">1</td>
                      <td className="py-2.5 text-right">{formatCurrency(displayAmount)}</td>
                      <td className="py-2.5 text-right font-medium">{formatCurrency(displayAmount)}</td>
                    </tr>
                  ) : items.length > 0 ? (
                    items.map((item: any) => (
                      <tr key={item.id}>
                        <td className="py-2.5">
                          <p className="font-semibold text-foreground">{item.area_description}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.ppf_products?.brand} {item.ppf_products?.name}</p>
                        </td>
                        <td className="py-2.5 text-right">{item.quantity_used}</td>
                        <td className="py-2.5 text-right">{formatCurrency(item.unit_price)}</td>
                        <td className="py-2.5 text-right font-medium">{formatCurrency(item.line_total)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted-foreground">No line items</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── TOTALS + AMOUNT IN WORDS ── */}
            <div className="flex gap-6 justify-between items-start border-t border-border/80 pt-3">
              {/* Amount in words */}
              <div className="flex-1 self-end">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Amount in Words</p>
                <p className="text-xs font-semibold text-foreground italic leading-snug">
                  {amountInWords(displayAmount)}
                </p>
              </div>
              {/* Numeric totals */}
              <div className="w-56 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(!isParking && order ? order.subtotal : displayAmount)}</span>
                </div>
                {!isParking && order && (
                  <>
                    {order.service_charge > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Service Charge</span>
                        <span>{formatCurrency(order.service_charge)}</span>
                      </div>
                    )}
                    {order.discount > 0 && (
                      <div className="flex justify-between text-xs text-emerald-500">
                        <span>Discount</span>
                        <span>-{formatCurrency(order.discount)}</span>
                      </div>
                    )}
                    {order.tax > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">VAT / Tax</span>
                        <span>{formatCurrency(order.tax)}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-border/80">
                  <span>Total</span>
                  <span>{formatCurrency(displayAmount)}</span>
                </div>
                <div className="flex justify-between text-xs text-emerald-500 pb-1.5 border-b border-border/80">
                  <span>Amount Paid</span>
                  <span>{formatCurrency(invoice.amount_paid || 0)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-primary pt-0.5">
                  <span>Balance Due</span>
                  <span>{formatCurrency(balanceDue)}</span>
                </div>
              </div>
            </div>

            {/* ── FOOTER ── */}
            <div className="pt-3 border-t border-border/50 space-y-3">
              {/* Payment Details */}
              <div className="p-3.5 rounded-lg bg-primary/5 border border-primary/15">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2 text-center">Payment Details</p>
                <p className="text-[10px] text-muted-foreground text-center mb-2.5">Kindly make payment to the account details below:</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Bank</p>
                    <p className="text-xs font-semibold text-foreground">Providus Bank</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Account Number</p>
                    <p className="text-xs font-bold font-mono text-primary tracking-wider">1309339336</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Account Name</p>
                    <p className="text-xs font-semibold text-foreground">ABUJACAR PROP & AUTOMOBILE LTD</p>
                  </div>
                </div>
              </div>

              {/* Address + Thank you */}
              <div className="text-center text-[10px] text-muted-foreground">
                <p className="font-semibold text-foreground mb-0.5">Thank you for your business!</p>
                <p>Plot 5 Bala Kona Street, off Ahmadu Bello Expressway, Kado FCT Abuja &nbsp;·&nbsp; +234 808 535 9774</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
