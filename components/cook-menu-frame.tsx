"use client";

import type { ReactNode } from "react";

import AccountMenu from "@/components/account-menu";
import CookShell, { cookAccountLinks } from "@/components/cook-shell";
import NotificationBell from "@/components/notification-bell";

const css = `
.mn{--mn-clay:var(--color-clay-500,#B4472B);--mn-ink:var(--color-ink-900,#1F1B16);--mn-amber:#E8A030;
  min-height:100vh;background:var(--color-cream-50,#FAF5EF);color:var(--mn-ink)}
.mn-side{display:none}
.mn-main{min-width:0;padding:16px 16px 104px;box-sizing:border-box}
.mn-wrap{max-width:1120px;margin:0 auto}
.mn-hero{position:relative;box-sizing:border-box;padding:20px 20px 28px;border-radius:28px 28px 28px 72px;
  background:linear-gradient(115deg,#F7E6CF 0%,#F6DDBE 60%,#EBB783 100%)}
.mn-hero-bg{position:absolute;inset:0;overflow:hidden;border-radius:inherit;pointer-events:none}
.mn-acct{position:absolute;top:24px;right:28px;z-index:3}
.mn-disc{position:absolute;right:-90px;top:-150px;width:340px;height:340px;border-radius:50%;background:var(--mn-clay);opacity:.88}
.mn-top{position:relative;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.mn-back{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border-radius:999px;background:#fff;color:var(--mn-ink);font-size:14px;font-weight:600;text-decoration:none}
.mn-right{display:flex;align-items:center;gap:12px}
.mn-bell{display:grid;place-items:center;min-width:44px;min-height:44px;border-radius:999px;background:#fff}
.mn-user{position:relative}
.mn-user summary{list-style:none;display:flex;align-items:center;gap:10px;min-height:44px;padding:4px 14px 4px 4px;border-radius:999px;background:#fff;cursor:pointer}
.mn-user summary::-webkit-details-marker{display:none}
.mn-user summary:focus-visible{outline:2px solid var(--mn-clay);outline-offset:2px}
.mn-av{width:36px;height:36px;border-radius:50%;background:var(--mn-amber);display:grid;place-items:center;font-weight:600;font-size:14px}
.mn-who{line-height:1.2;text-align:left}
.mn-who small{display:block;font-size:12px;color:rgba(31,27,22,.7)}
.mn-who strong{display:block;font-size:14px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mn-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:20;min-width:190px;padding:10px;border-radius:20px;background:#fff;
  border:1px solid rgba(31,27,22,.1);box-shadow:0 16px 40px rgba(31,27,22,.16);display:flex;flex-direction:column;gap:4px}
.mn-menu a{display:flex;align-items:center;min-height:44px;padding:0 12px;border-radius:12px;font-size:14px;font-weight:600;color:var(--mn-ink);text-decoration:none}
.mn-eyebrow{position:relative;margin:26px 0 0;font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:600;color:#6B4A25}
.mn-h1{position:relative;margin:10px 0 0;font-size:36px;line-height:1.05;letter-spacing:-.01em}
.mn-h1 span{color:var(--mn-clay)}
.mn-rule{position:relative;width:56px;height:4px;background:var(--mn-amber);margin-top:14px}
.mn-sub{position:relative;margin:12px 0 0;max-width:430px;font-size:15px;line-height:1.6;color:rgba(31,27,22,.78)}
.mn-card{margin-top:24px;background:#fff;border:1px solid rgba(31,27,22,.08);border-radius:28px;padding:22px;box-shadow:0 12px 40px rgba(31,27,22,.06);box-sizing:border-box}
.mn-headrow{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
.mn-card h2{margin:0;font-size:24px;font-weight:600}
.mn-note{margin:4px 0 0;font-size:14px;color:rgba(31,27,22,.7)}
.mn-count{font-size:14px;font-weight:600;color:rgba(31,27,22,.7)}
.mn-formgrid{display:flex;flex-direction:column;gap:22px;margin-top:20px;padding-top:20px;border-top:1px solid rgba(31,27,22,.08)}
.mn-fields{flex:1;min-width:0;display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
.mn-field{display:block;font-size:14px;font-weight:600}
.mn-in,.mn-ta{display:block;width:100%;margin-top:6px;border-radius:14px;border:1px solid rgba(31,27,22,.25);background:#fff;font:inherit;font-size:16px;font-weight:400;color:var(--mn-ink);box-sizing:border-box}
.mn-in{min-height:50px;padding:0 16px}
.mn-ta{padding:12px 16px;resize:vertical}
.mn-in:focus-visible,.mn-ta:focus-visible{outline:2px solid var(--mn-clay);outline-offset:2px}
.mn-check{display:flex;align-items:center;gap:10px;min-height:44px;font-size:15px;font-weight:400}
.mn-check input{width:20px;height:20px;accent-color:var(--mn-clay)}
.mn-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 26px;border-radius:999px;border:0;
  background:var(--mn-clay);color:#fff;font:inherit;font-size:15px;font-weight:600;cursor:pointer;white-space:nowrap}
.mn-btn:disabled{opacity:.6;cursor:not-allowed}
.mn-btn:focus-visible{outline:2px solid var(--mn-ink);outline-offset:2px}
.mn-ghost{background:#fff;color:#8E341C;border:1.5px solid #C9A98F;min-height:44px;padding:0 18px;font-size:14px}
.mn-full{width:100%}
.mn-alert{margin-top:20px;padding:14px 16px;border-radius:16px;font-size:14px;line-height:1.5}
.mn-alert.err{background:#FDECEA;border:1px solid rgba(180,40,30,.25);color:#7A1F16}
.mn-alert.ok{background:#E8F3EA;border:1px solid rgba(47,125,79,.3);color:#1F5E3A}
.mn-empty{margin-top:18px;padding:32px 20px;border:2px dashed rgba(31,27,22,.18);border-radius:24px;text-align:center}
.mn-empty p{margin:6px 0 0;font-size:14px;color:rgba(31,27,22,.7)}
.mn-img{position:relative;flex:none;overflow:hidden;border-radius:20px;background:linear-gradient(135deg,#F0D9BC,#D9A56B)}
.mn-img.none{display:grid;place-items:center}
.mn-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.mn-tag{position:absolute;left:8px;bottom:8px;padding:3px 9px;border-radius:999px;background:rgba(31,27,22,.74);color:#fff;font-size:11px;font-weight:500}
.mn-img.lg{width:100%;height:190px}
.mn-img.sm{width:100%;height:170px}
.mn-list{list-style:none;margin:18px 0 0;padding:0}
.mn-row{padding:20px 0;border-top:1px solid rgba(31,27,22,.08);display:flex;flex-direction:column;gap:16px}
.mn-row.editing{padding:18px;margin:6px 0;border:2px solid var(--mn-clay);border-radius:24px;background:#FFF8EF}
.mn-rbody{min-width:0;flex:1}
.mn-nameline{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.mn-nameline h3{margin:0;font-size:21px;line-height:1.2;word-break:break-word}
.mn-pill{display:inline-flex;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600}
.mn-pill.pub{background:#E3F1E7;color:#1F5E3A}
.mn-pill.draft{background:#FBE9D2;color:#7A4A0B}
.mn-price{margin:6px 0 0;font-size:22px;font-weight:600;color:var(--mn-clay)}
.mn-desc{margin:6px 0 0;font-size:15px;line-height:1.55;color:rgba(31,27,22,.72);word-break:break-word}
.mn-actions{display:flex;gap:10px;flex-wrap:wrap}
.mn-editgrid{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
.mn-saverow{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:6px}
.mn-bottom{position:fixed;left:0;right:0;bottom:0;z-index:30;display:flex;background:#FFFDF9;border-top:1px solid rgba(31,27,22,.12);padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px));box-sizing:border-box}
.mn-bottom a{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:52px;border-radius:14px;font-size:12px;font-weight:600;color:var(--mn-ink);text-decoration:none}
.mn-bottom a[aria-current="page"]{background:var(--mn-clay);color:#fff}
@media (min-width:640px){
  .mn-main{padding:24px 28px 112px}
  .mn-hero{padding:24px 36px 34px}
  .mn-h1{font-size:46px}
  .mn-card{padding:30px 32px}
  .mn-formgrid{flex-direction:row;align-items:flex-start}
  .mn-formgrid .mn-img.lg{width:230px;height:200px;flex:none}
  .mn-fields{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)}
  .mn-span{grid-column:1 / -1}
  .mn-btn.mn-full{width:auto}
  .mn-row{flex-direction:row;align-items:center;gap:22px}
  .mn-row .mn-img.sm{width:190px;height:132px;flex:none}
  .mn-row.editing{align-items:flex-start;flex-wrap:wrap}
  .mn-editgrid{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)}
}
@media (min-width:1024px){
  .mn-main{padding:20px 32px 56px}
}
@media (prefers-reduced-motion:reduce){.mn *{animation:none!important}}
`;

export default function CookMenuFrame({ children }: { children: ReactNode }) {
  return (
    <CookShell desktopActions={false}>
      <main className="mn">
        <style>{css}</style>
        <div className="mn-main">
          <div className="mn-wrap">
            <section className="mn-hero" aria-labelledby="mn-title">
              <div className="mn-hero-bg" aria-hidden="true">
                <div className="mn-disc" />
              </div>
              <div className="ck-hero-actions mn-acct">
                <NotificationBell />
                <AccountMenu links={cookAccountLinks} />
              </div>
              <p className="mn-eyebrow">Your kitchen space</p>
              <h1 id="mn-title" className="mn-h1 font-display">Your <span>offerings.</span></h1>
              <div className="mn-rule" />
              <p className="mn-sub">
                Publish meals customers can browse, or keep offerings as drafts while you prepare them.
              </p>
            </section>

            {children}
          </div>
        </div>
      </main>
    </CookShell>
  );
}