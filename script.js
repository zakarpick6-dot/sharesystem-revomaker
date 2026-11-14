// index.html - shows the files to everyone
(function () {
  const app = document.getElementById('app');
  let list = [];
  async function api(action, id) { const r = await fetch('/api?action=' + action + (id ? '&id=' + id : '')); if (!r.ok) throw new Error('fail'); return r.json(); }
  function el(t, c, x) { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  async function copy(t, btn, label) { let ok = true; try { await navigator.clipboard.writeText(t); } catch (e) { ok = false; } btn.textContent = ok ? 'Copied!' : 'Copy failed'; setTimeout(() => { btn.textContent = label; }, 1500); }
  async function show() {
    app.innerHTML = '';
    if (!list.length) { app.appendChild(el('div', 'empty', 'Nothing here yet.')); return; }
    const h = location.hash.slice(1), id = (list.find(f => f.id === h) || list[0]).id;
    const chips = el('div', 'files');
    list.forEach(f => { const b = el('button', 'chip' + (f.id === id ? ' on' : ''), f.name); b.onclick = () => { location.hash = f.id; }; chips.appendChild(b); });
    app.appendChild(chips);
    const panel = el('div', 'glass'); app.appendChild(panel);
    let f; try { f = await api('get', id); } catch (e) { panel.appendChild(el('div', 'empty', 'File not available.')); return; }
    const bar = el('div', 'bar'), left = el('div');
    left.appendChild(el('h2', null, f.name)); left.appendChild(el('small', null, f.size.toLocaleString() + ' characters · ' + f.updated));
    const btns = el('div', 'btns'), cl = el('button', 'btn pri', 'Copy link'), ct = el('button', 'btn', 'Copy text');
    cl.onclick = () => copy(location.origin + '/#' + f.id, cl, 'Copy link'); ct.onclick = () => copy(f.text, ct, 'Copy text');
    btns.append(cl, ct); bar.append(left, btns); panel.append(bar, el('pre', null, f.text));
  }
  window.addEventListener('hashchange', show);
  api('list').then(l => { list = l; show(); }).catch(() => { app.appendChild(el('div', 'empty', 'Could not load files.')); });
})();
