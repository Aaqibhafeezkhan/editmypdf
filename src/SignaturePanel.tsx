import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PanelClose, PanelHead, PanelSection } from "./PanelChrome.tsx";
import { SIGNATURE_STYLES, imageFileToPng, renderSignature, type SignatureStyle } from "./signatures.ts";

const GROUPS = ["English", "Hindi"] as const;

export function SignaturePanel({
  onPlace,
  onClose,
}: {
  onPlace: (src: string, width: number, height: number) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const trimmed = name.trim();
  const hindi = /[ऀ-ॿ]/.test(trimmed);

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
      <PanelHead title="Signature" detail="Type a name and pick a style, or upload an image">
        <PanelClose label="Close options" onClick={onClose} />
      </PanelHead>
      <div className="dock-form">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          aria-label="Signature name"
          className="dock-field"
        />
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={busy !== null}
          onClick={() => fileRef.current?.click()}
        >
          <Upload />
          {busy === "upload" ? "Reading image…" : "Upload an image"}
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
        {error && (
          <p className="dock-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <ScrollArea className="panel-scroll">
        <div className="panel-body">
          {GROUPS.map((group) => (
            <PanelSection key={group} title={group}>
              <div className="signature-list">
                {SIGNATURE_STYLES.filter((style) => style.group === group).map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    className="signature-row"
                    disabled={!trimmed || busy !== null || (hindi && style.group === "English")}
                    aria-label={`${style.label} signature`}
                    onClick={() => void placeStyle(style)}
                  >
                    <span className="signature-sample" style={{ fontFamily: `"${style.fontFamily}", cursive` }}>
                      {hindi && style.group === "English" ? style.sample : trimmed || style.sample}
                    </span>
                    <span className="signature-name">{style.label}</span>
                  </button>
                ))}
              </div>
            </PanelSection>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
