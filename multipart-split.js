/* Built-in GIS Plugin — "Multipart Split"
   Har layer ke MultiPolygon / MultiLineString / MultiPoint features ko
   single-part features me todta hai (QGIS "Multipart to Singleparts" jaisa). */
GISPlugin.register({
  id: 'builtin-multipart-split',
  name: 'Multipart Split',
  version: '1.0.0',
  author: 'GIS Tool (built-in)',
  description: 'Splits MultiPolygon / MultiLineString / MultiPoint features into single-part features across every loaded layer (QGIS "Multipart to Singleparts" equivalent).',
  tools: [
    {
      id: 'split-multipart',
      label: '✂ Split Multipart Features',
      run(ctx) {
        const cols = ctx.editableCollections();
        let multiCount = 0, partCount = 0;
        cols.forEach((col) => {
          const out = [];
          col.fc.features.forEach((f) => {
            const t = f.geometry.type;
            if (t === 'MultiPolygon' || t === 'MultiLineString' || t === 'MultiPoint') {
              let parts;
              if (t === 'MultiPolygon') parts = f.geometry.coordinates.map((c) => ({ type: 'Polygon', coordinates: c }));
              else if (t === 'MultiLineString') parts = f.geometry.coordinates.map((c) => ({ type: 'LineString', coordinates: c }));
              else parts = f.geometry.coordinates.map((c) => ({ type: 'Point', coordinates: c }));
              parts.forEach((g, i) => {
                out.push({ type: 'Feature', geometry: g,
                           properties: { ...(f.properties || {}), part: i + 1, parts_total: parts.length } });
              });
              multiCount += 1;
              partCount += parts.length;
            } else {
              out.push(f);
            }
          });
          col.fc.features = out;
        });
        if (!multiCount) {
          ctx.toast('No multipart features found in any layer.', true);
          return;
        }
        ctx.pushHist();
        ctx.render();
        ctx.toast(`${multiCount} multipart feature(s) split into ${partCount} single-part features.`);
        ctx.status(`Multipart split — ${multiCount} multi-features → ${partCount} single parts. Undo available.`);
      },
    },
    {
      id: 'multipart-stats',
      label: '📊 Multipart Report',
      run(ctx) {
        const cols = ctx.editableCollections();
        const lines = [];
        cols.forEach((col) => {
          let multi = 0, single = 0;
          col.fc.features.forEach((f) => {
            if (f.geometry.type.indexOf('Multi') === 0) multi += 1; else single += 1;
          });
          if (col.fc.features.length) lines.push(`${col.label}: ${col.fc.features.length} features (${multi} multipart, ${single} single-part)`);
        });
        ctx.status(lines.length ? lines.join(' | ') : 'No editable layers loaded.');
        ctx.toast(lines.length ? lines.join(' | ') : 'No data.', !lines.length);
      },
    },
  ],
});
