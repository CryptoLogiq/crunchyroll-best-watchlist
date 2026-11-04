/* Shadow DOM styles: compact controls, responsive toolbar, stable card actions. */
BWL.styles = `
:host {
  display:block; color:#eee; background:#17191d; border:1px solid #444;
  border-radius:10px; padding:16px; margin:16px auto; max-width:1200px;
  font-family:inherit; font-size:14px; line-height:1.4; container-type:inline-size;
}
* { box-sizing:border-box }
[hidden] { display:none!important }
h2 { font-size:20px; margin:0 0 4px }
p { line-height:1.45 }
.audio-help { font-size:12px; color:#bfc2c8 }
small { color:#bfc2c8; font-size:11px }
button,select,input {
  font:inherit; color:inherit; background:#292d33; border:1px solid #666;
  border-radius:6px; padding:6px 8px; min-height:32px;
}
button { cursor:pointer }
button[aria-pressed=true] { border-color:#ff9b50; color:#ffb47d }
button:disabled { opacity:.5 }
button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible {
  outline:3px solid #ffb47d; outline-offset:2px;
}
nav,.grid { display:flex; gap:10px; flex-wrap:wrap }
nav { gap:6px; margin-top:8px }
nav button { font-size:13px }
[role=status] { margin:8px 0; color:#bfc2c8; font-size:12px; overflow-wrap:anywhere }
label { display:block; margin:12px 0 }
label select { display:block; margin-top:5px }
select { width:100%; max-width:100%; min-width:0 }
input[type=checkbox] { min-height:0; margin:0 7px 0 0; accent-color:#ff9b50 }
input[type=search] { width:100%; margin:12px 0; min-width:0 }
.list-heading { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:10px 0 8px }
.view-title { font-size:15px; margin:0 }
.toggle-cards { font-size:12px; padding:5px 8px }
.filters {
  display:grid; grid-template-columns:minmax(90px,.8fr) minmax(130px,1.25fr) minmax(110px,1fr) auto minmax(170px,1.3fr);
  gap:8px; align-items:end; margin:0 0 12px;
}
.filters label { margin:0; min-width:0; font-size:11px; color:#bfc2c8 }
.filters select,.filters input[type=search] { margin:3px 0 0; font-size:13px; color:#eee; height:32px }
.filters .favorites-first { display:flex; align-items:center; align-self:end; height:32px; white-space:nowrap; font-size:12px }
.filters .list-search { min-width:0 }
.filters.without-viewing { grid-template-columns:minmax(90px,.8fr) minmax(130px,1.25fr) auto minmax(170px,1.3fr) }
@container (max-width:850px) {
  .filters { grid-template-columns:repeat(3,minmax(0,1fr)) }
  .filters.without-viewing { grid-template-columns:repeat(2,minmax(0,1fr)) }
  .filters .list-search { grid-column:span 2 }
}
@container (max-width:520px) {
  .filters { grid-template-columns:repeat(2,minmax(0,1fr)) }
  .filters .list-search { grid-column:1 / -1 }
  .list-heading { flex-wrap:wrap }
}
article {
  display:flex; flex-direction:column; min-height:320px; width:240px; max-width:100%;
  min-width:0; padding:14px; border:1px solid #555; border-radius:8px; overflow-wrap:anywhere;
}
article img { width:100%; max-height:140px; object-fit:cover; margin-top:10px }
.thumbnail { display:block; position:relative; margin-top:10px; line-height:0 }
.thumbnail img { display:block; margin-top:0 }
.rating-badge {
  position:absolute; top:6px; right:6px; padding:5px 7px; border-radius:5px;
  background:rgba(0,0,0,.85); color:#ffd166; font-size:12px; line-height:1.2; font-weight:600;
}
a { color:#ffb47d; font-weight:bold }
.card-heading { display:flex; align-items:flex-start; gap:10px }
.card-heading>a { flex:1; min-width:0 }
.card-heading>.favorite { flex:none }
.card-actions { display:flex; justify-content:flex-end; gap:6px; margin-top:auto; padding-top:16px }
.episode-link { margin-right:auto; align-self:center; font-size:13px; text-decoration:none }
.card-heading button,.card-actions button { width:36px; min-height:36px; padding:6px }
.visibility { vertical-align:middle; line-height:0 }
.visibility .hover-icon { display:none }
.visibility:hover .rest-icon,.visibility:focus .rest-icon { display:none }
.visibility:hover .hover-icon,.visibility:focus .hover-icon { display:inline }
.empty-state { width:100%; padding:16px; border:1px dashed #555; border-radius:8px }
.placeholder-card { min-height:320px; padding:14px; border:1px solid #555; border-radius:8px; max-width:100%; pointer-events:none }
.skeleton { background:#30343b; border-radius:5px; height:14px; margin-bottom:14px }
.skeleton.image { height:120px }
.skeleton.short { width:60% }
`;
