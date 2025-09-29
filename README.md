# EarthLens: Citizen Science Dashboard

EarthLens is a modern, interactive web dashboard that empowers everyone to explore and understand our planet and universe using NASA's open data.  
Built for the NASA Space Apps Challenge 2025.

## Features

- **Rocket Launch Intro Animation:** Realistic themed rocket launch with fire and smoke, setting the tone for space exploration.
- **Home:** Daily NASA Astronomy Picture of the Day (APOD) and random NASA facts.
- **Dashboard:**  
  - Live natural event tracking (wildfires, storms, volcanoes, floods) via NASA EONET API  
  - Your location, temperature, and local time  
  - Air quality and soil quality (OpenAQ, Open-Meteo, SoilGrids APIs)  
  - Interactive world map of events  
  - Event statistics and charts (Chart.js)  
  - Latest NASA news (RSS feed)
- **Solar System:** Interactive solar system model with animated planets and info popups.
- **Study NASA:** Learn about NASA's history, achievements, and failures with curated content and external resources.
- **Quiz:** Dynamic NASA quiz generated from the APOD data.
- **About:** Project mission, features, and resource links.

## Technologies Used

- **HTML5, CSS3, JavaScript (ES6+)**
- **Leaflet.js** (interactive maps)
- **Chart.js** (charts)
- **NASA APIs:**  
  - [EONET](https://eonet.gsfc.nasa.gov/docs/v3)  
  - [APOD](https://api.nasa.gov/)  
  - [Breaking News RSS](https://www.nasa.gov/rss/dyn/breaking_news.rss)
- **OpenAQ** (air quality)
- **Open-Meteo** (weather, air quality)
- **SoilGrids** (soil data)
- **Responsive Design:** Mobile-friendly layout

## How It Works

1. **Rocket Launch Animation:**  
   On page load, a themed rocket launches with animated fire and smoke. The overlay fades out naturally, revealing the dashboard.

2. **Navigation:**  
   SPA navigation lets users switch between Home, Dashboard, Solar System, Study NASA, Quiz, and About sections.

3. **Live Data:**  
   - Natural events and map markers update from NASA EONET.
   - Location, weather, air and soil quality are fetched using browser geolocation and public APIs.
   - APOD image and explanation update daily.
   - NASA news is fetched from the official RSS feed.

4. **Solar System Model:**  
   Animated planets orbit the sun. Clicking a planet or the sun shows detailed info.

5. **Quiz:**  
   Questions are generated from the APOD data, with multiple-choice answers.

6. **Study NASA:**  
   Learn about NASA's journey, achievements, failures, and access curated external resources.

## References & Resources

- [NASA EONET API](https://eonet.gsfc.nasa.gov/docs/v3)
- [NASA Open APIs](https://api.nasa.gov/)
- [Astronomy Picture of the Day](https://apod.nasa.gov/apod/astropix.html)
- [NASA Breaking News RSS](https://www.nasa.gov/rss/dyn/breaking_news.rss)
- [OpenAQ API](https://docs.openaq.org/)
- [Open-Meteo API](https://open-meteo.com/)
- [SoilGrids REST API](https://soilgrids.org/)
- [Leaflet.js](https://leafletjs.com/)
- [Chart.js](https://www.chartjs.org/)
- [NASA Official Website](https://www.nasa.gov/)
- [NASA Science](https://science.nasa.gov/)
- [NASA Missions](https://www.nasa.gov/missions)
- [NASA Kids' Club](https://www.nasa.gov/kidsclub/index.html)

## Credits

- NASA for open data and APIs
- OpenAQ, Open-Meteo, SoilGrids for environmental data
- Leaflet.js and Chart.js for visualization
- Unsplash for background images
- All contributors to open APIs and resources

## License

This project is for educational and hackathon/demo purposes only.  
API keys used are for demo and may require registration for production use.

---

Made for NASA Space Apps Challenge 2025  
by AlphaBytes Team