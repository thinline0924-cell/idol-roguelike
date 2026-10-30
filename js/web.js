// ゲーム内のインターネット(ブックマークから行けるサイトと、検索で見つかるページ)
// どのページも、ゲームの状態(人気・メンバーの様子・事件)を少しずつ映す。
// 掲示板にはメンバーの疲れや不満、交際の気配など、表に出ない情報がにじむ

const WEB = (() => {
  const R = () => Math.random();
  const P = a => a[Math.floor(R() * a.length)];
  const g = () => (S.phase === 'group' && S.g && S.g.name) ? S.g : null;
  const nm = id => C(id).name.split(' ')[1];
  const full = id => C(id).name.replace(' ', '');
  const esc = escapeHtml;
  // 日によって変わるが、同じ日には同じ結果になる乱数
  function seeded(n) { let x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x); }
  const today = () => g() ? g().day : 0;

  // ---------- ライバルグループ ----------
  const RIVALS = [
    { name: 'ネオン少女団', kana: 'ねおんしょうじょだん', agency: 'ネオンエンターテインメント', f0: 4200, gr: .045, peak: 600, desc: '2024年結成。「夜の街のアイドル」を掲げ、深夜帯のライブで支持を集める。' },
    { name: 'すぷりんぐ・ぷりずむ', kana: 'すぷりんぐぷりずむ', agency: 'プリズムレコーズ', f0: 9800, gr: .03, peak: 900, desc: '大手レコード会社が手がける5人組。王道の衣装と楽曲で知られる。' },
    { name: 'Re:VIVID', kana: 'りびびっど', agency: 'ヴィヴィッドミュージック', f0: 2600, gr: .07, peak: 400, desc: 'ダンスに特化した4人組。メンバー全員がダンス大会の入賞経験を持つ。' },
    { name: 'ぱらいそ☆てぃあーず', kana: 'ぱらいそてぃあーず', agency: '有限会社パライソ', f0: 1200, gr: .02, peak: 1200, desc: '「泣ける地下アイドル」として知られる。メンバーの入れ替わりが激しい。' },
    { name: '白昼夢シンドローム', kana: 'はくちゅうむしんどろーむ', agency: 'ドリームファクトリー', f0: 700, gr: .09, peak: 300, desc: 'Zでの動画が話題となり急成長した新興グループ。' },
    { name: 'Lumière', kana: 'るみえーる', agency: 'ミツバ企画', f0: 18000, gr: -.03, peak: 0, desc: 'ミツバ企画所属の6人組。2021年結成。近年はメンバーの休養が続いている。' },
    { name: 'あまいろ革命', kana: 'あまいろかくめい', agency: 'スイートヘブン', f0: 3500, gr: .01, peak: 700, desc: '「甘い歌詞と激しいダンス」で知られる。' },
    { name: '十二月のアリス', kana: 'じゅうにがつのありす', agency: 'ワンダーランド企画', f0: 5100, gr: .025, peak: 500, desc: '童話をモチーフにしたコンセプトグループ。' },
  ];
  // ライバルのフォロワー(日数で増えて、山を越えると減る)
  function rivalFans(r) {
    const d = today(), m = d / 30;
    if (r.name === 'Lumière' && g() && g().flags.lumiEnd) return Math.round(r.f0 * .4);
    const grow = r.peak ? Math.min(m, r.peak / 30) : m;
    const fall = r.peak && d > r.peak ? (d - r.peak) / 30 : 0;
    return Math.max(100, Math.round(r.f0 * Math.pow(1 + r.gr, grow) * Math.pow(.96, fall) * (.97 + seeded(d + r.f0) * .06)));
  }

  // ---------- 掲示板(状態がにじむ) ----------
  const resp = (n, t) => [String(n), '名無しさん', '', t];
  function groupThread() {
    const G0 = g(), posts = [];
    let n = 1;
    const add = t => { n += 1 + Math.floor(R() * 6); posts.push(resp(n, t)); };
    posts.push(resp(1, `ミツバ企画所属「${G0.name}」について語るスレです\n荒らしはスルーで\n\n公式Z: @mitsuba_newgrp`));
    const act = Object.keys(G0.m).filter(id => G0.m[id].status !== 'left');
    const byFans = act.slice().sort((a, b) => G0.m[b].mf - G0.m[a].mf);
    if (byFans.length) add(P([`${G0.name}は${nm(byFans[0])}一強だよな`, `正直${nm(byFans[0])}目当てで行ってる`, `${nm(byFans[0])}の人気だけ抜けてる`]));
    if (byFans.length > 2) add(P([`${nm(byFans[byFans.length - 1])}の列いつもガラガラで見てられない`, `${nm(byFans[byFans.length - 1])}って何担当なの?`, `${nm(byFans[byFans.length - 1])}推しワイ、少数派すぎて肩身が狭い`]));
    act.forEach(id => {
      const m = G0.m[id];
      if (m.status === 'rest') add(P([`${nm(id)}休養って本当の理由なに?`, `${nm(id)}、体調不良って何回目だよ`, `${nm(id)}早く戻ってきて…`]));
      else if (m.fat >= 60) add(P([`${nm(id)}、最近顔色悪くない?`, `${nm(id)}痩せた?心配なんだけど`, `${nm(id)}明らかに疲れてる。運営休ませろ`, `${nm(id)}、特典会で目の下のクマ隠しきれてなかった`]));
      if (m.mood < 30) add(P([`${nm(id)}の笑顔、目が死んでる`, `${nm(id)}、MCで一言もしゃべらなかったな`, `${nm(id)}、最近ブログの更新止まってる`, `${nm(id)}卒業しそう`]));
      else if (m.mood > 80) add(P([`最近の${nm(id)}楽しそうでいい`, `${nm(id)}、なんか吹っ切れた感じある`]));
      if (C(id).gen && C(id).secret !== 'none' && !m.flags.secretFired && R() < .35 && C(id).xsearch && C(id).xsearch[0]) add(C(id).xsearch[0][3]);
    });
    if (G0.love && G0.love.bare >= 20 && G0.m[G0.love.id]) add(P([`Pと${nm(G0.love.id)}、距離近くね?`, `${nm(G0.love.id)}の匂わせ、相手スタッフじゃないの`, `特典会のあと${nm(G0.love.id)}が誰かの車に乗ってたって話`, `${nm(G0.love.id)}、最近Pの方ばっかり見てる気がする`]));
    if (G0.heat >= 30) add(P(['運営また燃えてて草', 'ミツバの炎上体質なんとかしろ', '擁護するのも疲れてきた']));
    if (G0.debt > 0) add(P(['ミツバって金ないらしいね', '物販の値上げえぐい', '衣装が使い回しなの気づいてる?']));
    if (G0.releases.length) { const r = G0.releases[G0.releases.length - 1]; add(r.rank <= 30 ? `「${r.title}」${r.rank}位はすごい` : `「${r.title}」${r.rank}位か…がんばれ`); }
    if (G0.leader && G0.m[G0.leader]) add(P([`リーダーの${nm(G0.leader)}、背負いすぎじゃない?`, `${nm(G0.leader)}がリーダーで正解だった`]));
    G0.zlog.slice(0, 5).forEach(z => add(z[3]));
    add(P(['次スレは>>980', '今日の現場行く人いる?', 'チケットまだある?', '新規だけどおすすめの曲教えて', 'ここ見てるのバレてるらしいぞ']));
    return { type: 'bbs', site: 'アイドル板', title: `【ミツバ】${G0.name} part${2 + Math.floor(G0.turn / 3)}`, posts };
  }
  function memberThread(id) {
    const G0 = g(), m = G0.m[id], posts = [resp(1, `${G0.name}の${full(id)}について語るスレ`)];
    let n = 1;
    const add = t => { n += 1 + Math.floor(R() * 8); posts.push(resp(n, t)); };
    add(P([`${nm(id)}の${['笑顔', '歌声', 'ダンス', 'MC', '塩対応', '神対応'][Math.floor(R() * 6)]}が好き`, `${nm(id)}、推して${Math.max(1, Math.round((G0.day - m.join) / 30))}か月になる`]));
    if (m.fat >= 60) add(`${nm(id)}、最近ずっと疲れてる顔してる`);
    if (m.mood < 30) add(`最近の${nm(id)}、なんか元気ない。ブログも短い`);
    if (m.mf > 2000) add(`${nm(id)}、もうソロでもいけるだろ`);
    if (C(id).age >= 23) add(P([`${nm(id)}、年齢的にそろそろ卒業考えてそう`, `${nm(id)}最年長組だけど一番がんばってる`]));
    if (G0.love && G0.love.id === id && G0.love.bare >= 15) add(P([`${nm(id)}、最近恋してる顔してない?`, `${nm(id)}のZ、深夜の更新が増えた`]));
    const voices = (S.chats.group ? S.chats.group.log : []).filter(l => l[0] === full(id)).slice(-3);
    voices.forEach(v => add(`${nm(id)}のブログ「${v[2]}」って書いてて泣いた`));
    add(P(['次の現場いつだっけ', `${nm(id)}のチェキ、最近撮りやすくなった`, `${nm(id)}は俺が守る`]));
    return { type: 'bbs', site: 'アイドル板', title: `【${G0.name}】${full(id)} part${1 + Math.floor(m.talks / 2)}`, posts };
  }
  function boardIndex(link) {
    const rows = [];
    if (g()) {
      rows.push(link(`【ミツバ】${g().name} part${2 + Math.floor(g().turn / 3)}`, groupThread(), `${120 + Math.floor(R() * 800)}`));
      Object.keys(g().m).filter(id => g().m[id].status !== 'left').forEach(id => rows.push(link(`【${g().name}】${full(id)}`, memberThread(id), `${20 + Math.floor(R() * 300)}`)));
    }
    rows.push(link('【雑談】地下アイドル総合スレ part2841', { type: 'bbs', site: 'アイドル板', title: '【雑談】地下アイドル総合スレ part2841', posts: [resp(1, '地下アイドルについて雑談するスレ'), resp(14, '最近チェキ高くない?2000円は無理'), resp(15, '>>14 3000円のとこもあるぞ'), resp(22, 'ミツバの新しいとこ、どう?'), resp(23, P(['知らん', 'まだ様子見', '一人だけ可愛い子いる', '運営がLumièreと同じなのが不安'])), resp(41, 'オタクの高齢化が止まらない'), resp(42, '>>41 俺のことか')] }, '988'));
    rows.push(link('Lumière アンチスレ part57', { type: 'bbs', site: 'アイドル板', title: 'Lumière アンチスレ part57', posts: [resp(1, 'Lumièreのアンチスレです'), resp(5, 'あかりの休養、運営のせいだろ'), resp(8, 'ミツバは新グループ作る前にLumièreなんとかしろ'), resp(13, '>>8 それな'), resp(20, 'でも曲はいいんだよな')] }, '432'));
    rows.push(link('ミツバ企画を語るスレ', { type: 'bbs', site: '芸能事務所板', title: 'ミツバ企画を語るスレ', posts: [resp(1, '中堅事務所ミツバ企画について'), resp(3, '元社員だけど、部長はいい人。それ以外は…'), resp(7, '新グループの担当、新人Pらしいぞ'), resp(9, g() && g().debt ? '新グループ、もう赤字って本当?' : '新グループ、今のところ評判は悪くない'), resp(12, 'タレントの子たちが一番かわいそう')] }, '157'));
    RIVALS.filter(r => r.name !== 'Lumière').slice(0, 4).forEach(r => rows.push(link(`${r.name} part${10 + Math.floor(R() * 90)}`, { type: 'bbs', site: 'アイドル板', title: `${r.name} part${10 + Math.floor(R() * 90)}`, posts: [resp(1, `${r.name}を語るスレ`), resp(4, P(['今度のワンマン楽しみ', '最近人気出てきて古参は複雑', 'メンバー卒業発表きた…', '新曲が微妙'])), resp(9, g() ? P([`${g().name}と対バンしてたな`, `${g().name}よりは上だろ`, `${g().name}の方が勢いある気がする`]) : 'ミツバの新グループってどうなん')] }, `${100 + Math.floor(R() * 900)}`)));
    return `<div class="site bbs"><div class="bbs-h">アイドル板</div><h1>スレッド一覧</h1><ol class="bbs-idx">${rows.map(r => `<li>${r}</li>`).join('')}</ol></div>`;
  }

  // ---------- Z ----------
  function zhome(link) {
    const trends = [];
    if (g()) {
      if (g().heat >= 40) trends.push([`${g().name}運営`, `${(2 + g().heat / 10).toFixed(1)}万件`]);
      if (g().fans >= 3000) trends.push([g().name, `${Math.round(g().fans / 300) / 10}万件`]);
      const top = Object.keys(g().m).filter(id => g().m[id].status !== 'left').sort((a, b) => g().m[b].mf - g().m[a].mf)[0];
      if (top && g().m[top].mf > 1500) trends.push([nm(top), `${Math.round(g().m[top].mf / 100) / 10}千件`]);
    }
    trends.push([P(['#推し活', '#地下アイドル', '#チェキ', '#新曲']), `${(1 + R() * 9).toFixed(1)}万件`], [RIVALS[Math.floor(seeded(today()) * RIVALS.length)].name, `${(R() * 3).toFixed(1)}万件`], [P(['寒波', '花粉', '大雨', '猛暑日']), `${Math.floor(R() * 30)}万件`]);
    const posts = (g() ? g().zlog.slice(0, 15) : []).concat([
      ['ドル誌ライター', 'dol_writer_k', '', '今年の新人、豊作すぎる。ミツバの新しいグループも気になる', 4, 30, 210, '1.1万'],
      ['在宅おじ', 'zaitaku_oji', '', '配信で見るのが一番コスパいい', 2, 5, 40, '3,200'],
      ['遠征民', 'ensei_tami', '', '夜行バスで東京着いた。今日は3現場', 1, 3, 88, '4,500'],
    ]);
    return `<div class="z"><div class="zcol"><div class="zbar"><span class="zlogo">Z</span><div class="zsearch">${Icons.get('search')}<span>Zを検索</span></div></div>
      <div class="ztabs"><span class="on">おすすめ</span><span>フォロー中</span></div>
      <div class="ztrend"><b>トレンド</b>${trends.map((t, i) => `<div><small>${i + 1}・トレンド</small><div>${link(esc(t[0]), { type: 'xsearch', q: t[0], title: `「${t[0]}」の検索結果 / Z`, posts: trendPosts(t[0]) })}</div><small>${t[1]}のポスト</small></div>`).join('')}</div>
      ${posts.map(p => xPost(...p)).join('')}</div></div>`;
  }
  function trendPosts(q) {
    const base = g() ? g().zlog.filter(z => z[3].includes(q)).slice(0, 8) : [];
    const gen = ['なんでトレンド入ってるの?', `${q}って何?`, `${q}、ついに来たか`, `${q}のこと、ずっと前から推してた`, `${q}で検索したら地獄だった`].map((t, i) => ['名無し', 'user' + (40000000 + i * 1234567), '', t, Math.floor(R() * 20), Math.floor(R() * 60), Math.floor(R() * 400), (Math.floor(R() * 90) + 1) + '00']);
    return base.concat(gen);
  }
  // メンバー個人のZ(グループチャットでの発言がポストとして流れる)
  function memberZ(id) {
    const m = g().m[id];
    const lines = (S.chats.group ? S.chats.group.log : []).filter(l => l[0] === full(id)).slice(-8).reverse();
    const posts = lines.map(l => [(l[1] || '').split(' ')[0] || '', l[2], '♡ ' + Math.max(3, Math.round(m.mf * (.05 + R() * .2))).toLocaleString()]);
    if (!posts.length) posts.push(['', `${g().name}の${nm(id)}です!よろしくお願いします!`, '♡ ' + Math.round(m.mf * .2)]);
    return { type: 'x', title: `${full(id)}(${g().name})(@${C(id).gen ? C(id).id.slice(1, 7) : C(id).id}_official)`, posts };
  }

  // ---------- ニュース ----------
  const WORLD = [
    ['円安で来日公演の中止相次ぐ', '海外アーティストの来日公演の中止や延期が相次いでいる。円安による経費の高騰が背景にあるとみられる。'],
    ['「推し活」の平均出費、月2.3万円 民間調査', '民間の調査会社によると、「推し活」にかける費用は月平均2万3千円だった。最も多い使い道は「チケット代」。'],
    ['ライブハウスの閉店相次ぐ 家賃と人件費の高騰で', '都内の小規模ライブハウスの閉店が相次いでいる。「若いバンドやアイドルの出る場所がなくなる」と関係者は危機感を募らせる。'],
    ['アイドルの労働環境、業界団体が指針案', '業界団体は、未成年のアイドルの深夜労働や長時間の拘束を防ぐための指針案をまとめた。罰則はない。'],
    ['チケット転売、摘発が過去最多に', '人気公演のチケットを高額で転売したとして摘発された件数が過去最多となった。'],
    ['SNSの誹謗中傷、開示請求が5年で3倍', 'SNS上の誹謗中傷について、発信者情報の開示請求の件数が5年で約3倍に増えた。'],
    ['都内で今季一番の冷え込み', '都心では最低気温が今季一番の低さとなった。'],
    ['「地下アイドル」の平均活動期間は2年未満 研究者の調査', '研究者の調査によると、いわゆる地下アイドルの平均的な活動期間は2年に満たない。多くは解散や卒業で活動を終える。'],
    ['音楽配信の売上、CDを初めて上回る', '国内の音楽市場で、配信の売上がCDを初めて上回った。特典付きのCD販売は依然として根強い。'],
  ];
  function newsIndex(link) {
    const items = [];
    if (g()) {
      g().log.slice(-8).reverse().forEach(([d, t]) => items.push([t.replace(/^\d+年\d+月、/, `【${g().name}】`).slice(0, 40), `${t}\n\n(ドルナビ編集部)`]));
      if (g().releases.length) { const r = g().releases[g().releases.length - 1]; items.push([`${g().name}「${r.title}」週間${r.rank}位`, `${g().name}のシングル「${r.title}」が、週間チャートで${r.rank}位に入った。売上は${r.sales.toLocaleString()}枚。`]); }
    }
    RIVALS.forEach(r => { if (seeded(today() + r.f0) < .35) items.push([`${r.name}、${P(['新メンバー加入を発表', 'ワンマンライブを完売', 'メンバーの卒業を発表', '新曲のMVを公開', 'レコード会社と契約'])}`, `${r.agency}所属の${r.name}が発表した。${r.desc}`]); });
    WORLD.slice().sort(() => R() - .5).slice(0, 4).forEach(w => items.push(w));
    return `<div class="site news"><div class="news-h">ドルナビ - アイドルニュース</div><h2>新着ニュース</h2><ul class="news-idx">${items.map(([t, b]) => `<li>${link(esc(t), { type: 'news', site: 'ドルナビ', title: t, date: '', body: b })}</li>`).join('')}</ul></div>`;
  }

  // ---------- チャート ----------
  function chart() {
    const songs = ['ミッドナイト・パレード', 'Sweet Revolution', '夜明けのパラレル', 'カタオモイ電車', 'ラストダンスは渡さない', '世界でいちばん', '白昼夢', 'はじまりの歌', 'ぜんぶ嘘', 'ハートビート・ラン'];
    const rows = [];
    for (let i = 0; i < 10; i++) { const r = RIVALS[(i + Math.floor(seeded(today() + i) * 8)) % RIVALS.length]; rows.push([`「${songs[(i + Math.floor(today() / 14)) % songs.length]}」`, r.name, Math.round((15000 - i * 1200) * (.6 + seeded(today() + i * 7) * .8))]); }
    if (g() && g().releases.length) { const r = g().releases[g().releases.length - 1]; if (r.rank <= 10) rows.push([`「${r.title}」`, g().name, r.sales]); }
    rows.sort((a, b) => b[2] - a[2]);
    const groups = RIVALS.map(r => [r.name, rivalFans(r)]);
    if (g()) groups.push([g().name, Math.round(g().fans), 1]);
    groups.sort((a, b) => b[1] - a[1]);
    return `<div class="site chart"><div class="news-h">ドルナビ チャート</div><h2>週間シングルランキング</h2><table class="rank"><tr><th>順位</th><th>曲</th><th>アーティスト</th><th>売上</th></tr>${rows.slice(0, 10).map((r, i) => `<tr class="${g() && r[1] === g().name ? 'me' : ''}"><td>${i + 1}</td><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td class="num">${r[2].toLocaleString()}枚</td></tr>`).join('')}</table>
      ${g() && g().releases.length && g().releases[g().releases.length - 1].rank > 10 ? `<p class="rank-note">${esc(g().name)}「${esc(g().releases[g().releases.length - 1].title)}」は ${g().releases[g().releases.length - 1].rank}位</p>` : ''}
      <h2>アイドルグループ 注目度ランキング(Zフォロワー)</h2><table class="rank"><tr><th>順位</th><th>グループ</th><th>フォロワー</th></tr>${groups.map((r, i) => `<tr class="${r[2] ? 'me' : ''}"><td>${i + 1}</td><td>${esc(r[0])}</td><td class="num">${r[1].toLocaleString()}</td></tr>`).join('')}</table></div>`;
  }

  // ---------- 百科事典 ----------
  function wikiIndex(link) {
    const items = RIVALS.map(r => link(esc(r.name), { type: 'archwiki', title: r.name, html: rivalWiki(r) }));
    items.push(link('ミツバ企画', { type: 'archwiki', title: 'ミツバ企画', html: `<div class="site wiki"><h1>ミツバ企画</h1><div class="wk-sub">出典: みんなの百科事典</div><p><b>株式会社ミツバ企画</b>は、東京都に本社を置く芸能事務所。2009年設立。</p><h2>所属タレント</h2><ul><li>Lumière(${g() && g().flags.lumiEnd ? '解散' : '活動中'})</li>${g() ? `<li>${esc(g().name)}(${g().done ? '活動終了' : '活動中'})</li>` : ''}</ul><h2>評判</h2><p>所属タレントの労働環境について、たびたび批判がある。${g() && g().debt ? '近年は経営の厳しさが伝えられている。' : ''}</p></div>` }));
    try { JSON.parse(localStorage.getItem('idol-archive') || '[]').forEach(a => items.push(link(esc(a.name) + '(過去の担当)', { type: 'archwiki', title: a.name, html: a.html }))); } catch (e) { /* なし */ }
    if (g() && g().done) items.unshift(link(esc(g().name), { type: 'wiki', title: g().name }));
    return `<div class="site wiki"><h1>みんなの百科事典</h1><div class="wk-sub">アイドル関連の記事</div><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul></div>`;
  }
  function rivalWiki(r) {
    return `<div class="site wiki"><h1>${esc(r.name)}</h1><div class="wk-sub">出典: みんなの百科事典</div><table class="wk-box"><tr><th colspan="2">${esc(r.name)}</th></tr><tr><td>事務所</td><td>${esc(r.agency)}</td></tr><tr><td>Zフォロワー</td><td>${rivalFans(r).toLocaleString()}</td></tr></table><p><b>${esc(r.name)}</b>(${esc(r.kana)})は、日本の女性アイドルグループ。${esc(r.desc)}</p><h2>来歴</h2><p>${P(['結成当初はメンバーの脱退が相次いだが、3人体制で持ち直した。', 'デビュー曲がZで話題となり、一気に知名度を上げた。', '地方のショッピングモールを回る活動で、地道にファンを増やした。'])}</p></div>`;
  }

  // ---------- トップページのニュース ----------
  function homeNews(link) {
    const items = WORLD.slice().sort((a, b) => seeded(today() + a[0].length) - seeded(today() + b[0].length)).slice(0, 3);
    if (g() && g().log.length) { const t = g().log[g().log.length - 1][1]; items.unshift([`${g().name}:${t.replace(/^\d+年\d+月、/, '').slice(0, 28)}`, t]); }
    return items.map(([t, b]) => `<p>・${link(esc(t), { type: 'news', site: 'ヤマビコニュース', title: t, date: '', body: b })}</p>`).join('');
  }

  // ---------- 検索で見つかる追加のページ ----------
  const CLIENTS = [
    { q: ['ハーベスト'], r: { type: 'news', site: '経済ニュース', title: '投資会社ハーベストキャピタル代表 過去に芸能関係者との会食でトラブルか', date: '', snippet: '関係者によると、同社代表は複数の芸能事務所のタレントを会食に招いていたという。', body: '関係者によると、同社代表は複数の芸能事務所の所属タレントを「出資の相談」として会食に招いていたという。\n\n同席した元タレントの一人は「お金の話は一度も出なかった」と話している。' } },
    { q: ['週刊ミッドナイト', 'ミッドナイト'], r: { type: 'news', site: '週刊ミッドナイト Web', title: '【独占】人気アイドルの「深夜の密会」現場', date: '', snippet: '本誌は、あるアイドルグループのメンバーと関係者の深夜の密会を目撃した。', body: '本誌は、あるアイドルグループのメンバーが関係者の男性と深夜に会っている現場を目撃した。\n\n(続きは本誌で)' } },
    { q: ['ポプラ', '配信アプリ'], r: { type: 'bbs', site: 'アプリ板', title: '配信アプリ「ポプラ」の還元率ひどすぎる件', posts: [resp(1, 'ギフトの7割運営に持ってかれる'), resp(4, 'それでも課金するのがオタク'), resp(9, '新人アイドルのイベント、上位は全部太客1人の力')] } },
    { q: ['ガレージノイズ', 'garage', '下北沢'], r: { type: 'news', site: 'ライブハウス情報', title: '下北沢 GARAGE NOISE', date: '', snippet: 'キャパ120。アイドルとバンドの対バンが中心。', body: 'キャパ120。アイドルとバンドの対バンイベントが中心のライブハウス。\n\n口コミ: ★3.4「音はいい。トイレが一つしかない」' } },
  ];
  function searchHits(n) {
    const hits = [];
    RIVALS.forEach(r => { if (n.includes(r.name.toLowerCase()) || n.includes(r.kana)) { hits.push({ type: 'archwiki', title: `${r.name} - みんなの百科事典`, site: 'みんなの百科事典', snippet: r.desc, html: rivalWiki(r) }); hits.push({ type: 'xsearch', q: r.name, title: `「${r.name}」の検索結果 / Z`, site: 'Z', snippet: `フォロワー ${rivalFans(r).toLocaleString()}人`, posts: trendPosts(r.name) }); } });
    CLIENTS.forEach(c => { if (c.q.some(k => n.includes(k.toLowerCase()))) hits.push(Object.assign({ snippet: c.r.snippet || '' }, c.r)); });
    if (g()) {
      Object.keys(g().m).forEach(id => {
        const c = C(id), keys = [c.name.replace(' ', ''), c.kana.replace(' ', '')].concat(c.name.split(' '));
        if (keys.some(k => k.length > 1 && n.includes(k))) {
          const z = memberZ(id);
          hits.unshift(Object.assign({ site: 'Z', snippet: z.posts[0][1] }, z));
          const th = memberThread(id);
          hits.push(Object.assign({ snippet: th.posts[1] ? th.posts[1][3] : '' }, th));
        }
      });
      const key = g().name.replace(/[\s ]/g, '').toLowerCase();
      if (n.includes(key)) { const th = groupThread(); hits.push(Object.assign({ snippet: th.posts[1] ? th.posts[1][3] : '' }, th)); }
    }
    if (/天気|てんき/.test(n)) hits.push({ type: 'news', site: 'ヤマビコ天気', title: '東京の天気', snippet: P(['くもり 最高12℃', '晴れ 最高18℃', '雨 最高9℃']), body: '週末は崩れる見込みです。屋外イベントの方はご注意ください。' });
    if (/転職|やめたい|辞めたい/.test(n)) hits.push({ type: 'news', site: '転職サイト', title: '芸能マネージャーからの転職 成功事例', snippet: '「もう二度と土日に働きたくない」…', body: '「もう二度と土日に働きたくない」と語るのは、元芸能マネージャーのAさん(32)。\n\n「でも、たまにライブの映像を見て泣いちゃうんですよね」' });
    return hits;
  }

  // ---------- ブックマーク ----------
  const BOOKMARKS = [['ヤマビコ', 'home'], ['Z', 'zhome'], ['アイドル板', 'bbsidx'], ['ドルナビ', 'newsidx'], ['チャート', 'chart'], ['百科事典', 'wikiidx']];
  function render(r, link) {
    if (r.type === 'zhome') return zhome(link);
    if (r.type === 'bbsidx') return boardIndex(link);
    if (r.type === 'newsidx') return newsIndex(link);
    if (r.type === 'chart') return chart();
    if (r.type === 'wikiidx') return wikiIndex(link);
    return null;
  }
  return { render, searchHits, BOOKMARKS, homeNews, rivalFans, RIVALS };
})();
