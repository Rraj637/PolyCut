/* Sample GIS Plugin — "Feature Reporter"
   Load karne ka tarika: Plugins section → "Load from URL" → /plugins/sample-reporter.js
   Ya is file ko download karke "Load Plugin (JS file)" se chuno. */
GISPlugin.register({
  id: 'sample-reporter',
  name: 'Feature Reporter',
  version: '1.0.0',
  author: 'GIS Tool',
  description: 'Digitized polygons ka total area report + map pe center markers drop karta hai.',
  tools: [
    {
      id: 'area-report',
      label: '📊 Area Report',
      run(ctx) {
        const feats = ctx.state.drawn.polys.features;
        if (!feats.length) {
          ctx.toast('Pehle GIS Tools se polygon draw karo.', true);
          return;
        }
        const total = feats.reduce((s, f) => s + (f.properties.area_m2 || ctx.turf.area(f)), 0);
        ctx.toast(`Total drawn area: ${Math.round(total).toLocaleString()} m² (${feats.length} polygons)`);
        ctx.status(`Area Report — ${feats.length} polygons, total ${Math.round(total).toLocaleString()} m².`);
      },
    },
    {
      id: 'drop-center-markers',
      label: '📍 Center Markers',
      run(ctx) {
        const feats = ctx.state.drawn.polys.features;
        if (!feats.length) {
          ctx.toast('Pehle GIS Tools se polygon draw karo.', true);
          return;
        }
        ctx.clearTemp();
        feats.forEach((f) => {
          const c = ctx.turf.center(f);
          L.marker([c.geometry.coordinates[1], c.geometry.coordinates[0]])
            .bindPopup(`${f.properties.name || 'polygon'}<br>${Math.round(f.properties.area_m2 || 0).toLocaleString()} m²`)
            .addTo(ctx.map);
        });
        ctx.status(`${feats.length} center markers drop ho gaye (page refresh pe hat jayenge).`);
      },
    },
    {
      id: 'length-report',
      label: '📏 Length Report',
      run(ctx) {
        const feats = ctx.state.drawn.lines.features;
        if (!feats.length) {
          ctx.toast('Pehle GIS Tools se line draw karo.', true);
          return;
        }
        const total = feats.reduce((s, f) => s + (f.properties.length_m || 0), 0);
        ctx.toast(`Total drawn length: ${(total / 1000).toFixed(3)} km (${feats.length} lines)`);
        ctx.status(`Length Report — ${feats.length} lines, total ${(total / 1000).toFixed(3)} km.`);
      },
    },
  ],
});
