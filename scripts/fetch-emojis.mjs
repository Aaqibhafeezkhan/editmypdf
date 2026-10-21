import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "emojis");
const source = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72";

const catalog = [
  ["Smileys", [
    ["1f600", "Grinning"], ["1f603", "Smiley"], ["1f604", "Smile"], ["1f601", "Beaming"],
    ["1f606", "Laughing"], ["1f605", "Sweat smile"], ["1f923", "Rolling"], ["1f602", "Joy"],
    ["1f642", "Slight smile"], ["1f643", "Upside down"], ["1f609", "Wink"], ["1f60a", "Blush"],
    ["1f607", "Innocent"], ["1f970", "Smiling hearts"], ["1f60d", "Heart eyes"], ["1f929", "Star struck"],
    ["1f618", "Kiss"], ["1f617", "Kissing"], ["1f61a", "Kissing smile"], ["1f60b", "Yum"],
    ["1f61b", "Tongue"], ["1f61c", "Wink tongue"], ["1f92a", "Zany"], ["1f61d", "Squinting"],
    ["1f911", "Money face"], ["1f917", "Hugging"], ["1f92d", "Hand over mouth"], ["1f914", "Thinking"],
    ["1f910", "Zipper mouth"], ["1f928", "Raised eyebrow"], ["1f610", "Neutral"], ["1f611", "Expressionless"],
    ["1f636", "No mouth"], ["1f60f", "Smirk"], ["1f612", "Unamused"], ["1f644", "Eye roll"],
    ["1f62c", "Grimace"], ["1f614", "Pensive"], ["1f615", "Confused"], ["1f641", "Frown"],
    ["1f623", "Persevere"], ["1f616", "Confounded"], ["1f62b", "Tired"], ["1f629", "Weary"],
    ["1f624", "Triumph"], ["1f620", "Angry"], ["1f621", "Rage"], ["1f92c", "Cursing"],
    ["1f480", "Skull"], ["1f4a9", "Pile of poo"], ["1f921", "Clown"], ["1f47b", "Ghost"],
    ["1f47d", "Alien"], ["1f916", "Robot"], ["1f63a", "Smiley cat"], ["1f638", "Grinning cat"],
    ["1f63b", "Heart cat"], ["1f640", "Weary cat"],
  ]],
  ["Gestures", [
    ["1f44d", "Thumbs up"], ["1f44e", "Thumbs down"], ["1f44a", "Fist"], ["1f44f", "Clap"],
    ["1f64c", "Raised hands"], ["1f64f", "Folded hands"], ["1f91d", "Handshake"], ["1f44b", "Wave"],
    ["1f590", "Raised hand"], ["1f44c", "OK"], ["270c", "Victory"], ["1f91e", "Crossed fingers"],
    ["1f446", "Point up"], ["1f447", "Point down"], ["1f448", "Point left"], ["1f449", "Point right"],
    ["1f4aa", "Muscle"], ["1f64b", "Raising hand"], ["1f933", "Selfie"], ["1f91a", "Raised back of hand"],
  ]],
  ["Hearts", [
    ["2764", "Heart"], ["1f9e1", "Orange heart"], ["1f49b", "Yellow heart"], ["1f49a", "Green heart"],
    ["1f499", "Blue heart"], ["1f49c", "Purple heart"], ["1f5a4", "Black heart"], ["1f90d", "White heart"],
    ["1f494", "Broken heart"], ["1f495", "Two hearts"], ["1f496", "Sparkling heart"], ["1f497", "Growing heart"],
    ["1f498", "Heart arrow"], ["1f49d", "Heart ribbon"], ["1f49e", "Revolving hearts"], ["1f49f", "Heart decoration"],
  ]],
  ["Symbols", [
    ["2b50", "Star"], ["1f31f", "Glowing star"], ["2728", "Sparkles"], ["1f525", "Fire"],
    ["1f4a1", "Light bulb"], ["1f4af", "Hundred"], ["2705", "Check"], ["274c", "Cross mark"],
    ["2753", "Question"], ["2757", "Exclamation"], ["1f514", "Bell"], ["1f512", "Lock"],
    ["1f513", "Unlock"], ["1f4cc", "Pin"], ["1f4dd", "Memo"], ["1f4c5", "Calendar"],
    ["1f4ca", "Chart"], ["1f4b0", "Money bag"], ["1f4b5", "Dollar"], ["1f4e2", "Megaphone"],
    ["1f381", "Gift"], ["1f389", "Party"], ["1f38a", "Confetti"], ["1f3c6", "Trophy"],
    ["1f3af", "Target"], ["1f4a5", "Collision"], ["1f4ab", "Dizzy"], ["1f4a4", "Sleep"],
  ]],
  ["Nature", [
    ["1f30d", "Globe"], ["1f319", "Crescent moon"], ["2600", "Sun"], ["26a1", "Lightning bolt"],
    ["2744", "Snowflake"], ["1f324", "Sun cloud"], ["26c5", "Cloudy"], ["1f327", "Rain"],
    ["1f308", "Rainbow"], ["1f33b", "Sunflower"], ["1f337", "Tulip"], ["1f338", "Blossom"],
    ["1f339", "Rose"], ["1f33a", "Hibiscus"], ["1f340", "Clover"], ["1f341", "Maple"],
    ["1f344", "Mushroom"], ["1f333", "Tree"], ["1f30a", "Wave"], ["1f30b", "Volcano"],
  ]],
  ["Food", [
    ["1f34e", "Apple"], ["1f34a", "Tangerine"], ["1f349", "Watermelon"], ["1f353", "Strawberry"],
    ["1f347", "Grapes"], ["1f34c", "Banana"], ["1f355", "Pizza"], ["1f354", "Burger"],
    ["1f35f", "Fries"], ["1f32d", "Hot dog"], ["1f32e", "Taco"], ["1f35c", "Ramen"],
    ["1f370", "Cake"], ["1f36a", "Cookie"], ["1f369", "Donut"], ["2615", "Coffee"],
    ["1f37a", "Beer"], ["1f377", "Wine"], ["1f964", "Cup"], ["1f95a", "Egg"],
  ]],
  ["Animals", [
    ["1f436", "Dog"], ["1f431", "Cat"], ["1f42d", "Mouse"], ["1f430", "Rabbit"],
    ["1f43b", "Bear"], ["1f98a", "Fox"], ["1f981", "Lion"], ["1f984", "Unicorn"],
    ["1f40d", "Snake"], ["1f422", "Turtle"], ["1f41d", "Bee"], ["1f98b", "Butterfly"],
    ["1f438", "Frog"], ["1f427", "Penguin"], ["1f426", "Bird"], ["1f414", "Chicken"],
    ["1f42e", "Cow"], ["1f437", "Pig"], ["1f412", "Monkey"], ["1f43c", "Panda"],
  ]],
  ["Travel", [
    ["1f697", "Car"], ["2708", "Airplane"], ["1f680", "Rocket"], ["1f3e0", "House"],
    ["1f3e2", "Office"], ["26f5", "Sailboat"], ["1f6b2", "Bicycle"], ["1f682", "Train"],
    ["1f6a2", "Ship"], ["1f3d6", "Beach"],
  ]],
  ["Activities", [
    ["26bd", "Soccer"], ["26be", "Baseball"], ["1f3c0", "Basketball"], ["1f3be", "Tennis"],
    ["1f3b5", "Music"], ["1f3b6", "Notes"], ["1f3a8", "Art"], ["1f3ac", "Movie"],
    ["1f3a4", "Microphone"], ["1f4bb", "Laptop"], ["1f4f1", "Phone"], ["1f4de", "Telephone"],
    ["2709", "Envelope"], ["1f4e7", "Email"],
  ]],
];

await mkdir(outDir, { recursive: true });

const jobs = catalog.flatMap(([group, items]) => items.map(([id, name]) => ({ group, id, name })));
const kept = new Array(jobs.length);
let cursor = 0;

async function worker() {
  while (cursor < jobs.length) {
    const index = cursor;
    const job = jobs[index];
    cursor += 1;
    const response = await fetch(`${source}/${job.id}.png`);
    if (!response.ok) {
      console.warn(`skip ${job.id} ${response.status}`);
      continue;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 80) {
      console.warn(`skip ${job.id} tiny`);
      continue;
    }
    await writeFile(join(outDir, `${job.id}.png`), bytes);
    kept[index] = job;
  }
}

await Promise.all(Array.from({ length: 12 }, () => worker()));

const byGroup = new Map();
for (const item of kept) {
  if (!item) continue;
  const list = byGroup.get(item.group) ?? [];
  list.push(item);
  byGroup.set(item.group, list);
}

const lines = [
  "// Twemoji graphics by Twitter, Inc. and other contributors, licensed under CC-BY 4.0.",
  "// https://github.com/twitter/twemoji  —  https://creativecommons.org/licenses/by/4.0/",
  "",
  "export type EmojiItem = { id: string; name: string };",
  "",
  "export const EMOJI_GROUPS: { title: string; items: EmojiItem[] }[] = [",
];
for (const [title, items] of byGroup) {
  lines.push(`  { title: ${JSON.stringify(title)}, items: [`);
  for (const item of items) {
    lines.push(`    { id: ${JSON.stringify(item.id)}, name: ${JSON.stringify(item.name)} },`);
  }
  lines.push("  ] },");
}
lines.push("];", "", "export function emojiSrc(id: string): string {", "  return `/emojis/${id}.png`;", "}", "");

await writeFile(join(root, "src", "emojis.ts"), lines.join("\n"));
await writeFile(
  join(outDir, "NOTICE.txt"),
  "Twemoji graphics (c) Twitter, Inc. and other contributors.\nLicensed under CC-BY 4.0: https://creativecommons.org/licenses/by/4.0/\nSource: https://github.com/twitter/twemoji\n",
);
console.log(`saved ${kept.filter(Boolean).length} emojis`);
