import { config } from "../src/config.js";
import { extractPlaces } from "../src/extractor.js";
import { Store } from "../src/storage.js";

const store = new Store(config.dataFile);
await store.load();

const user = store.getOrCreateUser({
  id: "demo",
  first_name: "Demo",
  username: "cloud_watchers"
});
user.token = "demo";
user.places = [];

const samples = [
  "Будапешт: New York Cafe, Fisherman's Bastion, Szimpla Kert",
  "Pink Mamma, Paris",
  "Стамбул: Hafiz Mustafa, Galata Tower",
  "Kafeterija, Белград"
];

for (const sample of samples) {
  const places = extractPlaces(sample);
  store.addPlaces(user.id, places);
}

await store.save();
console.log("Demo map: http://127.0.0.1:8787/u/demo");
