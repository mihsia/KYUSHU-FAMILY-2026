
const STORE_KEY = 'kyushu-family-app-v1';

const DEFAULT_WISHLIST = [
  { id: 'w1', text: '弓張之丘飯店 露天溫泉夜景', checked: false },
  { id: 'w2', text: '阿蘇火山口纜車(視開放狀況)', checked: false },
  { id: 'w3', text: '別府地獄蒸料理體驗', checked: false },
  { id: 'w4', text: '太宰府 現烤梅枝餅', checked: false },
];

const DEFAULT_MUSTBUY = [
  { id: 'm1', text: '博多通饅頭', checked: false },
  { id: 'm2', text: '熊本熊(Kumamon)周邊小物', checked: false },
  { id: 'm3', text: '別府地獄蒸布丁', checked: false },
  { id: 'm4', text: '明太子(冷凍宅配用)', checked: false },
  { id: 'm5', text: '由布院起司蛋糕', checked: false },
  { id: 'm6', text: '福岡豚骨拉麵泡麵禮盒', checked: false },
];

const PACKING_GROUPS = [
  { name: '證件・預訂', items: [
    { id: 'p1', label: '護照' },
    { id: 'p2', label: '電子機票' },
    { id: 'p3', label: '各飯店訂房確認' },
    { id: 'p4', label: '旅遊平安險' },
    { id: 'p5', label: '日圓現金' },
  ]},
  { name: '衣物(七月・九州 26–34°C)', items: [
    { id: 'p6', label: '透氣短袖 × 多件' },
    { id: 'p7', label: '薄長袖/防曬外套(山區與車內冷氣)' },
    { id: 'p8', label: '好走運動鞋＋涼鞋' },
    { id: 'p9', label: '帽子＋太陽眼鏡' },
    { id: 'p10', label: '泳衣(溫泉飯店 SPA 可用)' },
    { id: 'p11', label: '摺疊傘/輕便雨衣' },
    { id: 'p12', label: '防蚊液' },
  ]},
  { name: '親子用品', items: [
    { id: 'p13', label: '兒童常備藥/暈車藥' },
    { id: 'p14', label: '濕紙巾/隔離袋' },
    { id: 'p15', label: '推車雨罩' },
    { id: 'p16', label: '兒童零食/水壺' },
  ]},
  { name: '隨身電子', items: [
    { id: 'p17', label: '手機充電器/行動電源(隨身,勿托運)' },
    { id: 'p18', label: '相機/記憶卡' },
  ]},
];

const DAYS = [
  {
    id: 0, date: '7/13', dow: '一', color: '#2a8c82', region: '長崎',
    title: '長崎海風與企鵝的夏日序曲',
    temp: '26–32°C', rain: '60%',
    weatherNote: '濕熱、午後雷陣雨可能。短袖＋帽子;稻佐山山頂夜間有風,帶薄外套。',
    activities: [
      { time: '04:20', color: '#2a8c82', title: '桃機二航廈 7 號櫃台集合' },
      { time: '06:50', color: '#2a8c82', title: 'CI110 起飛 ✈' },
      { time: '09:55', color: '#f2a33d', title: '抵達福岡機場・入境' },
      { time: '午', color: '#f2a33d', title: '佐賀風味餐/博多名物料理' },
      { time: '下午', color: '#e8442e', title: '長崎企鵝水族館' },
      { time: '傍晚', color: '#5a7ab8', title: '稻佐山斜坡車・夜景展望台' },
      { time: '夜', color: '#9a5ab8', title: '弓張之丘飯店・自助餐＋溫泉' },
    ],
    alert: null,
    hotel: { name: '弓張之丘飯店', note: '弓張岳山頂南歐風度假飯店,眺望九十九島與佐世保港夜景;山頂無超商,飲料零食下午先買齊帶上山。' },
  },
  {
    id: 1, date: '7/14', dow: '二', color: '#f2a33d', region: '熊本',
    title: '穿越有明海,遇見萌熊列車',
    temp: '21–34°C', rain: '50%',
    weatherNote: '熊本市區內陸悶熱注意補水;阿蘇海拔較高夜晚偏涼,薄長袖備用。',
    activities: [
      { time: '上午', color: '#2a8c82', title: '專車前往島原港' },
      { time: '上午', color: '#f2a33d', title: '高速船橫渡有明海(約 30 分)' },
      { time: '午', color: '#f2a33d', title: '熊本厚切豬排套餐' },
      { time: '下午', color: '#e8442e', title: '萌熊電鐵(上熊本→北熊本)' },
      { time: '下午', color: '#5a7ab8', title: '上通商店街 自由活動' },
      { time: '夜', color: '#9a5ab8', title: '阿蘇溫泉飯店・自助餐' },
    ],
    alert: null,
    hotel: { name: '龜之井阿蘇公園度假村', note: '坐落於世界最大級阿蘇破火山口之中,溫泉大浴場＋室內 SPA(帶泳衣可玩水);宵夜請進飯店前先買。' },
  },
  {
    id: 2, date: '7/15', dow: '三', color: '#e8442e', region: '由布院·別府',
    title: '由布院之森,開往森林深處的列車',
    temp: '22–31°C', rain: '40%',
    weatherNote: '山區早晚涼爽、白天日照強;散策日防曬＋好走鞋,摺疊傘必帶。',
    activities: [
      { time: '上午', color: '#2a8c82', title: '由布院湯之坪街道散策' },
      { time: '上午', color: '#2a8c82', title: '金鱗湖畔散步' },
      { time: '午', color: '#e8442e', title: '特急由布院之森列車・車上便當' },
      { time: '下午', color: '#5a7ab8', title: '別府海地獄參觀' },
      { time: '夜', color: '#9a5ab8', title: '別府清風・自助餐＋海景溫泉' },
    ],
    alert: '別府空中纜車因設備更新工程 6/26–7/17 停駛,改參觀海地獄,並退費(大人 1,000 円/兒童 600 円)。',
    hotel: { name: '大江戶溫泉物語 別府清風', note: '別府灣海濱展望溫泉,位於北濱鬧區,步行 5 分內有超商,JR 別府站步行 10 分可補貨。' },
  },
  {
    id: 3, date: '7/16', dow: '四', color: '#5a7ab8', region: '太宰府·福岡',
    title: '野生動物、學問之神與福岡購物',
    temp: '26–33°C', rain: '40%',
    weatherNote: '全程戶外最多的一天!動物園與參道曝曬,帽子＋防曬＋大量喝水。',
    activities: [
      { time: '上午', color: '#2a8c82', title: '九州自然野生動物園・叢林巴士' },
      { time: '午', color: '#f2a33d', title: '太宰府飛梅御膳＋天滿宮參拜' },
      { time: '下午', color: '#e8442e', title: '日本免稅店(約 1 小時)' },
      { time: '下午', color: '#5a7ab8', title: 'LALAPORT 福岡 自由活動(1:1 鋼彈)' },
      { time: '晚', color: '#9a5ab8', title: '三大蟹鍋物吃到飽＋酒水暢飲' },
      { time: '夜', color: '#9a5ab8', title: '福岡大倉飯店｜加碼:屋台・一蘭' },
    ],
    alert: '伴手禮務必今天買齊(D5 時間極少)。晚上飯店旁唐吉訶德 24H 最後掃貨。',
    hotel: { name: '福岡大倉飯店', note: '地鐵中洲川端站直結,步行 2 分到中洲;5 分到唐吉訶德中洲店(24H 可免稅)。' },
  },
  {
    id: 4, date: '7/17', dow: '五', color: '#9a5ab8', region: '福岡→台灣',
    title: '帶著九州夏日記憶返程',
    temp: '26–33°C', rain: '50%',
    weatherNote: '移動日輕便即可;機艙冷氣強,小朋友備薄外套。',
    activities: [
      { time: '07:00', color: '#2a8c82', title: '飯店早餐(行李前晚整理好)' },
      { time: '08:30', color: '#f2a33d', title: '前往福岡機場國際線' },
      { time: '09:00', color: '#e8442e', title: '辦登機・退稅檢查・出境' },
      { time: '11:00', color: '#5a7ab8', title: 'CI111 起飛 ✈' },
      { time: '12:30', color: '#9a5ab8', title: '抵達桃園,回溫暖的家 🏠' },
    ],
    alert: '免稅品原則上不可在日本境內拆封;出境時海關可能掃護照查核,請放在可出示的地方。',
    hotel: null,
  },
];

const MAP_STOPS = [
  { name: '福岡(抵達)', lat: 33.5904, lng: 130.4017, color: '#111111' },
  { name: '長崎・佐世保', lat: 33.1591, lng: 129.7228, color: '#2a8c82' },
  { name: '熊本・阿蘇', lat: 32.8840, lng: 131.1050, color: '#f2a33d' },
  { name: '由布院・別府', lat: 33.2846, lng: 131.4913, color: '#e8442e' },
  { name: '太宰府・福岡', lat: 33.5202, lng: 130.5346, color: '#5a7ab8' },
];

const FOOD_TABS = [
  { key: 'food', label: '美食', color: '#e8442e' },
  { key: 'souvenir', label: '伴手禮', color: '#2a8c82' },
  { key: 'pharmacy', label: '藥粧', color: '#5a7ab8' },
  { key: 'brand', label: '品牌指定', color: '#9a5ab8' },
];

const FOOD_DATA = {
  food: [
    { name: '一蘭 本社總本店', tag: 'D4晚・福岡中洲', note: '招牌豚骨拉麵,味集中座位讓小朋友自己選濃淡辣度。', price: '約980円起' },
    { name: '中洲屋台街 焼きラーメン', tag: 'D4晚・福岡中洲', note: '小島商店排隊名店,配河岸夜景;屋台每人至少點一品。', price: '約900円' },
    { name: '熊本拉麵(桂花/黑亭)', tag: 'D2午後・熊本上通', note: '蒜香麻油＋炸蒜酥,和博多系比一比。', price: '900–1,100円' },
    { name: '菅乃屋 銀座通り店', tag: 'D2下午・熊本上通', note: '馬肉專門老舖,馬刺盛合、馬肉握壽司。', price: '1,500–3,000円' },
    { name: 'Milch 起司蛋糕', tag: 'D3上午・由布院', note: '現烤半熟起司蛋糕、牛奶霜淇淋。', price: '280–450円' },
    { name: 'B-speak P-Roll 蛋糕捲', tag: 'D3上午・由布院', note: '傳說中的蛋糕捲,常完售,看到就買。', price: '約500円/片' },
    { name: '八女抹茶霜淇淋', tag: 'D4上午・太宰府', note: '福岡八女=頂級抹茶產地。', price: '450–550円' },
    { name: '7-ELEVEN 直火燒布丁/金のシリーズ', tag: '每晚・便利商店', note: '品質保證款,九州限定明太子飯糰。', price: '130–300円' },
    { name: 'FamilyMart ファミチキ/舒芙蕾布丁', tag: '每晚・便利商店', note: '炸物之王,冰沙可 DIY 加牛奶。', price: '190–330円' },
    { name: 'LAWSON 生乳捲/バスチー', tag: '每晚・便利商店', note: 'Uchi Café 甜點控天堂。', price: '200–270円' },
  ],
  souvenir: [
    { name: '博多通りもん', tag: '免稅店/機場/LALAPORT', note: '白豆沙奶油饅頭,福岡第一伴手禮。', price: '8入約1,250円' },
    { name: 'めんべい 明太子仙貝', tag: '免稅店/機場', note: '2枚×8袋,鹹食不怕甜膩。', price: '約900円' },
    { name: '茅乃舍だし 高湯包', tag: '博多Riverain附近/機場', note: '媽媽界傳說,回國熬湯超方便。', price: '30袋約2,300円' },
    { name: '長崎カステラ', tag: 'D1飯店賣店/機場', note: '福砂屋、文明堂經典蜂蜜蛋糕。', price: '1,200–2,200円' },
    { name: '誉の陣太鼓', tag: 'D2上通/熊本站', note: '熊本紅豆麻糬,附小刀自切。', price: '6入約1,500円' },
    { name: 'いきなり団子', tag: 'D2上通', note: '地瓜紅豆糰子,現蒸現吃最好吃。', price: '1個約200円' },
    { name: 'ざびえる', tag: 'D3別府站前', note: '大分洋菓子老舖白餡西點。', price: '6入約800円' },
    { name: '八女茶・抹茶製品', tag: 'D4太宰府/LALAPORT', note: '福岡頂級茶產地。', price: '600–1,500円' },
    { name: '明太子(冷藏)', tag: 'D5機場(保冷袋)', note: '福岡代表伴手禮,回程當天買最新鮮。', price: '1,500–3,000円' },
  ],
  pharmacy: [
    { name: '合利他命 EX PLUS 270錠', tag: 'D2熊本上通(最佳採買日)', note: '疲勞、肩頸痠痛,長輩交代款。', price: '4,500–5,500円' },
    { name: '休足時間 18枚', tag: 'D2熊本上通', note: '每天走 2 萬步的救星,睡前貼小腿。', price: '約550円' },
    { name: 'MUHI 無比滴/貼片', tag: 'D2熊本上通', note: '蚊蟲止癢,貼片小朋友適用。', price: '600–800円' },
    { name: '樂敦眼藥水', tag: 'D2熊本上通', note: '眼睛疲勞、清涼款。', price: '400–800円' },
    { name: '龍角散ダイレクト 16包', tag: 'D2熊本上通', note: '喉嚨不適,免配水直接服用。', price: '約700円' },
    { name: 'パブロンゴールドA 44包', tag: 'D2熊本上通', note: '綜合感冒藥,家庭常備款。', price: '約1,400円' },
    { name: '熱さまシート', tag: 'D2熊本上通', note: '退熱貼,夏日消暑貼額頭。', price: '約400円' },
  ],
  brand: [
    { name: 'Kumamon 北熊本站萌熊商店', tag: 'D2熊本(萌熊電鐵終點)', note: '鐵道限定品只有這裡有。', price: '玩偶1,500–3,500円' },
    { name: 'Kumamon Square', tag: 'D2熊本・鶴屋百貨東館1F', note: '部長辦公室,運氣好遇到本熊營業中。', price: '文具300–800円' },
    { name: 'ReFa 吹風機(LALAPORT 1F 直營)', tag: 'D4福岡', note: 'スマートW 100–240V,台灣可直用最推薦。', price: '約36,000円' },
    { name: 'UNIQLO/GU 家族裝', tag: 'D4 LALAPORT 2F', note: 'UT 親子印花T,滿5,500円可辦免稅。', price: '990–4,500円' },
  ],
};

const EXPENSE_CATEGORIES = ['餐飲', '交通', '購物', '門票', '其他'];

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {};
}

function saveStore(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
}

class Component extends DCLogic {
  constructor(props) {
    super(props);
    const saved = loadStore();
    this.mapRef = React.createRef();
    this.mapInited = false;
    this.state = {
      view: 'home',
      dayIndex: 0,
      foodTab: 'food',
      wishlist: saved.wishlist || DEFAULT_WISHLIST,
      wishlistDraft: '',
      mustbuy: saved.mustbuy || DEFAULT_MUSTBUY,
      mustbuyDraft: '',
      packingChecked: saved.packingChecked || {},
      documents: saved.documents || { '機票': [], '住宿': [], 'VJW': [], '保險': [], '其他': [] },
      expenses: saved.expenses || [],
      expenseDay: 0,
      expenseCat: '餐飲',
      expenseNote: '',
      expenseJpy: '',
      rate: saved.rate || 21.4,
      jpyInput: '',
      twdInput: '',
    };
  }

  persist() {
    saveStore({
      wishlist: this.state.wishlist,
      mustbuy: this.state.mustbuy,
      packingChecked: this.state.packingChecked,
      documents: this.state.documents,
      expenses: this.state.expenses,
      rate: this.state.rate,
    });
  }

  componentDidMount() {
    this.tryInitMap();
  }

  componentDidUpdate() {
    this.tryInitMap();
  }

  tryInitMap() {
    if (this.mapInited) return;
    if (this.state.view !== 'itinerary') return;
    if (!this.mapRef.current || typeof window.L === 'undefined') {
      setTimeout(() => this.tryInitMap(), 200);
      return;
    }
    this.mapInited = true;
    const L = window.L;
    const map = L.map(this.mapRef.current, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 19,
    }).addTo(map);
    const latlngs = MAP_STOPS.map(s => [s.lat, s.lng]);
    L.polyline(latlngs, { color: '#999', weight: 3, dashArray: '6,6' }).addTo(map);
    MAP_STOPS.forEach(s => {
      L.circleMarker([s.lat, s.lng], { radius: 8, color: '#fff', weight: 2, fillColor: s.color, fillOpacity: 1 })
        .addTo(map).bindTooltip(s.name, { permanent: false });
    });
    map.fitBounds(latlngs, { padding: [24, 24] });
  }

  setView(v) {
    return () => { this.mapInited = this.mapInited && v === 'itinerary'; this.setState({ view: v }); };
  }

  toggleWishlist(id) {
    return () => {
      this.setState(s => ({ wishlist: s.wishlist.map(i => i.id === id ? { ...i, checked: !i.checked } : i) }), () => this.persist());
    };
  }
  removeWishlist(id) {
    return () => {
      this.setState(s => ({ wishlist: s.wishlist.filter(i => i.id !== id) }), () => this.persist());
    };
  }
  toggleMustbuy(id) {
    return () => {
      this.setState(s => ({ mustbuy: s.mustbuy.map(i => i.id === id ? { ...i, checked: !i.checked } : i) }), () => this.persist());
    };
  }
  removeMustbuy(id) {
    return () => {
      this.setState(s => ({ mustbuy: s.mustbuy.filter(i => i.id !== id) }), () => this.persist());
    };
  }
  togglePacking(id) {
    return () => {
      this.setState(s => ({ packingChecked: { ...s.packingChecked, [id]: !s.packingChecked[id] } }), () => this.persist());
    };
  }

  handleUpload(catName) {
    return (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        this.setState(s => {
          const docs = { ...s.documents };
          docs[catName] = [...(docs[catName] || []), { name: file.name, dataUrl: reader.result }];
          return { documents: docs };
        }, () => this.persist());
      };
      reader.readAsDataURL(file);
    };
  }
  deleteDoc(catName, idx) {
    return () => {
      this.setState(s => {
        const docs = { ...s.documents };
        docs[catName] = docs[catName].filter((_, i) => i !== idx);
        return { documents: docs };
      }, () => this.persist());
    };
  }
  previewDoc(dataUrl) {
    return () => { window.open(dataUrl, '_blank'); };
  }

  deleteExpense(id) {
    return () => {
      this.setState(s => ({ expenses: s.expenses.filter(e => e.id !== id) }), () => this.persist());
    };
  }

  renderVals() {
    const view = this.state.view;
    const today = new Date();
    const dep = new Date('2026-07-13T00:00:00+09:00');
    const daysUntil = Math.max(0, Math.ceil((dep - today) / 86400000));

    const wishlist = this.state.wishlist.map(i => ({
      ...i,
      onToggle: this.toggleWishlist(i.id),
      onRemove: this.removeWishlist(i.id),
      checkBg: i.checked ? '#2a8c82' : 'transparent',
      mark: i.checked ? '✓' : '',
      strike: i.checked ? 'line-through' : 'none',
    }));
    const mustbuy = this.state.mustbuy.map(i => ({
      ...i,
      onToggle: this.toggleMustbuy(i.id),
      onRemove: this.removeMustbuy(i.id),
      checkBg: i.checked ? '#2a8c82' : 'transparent',
      mark: i.checked ? '✓' : '',
      strike: i.checked ? 'line-through' : 'none',
    }));

    let packingTotal = 0, packingCheckedCount = 0;
    const packingGroups = PACKING_GROUPS.map(g => ({
      name: g.name,
      items: g.items.map(it => {
        packingTotal++;
        const checked = !!this.state.packingChecked[it.id];
        if (checked) packingCheckedCount++;
        return {
          ...it,
          onToggle: this.togglePacking(it.id),
          checkBg: checked ? '#2a8c82' : 'transparent',
          mark: checked ? '✓' : '',
          strike: checked ? 'line-through' : 'none',
        };
      }),
    }));

    const currentDay = DAYS[this.state.dayIndex];
    const dateTabs = DAYS.map(d => {
      const active = d.id === this.state.dayIndex;
      return {
        date: d.date,
        onClick: () => this.setState({ dayIndex: d.id }),
        bg: active ? d.color : 'transparent',
        textColor: active ? '#fff' : '#9ecbc2',
      };
    });

    const foodTabs = FOOD_TABS.map(t => {
      const active = t.key === this.state.foodTab;
      return {
        label: t.label,
        onClick: () => this.setState({ foodTab: t.key }),
        bg: active ? t.color : '#f0ede2',
        color: active ? '#fff' : '#666',
      };
    });
    const foodItems = FOOD_DATA[this.state.foodTab] || [];

    const docCategories = ['機票', '住宿', 'VJW', '保險', '其他'].map(name => {
      const files = (this.state.documents[name] || []).map((f, idx) => ({
        name: f.name,
        onPreview: this.previewDoc(f.dataUrl),
        onDelete: this.deleteDoc(name, idx),
      }));
      return { name, files, empty: files.length === 0, onUpload: this.handleUpload(name) };
    });

    const expenseTotalJpy = this.state.expenses.reduce((sum, e) => sum + Number(e.jpy || 0), 0);
    const expenseTotalTwd = Math.round(expenseTotalJpy * 0.214).toLocaleString();

    const expenseDayOptions = DAYS.map(d => ({
      label: d.date,
      onClick: () => this.setState({ expenseDay: d.id }),
      bg: this.state.expenseDay === d.id ? d.color : '#f0ede2',
      color: this.state.expenseDay === d.id ? '#fff' : '#666',
    }));
    const expenseCatOptions = EXPENSE_CATEGORIES.map(c => ({
      label: c,
      onClick: () => this.setState({ expenseCat: c }),
      bg: this.state.expenseCat === c ? '#111' : '#f0ede2',
      color: this.state.expenseCat === c ? '#fff' : '#666',
    }));

    const expenseByDay = DAYS.map(d => {
      const entries = this.state.expenses.filter(e => e.day === d.id).map(e => ({
        ...e,
        onDelete: this.deleteExpense(e.id),
      }));
      const subtotal = entries.reduce((sum, e) => sum + Number(e.jpy || 0), 0);
      return { label: d.date + '（' + d.dow + '）· ' + d.region, color: d.color, entries, subtotal: subtotal.toLocaleString(), empty: entries.length === 0 };
    });

    return {
      isHome: view === 'home',
      isItinerary: view === 'itinerary',
      isFood: view === 'food',
      isWishlist: view === 'wishlist',
      isMustbuy: view === 'mustbuy',
      isPacking: view === 'packing',
      isExpense: view === 'expense',
      isDocuments: view === 'documents',
      isConverter: view === 'converter',
      isNotes: view === 'notes',
      goHome: this.setView('home'),
      openItinerary: this.setView('itinerary'),
      openFood: this.setView('food'),
      openWishlist: this.setView('wishlist'),
      openMustbuy: this.setView('mustbuy'),
      openPacking: this.setView('packing'),
      openExpense: this.setView('expense'),
      openDocuments: this.setView('documents'),
      openConverter: this.setView('converter'),
      openNotes: this.setView('notes'),
      daysUntil,
      mapRef: this.mapRef,
      wishlist,
      wishlistCount: wishlist.length,
      wishlistDraft: this.state.wishlistDraft,
      onWishlistInput: (e) => this.setState({ wishlistDraft: e.target.value }),
      addWishlist: () => {
        const t = this.state.wishlistDraft.trim();
        if (!t) return;
        this.setState(s => ({
          wishlist: [...s.wishlist, { id: 'w' + Date.now(), text: t, checked: false }],
          wishlistDraft: '',
        }), () => this.persist());
      },
      mustbuy,
      mustbuyCount: mustbuy.length,
      mustbuyDraft: this.state.mustbuyDraft,
      onMustbuyInput: (e) => this.setState({ mustbuyDraft: e.target.value }),
      addMustbuy: () => {
        const t = this.state.mustbuyDraft.trim();
        if (!t) return;
        this.setState(s => ({
          mustbuy: [...s.mustbuy, { id: 'm' + Date.now(), text: t, checked: false }],
          mustbuyDraft: '',
        }), () => this.persist());
      },
      packingGroups,
      packingChecked: packingCheckedCount,
      packingTotal,
      currentDay,
      dateTabs,
      foodTabs,
      foodItems,
      docCategories,
      expenseTotalJpy: expenseTotalJpy.toLocaleString(),
      expenseTotalTwd,
      expenseDayOptions,
      expenseCatOptions,
      expenseNote: this.state.expenseNote,
      onExpenseNoteInput: (e) => this.setState({ expenseNote: e.target.value }),
      expenseJpy: this.state.expenseJpy,
      onExpenseJpyInput: (e) => this.setState({ expenseJpy: e.target.value.replace(/[^0-9]/g, '') }),
      addExpense: () => {
        const jpy = Number(this.state.expenseJpy);
        if (!jpy) return;
        this.setState(s => ({
          expenses: [...s.expenses, {
            id: 'e' + Date.now(),
            day: s.expenseDay,
            category: s.expenseCat,
            note: s.expenseNote.trim() || '(未命名)',
            jpy,
          }],
          expenseNote: '',
          expenseJpy: '',
        }), () => this.persist());
      },
      expenseByDay,
      rateInput: String(this.state.rate),
      onRateInput: (e) => {
        const v = e.target.value.replace(/[^0-9.]/g, '');
        const rate = Number(v) || 0;
        this.setState({ rate }, () => this.persist());
      },
      jpyInput: this.state.jpyInput,
      onJpyInput: (e) => {
        const v = e.target.value.replace(/[^0-9.]/g, '');
        const jpy = Number(v) || 0;
        const twd = v === '' ? '' : (jpy * this.state.rate / 100).toFixed(1);
        this.setState({ jpyInput: v, twdInput: String(twd) });
      },
      twdInput: this.state.twdInput,
      onTwdInput: (e) => {
        const v = e.target.value.replace(/[^0-9.]/g, '');
        const twd = Number(v) || 0;
        const jpy = v === '' || !this.state.rate ? '' : (twd * 100 / this.state.rate).toFixed(0);
        this.setState({ twdInput: v, jpyInput: String(jpy) });
      },
    };
  }
}

