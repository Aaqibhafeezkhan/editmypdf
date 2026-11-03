import { useState, type MouseEvent, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ArrowRight, X } from "lucide-react";
import { Link } from "react-router";
import { PRODUCT, ROUTES, publicUrl, routeHref } from "../data/product.ts";
import "./intro-video.css";

const VIDEO_URL = publicUrl("video/intro.mp4");
const POSTER_URL = publicUrl("video/intro.jpg");

// The "How it works" buttons on the landing page: a plain link to the walkthrough for crawlers
// and visitors without JavaScript, and with it a modal that plays the introduction video. The
// video is fetched only when the dialog opens, so the landing page stays light.
export function IntroVideoButton({ className, children }: { className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    setOpen(true);
  };
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <a href={routeHref(ROUTES.howItWorks)} className={className} onClick={onClick}>
          {children}
        </a>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="intro-overlay" />
        <DialogPrimitive.Content className="intro-dialog" aria-describedby={undefined}>
          <div className="intro-head">
            <DialogPrimitive.Title className="intro-title">How {PRODUCT.name} works</DialogPrimitive.Title>
            <DialogPrimitive.Close className="intro-close" aria-label="Close">
              <X aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>
          <div className="intro-player">
            {/* The element mounts only while the dialog is open, so autoplay starts with the click. */}
            <video src={VIDEO_URL} poster={POSTER_URL} controls autoPlay playsInline preload="metadata">
              <track kind="captions" />
            </video>
          </div>
          <p className="intro-foot">
            A short introduction: why the editor runs in your browser, and the editor at work on a real document.
            <Link to={ROUTES.howItWorks} className="link-arrow" onClick={() => setOpen(false)}>
              Read how it works <ArrowRight aria-hidden="true" />
            </Link>
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
