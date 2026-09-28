# Data Visualisation Gallery

An interactive gallery of twelve data visualisations built with JavaScript and p5.js. The application loads local CSV datasets and presents different ways to explore trends, comparisons and relationships.

## Visualisations

| Visualisation | Main topic |
| --- | --- |
| Tech Diversity: Race | Company workforce composition |
| Tech Diversity: Gender | Workforce gender comparison |
| Pay Gap by Job: 2017 | Pay and workforce comparisons by occupation |
| Pay Gap: 1997–2017 | Change over time |
| Climate Change | Surface-temperature change |
| Waste by Category | Waste categories in the supplied Pakistan dataset |
| Monthly CO₂ Emissions | Monthly emissions in the supplied dataset |
| Study Hours vs Score | Study time and score relationships |
| Internet Users by Country | Country comparisons using a lollipop chart |
| Student Skill Radar | Skill values on a radar chart |
| Resting Heart Rate Trend | Time-series values with smoothing controls |
| Device Usage Streamgraph | Changes in device-use composition |

The data files are bundled coursework datasets. Some are small demonstration datasets; the gallery does not provide live statistics or independently verified research findings.

## Interaction

- Search the sidebar to filter visualisation names.
- Select a visualisation from the menu or use the left/right arrow keys.
- Hover over supported charts to inspect values.
- Use chart-specific controls for selections, ranges, sorting, smoothing or display modes where available.
- Press **S** to save a PNG of the current canvas.
- Press **T** to toggle the short guide, then **N/P** to move through its text prompts.

## Run locally

Use a current desktop browser and a local HTTP server so CSV files can load. With Python 3 installed, run this from the repository root:

```sh
python -m http.server 8000
```

Open [localhost:8000](http://localhost:8000), then select a chart from the sidebar. On Windows, the Python launcher also supports `py -m http.server 8000`.

The p5.js library is included in `lib/`. No npm installation or external API key is required.

## Project structure

- `index.html` and `style.css` define the page and sidebar.
- `sketch.js` registers the visualisations and shared keyboard controls.
- `gallery.js` manages chart selection and lifecycle.
- Individual chart files contain the rendering and interaction logic.
- `helper-functions.js` and `pie-chart.js` provide shared drawing utilities.
- `data/` contains CSV inputs and the source data files retained with the original project.

## Context and attribution

Developed by Faizan Ilyas for the University of London **Introduction to Programming II (CM1010)** final coursework.

The project extends the course's **Data Visualisation** case-study template. Its original five visualisation topics cover technology workforce diversity, pay gaps and climate change. This version also includes waste, CO₂, study-score, internet-use, student-skill, heart-rate and device-use charts, together with a searchable gallery and additional interactions. The original scaffold and datasets are part of the course material.

Built with [p5.js](https://p5js.org/). Library notices and the original dataset files are included.

## Scope

This is a coursework visualisation prototype. The charts use a fixed 1024 × 576 canvas and are best explored on a desktop browser. Chart controls differ by visualisation.
