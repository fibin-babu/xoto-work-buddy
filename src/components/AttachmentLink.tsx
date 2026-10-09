import { Paperclip } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function AttachmentLink({ path, name }: { path: string | null; name: string | null }) {
  if (!path) return null;
  async function open() {
    const { data, error } = await supabase.storage.from("task-files").createSignedUrl(path!, 300);
    if (error || !data) { toast.error(error?.message ?? "Could not open file"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); open(); }}
      className="flex max-w-40 items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-primary hover:underline">
      <Paperclip className="h-3 w-3 shrink-0" />
      <span className="truncate">{name ?? "File"}</span>
    </button>
  );
}
