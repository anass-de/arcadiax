"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdBannerProps = {
  adSlot: string;
  className?: string;
  adFormat?: "auto" | "fluid" | "rectangle" | "horizontal" | "vertical";
  fullWidthResponsive?: boolean;
};

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";

function isValidClient(client: string) {
  return /^ca-pub-\d+$/.test(client);
}

function isValidSlot(slot: string) {
  return /^\d+$/.test(slot);
}

export default function AdBanner({
  adSlot,
  className,
  adFormat = "auto",
  fullWidthResponsive = true,
}: AdBannerProps) {
  const adRef = useRef<HTMLModElement | null>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!isValidClient(ADSENSE_CLIENT)) return;
    if (!isValidSlot(adSlot)) return;
    if (!adRef.current) return;
    if (pushed.current) return;

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      pushed.current = true;
    } catch (err) {
      console.error("AdSense error:", err);
    }
  }, [adSlot]);

  if (!isValidClient(ADSENSE_CLIENT) || !isValidSlot(adSlot)) {
    if (process.env.NODE_ENV === "production") {
      return null;
    }

    return (
      <div
        className={className}
        style={{
          minHeight: 120,
          border: "1px dashed rgba(255,255,255,0.2)",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          color: "rgba(255,255,255,0.6)",
        }}
      >
        Ad placeholder
      </div>
    );
  }

  return (
    <div className={className}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{
          display: "block",
          width: "100%",
        }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
      />
    </div>
  );
}