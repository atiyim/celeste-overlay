/* Oyun modlarının Valorant'taki Türkçe adları (Riot'un sıra kimliğine göre). */
export const QUEUE_NAMES: Record<string, string> = {
  competitive: "Rekabete Dayalı",
  unrated: "Derecesiz",
  swiftplay: "Tam Gaz",
  premier: "Premier",
  spikerush: "Spike'a Hücum",
  deathmatch: "Ölüm Kalım Maçı",
  hurm: "Takımlı Ölüm Kalım Maçı",
  ggteam: "Tırmanış",
  newmap: "Yeni Harita",
  "": "Özel Oyun",
};

/** Kısa yerlere sığmayan adların kısaltması. */
const SHORT: Record<string, string> = { hurm: "T. Ölüm Kalım Maçı" };

export function queueName(q?: string | null, short = false): string {
  if (q == null) return "";
  return (short && SHORT[q]) || QUEUE_NAMES[q] || q.charAt(0).toUpperCase() + q.slice(1);
}
