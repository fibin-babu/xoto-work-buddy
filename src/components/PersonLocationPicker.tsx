import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Search, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { mapsSearchAvailable, resolveMapsLink, searchWorkPlaces } from "@/lib/maps.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LocationMap } from "./LocationMap";

type Place = { id: string; name: string; address: string; lat: number; lng: number };
export function PersonLocationPicker({ label, onSelect }: { label: string; onSelect: (id: string) => Promise<void> }) {
  const search = useServerFn(searchWorkPlaces);
  const resolveLink = useServerFn(resolveMapsLink);
  const checkSearch = useServerFn(mapsSearchAvailable);
  const [open, setOpen] = useState(false);
  const [canSearch, setCanSearch] = useState(false);
  const [link, setLink] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place | null>(null);
  const [name, setName] = useState("");
  const [radius, setRadius] = useState("200");
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  useEffect(() => {
    if (!open) return;
    checkSearch().then((r) => setCanSearch(r.available)).catch(() => setCanSearch(false));
  }, [open, checkSearch]);
  function choose(place: Place) {
    setSelected(place);
    setName(place.name);
  }
  async function fromLink() {
    if (busy || link.trim().length < 3) return;
    setBusy(true);
    try {
      const place = await resolveLink({ data: { link } });
      const coords = `${place.lat.toFixed(6)}, ${place.lng.toFixed(6)}`;
      setResults([]);
      setSearched(false);
      choose({ id: `link:${coords}`, name: place.name ?? "", address: coords, lat: place.lat, lng: place.lng });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Couldn't read that link"); }
    finally { setBusy(false); }
  }
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
    const label = name.trim();
    if (!label) { toast.error("Give this location a name"); return; }
    if (!Number.isInteger(range) || range < 20 || range > 5000) { toast.error("Enter a range between 20 and 5000 metres"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.from("work_locations").insert({ name: label.slice(0, 100), lat: selected.lat, lng: selected.lng, radius_m: range }).select("id").single();
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
        <DialogHeader><DialogTitle>{label}</DialogTitle><DialogDescription>Paste a Google Maps link to the work location. In Google Maps, open the place (or drop a pin), tap Share and copy the link.</DialogDescription></DialogHeader>
        <div className="flex gap-2"><Input aria-label="Google Maps link" placeholder="https://maps.app.goo.gl/… or 25.2048, 55.2708" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void fromLink(); } }} /><Button type="button" size="icon" aria-label="Use this link" disabled={busy || link.trim().length < 3} onClick={fromLink}>{busy ? <Loader2 className="animate-spin" /> : <Link2 />}</Button></div>
        {canSearch && <>
          <p className="text-xs text-muted-foreground">Or search by name</p>
          <div className="flex gap-2"><Input aria-label="Search Google Maps" placeholder="Address, building or city" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void find(); } }} /><Button type="button" size="icon" aria-label="Search locations" disabled={busy || query.trim().length < 3} onClick={find}>{busy ? <Loader2 className="animate-spin" /> : <Search />}</Button></div>
          {searched && !results.length && <p className="text-sm text-muted-foreground">No locations found.</p>}
          <div className="space-y-1">{results.map((p) => <Button key={p.id} type="button" variant={selected?.id === p.id ? "secondary" : "ghost"} className="h-auto w-full justify-start whitespace-normal py-3 text-left" onClick={() => choose(p)}><MapPin className="shrink-0" /><span><span className="block">{p.name}</span><span className="block text-xs font-normal text-muted-foreground">{p.address}</span></span></Button>)}</div>
        </>}
        {selected && <>
          <LocationMap lat={selected.lat} lng={selected.lng} title={name || selected.address} />
          <p className="text-xs text-muted-foreground">{selected.address || `${selected.lat.toFixed(6)}, ${selected.lng.toFixed(6)}`}</p>
          <label className="space-y-1 text-sm">Location name<Input value={name} maxLength={100} placeholder="e.g. Xoto HQ, Business Bay" onChange={(e) => setName(e.target.value)} /></label>
          <label className="space-y-1 text-sm">Allowed range (metres)<Input type="number" min={20} max={5000} value={radius} onChange={(e) => setRadius(e.target.value)} /></label>
          <Button type="button" disabled={busy} onClick={save}><MapPin /> {busy ? "Saving…" : "Assign location"}</Button>
        </>}
      </DialogContent>
    </Dialog>
  </>;
}
