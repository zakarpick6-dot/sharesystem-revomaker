// dashboard.html - owner login + upload / edit / delete
(function () {
  const $ = id => document.getElementById(id), MAX = 700000;
  let editId = null;
  async function api(action, o) {
    o = o || {};
    const init = { method: o.method || 'GET', headers: {} };
    if (o.body) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(o.body); }
    const r = await fetch('/api?action=' + action + (o.id ? '&id=' + o.id : ''), init);
    let d = null; try { d = await r.json(); } catch (e) { /* none */ }
    if (!r.ok) throw Object.assign(new Error((d && d.error) || 'Request failed'), { status: r.status });
    return d;
  }
  function el(t, c, x) { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  function say(t, k) { $('msg').textContent = t; $('msg').className = 'msg' + (k ? ' ' + k : ''); }
  function err(e) { if (e.status === 401) showLogin(); else say(e.message, 'err'); }
  function showLogin() { $('login').classList.remove('hide'); $('dash').classList.add('hide'); }
  function showDash() { $('login').classList.add('hide'); $('dash').classList.remove('hide'); load(); }

  async function load() {
    let files; try { files = await api('list'); } catch (e) { return err(e); }
    const box = $('list'); box.innerHTML = '';
    if (!files.length) { box.appendChild(el('div', 'empty', 'No files yet. Upload one above.')); return; }
    files.forEach(f => {
      const row = el('div', 'row'), nm = el('div'), b = el('b', null, f.name);
      nm.append(b, el('br'), el('small', null, f.size.toLocaleString() + ' chars · ' + f.updated));
      const btns = el('div', 'btns');
      const view = el('a', 'btn', 'View'); view.href = '/#' + f.id; view.target = '_blank'; view.rel = 'noopener';
      const link = el('button', 'btn', 'Copy link');
      link.onclick = async () => { try { await navigator.clipboard.writeText(location.origin + '/#' + f.id); say('Link copied.', 'ok'); } catch (e) { say('Copy failed.', 'err'); } };
      const ed = el('button', 'btn', 'Edit'); ed.onclick = () => openEdit(f.id);
      const del = el('button', 'btn del', 'Delete');
      del.onclick = async () => { if (!confirm('Delete "' + f.name + '"?')) return; try { await api('remove', { method: 'DELETE', id: f.id }); say('Deleted.', 'ok'); load(); } catch (e) { err(e); } };
      btns.append(view, link, ed, del); row.append(nm, btns); box.appendChild(row);
    });
  }
  async function upload(list) {
    let n = 0;
    for (const f of list) {
      if (f.size > MAX) { say('"' + f.name + '" is too big (max about 700 KB).', 'err'); continue; }
      try { await api('create', { method: 'POST', body: { name: f.name, text: await f.text() } }); n++; } catch (e) { return err(e); }
    }
    if (n) say(n + ' uploaded.', 'ok'); load();
  }
  async function openEdit(id) {
    editId = id;
    try { const f = await api('get', { id }); $('ename').value = f.name; $('etext').value = f.text; } catch (e) { return err(e); }
    $('ed').showModal();
  }
  $('eform').addEventListener('submit', async e => {
    e.preventDefault();
    try { await api('update', { method: 'PUT', id: editId, body: { name: $('ename').value, text: $('etext').value } }); $('ed').close(); say('Saved.', 'ok'); load(); } catch (x) { err(x); }
  });
  $('ecancel').onclick = () => $('ed').close();
  $('lform').addEventListener('submit', async e => {
    e.preventDefault(); $('lmsg').textContent = 'Checking…';
    try { await api('login', { method: 'POST', body: { username: $('user').value, password: $('pass').value } }); $('pass').value = ''; $('lmsg').textContent = ''; showDash(); }
    catch (x) { $('lmsg').textContent = x.message; $('pass').value = ''; }
  });
  $('logout').onclick = async () => { try { await api('logout', { method: 'POST' }); } catch (e) { /* ignore */ } showLogin(); };
  const drop = $('drop'), input = $('file');
  drop.onclick = () => input.click();
  input.onchange = () => { if (input.files.length) upload(Array.from(input.files)); input.value = ''; };
  drop.ondragover = e => e.preventDefault();
  drop.ondrop = e => { e.preventDefault(); upload(Array.from(e.dataTransfer.files)); };
  api('me').then(r => r.owner ? showDash() : showLogin()).catch(showLogin);
})();
