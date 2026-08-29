import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * DESIGN.md "Buttons":
 * 44px yükseklik, 24px yatay dolgu, body-lg (15px) SemiBold, 8px radius, gölgesiz.
 * Üç tipten fazlası yok — varyant çeşitliliği kasıtlı olarak azaltılmıştır.
 */
const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "h-11 rounded-app text-body-lg font-semibold",
    "transition-colors duration-120 ease-enter",
    "disabled:pointer-events-none disabled:opacity-50",
    // Lucide ikonları: 18px, 1.5px stroke (DESIGN.md Iconography)
    "[&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:stroke-[1.5]"
  ),
  {
    variants: {
      variant: {
        primary: "bg-ink text-surface px-6 hover:bg-ink/90",
        secondary:
          "border-[1.5px] border-border bg-transparent text-ink px-6 hover:bg-surface-muted",
        // Düşük öncelikli aksiyon: görsel çerçeve yok, 44px tıklama alanı korunur.
        text: "bg-transparent text-ink px-3 hover:bg-surface-muted",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  ref?: React.Ref<HTMLButtonElement>;
}

export function Button({
  className,
  variant,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
