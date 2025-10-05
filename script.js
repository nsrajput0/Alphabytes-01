document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    const section = link.getAttribute('data-section');
    document.querySelectorAll('.main-section').forEach(sec => {
      sec.style.display = (sec.id === section) ? 'block' : 'none';
    });
    if (section === 'dashboard') {
      loadDashboard();
    }
    if (section === 'study') {
      showRandomNASAFact();
    }
    if (section === 'home') {
      showHomeExtras();
    }
    if (section === 'quiz') {
      startQuiz();
    }
    if (section === 'solar-system') {
      setTimeout(renderSolarSystem, 100);
    }
  });
});

let dashboardLoaded = false;
function loadDashboard() {
  if (dashboardLoaded) return;
  dashboardLoaded = true;
  fetchEONET();
  fetchAPOD();
  getUserLocation();
  fetchNASANews();
}

let eonetEvents = [];
let eonetCategories = {};
const sampleEvents = [
  {
    title: "Wildfire in California",
    categories: [{ title: "Wildfires" }],
    geometry: [{ coordinates: [-120.7, 37.2], date: "2024-06-01T12:00:00Z" }],
    id: "EONET_1"
  },
  {
    title: "Flood in Bangladesh",
    categories: [{ title: "Floods" }],
    geometry: [{ coordinates: [90.4, 23.7], date: "2024-06-02T09:00:00Z" }],
    id: "EONET_2"
  },
  {
    title: "Volcano Eruption in Indonesia",
    categories: [{ title: "Volcanoes" }],
    geometry: [{ coordinates: [112.95, -7.54], date: "2024-06-03T15:00:00Z" }],
    id: "EONET_3"
  },
  {
    title: "Severe Storm in Texas",
    categories: [{ title: "Severe Storms" }],
    geometry: [{ coordinates: [-99.9, 31.9], date: "2024-06-04T18:00:00Z" }],
    id: "EONET_4"
  }
];

function fetchEONET() {
  fetch('https://eonet.gsfc.nasa.gov/api/v3/events?limit=20')
    .then(r => r.json())
    .then(data => {
      eonetEvents = data.events || [];
      renderEvents();
      renderMap();
      renderChart();
    })
    .catch(() => {
      eonetEvents = sampleEvents;
      renderEvents();
      renderMap();
      renderChart();
    });
}

function renderEvents() {
  const list = document.getElementById('events-list');
  list.innerHTML = '';
  if (!eonetEvents.length) {
    list.innerHTML = '<div>No events found.</div>';
    return;
  }
  eonetCategories = {};
  eonetEvents.slice(0, 8).forEach(ev => {
    const cat = ev.categories[0]?.title || "Other";
    eonetCategories[cat] = (eonetCategories[cat] || 0) + 1;
    const date = ev.geometry[0]?.date ? new Date(ev.geometry[0].date).toLocaleDateString() : '';
    const card = document.createElement('div');
    card.className = 'event-card';
    card.innerHTML = `
      <div><strong>${ev.title}</strong></div>
      <div>
        <span class="event-category">${cat}</span>
        <span class="event-date">${date}</span>
      </div>
    `;
    list.appendChild(card);
  });
}

let userMarker = null;
function getUserLocation() {
  const locDiv = document.getElementById('user-location');
  const tempDiv = document.getElementById('user-temp');
  const timeDiv = document.getElementById('user-time');
  if (!navigator.geolocation) {
    locDiv.textContent = "Geolocation not supported.";
    if (tempDiv) tempDiv.textContent = "";
    if (timeDiv) timeDiv.textContent = "";
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      if (
        typeof latitude !== "number" ||
        typeof longitude !== "number" ||
        isNaN(latitude) ||
        isNaN(longitude)
      ) {
        locDiv.textContent = "Location unavailable.";
        if (tempDiv) tempDiv.textContent = "";
        if (timeDiv) {
          timeDiv.textContent = "";
          if (window._localTimeInterval) {
            clearInterval(window._localTimeInterval);
            window._localTimeInterval = null;
          }
        }
        const airDiv = document.getElementById('air-quality-content');
        if (airDiv) airDiv.textContent = 'Air quality data unavailable.';
        const soilDiv = document.getElementById('soil-quality-content');
        if (soilDiv) soilDiv.textContent = 'Soil quality data unavailable.';
        return;
      }
      locDiv.textContent = `Lat: ${latitude.toFixed(3)}, Lon: ${longitude.toFixed(3)}`;

      if (timeDiv) {
        if (window._localTimeInterval) clearInterval(window._localTimeInterval);
        function updateLocalTime() {
          const now = new Date();
          timeDiv.textContent = "Local Time: " + now.toLocaleString();
        }
        updateLocalTime();
        window._localTimeInterval = setInterval(updateLocalTime, 1000);
      }
      if (tempDiv) {
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`)
          .then(r => r.json())
          .then(data => {
            if (data.current_weather && typeof data.current_weather.temperature !== "undefined") {
              tempDiv.textContent = `Temperature: ${data.current_weather.temperature}°C`;
            } else {
              tempDiv.textContent = "Temperature: N/A";
            }
          })
          .catch(() => {
            tempDiv.textContent = "Temperature: N/A";
          });
      }
      fetchAirAndSoilQuality(latitude, longitude);

      if (window.leafletMap) {
        if (window.userMarker) window.leafletMap.removeLayer(window.userMarker);
        window.userMarker = L.marker([latitude, longitude], { title: "You" })
          .addTo(window.leafletMap)
          .bindPopup("Your Location")
          .openPopup();
        window.leafletMap.setView([latitude, longitude], 4);
      }
    },
    err => {
      locDiv.textContent = "Location unavailable.";
      if (tempDiv) tempDiv.textContent = "";
      if (timeDiv) {
        timeDiv.textContent = "";
        if (window._localTimeInterval) {
          clearInterval(window._localTimeInterval);
          window._localTimeInterval = null;
        }
      }
      const airDiv = document.getElementById('air-quality-content');
      if (airDiv) airDiv.textContent = 'Air quality data unavailable.';
      const soilDiv = document.getElementById('soil-quality-content');
      if (soilDiv) soilDiv.textContent = 'Soil quality data unavailable.';
    }
  );
}

let eventMarkers = [];
function renderMap() {
  if (!window.leafletMap) {
    window.leafletMap = L.map('map').setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(window.leafletMap);
  }
  eventMarkers.forEach(m => window.leafletMap.removeLayer(m));
  eventMarkers = [];
  eonetEvents.slice(0, 8).forEach(ev => {
    const coords = ev.geometry[0]?.coordinates;
    if (coords && coords.length === 2) {
      const marker = L.marker([coords[1], coords[0]], {
        title: ev.title
      }).addTo(window.leafletMap)
        .bindPopup(`<strong>${ev.title}</strong><br>${ev.categories[0]?.title || ''}`);
      eventMarkers.push(marker);
    }
  });
}

const sampleAPOD = {
  url: "https://apod.nasa.gov/apod/image/2406/NGC6188_HaLRGBpugh1024.jpg",
  title: "NGC 6188: The Dragons of Ara",
  explanation: "This cosmic landscape shows emission nebula NGC 6188 in the windswept, dusty reaches of the constellation Ara."
};
function fetchAPOD() {
  fetch('https://api.nasa.gov/planetary/apod?api_key=4pikVJsdIWZvaOuqMzzskcOXkFz2MMb4lL95xNlW')
    .then(r => r.json())
    .then(data => {
      if (
        !data ||
        !data.url ||
        !data.title ||
        !data.explanation ||
        (data.media_type && data.media_type !== "image")
      ) {
        renderAPOD(sampleAPOD);
        renderHomeAPOD(sampleAPOD);
      } else {
        renderAPOD(data);
        renderHomeAPOD(data);
      }
    })
    .catch(() => {
      renderAPOD(sampleAPOD);
      renderHomeAPOD(sampleAPOD);
    });
}

function renderAPOD(data) {
  const apodDiv = document.getElementById('apod-content');
  if (!apodDiv) return;
  let url = sampleAPOD.url;
  if (data.media_type === "image" && (data.hdurl || data.url)) {
    url = data.hdurl || data.url;
  }
  const title = data.title || sampleAPOD.title;
  const explanation = data.explanation || sampleAPOD.explanation;
  apodDiv.innerHTML = `
    <div style="width:100%;display:flex;justify-content:center;align-items:center;">
      <img src="${url}" alt="${title}" style="max-width:100%;max-height:260px;object-fit:contain;display:block;">
    </div>
    <div><strong>${title}</strong></div>
    <div>${explanation}</div>
  `;
}

function renderHomeAPOD(data) {
  const homeApod = document.getElementById('home-apod-img');
  if (!homeApod) return;
  let url = sampleAPOD.url;
  if (data.media_type === "image" && (data.hdurl || data.url)) {
    url = data.hdurl || data.url;
  }
  const title = data.title || sampleAPOD.title;
  homeApod.innerHTML = `
    <div style="width:100%;display:flex;justify-content:center;align-items:center;">
      <img src="${url}" alt="${title}" title="${title}" style="max-height:120px;width:100%;object-fit:cover;display:block;">
    </div>
    <div style="font-size:0.95em;margin-top:0.4em;"><b>${title}</b></div>
  `;
}

// --- Chart.js ---
let chartInstance = null;
function renderChart() {
  const ctx = document.getElementById('events-chart').getContext('2d');
  const cats = Object.keys(eonetCategories);
  const counts = cats.map(c => eonetCategories[c]);
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: cats,
      datasets: [{
        label: 'Event Count',
        data: counts,
        backgroundColor: cats.map(cat => {
          if (cat.includes('Wildfire')) return '#e05c3e';
          if (cat.includes('Storm')) return '#3ec6e0';
          if (cat.includes('Flood')) return '#3ee07a';
          if (cat.includes('Volcano')) return '#e0c63e';
          return '#a3b9cc';
        })
      }]
    },
    options: {
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true, ticks: { color: '#e6eaf3' } },
        x: { ticks: { color: '#e6eaf3' } }
      }
    }
  });
}

// --- NASA News ---


function fetchNASANews() {
  fetch('https://api.rss2json.com/v1/api.json?rss_url=https://www.nasa.gov/rss/dyn/breaking_news.rss')
    .then(r => r.json())
    .then(data => {
      if (data && data.items && data.items.length) {
        // Map RSS items to your card format
        const newsArr = data.items.map(item => ({
          title: item.title,
          published_date: item.pubDate ? item.pubDate.split(' ')[0] : '',
          url: item.link,
          summary: item.description.replace(/<[^>]+>/g, '')
        }));
        renderNASANews(newsArr);
      } else {
        renderNASANews(sampleNews);
      }
    })
    .catch(() => {
      renderNASANews(sampleNews);
    });
}
function renderNASANews(newsArr) {
  const newsDiv = document.getElementById('nasa-news-list');
  if (!newsDiv) return;
  newsDiv.innerHTML = '';
  newsArr.slice(0, 5).forEach(news => {
    const card = document.createElement('div');
    card.className = 'nasa-news-card';
    card.innerHTML = `
      <div class="nasa-news-title">${news.title}</div>
      <div class="nasa-news-date">${news.published_date}</div>
      <div class="nasa-news-summary">${news.summary || ''}</div>
      <a class="nasa-news-link" href="${news.url}" target="_blank">Read more</a>
    `;
    newsDiv.appendChild(card);
  });
}

// --- Study NASA Section ---
const nasaFacts = [
  "NASA was established in 1958 as the United States' space exploration agency.",
  "The Hubble Space Telescope has provided stunning images of the universe since 1990.",
  "NASA's Mars rovers have discovered evidence of ancient water on Mars.",
  "The International Space Station is a joint project involving NASA, Roscosmos, ESA, JAXA, and CSA.",
  "NASA's Artemis program aims to land the first woman and next man on the Moon.",
  "Voyager 1, launched by NASA in 1977, is the farthest human-made object from Earth.",
  "NASA's James Webb Space Telescope will look further into the universe than ever before.",
  "NASA's Earth science missions help us understand climate change and natural disasters.",
  "The Apollo 11 mission landed the first humans on the Moon in 1969.",
  "NASA's Perseverance rover is searching for signs of ancient life on Mars."
];
let currentFactIdx = 0;
function showRandomNASAFact() {
  const factDiv = document.getElementById('study-nasa-fact');
  if (!factDiv) return;
  if (typeof currentFactIdx !== 'number') currentFactIdx = 0;
  factDiv.textContent = nasaFacts[currentFactIdx];
}
document.addEventListener('DOMContentLoaded', () => {
  const nextBtn = document.getElementById('next-nasa-fact');
  if (nextBtn) {
    nextBtn.onclick = () => {
      currentFactIdx = (currentFactIdx + 1) % nasaFacts.length;
      showRandomNASAFact();
    };
  }
});

// --- Home Page Extras ---
function showHomeExtras() {
  // NASA fact
  const factDiv = document.getElementById('home-nasa-fact');
  if (factDiv) {
    const idx = Math.floor(Math.random() * nasaFacts.length);
    factDiv.textContent = nasaFacts[idx];
  }
}

// --- Quiz Section ---

// --- Sprinkles Background ---
function createSprinkles() {
  const sprinkleColors = [
    'rgba(62,198,224,0.7)',
    'rgba(163,185,204,0.5)',
    'rgba(255,255,255,0.13)',
    'rgba(62,224,122,0.4)',
    'rgba(224,92,62,0.4)'
  ];
  const sprinkleCount = 60;
  const sprinkleMin = 2, sprinkleMax = 6;
  const bg = document.getElementById('sprinkles-bg');
  if (!bg) return;
  bg.innerHTML = '';
  const w = window.innerWidth, h = window.innerHeight;
  for (let i = 0; i < sprinkleCount; i++) {
    const dot = document.createElement('div');
    dot.className = 'sprinkle-dot';
    const size = Math.random() * (sprinkleMax - sprinkleMin) + sprinkleMin;
    dot.style.width = dot.style.height = size + 'px';
    dot.style.left = Math.random() * w + 'px';
    dot.style.top = Math.random() * h + 'px';
    dot.style.background = sprinkleColors[Math.floor(Math.random() * sprinkleColors.length)];
    dot.style.opacity = (Math.random() * 0.5 + 0.3).toFixed(2);
    bg.appendChild(dot);
  }
}
window.addEventListener('resize', createSprinkles);
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.main-section').forEach(sec => {
    sec.style.display = (sec.id === 'home') ? 'block' : 'none';
  });
  showHomeExtras();
  fetchAPOD();
  showRandomNASAFact();
  const nextBtn = document.getElementById('next-nasa-fact');
  if (nextBtn) {
    nextBtn.onclick = () => {
      currentFactIdx = (currentFactIdx + 1) % nasaFacts.length;
      showRandomNASAFact();
    };
  }
  createSprinkles();
});


// Twinkling stars background
(function twinklingStars() {
  const canvas = document.getElementById('stars-bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w = window.innerWidth;
  let h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;

  const STAR_COUNT = 120;
  const stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.2 + 0.3,
      alpha: Math.random(),
      dAlpha: (Math.random() * 0.02 + 0.005) * (Math.random() < 0.5 ? 1 : -1)
    });
  }

  function drawStars() {
    ctx.clearRect(0, 0, w, h);
    for (const star of stars) {
      ctx.save();
      ctx.globalAlpha = Math.abs(star.alpha);
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, 2 * Math.PI);
      ctx.fillStyle = "#70cdffff";
      ctx.shadowColor = "#70cdffff";
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.restore();

      star.alpha += star.dAlpha;
      if (star.alpha <= 0 || star.alpha >= 1) {
        star.dAlpha = -star.dAlpha;
      }
    }
    requestAnimationFrame(drawStars);
  }

  window.addEventListener('resize', () => {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    for (const star of stars) {
      star.x = Math.random() * w;
      star.y = Math.random() * h;
    }
  });

  drawStars();
})();

// --- Air Quality ---

function fetchAirAndSoilQuality(lat, lon) {
  const airDiv = document.getElementById('air-quality-content');
  if (airDiv) {
    airDiv.textContent = 'Loading air quality...';
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm10,pm2_5,carbon_monoxide,ozone`)
      .then(r => r.json())
      .then(data => {
        const h = data.hourly || {};
        const idx = h.time ? h.time.length - 1 : 0;
        const pm25 = h.pm2_5 ? h.pm2_5[idx] : null;
        const pm10 = h.pm10 ? h.pm10[idx] : null;
        let aqi = pm25 !== undefined && pm25 !== null ? pm25 : (pm10 !== undefined && pm10 !== null ? pm10 : null);
        let condition = "Unknown";
        if (aqi !== null) {
          if (aqi <= 50) condition = "Good";
          else if (aqi <= 100) condition = "Moderate";
          else if (aqi <= 150) condition = "Unhealthy for Sensitive Groups";
          else if (aqi <= 200) condition = "Unhealthy";
          else if (aqi <= 300) condition = "Very Unhealthy";
          else condition = "Hazardous";
        }
        airDiv.innerHTML = `
          <b>PM2.5:</b> ${pm25 !== undefined && pm25 !== null ? pm25 + ' µg/m³' : 'N/A'}<br>
          <b>PM10:</b> ${pm10 !== undefined && pm10 !== null ? pm10 + ' µg/m³' : 'N/A'}<br>
          <b>CO:</b> ${h.carbon_monoxide ? h.carbon_monoxide[idx] + ' µg/m³' : 'N/A'}<br>
          <b>Ozone:</b> ${h.ozone ? h.ozone[idx] + ' µg/m³' : 'N/A'}<br>
          <b>Condition:</b> <span style="color:${condition === 'Good' ? '#3ee07a' : condition === 'Moderate' ? '#ffd700' : condition.includes('Unhealthy') ? '#e05c3e' : '#d32f2f'}">${condition}</span>
        `;
      })
      .catch(() => {
        airDiv.textContent = 'Air quality data unavailable.';
      });
  }

  const soilDiv = document.getElementById('soil-quality-content');
  if (soilDiv) {
    soilDiv.textContent = 'Loading soil quality...';
    fetch(`https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=phh2o&property=ocd&property=soc&depth=0-5cm`)
      .then(r => r.json())
      .then(data => {
        const props = data.properties || {};
        const ph = props.phh2o?.values?.[0]?.value ?? 'N/A';
        const soc = props.soc?.values?.[0]?.value ?? 'N/A';
        const ocd = props.ocd?.values?.[0]?.value ?? 'N/A';
        soilDiv.innerHTML = `
          <b>Soil pH (0-5cm):</b> ${ph}<br>
          <b>Soil Organic Carbon (SOC):</b> ${soc} g/kg<br>
          <b>Organic Carbon Density (OCD):</b> ${ocd} t/ha
        `;
      })
      .catch(() => {
        soilDiv.textContent = 'Soil quality data unavailable.';
      });
  }
}

function getUserLocation() {
  const locDiv = document.getElementById('user-location');
  const tempDiv = document.getElementById('user-temp');
  const timeDiv = document.getElementById('user-time');
  if (!navigator.geolocation) {
    locDiv.textContent = "Geolocation not supported.";
    if (tempDiv) tempDiv.textContent = "";
    if (timeDiv) timeDiv.textContent = "";
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      if (
        typeof latitude !== "number" ||
        typeof longitude !== "number" ||
        isNaN(latitude) ||
        isNaN(longitude)
      ) {
        locDiv.textContent = "Location unavailable.";
        if (tempDiv) tempDiv.textContent = "";
        if (timeDiv) {
          timeDiv.textContent = "";
          if (window._localTimeInterval) {
            clearInterval(window._localTimeInterval);
            window._localTimeInterval = null;
          }
        }
        const airDiv = document.getElementById('air-quality-content');
        if (airDiv) airDiv.textContent = 'Air quality data unavailable.';
        const soilDiv = document.getElementById('soil-quality-content');
        if (soilDiv) soilDiv.textContent = 'Soil quality data unavailable.';
        return;
      }
      locDiv.textContent = `Lat: ${latitude.toFixed(3)}, Lon: ${longitude.toFixed(3)}`;

      // --- Make user's local time tick every second ---
      if (timeDiv) {
        if (window._localTimeInterval) clearInterval(window._localTimeInterval);
        function updateLocalTime() {
          const now = new Date();
          timeDiv.textContent = "Local Time: " + now.toLocaleString();
        }
        updateLocalTime();
        window._localTimeInterval = setInterval(updateLocalTime, 1000);
      }
      if (tempDiv) {
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`)
          .then(r => r.json())
          .then(data => {
            if (data.current_weather && typeof data.current_weather.temperature !== "undefined") {
              tempDiv.textContent = `Temperature: ${data.current_weather.temperature}°C`;
            } else {
              tempDiv.textContent = "Temperature: N/A";
            }
          })
          .catch(() => {
            tempDiv.textContent = "Temperature: N/A";
          });
      }
      fetchAirAndSoilQuality(latitude, longitude);

      if (window.leafletMap) {
        if (window.userMarker) window.leafletMap.removeLayer(window.userMarker);
        window.userMarker = L.marker([latitude, longitude], { title: "You" })
          .addTo(window.leafletMap)
          .bindPopup("Your Location")
          .openPopup();
        window.leafletMap.setView([latitude, longitude], 4);
      }
    },
    err => {
      locDiv.textContent = "Location unavailable.";
      if (tempDiv) tempDiv.textContent = "";
      if (timeDiv) {
        timeDiv.textContent = "";
        if (window._localTimeInterval) {
          clearInterval(window._localTimeInterval);
          window._localTimeInterval = null;
        }
      }
      const airDiv = document.getElementById('air-quality-content');
      if (airDiv) airDiv.textContent = 'Air quality data unavailable.';
      const soilDiv = document.getElementById('soil-quality-content');
      if (soilDiv) soilDiv.textContent = 'Soil quality data unavailable.';
    }
  );
}

// --- Solar System Animation ---
function renderSolarSystem() {
  const canvas = document.getElementById('solar-system-canvas');
  if (!canvas) return;
  canvas.innerHTML = '';

  // Sun
  const sun = document.createElement('div');
  sun.className = 'solar-sun';
  sun.style.cursor = 'pointer';
  canvas.appendChild(sun);

  // Sun info object
  const sunInfo = {
    description: "The Sun is the star at the center of our solar system. It provides the energy that sustains life on Earth.",
    diameter: "1,391,000 km",
    atmosphere: "Hydrogen, helium (plasma)",
    imp_details: "Surface temperature ~5,500°C. Core temperature ~15 million°C. Accounts for 99.86% of solar system's mass."
  };

  // Sun click handler
  sun.onclick = function () {
    const infoDiv = document.getElementById('planet-info');
    if (!infoDiv) return;
    infoDiv.style.display = 'block';
    infoDiv.innerHTML = `
      <h3 style="margin-top:0;">Sun</h3>
      <p>${sunInfo.description}</p>
      <ul style="margin:0.5em 0 0 1em;">
        <li><b>Diameter:</b> ${sunInfo.diameter}</li>
        <li><b>Atmosphere:</b> ${sunInfo.atmosphere}</li>
        <li><b>Important Details:</b> ${sunInfo.imp_details}</li>
      </ul>
    `;
  };

  // Planet data
  const planets = [
    ['Mercury', 70, 8, '#b1b1b1', 4.8, {
      description: "Mercury is the closest planet to the Sun and the smallest in the Solar System.",
      diameter: "4,879 km",
      orbit: "88 days",
      moons: "0",
      distance_from_sun: "57.9 million km",
      atmosphere: "None (trace amounts of oxygen, sodium, hydrogen)",
      imp_details: "Surface temperature varies from -173°C to 427°C. No moons."
    }],
    ['Venus', 100, 14, '#e6c97b', 12.2, {
      description: "Venus is the hottest planet and has a thick, toxic atmosphere.",
      diameter: "12,104 km",
      orbit: "225 days",
      moons: "0",
      distance_from_sun: "108.2 million km",
      atmosphere: "Carbon dioxide, thick clouds of sulfuric acid",
      imp_details: "Surface temperature ~465°C. Rotates retrograde. No moons."
    }],
    ['Earth', 135, 16, '#3ec6e0', 20, {
      description: "Earth is our home planet, the only known planet with life.",
      diameter: "12,742 km",
      orbit: "365 days",
      moons: "1 (Moon)",
      distance_from_sun: "149.6 million km",
      atmosphere: "Nitrogen, oxygen, argon, carbon dioxide",
      imp_details: "Supports life. 71% surface covered by water."
    }],
    ['Mars', 170, 12, '#e05c3e', 37.7, {
      description: "Mars is known as the Red Planet and has the largest volcano in the Solar System.",
      diameter: "6,779 km",
      orbit: "687 days",
      moons: "2 (Phobos, Deimos)",
      distance_from_sun: "227.9 million km",
      atmosphere: "Carbon dioxide, nitrogen, argon",
      imp_details: "Home to Olympus Mons (largest volcano). Evidence of ancient water."
    }],
    ['Jupiter', 215, 28, '#e0c39c', 236, {
      description: "Jupiter is the largest planet and has a giant storm called the Great Red Spot.",
      diameter: "139,820 km",
      orbit: "12 years",
      moons: "95",
      distance_from_sun: "778.5 million km",
      atmosphere: "Hydrogen, helium, ammonia, methane",
      imp_details: "Has faint rings. Great Red Spot is a giant storm."
    }],
    ['Saturn', 260, 24, '#e6e0b2', 588, {
      description: "Saturn is famous for its beautiful rings.",
      diameter: "116,460 km",
      orbit: "29 years",
      moons: "146",
      distance_from_sun: "1.43 billion km",
      atmosphere: "Hydrogen, helium, methane, ammonia",
      imp_details: "Rings made of ice and rock. Least dense planet."
    }],
    ['Uranus', 305, 18, '#a3e0e6', 1684, {
      description: "Uranus rotates on its side and has faint rings.",
      diameter: "50,724 km",
      orbit: "84 years",
      moons: "27",
      distance_from_sun: "2.87 billion km",
      atmosphere: "Hydrogen, helium, methane",
      imp_details: "Axis tilted 98°. Faint rings. Coldest planet."
    }],
    ['Neptune', 340, 18, '#3e6ee0', 3288, {
      description: "Neptune is the farthest planet and has strong winds.",
      diameter: "49,244 km",
      orbit: "165 years",
      moons: "14",
      distance_from_sun: "4.5 billion km",
      atmosphere: "Hydrogen, helium, methane",
      imp_details: "Fastest winds in solar system. Has faint rings."
    }]
  ];

  // Draw orbits
  planets.forEach(([name, radius]) => {
    const orbit = document.createElement('div');
    orbit.className = 'solar-orbit';
    orbit.style.width = orbit.style.height = (radius * 2) + 'px';
    orbit.style.marginLeft = orbit.style.marginTop = (-radius) + 'px';
    canvas.appendChild(orbit);
  });

  // Create planets
  planets.forEach(([name, radius, size, color, period, info], idx) => {
    const planet = document.createElement('div');
    planet.className = 'solar-planet';
    planet.style.width = planet.style.height = size + 'px';
    planet.style.background = color;
    planet.style.boxShadow = `0 0 12px 2px ${color}99`;
    planet.style.cursor = "pointer";

    // Label
    const label = document.createElement('div');
    label.className = 'solar-label';
    label.textContent = name;
    planet.appendChild(label);

    canvas.appendChild(planet);

    function animatePlanet() {
      const now = Date.now() / 1000;
      const angle = ((now / period) * 2 * Math.PI) % (2 * Math.PI);
      const cx = canvas.offsetWidth / 2;
      const cy = canvas.offsetHeight / 2;
      const x = cx + radius * Math.cos(angle) - size / 2;
      const y = cy + radius * Math.sin(angle) - size / 2;
      planet.style.left = x + 'px';
      planet.style.top = y + 'px';
      requestAnimationFrame(animatePlanet);
    }
    animatePlanet();

    planet.onclick = function () {
      const infoDiv = document.getElementById('planet-info');
      if (!infoDiv) return;
      infoDiv.style.display = 'block';
      infoDiv.innerHTML = `
        <h3 style="margin-top:0;">${name}</h3>
        <p>${info.description}</p>
        <ul style="margin:0.5em 0 0 1em;">
          <li><b>Diameter:</b> ${info.diameter}</li>
          <li><b>Orbit Period:</b> ${info.orbit}</li>
          <li><b>Moons:</b> ${info.moons}</li>
          <li><b>Distance from Sun:</b> ${info.distance_from_sun || 'N/A'}</li>
          <li><b>Atmosphere:</b> ${info.atmosphere || 'N/A'}</li>
          <li><b>Important Details:</b> ${info.imp_details || 'N/A'}</li>
        </ul>
      `;
    };
  });
}

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    const section = link.getAttribute('data-section');
    if (section === 'solar-system') {
      setTimeout(renderSolarSystem, 100);
    }
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.getElementById('nav-toggle');
  const navUl = document.querySelector('nav ul');
  navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    navUl.classList.toggle('open');
  });
  navUl.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navToggle.classList.remove('active');
      navUl.classList.remove('open');
    });
  });
});
window.addEventListener('DOMContentLoaded', function () {
  var starsCanvas = document.getElementById('rocket-stars-bg');
  if (starsCanvas) {
    starsCanvas.width = window.innerWidth;
    starsCanvas.height = window.innerHeight;
    var ctx = starsCanvas.getContext('2d');
    for (var i = 0; i < 120; i++) {
      var x = Math.random() * starsCanvas.width;
      var y = Math.random() * starsCanvas.height;
      var r = Math.random() * 1.2 + 0.3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = Math.random() * 0.7 + 0.3;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  var rocketCanvas = document.getElementById('rocket-launch-canvas');
  var smokeCanvas = document.getElementById('rocket-smoke-canvas');
  if (rocketCanvas && smokeCanvas) {
    rocketCanvas.width = window.innerWidth;
    rocketCanvas.height = window.innerHeight;
    smokeCanvas.width = window.innerWidth;
    smokeCanvas.height = window.innerHeight;
    var ctx = rocketCanvas.getContext('2d');
    var smokeCtx = smokeCanvas.getContext('2d');
    var w = rocketCanvas.width, h = rocketCanvas.height;
    var rocketY = h * 0.85;
    var rocketX = w / 2;
    var frame = 0;
    var rocketHeight = h * 0.18;
    var rocketWidth = rocketHeight * 0.18;
    var smokeParticles = [];
    var fireParticles = [];
    var launchPhase = true;
    var fadeOutFrame = 0;

    function drawRocket(x, y) {
      ctx.save();
      ctx.translate(x, y);

      var bodyGrad = ctx.createLinearGradient(-rocketWidth / 2, -rocketHeight, rocketWidth / 2, 0);
      bodyGrad.addColorStop(0, "#3ec6e0");
      bodyGrad.addColorStop(1, "#23293a");
      ctx.beginPath();
      ctx.rect(-rocketWidth / 2, -rocketHeight, rocketWidth, rocketHeight);
      ctx.fillStyle = bodyGrad;
      ctx.shadowColor = "#3ec6e0";
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.moveTo(-rocketWidth / 2, -rocketHeight);
      ctx.lineTo(0, -rocketHeight - rocketWidth * 1.2);
      ctx.lineTo(rocketWidth / 2, -rocketHeight);
      ctx.closePath();
      ctx.fillStyle = "#a3b9cc";
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(0, -rocketHeight * 0.7, rocketWidth * 0.22, 0, 2 * Math.PI);
      ctx.fillStyle = "#3ec6e0";
      ctx.shadowColor = "#3ec6e0";
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.moveTo(-rocketWidth / 2, -rocketHeight * 0.2);
      ctx.lineTo(-rocketWidth * 0.9, 0);
      ctx.lineTo(-rocketWidth / 2, 0);
      ctx.closePath();
      ctx.fillStyle = "#3ec6e0";
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(rocketWidth / 2, -rocketHeight * 0.2);
      ctx.lineTo(rocketWidth * 0.9, 0);
      ctx.lineTo(rocketWidth / 2, 0);
      ctx.closePath();
      ctx.fillStyle = "#3ec6e0";
      ctx.fill();

      ctx.beginPath();
      ctx.rect(-rocketWidth / 2, -rocketHeight * 0.45, rocketWidth, rocketHeight * 0.09);
      ctx.fillStyle = "#a3b9cc";
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;

      var flameLen = rocketHeight * 0.55 + Math.sin(frame / 2) * rocketHeight * 0.12;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-rocketWidth / 2.2, 0);
      ctx.bezierCurveTo(-rocketWidth / 2, flameLen * 0.5, rocketWidth / 2, flameLen * 0.5, rocketWidth / 2.2, 0);
      ctx.lineTo(0, flameLen);
      ctx.closePath();
      var flameGrad = ctx.createLinearGradient(0, 0, 0, flameLen);
      flameGrad.addColorStop(0, "#fff");
      flameGrad.addColorStop(0.2, "#ffd700");
      flameGrad.addColorStop(0.5, "#ff9800");
      flameGrad.addColorStop(0.8, "#e05c3e");
      flameGrad.addColorStop(1, "#f44336");
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = flameGrad;
      ctx.shadowColor = "#ffd700";
      ctx.shadowBlur = 24;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();

      ctx.restore();
    }

    function drawFire() {
      for (var i = 0; i < fireParticles.length; i++) {
        var p = fireParticles[i];
        smokeCtx.save();
        smokeCtx.globalAlpha = p.alpha;
        smokeCtx.beginPath();
        smokeCtx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI);
        var grad = smokeCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        grad.addColorStop(0, "rgba(255,255,200,0.9)");
        grad.addColorStop(0.3, "rgba(255,180,60,0.7)");
        grad.addColorStop(0.7, "rgba(255,80,0,0.4)");
        grad.addColorStop(1, "rgba(255,0,0,0.1)");
        smokeCtx.fillStyle = grad;
        smokeCtx.fill();
        smokeCtx.restore();
        p.x += p.vx;
        p.y += p.vy;
        p.radius += 0.3 + Math.random() * 0.3;
        p.alpha -= 0.02 + Math.random() * 0.01;
      }
      fireParticles = fireParticles.filter(p => p.alpha > 0.05);
    }

    function drawSmoke() {
      smokeCtx.clearRect(0, 0, w, h);
      drawFire();
      for (var i = 0; i < smokeParticles.length; i++) {
        var p = smokeParticles[i];
        smokeCtx.save();
        smokeCtx.globalAlpha = p.alpha;
        smokeCtx.beginPath();
        smokeCtx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI);
        var grad = smokeCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        grad.addColorStop(0, "rgba(255,255,255,0.85)");
        grad.addColorStop(0.5, "rgba(220,220,220,0.5)");
        grad.addColorStop(1, "rgba(200,200,200,0.1)");
        smokeCtx.fillStyle = grad;
        smokeCtx.fill();
        smokeCtx.restore();
        p.x += p.vx;
        p.y += p.vy;
        p.radius += 0.7 + Math.random() * 0.8;
        p.alpha -= 0.008 + Math.random() * 0.004;
      }
      smokeParticles = smokeParticles.filter(p => p.alpha > 0.05);
    }

    function animateRocket() {
      ctx.clearRect(0, 0, w, h);

      var overlay = document.getElementById('rocket-video-overlay');
      if (!launchPhase && fadeOutFrame < 60) {
        overlay.style.opacity = (1 - fadeOutFrame / 60).toFixed(2);
        fadeOutFrame++;
      }

      if (launchPhase || fadeOutFrame < 60) {
        drawRocket(rocketX, rocketY);
      }

      if (launchPhase && rocketY > 0) {
        for (var i = 0; i < 22; i++) {
          fireParticles.push({
            x: rocketX + (Math.random() - 0.5) * rocketWidth * 1.2,
            y: rocketY + rocketHeight * 0.1 + Math.random() * 18,
            radius: rocketWidth * 0.18 + Math.random() * rocketWidth * 0.22,
            alpha: 0.7 + Math.random() * 0.2,
            vx: (Math.random() - 0.5) * 1.2,
            vy: 2.5 + Math.random() * 1.2
          });
        }
        for (var i = 0; i < 18; i++) {
          smokeParticles.push({
            x: rocketX + (Math.random() - 0.5) * rocketWidth * 1.5,
            y: rocketY + rocketHeight * 0.1 + Math.random() * 22,
            radius: rocketWidth * 0.7 + Math.random() * rocketWidth * 0.7,
            alpha: 0.55 + Math.random() * 0.25,
            vx: (Math.random() - 0.5) * 1.8,
            vy: 2.2 + Math.random() * 1.2
          });
        }
      }
      drawSmoke();

      if (launchPhase) {
        var isMobile = window.innerWidth <= 700 || window.innerHeight <= 700;
        var baseSpeed = h * 0.012 + Math.max(0, Math.sin(frame / 12)) * h * 0.004;
        var speed = isMobile ? h * 0.028 + Math.max(0, Math.sin(frame / 8)) * h * 0.008 : baseSpeed;
        rocketY -= speed;
        frame++;
        if (rocketY < -rocketHeight * 2) {
          launchPhase = false;
          fadeOutFrame = 0;
        }
      }

      if (!launchPhase && fadeOutFrame >= 60) {
        overlay.style.transition = "opacity 1.2s";
        overlay.style.opacity = 0;
        setTimeout(function () {
          overlay.style.display = 'none';
          document.getElementById('site-content').style.display = '';
        }, 1200);
        return;
      }

      requestAnimationFrame(animateRocket);
    }
    animateRocket();
  }
});
document.addEventListener('DOMContentLoaded', function () {
  var navToggle = document.querySelector('.nav-toggle');
  var navMenu = document.querySelector('nav ul');
  navToggle.addEventListener('click', function () {
    navMenu.classList.toggle('show');
  });
  navMenu.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      if (window.innerWidth <= 700) navMenu.classList.remove('show');
    });
  });
  document.addEventListener('click', function (e) {
    if (window.innerWidth > 700) return;
    if (!navMenu.contains(e.target) && !navToggle.contains(e.target)) {
      navMenu.classList.remove('show');
    }
  });
});
window.addEventListener('DOMContentLoaded', function () {
  function resizeSolarCanvas() {
    var el = document.getElementById('solar-system-canvas');
    if (el && el.tagName === 'CANVAS') {
      var rect = el.getBoundingClientRect();
      el.width = rect.width;
      el.height = rect.height;
    }
  }
  resizeSolarCanvas();
  window.addEventListener('resize', resizeSolarCanvas);
});
function summarizeAirQuality(aqi) {
  if (aqi === null || aqi === undefined) return "Unknown";
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

function updateAirQualitySection(aqi, details) {
  var summary = summarizeAirQuality(aqi);
  var color = aqi <= 50 ? '#3ee07a' : aqi <= 100 ? '#ffd700' : aqi <= 150 ? '#e05c3e' : '#d32f2f';
  var content = `<div><b>Status:</b> <span style="color:${aqi ? color : '#888'}">${aqi ? summary : 'No data available'}</span></div>`;
  if (details) content += `<div style="margin-top:0.5em;">${details}</div>`;
  document.getElementById('air-quality-content').innerHTML = content;
}

function fetchAirQuality() {
  if (!navigator.geolocation) {
    updateAirQualitySection(null, "Location not available.");
    return;
  }
  navigator.geolocation.getCurrentPosition(function (pos) {
    var lat = pos.coords.latitude;
    var lon = pos.coords.longitude;
    fetch(`https://api.openaq.org/v2/latest?coordinates=${lat},${lon}&radius=10000&limit=1`)
      .then(res => res.json())
      .then(data => {
        if (data.results && data.results.length > 0) {
          var m = data.results[0].measurements;
          var pm25 = m.find(x => x.parameter === "pm25");
          var pm10 = m.find(x => x.parameter === "pm10");
          var aqi = pm25 ? Math.round(pm25.value) : (pm10 ? Math.round(pm10.value) : null);
          var details = "";
          if (pm25) details += `PM2.5: ${pm25.value} ${pm25.unit}<br>`;
          if (pm10) details += `PM10: ${pm10.value} ${pm10.unit}<br>`;
          details += `Location: ${data.results[0].city || "Unknown"}`;
          updateAirQualitySection(aqi, details);
        } else {
          updateAirQualitySection(null, "No air quality data found for your location.");
        }
      })
      .catch(() => {
        updateAirQualitySection(null, "Unable to fetch air quality data.");
      });
  }, function () {
    updateAirQualitySection(null, "Location access denied.");
  });
}
window.addEventListener('DOMContentLoaded', fetchAirQuality);
document.addEventListener('DOMContentLoaded', function () {
  var dropdown = document.querySelector('.dropdown');
  var dropdownMenu = dropdown.querySelector('.dropdown-menu');
  var studySection = document.getElementById('study');
  var mainSections = document.querySelectorAll('.main-section');
  var studySubsections = document.querySelectorAll('.study-subsection');

  function showStudySubsection(name) {
    studySubsections.forEach(function (sec) {
      sec.style.display = 'none';
    });
    var section = document.getElementById('study-' + name);
    if (section) section.style.display = '';
  }

  dropdown.addEventListener('mouseenter', function () {
    dropdownMenu.style.display = 'block';
  });
  dropdown.addEventListener('mouseleave', function () {
    dropdownMenu.style.display = 'none';
  });

  dropdown.querySelector('.nav-link').addEventListener('click', function (e) {
    e.preventDefault();
    dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
  });

  dropdownMenu.querySelectorAll('.study-dropdown-link').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      mainSections.forEach(function (sec) { sec.style.display = 'none'; });
      studySection.style.display = '';

      showStudySubsection(link.getAttribute('data-study'));

      dropdownMenu.style.display = 'none';
    });
  });

  document.querySelector('a[data-section="study"]').addEventListener('click', function (e) {

    if (!e.target.classList.contains('study-dropdown-link')) {
      mainSections.forEach(function (sec) { sec.style.display = 'none'; });
      studySection.style.display = '';
      showStudySubsection('history');
      dropdownMenu.style.display = 'none';
      e.preventDefault();
    }
  });

  document.querySelectorAll('.study-section-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      showStudySubsection(btn.getAttribute('data-study'));
    });
  });
  if (studySection.style.display !== 'none') {
    showStudySubsection('history');
  }
});
document.addEventListener('DOMContentLoaded', function () {
  fetch('https://api.nasa.gov/planetary/apod?api_key=Vt29Ma0AF0QNw8kbzKlbFH0vmtYMSBGgHG3rZJab')
    .then(res => res.json())
    .then(data => {
      document.getElementById('quiz-paragraph').textContent = data.explanation;

      var questions = [
        {
          q: "What is the title of today's Astronomy Picture of the Day?",
          options: [data.title, "Milky Way", "Mars Rover", "Hubble Deep Field"],
          answer: 0
        },
        {
          q: "What is the date of today's APOD?",
          options: [data.date, "2022-01-01", "2023-05-10", "2024-06-01"],
          answer: 0
        },
        {
          q: "Does the APOD explanation mention the word 'nebula'?",
          options: ["yes", "no"],
          answer: data.explanation.toLowerCase().includes('nebula') ? 0 : 1
        },
        {
          q: "Is the APOD media type an image?",
          options: ["yes", "no"],
          answer: data.media_type === "image" ? 0 : 1
        },
        {
          q: "Which NASA API is used for Astronomy Picture of the Day?",
          options: [
            "planetary/apod",
            "mars-photos/api/v1/rovers",
            "eonet/api/v3/events",
            "neo/rest/v1/feed"
          ],
          answer: 0
        },
        {
          q: "What is the main subject of today's APOD?",
          options: [
            data.title,
            "A planet",
            "A galaxy",
            "A comet"
          ],
          answer: 0
        }
      ];

      var quizQuestionsDiv = document.getElementById('quiz-questions');
      quizQuestionsDiv.innerHTML = '';
      questions.forEach(function (q, idx) {
        quizQuestionsDiv.innerHTML += `
              <div class="quiz-question">
                <label>${q.q}</label>
                <div class="quiz-options">
                  ${q.options.map((opt, i) =>
          `<label><input type="radio" name="q${idx}" value="${i}"> ${opt}</label>`
        ).join('<br>')}
                </div>
              </div>
            `;
      });

      document.getElementById('quiz-form').onsubmit = function (e) {
        e.preventDefault();
        var score = 0;
        questions.forEach(function (q, idx) {
          var radios = document.getElementsByName('q' + idx);
          var selected = -1;
          for (var r of radios) {
            if (r.checked) selected = parseInt(r.value);
          }
          if (selected === q.answer) score++;
        });
        document.getElementById('quiz-result').textContent =
          `You scored ${score} out of ${questions.length}.`;
      };
    });
});