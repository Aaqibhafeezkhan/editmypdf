import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SIGNATURE_STYLES, imageFileToPng, renderSignature, type SignatureStyle } from "./signatures.ts";

const GROUPS = ["English", "Hindi"] as const;

export function SignaturePanel({
  onPlace,
}: {
  onPlace: (src: string, width: number, height: number) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const trimmed = name.trim();
  const hindi = /[\u0900-\u097F]/.test(trimmed);

  const placeStyle = async (style: SignatureStyle) => {
    if (!trimmed || busy) return;
    setBusy(style.id);
    setError(null);
    try {
      const image = await renderSignature(trimmed, style.fontFamily);
      onPlace(image.url, image.width, image.height);
    } catch {
      setError("Could not draw that signature");
    } finally {
      setBusy(null);
    }
  };

  const placeFile = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy("upload");
    setError(null);
    try {
      const image = await imageFileToPng(file);
      onPlace(image.url, image.width, image.height);
    } catch {
      setError("Use a PNG, JPEG, or WebP image");
    } finally {
      setBusy(null);
    }
  };

  return (
    <aside className="tool-dock" aria-label="Signature options">
      <div className="px-4 pt-3.5 pb-3">
        <h2 className="text-sm font-semibold tracking-tight">Signature</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Type a name in Hindi or English, then choose a style</p>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          aria-label="Signature name"
          className="mt-3 h-8"
        />
        <Button
          type="button"
          variant="outline"
          className="mt-2 w-full"
          disabled={busy !== null}
          onClick={() => fileRef.current?.click()}
        >
          {busy === "upload" ? "Reading image…" : "Upload signature image"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void placeFile(file);
          }}
        />
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-5 px-3 pt-1 pb-4">
          {GROUPS.map((group) => (
            <div key={group} className="grid gap-2">
              <p className="px-1 text-xs font-medium text-muted-foreground">{group}</p>
              <div className="grid gap-1.5">
                {SIGNATURE_STYLES.filter((style) => style.group === group).map((style) => (
                  <Button
                    key={style.id}
                    type="button"
                    variant="ghost"
                    className="h-auto w-full flex-col items-start gap-0.5 px-3 py-2"
                    disabled={!trimmed || busy !== null || (hindi && style.group === "English")}
                    aria-label={`${style.label} signature`}
                    onClick={() => void placeStyle(style)}
                  >
                    <span
                      className="max-w-full truncate text-[1.65rem] leading-none text-foreground"
                      style={{ fontFamily: `"${style.fontFamily}", cursive` }}
                    >
                      {hindi && style.group === "English" ? style.sample : trimmed || style.sample}
                    </span>
                    <span className="text-[11px] font-normal text-muted-foreground">{style.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
