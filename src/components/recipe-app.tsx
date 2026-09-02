"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createRecipeRepository } from "@/lib/recipes/supabase-repository";
import type { Recipe, RecipeRepository } from "@/lib/recipes/types";

const emptyIngredient = () => ({ name: "", amount: "", unit: "g" });
const emptyStep = () => ({ text: "", image: "" });

async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let quality = 0.86;
  let blob: Blob | null = null;
  do {
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    quality -= 0.12;
  } while (blob && blob.size > 500_000 && quality >= 0.26);
  if (!blob) throw new Error("画像を処理できませんでした");
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function RecipeApp({ repository }: { repository?: RecipeRepository }) {
  const dataSource = useMemo<RecipeRepository>(() => {
    if (repository) return repository;
    try { return createRecipeRepository(); }
    catch { return { list: async () => { throw new Error("Supabase is not configured"); }, create: async () => { throw new Error("Supabase is not configured"); } }; }
  }, [repository]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("すべて");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("主菜");
  const [tags, setTags] = useState("");
  const [image, setImage] = useState("");
  const [ingredients, setIngredients] = useState([emptyIngredient()]);
  const [steps, setSteps] = useState([emptyStep()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState("");
  const filterTags = ["すべて", "朝ごはん", "主菜", "パスタ", "ごはん", "野菜", "おやつ"];
  const pageCount = Math.max(1, Math.ceil(total / 9));

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    const timer = window.setTimeout(() => {
      dataSource.list({ query, category: activeTag, page }).then((result) => {
        if (active) { setRecipes(result.recipes); setTotal(result.total); }
      }).catch(() => active && setError("レシピを読み込めませんでした。時間をおいて再度お試しください。"))
        .finally(() => active && setLoading(false));
      const params = new URLSearchParams();
      if (query) params.set("q", query); if (activeTag !== "すべて") params.set("category", activeTag); if (page > 1) params.set("page", String(page));
      window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [activeTag, dataSource, page, query]);

  const loadImage = async (event: ChangeEvent<HTMLInputElement>, onLoad: (url: string) => void) => {
    const file = event.target.files?.[0];
    if (file) try { setImageBusy(true); onLoad(await compressImage(file)); } catch { setError("画像を処理できませんでした。別の画像をお試しください。"); } finally { setImageBusy(false); }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const cleanIngredients = ingredients.filter((item) => item.name.trim());
    const cleanSteps = steps.filter((step) => step.text.trim());
    setSaving(true); setError("");
    try {
      await dataSource.create({ title: title.trim(), description: description.trim(), category, coverImage: image, tags: tags.split(/[、,\s]+/).filter(Boolean), ingredients: cleanIngredients, steps: cleanSteps });
      setTitle(""); setDescription(""); setTags(""); setImage(""); setIngredients([emptyIngredient()]); setSteps([emptyStep()]); setFormOpen(false); setPage(1);
      const result = await dataSource.list({ query, category: activeTag, page: 1 }); setRecipes(result.recipes); setTotal(result.total);
    } catch { setError("レシピを保存できませんでした。入力内容と通信状況をご確認ください。"); }
    finally { setSaving(false); }
  };

  return <>
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Kitchen Note ホーム"><span className="brand-mark">KITCHEN</span><span>NOTE</span></a>
      <nav aria-label="メインナビゲーション"><a className="active" href="#recipes">レシピ</a><a href="#categories">カテゴリ</a><a href="#about">このアプリについて</a></nav>
      <button className="new-button" onClick={() => setFormOpen(true)}><span>＋</span> 新しいレシピ</button>
    </header>

    <main id="top">
      <section className="hero">
        <div className="eyebrow">MY RECIPE COLLECTION</div>
        <h1>お気に入りの味を、<br/><em>ずっと手元に。</em></h1>
        <p>作って、残して、また作る。<br/>あなただけのレシピ帳を育てましょう。</p>
        <div className="hero-line" />
      </section>

      <section className="collection" id="recipes">
        <div className="section-heading"><div><span className="section-no">01</span><h2>わたしのレシピ</h2></div><p>{total} RECIPES</p></div>
        <div className="search-row">
          <label className="search"><span>⌕</span><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="料理名、材料、タグから検索" /></label>
          <div className="filter" id="categories">{filterTags.map((tag) => <button key={tag} className={activeTag === tag ? "selected" : ""} onClick={() => { setActiveTag(tag); setPage(1); }}>{tag}</button>)}</div>
        </div>

        {error && <div className="status error" role="alert">{error}</div>}
        {loading ? <div className="status" role="status">レシピを読み込んでいます…</div> : recipes.length ? <div className="recipe-grid">{recipes.map((recipe, index) => <article className="recipe-card" key={recipe.id}>
          <div className="card-image">{recipe.image && <Image src={recipe.image} alt={`${recipe.title}の完成写真`} fill sizes="(max-width: 700px) 100vw, (max-width: 1050px) 50vw, 33vw" unoptimized={recipe.image.startsWith("data:")} />}<span className="card-number">{String((page - 1) * 9 + index + 1).padStart(2, "0")}</span><span className="time">◷ {recipe.time}</span></div>
          <div className="card-body"><div className="tags">{recipe.tags.map((tag) => <button key={tag} onClick={() => { setQuery(tag); setPage(1); }}>#{tag}</button>)}</div><h3>{recipe.title}</h3><p>{recipe.description}</p><button className="detail">レシピを見る <span>→</span></button></div>
        </article>)}</div> : <div className="empty"><strong>レシピが見つかりませんでした</strong><p>検索ワードやカテゴリを変えてお試しください。</p></div>}
        {pageCount > 1 && <div className="pagination"><button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>←</button>{Array.from({ length: pageCount }, (_, i) => <button key={i} className={page === i + 1 ? "current" : ""} onClick={() => setPage(i + 1)}>{i + 1}</button>)}<button disabled={page === pageCount} onClick={() => setPage((p) => p + 1)}>→</button></div>}
      </section>
    </main>

    <footer id="about"><div className="brand footer-brand"><span className="brand-mark">KITCHEN</span><span>NOTE</span></div><p>毎日の「おいしい」を、記憶に。</p><small>© 2026 KITCHEN NOTE</small></footer>

    {formOpen && <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setFormOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
      <div className="modal-head"><div><span className="eyebrow">NEW RECIPE</span><h2 id="form-title">新しいレシピ</h2></div><button className="close" type="button" onClick={() => setFormOpen(false)} aria-label="閉じる">×</button></div>
      <form onSubmit={save}>
        <label>レシピ名 <span>必須</span><input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：わが家の肉じゃが" /></label>
        <label>ひとことメモ<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="レシピの特徴や思い出を書いてください" /></label>
        <label>カテゴリ <span>必須</span><select value={category} onChange={(e) => setCategory(e.target.value)}>{filterTags.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>タグ<input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="和食、作り置き（スペースや読点で区切る）" /></label>
        <fieldset><legend>完成写真 <span>必須</span></legend><label className={`upload ${image ? "has-image" : ""}`}>{image ? <Image src={image} alt="完成写真のプレビュー" fill unoptimized /> : <><b>＋</b><strong>写真を選ぶ</strong><small>自動で約500KB以下に圧縮します</small></>}<input required={!image} type="file" accept="image/*" onChange={(e) => loadImage(e, setImage)} /></label></fieldset>
        <fieldset><div className="field-head"><legend>材料 <small>1人前</small></legend><button type="button" onClick={() => setIngredients((v) => [...v, emptyIngredient()])}>＋ 材料を追加</button></div>{ingredients.map((item, index) => <div className="ingredient-row" key={index}><input required placeholder="材料名" value={item.name} onChange={(e) => setIngredients((v) => v.map((x, i) => i === index ? { ...x, name: e.target.value } : x))}/><input required type="number" step="any" placeholder="数量" value={item.amount} onChange={(e) => setIngredients((v) => v.map((x, i) => i === index ? { ...x, amount: e.target.value } : x))}/><select value={item.unit} onChange={(e) => setIngredients((v) => v.map((x, i) => i === index ? { ...x, unit: e.target.value } : x))}><option>g</option><option>ml</option><option>個</option><option>本</option><option>枚</option><option>大さじ</option><option>小さじ</option><option>適量</option></select><button type="button" aria-label={`材料${index + 1}を削除`} disabled={ingredients.length === 1} onClick={() => setIngredients((v) => v.filter((_, i) => i !== index))}>−</button></div>)}</fieldset>
        <fieldset><div className="field-head"><legend>作り方</legend><button type="button" onClick={() => setSteps((v) => [...v, emptyStep()])}>＋ 工程を追加</button></div>{steps.map((step, index) => <div className="step-row" key={index}><span>{index + 1}</span><textarea required value={step.text} onChange={(e) => setSteps((v) => v.map((x, i) => i === index ? { ...x, text: e.target.value } : x))} placeholder="工程を入力してください"/><label className="step-photo">{step.image ? "✓ 写真あり" : "▧ 写真"}<input type="file" accept="image/*" onChange={(e) => loadImage(e, (url) => setSteps((v) => v.map((x, i) => i === index ? { ...x, image: url } : x)))}/></label><button type="button" aria-label={`工程${index + 1}を削除`} disabled={steps.length === 1} onClick={() => setSteps((v) => v.filter((_, i) => i !== index))}>−</button></div>)}</fieldset>
        {imageBusy && <div className="status" role="status">画像を圧縮しています…</div>}
        <div className="form-actions"><button type="button" disabled={saving} onClick={() => setFormOpen(false)}>キャンセル</button><button className="save" disabled={saving || imageBusy} type="submit">{saving ? "保存中…" : "レシピを保存する →"}</button></div>
      </form>
    </section></div>}
  </>;
}
