import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Building2, Phone, MapPin, Mail, Lock, Car } from "lucide-react";
import { CurrencyInput } from "@/components/ui/currency-input";

export default function Settings() {
  const { user, signOut } = useAuth();
  const [businessName, setBusinessName] = useState("PPF Abuja Cars");
  const [businessPhone, setBusinessPhone] = useState("+234 800 0000 000");
  const [businessAddress, setBusinessAddress] = useState("Abuja, FCT, Nigeria");
  const [businessEmail, setBusinessEmail] = useState("info@ppfabujacars.com");
  const [taxRate, setTaxRate] = useState("0");
  const [insideParkingPrice, setInsideParkingPrice] = useState<number | undefined>(() => Number(localStorage.getItem("insideParkingPrice")) || undefined);
  const [outsideParkingPrice, setOutsideParkingPrice] = useState<number | undefined>(() => Number(localStorage.getItem("outsideParkingPrice")) || undefined);
  const [deletePhrase, setDeletePhrase] = useState(() => localStorage.getItem("deletePhrase") || "");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your business configuration</p>
      </div>

      {/* Business Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Business Information</CardTitle>
          </div>
          <CardDescription>These details appear on invoices and documents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="biz-name">Business Name</Label>
            <Input id="biz-name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="biz-phone">Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input id="biz-phone" className="pl-8" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input id="biz-email" className="pl-8" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="biz-address">Address</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input id="biz-address" className="pl-8" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} />
            </div>
          </div>
          <Button onClick={() => toast.success("Business info saved")}>Save Changes</Button>
        </CardContent>
      </Card>

      {/* Tax Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tax & Pricing</CardTitle>
          <CardDescription>Configure tax rates applied to invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tax-rate">VAT / Tax Rate (%)</Label>
            <div className="flex gap-3">
              <Input id="tax-rate" type="number" min="0" max="100" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="max-w-[120px]" />
              <Button onClick={() => toast.success(`Tax rate set to ${taxRate}%`)}>Apply</Button>
            </div>
            <p className="text-xs text-muted-foreground">Set to 0 to disable tax on invoices</p>
          </div>
        </CardContent>
      </Card>

      {/* Parking Pricing */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Parking Pricing</CardTitle>
          </div>
          <CardDescription>Set the default daily prices for parking locations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inside-price">Inside View Parking Price (₦)</Label>
              <CurrencyInput 
                id="inside-price" 
                value={insideParkingPrice} 
                onChange={(val) => { setInsideParkingPrice(val); localStorage.setItem("insideParkingPrice", String(val)); }} 
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="outside-price">Outside View Parking Price (₦)</Label>
              <CurrencyInput 
                id="outside-price" 
                value={outsideParkingPrice} 
                onChange={(val) => { setOutsideParkingPrice(val); localStorage.setItem("outsideParkingPrice", String(val)); }} 
                placeholder="0"
              />
            </div>
          </div>
          <Button onClick={() => toast.success("Parking prices saved")}>Save Prices</Button>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Security & Deletion</CardTitle>
          </div>
          <CardDescription>Require a specific phrase to delete any records</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delete-phrase">Global Delete Phrase</Label>
            <div className="flex gap-3">
              <Input 
                id="delete-phrase" 
                value={deletePhrase} 
                onChange={(e) => setDeletePhrase(e.target.value)} 
                placeholder="Leave blank to disable" 
              />
              <Button onClick={() => {
                localStorage.setItem("deletePhrase", deletePhrase.trim());
                toast.success(deletePhrase.trim() ? "Delete phrase enabled" : "Delete phrase disabled");
              }}>
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">If set, users must type this exact phrase to confirm deletion of any record (invoices, service orders, etc.).</p>
          </div>
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Account</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium">{user?.email}</p>
                <p className="text-xs text-muted-foreground">Administrator</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active
            </div>
          </div>
          <Button variant="destructive" onClick={signOut}>
            <Lock className="h-4 w-4" /> Sign Out
          </Button>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-lg overflow-hidden shrink-0 shadow-sm border border-border bg-white">
              <img src="/logo.jpeg" alt="PPF Abuja Cars Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="font-semibold text-sm">PPF Abuja Cars</p>
              <p className="text-xs text-muted-foreground">Service Management System v1.0</p>
              <p className="text-xs text-muted-foreground">Paint Protective Film · Inventory & Records</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
