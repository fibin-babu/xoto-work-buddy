import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { searchWorkPlaces } from "@/lib/maps.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LocationMap } from "./LocationMap";

type Place = { id: string; name: string; address: string; lat: number; lng: number };
export function PersonLocationPicker({ label, onSelect }: { label: string; onSelect: (id: string) => Promise<void> }) {
  const search = useServerFn(searchWorkPlaces);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place | null>(null);
  const [radius, setRadius] = useState("200");
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  async function find() {
    if (busy || query.trim().length < 3) return;
    setBusy(true);
    try { setResults(await search({ data: { query } })); setSearched(true); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Couldn't search locations"); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!selected || busy) return;
    const range = Number(radius);
    if (!Number.isInteger(range) || range < 20 || range > 5000) { toast.error("Enter a range between 20 and 5000 metres"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.from("work_locations").insert({ name: selected.name.slice(0, 100), lat: selected.lat, lng: selected.lng, radius_m: range }).select("id").single();
      if (error || !data) throw error ?? new Error("Couldn't save location");
      await onSelect(data.id);
      setOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Couldn't assign location"); }
    finally { setBusy(false); }
  }
  return <>
    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} aria-label={label}><MapPin /> Google Maps</Button>
    <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{label}</DialogTitle><DialogDescription>Choose this person's work location.</DialogDescription></DialogHeader>
        <div className="flex gap-2"><Input aria-label="Search Google Maps" placeholder="Address, building or city" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void find(); } }} /><Button type="button" size="icon" aria-label="Search locations" disabled={busy || query.trim().length < 3} onClick={find}>{busy ? <Loader2 className="animate-spin" /> : <Search />}</Button></div>
        {searched && !results.length && <p className="text-sm text-muted-foreground">No locations found.</p>}
        <div className="space-y-1">{results.map((p) => <Button key={p.id} type="button" variant={selected?.id === p.id ? "secondary" : "ghost"} className="h-auto w-full justify-start whitespace-normal py-3 text-left" onClick={() => setSelected(p)}><MapPin className="shrink-0" /><span><span className="block">{p.name}</span><span className="block text-xs font-normal text-muted-foreground">{p.address}</span></span></Button>)}</div>
        {selected && <><LocationMap lat={selected.lat} lng={selected.lng} title={selected.name} /><label className="space-y-1 text-sm">Allowed range (metres)<Input type="number" min={20} max={5000} value={radius} onChange={(e) => setRadius(e.target.value)} /></label><Button type="button" disabled={busy} onClick={save}><MapPin /> {busy ? "Saving…" : "Assign location"}</Button></>}
        <p className="text-xs text-muted-foreground">Google Maps</p>
      </DialogContent>
    </Dialog>
  </>;
}