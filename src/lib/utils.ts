import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `PPF-${year}${month}-${random}`;
}

export function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${year}${month}-${random}`;
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: "badge-pending",
    in_progress: "badge-in-progress",
    completed: "badge-completed",
    delivered: "badge-delivered",
    cancelled: "badge-cancelled",
    draft: "badge-draft",
    sent: "badge-in-progress",
    paid: "badge-paid",
    overdue: "badge-overdue",
  };
  return map[status] ?? "badge-draft";
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "Pending",
    in_progress: "In Progress",
    completed: "Completed",
    delivered: "Delivered",
    cancelled: "Cancelled",
    draft: "Draft",
    sent: "Sent",
    paid: "Paid",
    overdue: "Overdue",
  };
  return map[status] ?? status;
}
