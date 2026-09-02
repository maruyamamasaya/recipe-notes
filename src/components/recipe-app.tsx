"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";

type Recipe = {
  id: string;
  title: string;
  description: string;
  image: string;
  time: string;
  tags: string[];
  ingredients: { name: string; amount: string; unit: string }[];
  steps: { text: string; image?: string }[];
};

const seedRecipes: Recipe[] = [
  { id: "1", title: "トマトとバジルのパスタ", description: "フレッシュトマトをたっぷり使った、シンプルな定番パスタ。", image: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=82", time: "25分", tags: ["パスタ", "イタリアン"], ingredients: [{ name: "トマト", amount: "2", unit: "個" }], steps: [{ text: "パスタを茹で、ソースと和える" }] },
  { id: "2", title: "ふわふわパンケーキ", description: "休日の朝に食べたい、しっとり軽やかなパンケーキ。", image: "https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=900&q=82", time: "20分", tags: ["朝ごはん", "スイーツ"], ingredients: [{ name: "小麦粉", amount: "100", unit: "g" }], steps: [{ text: "生地を混ぜて弱火で焼く" }] },
  { id: "3", title: "彩り野菜のキーマカレー", description: "スパイス香る、野菜たっぷりのわが家の定番カレー。", image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=82", time: "40分", tags: ["カレー", "作り置き"], ingredients: [{ name: "ひき肉", amount: "200", unit: "g" }], steps: [{ text: "具材を炒めて煮込む" }] },
  { id: "4", title: "サーモンのハーブグリル", description: "香草とレモンが爽やか。オーブンにおまかせの一皿。", image: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=900&q=82", time: "30分", tags: ["魚料理", "洋食"], ingredients: [{ name: "サーモン", amount: "2", unit: "切れ" }], steps: [{ text: "ハーブをのせて焼く" }] },
  { id: "5", title: "季節野菜のせいろ蒸し", description: "旬の甘みをそのまま味わう、からだにやさしい一品。", image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=82", time: "20分", tags: ["野菜", "ヘルシー"], ingredients: [{ name: "季節の野菜", amount: "300", unit: "g" }], steps: [{ text: "食べやすく切って蒸す" }] },
  { id: "6", title: "鶏肉のクリーム煮", description: "やわらかい鶏肉と濃厚ソース。パンにもよく合います。", image: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=900&q=82", time: "35分", tags: ["鶏肉", "煮込み"], ingredients: [{ name: "鶏もも肉", amount: "300", unit: "g" }], steps: [{ text: "鶏肉を焼き、クリームで煮る" }] },
  { id: "7", title: "アボカドのオープンサンド", description: "サクサクのトーストにアボカドをたっぷり。", image: "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?auto=format&fit=crop&w=900&q=82", time: "10分", tags: ["朝ごはん", "パン"], ingredients: [{ name: "アボカド", amount: "1", unit: "個" }], steps: [{ text: "パンを焼いて具材をのせる" }] },
  { id: "8", title: "ほうじ茶のシフォンケーキ", description: "ふわりと広がるほうじ茶の香り。甘さ控えめのおやつ。", image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=82", time: "60分", tags: ["おやつ", "和スイーツ"], ingredients: [{ name: "卵", amount: "4", unit: "個" }], steps: [{ text: "メレンゲを合わせて焼く" }] },
  { id: "9", title: "えびとレモンのリゾット", description: "えびの旨みとレモンの酸味を楽しむ、軽やかなリゾット。", image: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=900&q=82", time: "35分", tags: ["ごはん", "イタリアン"], ingredients: [{ name: "えび", amount: "8", unit: "尾" }], steps: [{ text: "米を炒め、スープで炊く" }] },
  { id: "10", title: "豚肉と根菜の甘辛煮", description: "ごはんが進む、ほっとする味の煮物。", image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=82", time: "45分", tags: ["豚肉", "和食"], ingredients: [{ name: "豚肉", amount: "200", unit: "g" }], steps: [{ text: "材料を甘辛く煮る" }] },
];

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

export function RecipeApp() {
  const [recipes, setRecipes] = useState(seedRecipes);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("すべて");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [image, setImage] = useState("");
  const [ingredients, setIngredients] = useState([emptyIngredient()]);
  const [steps, setSteps] = useState([emptyStep()]);
  const filterTags = ["すべて", "朝ごはん", "主菜", "パスタ", "ごはん", "野菜", "おやつ"];
  const filtered = useMemo(() => recipes.filter((recipe) => {
    const haystack = [recipe.title, recipe.description, ...recipe.tags, ...recipe.ingredients.map((item) => item.name)].join(" ").toLowerCase();
    return haystack.includes(query.trim().toLowerCase()) && (activeTag === "すべて" || recipe.tags.includes(activeTag));
  }), [recipes, query, activeTag]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 9));
  const shown = filtered.slice((page - 1) * 9, page * 9);

  const loadImage = async (event: ChangeEvent<HTMLInputElement>, onLoad: (url: string) => void) => {
    const file = event.target.files?.[0];
    if (file) onLoad(await compressImage(file));
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    const cleanIngredients = ingredients.filter((item) => item.name.trim());
    const cleanSteps = steps.filter((step) => step.text.trim());
    setRecipes((current) => [{ id: crypto.randomUUID(), title, description, image, time: "新着", tags: tags.split(/[、,\s]+/).filter(Boolean), ingredients: cleanIngredients, steps: cleanSteps }, ...current]);
    setTitle(""); setDescription(""); setTags(""); setImage(""); setIngredients([emptyIngredient()]); setSteps([emptyStep()]); setFormOpen(false); setPage(1);
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
        <div className="section-heading"><div><span className="section-no">01</span><h2>わたしのレシピ</h2></div><p>{filtered.length} RECIPES</p></div>
        <div className="search-row">
          <label className="search"><span>⌕</span><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="料理名、材料、タグから検索" /></label>
          <div className="filter" id="categories">{filterTags.map((tag) => <button key={tag} className={activeTag === tag ? "selected" : ""} onClick={() => { setActiveTag(tag); setPage(1); }}>{tag}</button>)}</div>
        </div>

        {shown.length ? <div className="recipe-grid">{shown.map((recipe, index) => <article className="recipe-card" key={recipe.id}>
          <div className="card-image"><Image src={recipe.image} alt={`${recipe.title}の完成写真`} fill sizes="(max-width: 700px) 100vw, (max-width: 1050px) 50vw, 33vw" unoptimized={recipe.image.startsWith("data:")} /><span className="card-number">{String((page - 1) * 9 + index + 1).padStart(2, "0")}</span><span className="time">◷ {recipe.time}</span></div>
          <div className="card-body"><div className="tags">{recipe.tags.map((tag) => <button key={tag} onClick={() => { setActiveTag(tag); setPage(1); }}>#{tag}</button>)}</div><h3>{recipe.title}</h3><p>{recipe.description}</p><button className="detail">レシピを見る <span>→</span></button></div>
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
        <label>タグ<input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="和食、作り置き（スペースや読点で区切る）" /></label>
        <fieldset><legend>完成写真 <span>必須</span></legend><label className={`upload ${image ? "has-image" : ""}`}>{image ? <Image src={image} alt="完成写真のプレビュー" fill unoptimized /> : <><b>＋</b><strong>写真を選ぶ</strong><small>自動で約500KB以下に圧縮します</small></>}<input required={!image} type="file" accept="image/*" onChange={(e) => loadImage(e, setImage)} /></label></fieldset>
        <fieldset><div className="field-head"><legend>材料 <small>1人前</small></legend><button type="button" onClick={() => setIngredients((v) => [...v, emptyIngredient()])}>＋ 材料を追加</button></div>{ingredients.map((item, index) => <div className="ingredient-row" key={index}><input required placeholder="材料名" value={item.name} onChange={(e) => setIngredients((v) => v.map((x, i) => i === index ? { ...x, name: e.target.value } : x))}/><input required type="number" step="any" placeholder="数量" value={item.amount} onChange={(e) => setIngredients((v) => v.map((x, i) => i === index ? { ...x, amount: e.target.value } : x))}/><select value={item.unit} onChange={(e) => setIngredients((v) => v.map((x, i) => i === index ? { ...x, unit: e.target.value } : x))}><option>g</option><option>ml</option><option>個</option><option>本</option><option>枚</option><option>大さじ</option><option>小さじ</option><option>適量</option></select><button type="button" aria-label={`材料${index + 1}を削除`} disabled={ingredients.length === 1} onClick={() => setIngredients((v) => v.filter((_, i) => i !== index))}>−</button></div>)}</fieldset>
        <fieldset><div className="field-head"><legend>作り方</legend><button type="button" onClick={() => setSteps((v) => [...v, emptyStep()])}>＋ 工程を追加</button></div>{steps.map((step, index) => <div className="step-row" key={index}><span>{index + 1}</span><textarea required value={step.text} onChange={(e) => setSteps((v) => v.map((x, i) => i === index ? { ...x, text: e.target.value } : x))} placeholder="工程を入力してください"/><label className="step-photo">{step.image ? "✓ 写真あり" : "▧ 写真"}<input type="file" accept="image/*" onChange={(e) => loadImage(e, (url) => setSteps((v) => v.map((x, i) => i === index ? { ...x, image: url } : x)))}/></label><button type="button" aria-label={`工程${index + 1}を削除`} disabled={steps.length === 1} onClick={() => setSteps((v) => v.filter((_, i) => i !== index))}>−</button></div>)}</fieldset>
        <div className="form-actions"><button type="button" onClick={() => setFormOpen(false)}>キャンセル</button><button className="save" type="submit">レシピを保存する →</button></div>
      </form>
    </section></div>}
  </>;
}
