"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { amazonOrderHref } from "@/lib/amazon";
import { openExternalUrl } from "@/lib/native/open-url";
import { isAwaitingArrival } from "@/lib/supply";
import type { SupplyAutomation } from "@/lib/types";

export function AmazonOrderButton({
  item,
  onOrdered,
  className,
}: {
  item: SupplyAutomation;
  onOrdered: () => void;
  className?: string;
}) {
  const [ask, setAsk] = useState(false);
  const awaiting = isAwaitingArrival(item);
  const order = amazonOrderHref(item);

  async function openAmazon() {
    const opened = await openExternalUrl(order.href);
    if (!opened) {
      toast.error("Couldn’t open Amazon. Check your browser pop-up setting.");
    }
    setAsk(true);
  }

  if (awaiting) {
    return (
      <p className="text-[13px] text-muted-foreground">
        Ordered · arriving {item.expectedArrivalDate}
      </p>
    );
  }

  return (
    <>
      <Button type="button" className={className ?? "h-10"} onClick={() => void openAmazon()}>
        {order.search ? "Search on Amazon" : "Order on Amazon"}
      </Button>
      <AlertDialog open={ask} onOpenChange={setAsk}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Did you order it?</AlertDialogTitle>
            <AlertDialogDescription>
              {item.itemName}. Yes marks it ordered and hides the reminder until it should arrive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onOrdered();
                toast.success("Marked ordered", { description: item.itemName });
              }}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
