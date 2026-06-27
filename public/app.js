const token = location.pathname.match(/^\/u\/([^/]+)/)?.[1];
const content = document.querySelector("#content");
const placesCount = document.querySelector("#places-count");
const search = document.querySelector("#search");
const cityFilter = document.querySelector("#city-filter");
const input = document.querySelector("#place-input");
const addButton = document.querySelector("#add-button");

let user = null;

if (!token) {
  renderEmpty("Открой личную ссылку", "Она появится в Telegram после первого сообщения боту.");
} else {
  await loadUser();
}

search.addEventListener("input", render);
cityFilter.addEventListener("change", render);
addButton.addEventListener("click", addPlaces);

async function loadUser() {
  const response = await fetch(`/api/u/${token}`);
  if (!response.ok) {
    renderEmpty("Карта не найдена", "Проверь ссылку или напиши боту /map.");
    return;
  }
  user = await response.json();
  renderFilters();
  render();
}

async function addPlaces() {
  const text = input.value.trim();
  if (!text) return;
  addButton.disabled = true;
  addButton.textContent = "Сохраняю...";
  try {
    const response = await fetch(`/api/u/${token}/places`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Не получилось сохранить");
    input.value = "";
    user = payload.user;
    renderFilters();
    render();
  } catch (error) {
    alert(error.message);
  } finally {
    addButton.disabled = false;
    addButton.textContent = "Сохранить";
  }
}

function renderFilters() {
  const current = cityFilter.value;
  const cities = [...new Set(user.places.map((place) => place.city))].sort((a, b) => a.localeCompare(b, "ru"));
  cityFilter.innerHTML = `<option value="">Все города</option>${cities
    .map((city) => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`)
    .join("")}`;
  cityFilter.value = cities.includes(current) ? current : "";
}

function render() {
  const query = search.value.trim().toLowerCase();
  const city = cityFilter.value;
  const places = user.places.filter((place) => {
    const matchesCity = !city || place.city === city;
    const haystack = `${place.title} ${place.city} ${place.category}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    return matchesCity && matchesQuery;
  });

  placesCount.textContent = formatCount(user.places.length);

  if (!places.length) {
    renderEmpty("Пока пусто", "Добавь место через бота или форму выше.");
    return;
  }

  const groups = groupByCity(places);
  content.innerHTML = [...groups.entries()]
    .map(([cityName, cityPlaces]) => cityCard(cityName, cityPlaces))
    .join("");
}

function cityCard(city, places) {
  return `
    <article class="city-card">
      <div class="city-head">
        <h2>${escapeHtml(city)}</h2>
        <span>${formatCount(places.length)}</span>
      </div>
      <div class="place-list">
        ${places.map(placeCard).join("")}
      </div>
    </article>
  `;
}

function placeCard(place) {
  const date = new Date(place.createdAt).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short"
  });
  const source = place.sourceUrl ? `<a href="${escapeAttr(place.sourceUrl)}" target="_blank" rel="noreferrer">источник</a>` : "";
  return `
    <div class="place">
      <div class="place-top">
        <p class="place-title">${escapeHtml(place.title)}</p>
        <span class="category">${categoryLabel(place.category)}</span>
      </div>
      <div class="meta">
        <span>${date}</span>
        <a href="${escapeAttr(place.mapsUrl)}" target="_blank" rel="noreferrer">Google Maps</a>
        ${source}
      </div>
    </div>
  `;
}

function groupByCity(places) {
  const groups = new Map();
  for (const place of places) {
    if (!groups.has(place.city)) groups.set(place.city, []);
    groups.get(place.city).push(place);
  }
  return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], "ru")));
}

function renderEmpty(title, text) {
  placesCount.textContent = "0 мест";
  content.innerHTML = `
    <div class="empty">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(text)}</p>
    </div>
  `;
}

function categoryLabel(category) {
  const labels = {
    cafe: "кафе",
    restaurant: "еда",
    bar: "бар",
    museum: "музей",
    hotel: "отель",
    viewpoint: "вид",
    beach: "пляж",
    neighborhood: "район",
    transport: "транспорт",
    place: "место",
    unknown: "уточнить"
  };
  return labels[category] || "место";
}

function formatCount(value) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return `${value} место`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${value} места`;
  return `${value} мест`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
