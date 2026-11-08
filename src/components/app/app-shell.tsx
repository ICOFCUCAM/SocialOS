"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import {
  Activity, BarChart3, CalendarDays, ChevronDown, CircleHelp, Command,
  FolderKanban, LayoutDashboard, Megaphone, MessageSquare, Radio,
  Settings2, Sparkles, Users2, Video, type LucideIcon
} from "lucide-react";

const primary: {label:string;href:string;icon:LucideIcon;active?:boolean}[] = [
  {label:"Overview",href:"/app",icon:LayoutDashboard},
  {label:"Content calendar",href:"/app/calendar",icon:CalendarDays},
  {label:"Campaigns",href:"/app/campaigns",icon:Megaphone},
  {label:"Post composer",href:"/app/compose",icon:Sparkles},
  {label:"Content studio",href:"/app/studio",icon:Sparkles},
  {label:"Media library",href:"/app/media",icon:Video},
  {label:"Inbox",href:"/app/inbox",icon:MessageSquare},
  {label:"Analytics",href:"/app/analytics",icon:BarChart3},
  {label:"Brands",href:"/app/brands",icon:FolderKanban},
  {label:"Social channels",href:"/app/channels",icon:Activity},
  {label:"Publishing centre",href:"/app/publishing",icon:Radio},
];
const workspace: {label:string;icon:LucideIcon}[] = [
  {label:"Team members",icon:Users2},
  {label:"Activity log",icon:Activity},
];

export function AppShell({children,email,workspaceName,brandName}:{children:React.ReactNode;email:string;workspaceName:string;brandName:string}) {
  const pathname=usePathname();
  return <div className="min-h-screen bg-[#f6f8f5] text-[#1b2821]">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-[#e7ece7] bg-white lg:flex">
      <div className="flex h-[76px] items-center gap-3 border-b border-[#edf0ed] px-6">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#176b4b] text-white"><Command size={19}/></span>
        <span className="text-[17px] font-semibold tracking-tight">SocialOS</span>
        <span className="ml-auto rounded-md border border-[#e8ede8] px-1.5 py-1 text-[9px] font-semibold tracking-wider text-[#87938b]">STUDIO</span>
      </div>
      <div className="border-b border-[#edf0ed] p-4">
        <button className="flex w-full items-center gap-3 rounded-xl border border-[#e9eee9] p-3 text-left hover:bg-[#f8faf8]">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#eaf3ed] text-sm font-semibold text-[#176b4b]">{workspaceName.slice(0,1).toUpperCase()}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{workspaceName}</span><span className="mt-0.5 block text-[11px] text-[#89948d]">Workspace</span></span>
          <ChevronDown size={15} className="text-[#89948d]"/>
        </button>
        <button className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-[#f8faf8]">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#f0f2ef] text-xs font-semibold text-[#657269]">{brandName.slice(0,1).toUpperCase()}</span>
          <span className="min-w-0 flex-1 truncate text-[#59675e]">{brandName}</span><ChevronDown size={14} className="text-[#9aa49d}"/>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-[#a0aaa3]">Workspace</p>
        <div className="space-y-1">{primary.map(item=>{const active=item.href==="/app/brands"?pathname.startsWith("/app/brands"):["/app/publishing","/app/calendar","/app/compose","/app/studio","/app/campaigns"].includes(item.href)?pathname.startsWith(item.href):pathname===item.href;const Icon=item.icon;return <Link key={item.href} href={item.href} aria-disabled={!["/app","/app/brands","/app/channels","/app/publishing","/app/calendar","/app/compose","/app/studio","/app/campaigns"].includes(item.href)} onClick={e=>{if(!["/app","/app/brands","/app/channels","/app/publishing","/app/calendar","/app/compose","/app/studio"].includes(item.href))e.preventDefault();}} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${active?"bg-[#eaf3ed] text-[#176b4b]":"text-[#657269] hover:bg-[#f7f9f7]"}`}><Icon size={17}/><span className="flex-1">{item.label}</span>{!["/app","/app/brands","/app/channels","/app/publishing","/app/calendar","/app/compose","/app/studio"].includes(item.href)&&<span className="rounded bg-[#f2f4f2] px-1.5 py-0.5 text-[9px] text-[#9aa49d]">Soon</span>}</Link>})}</div>
        <p className="px-3 pb-2 pt-8 text-[10px] font-semibold uppercase tracking-[.16em] text-[#a0aaa3]">Manage</p>
        <div className="space-y-1">{workspace.map(item=>{const Icon=item.icon;return <div key={item.label} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-[#9aa49d]"><Icon size={17}/><span className="flex-1">{item.label}</span><span className="text-[9px]">Soon</span></div>})}</div>
      </nav>
      <div className="border-t border-[#edf0ed] p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#e9efe9] text-xs font-semibold text-[#176b4b]">{email.slice(0,1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{email}</span><span className="block text-[10px] text-[#9aa49d]">Account</span></span></div>
        <div className="mt-1 flex items-center justify-between px-3 py-2 text-[11px] text-[#87938b]"><span className="flex items-center gap-2"><Settings2 size={14}/> Settings · Soon</span><CircleHelp size={14}/></div>
        <form action={signOut}><button className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-[#657269] hover:bg-[#f7f9f7]">Sign out</button></form>
      </div>
    </aside>
    <div className="min-h-screen lg:pl-[252px]">
      <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-[#e7ece7] bg-white/90 px-5 backdrop-blur-xl sm:px-8">
        <div><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#98a39b]">Workspace / Overview</p><p className="mt-1 text-sm font-semibold">Social command centre</p></div>
        <div className="flex items-center gap-3"><span className="hidden rounded-full border border-[#e6ece7] px-3 py-2 text-[11px] text-[#7c8980] sm:inline-flex">Workspace plan · Development</span><span className="grid h-9 w-9 place-items-center rounded-full bg-[#eaf3ed] text-xs font-semibold text-[#176b4b]">{email.slice(0,1).toUpperCase()}</span></div>
      </header>
      <main className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-10">{children}</main>
    </div>
  </div>;
}
