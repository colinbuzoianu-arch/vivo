// src/lib/pdf.js
// Generates a clean, structured PDF of consultation results using jsPDF.
// Called from ResultsScreen — no server required, runs entirely in the browser.
//
// Install dependency first:
//   npm install jspdf

import { jsPDF } from "jspdf";

const GOLD       = [160, 140, 90];   // #a08c5a — subtle on white
const BLACK      = [20,  20,  20];
const DARK_GRAY  = [60,  60,  60];
const MID_GRAY   = [100, 100, 100];
const LIGHT_GRAY = [180, 180, 180];
const PAGE_W     = 210; // A4 mm
const MARGIN     = 18;
const CONTENT_W  = PAGE_W - MARGIN * 2;

export function downloadConsultationPDF({ profile, topRemedies, analysisText }) {
  const doc   = new jsPDF({ unit: "mm", format: "a4" });
  const today = new Date().toLocaleDateString(undefined, {
    day: "numeric", month: "long", year: "numeric",
  });

  let y = MARGIN; // cursor — tracks vertical position

  // ── Helpers ───────────────────────────────────────────────────────────────

  const text = (str, x, size = 10, style = "normal", color = BLACK) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    doc.setTextColor(...color);
    doc.text(str, x, y);
  };

  const rule = (color = LIGHT_GRAY, thickness = 0.2) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(thickness);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  };

  const gap = (mm) => { y += mm; };

  // Wraps long text and returns new y after printing
  const wrapped = (str, x, maxW, size = 10, style = "normal", color = DARK_GRAY) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(str || "", maxW);
    doc.text(lines, x, y);
    y += lines.length * (size * 0.4);
  };

  // Label + value pair on same line
  const labelValue = (label, value, size = 9.5) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MID_GRAY);
    doc.text(label, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK_GRAY);
    doc.text(value || "—", MARGIN + 32, y);
    gap(5.5);
  };

  // Section heading
  const sectionHead = (title) => {
    gap(2);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MID_GRAY);
    doc.text(title.toUpperCase(), MARGIN, y);
    gap(3.5);
    rule(LIGHT_GRAY, 0.15);
    gap(4);
  };

  // Check if we need a new page (leave 20mm bottom margin)
  const checkPage = (needed = 20) => {
    if (y + needed > 280) {
      doc.addPage();
      y = MARGIN + 6;
    }
  };

  // ── Header ────────────────────────────────────────────────────────────────

  // VIVO wordmark
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GOLD);
  doc.text("VIVO", MARGIN, y);

  // Subtitle beside it
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...LIGHT_GRAY);
  doc.text("Classical Homeopathic Consultation", MARGIN + 18, y);

  // Date flush right
  doc.setFontSize(8);
  doc.setTextColor(...MID_GRAY);
  doc.text(today, PAGE_W - MARGIN, y, { align: "right" });

  gap(5);
  rule(GOLD, 0.4);
  gap(7);

  // ── Chief complaint ───────────────────────────────────────────────────────

  if (profile?.chiefComplaint) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BLACK);
    doc.text(profile.chiefComplaint, MARGIN, y);
    gap(5);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MID_GRAY);
    doc.text("Chief complaint", MARGIN, y);
    gap(8);
  }

  // ── Clinical rationale ────────────────────────────────────────────────────

  if (analysisText) {
    sectionHead("Clinical Rationale");
    wrapped(analysisText, MARGIN, CONTENT_W, 9.5, "normal", DARK_GRAY);
    gap(8);
  }

  // ── Remedies ──────────────────────────────────────────────────────────────

  const ranks = ["Vivo — Primary Remedy", "Second Choice", "Third Choice"];

  topRemedies?.forEach((item, idx) => {
    checkPage(40);
    const r   = item.remedy;
    const pct = Math.min(99, Math.round(item.score / (item.score + 20) * 100));

    sectionHead(ranks[idx]);

    // Remedy name + match %
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BLACK);
    doc.text(r.name, MARGIN, y);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MID_GRAY);
    doc.text(`${r.abbr}  ·  ${pct}% match`, MARGIN, y + 5.5);
    gap(12);

    // Potency
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MID_GRAY);
    doc.text("Potency", MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK_GRAY);
    doc.text(
      `Acute: ${r.potency?.acute || "—"}   ·   Chronic: ${r.potency?.chronic || "—"}`,
      MARGIN + 18, y
    );
    gap(5.5);

    // Keynotes
    if (r.keynotes?.length) {
      checkPage(14);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...MID_GRAY);
      doc.text("Keynotes", MARGIN, y);
      gap(4);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...DARK_GRAY);
      doc.setFontSize(9);
      r.keynotes.slice(0, 5).forEach(k => {
        checkPage(6);
        doc.text(`·  ${k}`, MARGIN + 2, y);
        gap(4.5);
      });
    }

    // Modalities
    const better = r.modalities?.better?.slice(0, 4).join(", ");
    const worse  = r.modalities?.worse?.slice(0, 4).join(", ");

    if (better || worse) {
      checkPage(14);
      gap(1);
      if (better) {
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...MID_GRAY);
        doc.text("Better from", MARGIN, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...DARK_GRAY);
        doc.text(better, MARGIN + 24, y);
        gap(4.5);
      }
      if (worse) {
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...MID_GRAY);
        doc.text("Worse from", MARGIN, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...DARK_GRAY);
        doc.text(worse, MARGIN + 24, y);
        gap(4.5);
      }
    }

    gap(6);
  });

  // ── Case summary ──────────────────────────────────────────────────────────

  const hasSummary =
    profile?.symptoms?.modalities?.better?.length ||
    profile?.symptoms?.modalities?.worse?.length  ||
    profile?.constitution?.temperature            ||
    profile?.appetite?.thirst;

  if (hasSummary) {
    checkPage(30);
    sectionHead("Case Summary");

    if (profile.symptoms?.modalities?.better?.length)
      labelValue("Better from", profile.symptoms.modalities.better.join(" · "));
    if (profile.symptoms?.modalities?.worse?.length)
      labelValue("Worse from",  profile.symptoms.modalities.worse.join(" · "));
    if (profile.constitution?.temperature)
      labelValue("Constitution", profile.constitution.temperature);
    if (profile.appetite?.thirst)
      labelValue("Thirst",       profile.appetite.thirst);

    gap(4);
  }

  // ── Footer ────────────────────────────────────────────────────────────────

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...LIGHT_GRAY);
    doc.text(
      "For educational purposes only. Consult a qualified homeopath before beginning any treatment.",
      PAGE_W / 2, 289,
      { align: "center" }
    );
    doc.text(`${i} / ${pageCount}`, PAGE_W - MARGIN, 289, { align: "right" });
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  const complaint = profile?.chiefComplaint
    ? profile.chiefComplaint.slice(0, 40).replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "-")
    : "consultation";
  const dateStamp = new Date().toISOString().slice(0, 10);

  doc.save(`vivo-${complaint}-${dateStamp}.pdf`);
}
