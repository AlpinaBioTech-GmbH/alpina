// Request-a-quote drawer: a button that opens a sheet sliding up from the
// bottom of the page. Full-screen on mobile, a contained bottom drawer on
// wider screens.
"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import QuoteForm from "@/components/site/QuoteForm";

export default function QuoteDrawer({
  productName,
  sku,
}: {
  productName?: string;
  sku?: string;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="lg" className="w-full">
          Request a quote
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="h-dvh overflow-y-auto sm:h-auto sm:max-h-[90vh]"
      >
        <div className="mx-auto w-full max-w-lg px-5 py-8 sm:py-10">
          <SheetTitle className="font-[family-name:var(--font-heading)] text-2xl font-bold">
            Request a quote
          </SheetTitle>
          <SheetDescription className="mt-1 text-sm">
            Pricing and availability{productName ? ` for ${productName}` : ""} on
            request. For Research Use Only.
          </SheetDescription>
          <div className="mt-6">
            <QuoteForm productName={productName} sku={sku} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
