// グループ結成後。ランが終わるまで続く
// 時間はプロデューサーのカレンダー(1日 = 午前/午後の2コマ)。最初の4ターンは1週間ずつ、そのあとは2週間ずつ進む
// 終わり方: 解散(自分で決める/人数が足りない)・倒産(借金の上限)・全員の卒業・解任(交際の発覚)・活動休止(炎上)

const G = (() => {
  const rnd = () => Math.random();
  const pick = a => a[Math.floor(rnd() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const yen = n => (n < 0 ? '-' : '') + '¥' + Math.abs(Math.round(n)).toLocaleString();
  const M = id => S.g.m[id];
  const nm = id => C(id).name.split(' ')[1];
  const full = id => C(id).name.replace(' ', '');
  const active = () => Object.keys(S.g.m).filter(id => M(id).status !== 'left');
  const ready = () => active().filter(id => M(id).status === 'active');
  const left = () => Object.keys(S.g.m).filter(id => M(id).status === 'left');
  const DEBT_MAX = 10000000;

  // ---------- 日付・年齢 ----------
  const date = off => new Date(2026, 10, 2 + off);
  const md = off => { const t = date(off); return `${t.getMonth() + 1}/${t.getDate()}`; };
  const dayLabel = off => { const t = date(off); return `${md(off)}(${'日月火水木金土'[t.getDay()]})`; };
  const ymd = off => { const t = date(off); return `${t.getFullYear()}年${t.getMonth() + 1}月`; };
  const slotDay = i => S.g.day + (i >> 1);
  const slotLabel = i => `${dayLabel(slotDay(i))} ${i % 2 ? '午後' : '午前'}`;
  const range = () => `${md(S.g.day)}〜${md(S.g.day + S.g.len - 1)}`;
  function ageOf(id, off) {
    const m = C(id).birth.match(/(\d+)年(\d+)月(\d+)日/);
    if (!m) return C(id).age;
    const t = date(off == null ? S.g.day : off);
    let a = t.getFullYear() - +m[1];
    if (t.getMonth() + 1 < +m[2] || (t.getMonth() + 1 === +m[2] && t.getDate() < +m[3])) a--;
    return a;
  }
  const minor = id => ageOf(id) < 18;
  const turnName = () => S.g.turn < 4 ? `第${S.g.turn + 1}週` : `${ymd(S.g.day)}${date(S.g.day).getDate() <= 15 ? '前半' : '後半'}`;

  // ---------- 文章の取り出し(なるべく同じものを続けない) ----------
  function fresh(key, arr) {
    if (!arr || !arr.length) return '';
    S.g.used = S.g.used || {};
    const u = S.g.used[key] = S.g.used[key] || [];
    let idx = arr.map((_, i) => i).filter(i => !u.includes(i));
    if (!idx.length) { u.length = 0; idx = arr.map((_, i) => i); }
    const i = pick(idx);
    u.push(i);
    if (u.length > Math.max(1, arr.length - 1)) u.shift();
    return arr[i];
  }
  const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => o[k] != null ? o[k] : (k === 'g' ? S.g.name : ''));
  const hw = id => TX.hw[id] || {};
  const voiceOf = id => hw(id).voice || C(id).voice || TX.hw.mori.voice;
  const talkPool = id => (hw(id).talk || []).concat(C(id).talk && !TX.hw[id] ? C(id).talk : []);
  const dreamOf = id => hw(id).dream || C(id).dream || 'やりたいことが見つかりました';
  const dateable = id => (TX.hw[id] ? hw(id).dateable : C(id).dateable) && !minor(id);
  const invites = id => (hw(id).invite || []).concat(C(id).invite || []);

  // ---------- 予定表 ----------
  // 日付のマス(S.g.slots)には固定の用事と仕事だけが入る。
  // プレイヤーが決める「やること」は週に3つまで(S.g.plans)
  const PER_WEEK = 3;
  const freshPlans = () => Array((S.g.len / 7) * PER_WEEK).fill(null);
  const plans = () => S.g.plans || (S.g.plans = freshPlans());
  const planSlot = p => (Math.floor(p / PER_WEEK) * 7 + 1 + (p % PER_WEEK) * 2) * 2;   // 報告用の日付(火・木・土)
  const planLabel = p => `第${Math.floor(p / PER_WEEK) + 1}週の予定${'①②③'[p % PER_WEEK]}`;
  function freshSlots() {
    const s = Array(S.g.len * 2).fill(null);
    for (let w = 0; w < S.g.len / 7; w++) {
      s[w * 14] = { kind: 'fixed', label: '定例会議' };
      if (S.g.turn > 0 && rnd() < .6) { const i = w * 14 + 1 + Math.floor(rnd() * 9); if (!s[i]) s[i] = { kind: 'fixed', label: fresh('fixed', TX.fixedPool) }; }
    }
    if (S.g.turn === 1) s[7] = { kind: 'fixed', label: 'Lumière あかりの面談に同席' };
    return s;
  }

  // ---------- 仕事の依頼 ----------
  const JOBS = [
    { k: 'taiban', kind: 'live', tier: 0, ck: 'live', client: '下北沢 GARAGE NOISE', person: 'ブッキング担当 岡', subj: '対バンイベント出演のご相談', when: [[5, 1], [6, 1], [2, 1]], pay: 'ticket', min: 3, max: 9, w: { vocal: 1, dance: 1, talk: .3 }, fans: 120, cheki: 1 },
    { k: 'mall', kind: 'event', tier: 0, ck: 'event', client: 'イベント制作 サンライズ企画', person: '制作 小島', subj: 'ショッピングモール ステージイベントのご相談', when: [[5, 0], [6, 0]], pay: 50000, min: 3, max: 6, nom: 'talk', w: { talk: 1, looks: .5, dance: .5 }, fans: 90, cheki: 1 },
    { k: 'radio', kind: 'media', tier: 0, ck: 'media', client: 'コミュニティFM しながわ', person: 'ディレクター 堀', subj: 'ラジオ番組 ゲスト出演のお願い', when: [[1, 0], [3, 0]], pay: 10000, min: 1, max: 2, nom: 'talk', w: { talk: 1 }, fans: 40 },
    { k: 'stream', kind: 'stream', tier: 0, ck: 'corp', client: '配信アプリ「ポプラ」運営事務局', person: 'パートナー担当', subj: '【公式】ランキングイベントのご案内', when: [[2, 1], [4, 1]], pay: 'gift', min: 1, max: 9, w: { talk: 1, looks: .6 }, fans: 70, tired: 1.4 },
    { k: 'webvar', kind: 'media', tier: 1, ck: 'media', client: 'Web番組「深夜の部室」', person: 'AD 宮田', subj: 'Web番組 ゲスト出演のご相談', when: [[2, 1], [3, 1]], pay: 30000, min: 2, max: 3, w: { talk: 1, looks: .4 }, fans: 220 },
    { k: 'magazine', kind: 'media', tier: 1, ck: 'media', client: '月刊アイドルスコープ 編集部', person: '編集 吉岡', subj: '取材・撮影のご相談', when: [[1, 1], [3, 1]], pay: 30000, min: 1, max: 1, nom: 'looks', w: { looks: 1 }, fans: 160 },
    { k: 'school', kind: 'event', tier: 1, ck: 'event', client: '〇〇大学 学園祭実行委員会', person: '企画局 中村', subj: '学園祭ステージ 出演依頼', when: [[5, 0], [6, 0]], pay: 50000, min: 3, max: 9, w: { dance: 1, vocal: .6, talk: .6 }, fans: 200, cheki: 1 },
    { k: 'pr', kind: 'pr', tier: 1, ck: 'corp', client: '株式会社ルクシア', person: 'マーケティング部 西', subj: 'SNS PR投稿のご相談', when: [[1, 1], [2, 0], [4, 0]], pay: 60000, min: 1, max: 1, nom: 'followers', w: { looks: 1, talk: .3 }, fans: 100 },
    { k: 'oneman', kind: 'oneman', tier: 1, ck: 'live', client: '渋谷 CLUB ORBIT', person: 'ブッキング 長尾', subj: 'ワンマンライブ開催のご提案', when: [[5, 1], [6, 1]], pay: 'oneman', venue: 250000, cap: 300, price: 3500, min: 3, max: 12, w: { vocal: 1, dance: 1, talk: .5 }, fans: 300, cheki: 1, tired: 1.3 },
    { k: 'dinner', kind: 'dinner', tier: 1, ck: 'corp', client: '株式会社ハーベストキャピタル', person: '代表付き秘書 平田', subj: '会食のご案内(スポンサーのご相談)', when: [[4, 1]], pay: 200000, min: 2, max: 2, adult: 1, night: 1, w: { talk: 1, looks: 1 }, fans: 0, once: 1 },
    { k: 'tvnight', kind: 'media', tier: 2, ck: 'media', client: '東都テレビ「夜ふかしアイドル部」', person: 'ディレクター 菊池', subj: '深夜番組 ひな壇出演のお願い', when: [[4, 1]], pay: 60000, min: 2, max: 3, night: 1, w: { talk: 1, looks: .5 }, fans: 600 },
    { k: 'gravure', kind: 'gravure', tier: 2, ck: 'media', client: '週刊ミッドナイト 編集部', person: 'グラビア班 樋口', subj: 'グラビア撮影のご相談', when: [[2, 1]], pay: 100000, min: 1, max: 1, nom: 'looks', adult: 1, w: { looks: 1 }, fans: 500 },
    { k: 'fes', kind: 'live', tier: 2, ck: 'event', client: 'TOKYO IDOL CARNIVAL 実行委員会', person: '出演調整 森下', subj: 'アイドルフェス 出演のご案内', when: [[6, 1]], pay: 0, min: 3, max: 12, w: { vocal: 1, dance: 1, talk: .3 }, fans: 800, cheki: 1 },
    { k: 'tour', kind: 'tour', tier: 2, ck: 'event', client: 'ノースイベンツ', person: '営業 田辺', subj: '地方イベント出演のご依頼', when: [[5, 0], [6, 0]], pay: 150000, min: 3, max: 12, w: { vocal: .8, dance: .8, talk: .8 }, fans: 700, cheki: 1, tired: 1.7 },
    { k: 'drama', kind: 'drama', tier: 2, ck: 'media', client: '制作会社 ブルーリール', person: 'キャスティング 小野', subj: 'ドラマ出演のご相談', when: [[1, 0], [3, 0]], pay: 80000, min: 1, max: 1, nom: 'talk', w: { talk: 1, looks: .8 }, fans: 600 },
    { k: 'oneman2', kind: 'oneman', tier: 2, ck: 'live', client: '恵比寿 LIQUID HALL', person: '制作 片岡', subj: '中規模ワンマンのご提案', when: [[6, 1]], pay: 'oneman', venue: 900000, cap: 900, price: 4500, min: 3, max: 12, w: { vocal: 1, dance: 1, talk: .5 }, fans: 1200, cheki: 1, tired: 1.4 },
    { k: 'cm', kind: 'cm', tier: 3, ck: 'corp', client: '大和製菓 宣伝部', person: '宣伝部 秋元', subj: 'テレビCM出演のご相談', when: [[1, 0], [2, 0], [3, 0]], pay: 1000000, min: 1, max: 3, nom: 'looks', w: { looks: 1, talk: .4 }, fans: 3000 },
    { k: 'musictv', kind: 'media', tier: 3, ck: 'media', client: '日本中央テレビ 音楽班', person: 'プロデューサー 守屋', subj: '音楽番組 出演のお願い', when: [[4, 1]], pay: 200000, min: 3, max: 12, w: { vocal: 1, dance: 1, looks: .5 }, fans: 5000 },
    { k: 'bigfes', kind: 'live', tier: 3, ck: 'event', client: 'SUMMER IDOL SONIC 実行委員会', person: 'ブッキング 杉浦', subj: '大型フェス メインステージのご相談', when: [[6, 1]], pay: 300000, min: 3, max: 12, w: { vocal: 1, dance: 1, talk: .4 }, fans: 6000, cheki: 1 },
    { k: 'kanmuri', kind: 'media', tier: 4, ck: 'media', client: 'BS東都 編成部', person: '編成 三上', subj: '冠番組のご提案', when: [[1, 1], [3, 1]], pay: 500000, min: 3, max: 12, w: { talk: 1, looks: .5 }, fans: 10000 },
    { k: 'arena', kind: 'oneman', tier: 4, ck: 'live', client: '横浜アリーナ(仮押さえ)', person: '制作 本郷', subj: 'アリーナ単独公演のご提案', when: [[6, 1]], pay: 'oneman', venue: 8000000, cap: 12000, price: 8800, min: 3, max: 12, w: { vocal: 1, dance: 1, talk: .6 }, fans: 15000, cheki: 0, tired: 1.6 },
  ];
  const BIG = ['oneman', 'oneman2', 'arena', 'cm', 'musictv', 'bigfes', 'kanmuri', 'tour'];
  const DESCKEY = { oneman2: 'oneman', arena: 'arena' };
  const SPECIAL = {
    debut: { k: 'debut', kind: 'live', client: 'ミツバ企画(社内)', person: '桐谷', subj: 'お披露目ライブの件(決定事項)', pay: 'ticket', min: 3, max: 12, w: { vocal: 1, dance: 1, talk: .4 }, fans: 200, cheki: 1, fixed: [5, 1], desc: '今週土曜にお披露目ライブをやります。会場は渋谷の小箱、キャパ80。全員出してください。これは決定です。' },
    opening: { k: 'opening', kind: 'live', client: 'ミツバ企画(社内)', person: '佐野', subj: 'Lumière 年末ライブの前座について', pay: 0, min: 3, max: 12, w: { vocal: 1, dance: 1, talk: .3 }, fans: 900, cheki: 0, fixed: [5, 1], lumi: 1, desc: 'Lumièreの年末ライブ(プレ公演)の前座を、新グループにお願いしたいです。持ち時間10分。Lumièreのファンは、正直あたたかくないです。' },
    gradshow: { k: 'gradshow', kind: 'live', client: 'ミツバ企画(社内)', person: '桐谷', subj: '卒業公演の件', pay: 'ticket', min: 1, max: 12, w: { vocal: 1, dance: 1, talk: 1 }, fans: 400, cheki: 1, fixed: [6, 1], desc: '卒業公演の日程を押さえました。全員出してください。' },
    lastlive: { k: 'lastlive', kind: 'live', client: 'ミツバ企画(社内)', person: '桐谷', subj: '解散ライブの件', pay: 'ticket', min: 1, max: 12, w: { vocal: 1, dance: 1, talk: 1 }, fans: 0, cheki: 1, fixed: [6, 1], desc: '解散ライブの会場を押さえました。最後です。全員出してください。' },
  };
  const tierOf = f => f < 1500 ? 0 : f < 5000 ? 1 : f < 15000 ? 2 : f < 50000 ? 3 : 4;
  const tier = () => tierOf(S.g.fans);
  function eligible(job, id) {
    const m = M(id);
    if (m.status === 'left') return '脱退';
    if (m.status === 'rest') return '休養中';
    if (job.adult && minor(id)) return '18歳未満';
    if (job.night && minor(id)) return '18歳未満は22時以降NG';
    return true;
  }
  function nominee(job) {
    const ok = ready().filter(id => eligible(job, id) === true);
    if (!job.nom || !ok.length) return null;
    const by = { talk: id => M(id).sk.talk + M(id).mf / 400, looks: id => C(id).hidden.looks + M(id).mf / 300, followers: id => M(id).mf };
    return ok.sort((a, b) => by[job.nom](b) - by[job.nom](a))[0];
  }
  function payText(job) {
    if (job.pay === 'ticket') return 'チケットバック(1枚 ¥1,000 × 動員)';
    if (job.pay === 'gift') return 'ギフト額に応じて(目安 数千円〜)';
    if (job.pay === 'oneman') return `会場費 ${yen(job.venue)}(前払い)/ チケット ${yen(job.price)} × 動員(キャパ ${job.cap.toLocaleString()})`;
    if (!job.pay) return 'なし(交通費のみ)';
    return yen(job.pay) + '(税別・交通費込み)';
  }
  function makeJobMail(t, wk) {
    const job = Object.assign({}, t);
    const [d, h] = t.fixed || pick(t.when);
    job.slot = (wk * 7 + d) * 2 + h;
    job.nominee = nominee(job);
    if (t.nom && !job.nominee) return null;
    const time = h ? (job.night ? '23:00〜' : '14:00〜') : '10:30〜';
    const desc = t.desc || fresh('jd_' + t.k, TX.jobDesc[DESCKEY[t.k] || t.k] || ['']);
    const body = `ミツバ企画 ${S.g.name}ご担当者様

${t.client} の${t.person}です。

${desc}

  日時: ${dayLabel(slotDay(job.slot))} ${time}
  人数: ${t.min === t.max ? t.min : t.min + '〜' + t.max}名
  ギャラ: ${payText(t)}${job.nominee ? `\n  ご指名: ${full(job.nominee)} さん` : ''}${t.night ? '\n  ※深夜帯の収録です' : ''}

ご検討のほど、よろしくお願いいたします。`;
    return { id: `job_${S.g.turn}_${t.k}_${Math.floor(rnd() * 1e6)}`, from: t.client, addr: '', date: dayLabel(S.g.day + wk * 7) + ' 09:' + String(10 + Math.floor(rnd() * 40)), subject: t.subj, body, job, jobState: 'open' };
  }
  function genJobs() {
    const out = [], weeks = S.g.len / 7;
    if (S.g.turn === 0) out.push(makeJobMail(SPECIAL.debut, 0));
    if (S.g.turn === 2) out.push(makeJobMail(SPECIAL.opening, 0));
    if (S.g.gradShow) { out.push(makeJobMail(Object.assign({}, SPECIAL.gradshow, { subj: `${S.g.gradShow.map(nm).join('・')} 卒業公演の件`, desc: `${S.g.gradShow.map(full).join('・')}の卒業公演の日程を押さえました。全員出してください。` }), weeks - 1)); }
    if (S.g.lastLive) out.push(makeJobMail(SPECIAL.lastlive, weeks - 1));
    const used = new Set();
    S.g.jobCool = S.g.jobCool || {};
    const okJob = j => j.tier <= tier() && !used.has(j.k) && !(j.once && S.g.flags['once_' + j.k]) && j.tier >= tier() - 2 && (S.g.jobCool[j.k] || 0) <= S.g.turn;
    S.g.sales.forEach(ck => {
      const c = JOBS.filter(j => j.ck === ck && !BIG.includes(j.k) && okJob(Object.assign({}, j, { tier: Math.max(0, j.tier - 1) })));
      if (c.length) { const j = pick(c); used.add(j.k); out.push(makeJobMail(j, Math.floor(rnd() * weeks))); }
    });
    S.g.sales = [];
    const per = 2 + (tier() >= 2 ? 1 : 0) + (tier() >= 3 ? 1 : 0);
    for (let wk = 0; wk < weeks; wk++) {
      let n = 0;
      for (let i = 0; i < 30 && n < per; i++) {
        const pool = JOBS.filter(okJob);
        if (!pool.length) break;
        const j = pick(pool);
        used.add(j.k);
        const m = makeJobMail(j, wk);
        if (m) { out.push(m); n++; }
      }
    }
    out.filter(Boolean).reverse().forEach(m => {
      if (m.job.fixed) { m.jobState = 'accepted'; m.cast = ready(); S.g.slots[m.job.slot] = { kind: 'job', mail: m.id, label: `${m.subject.replace(/の件.*/, '')}(全員)` }; }
      S.mails.unshift(Object.assign({ box: 'inbox', unread: true }, m));
    });
  }

  // ---------- 出演メンバーを選ぶ ----------
  function openAssign(mailId) {
    const mail = S.mails.find(x => x.id === mailId), job = mail.job;
    const cur = S.g.slots[job.slot];
    if (cur && !(cur.kind === 'job' && cur.mail === mailId)) {
      OS.dialog('カレンダー', `${slotLabel(job.slot)} には、もう予定が入っています。\n(${cur.label})\n\n${cur.kind === 'fixed' || cur.kind === 'job' ? 'この依頼は受けられません。' : 'カレンダーで予定を取り消せば受けられます。'}`, null, 'warn');
      return;
    }
    OS.open('assign', {
      title: '出演メンバーを決める', icon: 'calendar', w: 420, h: 520,
      render(body) {
        body.innerHTML = `<div class="asg"><div class="asg-h"><b></b><span>${slotLabel(job.slot)} / ${job.min === job.max ? job.min : job.min + '〜' + job.max}名</span></div><div class="asg-list"></div>
          <div class="asg-foot"><span class="asg-n"></span><button class="btn primary">この人数で受ける</button></div></div>`;
        body.querySelector('b').textContent = mail.subject;
        const L = body.querySelector('.asg-list');
        active().forEach(id => {
          const ok = eligible(job, id);
          const school = ok === true && minor(id) && (job.slot >> 1) % 7 < 5 && job.slot % 2 === 0;
          const r = OS.el('label', 'asg-row' + (ok === true ? '' : ' off'));
          r.innerHTML = `<input type="checkbox" value="${id}" ${ok === true ? '' : 'disabled'} ${job.nominee === id ? 'checked disabled' : ''}>${photoSlot(C(id), 'tiny')}<span><b>${escapeHtml(full(id))}</b><small>${ok !== true ? ok : job.nominee === id ? '指名' : school ? '平日の昼…学校を休ませることになる' + (M(id).flags.school ? '(親と約束している)' : '') : condWord(id)}</small></span>`;
          L.append(r);
        });
        const count = () => body.querySelectorAll('input:checked').length;
        const upd = () => { const n = count(); body.querySelector('.asg-n').textContent = `${n}人 選択中`; body.querySelector('.primary').disabled = n < job.min || n > job.max; };
        body.querySelectorAll('input').forEach(i => i.onchange = upd); upd();
        body.querySelector('.primary').onclick = () => {
          mail.cast = Array.from(body.querySelectorAll('input:checked')).map(i => i.value);
          mail.jobState = 'accepted';
          if (job.once) S.g.flags['once_' + job.k] = 1;
          if (BIG.includes(job.k)) { S.g.jobCool = S.g.jobCool || {}; S.g.jobCool[job.k] = S.g.turn + 5; }
          S.g.slots[job.slot] = { kind: 'job', mail: mail.id, label: `${mail.from.replace(/(株式会社|編集部|実行委員会|運営事務局|\(仮押さえ\))/g, '').trim()}(${mail.cast.map(nm).join('・')})` };
          save(); OS.close('assign'); OS.refresh('mail'); OS.refresh('calendar'); sticky();
          OS.toast(APPS.calendar, '予定に入れました', `${slotLabel(job.slot)} ${mail.subject}`, openCalendar);
        };
      },
    });
  }
  function condWord(id) {
    const m = M(id);
    if (m.fat >= 75) return '顔色が悪い';
    if (m.fat >= 50) return '疲れている様子';
    if (m.mood < 25) return '元気がない';
    if (m.mood > 75) return '調子がよさそう';
    return 'ふつう';
  }
  function decline(mailId) {
    const mail = S.mails.find(x => x.id === mailId);
    mail.jobState = 'declined';
    S.g.rel[mail.job.ck || 'in'] = (S.g.rel[mail.job.ck || 'in'] || 0) - 1;
    save(); OS.refresh('mail');
  }
  function mailActions(rd, cur) {
    const body = rd.querySelector('.ml-body');
    if (cur.job) {
      const d = OS.el('div', 'job-act');
      const st = cur.jobState;
      if (st === 'open' && !S.g.done) {
        d.innerHTML = `<button class="btn primary" data-a>受ける(メンバーを選ぶ)</button><button class="btn" data-d>お断りする</button><span>返事をしないまま進めると、断ったのと同じになります</span>`;
        d.querySelector('[data-a]').onclick = () => openAssign(cur.id);
        d.querySelector('[data-d]').onclick = () => decline(cur.id);
      } else d.innerHTML = `<span class="st ${st}">${{ accepted: '受けた', declined: 'お断りした', expired: '返事をしなかった', done: '終わった仕事' }[st] || ''}${cur.cast ? '(出演: ' + cur.cast.filter(id => S.g.m[id]).map(nm).join('・') + ')' : ''}</span>`;
      body.before(d);
    }
    if (cur.aud && !S.g.done) {
      const d = OS.el('div', 'job-act');
      d.innerHTML = cur.audDone ? `<span class="st">${escapeHtml(cur.audDone)}</span>` : '<button class="btn primary">追加メンバーを選ぶ</button><button class="btn" data-folder>候補者の資料を見る</button>';
      const b = d.querySelector('.primary'); if (b) b.onclick = () => openAudPick(cur.id);
      const f = d.querySelector('[data-folder]'); if (f) f.onclick = () => openExplorer('aud');
      body.before(d);
    }
    if (cur.choices) {
      const d = OS.el('div', 'job-act choices');
      if (cur.chosen == null && !S.g.done) {
        d.innerHTML = '<div class="ch-q">どうする?</div>' + cur.choices.map((c, i) => `<button class="btn" data-c="${i}">${escapeHtml(c)}</button>`).join('');
        d.querySelectorAll('[data-c]').forEach(b => b.onclick = () => choose(cur.id, +b.dataset.c));
      } else if (cur.chosen != null) d.innerHTML = `<div class="ch-q">選んだこと: ${escapeHtml(cur.choices[cur.chosen] || '何もしなかった')}</div><div class="ch-r">${textHtml(cur.result || '')}</div>`;
      body.after(d);
    }
  }

  // ---------- 空き枠に予定を入れる ----------
  const LESSON = { vocal: 'ボーカル', dance: 'ダンス', talk: 'トーク・MC' };
  const SNS = { safe: 'オフショットを載せる(無難)', plan: 'メンバー企画の動画(ふつう)', bold: '攻めた企画(バズるかも・荒れるかも)' };
  const SALES = { live: 'ライブハウス', event: 'イベント制作会社', media: 'テレビ局・出版社', corp: '企業(広告・配信)' };
  function openPlan(i) {
    OS.open('plan', {
      title: `${S.g.len > 7 ? planLabel(i) : '今週の予定' + '①②③'[i % PER_WEEK]}`, icon: 'calendar', w: 460, h: 620,
      render(body) {
        const lv = S.g.love && S.g.m[S.g.love.id] && M(S.g.love.id).status !== 'left' ? S.g.love.id : null;
        body.innerHTML = `<div class="plan">
          <h4>レッスン <small>全員参加・¥40,000・疲れがたまる</small></h4><div class="pl-row">${Object.entries(LESSON).map(([k, v]) => `<button class="btn" data-k="lesson" data-v="${k}">${v}</button>`).join('')}</div>
          <h4>面談 <small>ひとりと話す</small></h4><div class="pl-row">${active().map(id => `<button class="btn" data-k="talk" data-v="${id}">${escapeHtml(full(id))}</button>`).join('')}</div>
          <h4>休ませる <small>疲れがとれる・機嫌が少し上がる</small></h4><div class="pl-row"><button class="btn" data-k="off" data-v="all">全員オフ</button>${active().map(id => `<button class="btn" data-k="off" data-v="${id}">${escapeHtml(nm(id))}を休ませる${M(id).fat >= 60 ? '(疲れている)' : ''}</button>`).join('')}</div>
          <h4>SNS運営 <small>グループのZアカウント</small></h4><div class="pl-col">${Object.entries(SNS).map(([k, v]) => `<button class="btn" data-k="sns" data-v="${k}">${v}</button>`).join('')}</div>
          <h4>営業 <small>次の依頼が増える</small></h4><div class="pl-row">${Object.entries(SALES).map(([k, v]) => `<button class="btn" data-k="sales" data-v="${k}">${v}</button>`).join('')}</div>
          ${S.g.aud && !S.g.aud.done ? `<h4>追加オーディション <small>候補者と会う</small></h4><div class="pl-row">${S.g.aud.ids.filter(id => !(S.g.aud.met || []).includes(id)).map(id => `<button class="btn" data-k="meet" data-v="${id}">${escapeHtml(C(id).name)}</button>`).join('')}</div>` : ''}
          ${lv ? `<h4>私用 <small>誰にも見られないように</small></h4><div class="pl-row"><button class="btn" data-k="date" data-v="${lv}">${escapeHtml(nm(lv))}と会う</button><button class="btn" data-k="breakup" data-v="${lv}">${escapeHtml(nm(lv))}と別れ話をする</button></div>` : ''}</div>`;
        body.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
          const k = b.dataset.k, v = b.dataset.v;
          const label = { off: () => v === 'all' ? '全員オフ' : `休み: ${full(v)}`, lesson: () => `レッスン: ${LESSON[v]}`, talk: () => `面談: ${full(v)}`, sns: () => `SNS: ${SNS[v].replace(/\(.+\)/, '')}`, sales: () => `営業: ${SALES[v]}`, meet: () => `候補者と面接: ${C(v).name.replace(' ', '')}`, date: () => '私用', breakup: () => '私用' }[k]();
          plans()[i] = { kind: k, v, label };
          save(); OS.close('plan'); OS.refresh('calendar'); sticky();
        });
      },
    });
  }
  function openCalendar() {
    OS.open('calendar', {
      title: 'カレンダー', icon: 'calendar', w: 920, h: S.g.len > 7 ? 680 : 480,
      render(body) {
        const weeks = S.g.len / 7;
        let grid = '';
        for (let w = 0; w < weeks; w++) {
          grid += `<div class="cal wk"><div></div>${[0, 1, 2, 3, 4, 5, 6].map(d => `<div class="cal-d ${d > 4 ? 'we' : ''}">${dayLabel(S.g.day + w * 7 + d)}</div>`).join('')}
          ${[0, 1].map(h => `<div class="cal-t">${h ? '午後' : '午前'}</div>${[0, 1, 2, 3, 4, 5, 6].map(d => {
            const i = (w * 7 + d) * 2 + h, s = S.g.slots[i];
            if (s) return `<div class="ev ${s.kind === 'fixed' ? 'fixed' : 'job'}">${escapeHtml(s.label)}</div>`;
            return `<div class="ev free"></div>`;
          }).join('')}`).join('')}</div>
          <div class="wk-plans"><b>${weeks > 1 ? `第${w + 1}週に` : 'この週に'}やること</b><span>(${PER_WEEK}つまで)</span>${[0, 1, 2].map(k => {
            const p = w * PER_WEEK + k, pl = plans()[p];
            if (pl) return `<div class="pl-card ${pl.kind === 'date' || pl.kind === 'breakup' ? 'priv' : pl.kind === 'fixed' ? 'fixed' : pl.kind === 'off' ? 'off' : ''}"><span>${'①②③'[k]} ${escapeHtml(pl.label)}</span>${pl.kind !== 'fixed' && !S.g.done ? `<button class="x" data-x="${p}" title="取り消す">×</button>` : ''}</div>`;
            return `<div class="pl-card empty"><span>${'①②③'[k]}</span>${S.g.done ? '' : `<button class="btn" data-i="${p}">予定を入れる</button>`}</div>`;
          }).join('')}</div>`;
        }
        body.innerHTML = `<div class="cal-h"><b>${turnName()}</b><span>${range()}${S.g.len > 7 ? '(2週間)' : ''}</span><span class="cal-left">予算 <b class="${S.g.money < 0 ? 'neg' : 'pos'}">${yen(S.g.money)}</b>${S.g.debt ? ` ・ 借金 <b class="neg">${yen(S.g.debt)}</b>` : ''}</span></div>
          <div class="cal-scroll">${grid}</div>
          <div class="cal-go">${S.g.done ? '<span>このランは終わりました</span>' : `<button class="btn" data-future>グループの今後…</button><span class="sp"></span><span>依頼の返事がまだ ${openJobs().length} 件</span><button class="btn primary" data-go>${Icons.get('mail')}予定を部長に報告する(次へ進む)</button>`}</div>`;
        body.querySelectorAll('[data-i]').forEach(b => b.onclick = () => openPlan(+b.dataset.i));
        body.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { plans()[+b.dataset.x] = null; save(); OS.refresh('calendar'); sticky(); });
        const go = body.querySelector('[data-go]'); if (go) go.onclick = confirmAdvance;
        const fu = body.querySelector('[data-future]'); if (fu) fu.onclick = future;
      },
    });
  }
  function future() {
    if (S.g.lastLive) { OS.dialog('グループの今後', 'すでに解散ライブが決まっています。', null, 'info'); return; }
    OS.dialog('グループの今後', `${S.g.name}を解散しますか?\n\n次のターンの最後に解散ライブを開き、そこでランが終わります。\n人気があるうちに解散すれば「惜しまれつつ解散」、そうでなければ「ひっそり解散」と記録されます。`,
      [{ label: '解散ライブを開く', primary: true, fn: () => { S.g.lastLive = 1; S.g.log.push([S.g.day, `${ymd(S.g.day)}、解散を発表した。`]); zpost(`{g}、解散発表…嘘でしょ`, 600 + S.g.fans * .05); save(); refreshAll(); OS.dialog('解散を発表しました', '次のターンの最後に解散ライブがあります。', null, 'info'); } }, { label: 'やめる' }], 'warn');
  }
  const openJobs = () => S.mails.filter(m => m.job && m.jobState === 'open');
  const openChoices = () => S.mails.filter(m => m.choices && m.chosen == null);
  // 予定を部長にメールで報告すると、次のターンへ進む
  function confirmAdvance() {
    if (S.g.done) return;
    const free = plans().filter(s => !s).length;
    const warn = [];
    if (openJobs().length) warn.push(`返事をしていない依頼が ${openJobs().length} 件あります(送ると、断ったことになります)`);
    if (openChoices().length) warn.push(`対応していないメールが ${openChoices().length} 件あります(送ると、何もしなかったことになります)`);
    if (free) warn.push(`まだ決めていない予定が ${free} つあります`);
    const lines = S.g.slots.map((s, i) => s && s.kind === 'job' ? `・${slotLabel(i)} ${s.label}` : null).filter(Boolean)
      .concat(plans().map((s, p) => s && s.kind !== 'fixed' ? `・${S.g.len > 7 ? `第${Math.floor(p / PER_WEEK) + 1}週 ` : ''}${s.kind === 'date' || s.kind === 'breakup' ? '私用' : s.label}` : null).filter(Boolean));
    const body = `桐谷部長

お疲れさまです。${S.g.name}の担当です。
${turnName()}(${range()})の予定をご報告します。

${lines.length ? lines.join('\n') : '・(特に予定なし)'}

以上、よろしくお願いいたします。`;
    OS.open('report', {
      title: '予定の報告 - メール', icon: 'mail', w: 580, h: 540,
      render(b) {
        b.innerHTML = `<div class="cp">
          <label><span>宛先</span><input value="桐谷 誠(部長) <kiritani@mitsuba-pro.co.jp>" readonly></label>
          <label><span>件名</span><input class="subj" value="【予定報告】${turnName()}(${range()})"></label>
          ${warn.length ? `<div class="rp-warn">${warn.map(w => '・' + escapeHtml(w)).join('<br>')}</div>` : ''}
          <textarea class="cp-body"></textarea>
          <div class="cp-foot"><span class="cp-note">送信すると、この予定で${S.g.len > 7 ? '2週間' : '1週間'}が進みます</span><button class="btn primary">${Icons.get('mail')}送信</button></div></div>`;
        b.querySelector('textarea').value = body;
        b.querySelector('.primary').onclick = () => {
          S.mails.unshift({ id: 'rep_' + S.g.turn, box: 'sent', to: '桐谷 誠(部長)', from: '自分', subject: b.querySelector('.subj').value, body: b.querySelector('textarea').value, date: dayLabel(S.g.day) + ' 09:30' });
          OS.close('report');
          advance();
        };
      },
    });
  }

  // ---------- メンバーの状態を動かす道具 ----------
  function tire(id, base) { const m = M(id); if (m) m.fat = clamp(m.fat + base * (1.35 - C(id).hidden.stamina / 10), 0, 100); }
  function moodAdd(id, v) { const m = M(id); if (m) m.mood = clamp(m.mood + (v < 0 ? v * (1.3 - C(id).hidden.mental / 10) : v), 0, 100); }
  function trust(id, v) { const m = M(id); if (m) m.trust = clamp(m.trust + v, 0, 100); }
  function skillOf(id, k) { return k === 'looks' ? C(id).hidden.looks : M(id).sk[k]; }
  function score(id, wts) { return Object.entries(wts).reduce((a, [k, v]) => a + skillOf(id, k) * v, 0) - M(id).fat / 20; }
  function perf(ids, wts) {
    if (!ids.length) return 0;
    const tot = Object.values(wts).reduce((a, b) => a + b, 0);
    const avg = ids.map(id => Object.entries(wts).reduce((a, [k, v]) => a + skillOf(id, k) * v, 0) / tot - M(id).fat / 30 - (M(id).mood < 25 ? 1 : 0));
    return clamp(avg.reduce((a, b) => a + b, 0) / avg.length + (rnd() * 3 - 1.5) - (S.g.flags.lumiHostile ? .6 : 0) + (S.g.flags.goodSong ? .4 : 0), 0, 10);
  }
  const best = (ids, wts) => ids.slice().sort((a, b) => score(b, wts) - score(a, wts))[0];
  const worst = (ids, wts) => ids.slice().sort((a, b) => score(a, wts) - score(b, wts))[0];
  function gainFans(total, ids, nom) {
    if (total > 0) total *= .5 * 8000 / (8000 + S.g.fans);
    total = Math.round(total);
    S.g.fans = Math.max(0, S.g.fans + total);
    S.g.peak = Math.max(S.g.peak || 0, S.g.fans);
    if (!ids || !ids.length) return;
    const wt = ids.map(id => (C(id).hidden.looks * .5 + M(id).sk.talk * .3 + 2) * (id === nom ? 2.5 : 1));
    const sum = wt.reduce((a, b) => a + b, 0);
    ids.forEach((id, i) => M(id).mf = Math.max(0, M(id).mf + total * wt[i] / sum));
  }
  function fansMul(k) { S.g.fans = Math.round(S.g.fans * k); S.g.peak = Math.max(S.g.peak, S.g.fans); }
  function ledger(item, inc, out) { S.g.money += (inc || 0) - (out || 0); S.g.ledger.push([turnName(), item, inc || 0, out || 0, S.g.money]); if (S.g.ledger.length > 400) S.g.ledger.shift(); }
  const ZFANS = ['るみ推し@次は年末|lumi_daisuki_', '地下ドル巡回|chika_junkai', 'はこおし|hakooshi_desu', 'みつば新規|mitsuba_shinki', 'たこやき|takoyaki_ota', '名無し|user', 'ぴの|pino_chekiya', 'アイドル速報まとめ|idol_sokuho_mtm', '在宅おじ|zaitaku_oji', 'かのん|kanon_0w0', '現場帰りのみさ|misa_genba', 'ドルヲタ歴12年|dollwota12', '推し活OL|oshikatsu_ol', '遠征民|ensei_tami', '名無し|user', '名無し|user', 'チェキ帳3冊目|cheki_note3', '箱推し会計士|hako_kaikei', 'ねむい大学生|nemui_daigaku', 'ドル誌ライター|dol_writer_k'];
  function zpost(text, likes, to) {
    const [n, id] = pick(ZFANS).split('|');
    const uid = id === 'user' ? 'user' + (10000000 + Math.floor(rnd() * 89999999)) : id;
    const lk = Math.max(0, Math.round(likes));
    S.g.zlog.unshift([n, uid, md(S.g.day + Math.floor(rnd() * S.g.len)), fill(text, {}), Math.round(lk / 15), Math.round(lk / 6), lk, (lk * 31).toLocaleString(), to]);
    S.g.zlog = S.g.zlog.slice(0, 50);
  }
  function zfrom(kind, o) { zpost(fill(fresh('z_' + kind, TX.z[kind]), o), (o.likes || 100) * (.6 + rnd() * .8)); }
  function ownPost(text, likes) { S.g.own.unshift([md(S.g.day + Math.floor(rnd() * S.g.len)) + ' 20:00', text, '♡ ' + Math.max(1, Math.round(likes)).toLocaleString()]); S.g.own = S.g.own.slice(0, 30); }
  function log(text) {
    const y = date(S.g.day).getFullYear();
    if (S.g.log.some(([d, t]) => date(d).getFullYear() === y && t.endsWith('、' + text))) return;
    S.g.log.push([S.g.day, `${ymd(S.g.day)}、${text}`]);
  }
  function rest(id, n) { const m = M(id); if (!m || m.status === 'left') return; m.status = 'rest'; m.rest = Math.max(m.rest, n); }
  function mf(id, k) { const m = M(id); if (m) m.mf *= k; }
  function flagM(id, k, v) { const m = M(id); if (m) m.flags[k] = v; }
  function book(n, label) {
    const free = plans().map((s, i) => s ? -1 : i).filter(i => i >= 0);
    if (free.length < n) { OS.dialog('カレンダー', `予定の枠が ${n} つ必要です。カレンダーで予定を取り消してから選んでください。`, null, 'warn'); return false; }
    free.slice(0, n).forEach(i => plans()[i] = { kind: 'fixed', label });
    return true;
  }
  const mgr = () => S.g.turn < 3 || S.g.flags.lumiEnd ? '佐野 美咲(マネージャー)' : pick(['佐野 美咲(マネージャー)', '現場マネージャー 新井']);
  // 脱退・卒業・移籍。kind: grad(卒業)/leave(脱退)/transfer(移籍)
  function leave(id, why, kind) {
    const m = M(id);
    if (!m || m.status === 'left') return;
    m.status = 'left'; m.leftKind = kind || 'leave'; m.leftDay = S.g.day;
    log(`${full(id)}が${why}`);
    S.chats.group.log.push(['', '', `${full(id)} がグループを退会しました`]);
    S.chats.group.members = Math.max(2, (S.chats.group.members || 3) - 1);
    S.g.departed = (S.g.departed || 0) + 1;
    S.g.departedNow = 1;
    if (kind === 'grad') zfrom('grad', { m: nm(id), likes: 300 + S.g.fans * .03 });
    else zpost(`{g}、${nm(id)}${pick(['ちゃん脱退って本当?', 'の脱退、理由ちゃんと説明して', 'いなくなるの寂しすぎる'])}`, 300 + S.g.fans * .03);
    if (S.g.love && S.g.love.id === id && kind !== 'grad') S.g.love.ended = 1;
    if (S.g.leader === id) S.g.leader = null;
  }
  const X = { pick, rnd, ready, active, left, M, C: id => C(id), nm, full, minor, moodAdd, tire, trust, fansMul, mf, flagM, ledger, zpost, log, rest, leave, book, mgr, rel: (k, v) => S.g.rel[k] = (S.g.rel[k] || 0) + v, fans: v => gainFans(v), get g() { return S.g; } };
  let EV = null, SEV = null;
  const evs = () => EV || (EV = EVENT_DEFS(X));
  const sevs = () => SEV || (SEV = SECRET_EVENTS(X));

  // ---------- 仕事の実行 ----------
  function runJob(mail, R) {
    const job = mail.job, cast = (mail.cast || []).filter(id => S.g.m[id] && M(id).status === 'active');
    const when = slotLabel(job.slot);
    if (!cast.length) { if (job.k === 'lastlive') S.g.lastLiveDone = { att: 0, q: 0 }; R.push(`■ ${when} ${mail.subject}\n出られるメンバーがいなかった。先方に平謝りした。`); S.g.rel[job.ck] = (S.g.rel[job.ck] || 0) - 2; mail.jobState = 'done'; return; }
    const q = perf(cast, job.w), bId = best(cast, job.w), wId = worst(cast, job.w), b = nm(bId), wv = nm(wId);
    const t3 = q >= 6.5 ? 2 : q >= 4 ? 1 : 0;
    const o = { b, w: wv, n: Math.round(20 + rnd() * 200) };
    let txt = '', pay = 0;
    const rep = TX.report[job.kind];
    if (job.k === 'gradshow' || job.k === 'lastlive') txt = '';
    else if (rep && Array.isArray(rep[0])) txt = fill(fresh(`rp_${job.kind}_${t3}`, rep[t3]), o);
    else if (rep) txt = fill(fresh('rp_' + job.kind, rep), o);
    if (job.kind === 'oneman') txt = '';
    if (job.kind === 'pr' && rnd() < .3) { txt += '…が、「#PR」の表記が小さすぎるとZで指摘され、「ステマ」と言われ始めた。'; fansMul(.96); S.g.heat += 8; zpost(`${full(cast[0])}の投稿、PR表記どこ? ステマじゃん`, 300 + rnd() * 400); }
    if (job.kind === 'gravure' && C(cast[0]).hidden.drive >= 7) txt += '\n次の日、「次は表紙を狙います」とLINEが来た。';
    if (job.kind === 'dinner') {
      const [a, c] = cast;
      txt = `(自分も同行した)二次会に誘われたのを、${nm(a)}がうまく断ってくれた。${nm(c || a)}は帰りのタクシーで泣いていた。\n先方からは「いい子たちですね」とだけ連絡があった。出資の話は、それきり出ていない。`;
      cast.forEach(id => { moodAdd(id, -30); trust(id, -20); });
      S.g.flags.dinner = 1; log('スポンサー候補との会食にメンバーを同席させた。');
    }
    // ギャラ
    if (job.pay === 'ticket') { const att = Math.max(3, Math.round(S.g.fans * .012 * (.5 + q / 10) + rnd() * 8)); pay = att * 1000; txt += `\n動員 ${att}人。`; }
    else if (job.pay === 'gift') pay = Math.round(cast.reduce((a, id) => a + M(id).mf * (8 + rnd() * 20), 0) / 100) * 100;
    else if (job.pay === 'oneman') {
      const att = Math.min(job.cap, Math.round(S.g.fans * (.03 + rnd() * .03) * (.6 + q / 12)));
      ledger(`会場費(${job.client})`, 0, job.venue);
      pay = att * job.price;
      const fill_ = att / job.cap;
      txt = fill_ >= .95 ? `チケットは完売した。${att.toLocaleString()}人。開演前の客席を袖から見て、${b}が泣いていた。` : fill_ >= .6 ? `${att.toLocaleString()}人(キャパの${Math.round(fill_ * 100)}%)。後ろの方は少し空いていた。それでも、最後の曲で全員が手を挙げた。` : `${att.toLocaleString()}人(キャパの${Math.round(fill_ * 100)}%)。客席の後ろ半分は、照明を落としてごまかした。終演後、${wv}が「すみません」と謝ってきた。謝ることではない。`;
      if (fill_ >= .95) log(`${job.client.replace(/\(.+\)/, '')}でのワンマンライブを完売させた。`);
    } else pay = job.pay || 0;
    if (pay) ledger(mail.subject.slice(0, 18), pay, 0);
    // ファン
    let fanGain = job.fans * (.3 + q / 8) * (job.lumi ? (S.g.flags.lumiHostile ? .3 : 1) : 1) * (1 + (S.g.rel[job.ck] || 0) * .03);
    if (job.k === 'lastlive') fanGain = 0;
    gainFans(fanGain, cast, job.nominee);
    // 特典会
    if (job.cheki) {
      const ch = cast.map(id => [id, Math.max(0, Math.round(M(id).mf * .015 * (.6 + rnd() * .8) + q * .4 - 1))]).sort((a, b) => b[1] - a[1]);
      const sum = ch.reduce((a, x) => a + x[1], 0);
      if (sum) ledger('特典会(チェキ)', sum * 1000, 0);
      txt += `\n特典会: ${ch.map(([id, n]) => `${nm(id)} ${n}枚`).join(' / ')}`;
      const low = ch[ch.length - 1];
      if (ch.length > 2 && low[1] <= 1) { moodAdd(low[0], -12); txt += `\n${nm(low[0])}の前には、ほとんど誰も並ばなかった。`; }
    }
    // 卒業公演・解散ライブ
    if (job.k === 'gradshow' && S.g.gradShow) {
      S.g.gradShow.forEach(id => { if (M(id) && M(id).status !== 'left') { txt = fill(fresh('gradshow', TX.gradShow), { m: nm(id) }) + '\n' + txt; gainFans(300 + M(id).mf * .3); leave(id, '卒業した。', 'grad'); } });
      S.g.gradShow = null;
    }
    if (job.k === 'lastlive') S.g.lastLiveDone = { att: Math.round(S.g.fans * .05), q };
    cast.forEach(id => {
      tire(id, 18 * (job.tired || 1) + (job.night ? 12 : 0));
      M(id).jobs++; M(id).wjobs++;
      if (job.nominee === id) { M(id).nom++; moodAdd(id, 6); }
      if (minor(id) && (job.slot >> 1) % 7 < 5 && job.slot % 2 === 0) { M(id).flags.absent = (M(id).flags.absent || 0) + 1; moodAdd(id, M(id).flags.school ? -10 : -4); }
      if (q >= 6.5) moodAdd(id, 4);
    });
    if (job.kind === 'gravure' && C(cast[0]).hidden.drive < 7) moodAdd(cast[0], -20);
    if (job.kind !== 'dinner' && job.k !== 'lastlive') zfrom(['bad', 'mid', 'good'][t3], { b, w: wv, likes: Math.max(30, fanGain) });
    mail.jobState = 'done';
    R.push(`■ ${when} ${mail.subject}\n出演: ${cast.map(nm).join('・')}${pay ? ' / 収入 ' + yen(pay) : ''}\n${txt.trim()}`);
  }
  function runOff(v, R, i) {
    if (v === 'all') {
      ready().forEach(id => { M(id).fat = clamp(M(id).fat - 22, 0, 100); moodAdd(id, 6); });
      R.push(`■ 全員オフ\n${fresh('offall', ['寮で全員でたこ焼きパーティーをしたらしい。', 'みんな昼まで寝ていたらしい。', '何人かで買い物に行ったらしい。帰ってきた顔が明るかった。', '一日中、誰もグループのチャットに書き込まなかった。それでいい。', '近所の銭湯に全員で行ったらしい。'])}`);
      return;
    }
    if (!S.g.m[v] || M(v).status === 'left') return;
    M(v).fat = clamp(M(v).fat - 38, 0, 100); moodAdd(v, 8); trust(v, 3);
    R.push(`■ 休み: ${full(v)}\n${fill(fresh('offone', ['{m}は一日寝ていたらしい。', '{m}から「ちゃんと休みました」と報告があった。', '{m}は実家に電話して、長いこと話していたらしい。', '{m}は映画を3本見たらしい。', '{m}は結局、自主練をしていたらしい。少しだけ。', '{m}は美容院に行ってきた。少し髪が短くなっていた。']), { m: nm(v) })}`);
  }
  function runLesson(v, R, i) {
    ledger(`レッスン(${LESSON[v]})`, 0, 40000);
    const g = ready().map(id => {
      const m = M(id), cur = m.sk[v];
      let gn = .25 + .35 * (10 - cur) / 10 + rnd() * .2;
      if (id === 'shiraishi' && v === 'vocal') gn += .35;
      if (id === 'kashiwagi' && S.g.flags.yuiFree && v === 'dance') gn += .2;
      if (m.mood < 25) gn *= .5;
      m.sk[v] = clamp(cur + gn, 0, 10);
      tire(id, 12);
      return [id, gn];
    }).sort((a, b) => b[1] - a[1]);
    if (!g.length) return;
    const top = nm(g[0][0]), bot = nm(g[g.length - 1][0]);
    R.push(`■ ${slotLabel(i)} レッスン(${LESSON[v]})\n講師のひとこと: 「${fresh('lessonline', [`${top}が一番伸びてる。${bot}は集中できてない`, `${top}は今日よかった。${bot}、家でも練習して`, `全体的に悪くない。${bot}だけ、もう少し`, `${top}、その感じ。${bot}は体が固い`, `今日は${top}の日だったね`, `${bot}、今日どうしたの? 体調?`])}」`);
  }
  // 面談
  const TALK1 = {
    hayase: [m => '前のグループの話を少しした。「ここはお給料、ちゃんと出るんですね」と真顔で言われた。', m => m.trust >= 30 ? '夜、ほとんど眠れていないと打ち明けられた。「2時間寝れば平気です」。平気ではない。' : '「大丈夫です」を3回言った。', m => '「Pさんには言っておきます。坂上さんから、今もときどきDMが来ます」'],
    shiraishi: [m => '東京の空は狭い、と言っていた。', m => m.trust >= 25 ? '父の話をしてくれた。「お父さん、私の顔を見ると怒るんです。お母さんに似てるから」' : '家族の話になると黙った。'],
    kuroda: [m => '歌割りについて、具体的な秒数で不満を言われた。', m => m.trust >= 25 ? '「売れなかったら、私は来年ここにいないと思います。それは正直に言っておきます」' : '「別に、問題ないです」'],
    mori: [m => '寮のご飯を、みんなの分まで作っているらしい。', m => m.trust >= 25 ? '実家の話。母親の体調があまり良くないらしい。「仕送り、もっと増やしたいんです」' : '「家族は元気です!」(即答だった)'],
    nanase: [m => 'SNSの数字の話ばかりしていた。', m => m.trust >= 30 ? (m.flags.confide = 1, '付き合っている人がいる、と打ち明けられた。「隠すの、疲れました」') : '恋愛の話を振ったら、笑ってかわされた。'],
    kashiwagi: [m => '母親から1日に何十件もLINEが来るらしい。', m => m.trust >= 25 ? '「東京、楽しいです」。少しだけ笑った。母親の前では見たことがない顔だった。' : 'ほとんど話さなかった。「踊れればいいです」'],
    kasai: [m => { const lo = active().filter(x => x !== 'kasai').sort((a, b) => M(a).mood - M(b).mood)[0]; return lo ? `最年長として、みんなのことをよく見ている。「${nm(lo)}ちゃん、最近ちょっと元気ないです」` : '「ひとりになっちゃいましたね」と笑っていた。'; }],
    uno: [m => '歌の話のときだけ、目を見て話す。', m => m.trust >= 30 ? (m.flags.consent = 1, '「もし、またネットで何か言われたら…本当のこと、言ってもいいです。Pさんからなら」') : '中学の話は、まだできないと言われた。'],
  };
  function runTalk(id, R, i) {
    const m = M(id);
    if (!m || m.status === 'left') return;
    trust(id, 12); moodAdd(id, 8); m.fat = clamp(m.fat - 8, 0, 100);
    const L = [];
    L.push(m.fat >= 70 ? fresh('t_fat2', ['顔色が悪い。目の下にクマ。', '話しながら何度もあくびを噛み殺していた。', '座った瞬間、深いため息をついた。']) : m.fat >= 45 ? fresh('t_fat1', ['少し疲れている様子。', '肩が凝っているらしく、ずっと首を回していた。', '声が少しかすれていた。']) : fresh('t_fat0', ['元気そう。', '肌の調子がいいらしい。本人が言っていた。', '部屋に入ってくるなり、レッスンの話を始めた。']));
    L.push(m.mood < 25 ? fresh('t_md0', ['ほとんど目を合わせなかった。', '何を聞いても「はい」しか言わなかった。', '途中で泣き出した。理由は言わなかった。']) : m.mood < 50 ? fresh('t_md1', ['受け答えはするが、本音は言わない感じ。', '笑ってはいるが、どこか上の空だった。', '話は普通にできた。それだけだった。']) : fresh('t_md2', ['よく笑っていた。', '最近あった面白いことを3つも話してくれた。', '前より、自分のことを話すようになった。']));
    const T1 = TALK1[id] || [];
    if (m.talks < T1.length) L.push(T1[m.talks](m));
    else { const pool = talkPool(id), use = rnd() < .65 && pool.length ? pool : TX.talkCommon; L.push(fill(fresh('talk_' + id + (use === pool ? '' : '_c'), use), {})); }
    if (C(id).gen && m.talks === 2 && C(id).secret !== 'none' && m.trust >= 30) { L.push('「…Pさんだから言うんですけど」と前置きして、' + C(id).truth.replace(/。$/, '') + '、と打ち明けられた。'); m.flags.confide = 1; if (C(id).secret === 'rumor') m.flags.consent = 1; }
    if (m.flags.baito) { L.push('夜、アルバイトをしていることがわかった。「内緒にしててください」'); if (m.trust >= 30) { m.flags.baito = 0; L.push('やめるように言った。泣きながらうなずいた。'); } }
    if (m.flags.absent >= 3 && minor(id)) L.push(`学校の出席日数が気になっているらしい。(これまでに ${m.flags.absent} 回休ませた)`);
    if (ageOf(id) >= 24 && rnd() < .3) L.push(fresh('t_age', ['「同級生が結婚しました」とぽつりと言った。', '「いつまでアイドルやれるんでしょうね」と聞かれた。', '「年下の子たちのエネルギーに、ついていけない日があります」']));
    m.talks++;
    const name = `面談メモ_${nm(id)}_${md(slotDay(i)).replace('/', '-')}.txt`;
    S.g.files.unshift({ name, text: `面談メモ ${full(id)} ${slotLabel(i)}\n\n${L.join('\n\n')}` });
    R.push(`■ ${slotLabel(i)} 面談: ${full(id)}\n(メモは 新グループ フォルダに保存)`);
  }
  function runSNS(v, R, i) {
    const ids = ready();
    const talk = ids.reduce((a, id) => a + M(id).sk.talk, 0) / Math.max(1, ids.length);
    const boost = S.g.m.nanase && M('nanase').status === 'active' ? 1.4 : 1;
    let gain, txt;
    if (v === 'safe') { gain = (25 + talk * 6) * boost * (.7 + rnd() * .6); txt = fresh('sns_safe', ['レッスン後のオフショットを載せた。いつもの人たちがいいねしてくれた。', 'メンバーの私服の写真を載せた。「かわいい」の引用が少しついた。', '寮のごはんの写真を載せた。なぜか一番伸びた。', 'ライブの告知を載せた。リポストは身内ばかりだった。', '移動中の寝顔を載せた。本人に怒られた。']); ownPost(fresh('own_safe', ['今日もレッスンがんばりました📸', '移動中のひとこま🚃', '今日のごはん🍙', '次のライブもよろしくお願いします!', 'オフショット📷']) + ' #' + S.g.name, gain * 2); }
    else if (v === 'plan') { gain = (60 + talk * 14) * boost * (.5 + rnd()); txt = `「${fresh('sns_plan', ['メンバーの好きなところ言い合ってみた', '寮の冷蔵庫の中身紹介', '最年少に敬語禁止チャレンジ', '利きポテトチップス対決', 'メンバーの私服を勝手に査定', '目隠しで振付やってみた', '寝起きドッキリ(許可済み)', 'メンバーの第一印象を発表', 'ガチの一人カラオケ採点', '100均で衣装を作ってみた'])}」の動画を出した。`; ownPost('【企画】動画あげました!最後まで見てね #' + S.g.name, gain * 2.5); }
    else {
      const r = rnd();
      ownPost(fresh('own_bold', ['【ガチ】メンバー同士で「グループに要らない人」投票してみた', '【ドッキリ】リーダーが脱退すると言ったらメンバーはどうする?', '【検証】すっぴんで街を歩いて何人に気づかれるか', '【本音】メンバーの嫌いなところを言い合ってみた', '【閲覧注意】激辛を完食できなかったら罰ゲーム']) + ' #' + S.g.name, 200 + rnd() * 2000);
      if (r < .4) { gain = (250 + talk * 35) * boost * (.6 + rnd()); txt = '攻めた企画がバズった。知らない人からの引用が止まらない。'; zpost(`{g}の企画動画、地獄すぎて最後まで見てしまった`, gain * 1.5); }
      else if (r < .75) { gain = -S.g.fans * .06; S.g.heat += 15; txt = '攻めた企画が荒れた。「メンバーがかわいそう」「運営が終わってる」'; zpost(`{g}の運営、メンバーで遊ぶのやめなよ`, 800 + rnd() * 1500); ids.forEach(id => moodAdd(id, -8)); log('SNSの企画動画が「メンバーがかわいそう」と批判を浴びた。'); }
      else { gain = 30; txt = '攻めた企画を出したが、ほとんど誰にも見られなかった。'; }
    }
    gainFans(gain, ids);
    R.push(`■ ${slotLabel(i)} SNS運営\n${txt}(フォロワー ${gain >= 0 ? '+' : ''}${Math.round(gain)})`);
  }
  function runSales(v, R, i) {
    S.g.sales.push(v);
    S.g.rel[v] = (S.g.rel[v] || 0) + 1;
    R.push(`■ ${slotLabel(i)} 営業: ${SALES[v]}\n${fresh('sales', ['名刺を12枚配った。2人が資料を受け取ってくれた。', '30分待たされて、5分で終わった。', '先方の担当者がたまたまアイドル好きだった。', '「で、何人呼べるの?」とだけ聞かれた。', '前に仕事をした人が、別の会社に移っていた。紹介してもらえた。', '受付で門前払いだった。', '先方の部長と、なぜか釣りの話で盛り上がった。', '資料を見た担当者が「この子かわいいね」とだけ言った。', '「去年なら呼べたんだけどね」と言われた。', '雨の中、5件回った。'])}`);
  }
  function runMeet(id, R, i) {
    S.g.aud.met = (S.g.aud.met || []).concat(id);
    S.g.files.unshift({ name: `追加面接メモ_${C(id).name.replace(' ', '')}.txt`, text: C(id).interview });
    R.push(`■ ${slotLabel(i)} 候補者と面接: ${C(id).name.replace(' ', '')}\n(メモは 新グループ フォルダに保存)`);
  }
  function runDate(id, R, i) {
    const L = S.g.love;
    if (!L || L.id !== id || !S.g.m[id] || M(id).status === 'left') return;
    L.dates++; moodAdd(id, 15); trust(id, 5); M(id).fat = clamp(M(id).fat - 5, 0, 100);
    L.bare += 7 + rnd() * 8 + Math.min(10, S.g.fans / 8000);
    if (rnd() < .2) { const o = ready().filter(x => x !== id); if (o.length) moodAdd(pick(o), -6); }
    S.g.files.unshift({ name: `メモ_${md(slotDay(i)).replace('/', '-')}.txt`, text: `${dayLabel(slotDay(i))}\n\n${fresh('datescene', TX.dateScene)}` });
    setTimeout(() => dm(id, fresh('lovechat', TX.loveChat)), 2500);
  }
  function runBreakup(id, R, i) {
    const L = S.g.love;
    if (!L || L.id !== id) return;
    S.g.love = null; S.g.exLove = { id, bare: L.bare };
    moodAdd(id, -45); trust(id, -30);
    setTimeout(() => dm(id, fresh('lovebreak', TX.loveBreak)), 2500);
    if (M(id).mood < 15 && rnd() < .5) S.g.queue.push({ ev: 'quit', id });
  }
  // 個人チャット(交際用)
  function dm(id, text, choices, key) {
    const room = 'dm_' + id;
    if (!S.chats[room]) S.chats[room] = { name: full(id), members: null, log: [] };
    S.chats[room].log.push([full(id), dayLabel(S.g.day) + ' 23:' + String(10 + Math.floor(rnd() * 49)), text].concat(choices ? [{ choices, key, chosen: null }] : []));
    S.chatUnread[room] = (S.chatUnread[room] || 0) + 1;
    save(); updateClock(); OS.refresh('chat');
    OS.toast(APPS.chat, full(id), text, () => openChat(room));
  }
  function chatChoose(room, idx, ci) {
    const e = S.chats[room].log[idx], c = e[3];
    if (!c || c.chosen != null) return;
    c.chosen = ci;
    const id = room.slice(3);
    S.chats[room].log.push(['自分', '', c.choices[ci]]);
    if (c.key === 'invite') {
      if (ci === 0) { S.g.love = { id, bare: 5, dates: 0, since: S.g.day }; moodAdd(id, 20); setTimeout(() => dm(id, fresh('loveyes', ['…ほんとですか。うれしいです', 'じゃあ、日にち決めましょう。誰にも内緒で', 'やった。…あ、今のは見なかったことにしてください'])), 1500); }
      else if (ci === 1) { M(id).flags.invitedAt = S.g.turn; moodAdd(id, -5); setTimeout(() => dm(id, fresh('lovemaybe', ['そうですよね。忙しいですもんね', 'またいつか、ですね', 'わかりました。…わかってます'])), 1500); }
      else { M(id).flags.invitedAt = 999; moodAdd(id, -20); trust(id, -10); setTimeout(() => dm(id, fresh('loveno', ['…ですよね。すみません、変なこと言って', '忘れてください。明日からも、普通にします'])), 1500); }
    }
    save(); OS.refresh('chat'); sticky();
  }

  // ---------- 進める ----------
  function advance() {
    const R = [], post = [];
    const weeks = S.g.len / 7;
    Object.values(S.g.m).forEach(m => m.wjobs = 0);
    openJobs().forEach(m => { m.jobState = 'expired'; S.g.rel[m.job.ck || 'in'] = (S.g.rel[m.job.ck || 'in'] || 0) - 1; });
    openChoices().forEach(m => { m.chosen = -1; m.result = resolveNone(m); });
    const runPlan = (s, i) => {
      if (!s) return;
      if (s.kind === 'off') runOff(s.v, R, i);
      if (s.kind === 'lesson') runLesson(s.v, R, i);
      if (s.kind === 'talk') runTalk(s.v, R, i);
      if (s.kind === 'sns') runSNS(s.v, R, i);
      if (s.kind === 'sales') runSales(s.v, R, i);
      if (s.kind === 'meet') runMeet(s.v, R, i);
      if (s.kind === 'date') runDate(s.v, R, i);
      if (s.kind === 'breakup') runBreakup(s.v, R, i);
    };
    for (let w = 0; w < weeks; w++) {
      S.g.slots.forEach((s, i) => { if (s && s.kind === 'job' && Math.floor((i >> 1) / 7) === w) { const m = S.mails.find(x => x.id === s.mail); if (m && m.jobState !== 'done') runJob(m, R); } });
      plans().forEach((s, p) => { if (Math.floor(p / PER_WEEK) === w) runPlan(s, planSlot(p)); });
    }
    // シングルの発売
    if (S.g.release && S.g.release.turn === S.g.turn) releaseSingle(R);
    // お金
    const n = active().length;
    ledger(`メンバー固定給(${n}人×${weeks}週)`, 0, 20000 * n * weeks);
    ledger(`寮・宣伝費(${weeks}週)`, 0, 48000 * weeks);
    if (tier() >= 2) ledger('スタッフ人件費', 0, 60000 * weeks * (tier() - 1));
    if (S.g.debt) { const it = Math.round(S.g.debt * (Math.pow(1.005, weeks) - 1)); S.g.debt += it; S.g.ledger.push([turnName(), `借入金 利息(週0.5%×${weeks})`, 0, 0, S.g.money, it]); }
    if (S.g.money < 0) {
      const need = Math.ceil(-S.g.money / 500000) * 500000;
      S.g.debt += need; ledger('社内貸付(借入)', need, 0);
      post.push({ id: 'debt_' + S.g.turn, from: '経理 大西', addr: 'onishi@mitsuba-pro.co.jp', subject: fresh('debtsubj', ['【経理】新グループ予算の不足について', '【経理】追加の貸付について', '【経理】資金繰りのご報告']), body: `お疲れさまです。経理の大西です。\n\n新グループの予算がマイナスになったため、社内貸付として ${yen(need)} を計上しました。\n借入の合計は ${yen(S.g.debt)} です。\n\n${S.g.debt >= DEBT_MAX * .5 ? '会社として、これ以上はかなり厳しいです。\n上限(¥10,000,000)を超えた場合、会社そのものが持ちません。' : '利息は週0.5%です。「年」ではなく「週」です。お忘れなく。'}\n\n経理 大西` });
    } else if (S.g.debt && S.g.money > 500000) {
      const pay = Math.min(S.g.debt, Math.floor((S.g.money - 500000) / 10000) * 10000);
      if (pay > 0) { S.g.debt -= pay; ledger('借入金 返済', 0, pay); }
    }
    // 疲れ・気分
    const avgJobs = active().reduce((a, id) => a + M(id).wjobs, 0) / Math.max(1, n);
    active().forEach(id => {
      const m = M(id);
      if (m.status === 'rest') { m.rest -= 1; m.fat = clamp(m.fat - 40, 0, 100); if (m.rest <= 0) m.status = 'active'; return; }
      m.fat = clamp(m.fat - (15 + (m.wjobs ? 0 : 12)) * weeks, 0, 100);
      if (m.flags.baito) tire(id, 25 * weeks);
      if (S.g.flags.momControl && id === 'kashiwagi') { moodAdd(id, -10); tire(id, 10); }
      if (m.wjobs < avgJobs - .9) { moodAdd(id, -8); m.flags.hosare = (m.flags.hosare || 0) + 1; }
      if (S.g.love && S.g.love.id !== id && rnd() < .08 * weeks) moodAdd(id, -3);
      m.mood = clamp(m.mood + (55 - m.mood) * .08 * weeks, 0, 100);
    });
    active().forEach(id => {
      const m = M(id);
      if (m.status === 'active' && m.fat >= (id === 'mori' ? 78 : 85)) {
        rest(id, 1); moodAdd(id, -10); S.g.heat += 6;
        R.push(`■ ${full(id)}が倒れた\n${fresh('collapse', ['レッスン中に座り込んで、立てなくなった。', '寮の台所で倒れているのを、メンバーが見つけた。', '現場の帰りの車で、意識がもうろうとしていた。', '本番前の楽屋で過呼吸になった。'])}病院では過労と言われた。次は休ませる。`);
        log(`${full(id)}が過労で倒れ、一時休養した。`);
        zpost(`{g}の${nm(id)}ちゃん休養って…運営なにしてんの`, 300 + rnd() * 600);
      } else if (m.mood <= 12 && !m.flags.quitAsked) { m.flags.quitAsked = 1; S.g.queue.push({ ev: 'quit', id }); }
    });
    // ファン離れ(何もしないと減る。結成から1年たつと新鮮さが薄れる)
    const worked = S.g.slots.some(s => s && s.kind === 'job');
    const churn = .012 + (S.g.day > 365 ? .005 : 0) + (S.g.day > 730 ? .005 : 0) + (worked ? 0 : .02) + S.g.heat / 4000;
    const keep = Math.pow(1 - churn, weeks);
    S.g.fans = Math.round(S.g.fans * keep);
    active().forEach(id => M(id).mf *= Math.pow(.99, weeks));
    if (!worked && S.g.turn > 2) zfrom('quiet', { likes: 40 + S.g.fans * .01 });
    // 本社への上納
    if (S.g.money > 3000000 && !S.g.debt) { const up = Math.round((S.g.money - 3000000) * .5); ledger('本社への上納(利益の50%)', 0, up); }
    // 炎上の熱
    S.g.heat = Math.max(0, S.g.heat - 8 * weeks);
    // 交際のバレ度
    if (S.g.love) S.g.love.bare = Math.max(0, S.g.love.bare - (plans().some(s => s && s.kind === 'date') ? 0 : 3 * weeks));
    if (S.g.exLove) { S.g.exLove.bare -= 6 * weeks; if (S.g.exLove.bare <= 0) S.g.exLove = null; }
    // 週報
    const head = `報告 ${turnName()}(${range()})\n\nZフォロワー ${Math.round(S.g.fans).toLocaleString()}人\n予算 ${yen(S.g.money)}${S.g.debt ? '\n借金 ' + yen(S.g.debt) : ''}\n\n`;
    const report = head + (R.length ? R.join('\n\n') : '(何もしなかった)') + '\n\n― メンバーの様子 ―\n' + active().map(id => `${full(id)}(${ageOf(id)}): ${M(id).status === 'rest' ? '休養中' : condWord(id)}`).join('\n');
    const fname = `報告_${md(S.g.day).replace('/', '-')}.txt`;
    S.g.files.unshift({ name: fname, text: report });
    S.g.files = S.g.files.slice(0, 80);
    // 次のターンへ
    const prevDay = S.g.day;
    (S.g.fanTrace = S.g.fanTrace || []).push(Math.round(S.g.fans)); S.g.fanTrace = S.g.fanTrace.slice(-120);
    S.g.day += S.g.len; S.g.turn++;
    S.g.len = S.g.turn < 4 ? 7 : 14;
    birthdays(prevDay, S.g.day);
    const end = endCheck();
    if (end) finish(end);
    else { S.g.slots = freshSlots(); S.g.plans = freshPlans(); turnStart(); }
    trimMails();
    save();
    refreshAll();
    openText('rep' + S.g.turn, fname, report);
    post.forEach(m => addMail(Object.assign({ date: dayLabel(S.g.day) + ' 08:00' }, m)));
    if (!S.g.done) chatter();
  }
  // 返事をしなかったときに選んだことになる選択肢
  const SYS_NONE = { grad: 2, audOffer: 1, lovenotice: 2, lovepress: 0, release: 1 };
  const GEV_NONE = { kenka: 2, stalker_gen: 2, akushu: 2, injury_gen: 1, school: 2, homesick: 1, hate: 2, rival: 2, presidentcut: 0, lumiere_end: 0, scout_big: 0, fanletter: 0, equipment: 0, flu: 1, leader: 0, song_offer: 1, ex_member_tell: 1, drunk_staff: 2, mv: 2, birthday: 2 };
  const SEV_NONE = { scandal: 2, rumor: 2, parent: 1, money: 1, injury: 1, eating: 2, ambition: 1, pastpost: 2, stalker: 2 };
  function trimMails() { if (S.mails.length > 160) S.mails = S.mails.filter((m, i) => i < 120 || (m.job && m.jobState === 'open') || (m.choices && m.chosen == null)); }
  function birthdays(a, b) {
    active().forEach(id => {
      const m = C(id).birth.match(/(\d+)年(\d+)月(\d+)日/); if (!m) return;
      for (let d = a; d < b; d++) { const t = date(d); if (t.getMonth() + 1 === +m[2] && t.getDate() === +m[3]) { zfrom('birthday', { m: nm(id), n: ageOf(id, d + 1), likes: 200 + M(id).mf * .2 }); if (ageOf(id, d + 1) === 18) log(`${full(id)}が18歳になった。`); } }
    });
  }
  function resolveNone(m) {
    if (m.ev && m.ev.startsWith('quit:')) return QUIT(m.ev.slice(5)).choose(1);
    if (m.ev && SYS[m.ev] && m.choices) { const r = SYS[m.ev](SYS_NONE[m.ev] != null ? SYS_NONE[m.ev] : m.choices.length - 1, m); return '(返事をしなかった)\n' + (r || ''); }
    const ev = EVENTS[m.ev];
    if (ev && ev.none) return ev.none();
    if (m.gev) { const d = evs().find(e => e.id === m.gev); if (d && GEV_NONE[m.gev] != null) { const r = d.choose(m.ctx, GEV_NONE[m.gev]); return '(何もしなかった)\n' + (r || ''); } }
    if (m.sev && S.g.m[m.ctx.a] && M(m.ctx.a).status !== 'left') { const r = sevs()[m.sev](m.ctx.a).choose(SEV_NONE[m.sev]); return '(何もしなかった)\n' + (r === false ? '' : r || ''); }
    return '(何もしなかった)';
  }

  // ---------- ターンのはじめ ----------
  function turnStart() {
    genJobs();
    // 手書きの8人の事件
    Object.entries(EVENTS).forEach(([k, ev]) => { if (!S.g.fired[k] && ev.when()) { S.g.fired[k] = 1; sendEvent(k, ev.mail()); } });
    // 自動生成メンバーの裏の事情
    ready().filter(id => C(id).gen && C(id).secret !== 'none' && !M(id).flags.secretFired && S.g.day - M(id).join >= 21 && rnd() < .22).slice(0, 1).forEach(id => {
      const e = sevs()[SECRETS_EV[C(id).secret]];
      if (!e) return;
      M(id).flags.secretFired = 1;
      const d = e(id);
      S.mails.unshift(Object.assign({ box: 'inbox', unread: true, id: 'sev_' + id, sev: SECRETS_EV[C(id).secret], ctx: { a: id }, date: dayLabel(S.g.day) + ' 08:30', addr: '' }, d.mail));
    });
    // ランダムな事件
    if (S.g.turn > 0) {
      const n = rnd() < .5 ? 1 : rnd() < .6 ? 2 : 0;
      for (let k = 0; k < n; k++) {
        const pool = evs().filter(e => (S.g.evCool[e.id] || 0) <= S.g.turn && e.cond());
        if (!pool.length) break;
        const tot = pool.reduce((a, e) => a + e.weight, 0);
        let r = rnd() * tot, e = pool[0];
        for (const p of pool) { r -= p.weight; if (r <= 0) { e = p; break; } }
        S.g.evCool[e.id] = e.cool === Infinity ? 1e9 : S.g.turn + e.cool;
        const mk = e.make();
        S.mails.unshift(Object.assign({ box: 'inbox', unread: true, id: 'gev_' + e.id + '_' + S.g.turn, gev: e.id, ctx: mk.ctx, date: dayLabel(S.g.day) + ' 08:' + String(20 + k * 7), addr: '' }, mk.mail, { body: fill(mk.mail.body, {}) }));
      }
    }
    S.g.queue.splice(0).forEach(q => { if (S.g.m[q.id] && M(q.id).status !== 'left') sendEvent('quit:' + q.id, quitMail(q.id)); });
    S.g.pend = (S.g.pend || []).filter(p => { if (p.turn <= S.g.turn) { PEND[p.fn] && PEND[p.fn](); return false; } return true; });
    gradCheck();
    loveCheck();
    releaseCheck();
    const audPending = S.mails.some(m => (m.ev === 'audOffer' && m.chosen == null) || (m.aud && !m.audDone));
    if (S.g.departedNow || (active().length < 3 && !audPending && !(S.g.aud && !S.g.aud.done))) audOffer();
    S.g.departedNow = 0;
    if (S.g.heat >= 70 && !S.g.flags.heatWarn) { S.g.flags.heatWarn = 1; sendEvent('info', { id: 'heatwarn_' + S.g.turn, from: '桐谷 誠(部長)', subject: '最近の件について', body: '最近、グループの名前が悪い意味で出すぎています。\n社長からも聞かれました。\n\nこれ以上何かあったら、活動休止も考えます。\n\n桐谷' }); }
    if (S.g.heat < 40) S.g.flags.heatWarn = 0;
  }
  const SECRETS_EV = { boyfriend: 'scandal', rumor: 'rumor', parent: 'parent', money: 'money', injury: 'injury', eating: 'eating', ambition: 'ambition', pastpost: 'pastpost', stalker: 'stalker' };
  function sendEvent(k, m) { S.mails.unshift(Object.assign({ box: 'inbox', unread: true, ev: k, addr: '', date: dayLabel(S.g.day) + ' 08:' + String(10 + Math.floor(rnd() * 40)) }, m)); }
  function choose(mailId, idx) {
    const mail = S.mails.find(x => x.id === mailId);
    let res;
    if (mail.gev) res = evs().find(e => e.id === mail.gev).choose(mail.ctx, idx);
    else if (mail.sev) res = sevs()[mail.sev](mail.ctx.a).choose(idx);
    else if (mail.ev && mail.ev.startsWith('quit:')) res = QUIT(mail.ev.slice(5)).choose(idx);
    else if (mail.ev && SYS[mail.ev]) res = SYS[mail.ev](idx, mail);
    else res = EVENTS[mail.ev].choose(idx, mail);
    if (res === false) return;
    mail.chosen = idx; mail.result = fill(res, {});
    const end = endCheck();
    if (end) { finish(end); }
    save(); refreshAll();
  }

  // ---------- 卒業 ----------
  function gradCheck() {
    if (S.g.gradShow || S.g.lastLive) return;
    const cand = ready().filter(id => { const m = M(id); return S.g.day - m.join >= 240 && !m.flags.gradAsk && (m.flags.gradCool || 0) <= S.g.turn; });
    for (const id of cand) {
      const m = M(id), yrs = (S.g.day - m.join) / 365, age = ageOf(id);
      const p = .03 + Math.max(0, yrs - 1) * .07 + Math.max(0, age - 22) * .025 + (m.mood < 35 ? .04 : 0) + (C(id).hidden.drive >= 8 && S.g.fans < 5000 ? .03 : 0);
      if (rnd() < p) {
        m.flags.gradAsk = 1;
        sendEvent('grad', { id: 'grad_' + id + '_' + S.g.turn, from: full(id), subject: fresh('gradsubj', ['お時間いただけますか', '大事なお話があります', '卒業のことで', '少しだけ、話を聞いてください']), body: `Pさん\n\n${fresh('gradopen', ['ずっと考えていたことがあります。', 'うまく言えるかわからないので、メールにしました。', '直接言おうと思ったんですけど、顔を見たら言えなくなりそうで。'])}\n\n${dreamOf(id)}。\n\n${fresh('gradclose', ['グループを卒業させてください。', '次の区切りで、卒業したいです。', 'わがままを言って、ごめんなさい。卒業させてください。'])}\n\n${nm(id)}`, choices: ['卒業を受け入れて、卒業公演を開く', '引き止める', 'もう少しだけ時間をくれと頼む'], gid: id });
        break;
      }
    }
  }
  const SYS = {
    grad(i, mail) {
      const id = mail.gid;
      if (!S.g.m[id] || M(id).status === 'left') return '(すでにいない)';
      if (i === 0) { S.g.gradShow = (S.g.gradShow || []).concat(id); trust(id, 10); log(`${full(id)}が卒業を発表した。`); zfrom('grad', { m: nm(id), likes: 300 + S.g.fans * .05 }); return `${nm(id)}の卒業を受け入れた。\n次のターンの最後に卒業公演を開く。\n\n${nm(id)}は「ありがとうございます」と言って、少し泣いた。`; }
      if (i === 1) { if (M(id).trust >= 55) { M(id).flags.gradCool = S.g.turn + 12; M(id).flags.gradAsk = 0; moodAdd(id, 5); return `${nm(id)}は長いあいだ黙って、それから「…もう少しだけ、ここにいます」と言った。`; } S.g.gradShow = (S.g.gradShow || []).concat(id); moodAdd(id, -15); log(`${full(id)}が卒業を発表した。`); return `${nm(id)}の気持ちは変わらなかった。\n「決めたことなので」とだけ言われた。卒業公演の準備に入る。`; }
      M(id).flags.gradCool = S.g.turn + 6; M(id).flags.gradAsk = 0; moodAdd(id, -5);
      return `${nm(id)}は「…わかりました。でも、気持ちは変わらないと思います」と言った。`;
    },
    aud(i, mail) { return ''; },
    audOffer(i, mail) {
      if (i === 0) { if (S.g.money < 300000 && S.g.debt >= DEBT_MAX * .8) return false; ledger('追加オーディション費用', 0, 300000); startAud(); return '追加オーディションを開くことにした。\n最終候補の資料が、来週には届く。'; }
      if (i === 1) { if (active().length < 3) { S.g.endReq = endKindFromDepartures(); return 'ここで終わりにすることにした。'; } return '今のメンバーで続けることにした。'; }
      S.g.endReq = endKindFromDepartures(); return 'ここで終わりにすることにした。';
    },
    lovenotice(i, mail) {
      const o = mail.oid, L = S.g.love; if (!L) return '(もう関係はない)';
      if (i === 0) { trust(o, -12); return `${nm(o)}は「…わかりました」と言った。\n目が冷たかった。`; }
      if (i === 1) { moodAdd(o, -10); trust(o, 5); L.bare = Math.max(0, L.bare - 5); return `${nm(o)}は長いこと黙っていた。\n最後に「${nm(L.id)}を泣かせたら、許さないです」と言った。`; }
      L.bare += 6; trust(o, -18); return `${nm(o)}は「そうですか」とだけ言った。\n信じていない顔だった。`;
    },
    lovepress(i, mail) {
      const L = S.g.love || (S.g.exLove && { id: S.g.exLove.id, bare: S.g.exLove.bare });
      if (!L) return '(もう関係はない)';
      if (i === 0) { if (S.g.love) S.g.love.bare += 10; return '関係を否定した。記者は「そうですか」と言って電話を切った。\n笑っているような声だった。'; }
      if (i === 1) { const id = L.id; if (S.g.love) { S.g.love = null; S.g.exLove = { id, bare: L.bare - 30 }; moodAdd(id, -45); trust(id, -30); setTimeout(() => dm(id, fresh('lovebreak', TX.loveBreak)), 2000); } return '関係を終わらせた。\n記者には「もう何もない」と答えた。'; }
      if (rnd() < .4) { if (S.g.love) S.g.love.bare = Math.max(0, S.g.love.bare - 40); S.g.flags.bossKnows = 1; return '部長に話した。長い沈黙のあと、「わかった。こっちで止める」と言われた。\n「次はないぞ」とも。'; }
      S.g.endReq = 'fired'; return '部長に話した。\n部長は何も言わずに、社長室へ行った。';
    },
  };
  function endKindFromDepartures() {
    const ids = Object.keys(S.g.m);
    const grads = ids.filter(id => M(id).leftKind === 'grad').length;
    return grads >= Math.ceil(ids.length / 2) ? 'grad' : 'disband_bad';
  }

  // ---------- 追加オーディション ----------
  function audOffer() {
    if (S.g.lastLive || (S.g.aud && !S.g.aud.done)) return;
    const n = active().length;
    if (n === 0) return;
    sendEvent('audOffer', { id: 'audoffer_' + S.g.turn, from: '桐谷 誠(部長)', subject: n < 3 ? 'グループの今後について(至急)' : '追加メンバーについて', body: n < 3 ? `メンバーが${n}人になりました。\nこのままでは、グループとして活動を続けるのは難しいです。\n\n追加オーディションをして続けるか、ここで終わりにするか、決めてください。\n\n桐谷` : `メンバーが抜けたので、追加オーディションをやるかどうか決めてください。\n費用は30万円ほどかかります。\n\n今の人数のままでもかまいません。\nファンの中には、新メンバーを嫌がる人もいます。\n\n桐谷`, choices: n < 3 ? ['追加オーディションをする(¥300,000)', 'ここでグループを終わりにする'] : ['追加オーディションをする(¥300,000)', '今の人数で続ける'] });
  }
  function startAud() {
    const used = new Set(Object.keys(S.g.m).concat(S.run || []));
    const ids = [];
    const leftovers = (S.run || []).filter(id => !S.g.m[id]);
    if (leftovers.length && rnd() < .7) ids.push(pick(leftovers));
    while (ids.length < 4) {
      const c = GEN.gen(40 + Math.floor(rnd() * 59));
      S.pool.push(c); ids.push(c.id);
    }
    S.g.aud = { ids, turn: S.g.turn + 1, met: [] };
    S.g.pend.push({ turn: S.g.turn + 1, fn: 'audMail' });
  }
  function openAudPick(mailId) {
    const mail = S.mails.find(x => x.id === mailId);
    OS.open('audpick', {
      title: '追加メンバーを選ぶ', icon: 'folder', w: 440, h: 480,
      render(body) {
        body.innerHTML = `<div class="asg"><div class="asg-h"><b>追加オーディション 最終候補</b><span>今のメンバー ${active().length}人。誰も入れないこともできます。</span></div><div class="asg-list"></div>
          <div class="asg-foot"><span class="asg-n"></span><button class="btn primary">決定</button></div></div>`;
        const L = body.querySelector('.asg-list');
        S.g.aud.ids.forEach(id => {
          const c = C(id);
          const r = OS.el('label', 'asg-row');
          r.innerHTML = `<input type="checkbox" value="${id}">${photoSlot(c, 'tiny')}<span><b>${escapeHtml(c.name)}</b><small>${c.age}歳・${escapeHtml(c.career)}${(S.run || []).includes(id) ? '(前回の最終候補)' : ''}</small></span>`;
          L.append(r);
        });
        const upd = () => { const n = body.querySelectorAll('input:checked').length; body.querySelector('.asg-n').textContent = n ? `${n}人を入れる` : '誰も入れない'; };
        body.querySelectorAll('input').forEach(i => i.onchange = upd); upd();
        body.querySelector('.primary').onclick = () => {
          const ids = Array.from(body.querySelectorAll('input:checked')).map(i => i.value);
          ids.forEach(join);
          S.g.aud.done = 1;
          mail.audDone = ids.length ? `${ids.map(id => C(id).name.replace(' ', '')).join('・')}を入れた` : '誰も入れなかった';
          if (!ids.length && active().length < 3) S.g.endReq = endKindFromDepartures();
          OS.close('audpick');
          const end = endCheck(); if (end) finish(end);
          save(); refreshAll();
        };
      },
    });
  }
  function join(id) {
    const h = C(id).hidden;
    S.g.m[id] = { fat: 10, mood: 65, trust: 10, mf: 30 + h.looks * 10, sk: { vocal: h.vocal, dance: h.dance, talk: h.talk }, status: 'active', rest: 0, jobs: 0, wjobs: 0, nom: 0, talks: 0, flags: {}, join: S.g.day };
    log(`${full(id)}が新メンバーとして加入した。`);
    S.chats.group.log.push(['', '', `${full(id)} がグループに参加しました`]);
    S.chats.group.members = (S.chats.group.members || 3) + 1;
    zfrom('join', { m: nm(id), likes: 200 + S.g.fans * .03 });
    let t = 600;
    (C(id).greet || []).forEach(g => { t += 900; setTimeout(() => pushChat('group', full(id), g), t); });
  }

  // ---------- 交際 ----------
  function loveCheck() {
    const L = S.g.love;
    if (L && (L.ended || !S.g.m[L.id])) { S.g.exLove = { id: L.id, bare: L.bare }; S.g.love = null; }
    if (!S.g.love) {
      const c = ready().filter(id => dateable(id) && M(id).trust >= 70 && M(id).talks >= 5 && M(id).mood >= 45 && (M(id).flags.invitedAt == null || S.g.turn - M(id).flags.invitedAt >= 8) && M(id).flags.invitedAt !== 999);
      if (c.length && rnd() < .35) {
        const id = pick(c);
        M(id).flags.invitedAt = S.g.turn;
        setTimeout(() => dm(id, fresh('inv_' + id, invites(id)), ['行く', 'はぐらかす', 'はっきり断る'], 'invite'), 3500);
      }
      return;
    }
    const b = S.g.love.bare;
    const others = ready().filter(id => id !== S.g.love.id);
    if (b >= 35 && !S.g.love.noticed && others.length) {
      S.g.love.noticed = 1;
      const o = others.includes('kasai') ? 'kasai' : pick(others);
      sendEvent('lovenotice', { id: 'lovenotice_' + S.g.turn, from: full(o), subject: fresh('ln_subj', ['少しだけいいですか', 'Pさんに聞きたいことがあって', '(件名なし)']), body: `Pさん\n\n${fresh('ln_body', [`この前、Pさんと${nm(S.g.love.id)}が一緒にいるところを見ました。`, `${nm(S.g.love.id)}のスマホの通知に、Pさんの名前が出てました。夜中の2時に。`, `${nm(S.g.love.id)}が最近、Pさんの話をするとき、顔が変わります。気づいてないと思ってるのは本人だけです。`])}\n\n本当のことを教えてください。\n\n${nm(o)}`, choices: ['誰にも言わないでほしいと頼む', '正直に話して、理解を求める', '否定する'], oid: o });
    } else if (b >= 65 && !S.g.love.press) {
      S.g.love.press = 1;
      sendEvent('lovepress', { id: 'lovepress_' + S.g.turn, from: '週刊ミッドナイト 編集部 記者 戸田', subject: 'ご確認のお願い', body: `${S.g.name}ご担当のプロデューサー様\n\n週刊ミッドナイトの戸田と申します。\n${dayLabel(S.g.day - 3)}の深夜、${pick(['都内の飲食店から', '〇〇駅の近くで', '貴社の寮の近くで'])}、貴殿と${full(S.g.love.id)}さんがご一緒されているところを確認しております。\n\n担当プロデューサーとメンバーの関係について、コメントをいただけないでしょうか。\n掲載は再来週を予定しております。`, choices: ['関係を否定する', '関係を終わらせる', '部長に相談する'] });
    } else if (b >= 100) {
      S.g.endReq = 'fired';
    }
  }

  // ---------- シングル ----------
  function releaseCheck() {
    if (S.g.release || S.g.turn < 4 || S.g.lastLive) return;
    if (S.g.turn - (S.g.lastRelease || 0) < 6) return;
    const cost = [500000, 1000000, 2000000, 4000000, 8000000][tier()];
    const title = fresh('song', TX.songs);
    sendEvent('release', { id: 'rel_' + S.g.turn, from: '桐谷 誠(部長)', subject: `${S.g.releases.length ? '次の' : '最初の'}シングルについて`, body: `${S.g.releases.length ? '次のシングル' : 'デビューシングル'}の話です。\n\n仮タイトルは「${title}」。\n制作費とプロモーション込みで ${yen(cost)} かかります。\n売れなければ赤字です。\n\n出すかどうか、決めてください。\n\n桐谷`, choices: ['出す', '今回は見送る'], title, cost });
  }
  const EVENTS_SYS_RELEASE = (i, mail) => {
    S.g.lastRelease = S.g.turn;
    if (i === 1) return '見送ることにした。';
    ledger(`シングル「${mail.title}」制作費`, 0, mail.cost);
    S.g.release = { title: mail.title, turn: S.g.turn, cost: mail.cost };
    return `「${mail.title}」の制作に入った。\nこのターンの終わりに発売になる。`;
  };
  SYS.release = EVENTS_SYS_RELEASE;
  function releaseSingle(R) {
    const r = S.g.release; S.g.release = null;
    const ids = ready();
    const q = perf(ids, { vocal: 1, dance: .6, looks: .6 });
    const sales = Math.round(S.g.fans * (.12 + rnd() * .2) * (.6 + q / 10) * (S.g.flags.goodSong ? 1.5 : 1) + rnd() * 200);
    S.g.flags.goodSong = 0;
    const rank = sales > 150000 ? 1 + Math.floor(rnd() * 3) : sales > 50000 ? 3 + Math.floor(rnd() * 8) : sales > 15000 ? 10 + Math.floor(rnd() * 20) : sales > 4000 ? 30 + Math.floor(rnd() * 60) : 90 + Math.floor(rnd() * 200);
    ledger(`シングル「${r.title}」売上`, sales * 700, 0);
    gainFans(sales * .15, ids);
    S.g.releases.push({ title: r.title, sales, rank, day: S.g.day });
    log(`シングル「${r.title}」を発売。週間チャート${rank}位、売上${sales.toLocaleString()}枚。`);
    zfrom('release', { t: r.title, b: nm(best(ids, { looks: 1 })), likes: 200 + sales * .05 });
    R.push(`■ シングル「${r.title}」発売\n週間チャート ${rank}位 / ${sales.toLocaleString()}枚\n${rank <= 10 ? 'メンバーがチャートのスクショを全員でグループに貼っていた。' : rank <= 50 ? '部長から「次につながる数字だ」と短いメールが来た。' : '発売日の夜、誰もチャートの話をしなかった。'}`);
  }

  // ---------- 終わり ----------
  function endCheck() {
    if (S.g.done) return null;
    if (S.g.endReq) { const e = S.g.endReq; S.g.endReq = null; return e; }
    if (S.g.debt >= DEBT_MAX) return 'bankrupt';
    if (S.g.heat >= 100) return 'scandal';
    if (S.g.lastLiveDone) return S.g.peak >= 8000 && S.g.fans >= S.g.peak * .5 && S.g.heat < 50 ? 'disband_good' : 'disband_quiet';
    if (active().length === 0) return endKindFromDepartures();
    return null;
  }
  const ENDS = {
    disband_good: ['惜しまれつつ解散', '人気の絶頂で、惜しまれながら解散した。'],
    disband_quiet: ['ひっそりと解散', '大きな話題になることもなく、静かに解散した。'],
    disband_bad: ['事実上の活動休止', 'メンバーの相次ぐ脱退により、事実上の活動休止となった。'],
    grad: ['全員の卒業で活動終了', 'メンバー全員の卒業をもって、活動を終了した。'],
    bankrupt: ['事務所の経営破綻で活動終了', '所属事務所の経営破綻により、活動の継続が不可能となった。'],
    scandal: ['不祥事による活動休止', '相次ぐ騒動を受けて、無期限の活動休止が発表された。'],
    fired: ['担当プロデューサーの解任', '担当プロデューサーとメンバーの不適切な関係が週刊誌で報じられ、プロデューサーは解任された。グループのその後は、別の担当者に引き継がれた。'],
  };
  function rank() {
    const f = S.g.fans, e = S.g.ending;
    let p = f < 1000 ? 0 : f < 5000 ? 1 : f < 20000 ? 2 : f < 60000 ? 3 : f < 150000 ? 4 : 5;
    if (S.g.peak > f * 2 && S.g.peak > 5000) p += 1;
    p += { disband_good: 1, grad: 1, disband_quiet: 0, disband_bad: -1, bankrupt: -1, scandal: -2, fired: -2 }[e] || 0;
    if (S.g.releases.some(r => r.rank <= 10)) p += 1;
    if (S.g.releases.some(r => r.rank === 1)) p += 1;
    p = clamp(p, 0, 6);
    return [['D', '記録にほとんど残らなかったグループ'], ['C', '一部の熱心なファンの記憶に残るグループ'], ['C+', '地下で愛されたグループ'], ['B', 'ライブアイドル界隈で知られた存在'], ['A', '誰もが名前を知るグループ'], ['A+', '一時代を築いたグループ'], ['S', '伝説のグループ']][p];
  }
  function wikiHtml(snap) {
    const g = snap || S.g;
    if (snap && snap.html) return snap.html;
    const [rk, label] = rank();
    const ids = Object.keys(g.m);
    const span = `${ymd(0)}〜${ymd(g.day)}`;
    const yrs = Math.round(g.day / 365 * 10) / 10;
    const memb = id => `${escapeHtml(full(id))}(${escapeHtml(C(id).from.slice(0, 3))}出身・${escapeHtml(C(id).career)})`;
    const byYear = {};
    g.log.forEach(([d, t]) => { const y = date(d).getFullYear(); (byYear[y] = byYear[y] || []).push(t); });
    const E = ENDS[g.ending] || ['', ''];
    return `<div class="site wiki"><h1>${escapeHtml(g.name)}</h1><div class="wk-sub">出典: みんなの百科事典</div>
      <table class="wk-box"><tr><th colspan="2">${escapeHtml(g.name)}</th></tr><tr><td>活動期間</td><td>${span}(約${yrs}年)</td></tr><tr><td>事務所</td><td>ミツバ企画</td></tr><tr><td>メンバー数</td><td>のべ ${ids.length}人</td></tr><tr><td>Zフォロワー(最高)</td><td>${Math.round(g.peak).toLocaleString()}</td></tr>${g.releases.length ? `<tr><td>シングル</td><td>${g.releases.length}枚</td></tr>` : ''}</table>
      <p><b>${escapeHtml(g.name)}</b>は、日本の女性アイドルグループ。株式会社ミツバ企画所属。2026年11月結成。${E[1]}</p>
      <h2>メンバー</h2>
      ${ids.filter(id => M(id).status !== 'left').length ? `<h3>最終メンバー</h3><ul>${ids.filter(id => M(id).status !== 'left').map(id => `<li>${memb(id)}${g.leader === id ? ' - リーダー' : ''}</li>`).join('')}</ul>` : ''}
      ${ids.some(id => M(id).status === 'left') ? `<h3>元メンバー</h3><ul>${ids.filter(id => M(id).status === 'left').map(id => `<li>${memb(id)} - ${ymd(M(id).leftDay)}${{ grad: '卒業', leave: '脱退', transfer: '移籍' }[M(id).leftKind] || '脱退'}</li>`).join('')}</ul>` : ''}
      <h2>来歴</h2><p>2026年秋に開催されたミツバ企画のオーディションから選ばれたメンバーで結成。同年11月、渋谷のライブハウスでお披露目公演を行った。</p>
      ${Object.entries(byYear).map(([y, ts]) => `<h3>${y}年</h3>${ts.map(t => `<p>${escapeHtml(t)}</p>`).join('')}`).join('')}
      ${g.releases.length ? `<h2>作品</h2><ul>${g.releases.map((r, i) => `<li>${i + 1}st シングル「${escapeHtml(r.title)}」(${ymd(r.day)}発売・週間チャート最高${r.rank}位)</li>`).join('')}</ul>` : ''}
      <h2>評価</h2><p>${E[0]}。活動を終えた時点での世間の評価は「${label}」(ランク${rk})。${g.peak > g.fans * 2 && g.peak > 5000 ? '最盛期の勢いを知るファンからは、今も語られることがある。' : ''}${g.debt ? '活動期間を通じて、運営会社の資金繰りの厳しさがたびたび噂された。' : ''}</p>
      <div class="wk-cat">カテゴリ: 日本の女性アイドルグループ | 2026年に結成した音楽グループ | ミツバ企画</div></div>`;
  }
  function finish(kind) {
    S.g.done = true; S.g.ending = kind;
    const [rk, label] = rank();
    const html = wikiHtml();
    try {
      const arc = JSON.parse(localStorage.getItem('idol-archive') || '[]');
      arc.unshift({ name: S.g.name, rank: rk, label, ending: ENDS[kind][0], span: `${ymd(0)}〜${ymd(S.g.day)}`, html });
      localStorage.setItem('idol-archive', JSON.stringify(arc.slice(0, 30)));
    } catch (e) { /* 保存できなくても続ける */ }
    S.g.finalHtml = html;
    save();
    setTimeout(() => {
      openBrowser();
      OS.wins.browser.go({ page: 'view', r: { type: 'wiki', title: `${S.g.name} - みんなの百科事典` } });
      OS.dialog(ENDS[kind][0], `${kind === 'fired' ? 'あなたは担当を外されました。\n\n' : kind === 'bankrupt' ? 'ミツバ企画は倒産しました。\n\n' : ''}${S.g.name}(${ymd(0)}〜${ymd(S.g.day)})\n\n世間の評価: ランク${rk}「${label}」\n\n記事はデスクトップの「過去の担当グループ」に残ります。`,
        [{ label: '新しいグループを担当する', primary: true, fn: () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } location.reload(); } }, { label: '記事を読む' }], 'info');
    }, 1200);
  }

  // ---------- 手書きの8人の事件 ----------
  const EVENTS = {
    akari: { when: () => S.g.turn === 1, mail: () => ({ id: 'ev_akari', from: '桐谷 誠(部長)', subject: 'Lumièreの件(共有)', body: `Lumièreのあかりが、今週から休養に入ります。\n表向きは体調不良です。\n\n佐野さんはしばらくそっちにかかりきりになるので、\n新グループの現場は基本あなた一人で回してください。\n\n同じことを繰り返さないように。\n\n桐谷` }) },
    shiraishi: {
      when: () => S.g.turn === 0 && has('shiraishi'),
      mail: () => ({ id: 'ev_shiraishi', from: '白石 健一', subject: '娘のことで', body: `突然のご連絡、失礼します。白石透子の父です。\n\n娘が東京へ行ったことを、私は昨日まで知りませんでした。\n妻が勝手に同意書に署名したことも。\n\n未成年の娘を、どういうおつもりで預かっているのか。\n今週中にご説明いただけない場合は、しかるべき手段を考えます。\n\n白石`, choices: ['長野へ行って直接説明する(予定の枠を2つ使う)', '本人と母親に任せる', '会社の顧問弁護士から連絡してもらう(¥100,000)'] }),
      choose(i) {
        if (i === 0) { if (!book(2, '長野へ出張(白石家)')) return false; if (rnd() < .7) { S.g.flags.fatherOk = 1; trust('shiraishi', 15); return '父親は最後まで目を合わせなかったが、同意書に署名した。\n「一年。一年で何もなければ、連れて帰ります」'; } S.g.pend.push({ turn: S.g.turn + 1, fn: 'shiraishiCheck' }); return '話は平行線だった。帰りの新幹線で、透子からLINEが来た。「ごめんなさい」'; }
        if (i === 1) { S.g.pend.push({ turn: S.g.turn + 1, fn: 'shiraishiCheck' }); return '透子と母親に任せることにした。'; }
        ledger('顧問弁護士 費用', 0, 100000); S.g.flags.fatherOk = 1; moodAdd('shiraishi', -30); trust('shiraishi', -15);
        return '署名済みの書類だけが返送されてきた。透子はその日、レッスンを休んだ。';
      },
      none: () => { S.g.pend.push({ turn: S.g.turn + 1, fn: 'shiraishiCheck' }); return '(返事をしなかった)'; },
    },
    kashiwagi: {
      when: () => S.g.turn === 0 && has('kashiwagi'),
      mail: () => ({ id: 'ev_kashiwagi', from: '柏木 恵子', subject: 'ゆいの今後について(お願い)', body: `プロデューサー様\n\nゆいの母です。いくつかお願いがございます。\n\n一、ゆいをセンターにしていただけますよね。\n一、レッスンには毎回、私も同席いたします。\n一、ゆいのSNSは私が管理いたします。\n一、寮ではなく、私が借りたマンションから通わせます。\n\nゆいのためです。よろしくお願いいたします。\n\n柏木 恵子`, choices: ['要望をすべて受け入れる', 'レッスンの同席だけはお断りする', '寮に入れて、お母さんとは距離を置いてもらう'] }),
      choose(i) {
        if (i === 0) { S.g.flags.momControl = 1; return 'お母さんからお礼の長文メールが届いた。\nゆいからは、何も来なかった。'; }
        if (i === 1) { moodAdd('kashiwagi', 5); return 'お母さんは不満そうだったが、引き下がった。\nその夜、部長あてに抗議の電話があったらしい。'; }
        S.g.pend.push({ turn: S.g.turn + 1, fn: 'momWar' });
        return 'お母さんは電話口で一時間、泣きながら怒っていた。\n「契約のことは、こちらにも考えがあります」';
      },
    },
    hayase: {
      when: () => has('hayase') && (S.g.turn === 2 || (S.g.turn === 1 && S.g.fans >= 700)),
      mail: () => ({ id: 'ev_hayase', from: '佐野 美咲(マネージャー)', subject: 'みのりちゃんの件、Zで回ってます', body: `佐野です。バタバタしててごめんなさい。\n\nZで、ぷらドロ時代の「繋がり」の噂がまた回ってます。\n元運営の坂上さんのアカウントが、名前は出さずに匂わせてます。\n\nみのりちゃん本人もたぶん見てます。\nどうしますか。\n\n佐野`, choices: ['弁護士から警告文を送る(¥150,000)', '放っておく', 'みのり本人に配信で説明させる'] }),
      choose(i) {
        zpost('ぷらドロの例の件、元運営が匂わせてて草', 400); S.g.heat += 10;
        if (i === 0) { ledger('弁護士 警告文', 0, 150000); trust('hayase', 20); moodAdd('hayase', 10); log(`${full('hayase')}の前所属事務所との確執が表面化し、ミツバ企画は警告文を送った。`); return '警告文を送った翌日、坂上さんのアカウントは鍵がかかった。\nみのりからLINEが来た。「ありがとうございます」。それだけだった。'; }
        if (i === 1) { moodAdd('hayase', -15); fansMul(.97); return '噂は一週間くらいで流れていった。\nみのりは、その間ずっと「大丈夫です」と言っていた。'; }
        if (M('hayase').mood > 40 && M('hayase').fat < 70) { fansMul(1.08); mf('hayase', 1.2); log(`${full('hayase')}が配信で前グループの報酬未払い問題について語り、話題になった。`); return 'みのりは配信で、未払いのことだけを淡々と話した。泣かなかった。\n同接は過去最高。「この子を応援したい」という引用が並んだ。'; }
        fansMul(.95); moodAdd('hayase', -25); tire('hayase', 20);
        return '配信の途中で、みのりは話せなくなった。\n12分の沈黙のあと、配信は切れた。切り抜きが出回った。';
      },
    },
    nanase: {
      when: () => has('nanase') && S.g.turn >= 1 && rnd() < .3 + M('nanase').mf / 4000,
      mail: () => ({ id: 'ev_nanase', from: '桐谷 誠(部長)', subject: '【至急】七瀬の件', body: `Zを見てください。\n七瀬とバンドマンが一緒に歩いている写真が出ました。\n暴露系のアカウントが「続報あり」と言っています。\n\n今日中に方針を決めてください。\n\n桐谷`, choices: ['事実を認めて、謝罪コメントを出す', '事務所として否定する', '本人に任せる'] }),
      choose(i) {
        zpost('リカの彼氏の件、写真出てるのにまだ黙ってるの?', 2000); S.g.heat += 25;
        log(`${full('nanase')}の交際が報じられた。`);
        if (i === 0) { fansMul(.9); mf('nanase', .65); moodAdd('nanase', -20); return '謝罪コメントを出した。\n「アイドルなのに」「謝ることじゃない」で、Zは真っ二つに割れた。\nリカのフォロワーは一晩で1万人減った。'; }
        if (i === 1) { if (rnd() < .5) { fansMul(.98); return '否定のコメントを出した。今のところ、続報は出ていない。'; } fansMul(.75); S.g.heat += 25; active().forEach(id => moodAdd(id, -10)); log('事務所は否定したが、翌週に決定的な写真が出回り、批判が集中した。'); return '否定した三日後、二人が部屋に入っていく写真が出た。\n「嘘つき運営」がトレンドに入った。'; }
        if (M('nanase').flags.confide || M('nanase').trust >= 30) { fansMul(.95); mf('nanase', 1.1); moodAdd('nanase', -10); return 'リカは自分の言葉で書いた。\n「お付き合いしていた方がいました。けじめはつけました。グループで、ちゃんとやります」\n意外にも、好意的な引用が多かった。'; }
        fansMul(.8); moodAdd('nanase', -25);
        return 'リカは一人で否定の投稿をして、すぐに消した。\n消したことが、一番燃えた。';
      },
    },
    kuroda: {
      when: () => has('kuroda') && S.g.turn === 2,
      mail: () => ({ id: 'ev_kuroda', from: '黒田アンナ', subject: '歌割りについて', body: `お疲れさまです。黒田です。\n\n今の歌割りだと、私は全体の2割しか歌っていません。\n正直、納得できていません。\n\nグループのためにも、歌える人が歌うべきだと思います。\nご検討ください。\n\n黒田`, choices: ['メインの歌割りを任せる', '全員均等のままにする', '来年ソロ曲を出すと約束する'] }),
      choose(i) {
        if (i === 0) { moodAdd('kuroda', 20); active().filter(id => id !== 'kuroda').forEach(id => moodAdd(id, C(id).hidden.vocal >= 7 ? -15 : -6)); return 'アンナは「ありがとうございます」とだけ返してきた。\nグループのチャットが、少し静かになった。'; }
        if (i === 1) { moodAdd('kuroda', -20); S.g.pend.push({ turn: S.g.turn + 1, fn: 'kurodaOffer' }); return 'アンナからの返信は「わかりました」の一言だった。'; }
        moodAdd('kuroda', 10); S.g.flags.soloPromise = 1; S.g.pend.push({ turn: S.g.turn + 24, fn: 'soloCheck' }); return 'アンナは少し考えてから、「約束ですよ」と言った。\n部長にはまだ言っていない。';
      },
    },
    mori: {
      when: () => has('mori') && S.g.turn === 2,
      mail: () => ({ id: 'ev_mori', from: '森ひなた', subject: 'ご相談です', body: `Pさん、お疲れさまです。森です。\n\nこんなこと聞いていいのかわからないんですけど、\nお給料の前借りってできますか。\n\nお母さんが入院することになって、\n弟たちの給食費とかが払えなくなりそうで。\n\nすみません。ほんとにすみません。\n\n森ひなた`, choices: ['会社から前借りさせる(¥200,000)', '規則なので断る', '自分のお金から貸す'] }),
      choose(i) {
        if (i === 0) { ledger('森 給与前払い', 0, 200000); trust('mori', 15); moodAdd('mori', 10); return 'ひなたから「ほんとうにありがとうございます!!!」と、絵文字だらけのLINEが来た。'; }
        if (i === 1) { moodAdd('mori', -20); M('mori').flags.baito = 1; return 'ひなたは「ですよね!変なこと聞いてすみません!」と明るく返してきた。'; }
        trust('mori', 25); S.g.flags.lentMoney = 1; return '自分の口座から20万円を振り込んだ。\nひなたは電話口で泣いていた。\n誰にも言っていない。';
      },
      none: () => { M('mori').flags.baito = 1; return '(返事をしなかった)'; },
    },
    kasai: {
      when: () => has('kasai') && (S.g.turn === 2 || (S.g.turn === 1 && S.g.fans >= 600)),
      mail: () => ({ id: 'ev_kasai', from: '桐谷 誠(部長)', subject: '葛西の過去の投稿について', body: `葛西の昔の投稿が掘り起こされています。\n「ルミエールの運営ほんと無能」というやつです。\n\nLumièreのファンが怒っていて、佐野さんもいい顔をしていません。\n\nどうするか決めてください。\n\n桐谷`, choices: ['本人に謝罪文を出させる', 'ネタにする(自虐のMCで笑いに変える)', '何もしない'] }),
      choose(i) {
        zpost('ミツバの新グループに、昔ルミエール叩いてたオタクいるの地獄で草', 1200); S.g.heat += 10;
        if (i === 0) { moodAdd('kasai', -10); fansMul(.98); return 'まひるは長い謝罪文を書いた。\n読んだLumièreのファンの一人が「ちゃんと謝れる人なんだね」と引用していた。'; }
        if (i === 1) { if (M('kasai').mood > 40) { fansMul(1.1); mf('kasai', 1.4); log(`${full('kasai')}が「元Lumièreアンチ」という過去を自虐ネタにし、注目を集めた。`); return 'ライブのMCで、まひるが「元ルミエールのアンチです!今は社員です!」と言った。\n会場が一番笑ったのは、そこだった。'; } fansMul(.92); return 'MCでネタにしたが、まひるの声が震えていた。\n笑いは起きず、「開き直り」と切り抜かれた。'; }
        S.g.flags.lumiHostile = 1; fansMul(.95); return '何もしなかった。\nLumièreのファンの間で、新グループは「敵」ということになったらしい。';
      },
      none: () => { S.g.flags.lumiHostile = 1; return '(何もしなかった)'; },
    },
    uno: {
      when: () => has('uno') && (S.g.turn === 4 || (S.g.turn >= 1 && S.g.fans >= 1500)),
      mail: () => ({ id: 'ev_uno', from: '佐野 美咲(マネージャー)', subject: 'さくらちゃんの中学の件', body: `佐野です。\n\nさくらちゃんの中学の件が、Zでまた回り始めています。\n「いじめ加害者がアイドルに」という書き方です。\n\n本当は逆なのは、私たちは知っています。\nでも、それを言うかどうかは別の話だと思います。\n\n佐野`, choices: ['事務所として「本人は被害者だった」と公表する', '法的措置を取ると発表する(¥150,000)', 'しばらく活動を控えさせる'] }),
      choose(i) {
        zpost('宇野って子、中学でいじめしてたってマジ?', 900); S.g.heat += 15;
        if (i === 0) {
          if (M('uno').flags.consent) { fansMul(1.08); moodAdd('uno', 20); trust('uno', 10); log(`${full('uno')}をめぐるネット上のデマに対し、事務所が事実関係を公表した。`); return '公表した。さくらは、その日のライブで一曲目から泣いていた。\n終演後「言ってくれて、ありがとうございました」と頭を下げられた。'; }
          moodAdd('uno', -40); trust('uno', -30); fansMul(1.03);
          return '公表した。デマは止まった。\nさくらからは一言だけ来た。「勝手に言わないでほしかったです」';
        }
        if (i === 1) { ledger('弁護士 声明', 0, 150000); moodAdd('uno', 5); return '法的措置の声明を出した。書き込みは目に見えて減った。'; }
        rest('uno', 1); moodAdd('uno', -15); fansMul(.97); return 'さくらは休むことになった。\n「私が悪いみたいですね」と言われた。';
      },
    },
  };
  const has = id => S.g.m[id] && M(id).status !== 'left';
  const PEND = {
    shiraishiCheck() {
      if (!has('shiraishi') || S.g.flags.fatherOk) return;
      if (M('shiraishi').trust >= 25) { S.g.flags.fatherOk = 1; sendEvent('info', { id: 'ev_shiraishi2', from: '白石透子', subject: '父のこと', body: 'Pさん\n\n父と、電話で2時間話しました。\n最後に「勝手にしろ」と言われました。\nたぶん、それが父のいいよ、です。\n\n白石' }); return; }
      leave('shiraishi', '家庭の事情により脱退した。', 'leave'); S.g.departedNow = 1;
      sendEvent('info', { id: 'ev_shiraishi3', from: '桐谷 誠(部長)', subject: '白石の件', body: '白石の父親が寮まで迎えに来て、連れて帰りました。\n契約は解除になります。\n\n本人は最後まで何も言いませんでした。\n\n桐谷' });
    },
    momWar() {
      if (!has('kashiwagi')) return;
      if (M('kashiwagi').trust >= 25) { S.g.flags.yuiFree = 1; moodAdd('kashiwagi', 25); sendEvent('info', { id: 'ev_kashi2', from: '柏木ゆい', subject: '(件名なし)', body: 'Pさん\n\nママに、自分で言いました。\n東京にいたいって。\n\nママは泣いてたけど、わたしは泣かなかったです。\n\nゆい' }); return; }
      leave('kashiwagi', '保護者の意向により脱退した。', 'leave'); S.g.departedNow = 1;
      sendEvent('info', { id: 'ev_kashi3', from: '柏木 恵子', subject: '契約解除のご通知', body: '本日をもちまして、ゆいは貴社との契約を解除させていただきます。\n娘の才能を理解していただけなかったこと、大変残念に思います。\n\n柏木 恵子' });
    },
    kurodaOffer() {
      if (!has('kuroda')) return;
      if (M('kuroda').mood < 35 && M('kuroda').trust < 35) {
        leave('kuroda', '他事務所からのソロデビューの誘いを受け、脱退した。', 'leave'); S.g.departedNow = 1;
        sendEvent('info', { id: 'ev_kuroda2', from: '黒田アンナ', subject: 'ご報告', body: 'お疲れさまです。黒田です。\n\n別の事務所から、ソロでのお話をいただきました。\nお受けすることにしました。\n\n短い間でしたが、お世話になりました。\nみんなには、自分で伝えます。\n\n黒田' });
      }
    },
    soloCheck() { if (has('kuroda') && S.g.flags.soloPromise) { moodAdd('kuroda', -25); sendEvent('info', { id: 'ev_solo', from: '黒田アンナ', subject: '約束のこと', body: 'Pさん\n\nソロ曲の約束、覚えてますか。\nもう一年たちました。\n\n黒田' }); } },
    audMail() {
      if (!S.g.aud) return;
      sendEvent('aud', { id: 'aud_' + S.g.turn, from: '桐谷 誠(部長)', subject: '追加オーディション 最終候補', body: `追加オーディションの最終候補 ${S.g.aud.ids.length}人の資料を、共有フォルダ「追加オーディション」に入れました。\n\nカレンダーの空き時間で、候補者と会うこともできます。\n決まったら、このメールから選んでください。\n誰も入れないという判断でもかまいません。\n\n桐谷`, aud: 1 });
    },
  };
  const quitMail = id => ({ id: 'ev_quit_' + id + '_' + S.g.turn, from: full(id), subject: fresh('quitsubj', ['少しお時間いただけますか', '辞めることについて', '話したいことがあります']), body: `Pさん\n\n${fresh('quitbody', ['最近、自分がここにいる意味がわからなくなってます。', '辞めたいって言ったら、怒りますか。', 'ステージに立つのが、こわくなってしまいました。', '朝、起きられなくなりました。', 'もう、何のためにやってるのかわからないです。', '家族に、帰ってこいと言われています。私も、少しそう思っています。'])}\n\n一度、ちゃんと話したいです。\n\n${nm(id)}`, choices: ['すぐに時間を作って引き止める', '本人の気持ちを尊重する'] });
  const QUIT = id => ({
    choose(i) {
      if (!has(id)) return '(すでにいない)';
      if (i === 0) { if (M(id).trust >= 35) { moodAdd(id, 30); return `${nm(id)}と2時間話した。\n最後に「もう少しだけ、やってみます」と言ってくれた。`; } leave(id, '一身上の都合により脱退した。', 'leave'); S.g.departedNow = 1; return `${nm(id)}と話した。\n「Pさんは、私のこと何も知らないじゃないですか」と言われた。\n${nm(id)}は脱退することになった。`; }
      leave(id, '一身上の都合により脱退した。', 'leave'); S.g.departedNow = 1; return `${nm(id)}は、翌週に寮を出ていった。`;
    },
  });

  // ---------- チャット・付箋・表・検索 ----------
  // グループチャットの会話。だれかが話を振って、ほかのメンバーが返す
  function chatter() {
    if (S.g.done) return;
    const rd = ready();
    if (!rd.length) return;
    const rested = active().filter(id => M(id).status === 'rest');
    const newbie = rd.filter(id => S.g.day - M(id).join <= 60 && M(id).join > 0);
    const avgMood = rd.reduce((a, id) => a + M(id).mood, 0) / rd.length;
    const avgFat = rd.reduce((a, id) => a + M(id).fat, 0) / rd.length;
    let when = avgMood >= 60 && avgFat < 55 ? 'good' : avgMood < 38 || avgFat > 70 ? 'bad' : 'mid';
    if (rested.length && rnd() < .5) when = 'rest';
    else if (newbie.length && rnd() < .4) when = 'new';
    const need = t => new Set(t.lines.map(l => l[0]).filter(r => 'abc'.includes(r))).size;
    let pool = TX.threads.filter(t => t.when === when && need(t) <= rd.length - (when === 'new' ? 1 : 0));
    if (!pool.length) pool = TX.threads.filter(t => t.when === 'mid' && need(t) <= rd.length);
    let t0 = 900;
    if (pool.length) {
      const th = fresh('thread_' + when, pool);
      const others = rd.filter(id => !(when === 'new' && newbie.includes(id))).sort(() => rnd() - .5);
      const role = { a: others[0], b: others[1] || others[0], c: others[2] || others[1] || others[0], r: rested[0], n: newbie[0] };
      const names = {}; Object.entries(role).forEach(([k, id]) => { if (id) names[k] = nm(id); });
      th.lines.forEach(([r, text]) => {
        const id = role[r];
        if (!id) return;
        t0 += 900 + Math.min(1800, text.length * 40);
        setTimeout(() => pushChat('group', full(id), fill(text, names)), t0);
      });
    }
    // 季節の話題、ひとりごと
    const mo = date(S.g.day).getMonth() + 1;
    if (S.g.turn > 0 && rnd() < .4 && TX.season[mo]) { const id = pick(rd); setTimeout(() => pushChat('group', full(id), fresh('season' + mo, TX.season[mo])), t0 + 2600); }
    else if (rnd() < .5) {
      const id = pick(rd), m = M(id), v = voiceOf(id), bk = m.mood >= 60 && m.fat < 60 ? 'good' : m.mood >= 30 ? 'mid' : 'bad';
      setTimeout(() => pushChat('group', full(id), fresh(`v_${id}_${bk}`, v[bk])), t0 + 2600);
    }
  }
  // プレイヤーがグループに書き込んだら、だれかが返す
  function replyP() {
    if (!S.g || S.g.done) return;
    const rd = ready().sort(() => rnd() - .5).slice(0, rnd() < .5 ? 1 : 2);
    rd.forEach((id, k) => {
      const m = M(id), bk = m.mood >= 60 ? 'good' : m.mood >= 30 ? 'mid' : 'bad';
      setTimeout(() => pushChat('group', full(id), fresh('replyP_' + bk, TX.replyP[bk])), 1400 + k * 1700);
    });
  }
  function sticky() {
    const n = document.getElementById('sticky');
    if (!n || !S.g) return;
    const free = plans().filter(s => !s).length;
    n.innerHTML = S.g.done ? `<b>おつかれさま</b><br>${escapeHtml(S.g.name)}<br>${escapeHtml((ENDS[S.g.ending] || [''])[0])}` : `<b>${turnName()}</b><br>${range()}<br>予算 ${yen(S.g.money)}${S.g.debt ? `<br><span class="neg">借金 ${yen(S.g.debt)}</span>` : ''}<br>Zフォロワー ${Math.round(S.g.fans).toLocaleString()}<br><br>やること あと${free}つ<br><a href="#" class="st-go">予定が決まったら<br>→ 部長にメールで報告!</a>`;
    const a = n.querySelector('.st-go'); if (a) a.onclick = e => { e.preventDefault(); confirmAdvance(); };
  }
  function refreshAll() {
    ['calendar', 'mail', 'sheet', 'explorer', 'chat'].forEach(w => OS.refresh(w));
    renderDesktop(); updateClock(); sticky();
  }
  function sheetTabs() { return [['money', '収支'], ['members', 'メンバー']]; }
  function sheetRows(tab) {
    let rows = '';
    const r = (n, cells) => `<tr><th>${n}</th>${cells}</tr>`;
    if (tab === 'money') {
      rows += r(1, '<td class="hd">時期</td><td class="hd">項目</td><td class="hd">収入</td><td class="hd">支出</td><td class="hd">残高</td><td class="hd">利息</td><td class="hd"></td>');
      const L = S.g.ledger.slice(-60);
      L.forEach((l, i) => rows += r(i + 2, `<td>${escapeHtml(l[0])}</td><td>${escapeHtml(l[1])}</td><td class="num">${l[2] ? yen(l[2]) : ''}</td><td class="num red">${l[3] ? yen(l[3]) : ''}</td><td class="num ${l[4] < 0 ? 'red' : ''}">${yen(l[4])}</td><td class="num red">${l[5] ? '+' + yen(l[5]) : ''}</td><td></td>`));
      const n = L.length + 2;
      rows += r(n, `<td></td><td class="r"><b>現在</b></td><td></td><td></td><td class="num ${S.g.money < 0 ? 'red' : ''}"><b>${yen(S.g.money)}</b></td><td class="num red">${S.g.debt ? '借金 <b>' + yen(S.g.debt) + '</b>' : ''}</td><td></td>`);
      for (let k = n + 1; k < n + 6; k++) rows += r(k, '<td></td>'.repeat(7));
    } else {
      rows += r(1, ['氏名', '年齢', '出演', '指名', '推しの数(概算)', '状態', 'メモ'].map(h => `<td class="hd">${h}</td>`).join(''));
      Object.keys(S.g.m).forEach((id, i) => {
        const m = M(id);
        rows += r(i + 2, `<td>${escapeHtml(full(id))}${S.g.leader === id ? '(L)' : ''}</td><td class="num">${ageOf(id)}</td><td class="num">${m.jobs}</td><td class="num">${m.nom}</td><td class="num">約 ${Math.round(m.mf / 10) * 10}</td><td class="${m.status === 'left' ? 'red' : ''}">${m.status === 'left' ? ({ grad: '卒業', transfer: '移籍' }[m.leftKind] || '脱退') : m.status === 'rest' ? '休養中' : condWord(id)}</td><td class="memo"><input data-gn="${id}"></td>`);
      });
      for (let k = Object.keys(S.g.m).length + 2; k < 22; k++) rows += r(k, '<td></td>'.repeat(7));
    }
    return rows;
  }
  function explorerFiles() {
    return S.g.files.map(f => ({ name: f.name, icon: 'txt', type: 'テキスト ドキュメント', size: '1 KB', open: () => openText('gf_' + f.name, f.name, f.text) }));
  }
  function searchHits(n) {
    if (!S.g || !S.g.name) return [];
    const key = S.g.name.replace(/[\s ]/g, '').toLowerCase();
    if (!(n.includes(key) || (key.includes(n) && n.length >= 2) || n.includes('新グループ'))) return [];
    const hits = [];
    if (S.g.done) hits.push({ type: 'wiki', title: `${S.g.name} - みんなの百科事典`, site: 'みんなの百科事典', date: '', snippet: `${S.g.name}は、日本の女性アイドルグループ。株式会社ミツバ企画所属。2026年11月結成。` });
    hits.push({ type: 'x', title: `${S.g.name}【公式】(@mitsuba_newgrp)`, site: 'Z', date: '', snippet: `フォロワー ${Math.round(S.g.fans).toLocaleString()}人`, posts: S.g.own.length ? S.g.own : [['11/02 12:00', `${S.g.name} 公式アカウントです。よろしくお願いします!`, '♡ 120']] });
    if (S.g.zlog.length) hits.push({ type: 'xsearch', q: S.g.name, title: `「${S.g.name}」の検索結果 / Z`, site: 'Z', date: '', snippet: S.g.zlog[0][3], posts: S.g.zlog });
    return hits;
  }

  // ---------- 結成 ----------
  function start(pass) {
    S.phase = 'group';
    S.g = { name: '', turn: 0, day: 0, len: 7, money: 600000, debt: 0, fans: 300, peak: 300, heat: 0, m: {}, rel: {}, zlog: [], own: [], log: [], flags: {}, sales: [], pend: [], fired: {}, queue: [], ledger: [], files: [], done: false, evCool: {}, releases: [], used: {} };
    S.g.slots = freshSlots(); S.g.plans = freshPlans();
    const base = { nanase: 1500, kuroda: 400, hayase: 300, mori: 120, kasai: 150 };
    pass.forEach(id => {
      const h = C(id).hidden;
      S.g.m[id] = { fat: 10, mood: 60, trust: 10, mf: base[id] || (C(id).arche === 'model' ? 800 : C(id).arche === 'chika' ? 250 : C(id).arche === 'singer' || C(id).arche === 'creator' ? 300 : 40), sk: { vocal: h.vocal, dance: h.dance, talk: h.talk }, status: 'active', rest: 0, jobs: 0, wjobs: 0, nom: 0, talks: 0, flags: {}, join: 0 };
    });
    if (pass.includes('nanase')) S.g.fans += 1800;
    if (pass.includes('kuroda')) S.g.fans += 300;
    pass.filter(id => C(id).gen && C(id).arche === 'model').forEach(() => S.g.fans += 900);
    S.g.peak = S.g.fans;
    save();
    OS.prompt('グループ名', '部長から「グループ名を決めて、今日中に送ってください」と言われました。\n\nグループ名を入れてください。', '', name => {
      S.g.name = name.slice(0, 24);
      S.chats.group.name = S.g.name;
      turnStart();
      save();
      refreshAll();
      OS.dialog('結成', `11月2日(月)。\n「${S.g.name}」の活動が始まります。\n\n・メールに仕事の依頼が届きます。受けるならメンバーを選びます\n・カレンダーで、1週間に「やること」を3つまで決めます(レッスン・面談・休ませる・SNS運営・営業)\n・予定が決まったら、メールで部長に予定を報告します。送ると次へ進みます
  (メールの「予定を部長に報告する」、カレンダーの下、付箋のどこからでも)\n・最初の1か月は1週間ずつ、そのあとは2週間ずつ進みます\n\nランは、グループが終わるまで続きます。\n(解散・倒産・全員の卒業・あなたの解任)`, [{ label: 'メールを見る', primary: true, fn: openMail }], 'info');
    });
  }

  return {
    start, openCalendar, mailActions, report: confirmAdvance, replyP, sheetTabs, sheetRows, explorerFiles, searchHits, wikiHtml, sticky, chatChoose,
    clockDate: () => { const t = date(S.g.day); return `${t.getFullYear()}/${String(t.getMonth() + 1).padStart(2, '0')}/${String(t.getDate()).padStart(2, '0')}`; },
    audIds: () => S.g && S.g.aud ? S.g.aud.ids : [],
  };
})();
