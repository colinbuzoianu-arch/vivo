// src/lib/scorer.js
// Weighted multi-dimensional remedy matching engine.
import { REMEDY_DB } from "./remedyDb.js";

export function scoreRemedy(remedy, profile) {
  let score = 0;
  const p = profile;
  const complaint  = (p.chiefComplaint || "").toLowerCase();
  const sensation  = (p.symptoms?.sensation || "").toLowerCase();
  const location   = (p.symptoms?.location || "").toLowerCase();
  const mood       = (p.mentalEmotional?.mood || "").toLowerCase();
  const fears      = (p.mentalEmotional?.fears || []).map(f => f.toLowerCase());
  const anxieties  = (p.mentalEmotional?.anxieties || "").toLowerCase();
  const betterFrom = (p.symptoms?.modalities?.better || []).map(m => m.toLowerCase());
  const worseFrom  = (p.symptoms?.modalities?.worse  || []).map(m => m.toLowerCase());
  const temp       = (p.constitution?.temperature || "").toLowerCase();
  const energy     = (p.constitution?.energy || "").toLowerCase();
  const sleep      = (p.sleep?.quality || "").toLowerCase();
  const dreams     = (p.sleep?.dreams || "").toLowerCase();
  const cravings   = (p.appetite?.cravings || []).map(c => c.toLowerCase());
  const thirst     = (p.appetite?.thirst || "").toLowerCase();
  const perspiration = (p.constitution?.perspiration || "").toLowerCase();
  const history    = (p.history || "").toLowerCase();
  const keyNotes   = (p.keyNotes || []).map(k => k.toLowerCase());

  const allText = [
    complaint, sensation, location, mood, anxieties, sleep, dreams,
    energy, perspiration, history,
    ...fears, ...cravings, ...betterFrom, ...worseFrom, ...keyNotes,
  ].join(" ");

  // 1. Condition match
  for (const cond of remedy.conditions) {
    const words = cond.toLowerCase().split(" ");
    const hits  = words.filter(w => w.length > 3 && allText.includes(w)).length;
    if (hits > 0) score += hits * 3;
  }

  // 2. Keynote match (highest weight)
  for (const kn of remedy.keynotes) {
    const words = kn.toLowerCase().split(" ");
    const hits  = words.filter(w => w.length > 3 && allText.includes(w)).length;
    if (hits > 0) score += hits * 4;
    if (allText.includes(kn.toLowerCase())) score += 6;
  }

  // 3. Sensation match
  for (const sens of remedy.sensations) {
    if (sensation.includes(sens) || complaint.includes(sens)) score += 5;
  }

  // 4. Mental / emotional match
  for (const m of remedy.mentals) {
    const words = m.toLowerCase().split(" ");
    const hits  = words.filter(w =>
      w.length > 3 &&
      (mood.includes(w) || anxieties.includes(w) || fears.some(f => f.includes(w)))
    ).length;
    if (hits > 0) score += hits * 4;
  }

  // 5. Modality match
  for (const b of remedy.modalities.better) {
    if (betterFrom.some(bf => bf.includes(b.toLowerCase()) || b.toLowerCase().includes(bf))) score += 5;
  }
  for (const w of remedy.modalities.worse) {
    if (worseFrom.some(wf => wf.includes(w.toLowerCase()) || w.toLowerCase().includes(wf))) score += 5;
  }

  // 6. Constitution temperature
  if (remedy.constitution.includes(temp) || (temp.includes("chilly") && remedy.constitution.includes("chilly"))) score += 4;
  if (remedy.constitution.includes("hot") && temp.includes("hot")) score += 4;

  // 7. Organ affinity
  for (const aff of remedy.affinities) {
    if (complaint.includes(aff) || location.includes(aff) || allText.includes(aff)) score += 3;
  }

  // 8. Cravings / thirst
  if (remedy.keynotes.some(k => k.includes("craves salt"))   && cravings.some(c => c.includes("salt")))   score += 6;
  if (remedy.keynotes.some(k => k.includes("craves sweets")) && cravings.some(c => c.includes("sweet")))  score += 6;
  if (remedy.keynotes.some(k => k.includes("craves eggs"))   && cravings.some(c => c.includes("egg")))    score += 6;
  if (remedy.keynotes.some(k => k.includes("no thirst"))     && (thirst.includes("not") || thirst.includes("thirstless"))) score += 5;
  if (remedy.keynotes.some(k => k.includes("thirst for cold")) && thirst.includes("cold")) score += 5;
  if (remedy.keynotes.some(k => k.includes("thirst for sips")) && thirst.includes("sip"))  score += 5;

  // 9. Sleep modalities
  if (remedy.keynotes.some(k => k.includes("midnight")) && (worseFrom.some(w => w.includes("midnight")) || sleep.includes("midnight"))) score += 6;
  if (remedy.keynotes.some(k => k.includes("3am"))      && (sleep.includes("3")  || worseFrom.some(w => w.includes("3am"))))           score += 6;
  if (remedy.keynotes.some(k => k.includes("worse after sleep")) && worseFrom.some(w => w.includes("sleep"))) score += 6;

  // 10. Grief / loss bonuses
  if (remedy.id === "ign"    && (allText.includes("grief") || allText.includes("loss") || allText.includes("bereavement"))) score += 12;
  if (remedy.id === "nat-m"  && allText.includes("grief") && allText.includes("closed")) score += 10;
  if (remedy.id === "phos-ac" && allText.includes("grief") && allText.includes("weak"))  score += 10;

  // 11. Perspiration
  if (remedy.keynotes.some(k => k.includes("sweats")) && (perspiration.includes("profuse") || allText.includes("sweat"))) score += 4;
  if (remedy.id === "calc" && perspiration.includes("head")) score += 8;

  // 12. History keywords
  if (history.includes("surgery")     && remedy.conditions.some(c => c.includes("surg"))) score += 6;
  if (history.includes("vaccination") && remedy.id === "thuj")                            score += 8;
  if (history.includes("injury")      && ["arn", "hyper", "ruta"].includes(remedy.id))    score += 8;

  return score;
}

export function getTopRemedies(profile, n = 3) {
  return REMEDY_DB
    .map(r => ({ remedy: r, score: scoreRemedy(r, profile) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}
