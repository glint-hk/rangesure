import { BrandMark, CREDIT_LINE, DYAUS_URL } from '@/components/BrandMark';

// Credit + honesty line shown under every view.
export default function AppFooter() {
  return (
    <footer className="mx-auto mt-10 max-w-7xl border-t border-border pt-5 text-xs text-muted-foreground">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BrandMark className="h-6 w-6" />
          <span>
            <span className="font-semibold text-foreground">Dyaus RangeSure</span> · {CREDIT_LINE}
          </span>
        </div>
        <a href={DYAUS_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
          dyausadvisory.live
        </a>
      </div>
      <p className="mt-2 max-w-3xl leading-relaxed">
        Illustrative prototype. Routes, elevation, weather and chargers are live; trip history and corridor
        volumes are synthetic, and the Route Guarantee is an illustrative underwriting model, not an actuarial one.
      </p>
    </footer>
  );
}
