export type SampleItem = {
  id: string;
  name: string;
  src: string; // URL or /public path
};

export type SampleGroup = {
  id: string;
  name: string;
  items: SampleItem[];
};

export const SAMPLE_GROUPS: SampleGroup[] = [
  {
    id: "bass",
    name: "Bass",
    items: [
      { id: "bass/foyer_roll",        name: "Foyer Bass Roll",        src: "/sounds/bass/foyer_bass_roll.mp3" },
      { id: "bass/foyer_roll_short",  name: "Foyer Bass Roll Short",  src: "/sounds/bass/foyer_bass_roll_short.mp3" },
      { id: "bass/foyer_double_click",name: "Foyer Double Click",     src: "/sounds/bass/foyer_double_click.mp3" },
    ],
  },
  {
    id: "clap",
    name: "Clap",
    items: [
      { id: "clap/CLAP163", name: "CLAP163", src: "/sounds/clap/CLAP163.mp3" },
      { id: "clap/CLAP167", name: "CLAP167", src: "/sounds/clap/CLAP167.mp3" },
      { id: "clap/CLAP190", name: "CLAP190", src: "/sounds/clap/CLAP190.mp3" },
    ],
  },
  {
    id: "fx",
    name: "FX",
    items: [
      { id: "fx/boiling_dust_clouds_a", name: "Boiling In Dust Clouds A", src: "/sounds/fx/boiling_in_dust_clouds_a.mp3" },
      { id: "fx/airhorn",               name: "Airhorn",                   src: "/sounds/fx/airhorn.mp3" },
    ],
  },
];
