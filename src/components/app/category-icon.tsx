import {
  Car,
  Fuel,
  HeartPulse,
  House,
  PartyPopper,
  Plane,
  Shirt,
  TvMinimalPlay,
  UtensilsCrossed,
  WalletCards,
  Leaf,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, LucideIcon> = {
  Car,
  Fuel,
  HeartPulse,
  House,
  PartyPopper,
  Plane,
  Shirt,
  TvMinimalPlay,
  UtensilsCrossed,
  WalletCards,
  Leaf,
  Shield,
};

type CategoryIconProps = {
  icon?: string | null;
  color?: string | null;
  className?: string;
};

export function CategoryIcon({ icon, color, className }: CategoryIconProps) {
  const Icon = (icon && iconMap[icon]) || WalletCards;

  return (
    <div
      className={cn("flex size-11 items-center justify-center rounded-2xl", className)}
      style={{
        backgroundColor: color ? `${color}1A` : "var(--muted)",
        color: color || "var(--primary)",
      }}
    >
      <Icon className="size-5" />
    </div>
  );
}
