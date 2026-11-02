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
const text_layout_1 = require("./text-layout");
const resize_1 = require("./resize");
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
        // Retain the original ID in the clipboard so card-specific spreadsheet values
        // and overrides still refer to this element when it is pasted back.
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
        // Further pastes duplicate the moved element rather than reusing its ID.
        from.cut = false;
        from.element = structuredClone(pasted);
        from.pasteCount = 0;
    }
    (0, interface_1.repaint)();
    (0, dom_1.toast)(isMove ? 'Element moved' : 'Element pasted');
    return true;
}
// Keep the same point of the card under the viewport centre when zooming.
// The stage may be centred when small or left-aligned when larger than the
// viewport; getBoundingClientRect handles either layout without guessing offsets.
function changeZoom(delta) {
    const outer = (0, dom_1.$)('#canvasOuter'), stage = (0, dom_1.$)('#stage');
    const next = (0, model_1.clamp)(Math.round((model_1.S.zoom + delta) * 100) / 100, .3, 3);
    if (next === model_1.S.zoom)
        return;
    const view = outer.getBoundingClientRect(), before = stage.getBoundingClientRect();
    const cx = view.left + outer.clientWidth / 2, cy = view.top + outer.clientHeight / 2;
    const focalX = (cx - before.left) / model_1.S.zoom, focalY = (cy - before.top) / model_1.S.zoom;
    model_1.S.zoom = next;
    (0, preview_1.renderStage)();
    const after = stage.getBoundingClientRect();
    outer.scrollLeft += after.left + focalX * next - cx;
    outer.scrollTop += after.top + focalY * next - cy;
}
function newCard(copy = null) { const c = copy ? { id: (0, model_1.uid)(), name: copy.name + ' copy', values: { ...copy.values }, overrides: structuredClone(copy.overrides || {}), extraElements: structuredClone(copy.extraElements || []) } : { id: (0, model_1.uid)(), name: 'Card ' + String(model_1.S.cards.length + 1).padStart(3, '0'), values: {}, overrides: {}, extraElements: [] }; model_1.S.cards.push(c); model_1.S.mode = 'cards'; model_1.S.cardIndex = model_1.S.cards.length - 1; model_1.S.selected = null; (0, interface_1.repaint)(); return c; }
function mutateAction(action, el = null) {
    switch (action) {
        case 'new-project':
            if (confirm('Start a new project? Unsaved changes will be lost.')) {
                (0, model_1.replaceState)((0, model_1.initial)());
                (0, project_storage_1.resetFileHandles)();
                image_sets_1.imageCache.clear();
                (0, interface_1.repaint)();
            }
            break;
        case 'open-project':
            void (0, project_storage_1.openFromDisk)('project');
            break;
        case 'save-project':
            void (0, project_storage_1.saveProject)();
            break;
        case 'save-project-as':
            void (0, project_storage_1.saveProjectAs)();
            break;
        case 'save-template':
            void (0, project_storage_1.saveTemplate)();
            break;
        case 'save-template-as':
            void (0, project_storage_1.saveTemplateAs)();
            break;
        case 'load-template':
            void (0, project_storage_1.openFromDisk)('template');
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
            changeZoom(.1);
            break;
        case 'zoom-out':
            changeZoom(-.1);
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
        const p = key.split('.')[1], template = model_1.S.template;
        if (p === 'unit') {
            const oldFactor = (0, model_1.unitFactor)(template.unit, template.dpi), newFactor = (0, model_1.unitFactor)(v, template.dpi);
            template.width = Number((template.width * oldFactor / newFactor).toFixed(6));
            template.height = Number((template.height * oldFactor / newFactor).toFixed(6));
        }
        else if (p === 'dpi') {
            const newDpi = Number(v);
            if (!Number.isFinite(newDpi) || newDpi <= 0)
                return;
            // Keep the physical card size unchanged. With px selected the editable
            // pixel count must grow or shrink when the resolution changes.
            if (template.unit === 'px') {
                template.width = Number((template.width * newDpi / template.dpi).toFixed(6));
                template.height = Number((template.height * newDpi / template.dpi).toFixed(6));
            }
            v = newDpi;
        }
        else if (['width', 'height'].includes(p)) {
            v = Number(v);
            if (!Number.isFinite(v) || v <= 0)
                return;
        }
        template[p] = v;
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
    if (['x', 'y', 'w', 'h', 'gutterLeft', 'gutterRight', 'gutterTop', 'gutterBottom'].includes(key)) {
        v = (0, model_1.px)(Number(v), model_1.S.template.unit, model_1.S.template.dpi);
        if (key === 'w' || key === 'h')
            v = Math.max(1, v);
        if (key.startsWith('gutter'))
            v = Math.max(0, v);
    }
    else if (['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'borderWidth', 'radius', 'opacity', 'fillOpacity', 'borderOpacity', 'textOpacity', 'gradientAngle', 'imgScale', 'imgOffsetX', 'imgOffsetY'].includes(key)) {
        v = Number(v);
        if (['opacity', 'fillOpacity', 'borderOpacity', 'textOpacity'].includes(key))
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
        (0, interface_1.updateDimensionReadouts)();
    }
    return;
} if (inp.dataset.prop) {
    handleProp(inp);
    (0, preview_1.renderStage)();
    (0, interface_1.updateDimensionReadouts)();
    (0, dom_1.$)('#projectTitle').textContent = model_1.S.projectName;
} });
(0, dom_1.$)('#inspector').addEventListener('change', event => { const inp = event.target; if (inp.dataset.cardvalue) {
    (0, interface_1.renderLeft)();
    return;
} if (inp.dataset.prop) {
    handleProp(inp);
    (0, interface_1.repaint)();
} });
function listenClick(e) { const menu = (0, dom_1.$)('#fileMenu'); const actionEl = e.target.closest('[data-action]'); if (actionEl) {
    menu.open = false;
    e.stopPropagation();
    mutateAction(actionEl.dataset.action, actionEl);
    return;
} if (menu.open && !e.target.closest('#fileMenu'))
    menu.open = false; const listRow = e.target.closest('[data-layer]'); if (listRow) {
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
// Use the event's original propagation path: renderStage() can replace the clicked
// element before the event bubbles here, so target.closest('#stage') becomes false.
(0, dom_1.$)('#canvasOuter').addEventListener('pointerdown', e => { if (e.button === 0 && !e.composedPath().includes(stage))
    clearSelection(); });
stage.addEventListener('pointerdown', e => { if (e.button !== 0)
    return; const node = e.target.closest('.element'); if (!node) {
    clearSelection();
    return;
} const id = node.dataset.id; model_1.S.selected = id; (0, interface_1.renderInspector)(); (0, interface_1.renderLeft)(); const el = (0, model_1.effective)((0, model_1.templateEl)(id)); const handle = e.target.closest('[data-handle]')?.dataset.handle || null; (0, preview_1.renderStage)(); if (el.locked)
    return; drag = { id, type: handle ? 'resize' : 'move', handle, initialX: e.clientX, initialY: e.clientY, x: el.x, y: el.y, w: el.w, h: el.h, visual: el.kind === 'text' ? (0, text_layout_1.layoutTextBox)(el, (0, model_1.actualValue)((0, model_1.templateEl)(id))) : { x: el.x, y: el.y, w: el.w, h: el.h }, lockAspect: (0, resize_1.locksImageCornerAspect)(el.kind, el.imageFit, handle) }; e.preventDefault(); });
document.addEventListener('pointermove', e => { if (!drag)
    return; const { w, h } = (0, model_1.sizePx)(), dx = (e.clientX - drag.initialX) / model_1.S.zoom, dy = (e.clientY - drag.initialY) / model_1.S.zoom; let patch; if (drag.type === 'resize') {
    const rect = (0, resize_1.resizedRect)(drag.visual, drag.handle || 'se', dx, dy, { w, h }, drag.lockAspect);
    const handle = drag.handle || 'se';
    patch = {};
    if (handle.includes('w') || handle.includes('e'))
        Object.assign(patch, { x: rect.x, w: rect.w, autoWidth: false });
    if (handle.includes('n') || handle.includes('s'))
        Object.assign(patch, { y: rect.y, h: rect.h, autoHeight: false });
}
else
    patch = { x: Math.round((0, model_1.clamp)(drag.x + dx, -drag.w + 4, w - 4)), y: Math.round((0, model_1.clamp)(drag.y + dy, -drag.h + 4, h - 4)) }; (0, interface_1.patchElement)(drag.id, patch); (0, preview_1.renderStage)(); (0, interface_1.renderInspector)(); });
document.addEventListener('pointerup', () => { if (drag) {
    drag = null;
    (0, interface_1.renderInspector)();
    (0, interface_1.renderLeft)();
    (0, preview_1.renderStage)();
} });
document.addEventListener('keydown', e => {
    const active = document.activeElement, tag = active?.tagName;
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
        return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        mutateAction('delete-element');
        return;
    }
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (delta) {
        const el = (0, model_1.effective)((0, model_1.templateEl)(model_1.S.selected));
        if (el.locked)
            return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        (0, interface_1.patchElement)(model_1.S.selected, { x: el.x + delta[0] * step, y: el.y + delta[1] * step });
        (0, preview_1.renderStage)();
        (0, interface_1.renderInspector)();
    }
});
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
exports.updateDimensionReadouts = updateDimensionReadouts;
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
const text_layout_1 = require("./text-layout");
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
    out += `<div class="side-head"><h2>LAYERS</h2><span class="pill">${(0, model_1.layerEls)().filter(e => model_1.S.mode === 'template' || (0, model_1.visibleOnCard)(e, model_1.S.cardIndex, 'cards')).length}</span></div><div class="small">Topmost layers are shown first. Select an element to edit it.</div>`;
    out += '<div class="layer-list">' + [...(0, model_1.layerEls)()].filter(e => model_1.S.mode === 'template' || (0, model_1.visibleOnCard)(e, model_1.S.cardIndex, 'cards')).reverse().map(e => `<div class="layer-row ${e.id === model_1.S.selected ? 'active' : ''}" data-layer="${e.id}"><span style="font-size:15px;color:#7b91ad">${e.kind === 'text' ? 'T' : e.kind === 'image' ? '▧' : '◇'}</span><span class="name">${(0, model_1.escapeHTML)(e.name)}<span class="sub">${e.kind}${e.locked ? ' · locked' : ''}${!(0, model_1.isExported)(e) ? ' · editor only' : ''}</span></span></div>`).join('') + '</div>';
    out += `<div class="rule"></div><div class="side-head"><h2>IMAGE SETS</h2><button data-action="add-set">＋ Load set</button></div><div class="small">Load multiple images as one set. Assign the set to an image frame, then choose sequential, cycling or random assignment.</div>`;
    out += '<div class="set-list">' + model_1.S.sets.map(set => `<div class="asset-row"><div class="asset-title"><span>▧</span><span style="overflow:hidden;text-overflow:ellipsis">${(0, model_1.escapeHTML)(set.name)}</span><span class="count">${set.images.length} files</span></div><div class="asset-thumbs">${set.images.slice(0, 6).map(x => `<img alt="${(0, model_1.escapeHTML)(x.name)}" title="${(0, model_1.escapeHTML)(x.name)}" src="${x.data}">`).join('')}</div><div class="asset-actions"><button data-action="add-to-set" data-set="${set.id}">＋ Images</button><button data-action="remove-set" data-set="${set.id}">Remove</button></div></div>`).join('') + '</div>';
    v.innerHTML = out;
}
function field(label, key, value, type = 'text', extra = '') { return `<div class="field"><label>${(0, model_1.escapeHTML)(label)}</label><input data-prop="${key}" type="${type}" value="${(0, model_1.escapeHTML)(value)}" ${extra}></div>`; }
function selectionField(label, key, items, value) { return `<div class="field"><label>${(0, model_1.escapeHTML)(label)}</label><select data-prop="${key}">${items.map(([v, l]) => `<option value="${(0, model_1.escapeHTML)(v)}" ${String(v) === String(value) ? 'selected' : ''}>${(0, model_1.escapeHTML)(l)}</option>`).join('')}</select></div>`; }
function checkbox(label, key, value) { return `<label class="toggle-line"><input type="checkbox" data-prop="${key}" ${value ? 'checked' : ''}>${(0, model_1.escapeHTML)(label)}</label>`; }
// All pixel labels are export-image pixels at the selected resolution.
const sizeReadout = () => { const { w, h } = (0, model_1.templateExportSize)(); return `${w.toLocaleString('en-US')} × ${h.toLocaleString('en-US')} px at ${model_1.S.template.dpi} DPI`; };
const elementReadout = () => {
    const raw = (0, model_1.templateEl)(model_1.S.selected);
    if (!raw)
        return '';
    const e = (0, model_1.effective)(raw), dpi = model_1.S.template.dpi;
    const visual = e.kind === 'text' ? (0, text_layout_1.layoutTextBox)(e, (0, model_1.actualValue)(raw)) : e;
    return `${e.kind === 'text' && (e.autoWidth || e.autoHeight) ? 'Auto-sized ' : ''}Export pixels at ${dpi} DPI: X ${(0, model_1.exportPixels)(visual.x, dpi)} · Y ${(0, model_1.exportPixels)(visual.y, dpi)} · Width ${(0, model_1.exportPixels)(visual.w, dpi)} px · Height ${(0, model_1.exportPixels)(visual.h, dpi)} px`;
};
function updateDimensionReadouts() {
    const templateNode = document.querySelector('#templatePixelReadout');
    if (templateNode)
        templateNode.textContent = sizeReadout();
    const elementNode = document.querySelector('#elementPixelReadout');
    if (elementNode)
        elementNode.textContent = elementReadout();
}
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
 <div class="fields-two">${field('Width (' + model_1.S.template.unit + ')', 'template.width', model_1.S.template.width, 'number', 'min="0.01" step="any"')}${field('Height (' + model_1.S.template.unit + ')', 'template.height', model_1.S.template.height, 'number', 'min="0.01" step="any"')}</div>
 ${selectionField('Units', 'template.unit', [['mm', 'Millimetres (mm)'], ['in', 'Inches (in)'], ['px', 'Pixels (px)']], model_1.S.template.unit)}
 ${selectionField('PNG resolution', 'template.dpi', [[150, '150 DPI'], [300, '300 DPI'], [450, '450 DPI'], [600, '600 DPI']], model_1.S.template.dpi)}
 <div class="small" style="padding:4px 0 12px" id="templatePixelReadout">${sizeReadout()}</div>
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
    const f = (0, model_1.unitFactor)(model_1.S.template.unit, model_1.S.template.dpi);
    html += `<div class="section-title">Position and size (${model_1.S.template.unit})</div><div class="fields-two">${field('X (' + model_1.S.template.unit + ')', 'x', (0, model_1.fmt)(e.x / f), 'number', 'step="any"')}${field('Y (' + model_1.S.template.unit + ')', 'y', (0, model_1.fmt)(e.y / f), 'number', 'step="any"')}${field('Width (' + model_1.S.template.unit + ')', 'w', (0, model_1.fmt)(e.w / f), 'number', 'min="0.01" step="any"')}${field('Height (' + model_1.S.template.unit + ')', 'h', (0, model_1.fmt)(e.h / f), 'number', 'min="0.01" step="any"')}</div><div class="small" style="padding:4px 0 12px" id="elementPixelReadout">${elementReadout()}</div>`;
    html += checkbox('Hide element', 'hidden', e.hidden) + checkbox('Lock position', 'locked', e.locked);
    if (model_1.S.mode === 'template')
        html += checkbox('Include in exported images', 'includeInExport', (0, model_1.isExported)(e)) +
            `<div class="small" style="padding:0 0 12px">Turn this off for non-printing guides, such as cut lines and bleed markers. These elements appear only in the Template editor, not in Cards previews or PNG exports.</div>`;
    if (raw.kind === 'text') {
        if (model_1.S.mode === 'template')
            html += `<div class="field"><label>Default text</label><textarea data-prop="text">${(0, model_1.escapeHTML)(e.text)}</textarea></div>`;
        html += `<div class="section-title">Visibility</div>` + checkbox('Invisible if empty', 'invisibleIfEmpty', e.invisibleIfEmpty !== false) +
            `<div class="small" style="padding:0 0 10px">Hide this entire text box on cards where its spreadsheet or card text is blank (including its fill and border). Empty text remains editable in Template mode.</div>`;
        html += `<div class="section-title">Automatic text box sizing</div>` +
            checkbox('Auto width (expand horizontally)', 'autoWidth', e.autoWidth === true) +
            checkbox('Auto height (expand vertically)', 'autoHeight', e.autoHeight === true) +
            `<div class="small" style="padding:0 0 12px">The box grows from the selected text alignment: left/right/centre and top/bottom/middle. Width and Height above are the anchor dimensions when auto-sizing is active.</div>`;
        const unit = model_1.S.template.unit, factor = (0, model_1.unitFactor)(unit, model_1.S.template.dpi);
        html += `<div class="section-title">Text gutters (${unit})</div><div class="fields-two">` +
            field('Left (' + unit + ')', 'gutterLeft', (0, model_1.fmt)((e.gutterLeft || 0) / factor), 'number', 'min="0" step="any"') +
            field('Right (' + unit + ')', 'gutterRight', (0, model_1.fmt)((e.gutterRight || 0) / factor), 'number', 'min="0" step="any"') +
            field('Top (' + unit + ')', 'gutterTop', (0, model_1.fmt)((e.gutterTop || 0) / factor), 'number', 'min="0" step="any"') +
            field('Bottom (' + unit + ')', 'gutterBottom', (0, model_1.fmt)((e.gutterBottom || 0) / factor), 'number', 'min="0" step="any"') +
            `</div><div class="small" style="padding:0 0 12px">Background and border cover the full box; the text stays inside these four clearances.</div>`;
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
    if (raw.kind === 'shape' || raw.kind === 'image') {
        const texts = [...model_1.S.template.elements, ...(model_1.S.mode === 'cards' ? ((0, model_1.card)()?.extraElements || []) : [])].filter(item => item.kind === 'text');
        html += `<div class="section-title">Visibility link</div>` +
            selectionField('Follow text visibility', 'linkedTextId', [['', 'None (always independent)'], ...texts.map(item => [item.id, item.name])], e.linkedTextId || '') +
            `<div class="small" style="padding:0 0 10px">Hide this entire ${raw.kind === 'image' ? 'image frame' : 'shape'} when the chosen text box is invisible on this card.</div>`;
    }
    html += `<div class="section-title">Appearance</div>${selectionField('Fill', 'fillMode', [['none', 'Transparent'], ['solid', 'Solid colour'], ['gradient', 'Linear gradient']], e.fillMode)}`;
    if (e.fillMode !== 'none')
        html += `<div class="fields-two">${field('Fill colour 1', 'fill1', e.fill1, 'color')}${e.fillMode === 'gradient' ? field('Fill colour 2', 'fill2', e.fill2, 'color') : ''}</div>${e.fillMode === 'gradient' ? field('Gradient angle (degrees)', 'gradientAngle', e.gradientAngle, 'number', 'step="5"') : ''}`;
    html += `<div class="fields-two">${field('Border thickness (px)', 'borderWidth', e.borderWidth, 'number', 'min="0" step="0.5"')}${field('Border colour', 'borderColor', e.borderColor, 'color')}</div>`;
    if (e.shape !== 'ellipse')
        html += field('Corner radius (px)', 'radius', e.radius, 'number', 'min="0" step="1"');
    const opacityField = (label, key) => field(label, key, Math.round((0, model_1.opacityFor)(e, key) * 100), 'number', 'min="0" max="100" step="1"');
    html += opacityField(raw.kind === 'image' ? 'Image opacity (%)' : 'Background opacity (%)', 'fillOpacity');
    html += opacityField('Border opacity (%)', 'borderOpacity');
    if (raw.kind === 'text')
        html += opacityField('Text opacity (%)', 'textOpacity');
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
exports.uniqName = exports.actualValue = exports.effective = exports.isExtra = exports.isExported = exports.layerEls = exports.templateEl = exports.card = exports.S = exports.initial = exports.initialElements = exports.makeElement = exports.textKinds = exports.opacityFor = exports.fmt = exports.templateExportSize = exports.sizePx = exports.exportPixels = exports.px = exports.unitFactor = exports.perUnit = exports.clamp = exports.safeFile = exports.escapeXML = exports.escapeHTML = exports.uid = void 0;
exports.replaceState = replaceState;
exports.cardTextValue = cardTextValue;
exports.visibleOnCard = visibleOnCard;
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
// Geometry uses 96 CSS/design pixels per inch internally. The 'px' unit shown in
// controls means *export image pixels* at the selected DPI, never screen pixels.
exports.perUnit = { mm: 96 / 25.4, in: 96, px: 1 };
const unitFactor = (unit, dpi) => unit === 'px' ? 96 / dpi : exports.perUnit[unit];
exports.unitFactor = unitFactor;
const px = (value, unit = 'mm', dpi = 300) => Number(value || 0) * (0, exports.unitFactor)(unit, dpi);
exports.px = px;
const exportPixels = (designPixels, dpi = exports.S.template.dpi) => Math.round(designPixels * dpi / 96);
exports.exportPixels = exportPixels;
const sizePx = () => ({ w: (0, exports.px)(exports.S.template.width, exports.S.template.unit, exports.S.template.dpi), h: (0, exports.px)(exports.S.template.height, exports.S.template.unit, exports.S.template.dpi) });
exports.sizePx = sizePx;
const templateExportSize = () => { const { w, h } = (0, exports.sizePx)(); return { w: (0, exports.exportPixels)(w), h: (0, exports.exportPixels)(h) }; };
exports.templateExportSize = templateExportSize;
const fmt = v => String(Math.round(v * 100) / 100);
exports.fmt = fmt;
const opacityFor = (e, component) => (0, exports.clamp)(Number(e[component] ?? e.opacity ?? 100) || 0, 0, 100) / 100;
exports.opacityFor = opacityFor;
exports.textKinds = ['text', 'image'];
const makeElement = (kind, parts = {}) => ({ id: (0, exports.uid)(), kind, name: kind === 'text' ? 'Text' : kind === 'image' ? 'Artwork' : 'Shape', x: 22, y: 35, w: 195, h: 55, locked: false, hidden: false, includeInExport: true, invisibleIfEmpty: true, linkedTextId: '', shape: 'rect', radius: 0, fillMode: kind === 'shape' ? 'solid' : 'none', fill1: '#ffffff', fill2: '#dde5f1', gradientAngle: 90, borderWidth: 0, borderColor: '#233b58', opacity: 100, fillOpacity: 100, borderOpacity: 100, textOpacity: 100, text: 'Text', font: 'Georgia', fontSize: 19, fontWeight: 400, italic: false, underline: false, color: '#152b43', align: 'left', valign: 'middle', lineHeight: 1.18, letterSpacing: 0, autoWidth: false, autoHeight: false, gutterLeft: 0, gutterRight: 0, gutterTop: 0, gutterBottom: 0, imageFit: 'cover', imgScale: 1, imgOffsetX: 0, imgOffsetY: 0, autoSet: '', autoMode: 'cycle', ...parts });
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
const initial = () => ({ type: 'cardstudio-project', version: 2, projectName: 'Untitled deck', template: { name: 'Standard game card', width: 63, height: 88, unit: 'mm', dpi: 300, background: '#ffffff', elements: (0, exports.initialElements)() }, sets: [], cards: [{ id: (0, exports.uid)(), name: 'Card 001', values: {}, overrides: {}, extraElements: [] }], mode: 'template', cardIndex: 0, selected: null, zoom: 1.55 });
exports.initial = initial;
exports.S = (0, exports.initial)();
function replaceState(value) { exports.S = value; }
const card = () => exports.S.cards[exports.S.cardIndex] || null;
exports.card = card;
const templateEl = (id) => exports.S.template.elements.find(e => e.id === id) || (exports.S.mode === 'cards' ? (0, exports.card)()?.extraElements?.find(e => e.id === id) : null);
exports.templateEl = templateEl;
const layerEls = () => [...exports.S.template.elements, ...(exports.S.mode === 'cards' ? ((0, exports.card)()?.extraElements || []) : [])];
exports.layerEls = layerEls;
const isExported = (e) => e.includeInExport !== false;
exports.isExported = isExported;
const isExtra = (id) => !!(0, exports.card)()?.extraElements?.some(e => e.id === id);
exports.isExtra = isExtra;
const effective = (e) => exports.S.mode === 'cards' && (0, exports.card)() && !(0, exports.isExtra)(e.id) ? { ...e, ...((0, exports.card)().overrides?.[e.id] || {}) } : e;
exports.effective = effective;
const actualValue = (e) => exports.S.mode === 'cards' && (0, exports.card)() && Object.prototype.hasOwnProperty.call((0, exports.card)().values || {}, e.id) ? (0, exports.card)().values[e.id] : (e.kind === 'text' ? e.text : '');
exports.actualValue = actualValue;
/** Resolve spreadsheet/card data for any card index, without changing the UI selection. */
function cardTextValue(e, cardIndex) {
    const values = exports.S.cards[cardIndex]?.values || {};
    return String(Object.prototype.hasOwnProperty.call(values, e.id) ? values[e.id] : e.text ?? '');
}
/** Single visibility rule shared by card preview, layers, and all PNG exports. */
function visibleOnCard(raw, cardIndex, mode = 'cards') {
    const overrides = mode === 'cards' ? exports.S.cards[cardIndex]?.overrides?.[raw.id] : null;
    const el = overrides ? { ...raw, ...overrides } : raw;
    if (el.hidden || !(0, exports.isExported)(raw) || !(0, exports.isExported)(el))
        return false;
    // Template PNG exports should still render default text/backgrounds, but no guides.
    if (mode !== 'cards')
        return true;
    if (el.kind === 'text')
        return el.invisibleIfEmpty === false || cardTextValue(raw, cardIndex).trim() !== '';
    if ((el.kind === 'shape' || el.kind === 'image') && el.linkedTextId) {
        const source = [...exports.S.template.elements, ...(exports.S.cards[cardIndex]?.extraElements || [])]
            .find(item => item.id === el.linkedTextId && item.kind === 'text');
        // Orphaned links are ignored rather than concealing the element unexpectedly.
        return !source || visibleOnCard(source, cardIndex, 'cards');
    }
    return true;
}
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
const text_layout_1 = require("./text-layout");
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
function canvasDrawText(ctx, e, value, layout) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(e.x + layout.left, e.y + layout.top, layout.innerW, layout.innerH);
    ctx.clip();
    ctx.font = `${e.italic ? 'italic ' : ''}${e.fontWeight || 400} ${layout.fontPx}px "${String(e.font || 'Georgia').replace(/"/g, '')}"`;
    ctx.fillStyle = e.color;
    ctx.textBaseline = 'top';
    if ('letterSpacing' in ctx)
        ctx.letterSpacing = (e.letterSpacing || 0) + 'px';
    const { lines, linePx, fontPx } = layout;
    let y = e.y + layout.top + (e.valign === 'bottom' ? layout.innerH - layout.textHeight : e.valign === 'middle' ? (layout.innerH - layout.textHeight) / 2 : 0);
    let x = e.x + layout.left;
    ctx.textAlign = e.align === 'center' ? 'center' : e.align === 'right' ? 'right' : 'left';
    if (e.align === 'center')
        x += layout.innerW / 2;
    else if (e.align === 'right')
        x += layout.innerW;
    for (const line of lines) {
        if (y + linePx > e.y + layout.top && y < e.y + e.h - layout.bottom) {
            ctx.fillText(line, x, y);
            if (e.underline) {
                const tw = ctx.measureText(line).width;
                const ux = e.align === 'center' ? x - tw / 2 : e.align === 'right' ? x - tw : x;
                ctx.beginPath();
                ctx.moveTo(ux, y + fontPx * 1.02);
                ctx.lineTo(ux + tw, y + fontPx * 1.02);
                ctx.lineWidth = Math.max(.6, fontPx / 18);
                ctx.strokeStyle = e.color;
                ctx.stroke();
            }
        }
        y += linePx;
    }
    ctx.restore();
}
async function canvasCard(ci, mode = 'cards') {
    const { w, h } = (0, model_1.sizePx)(), { w: W, h: H } = (0, model_1.templateExportSize)();
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
        const effective = mode === 'cards' ? { ...raw, ...(model_1.S.cards[ci]?.overrides?.[raw.id] || {}) } : raw;
        if (!(0, model_1.visibleOnCard)(raw, ci, mode))
            continue;
        const value = raw.kind === 'text' ? (mode === 'cards' && Object.prototype.hasOwnProperty.call(model_1.S.cards[ci]?.values || {}, raw.id) ? model_1.S.cards[ci].values[raw.id] : raw.text) : '';
        const layout = raw.kind === 'text' ? (0, text_layout_1.layoutTextBox)(effective, value) : null;
        const e = layout ? { ...effective, x: layout.x, y: layout.y, w: layout.w, h: layout.h } : effective;
        ctx.save();
        ctx.globalAlpha = (0, model_1.opacityFor)(e, 'fillOpacity');
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
            ctx.globalAlpha = (0, model_1.opacityFor)(e, 'textOpacity');
            canvasDrawText(ctx, e, value, layout);
        }
        if (e.borderWidth > 0) {
            ctx.globalAlpha = (0, model_1.opacityFor)(e, 'borderOpacity');
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
const text_layout_1 = require("./text-layout");
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
        if (model_1.S.mode === 'template' ? e.hidden : !(0, model_1.visibleOnCard)(raw, model_1.S.cardIndex, 'cards'))
            continue;
        const selected = model_1.S.selected === raw.id, src = (0, image_sets_1.getImageData)(raw, model_1.S.cardIndex, model_1.S.mode);
        let content = '';
        if (e.kind === 'text') {
            const layout = (0, text_layout_1.layoutTextBox)(e, (0, model_1.actualValue)(raw));
            const style = `font-family:${(0, model_1.escapeHTML)(e.font)},serif;font-size:${layout.fontPx * z}px;font-weight:${e.fontWeight};font-style:${e.italic ? 'italic' : 'normal'};text-decoration:${e.underline ? 'underline' : 'none'};color:${e.color};text-align:${e.align};line-height:${layout.linePx * z}px;letter-spacing:${e.letterSpacing * z}px;align-items:${e.valign === 'top' ? 'flex-start' : e.valign === 'bottom' ? 'flex-end' : 'center'};left:${layout.left * z}px;right:${layout.right * z}px;top:${layout.top * z}px;bottom:${layout.bottom * z}px;`;
            content = `<div class="txt-inner" style="${style}"><div class="txt-content">${layout.lines.map(line => `<span class="txt-line">${line ? (0, model_1.escapeHTML)(line) : '&nbsp;'}</span>`).join('')}</div></div>`;
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
        const geom = e.kind === 'text' ? (0, text_layout_1.layoutTextBox)(e, (0, model_1.actualValue)(raw)) : e;
        const border = e.borderWidth > 0 ? `${e.borderWidth * z}px solid ${e.borderColor}` : 'none';
        const base = `left:${geom.x * z}px;top:${geom.y * z}px;width:${geom.w * z}px;height:${geom.h * z}px;border-radius:${e.shape === 'ellipse' ? '50%' : `${(e.radius || 0) * z}px`};`;
        const fill = `<div class="element-fill" style="background:${gradientCSS(e)};opacity:${(0, model_1.opacityFor)(e, 'fillOpacity')}"></div>`;
        const borderLayer = e.borderWidth > 0 ? `<div class="element-border" style="border:${border};opacity:${(0, model_1.opacityFor)(e, 'borderOpacity')}"></div>` : '';
        if (e.kind === 'text')
            content = `<div class="text-layer" style="opacity:${(0, model_1.opacityFor)(e, 'textOpacity')}">${content}</div>`;
        if (e.kind === 'image')
            content = `<div class="image-layer" style="opacity:${(0, model_1.opacityFor)(e, 'fillOpacity')}">${content}</div>`;
        const handles = !e.locked ? ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(h => `<span class="resize-handle resize-${h}" data-handle="${h}"></span>`).join('') : '';
        const label = selected ? `<span class="selection-label">${(0, model_1.escapeHTML)(raw.name)}</span>${handles}` : '';
        html += `<div class="element ${selected ? 'selected' : ''} ${e.locked ? 'locked' : ''}" data-id="${raw.id}" style="${base}">${fill}${content}${borderLayer}${label}</div>`;
    }
    st.innerHTML = html;
    (0, dom_1.$)('#statusLeft').textContent = `${model_1.S.template.width} × ${model_1.S.template.height} ${model_1.S.template.unit} · ${(0, model_1.templateExportSize)().w} × ${(0, model_1.templateExportSize)().h} export px · ${model_1.S.template.dpi} DPI`;
    (0, dom_1.$)('#zoomLabel').textContent = Math.round(model_1.S.zoom * 100) + '%';
}

},
"project-storage": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveTemplateAs = exports.saveTemplate = exports.saveProjectAs = exports.saveProject = void 0;
exports.resetFileHandles = resetFileHandles;
exports.openFromDisk = openFromDisk;
exports.migrateProjectUnits = migrateProjectUnits;
exports.migrateComponentOpacities = migrateComponentOpacities;
exports.openJSON = openJSON;
const model_1 = require("./model");
const dom_1 = require("./dom");
const image_sets_1 = require("./image-sets");
const interface_1 = require("./interface");
let projectFileHandle = null;
let templateFileHandle = null;
function resetFileHandles() { projectFileHandle = null; templateFileHandle = null; }
const projectName = () => (0, model_1.safeFile)(model_1.S.projectName) + '.cardstudio.json';
const templateName = () => (0, model_1.safeFile)(model_1.S.template.name) + '.template.json';
const projectContents = () => ({ ...model_1.S, type: 'cardstudio-project', version: 2 });
const templateContents = () => ({ type: 'cardstudio-template', version: 2, template: model_1.S.template });
const filePicker = (type, name) => ({
    suggestedName: name,
    types: [{ description: type === 'project' ? 'Card Studio project' : 'Card Studio template', accept: { 'application/json': ['.json'] } }]
});
function isCancel(error) { return error?.name === 'AbortError'; }
async function saveDocument(type, saveAs = false) {
    const isProject = type === 'project';
    const handle = isProject ? projectFileHandle : templateFileHandle;
    const name = isProject ? projectName() : templateName();
    const data = isProject ? projectContents() : templateContents();
    const picker = window.showSaveFilePicker;
    if (typeof picker !== 'function' && (!handle || saveAs)) {
        // Downloads cannot replace an existing local file. Do not claim otherwise.
        (0, dom_1.jsonDownload)(data, name);
        (0, dom_1.toast)('Downloaded a copy. To overwrite files directly, use Chrome or Edge with file access enabled.');
        return false;
    }
    try {
        // Call the picker synchronously at the start of this user-triggered action.
        const destination = !saveAs && handle ? handle : await picker.call(window, filePicker(type, name));
        const writable = await destination.createWritable();
        try {
            await writable.write(JSON.stringify(data, null, 2));
            await writable.close();
        }
        catch (err) {
            try {
                await writable.abort?.();
            }
            catch { }
            throw err;
        }
        if (isProject)
            projectFileHandle = destination;
        else
            templateFileHandle = destination;
        (0, dom_1.toast)(`${isProject ? 'Project' : 'Template'} saved to ${destination.name}`);
        return true;
    }
    catch (error) {
        if (!isCancel(error))
            alert('Could not save ' + type + ': ' + error.message);
        return false;
    }
}
const saveProject = () => saveDocument('project');
exports.saveProject = saveProject;
const saveProjectAs = () => saveDocument('project', true);
exports.saveProjectAs = saveProjectAs;
const saveTemplate = () => saveDocument('template');
exports.saveTemplate = saveTemplate;
const saveTemplateAs = () => saveDocument('template', true);
exports.saveTemplateAs = saveTemplateAs;
async function openFromDisk(type) {
    const picker = window.showOpenFilePicker;
    if (typeof picker !== 'function') {
        (0, dom_1.$)(type === 'project' ? '#openProjectFile' : '#openTemplateFile').click();
        return;
    }
    try {
        const [handle] = await picker.call(window, { multiple: false, types: filePicker(type, '').types });
        if (!handle)
            return;
        await openJSON(await handle.getFile(), type === 'template', handle);
    }
    catch (error) {
        if (!isCancel(error))
            alert('Could not open ' + type + ': ' + error.message);
    }
}
// Version 1 treated pixel-sized templates as CSS-pixel layouts and bypassed
// DPI when exporting. Scale stored geometry to preserve legacy appearance.
function migrateProjectUnits(obj) {
    if (Number(obj.version ?? 1) >= 2 || obj.template?.unit !== 'px')
        return obj;
    const dpi = Number(obj.template.dpi) || 300, scale = 96 / dpi;
    const fields = ['x', 'y', 'w', 'h', 'fontSize', 'borderWidth', 'radius', 'letterSpacing', 'imgOffsetX', 'imgOffsetY'];
    const scaleFields = (e) => {
        if (!e)
            return;
        for (const name of fields)
            if (typeof e[name] === 'number')
                e[name] *= scale;
        if (e.imageFit === 'free' && typeof e.imgScale === 'number')
            e.imgScale *= scale;
    };
    for (const e of obj.template.elements)
        scaleFields(e);
    for (const c of obj.cards || []) {
        for (const e of c.extraElements || [])
            scaleFields(e);
        for (const override of Object.values(c.overrides || {}))
            scaleFields(override);
    }
    obj.version = 2;
    return obj;
}
// Legacy card-only "opacity" overrides must win over new component defaults.
// For old elements missing the component properties, opacityFor supplies the fallback.
function migrateComponentOpacities(obj) {
    for (const c of obj.cards || [])
        for (const override of Object.values(c.overrides || {})) {
            if (typeof override.opacity === 'number')
                for (const part of ['fillOpacity', 'borderOpacity', 'textOpacity']) {
                    if (override[part] === undefined)
                        override[part] = override.opacity;
                }
        }
    return obj;
}
async function openJSON(file, onlyTemplate = false, handle = null) {
    try {
        const obj = migrateComponentOpacities(migrateProjectUnits(JSON.parse(await file.text())));
        if (!obj.template?.elements || !Array.isArray(obj.template.elements))
            throw Error('Not a Card Studio project or template');
        if (onlyTemplate && obj.type === 'cardstudio-project')
            throw Error('This is a project file, not a template. Use Open project instead.');
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
            templateFileHandle = handle;
            (0, dom_1.toast)('Template loaded. Existing staged cards reset.');
        }
        else {
            if (!Array.isArray(obj.cards) || !Array.isArray(obj.sets))
                throw Error('Project does not contain cards and image sets');
            (0, model_1.replaceState)({ ...(0, model_1.initial)(), ...obj, mode: 'template', selected: null, cardIndex: 0 });
            image_sets_1.imageCache.clear();
            projectFileHandle = handle;
            templateFileHandle = null;
            (0, dom_1.toast)('Project loaded');
        }
        (0, interface_1.repaint)();
        return true;
    }
    catch (err) {
        alert('Could not open file: ' + err.message);
        return false;
    }
}

},
"resize": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resizedRect = resizedRect;
exports.locksImageCornerAspect = locksImageCornerAspect;
const clamp = (n, a, b) => Math.max(a, Math.min(n, b));
const precision = (n) => Math.round(n * 1000) / 1000;
/**
 * Opposite edges/corners stay anchored. Side handles track the pointer directly.
 * For corner aspect-lock, the pointer delta is projected onto the original
 * rectangle's aspect-ratio diagonal (the nearest constrained handle position).
 * No previously computed rectangle is used as a new drag origin.
 */
function resizedRect(start, handle, dx, dy, stage, lockCornerAspect = false) {
    const west = handle.includes('w'), east = handle.includes('e');
    const north = handle.includes('n'), south = handle.includes('s');
    const right = start.x + start.w, bottom = start.y + start.h;
    const minSize = 5;
    const minLeft = -start.w + 4, minTop = -start.h + 4;
    const maxRight = stage.w * 3, maxBottom = stage.h * 3;
    if (lockCornerAspect && (west || east) && (north || south) && start.w > 0 && start.h > 0) {
        const dw = (east ? 1 : -1) * dx;
        const dh = (south ? 1 : -1) * dy;
        // Orthogonal projection onto the scale direction. This handles drags in
        // either direction, including reversing before pointerup, without drift.
        const scaleDelta = (start.w * dw + start.h * dh) / (start.w * start.w + start.h * start.h);
        const widthLimit = east ? maxRight - start.x : right - minLeft;
        const heightLimit = south ? maxBottom - start.y : bottom - minTop;
        const minScale = Math.max(minSize / start.w, minSize / start.h);
        const maxScale = Math.max(minScale, Math.min(widthLimit / start.w, heightLimit / start.h));
        const scale = clamp(1 + scaleDelta, minScale, maxScale);
        const width = start.w * scale, height = start.h * scale;
        return { x: precision(west ? right - width : start.x), y: precision(north ? bottom - height : start.y), w: precision(width), h: precision(height) };
    }
    let left = start.x, top = start.y, r = right, b = bottom;
    if (west)
        left = clamp(start.x + dx, minLeft, right - minSize);
    if (east)
        r = clamp(right + dx, start.x + minSize, maxRight);
    if (north)
        top = clamp(start.y + dy, minTop, bottom - minSize);
    if (south)
        b = clamp(bottom + dy, start.y + minSize, maxBottom);
    return { x: precision(left), y: precision(top), w: precision(r - left), h: precision(b - top) };
}
/** Preserve image/frame proportions only for fit modes when a corner is dragged. */
function locksImageCornerAspect(kind, fit, handle) {
    return kind === 'image' && /^(nw|ne|sw|se)$/.test(handle) &&
        ['contain', 'cover', 'width', 'height'].includes(fit);
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
"text-layout": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.layoutTextBox = layoutTextBox;
const margin = (n) => Math.max(0, Number(n) || 0);
const isFinitePositive = (n) => Number.isFinite(n) && n > 0;
function fontCSS(e, size) {
    const name = String(e.font || 'Georgia').replace(/["\\]/g, '');
    return `${e.italic ? 'italic ' : ''}${e.fontWeight || 400} ${size}px "${name}"`;
}
const canvasCache = new WeakMap();
function measureContext() {
    if (typeof document === 'undefined')
        return null;
    let ctx = canvasCache.get(document);
    if (!ctx) {
        ctx = document.createElement('canvas')?.getContext?.('2d') || null;
        if (ctx)
            canvasCache.set(document, ctx);
    }
    return ctx || null;
}
function widthOf(text, ctx, size, spacing) {
    const base = ctx?.measureText?.(text)?.width ?? [...text].length * size * .53;
    // Some 2D contexts do not support letterSpacing. Emulate CSS spacing in that case.
    const extra = ctx && 'letterSpacing' in ctx ? 0 : Math.max(0, [...text].length - 1) * spacing;
    return Math.max(0, base + extra);
}
function lineWrap(value, maxWidth, width) {
    const result = [];
    for (const para of String(value ?? '').replace(/\r\n?/g, '\n').split('\n')) {
        if (!para) {
            result.push('');
            continue;
        }
        let line = '';
        for (const word of para.split(/\s+/)) {
            if (width(word) > maxWidth) {
                if (line) {
                    result.push(line);
                    line = '';
                }
                let part = '';
                for (const ch of [...word]) {
                    if (part && width(part + ch) > maxWidth) {
                        result.push(part);
                        part = ch;
                    }
                    else
                        part += ch;
                }
                line = part;
            }
            else if (line && width(line + ' ' + word) > maxWidth) {
                result.push(line);
                line = word;
            }
            else
                line += (line ? ' ' : '') + word;
        }
        result.push(line);
    }
    return result;
}
/**
 * Stored x/y/w/h define the anchor rectangle. Auto width grows right from a left
 * anchor, symmetrically from centre, or left from a right anchor. Auto height grows
 * down from top, symmetrically from middle, or up from bottom.
 * All computed dimensions are transient, so per-card text never changes the template.
 */
function layoutTextBox(e, value) {
    const fontPx = Math.max(1, Number(e.fontSize) || 16) * 96 / 72;
    const linePx = fontPx * (isFinitePositive(Number(e.lineHeight)) ? Number(e.lineHeight) : 1.2);
    const left = margin(e.gutterLeft), right = margin(e.gutterRight), top = margin(e.gutterTop), bottom = margin(e.gutterBottom);
    const ctx = measureContext();
    const spacing = Number(e.letterSpacing) || 0;
    if (ctx) {
        ctx.font = fontCSS(e, fontPx);
        if ('letterSpacing' in ctx)
            ctx.letterSpacing = spacing + 'px';
    }
    const measure = (t) => widthOf(t, ctx, fontPx, spacing);
    const str = String(value ?? '').replace(/\r\n?/g, '\n');
    const autoW = e.autoWidth === true, autoH = e.autoHeight === true;
    const naturalLines = str.split('\n');
    const maxLine = Math.max(0, ...naturalLines.map(measure));
    const w = autoW ? Math.max(1, Math.ceil(maxLine + left + right + 2)) : Math.max(1, e.w);
    const innerW = Math.max(1, w - left - right);
    const lines = autoW ? naturalLines : lineWrap(str, innerW, measure);
    const textHeight = lines.length * linePx;
    const h = autoH ? Math.max(1, Math.ceil(textHeight + top + bottom)) : Math.max(1, e.h);
    const x = e.x + (autoW ? (e.align === 'right' ? e.w - w : e.align === 'center' ? (e.w - w) / 2 : 0) : 0);
    const y = e.y + (autoH ? (e.valign === 'bottom' ? e.h - h : e.valign === 'middle' ? (e.h - h) / 2 : 0) : 0);
    return { x, y, w, h, left, right, top, bottom, innerW, innerH: Math.max(1, h - top - bottom), fontPx, linePx, lines, textHeight };
}

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
