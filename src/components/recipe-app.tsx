"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createRecipeRepository, RecipeRepositoryError } from "@/lib/recipes/supabase-repository";
import type { Recipe, RecipeRepository } from "@/lib/recipes/types";

const emptyIngredient = () => ({ name: "", amount: "", unit: "g" });
const emptyStep = () => ({ text: "", image: "" });
const IMAGE_TIMEOUT_MS = 15_000;
const MAX_IMAGE_PIXELS = 40_000_000;

async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("対応していないファイル形式です。");
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) {
      throw new Error("画像のサイズが大きすぎます。");
    }
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("画像処理を開始できませんでした。");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let quality = 0.86;
    let blob: Blob | null = null;
    do {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      quality -= 0.12;
    } while (blob && blob.size > 500_000 && quality >= 0.26);
    if (!blob) throw new Error("画像をJPEGへ変換できませんでした。");
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("画像を読み込めませんでした。"));
      reader.onerror = () => reject(reader.error ?? new Error("画像を読み込めませんでした。"));
      reader.onabort = () => reject(new Error("画像の読み込みをキャンセルしました。"));
      reader.readAsDataURL(blob);
    });
  } finally {
    bitmap?.close();
  }
}

function loadErrorMessage(error: unknown) {
  if (!(error instanceof RecipeRepositoryError)) return "レシピを読み込めませんでした。時間をおいて再度お試しください。";
  if (error.code === "configuration") return "Supabaseの接続設定がありません。管理者に環境変数の確認を依頼してください。";
  if (error.code === "anonymous-auth-disabled") return "匿名認証が無効です。管理者にAnonymous Sign-Inの設定確認を依頼してください。";
  if (error.code === "migration-missing") return "データベースの準備が完了していません。管理者にMigrationの適用確認を依頼してください。";
  if (error.code === "permission-denied") return "データベースの権限設定が不足しています。管理者にData API・GRANT・RLSの確認を依頼してください。";
  return "Supabaseに接続できませんでした。通信状況を確認して再読み込みしてください。";
}

export function RecipeApp({ repository }: { repository?: RecipeRepository }) {
  const dataSource = useMemo<RecipeRepository>(() => {
    if (repository) return repository;
    try { return createRecipeRepository(); }
    catch (error) { return { list: async () => { throw error; }, get: async () => { throw error; }, create: async () => { throw error; }, update: async () => { throw error; }, delete: async () => { throw error; } }; }
  }, [repository]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("すべて");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingRecipe, setDeletingRecipe] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("主菜");
  const [tags, setTags] = useState("");
  const [image, setImage] = useState("");
  const [ingredients, setIngredients] = useState([emptyIngredient()]);
  const [steps, setSteps] = useState<Recipe["steps"]>([emptyStep()]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [imageError, setImageError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const imageOperation = useRef(0);
  const filterTags = ["すべて", "朝ごはん", "主菜", "パスタ", "ごはん", "野菜", "おやつ"];
  const pageCount = Math.max(1, Math.ceil(total / 9));

  const resetForm = () => {
    setTitle(""); setDescription(""); setCategory("主菜"); setTags(""); setImage("");
    setIngredients([emptyIngredient()]); setSteps([emptyStep()]); setEditingId(null);
    setFormError(""); setImageError("");
  };

  const openNewRecipe = () => { resetForm(); setFormOpen(true); };

  const openDetail = async (recipe: Recipe) => {
    setSelectedRecipe(recipe); setDetailLoading(true); setDetailError("");
    window.history.pushState({ recipeId: recipe.id }, "", `?recipe=${recipe.id}`);
    try { setSelectedRecipe(await dataSource.get(recipe.id)); }
    catch (error) { setDetailError(loadErrorMessage(error)); }
    finally { setDetailLoading(false); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeDetail = () => {
    setSelectedRecipe(null); setDetailError("");
    window.history.pushState(null, "", window.location.pathname);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const editRecipe = () => {
    if (!selectedRecipe) return;
    setEditingId(selectedRecipe.id); setTitle(selectedRecipe.title); setDescription(selectedRecipe.description);
    setCategory(selectedRecipe.category); setTags(selectedRecipe.tags.join("、")); setImage(selectedRecipe.image);
    setIngredients(selectedRecipe.ingredients.length ? selectedRecipe.ingredients : [emptyIngredient()]);
    setSteps(selectedRecipe.steps.length ? selectedRecipe.steps : [emptyStep()]); setFormError(""); setImageError(""); setFormOpen(true);
  };

  useEffect(() => {
    let active = true;
    setLoadingRecipes(true); setLoadError("");
    const timer = window.setTimeout(() => {
      dataSource.list({ query, category: activeTag, page }).then((result) => {
        if (active) { setRecipes(result.recipes); setTotal(result.total); }
      }).catch((error) => {
        if (process.env.NODE_ENV !== "production") console.error("Failed to load recipes", error);
        if (active) setLoadError(loadErrorMessage(error));
      }).finally(() => active && setLoadingRecipes(false));
      const params = new URLSearchParams();
      if (query) params.set("q", query); if (activeTag !== "すべて") params.set("category", activeTag); if (page > 1) params.set("page", String(page));
      window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [activeTag, dataSource, page, query, reloadKey]);

  const loadImage = async (event: ChangeEvent<HTMLInputElement>, onLoad: (url: string) => void) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const operation = ++imageOperation.current;
    setProcessingImage(true); setImageError("");
    let timeoutId = 0;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error("画像処理がタイムアウトしました。")), IMAGE_TIMEOUT_MS);
      });
      const url = await Promise.race([compressImage(file), timeout]);
      if (imageOperation.current === operation) onLoad(url);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") console.error("Failed to process image", error);
      if (imageOperation.current === operation) setImageError(error instanceof Error ? error.message : "画像を処理できませんでした。別の画像をお試しください。");
    } finally {
      window.clearTimeout(timeoutId);
      if (imageOperation.current === operation) setProcessingImage(false);
    }
  };

  const cancelImageProcessing = () => {
    imageOperation.current += 1;
    setProcessingImage(false);
    setImageError("画像処理をキャンセルしました。同じ画像を再選択できます。");
  };

  const hasIngredients = ingredients.some((item) => item.name.trim() && item.amount !== "");
  const hasSteps = steps.some((step) => step.text.trim());
  const canSubmit = !savingRecipe && !processingImage && title.trim() !== "" && image !== "" && hasIngredients && hasSteps;
  const submitHint = processingImage ? "画像処理の完了後に保存できます。" : !image ? "完成写真を選択してください。" : !title.trim() ? "レシピ名を入力してください。" : !hasIngredients ? "材料を入力してください。" : !hasSteps ? "作り方を入力してください。" : "";

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!image) { setImageError("完成写真を選択してください。"); return; }
    const cleanIngredients = ingredients.filter((item) => item.name.trim());
    const cleanSteps = steps.filter((step) => step.text.trim());
    setSavingRecipe(true); setFormError("");
    try {
      const input = { title: title.trim(), description: description.trim(), category, coverImage: image, imagePath: selectedRecipe?.imagePath, tags: tags.split(/[、,\s]+/).filter(Boolean), ingredients: cleanIngredients, steps: cleanSteps };
      if (editingId) {
        await dataSource.update(editingId, input);
        setSelectedRecipe(await dataSource.get(editingId));
      } else await dataSource.create(input);
      resetForm(); setFormOpen(false); setPage(1);
      try {
        const result = await dataSource.list({ query, category: activeTag, page: 1 });
        setRecipes(result.recipes); setTotal(result.total); setLoadError("");
      } catch (error) {
        if (process.env.NODE_ENV !== "production") console.error("Failed to reload recipes after save", error);
        setLoadError(loadErrorMessage(error));
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") console.error("Failed to save recipe", error);
      setFormError("レシピを保存できませんでした。入力内容と通信状況をご確認ください。");
    } finally { setSavingRecipe(false); }
  };

  const removeRecipe = async () => {
    if (!selectedRecipe || !window.confirm(`「${selectedRecipe.title}」を削除しますか？\nこの操作は取り消せません。`)) return;
    setDeletingRecipe(true); setDetailError("");
    try { await dataSource.delete(selectedRecipe.id); closeDetail(); setReloadKey((value) => value + 1); }
    catch (error) { setDetailError(error instanceof Error ? "レシピを削除できませんでした。通信状況をご確認ください。" : loadErrorMessage(error)); }
    finally { setDeletingRecipe(false); }
  };

  return <>
    <header className="site-header">
      <button className="brand brand-button" onClick={closeDetail} aria-label="Kitchen Note ホーム"><span className="brand-mark">KITCHEN</span><span>NOTE</span></button>
      <nav aria-label="メインナビゲーション"><button className="nav-home" onClick={closeDetail}>ホーム</button><a className="active" href="#recipes" onClick={() => selectedRecipe && closeDetail()}>レシピ</a><a href="#categories">カテゴリ</a><a href="#about">このアプリについて</a></nav>
      <button className="new-button" onClick={openNewRecipe}><span>＋</span> 新しいレシピ</button>
    </header>

    {selectedRecipe ? <main id="top" className="recipe-detail-page">
      <div className="detail-toolbar"><button onClick={closeDetail}>← 戻る</button><button onClick={closeDetail}>⌂ ホーム</button></div>
      {detailError && <div className="status error" role="alert">{detailError}</div>}
      <article className="recipe-detail-view">
        <div className="detail-visual">{selectedRecipe.image && <Image src={selectedRecipe.image} alt={`${selectedRecipe.title}の完成写真`} fill priority sizes="(max-width: 800px) 100vw, 50vw" unoptimized={selectedRecipe.image.startsWith("data:")} />}</div>
        <div className="detail-intro"><div className="eyebrow">MY RECIPE / {selectedRecipe.category}</div><h1>{selectedRecipe.title}</h1><p className="detail-description">{selectedRecipe.description || "大切なレシピの記録。"}</p><div className="detail-meta"><span>登録日 {selectedRecipe.time}</span><span>1人前</span></div><div className="detail-tags">{selectedRecipe.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div><div className="detail-actions"><button className="edit-action" onClick={editRecipe} disabled={detailLoading}>✎ 編集する</button><button className="delete-action" onClick={removeRecipe} disabled={deletingRecipe}>{deletingRecipe ? "削除中…" : "削除する"}</button></div></div>
        <section className="detail-section ingredients-panel"><div className="detail-section-title"><span>01</span><div><small>INGREDIENTS</small><h2>材料</h2></div><b>1人前</b></div><ul>{selectedRecipe.ingredients.map((item, index) => <li key={`${item.name}-${index}`}><span>{item.name}</span><strong>{item.amount} {item.unit}</strong></li>)}</ul></section>
        <section className="detail-section steps-panel"><div className="detail-section-title"><span>02</span><div><small>METHOD</small><h2>作り方</h2></div></div><ol>{selectedRecipe.steps.map((step, index) => <li key={index}><span className="step-number">{String(index + 1).padStart(2, "0")}</span><p>{step.text}</p>{step.image && <div className="detail-step-image"><Image src={step.image} alt={`工程${index + 1}の写真`} fill sizes="240px" unoptimized={step.image.startsWith("data:")} /></div>}</li>)}</ol></section>
      </article>
    </main> : <main id="top">
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

        {loadError && <div className="status error" role="alert"><p>{loadError}</p><button type="button" onClick={() => setReloadKey((value) => value + 1)}>再読み込み</button></div>}
        {loadingRecipes ? <div className="status" role="status">レシピを読み込んでいます…</div> : recipes.length ? <div className="recipe-grid">{recipes.map((recipe, index) => <article className="recipe-card" key={recipe.id}>
          <div className="card-image">{recipe.image && <Image src={recipe.image} alt={`${recipe.title}の完成写真`} fill sizes="(max-width: 700px) 100vw, (max-width: 1050px) 50vw, 33vw" unoptimized={recipe.image.startsWith("data:")} />}<span className="card-number">{String((page - 1) * 9 + index + 1).padStart(2, "0")}</span><span className="time">◷ {recipe.time}</span></div>
          <div className="card-body"><div className="tags">{recipe.tags.map((tag) => <button key={tag} onClick={() => { setQuery(tag); setPage(1); }}>#{tag}</button>)}</div><h3>{recipe.title}</h3><p>{recipe.description}</p><button className="detail" onClick={() => openDetail(recipe)}>レシピを見る <span>→</span></button></div>
        </article>)}</div> : <div className="empty"><strong>レシピが見つかりませんでした</strong><p>検索ワードやカテゴリを変えてお試しください。</p></div>}
        {pageCount > 1 && <div className="pagination"><button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>←</button>{Array.from({ length: pageCount }, (_, i) => <button key={i} className={page === i + 1 ? "current" : ""} onClick={() => setPage(i + 1)}>{i + 1}</button>)}<button disabled={page === pageCount} onClick={() => setPage((p) => p + 1)}>→</button></div>}
      </section>
    </main>}

    <footer id="about"><div className="brand footer-brand"><span className="brand-mark">KITCHEN</span><span>NOTE</span></div><p>毎日の「おいしい」を、記憶に。</p><small>© 2026 KITCHEN NOTE</small></footer>

    {formOpen && <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setFormOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
      <div className="modal-head"><div><span className="eyebrow">{editingId ? "EDIT RECIPE" : "NEW RECIPE"}</span><h2 id="form-title">{editingId ? "レシピを編集" : "新しいレシピ"}</h2></div><button className="close" type="button" onClick={() => setFormOpen(false)} aria-label="閉じる">×</button></div>
      <form onSubmit={save}>
        <label>レシピ名 <span>必須</span><input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：わが家の肉じゃが" /></label>
        <label>ひとことメモ<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="レシピの特徴や思い出を書いてください" /></label>
        <label>カテゴリ <span>必須</span><select value={category} onChange={(e) => setCategory(e.target.value)}>{filterTags.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>タグ<input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="和食、作り置き（スペースや読点で区切る）" /></label>
        <fieldset><legend>完成写真 <span>必須</span></legend><label className={`upload ${image ? "has-image" : ""}`}>{image ? <Image src={image} alt="完成写真のプレビュー" fill unoptimized /> : <><b>＋</b><strong>写真を選ぶ</strong><small>自動で約500KB以下に圧縮します</small></>}<input type="file" accept="image/*" onChange={(e) => loadImage(e, setImage)} /></label></fieldset>
        <fieldset><div className="field-head"><legend>材料 <small>1人前</small></legend><button type="button" onClick={() => setIngredients((v) => [...v, emptyIngredient()])}>＋ 材料を追加</button></div>{ingredients.map((item, index) => <div className="ingredient-row" key={index}><input required placeholder="材料名" value={item.name} onChange={(e) => setIngredients((v) => v.map((x, i) => i === index ? { ...x, name: e.target.value } : x))}/><input required type="number" step="any" placeholder="数量" value={item.amount} onChange={(e) => setIngredients((v) => v.map((x, i) => i === index ? { ...x, amount: e.target.value } : x))}/><select value={item.unit} onChange={(e) => setIngredients((v) => v.map((x, i) => i === index ? { ...x, unit: e.target.value } : x))}><option>g</option><option>ml</option><option>個</option><option>本</option><option>枚</option><option>大さじ</option><option>小さじ</option><option>適量</option></select><button type="button" aria-label={`材料${index + 1}を削除`} disabled={ingredients.length === 1} onClick={() => setIngredients((v) => v.filter((_, i) => i !== index))}>−</button></div>)}</fieldset>
        <fieldset><div className="field-head"><legend>作り方</legend><button type="button" onClick={() => setSteps((v) => [...v, emptyStep()])}>＋ 工程を追加</button></div>{steps.map((step, index) => <div className="step-row" key={index}><span>{index + 1}</span><textarea required value={step.text} onChange={(e) => setSteps((v) => v.map((x, i) => i === index ? { ...x, text: e.target.value } : x))} placeholder="工程を入力してください"/><label className="step-photo">{step.image ? "✓ 写真あり" : "▧ 写真"}<input type="file" accept="image/*" onChange={(e) => loadImage(e, (url) => setSteps((v) => v.map((x, i) => i === index ? { ...x, image: url } : x)))}/></label><button type="button" aria-label={`工程${index + 1}を削除`} disabled={steps.length === 1} onClick={() => setSteps((v) => v.filter((_, i) => i !== index))}>−</button></div>)}</fieldset>
        {processingImage && <div className="status" role="status">画像を処理中… <button type="button" onClick={cancelImageProcessing}>画像処理をキャンセル</button></div>}
        {imageError && <div className="status error" role="alert">画像エラー: {imageError}</div>}
        {formError && <div className="status error" role="alert">保存エラー: {formError}</div>}
        {submitHint && !imageError && <p className="submit-hint">{submitHint}</p>}
        <div className="form-actions"><button type="button" disabled={savingRecipe} onClick={() => setFormOpen(false)}>キャンセル</button><button className="save" disabled={!canSubmit} type="submit">{savingRecipe ? "保存中…" : processingImage ? "画像を処理中…" : editingId ? "変更を保存する →" : "レシピを保存する →"}</button></div>
      </form>
    </section></div>}
  </>;
}
