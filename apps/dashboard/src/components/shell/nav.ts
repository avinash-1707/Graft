import {
  LayoutDashboard,
  MessagesSquare,
  BookOpen,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Primary dashboard navigation. Screens land in later units (25–28); the
 *  routes exist now as empty states so the shell is fully navigable. */
export const navItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Conversations", href: "/conversations", icon: MessagesSquare },
  { label: "Knowledge base", href: "/knowledge", icon: BookOpen },
  { label: "Agents", href: "/agents", icon: Users },
  { label: "Settings", href: "/settings", icon: Settings },
];
