/* Uygulamayla gelen nişangahlar. Sıra, public/crosshairs/ içindeki görsel numaralarıyla aynıdır (1.png ... 8.png).
   Kodu kopyalayıp oyunda Ayarlar → Nişangah → Profil kodunu içe aktar'a yapıştır. */
export interface Crosshair { name: string; code: string }

export const CROSSHAIRS: Crosshair[] = [
  { name: "Artı", code: "0;P;h;0;0l;4;0o;0;0a;1;0f;0;1b;0" },
  { name: "İnce artı", code: "0;P;h;0;f;0;0t;1;0l;3;0o;0;0a;1;0f;0;1b;0" },
  { name: "Nokta", code: "0;s;1;P;o;1;d;1;f;0;0b;0;1b;0;S;s;1.2" },
  { name: "Kalp", code: "0;c;1;s;1;P;c;8;u;FF69B4FF;h;0;d;1;b;1;z;3;f;0;0t;4;0l;1;0o;2;0a;1;0f;0;1t;3;1l;1;1o;2;1a;1;1m;0;1f;0;S;b;1;c;8;t;D23B69FF;s;0;o;1" },
  { name: "nAts", code: "0;P;o;1;f;0;0t;1;0l;2;0o;2;0a;1;0f;0;1b;0" },
  { name: "TenZ", code: "0;s;1;P;c;5;h;0;m;1;0l;4;0o;2;0a;1;0f;0;1b;0;S;c;4;o;1" },
  { name: "Florescent", code: "0;s;1;P;c;8;h;0;b;1;f;0;0l;2;0o;1;0a;1;0f;0;1b;0" },
  { name: "Siyah artı", code: "0;p;0;s;1;P;c;8;u;000000FF;h;0;b;1;f;0;m;1;0b;0;1l;3;1o;0;1a;1;1m;0;1f;0;A;c;8;u;000000FF;o;1;d;1;b;1;z;1;0b;0;1b;0" },
];
