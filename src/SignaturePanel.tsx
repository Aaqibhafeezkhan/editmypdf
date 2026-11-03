import { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PanelClose, PanelHead, PanelSection } from "./PanelChrome.tsx";
import {
  forgetSignature,
  readSavedSignatures,
  rememberSignature,
  type SavedSignature,
  type TypedSignature,
} from "./savedSignatures.ts";
import { SIGNATURE_STYLES, imageFileToPng, renderSignature, type SignatureStyle } from "./signatures.ts";

const GROUPS = ["English", "Hindi"] as const;

// How a saved tile is named for assistive technology: a typed signature by its name and style, an
// uploaded image by its place in the list.
function describe(item: SavedSignature, index: number): string {
  if (item.text === undefined || item.font === undefined) return `saved signature ${index + 1}`;
  const style = SIGNATURE_STYLES.find((candidate) => candidate.fontFamily === item.font);
  return `saved signature "${item.text}" in ${style?.label ?? item.font}`;
}

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
  // Signatures placed before, typed or uploaded, kept in this browser so the same one can go on
  // any document.
  const [saved, setSaved] = useState<SavedSignature[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void readSavedSignatures().then((list) => {
      if (!cancelled) setSaved(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const trimmed = name.trim();
  const hindi = /[ऀ-ॿ]/.test(trimmed);

  // Places a signature that was just made and keeps it for next time. When the browser refuses
  // the write (private browsing, full storage) the signature is still placed, just not remembered.
  const placeAndKeep = async (image: { url: string; width: number; height: number }, typed?: TypedSignature) => {
    onPlace(image.url, image.width, image.height);
    try {
      setSaved(await rememberSignature(image, typed));
    } catch {
      // Nothing to tell the user: the placement itself worked.
    }
  };

  const placeStyle = async (style: SignatureStyle) => {
    if (!trimmed || busy) return;
    setBusy(style.id);
    setError(null);
    try {
      const image = await renderSignature(trimmed, style.fontFamily);
      await placeAndKeep(image, { text: trimmed, font: style.fontFamily });
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
      await placeAndKeep(image);
    } catch {
      setError("Use a PNG, JPEG, or WebP image");
    } finally {
      setBusy(null);
    }
  };

  const forget = async (id: string) => {
    try {
      setSaved(await forgetSignature(id));
    } catch {
      // The list stays as it is when storage cannot be written.
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
          {saved.length > 0 && (
            <PanelSection title="Saved">
              <p className="saved-signature-note">
                Signatures you have placed stay here, in this browser, for any document.
              </p>
              <div className="saved-signature-list" role="list" aria-label="Saved signatures">
                {saved.map((item, index) => (
                  <div key={item.id} className="saved-signature" role="listitem">
                    <button
                      type="button"
                      className="saved-signature-place"
                      aria-label={`Place ${describe(item, index)}`}
                      disabled={busy !== null}
                      onClick={() => onPlace(item.src, item.width, item.height)}
                    >
                      <img src={item.src} alt="" draggable={false} />
                    </button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="saved-signature-forget"
                          aria-label={`Forget ${describe(item, index)}`}
                          onClick={() => void forget(item.id)}
                        >
                          <X />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={6}>
                        Forget this signature
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ))}
              </div>
            </PanelSection>
          )}
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
