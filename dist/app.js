/** Card Studio browser bundle. Source: src/*.ts */
(function(){
'use strict';
const factories={
"assets": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setTargetImageSet = setTargetImageSet;
exports.importImages = importImages;
const model_1 = require("./model");
const image_sets_1 = require("./image-sets");
const interface_1 = require("./interface");
const dom_1 = require("./dom");
let pendingAssetsSet = null;
function setTargetImageSet(id) { pendingAssetsSet = id; }
const blobImage = async (f) => await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result || "")); r.onerror = () => reject(Error('Could not read ' + f.name)); r.readAsDataURL(f); });
async function importImages(files) { if (!pendingAssetsSet)
    return; const set = model_1.S.sets.find(x => x.id === pendingAssetsSet); if (!set)
    return; const input = [...files].filter(f => f.type.startsWith('image/')).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })); try {
    for (const f of input) {
        const data = await blobImage(f);
        set.images.push({ name: f.name, data });
    }
    image_sets_1.imageCache.clear();
    (0, interface_1.repaint)();
    (0, dom_1.toast)(`Loaded ${input.length} image(s) into ${set.name}`);
}
catch (err) {
    alert(err.message);
} }

},
"dom": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonDownload = exports.download = exports.toast = exports.$$ = exports.$ = void 0;
// Browser and download helpers.
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
exports.$ = $, exports.$$ = $$;
let toastTimer;
const toast = msg => { const t = (0, exports.$)('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200); };
exports.toast = toast;
const download = (blob, name) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); };
exports.download = download;
const jsonDownload = (obj, name) => (0, exports.download)(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), name);
exports.jsonDownload = jsonDownload;

},
"editor": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const model_1 = require("./model");
const dom_1 = require("./dom");
const preview_1 = require("./preview");
const interface_1 = require("./interface");
const image_sets_1 = require("./image-sets");
const png_export_1 = require("./png-export");
const spreadsheet_1 = require("./spreadsheet");
const project_storage_1 = require("./project-storage");
const assets_1 = require("./assets");
(0, image_sets_1.setImageUpdateHandler)(preview_1.renderStage);
let elementClipboard = null;
// This is an internal element clipboard, independent of the system text clipboard.
function copyElement(cut = false) {
    if (model_1.S.mode !== 'template') {
        (0, dom_1.toast)('Switch to Template to copy or cut elements');
        return false;
    }
    const el = (0, model_1.templateEl)(model_1.S.selected);
    if (!el) {
        (0, dom_1.toast)('Select an element first');
        return false;
    }
    elementClipboard = { element: structuredClone(el), cut, project: model_1.S, pasteCount: 0 };
    if (cut) {
        model_1.S.template.elements = model_1.S.template.elements.filter(x => x.id !== el.id);
        model_1.S.selected = null;
        (0, interface_1.repaint)();
    }
    (0, dom_1.toast)(cut ? 'Element cut — paste to move it' : 'Element copied');
    return true;
}
function pasteElement() {
    if (model_1.S.mode !== 'template') {
        (0, dom_1.toast)('Switch to Template to paste elements');
        return false;
    }
    if (!elementClipboard) {
        (0, dom_1.toast)('Copy or cut an element first');
        return false;
    }
    const from = elementClipboard;
    const pasted = structuredClone(from.element);
    const isMove = from.cut && from.project === model_1.S &&
        !model_1.S.template.elements.some(e => e.id === pasted.id);
    if (!isMove) {
        pasted.id = (0, model_1.uid)();
        pasted.name = (0, model_1.uniqName)(pasted.name + ' copy');
    }
    else {
        pasted.name = (0, model_1.uniqName)(pasted.name);
    }
    const offset = 12 * (isMove ? 1 : ++from.pasteCount);
    pasted.x += offset;
    pasted.y += offset;
    model_1.S.template.elements.push(pasted);
    model_1.S.selected = pasted.id;
    if (isMove) {
        from.cut = false;
        from.element = structuredClone(pasted);
        from.pasteCount = 0;
    }
    (0, interface_1.repaint)();
    (0, dom_1.toast)(isMove ? 'Element moved' : 'Element pasted');
    return true;
}

function newCard(copy = null) { const c = copy ? { id: (0, model_1.uid)(), name: copy.name + ' copy', values: { ...copy.values }, overrides: structuredClone(copy.overrides || {}), extraElements: structuredClone(copy.extraElements || []) } : { id: (0, model_1.uid)(), name: 'Card ' + String(model_1.S.cards.length + 1).padStart(3, '0'), values: {}, overrides: {}, extraElements: [] }; model_1.S.cards.push(c); model_1.S.mode = 'cards'; model_1.S.cardIndex = model_1.S.cards.length - 1; model_1.S.selected = null; (0, interface_1.repaint)(); return c; }
function mutateAction(action, el = null) {
    switch (action) {
        case 'new-project':
            if (confirm('Start a new project? Unsaved changes will be lost.')) {
                (0, model_1.replaceState)((0, model_1.initial)());
                image_sets_1.imageCache.clear();
                (0, interface_1.repaint)();
            }
            break;
        case 'open-project':
            (0, dom_1.$)('#openProjectFile').click();
            break;
        case 'save-project':
            (0, project_storage_1.saveProject)();
            break;
        case 'save-template':
            (0, project_storage_1.saveTemplate)();
            break;
        case 'load-template':
            (0, dom_1.$)('#openTemplateFile').click();
            break;
        case 'mode-template':
        case 'card-setup':
            model_1.S.mode = 'template';
            model_1.S.selected = null;
            (0, interface_1.repaint)();
            break;
        case 'mode-cards':
            model_1.S.mode = 'cards';
            model_1.S.selected = null;
            (0, interface_1.repaint)();
            break;
        case 'add-text':
        case 'add-image':
        case 'add-shape':
            (0, interface_1.addElement)(action.slice(4));
            break;
        case 'copy-element':
            copyElement();
            break;
        case 'cut-element':
            copyElement(true);
            break;
        case 'paste-element':
            pasteElement();
            break;
        case 'delete-element':
            if (!model_1.S.selected)
                return;
            if (model_1.S.mode === 'cards') {
                if ((0, model_1.isExtra)(model_1.S.selected)) {
                    (0, model_1.card)().extraElements = (0, model_1.card)().extraElements.filter(x => x.id !== model_1.S.selected);
                }
                else
                    (0, interface_1.patchElement)(model_1.S.selected, { hidden: true });
                model_1.S.selected = null;
                (0, interface_1.repaint)();
                (0, dom_1.toast)('Removed from this card only');
            }
            else if (confirm('Delete this element from the template and all cards?')) {
                model_1.S.template.elements = model_1.S.template.elements.filter(x => x.id !== model_1.S.selected);
                model_1.S.selected = null;
                (0, interface_1.repaint)();
            }
            break;
        case 'layer-up':
        case 'layer-down': {
            if (model_1.S.mode === 'cards' && !(0, model_1.isExtra)(model_1.S.selected)) {
                (0, dom_1.toast)('Shared layer order is changed in Template mode');
                return;
            }
            const a = model_1.S.mode === 'cards' ? (0, model_1.card)().extraElements : model_1.S.template.elements;
            let ix = a.findIndex(e => e.id === model_1.S.selected), delta = action === 'layer-up' ? 1 : -1;
            if (ix < 0 || ix + delta < 0 || ix + delta >= a.length)
                return;
            [a[ix], a[ix + delta]] = [a[ix + delta], a[ix]];
            (0, interface_1.repaint)();
            break;
        }
        case 'zoom-in':
            model_1.S.zoom = (0, model_1.clamp)(Math.round((model_1.S.zoom + .1) * 100) / 100, .3, 3);
            (0, preview_1.renderStage)();
            break;
        case 'zoom-out':
            model_1.S.zoom = (0, model_1.clamp)(Math.round((model_1.S.zoom - .1) * 100) / 100, .3, 3);
            (0, preview_1.renderStage)();
            break;
        case 'add-set': {
            const name = prompt('Name this image set (e.g. Creature Artwork):');
            if (!name?.trim())
                return;
            const set = { id: (0, model_1.uid)(), name: name.trim(), images: [] };
            model_1.S.sets.push(set);
            (0, assets_1.setTargetImageSet)(set.id);
            (0, dom_1.$)('#assetFiles').click();
            (0, interface_1.repaint)();
            break;
        }
        case 'add-to-set':
            (0, assets_1.setTargetImageSet)(el.dataset.set);
            (0, dom_1.$)('#assetFiles').click();
            break;
        case 'remove-set': {
            const id = el.dataset.set, set = model_1.S.sets.find(x => x.id === id);
            if (set && confirm(`Remove image set "${set.name}" and its ${set.images.length} images?`)) {
                model_1.S.sets = model_1.S.sets.filter(x => x.id !== id);
                image_sets_1.imageCache.clear();
                (0, interface_1.repaint)();
            }
            break;
        }
        case 'add-card':
            newCard();
            break;
        case 'duplicate-card':
            newCard(model_1.S.cards[Number(el.dataset.cardindex)]);
            break;
        case 'delete-card':
            if (model_1.S.cards.length <= 1) {
                (0, dom_1.toast)('At least one card must remain');
                return;
            }
            if (confirm('Delete the selected card?')) {
                model_1.S.cards.splice(model_1.S.cardIndex, 1);
                (0, interface_1.chooseCard)(Math.min(model_1.S.cardIndex, model_1.S.cards.length - 1));
            }
            break;
        case 'reset-card':
            if ((0, model_1.card)() && confirm('Reset all element positions and styles for this card?')) {
                (0, model_1.card)().overrides = {};
                (0, model_1.card)().extraElements = [];
                (0, interface_1.repaint)();
            }
            break;
        case 'reset-element':
            if ((0, model_1.card)()) {
                if ((0, model_1.isExtra)(model_1.S.selected)) {
                    (0, model_1.card)().extraElements = (0, model_1.card)().extraElements.filter(e => e.id !== model_1.S.selected);
                    model_1.S.selected = null;
                }
                else
                    delete (0, model_1.card)().overrides[model_1.S.selected];
                (0, interface_1.repaint)();
            }
            break;
        case 'prev-card':
            (0, interface_1.chooseCard)(model_1.S.cardIndex - 1);
            break;
        case 'next-card':
            (0, interface_1.chooseCard)(model_1.S.cardIndex + 1);
            break;
        case 'export-sheet':
            (0, spreadsheet_1.exportXLSX)().catch(err => alert(err.message));
            break;
        case 'import-sheet':
            (0, dom_1.$)('#openSheetFile').click();
            break;
        case 'export-current':
            (0, png_export_1.exportPNG)();
            break;
        case 'export-all':
            (0, png_export_1.exportAll)();
            break;
        case 'scan-fonts':
            scanFonts();
            break;
    }
}
async function scanFonts() { if (!('queryLocalFonts' in window)) {
    alert('This browser does not provide installed-font listing. You can still type the name of any installed font in the Font family field. Chrome or Edge on desktop may support font listing.');
    return;
} try {
    const fonts = await window.queryLocalFonts(), names = [...new Set(fonts.map(f => f.family))].sort();
    (0, interface_1.setKnownFonts)([...new Set([...(0, interface_1.baseFonts)(), ...names])]);
    (0, interface_1.renderInspector)();
    (0, dom_1.toast)(`Found ${names.length} installed font families`);
}
catch (err) {
    alert('Font access was not granted. You can type an installed font name manually.');
} }
function handleProp(input) {
    const key = input.dataset.prop;
    if (!key)
        return;
    let v = input.type === 'checkbox' ? input.checked : input.value;
    if (key.startsWith('template.')) {
        const p = key.split('.')[1];
        if (p === 'unit') {
            const old = model_1.S.template.unit;
            model_1.S.template.width = Number((model_1.S.template.width * model_1.perUnit[old] / model_1.perUnit[v]).toFixed(4));
            model_1.S.template.height = Number((model_1.S.template.height * model_1.perUnit[old] / model_1.perUnit[v]).toFixed(4));
        }
        else if (['width', 'height', 'dpi'].includes(p))
            v = Number(v);
        if (p === 'width' || p === 'height')
            v = Math.max(.5, v || .5);
        model_1.S.template[p] = v;
        return;
    }
    if (key === 'projectName') {
        model_1.S.projectName = String(v);
        return;
    }
    if (key === 'card.name') {
        if ((0, model_1.card)())
            (0, model_1.card)().name = String(v) || 'Untitled card';
        return;
    }
    if (key === 'name') {
        const e = (0, model_1.templateEl)(model_1.S.selected);
        if (e)
            e.name = (0, model_1.uniqName)(v, e.id);
        return;
    }
    if (['x', 'y', 'w', 'h'].includes(key)) {
        v = (0, model_1.px)(Number(v), model_1.S.template.unit);
        if (key === 'w' || key === 'h')
            v = Math.max(1, v);
    }
    else if (['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'borderWidth', 'radius', 'opacity', 'gradientAngle', 'imgScale', 'imgOffsetX', 'imgOffsetY'].includes(key)) {
        v = Number(v);
        if (key === 'opacity')
            v = (0, model_1.clamp)(v, 0, 100);
        if (key === 'fontSize')
            v = Math.max(1, v);
        if (key === 'imgScale')
            v = Math.max(.01, v);
        if (key === 'borderWidth')
            v = Math.max(0, v);
    }
    if (model_1.S.selected)
        (0, interface_1.patchElement)(model_1.S.selected, { [key]: v });
}
(0, dom_1.$)('#inspector').addEventListener('input', event => { const inp = event.target; if (inp.dataset.cardvalue) {
    const c = (0, model_1.card)();
    if (c) {
        c.values ??= {};
        c.values[inp.dataset.cardvalue] = inp.value;
        (0, preview_1.renderStage)();
    }
    return;
} if (inp.dataset.prop) {
    handleProp(inp);
    (0, preview_1.renderStage)();
    (0, dom_1.$)('#projectTitle').textContent = model_1.S.projectName;
} });
(0, dom_1.$)('#inspector').addEventListener('change', event => { const inp = event.target; if (inp.dataset.cardvalue) {
    (0, interface_1.renderLeft)();
    return;
} if (inp.dataset.prop) {
    handleProp(inp);
    (0, interface_1.repaint)();
} });
function listenClick(e) { const actionEl = e.target.closest('[data-action]'); if (actionEl) {
    e.stopPropagation();
    mutateAction(actionEl.dataset.action, actionEl);
    return;
} const listRow = e.target.closest('[data-layer]'); if (listRow) {
    model_1.S.selected = listRow.dataset.layer;
    (0, interface_1.repaint)();
    return;
} const cardRow = e.target.closest('[data-cardindex]'); if (cardRow) {
    (0, interface_1.chooseCard)(Number(cardRow.dataset.cardindex));
    return;
} }
document.addEventListener('click', listenClick);
(0, dom_1.$)('#cardControl').addEventListener('change', e => { if (e.target.id === 'cardSelector')
    (0, interface_1.chooseCard)(Number(e.target.value)); });
(0, dom_1.$)('#openProjectFile').addEventListener('change', async (e) => { if (e.target.files[0])
    await (0, project_storage_1.openJSON)(e.target.files[0]); e.target.value = ''; });
(0, dom_1.$)('#openTemplateFile').addEventListener('change', async (e) => { if (e.target.files[0])
    await (0, project_storage_1.openJSON)(e.target.files[0], true); e.target.value = ''; });
(0, dom_1.$)('#openSheetFile').addEventListener('change', async (e) => { if (e.target.files[0])
    await (0, spreadsheet_1.readSheet)(e.target.files[0]); e.target.value = ''; });
(0, dom_1.$)('#assetFiles').addEventListener('change', async (e) => { if (e.target.files.length)
    await (0, assets_1.importImages)(e.target.files); e.target.value = ''; });
let drag = null;
function clearSelection() { if (model_1.S.selected === null)
    return; model_1.S.selected = null; (0, interface_1.renderInspector)(); (0, interface_1.renderLeft)(); (0, preview_1.renderStage)(); }
const stage = (0, dom_1.$)('#stage');
// The card may be entirely covered by elements. Click the workspace to clear selection.
(0, dom_1.$)('#canvasOuter').addEventListener('pointerdown', e => { if (e.button === 0 && !e.target.closest('#stage'))
    clearSelection(); });
stage.addEventListener('pointerdown', e => { if (e.button !== 0)
    return; const node = e.target.closest('.element'); if (!node) {
    clearSelection();
    return;
} const id = node.dataset.id; model_1.S.selected = id; (0, interface_1.renderInspector)(); (0, interface_1.renderLeft)(); const el = (0, model_1.effective)((0, model_1.templateEl)(id)); const resizing = !!e.target.closest('[data-handle="resize"]'); (0, preview_1.renderStage)(); if (el.locked)
    return; drag = { id, type: resizing ? 'resize' : 'move', initialX: e.clientX, initialY: e.clientY, x: el.x, y: el.y, w: el.w, h: el.h }; e.preventDefault(); });
document.addEventListener('pointermove', e => { if (!drag)
    return; const { w, h } = (0, model_1.sizePx)(), dx = (e.clientX - drag.initialX) / model_1.S.zoom, dy = (e.clientY - drag.initialY) / model_1.S.zoom; let patch; if (drag.type === 'resize')
    patch = { w: (0, model_1.clamp)(Math.round(drag.w + dx), 5, w * 3), h: (0, model_1.clamp)(Math.round(drag.h + dy), 5, h * 3) };
else
    patch = { x: Math.round((0, model_1.clamp)(drag.x + dx, -drag.w + 4, w - 4)), y: Math.round((0, model_1.clamp)(drag.y + dy, -drag.h + 4, h - 4)) }; (0, interface_1.patchElement)(drag.id, patch); (0, preview_1.renderStage)(); });
document.addEventListener('pointerup', () => { if (drag) {
    drag = null;
    (0, interface_1.renderInspector)();
    (0, interface_1.renderLeft)();
    (0, preview_1.renderStage)();
} });
document.addEventListener('keydown', e => { const active = document.activeElement, tag = active?.tagName;
if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || active?.isContentEditable)
    return;
if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && model_1.S.mode === 'template') {
    const action = { c: 'copy-element', x: 'cut-element', v: 'paste-element' }[e.key.toLowerCase()];
    if (action && ((action === 'paste-element' && elementClipboard) || (action !== 'paste-element' && model_1.S.selected))) {
        e.preventDefault();
        mutateAction(action);
        return;
    }
}
if (e.ctrlKey || e.altKey || e.metaKey)
    return;
if (!model_1.S.selected)
    return; if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    mutateAction('delete-element');
    return;
} const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (delta) {
    const el = (0, model_1.effective)((0, model_1.templateEl)(model_1.S.selected));
    if (el.locked)
        return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    (0, interface_1.patchElement)(model_1.S.selected, { x: el.x + delta[0] * step, y: el.y + delta[1] * step });
    (0, preview_1.renderStage)();
    (0, interface_1.renderInspector)();
} });
window.addEventListener('resize', () => { });
(0, interface_1.repaint)();

},
"image-sets": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getImageData = exports.getImageRef = exports.setImageUpdateHandler = exports.imageCache = void 0;
exports.cacheImage = cacheImage;
exports.loadedImage = loadedImage;
exports.imgBox = imgBox;
const model_1 = require("./model");
exports.imageCache = new Map();
let onImageLoaded = () => { };
const setImageUpdateHandler = (callback) => { onImageLoaded = callback; };
exports.setImageUpdateHandler = setImageUpdateHandler;
const getImageRef = (el, ci = model_1.S.cardIndex, mode = model_1.S.mode) => {
    if (el.kind !== 'image')
        return null;
    const c = mode === 'cards' ? model_1.S.cards[ci] : null, manual = c?.values?.[el.id];
    if (manual !== undefined && String(manual).trim() !== '') {
        if (String(manual).toLowerCase() === 'none')
            return null;
        const val = String(manual).replace(/\\/g, '/').toLowerCase();
        const all = model_1.S.sets.flatMap(set => set.images.map(im => ({ set, im })));
        const found = all.find(x => `${x.set.name}/${x.im.name}`.toLowerCase() === val) || all.find(x => x.im.name.toLowerCase() === val) || all.find(x => x.im.name.toLowerCase().replace(/\.[^.]+$/, '') === val);
        return found?.im || null;
    }
    if (!el.autoSet)
        return null;
    const set = model_1.S.sets.find(x => x.id === el.autoSet || x.name === el.autoSet);
    if (!set?.images.length)
        return null;
    let idx = mode === 'cards' ? ci : 0;
    if (el.autoMode === 'sequence' && idx >= set.images.length)
        return null;
    if (el.autoMode === 'random')
        idx = Math.abs((ci * 2654435761 + el.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) | 0) % set.images.length;
    return set.images[idx % set.images.length];
};
exports.getImageRef = getImageRef;
const getImageData = (e, ci, mode) => (0, exports.getImageRef)(e, ci, mode)?.data || null;
exports.getImageData = getImageData;
function cacheImage(src) { if (!src)
    return null; if (exports.imageCache.has(src))
    return exports.imageCache.get(src); const im = new Image(); const item = { im, loaded: false, error: false }; exports.imageCache.set(src, item); im.onload = () => { item.loaded = true; onImageLoaded(); }; im.onerror = () => { item.error = true; }; im.src = src; return item; }
async function loadedImage(src) { const o = cacheImage(src); if (!o)
    return null; if (o.loaded)
    return o.im; if (o.error)
    return null; return await new Promise(resolve => { const im = o.im; im.addEventListener('load', () => resolve(im), { once: true }); im.addEventListener('error', () => resolve(null), { once: true }); }); }
function imgBox(e, img) {
    let w = e.w, h = e.h, x = 0, y = 0;
    const iw = img?.naturalWidth || e.w, ih = img?.naturalHeight || e.h;
    let ratio = 1;
    switch (e.imageFit) {
        case 'contain':
            ratio = Math.min(e.w / iw, e.h / ih);
            break;
        case 'width':
            ratio = e.w / iw;
            break;
        case 'height':
            ratio = e.h / ih;
            break;
        case 'cover':
            ratio = Math.max(e.w / iw, e.h / ih);
            break;
        case 'stretch': return { x: e.imgOffsetX || 0, y: e.imgOffsetY || 0, w: e.w, h: e.h };
        case 'free':
            ratio = e.imgScale || 1;
            break;
        default: ratio = Math.max(e.w / iw, e.h / ih);
    }
    w = iw * ratio;
    h = ih * ratio;
    x = (e.w - w) / 2 + (Number(e.imgOffsetX) || 0);
    y = (e.h - h) / 2 + (Number(e.imgOffsetY) || 0);
    return { x, y, w, h };
}

},
"interface": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderCardControl = renderCardControl;
exports.renderLeft = renderLeft;
exports.renderInspector = renderInspector;
exports.repaint = repaint;
exports.patchElement = patchElement;
exports.chooseCard = chooseCard;
exports.addElement = addElement;
exports.setKnownFonts = setKnownFonts;
exports.baseFonts = baseFonts;
const model_1 = require("./model");
const dom_1 = require("./dom");
const preview_1 = require("./preview");
function renderCardControl() { const cc = (0, dom_1.$)('#cardControl'); cc.style.display = model_1.S.mode === 'cards' ? 'flex' : 'none'; if (model_1.S.mode !== 'cards')
    return; cc.innerHTML = `<span style="font-weight:700;color:#62778f">CARD</span><button data-action="prev-card" title="Previous card">‹</button><select id="cardSelector">${model_1.S.cards.map((c, i) => `<option value="${i}" ${i === model_1.S.cardIndex ? 'selected' : ''}>${(0, model_1.escapeHTML)(c.name)}</option>`).join('')}</select><button data-action="next-card" title="Next card">›</button><span style="color:#8a98a9;margin-left:auto">${model_1.S.cardIndex + 1} / ${model_1.S.cards.length}</span>`; }
function renderLeft() {
    const v = (0, dom_1.$)('#leftBody');
    (0, dom_1.$)('#btnTemplate').classList.toggle('active', model_1.S.mode === 'template');
    (0, dom_1.$)('#btnCards').classList.toggle('active', model_1.S.mode === 'cards');
    let out = '';
    if (model_1.S.mode === 'cards') {
        out += `<div class="side-head"><h2>STAGED CARDS</h2><button data-action="add-card">＋ Add card</button></div>`;
        out += '<div class="card-list">' + model_1.S.cards.map((c, i) => `<div class="card-row ${i === model_1.S.cardIndex ? 'active' : ''}" data-cardindex="${i}"><span class="mini-art">${String(i + 1).padStart(2, '0')}</span><span class="name">${(0, model_1.escapeHTML)(c.name)}<span class="sub">${Object.keys(c.overrides || {}).length ? 'Custom layout' : 'Template layout'}</span></span><button class="small-btn" data-action="duplicate-card" data-cardindex="${i}" title="Duplicate card">⧉</button></div>`).join('') + '</div>';
        out += `<div class="actionbar"><button class="secondary" data-action="delete-card">Delete card</button><button class="secondary" data-action="reset-card">Reset layout edits</button></div><div class="rule"></div>`;
    }
    out += `<div class="side-head"><h2>LAYERS</h2><span class="pill">${(0, model_1.layerEls)().length}</span></div><div class="small">Topmost layers are shown first. Select an element to edit it.</div>`;
    out += '<div class="layer-list">' + [...(0, model_1.layerEls)()].reverse().map(e => `<div class="layer-row ${e.id === model_1.S.selected ? 'active' : ''}" data-layer="${e.id}"><span style="font-size:15px;color:#7b91ad">${e.kind === 'text' ? 'T' : e.kind === 'image' ? '▧' : '◇'}</span><span class="name">${(0, model_1.escapeHTML)(e.name)}<span class="sub">${e.kind}${e.locked ? ' · locked' : ''}</span></span></div>`).join('') + '</div>';
    out += `<div class="rule"></div><div class="side-head"><h2>IMAGE SETS</h2><button data-action="add-set">＋ Load set</button></div><div class="small">Load multiple images as one set. Assign the set to an image frame, then choose sequential, cycling or random assignment.</div>`;
    out += '<div class="set-list">' + model_1.S.sets.map(set => `<div class="asset-row"><div class="asset-title"><span>▧</span><span style="overflow:hidden;text-overflow:ellipsis">${(0, model_1.escapeHTML)(set.name)}</span><span class="count">${set.images.length} files</span></div><div class="asset-thumbs">${set.images.slice(0, 6).map(x => `<img alt="${(0, model_1.escapeHTML)(x.name)}" title="${(0, model_1.escapeHTML)(x.name)}" src="${x.data}">`).join('')}</div><div class="asset-actions"><button data-action="add-to-set" data-set="${set.id}">＋ Images</button><button data-action="remove-set" data-set="${set.id}">Remove</button></div></div>`).join('') + '</div>';
    v.innerHTML = out;
}
function field(label, key, value, type = 'text', extra = '') { return `<div class="field"><label>${(0, model_1.escapeHTML)(label)}</label><input data-prop="${key}" type="${type}" value="${(0, model_1.escapeHTML)(value)}" ${extra}></div>`; }
function selectionField(label, key, items, value) { return `<div class="field"><label>${(0, model_1.escapeHTML)(label)}</label><select data-prop="${key}">${items.map(([v, l]) => `<option value="${(0, model_1.escapeHTML)(v)}" ${String(v) === String(value) ? 'selected' : ''}>${(0, model_1.escapeHTML)(l)}</option>`).join('')}</select></div>`; }
function checkbox(label, key, value) { return `<label class="toggle-line"><input type="checkbox" data-prop="${key}" ${value ? 'checked' : ''}>${(0, model_1.escapeHTML)(label)}</label>`; }
const fontOptions = ['Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS', 'Courier New', 'Garamond', 'Georgia', 'Helvetica', 'Impact', 'Palatino Linotype', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
let knownFonts = [...fontOptions];
function renderInspector() {
    const box = (0, dom_1.$)('#inspector');
    if (!model_1.S.selected && model_1.S.mode === 'cards') {
        (0, dom_1.$)('#rightTitle').textContent = 'Card data';
        let out = `<div class="inspector-heading">${(0, model_1.escapeHTML)((0, model_1.card)()?.name)}</div><div class="inspector-sub">Card ${model_1.S.cardIndex + 1} of ${model_1.S.cards.length} · Spreadsheet values</div>${field('Card name', 'card.name', (0, model_1.card)()?.name || '')}`;
        const entries = model_1.S.template.elements.filter(e => model_1.textKinds.includes(e.kind));
        out += `<div class="section-title">Element values</div><div class="small" style="padding:0 0 14px">These fields change only this card. Select a layer to adjust its position or formatting.</div>`;
        for (const e of entries) {
            if (e.kind === 'text')
                out += `<div class="field"><label>${(0, model_1.escapeHTML)(e.name)}</label><textarea data-cardvalue="${e.id}" style="min-height:62px">${(0, model_1.escapeHTML)((0, model_1.actualValue)(e))}</textarea></div>`;
            else
                out += `<div class="field"><label>${(0, model_1.escapeHTML)(e.name)} — image filename</label><input data-cardvalue="${e.id}" value="${(0, model_1.escapeHTML)((0, model_1.card)()?.values?.[e.id] || '')}" placeholder="Blank = automatic" list="allImageFiles"></div>`;
        }
        out += `<datalist id="allImageFiles">${model_1.S.sets.flatMap(set => set.images.map(im => `<option value="${(0, model_1.escapeHTML)(set.name + '/' + im.name)}"></option>`)).join('')}</datalist>`;
        box.innerHTML = out;
        return;
    }
    if (!model_1.S.selected) {
        (0, dom_1.$)('#rightTitle').textContent = 'Card setup';
        box.innerHTML = `<div class="inspector-heading">${(0, model_1.escapeHTML)(model_1.S.template.name)}</div><div class="inspector-sub">Card dimensions & export options</div>
 ${field('Template name', 'template.name', model_1.S.template.name)}
 <div class="fields-two">${field('Width', 'template.width', model_1.S.template.width, 'number', 'min="1" step="0.1"')}${field('Height', 'template.height', model_1.S.template.height, 'number', 'min="1" step="0.1"')}</div>
 ${selectionField('Units', 'template.unit', [['mm', 'Millimetres (mm)'], ['in', 'Inches (in)'], ['px', 'Pixels (px)']], model_1.S.template.unit)}
 ${selectionField('PNG resolution', 'template.dpi', [[150, '150 DPI'], [300, '300 DPI'], [450, '450 DPI'], [600, '600 DPI']], model_1.S.template.dpi)}
 ${field('Background colour', 'template.background', model_1.S.template.background, 'color')}
 <div class="rule"></div><div class="section-title">Project</div>${field('Project name', 'projectName', model_1.S.projectName)}
 <div class="small" style="padding:0">Select a layer or click an element on the card to change its properties. Use the Cards tab to edit a single card independently.</div>`;
        return;
    }
    const raw = (0, model_1.templateEl)(model_1.S.selected);
    if (!raw) {
        model_1.S.selected = null;
        return renderInspector();
    }
    ;
    const e = (0, model_1.effective)(raw);
    (0, dom_1.$)('#rightTitle').textContent = 'Element properties';
    let html = `<div class="inspector-heading">${(0, model_1.escapeHTML)(raw.name)}</div><div class="inspector-sub">${(0, model_1.escapeHTML)(raw.kind.toUpperCase())} ${model_1.S.mode === 'cards' ? '· Card-only changes' : '· Template-wide changes'}</div>`;
    if (model_1.S.mode === 'template')
        html += field('Element name (spreadsheet column)', 'name', raw.name);
    else
        html += `<div class="warn">Changes here affect only <b>${(0, model_1.escapeHTML)((0, model_1.card)()?.name)}</b>. Switch to Template to edit every card.</div>`;
    if (model_1.S.mode === 'cards' && model_1.textKinds.includes(raw.kind)) {
        if (raw.kind === 'text')
            html += `<div class="field"><label>Card text</label><textarea data-cardvalue="${raw.id}">${(0, model_1.escapeHTML)((0, model_1.actualValue)(raw))}</textarea></div>`;
        if (raw.kind === 'image')
            html += `<div class="field"><label>Image filename (blank = automatic)</label><input data-cardvalue="${raw.id}" value="${(0, model_1.escapeHTML)((0, model_1.card)()?.values?.[raw.id] || '')}" list="imageFiles" placeholder="Set name/image.png"><datalist id="imageFiles">${model_1.S.sets.flatMap(s => s.images.map(im => `<option value="${(0, model_1.escapeHTML)(s.name + '/' + im.name)}"></option>`)).join('')}</datalist></div><div class="small" style="padding:0 0 10px">Enter <b>none</b> to leave this frame empty.</div>`;
    }
    html += `<div class="section-title">Position and size (${model_1.S.template.unit})</div><div class="fields-two">${field('X', 'x', (0, model_1.fmt)(e.x / model_1.perUnit[model_1.S.template.unit]), 'number', 'step="0.1"')}${field('Y', 'y', (0, model_1.fmt)(e.y / model_1.perUnit[model_1.S.template.unit]), 'number', 'step="0.1"')}${field('Width', 'w', (0, model_1.fmt)(e.w / model_1.perUnit[model_1.S.template.unit]), 'number', 'min="0.1" step="0.1"')}${field('Height', 'h', (0, model_1.fmt)(e.h / model_1.perUnit[model_1.S.template.unit]), 'number', 'min="0.1" step="0.1"')}</div>`;
    html += checkbox('Hide element', 'hidden', e.hidden) + checkbox('Lock position', 'locked', e.locked);
    if (raw.kind === 'text') {
        if (model_1.S.mode === 'template')
            html += `<div class="field"><label>Default text</label><textarea data-prop="text">${(0, model_1.escapeHTML)(e.text)}</textarea></div>`;
        html += `<div class="section-title">Typography</div>`;
        html += `<div class="field"><label>Font family</label><input data-prop="font" list="fontOptions" value="${(0, model_1.escapeHTML)(e.font)}"><datalist id="fontOptions">${knownFonts.map(x => `<option value="${(0, model_1.escapeHTML)(x)}"></option>`).join('')}</datalist></div><button class="secondary" style="margin:-4px 0 12px" data-action="scan-fonts">Find installed fonts</button>`;
        html += `<div class="fields-two">${field('Font size (pt)', 'fontSize', e.fontSize, 'number', 'min="1" step="0.5"')}${selectionField('Weight', 'fontWeight', [[100, 'Thin'], [300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'Extra bold'], [900, 'Black']], e.fontWeight)}</div>`;
        html += checkbox('Italic', 'italic', e.italic) + checkbox('Underline', 'underline', e.underline);
        html += `<div class="fields-two">${selectionField('Horizontal', 'align', [['left', 'Left'], ['center', 'Center'], ['right', 'Right']], e.align)}${selectionField('Vertical', 'valign', [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']], e.valign)}${field('Line height', 'lineHeight', e.lineHeight, 'number', 'min="0.5" max="4" step="0.05"')}${field('Letter spacing (px)', 'letterSpacing', e.letterSpacing, 'number', 'step="0.2"')}</div>${field('Text colour', 'color', e.color, 'color')}`;
    }
    if (raw.kind === 'image') {
        html += `<div class="section-title">Image options</div>`;
        html += selectionField('Fit inside frame', 'imageFit', [['cover', 'Cover frame (crop)'], ['contain', 'Fit whole image'], ['width', 'Fit to frame width'], ['height', 'Fit to frame height'], ['stretch', 'Stretch to frame'], ['free', 'Free / original size']], e.imageFit);
        html += `<div class="fields-two">${field('Free resize scale', 'imgScale', e.imgScale, 'number', 'min="0.01" step="0.1"')}${field('Offset X (px)', 'imgOffsetX', e.imgOffsetX, 'number', 'step="1"')}${field('Offset Y (px)', 'imgOffsetY', e.imgOffsetY, 'number', 'step="1"')}</div>`;
        if (model_1.S.mode === 'template')
            html += `${selectionField('Automatically use image set', 'autoSet', [['', 'None'], ...model_1.S.sets.map(x => [x.id, x.name])], e.autoSet)}${selectionField('Image assignment', 'autoMode', [['sequence', 'Sequential (no repeat)'], ['cycle', 'Cycle through set'], ['random', 'Deterministic random']], e.autoMode)}`;
    }
    if (raw.kind === 'shape')
        html += `<div class="section-title">Shape</div>${selectionField('Shape', 'shape', [['rect', 'Rectangle'], ['ellipse', 'Ellipse']], e.shape)}`;
    html += `<div class="section-title">Appearance</div>${selectionField('Fill', 'fillMode', [['none', 'Transparent'], ['solid', 'Solid colour'], ['gradient', 'Linear gradient']], e.fillMode)}`;
    if (e.fillMode !== 'none')
        html += `<div class="fields-two">${field('Fill colour 1', 'fill1', e.fill1, 'color')}${e.fillMode === 'gradient' ? field('Fill colour 2', 'fill2', e.fill2, 'color') : ''}</div>${e.fillMode === 'gradient' ? field('Gradient angle (degrees)', 'gradientAngle', e.gradientAngle, 'number', 'step="5"') : ''}`;
    html += `<div class="fields-two">${field('Border thickness (px)', 'borderWidth', e.borderWidth, 'number', 'min="0" step="0.5"')}${field('Border colour', 'borderColor', e.borderColor, 'color')}</div>`;
    if (e.shape !== 'ellipse')
        html += field('Corner radius (px)', 'radius', e.radius, 'number', 'min="0" step="1"');
    html += field('Opacity (%)', 'opacity', e.opacity, 'number', 'min="0" max="100" step="5"');
    if (model_1.S.mode === 'cards')
        html += `<div class="inspector-action"><button class="secondary" data-action="reset-element">${(0, model_1.isExtra)(raw.id) ? 'Remove card-only element' : 'Reset this element to template'}</button></div>`;
    box.innerHTML = html;
}
function repaint(all = true) { if (all) {
    renderLeft();
    renderCardControl();
    renderInspector();
} (0, preview_1.renderStage)(); (0, dom_1.$)('#projectTitle').textContent = model_1.S.projectName; }
function patchElement(id, patch) { if (model_1.S.mode === 'cards') {
    const c = (0, model_1.card)();
    if (!c)
        return;
    if ((0, model_1.isExtra)(id))
        Object.assign(c.extraElements.find(e => e.id === id), patch);
    else {
        c.overrides ??= {};
        c.overrides[id] = { ...(c.overrides[id] || {}), ...patch };
    }
}
else
    Object.assign((0, model_1.templateEl)(id), patch); }
function chooseCard(i) { model_1.S.cardIndex = (0, model_1.clamp)(i, 0, model_1.S.cards.length - 1); model_1.S.selected = null; repaint(); }
function addElement(kind) { const { w, h } = (0, model_1.sizePx)(), n = model_1.S.template.elements.filter(e => e.kind === kind).length + 1; const e = (0, model_1.makeElement)(kind, { name: (0, model_1.uniqName)(kind === 'text' ? `Text ${n}` : kind === 'image' ? `Image ${n}` : `Shape ${n}`), x: Math.round(w * .15), y: Math.round(h * .15), w: Math.round(w * .7), h: kind === 'image' ? Math.round(h * .38) : kind === 'shape' ? Math.round(h * .17) : 65, text: 'New text', fontSize: 18 }); if (model_1.S.mode === 'cards') {
    (0, model_1.card)().extraElements ??= [];
    (0, model_1.card)().extraElements.push(e);
}
else
    model_1.S.template.elements.push(e); model_1.S.selected = e.id; repaint(); }
function setKnownFonts(fonts) { knownFonts = fonts; }
function baseFonts() { return fontOptions; }

},
"main": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Entry point. Importing the editor registers the UI event listeners.
require("./editor");

},
"model": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uniqName = exports.actualValue = exports.effective = exports.isExtra = exports.layerEls = exports.templateEl = exports.card = exports.S = exports.initial = exports.initialElements = exports.makeElement = exports.textKinds = exports.fmt = exports.sizePx = exports.px = exports.perUnit = exports.clamp = exports.safeFile = exports.escapeXML = exports.escapeHTML = exports.uid = void 0;
exports.replaceState = replaceState;
const uid = () => Math.random().toString(36).slice(2, 10);
exports.uid = uid;
const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
exports.escapeHTML = escapeHTML;
const escapeXML = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
exports.escapeXML = escapeXML;
const safeFile = s => String(s || 'card').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim().slice(0, 95) || 'card';
exports.safeFile = safeFile;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
exports.clamp = clamp;
exports.perUnit = { mm: 96 / 25.4, in: 96, px: 1 };
const px = (value, unit = 'mm') => Number(value || 0) * exports.perUnit[unit];
exports.px = px;
const sizePx = () => ({ w: (0, exports.px)(exports.S.template.width, exports.S.template.unit), h: (0, exports.px)(exports.S.template.height, exports.S.template.unit) });
exports.sizePx = sizePx;
const fmt = v => String(Math.round(v * 100) / 100);
exports.fmt = fmt;
exports.textKinds = ['text', 'image'];
const makeElement = (kind, parts = {}) => ({ id: (0, exports.uid)(), kind, name: kind === 'text' ? 'Text' : kind === 'image' ? 'Artwork' : 'Shape', x: 22, y: 35, w: 195, h: 55, locked: false, hidden: false, shape: 'rect', radius: 0, fillMode: kind === 'shape' ? 'solid' : 'none', fill1: '#ffffff', fill2: '#dde5f1', gradientAngle: 90, borderWidth: 0, borderColor: '#233b58', opacity: 100, text: 'Text', font: 'Georgia', fontSize: 19, fontWeight: 400, italic: false, underline: false, color: '#152b43', align: 'left', valign: 'middle', lineHeight: 1.18, letterSpacing: 0, imageFit: 'cover', imgScale: 1, imgOffsetX: 0, imgOffsetY: 0, autoSet: '', autoMode: 'cycle', ...parts });
exports.makeElement = makeElement;
const initialElements = () => [
    (0, exports.makeElement)('shape', { name: 'Card background', x: 0, y: 0, w: (0, exports.px)(63, 'mm'), h: (0, exports.px)(88, 'mm'), fillMode: 'gradient', fill1: '#fcfaf4', fill2: '#dce7ed', gradientAngle: 180 }),
    (0, exports.makeElement)('shape', { name: 'Artwork surround', x: 8, y: 42, w: 222, h: 169, fillMode: 'solid', fill1: '#fdfdfc', borderWidth: 1.5, borderColor: '#6c8297' }),
    (0, exports.makeElement)('image', { name: 'Artwork', x: 12, y: 46, w: 214, h: 161, imageFit: 'cover', borderWidth: 0 }),
    (0, exports.makeElement)('text', { name: 'Card Title', x: 13, y: 9, w: 213, h: 32, text: 'THE HOLLOW GATE', font: 'Georgia', fontSize: 16, fontWeight: 700, align: 'center', color: '#1b3852' }),
    (0, exports.makeElement)('shape', { name: 'Text panel', x: 8, y: 217, w: 222, h: 103, fillMode: 'solid', fill1: '#fdfcf8', borderWidth: 1, borderColor: '#8da0af', radius: 6 }),
    (0, exports.makeElement)('text', { name: 'Description', x: 18, y: 223, w: 201, h: 83, text: 'Beyond the old stones, the road descends into darkness.', font: 'Georgia', fontSize: 11, fontWeight: 400, valign: 'top', color: '#324358', lineHeight: 1.3 })
];
exports.initialElements = initialElements;
const initial = () => ({ type: 'cardstudio-project', version: 1, projectName: 'Untitled deck', template: { name: 'Standard game card', width: 63, height: 88, unit: 'mm', dpi: 300, background: '#ffffff', elements: (0, exports.initialElements)() }, sets: [], cards: [{ id: (0, exports.uid)(), name: 'Card 001', values: {}, overrides: {}, extraElements: [] }], mode: 'template', cardIndex: 0, selected: null, zoom: 1.55 });
exports.initial = initial;
exports.S = (0, exports.initial)();
function replaceState(value) { exports.S = value; }
const card = () => exports.S.cards[exports.S.cardIndex] || null;
exports.card = card;
const templateEl = (id) => exports.S.template.elements.find(e => e.id === id) || (exports.S.mode === 'cards' ? (0, exports.card)()?.extraElements?.find(e => e.id === id) : null);
exports.templateEl = templateEl;
const layerEls = () => [...exports.S.template.elements, ...(exports.S.mode === 'cards' ? ((0, exports.card)()?.extraElements || []) : [])];
exports.layerEls = layerEls;
const isExtra = (id) => !!(0, exports.card)()?.extraElements?.some(e => e.id === id);
exports.isExtra = isExtra;
const effective = (e) => exports.S.mode === 'cards' && (0, exports.card)() && !(0, exports.isExtra)(e.id) ? { ...e, ...((0, exports.card)().overrides?.[e.id] || {}) } : e;
exports.effective = effective;
const actualValue = (e) => exports.S.mode === 'cards' && (0, exports.card)() && Object.prototype.hasOwnProperty.call((0, exports.card)().values || {}, e.id) ? (0, exports.card)().values[e.id] : (e.kind === 'text' ? e.text : '');
exports.actualValue = actualValue;
const uniqName = (name, exclude) => { let base = String(name || 'Element').trim() || 'Element', str = base, n = 2; while ((0, exports.layerEls)().some(x => x.id !== exclude && x.name.toLowerCase() === str.toLowerCase()))
    str = base + ' ' + n++; return str; };
exports.uniqName = uniqName;

},
"png-export": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportPNG = exportPNG;
exports.exportAll = exportAll;
const model_1 = require("./model");
const dom_1 = require("./dom");
const png_renderer_1 = require("./png-renderer");
const toBlob = cvs => new Promise(resolve => cvs.toBlob(resolve, 'image/png'));
async function exportPNG() { try {
    const ci = model_1.S.cardIndex, cvs = await (0, png_renderer_1.canvasCard)(ci, model_1.S.mode === 'cards' ? 'cards' : 'template'), blob = await toBlob(cvs);
    if (!blob)
        throw Error('Could not create PNG');
    (0, dom_1.download)(blob, (0, model_1.safeFile)(model_1.S.mode === 'cards' ? (0, model_1.card)().name : model_1.S.template.name) + '.png');
    (0, dom_1.toast)('PNG exported at ' + model_1.S.template.dpi + ' DPI');
}
catch (err) {
    alert('PNG export failed: ' + err.message);
} }
async function exportAll() { if (!model_1.S.cards.length) {
    (0, dom_1.toast)('No cards staged');
    return;
} const b = (0, dom_1.$)('[data-action="export-all"]'), previous = b.textContent; b.disabled = true; try {
    const zip = new JSZip();
    const used = {};
    for (let i = 0; i < model_1.S.cards.length; i++) {
        b.textContent = `Exporting ${i + 1}/${model_1.S.cards.length}`;
        const cvs = await (0, png_renderer_1.canvasCard)(i, 'cards'), blob = await toBlob(cvs);
        if (!blob)
            throw Error('PNG generation failed');
        let name = (0, model_1.safeFile)(model_1.S.cards[i].name), suffix = 1;
        while (used[name.toLowerCase()])
            name = (0, model_1.safeFile)(model_1.S.cards[i].name) + '_' + (++suffix);
        used[name.toLowerCase()] = true;
        zip.file(name + '.png', blob);
        if (i % 3 === 2)
            await new Promise(r => setTimeout(r, 0));
    }
    b.textContent = 'Creating ZIP…';
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 4 } });
    (0, dom_1.download)(blob, (0, model_1.safeFile)(model_1.S.projectName) + '_cards.zip');
    (0, dom_1.toast)('Exported ' + model_1.S.cards.length + ' cards to ZIP');
}
catch (err) {
    alert('Batch export failed: ' + err.message);
}
finally {
    b.textContent = previous;
    b.disabled = false;
} }

},
"png-renderer": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canvasCard = canvasCard;
const model_1 = require("./model");
const image_sets_1 = require("./image-sets");
function fillCanvas(ctx, e, x, y, w, h) { if (e.fillMode === 'none')
    return; ctx.save(); if (e.fillMode === 'solid')
    ctx.fillStyle = e.fill1;
else {
    const a = (Number(e.gradientAngle) - 90) * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), extent = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
    const g = ctx.createLinearGradient(x + w / 2 - dx * extent, y + h / 2 - dy * extent, x + w / 2 + dx * extent, y + h / 2 + dy * extent);
    g.addColorStop(0, e.fill1);
    g.addColorStop(1, e.fill2);
    ctx.fillStyle = g;
} ctx.fillRect(x, y, w, h); ctx.restore(); }
function makeShapePath(ctx, e) { ctx.beginPath(); if (e.shape === 'ellipse')
    ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, e.h / 2, 0, 0, 2 * Math.PI);
else if (e.radius > 0 && ctx.roundRect)
    ctx.roundRect(e.x, e.y, e.w, e.h, Math.min(e.radius, e.w / 2, e.h / 2));
else
    ctx.rect(e.x, e.y, e.w, e.h); }
function canvasFillShape(ctx, e) { ctx.save(); makeShapePath(ctx, e); ctx.clip(); fillCanvas(ctx, e, e.x, e.y, e.w, e.h); ctx.restore(); }
function wrapText(ctx, value, maxWidth) { let lines = []; for (const para of String(value ?? '').split('\n')) {
    if (!para) {
        lines.push('');
        continue;
    }
    let line = '';
    for (const word of para.split(/\s+/)) {
        if (ctx.measureText(word).width > maxWidth) {
            if (line) {
                lines.push(line);
                line = '';
            }
            let part = '';
            for (const ch of [...word]) {
                if (ctx.measureText(part + ch).width > maxWidth && part) {
                    lines.push(part);
                    part = ch;
                }
                else
                    part += ch;
            }
            line = part;
            continue;
        }
        if (ctx.measureText((line ? line + ' ' : '') + word).width > maxWidth && line) {
            lines.push(line);
            line = word;
        }
        else
            line += (line ? ' ' : '') + word;
    }
    lines.push(line);
} return lines; }
function canvasDrawText(ctx, e, value) { const size = (Number(e.fontSize) || 16) * (96 / 72), lh = size * (Number(e.lineHeight) || 1.2); ctx.save(); ctx.beginPath(); ctx.rect(e.x, e.y, e.w, e.h); ctx.clip(); ctx.font = `${e.italic ? 'italic ' : ''}${e.fontWeight || 400} ${size}px "${String(e.font || 'Georgia').replace(/"/g, '')}"`; ctx.fillStyle = e.color; ctx.textBaseline = 'top'; if ('letterSpacing' in ctx)
    ctx.letterSpacing = (e.letterSpacing || 0) + 'px'; const lines = wrapText(ctx, value, e.w); let y = e.y + (e.valign === 'bottom' ? e.h - lines.length * lh : e.valign === 'middle' ? (e.h - lines.length * lh) / 2 : 0); let x = e.x; ctx.textAlign = e.align === 'center' ? 'center' : e.align === 'right' ? 'right' : 'left'; if (e.align === 'center')
    x += e.w / 2;
else if (e.align === 'right')
    x += e.w; for (const line of lines) {
    if (y + lh > e.y && y < e.y + e.h) {
        ctx.fillText(line, x, y);
        if (e.underline) {
            const tw = ctx.measureText(line).width;
            const ux = e.align === 'center' ? x - tw / 2 : e.align === 'right' ? x - tw : x;
            ctx.beginPath();
            ctx.moveTo(ux, y + size * 1.02);
            ctx.lineTo(ux + tw, y + size * 1.02);
            ctx.lineWidth = Math.max(.6, size / 18);
            ctx.strokeStyle = e.color;
            ctx.stroke();
        }
    }
    y += lh;
} ctx.restore(); }
async function canvasCard(ci, mode = 'cards') {
    const { w, h } = (0, model_1.sizePx)(), dpi = Number(model_1.S.template.dpi) || 300, mult = model_1.S.template.unit === 'px' ? 1 : dpi / 96, W = Math.round(w * mult), H = Math.round(h * mult);
    if (W > 12000 || H > 12000 || W * H > 75000000)
        throw Error('Export dimensions are too large. Lower the DPI or card size.');
    const cvs = document.createElement('canvas');
    cvs.width = W;
    cvs.height = H;
    const ctx = cvs.getContext('2d', { alpha: false });
    ctx.scale(W / w, H / h);
    ctx.fillStyle = model_1.S.template.background;
    ctx.fillRect(0, 0, w, h);
    for (const raw of [...model_1.S.template.elements, ...(mode === 'cards' ? (model_1.S.cards[ci]?.extraElements || []) : [])]) {
        const e = mode === 'cards' ? { ...raw, ...(model_1.S.cards[ci]?.overrides?.[raw.id] || {}) } : raw;
        if (e.hidden)
            continue;
        ctx.save();
        ctx.globalAlpha = (0, model_1.clamp)((e.opacity ?? 100) / 100, 0, 1);
        canvasFillShape(ctx, e);
        if (raw.kind === 'image') {
            const src = (0, image_sets_1.getImageData)(raw, ci, mode), img = await (0, image_sets_1.loadedImage)(src);
            if (img) {
                ctx.save();
                makeShapePath(ctx, e);
                ctx.clip();
                const bb = (0, image_sets_1.imgBox)(e, img);
                ctx.drawImage(img, e.x + bb.x, e.y + bb.y, bb.w, bb.h);
                ctx.restore();
            }
        }
        if (raw.kind === 'text') {
            const value = mode === 'cards' && Object.prototype.hasOwnProperty.call(model_1.S.cards[ci]?.values || {}, raw.id) ? model_1.S.cards[ci].values[raw.id] : raw.text;
            canvasDrawText(ctx, e, value);
        }
        if (e.borderWidth > 0) {
            makeShapePath(ctx, e);
            ctx.lineWidth = e.borderWidth;
            ctx.strokeStyle = e.borderColor;
            ctx.stroke();
        }
        ctx.restore();
    }
    return cvs;
}

},
"preview": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderStage = renderStage;
const model_1 = require("./model");
const dom_1 = require("./dom");
const image_sets_1 = require("./image-sets");
const gradientCSS = e => e.fillMode === 'solid' ? e.fill1 : e.fillMode === 'gradient' ? `linear-gradient(${e.gradientAngle}deg,${e.fill1},${e.fill2})` : 'transparent';
function renderStage() {
    const st = (0, dom_1.$)('#stage'), { w, h } = (0, model_1.sizePx)(), z = model_1.S.zoom;
    st.style.width = (w * z) + 'px';
    st.style.height = (h * z) + 'px';
    st.style.background = model_1.S.template.background;
    let html = '';
    const eList = (0, model_1.layerEls)();
    for (const raw of eList) {
        const e = (0, model_1.effective)(raw);
        if (e.hidden)
            continue;
        const selected = model_1.S.selected === raw.id, src = (0, image_sets_1.getImageData)(raw, model_1.S.cardIndex, model_1.S.mode);
        let content = '';
        if (e.kind === 'text') {
            const style = `font-family:${(0, model_1.escapeHTML)(e.font)},serif;font-size:${e.fontSize * (96 / 72) * z}px;font-weight:${e.fontWeight};font-style:${e.italic ? 'italic' : 'normal'};text-decoration:${e.underline ? 'underline' : 'none'};color:${e.color};text-align:${e.align};line-height:${e.lineHeight};letter-spacing:${e.letterSpacing * z}px;align-items:${e.valign === 'top' ? 'flex-start' : e.valign === 'bottom' ? 'flex-end' : 'center'};`;
            content = `<div class="txt-inner" style="${style}"><div class="txt-content">${(0, model_1.escapeHTML)((0, model_1.actualValue)(raw))}</div></div>`;
        }
        else if (e.kind === 'image') {
            const im = (0, image_sets_1.cacheImage)(src);
            if (src && im?.loaded) {
                const box = (0, image_sets_1.imgBox)(e, im.im);
                content = `<div class="image-content"><img alt="" draggable="false" src="${src}" style="left:${box.x * z}px;top:${box.y * z}px;width:${box.w * z}px;height:${box.h * z}px"></div>`;
            }
            else
                content = `<div class="missing">${src ? 'Loading image…' : `IMAGE FRAME<br>${(0, model_1.escapeHTML)(raw.name)}`}</div>`;
        }
        const border = e.borderWidth > 0 ? `${e.borderWidth * z}px solid ${e.borderColor}` : 'none';
        const base = `left:${e.x * z}px;top:${e.y * z}px;width:${e.w * z}px;height:${e.h * z}px;background:${gradientCSS(e)};border:${border};border-radius:${e.shape === 'ellipse' ? '50%' : `${(e.radius || 0) * z}px`};opacity:${(e.opacity ?? 100) / 100};`;
        const label = selected ? `<span class="selection-label">${(0, model_1.escapeHTML)(raw.name)}</span>${!e.locked ? '<span class="resize-handle" data-handle="resize"></span>' : ''}` : '';
        html += `<div class="element ${selected ? 'selected' : ''} ${e.locked ? 'locked' : ''}" data-id="${raw.id}" style="${base}">${content}${label}</div>`;
    }
    st.innerHTML = html;
    (0, dom_1.$)('#statusLeft').textContent = `${model_1.S.template.width} × ${model_1.S.template.height} ${model_1.S.template.unit} · ${Math.round(w)} × ${Math.round(h)} design px · ${model_1.S.template.dpi} DPI PNG`;
    (0, dom_1.$)('#zoomLabel').textContent = Math.round(model_1.S.zoom * 100) + '%';
}

},
"project-storage": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveProject = saveProject;
exports.saveTemplate = saveTemplate;
exports.openJSON = openJSON;
const model_1 = require("./model");
const dom_1 = require("./dom");
const image_sets_1 = require("./image-sets");
const interface_1 = require("./interface");
function saveProject() { (0, dom_1.jsonDownload)({ ...model_1.S, type: 'cardstudio-project', version: 1 }, (0, model_1.safeFile)(model_1.S.projectName) + '.cardstudio.json'); (0, dom_1.toast)('Project saved, including embedded image sets'); }
function saveTemplate() { (0, dom_1.jsonDownload)({ type: 'cardstudio-template', version: 1, template: model_1.S.template }, (0, model_1.safeFile)(model_1.S.template.name) + '.template.json'); (0, dom_1.toast)('Template saved'); }
async function openJSON(file, onlyTemplate = false) {
    try {
        const obj = JSON.parse(await file.text());
        if (!obj.template?.elements || !Array.isArray(obj.template.elements))
            throw Error('Not a Card Studio project or template');
        if (onlyTemplate || obj.type === 'cardstudio-template') {
            model_1.S.template = obj.template;
            model_1.S.selected = null;
            for (const e of model_1.S.template.elements)
                if (e.kind === 'image' && !model_1.S.sets.some(x => x.id === e.autoSet))
                    e.autoSet = '';
            for (const c of model_1.S.cards) {
                c.overrides = {};
                c.values = {};
                c.extraElements = [];
            }
            (0, dom_1.toast)('Template loaded. Existing staged cards reset.');
        }
        else {
            if (!Array.isArray(obj.cards) || !Array.isArray(obj.sets))
                throw Error('Project does not contain cards and image sets');
            (0, model_1.replaceState)({ ...(0, model_1.initial)(), ...obj, mode: 'template', selected: null, cardIndex: 0 });
            image_sets_1.imageCache.clear();
            (0, dom_1.toast)('Project loaded');
        }
        (0, interface_1.repaint)();
    }
    catch (err) {
        alert('Could not open file: ' + err.message);
    }
}

},
"spreadsheet": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.columnIndex = exports.columnName = void 0;
exports.sheetTable = sheetTable;
exports.exportXLSX = exportXLSX;
exports.parseCSV = parseCSV;
exports.parseXLSX = parseXLSX;
exports.applyTable = applyTable;
exports.readSheet = readSheet;
const model_1 = require("./model");
const dom_1 = require("./dom");
const interface_1 = require("./interface");
const columnName = n => { let s = ''; for (n++; n; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
exports.columnName = columnName;
const columnIndex = s => [...s].reduce((n, c) => n * 26 + c.toUpperCase().charCodeAt(0) - 64, 0) - 1;
exports.columnIndex = columnIndex;
function sheetTable() { const elems = model_1.S.template.elements.filter(e => model_1.textKinds.includes(e.kind)); const heads = ['Card Name', ...elems.map(e => e.name)]; const rows = model_1.S.cards.map((c, i) => [c.name, ...elems.map(e => String(c.values?.[e.id] ?? (e.kind === 'text' ? e.text : '')))]); return { heads, rows }; }
async function exportXLSX() {
    const { heads, rows } = sheetTable(), values = [heads, ...(rows.length ? rows : Array.from({ length: 12 }, (_, i) => ['Card ' + String(i + 1).padStart(3, '0'), ...heads.slice(1).map(() => '')]))];
    const body = values.map((r, i) => `<row r="${i + 1}">${r.map((v, j) => `<c r="${(0, exports.columnName)(j)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${(0, model_1.escapeXML)(v)}</t></is></c>`).join('')}</row>`).join('');
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${(0, exports.columnName)(heads.length - 1)}${values.length}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${heads.map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="${i === 0 ? 21 : 27}" customWidth="1"/>`).join('')}</cols><sheetData>${body}</sheetData></worksheet>`;
    const z = new JSZip();
    z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
    z.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    z.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Cards" sheetId="1" r:id="rId1"/></sheets></workbook>`);
    z.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`);
    z.file('xl/worksheets/sheet1.xml', sheet);
    (0, dom_1.download)(await z.generateAsync({ type: 'blob', compression: 'DEFLATE' }), (0, model_1.safeFile)(model_1.S.template.name) + '_card_data.xlsx');
    (0, dom_1.toast)('Excel spreadsheet exported');
}
function parseCSV(text) {
    text = text.replace(/^\uFEFF/, '');
    const first = text.split(/\r?\n/, 1)[0], sep = first.includes('\t') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
    let rows = [], row = [], item = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') {
                item += '"';
                i++;
            }
            else if (ch === '"')
                quoted = false;
            else
                item += ch;
        }
        else if (ch === '"')
            quoted = true;
        else if (ch === sep) {
            row.push(item);
            item = '';
        }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n')
                i++;
            row.push(item);
            rows.push(row);
            row = [];
            item = '';
        }
        else
            item += ch;
    }
    if (item !== '' || row.length) {
        row.push(item);
        rows.push(row);
    }
    return rows;
}
const xmlChildren = (node, tag) => [...node.getElementsByTagNameNS('*', tag)];
async function parseXLSX(file) {
    const zip = await JSZip.loadAsync(file), ss = zip.file('xl/sharedStrings.xml');
    let strings = [];
    const dom = t => new DOMParser().parseFromString(t, 'application/xml');
    if (ss) {
        const doc = dom(await ss.async('string'));
        strings = xmlChildren(doc, 'si').map(si => xmlChildren(si, 't').map(t => t.textContent).join(''));
    }
    const sh = zip.file('xl/worksheets/sheet1.xml');
    if (!sh)
        throw Error('No first worksheet found in this file');
    const doc = dom(await sh.async('string'));
    if (doc.querySelector('parsererror'))
        throw Error('Could not read spreadsheet XML');
    const result = [];
    for (const row of xmlChildren(doc, 'row')) {
        const cells = {};
        for (const c of xmlChildren(row, 'c')) {
            const ref = c.getAttribute('r'), idx = (0, exports.columnIndex)(ref?.match(/[A-Z]+/i)?.[0] || 'A'), type = c.getAttribute('t');
            let value = '';
            if (type === 'inlineStr')
                value = xmlChildren(c, 't').map(t => t.textContent).join('');
            else {
                value = xmlChildren(c, 'v')[0]?.textContent || '';
                if (type === 's')
                    value = strings[Number(value)] ?? '';
            }
            cells[idx] = value;
        }
        const len = Math.max(-1, ...Object.keys(cells).map(Number)) + 1;
        result.push(Array.from({ length: len }, (_, i) => cells[i] ?? ''));
    }
    return result;
}
function applyTable(rows) {
    rows = rows.filter(r => r.some(x => String(x).trim() !== ''));
    if (rows.length < 2)
        throw Error('No card rows found.');
    const headers = rows[0].map(x => String(x).trim().toLowerCase()), mapping = model_1.S.template.elements.filter(e => model_1.textKinds.includes(e.kind)).map(e => [e, headers.indexOf(e.name.toLowerCase())]);
    const present = mapping.filter(x => x[1] >= 0).length;
    if (!present)
        throw Error('No spreadsheet columns match your text or image frame names.');
    const nameIdx = headers.indexOf('card name');
    const stage = rows.slice(1).filter(r => r.some(x => String(x).trim() !== ''));
    if (!stage.length)
        throw Error('The spreadsheet contains no populated card values.');
    const cards = stage.map((r, i) => { const values = {}; for (const [e, j] of mapping) {
        if (j >= 0)
            values[e.id] = String(r[j] ?? '');
    } return { id: (0, model_1.uid)(), name: String(nameIdx >= 0 ? r[nameIdx] : '').trim() || `Card ${String(i + 1).padStart(3, '0')}`, values, overrides: {}, extraElements: [] }; });
    if (model_1.S.cards.some(c => Object.keys(c.overrides || {}).length) && !confirm('Importing will replace staged cards and their individual layout edits. Continue?'))
        return;
    model_1.S.cards = cards;
    model_1.S.mode = 'cards';
    model_1.S.cardIndex = 0;
    model_1.S.selected = null;
    (0, interface_1.repaint)();
    (0, dom_1.toast)(`Imported ${cards.length} cards and matched ${present} element columns`);
}
async function readSheet(file) { try {
    const rows = file.name.toLowerCase().endsWith('.csv') ? parseCSV(await file.text()) : await parseXLSX(file);
    applyTable(rows);
}
catch (err) {
    alert('Spreadsheet import failed: ' + err.message);
} }

},
"types": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

}
};
const cache={};
function load(id){ id=id.replace(/^\.\//,'');if(cache[id])return cache[id].exports;const fn=factories[id];if(!fn)throw new Error('Missing module: '+id);const module={exports:{}};cache[id]=module;fn(module,module.exports,load);return module.exports;}
load('main');
})();
