const mapsUrl = (query) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const stop = (details) => ({
  durationMinutes: 60,
  openingHours: null,
  lastEntryTime: null,
  notes: "",
  reservationRequired: false,
  coordinatesConfirmed: false,
  status: "confirmed",
  ...details,
  googleMapsUrl: details.googleMapsUrl ?? mapsUrl(`${details.name} Okinawa`),
});

const leg = (fromStopId, toStopId, minutes, mode = "driving") => ({
  fromStopId,
  toStopId,
  mode,
  minutes,
});

export const initialTrip = {
  id: "okinawa-2027",
  name: "2027 沖繩五天四夜",
  location: "Okinawa, Japan",
  startDate: "2027-01-21",
  endDate: "2027-01-25",
  flights: {
    outbound: {
      flightNumber: "JX312",
      airline: "星宇航空",
      departure: "台中機場 T2 (RMQ)",
      departureTime: "2027-01-21T17:00",
      arrival: "沖繩機場 T1 (OKA)",
      arrivalTime: "2027-01-21T19:30",
    },
    return: {
      flightNumber: "JX313",
      airline: "星宇航空",
      departure: "沖繩機場 (OKA)",
      departureTime: "2027-01-25T20:30",
      arrival: "台中機場 (RMQ)",
      arrivalTime: "2027-01-25T21:20",
    },
  },
  accommodations: [{
    name: "Mr.KINJO 牧志",
    checkInDate: "2027-01-21",
    notes: "原始行程只明確記載抵達日住宿；後續住宿仍待確認。",
  }],
  days: [
    {
      id: "day-1",
      dayNumber: 1,
      date: "2027-01-21",
      dateLabel: "Thu, Jan 21",
      title: "抵達沖繩",
      stops: [
        stop({ id: "naha-airport-arrival", name: "那霸機場 T1", type: "airport", latitude: 26.2064, longitude: 127.6465, coordinatesConfirmed: true, time: { kind: "fixed", value: "19:30" }, durationMinutes: 35, notes: "JX312 抵達；入境及領取行李後搭計程車。" }),
        stop({ id: "mr-kinjo-makishi", name: "Mr.KINJO 牧志", type: "hotel", latitude: 26.2164, longitude: 127.6923, time: { kind: "approximate", value: "20:30" }, durationMinutes: 30, notes: "飯店地址與座標需在訂房資料中再次確認。" }),
        stop({ id: "day1-dinner", name: "飯店附近晚餐或超商", type: "restaurant", latitude: 26.2164, longitude: 127.6923, time: { kind: "none", value: null }, durationMinutes: 60, notes: "抵達後視時間與體力就近安排。" }),
      ],
      travelLegs: [
        leg("naha-airport-arrival", "mr-kinjo-makishi", 20, "taxi"),
        leg("mr-kinjo-makishi", "day1-dinner", 5, "walking"),
      ],
    },
    {
      id: "day-2",
      dayNumber: 2,
      date: "2027-01-22",
      dateLabel: "Fri, Jan 22",
      title: "南部一日",
      stops: [
        stop({ id: "rental-car-pickup", name: "美麗島租車取車", type: "rental-car", latitude: 26.2162, longitude: 127.692, time: { kind: "fixed", value: "08:30" }, durationMinutes: 30, notes: "由住宿步行前往；門市地址與座標待確認。" }),
        stop({ id: "okinawa-world", name: "玉泉洞・沖縄世界", type: "attraction", latitude: 26.1405, longitude: 127.7482, coordinatesConfirmed: true, time: { kind: "approximate", value: "09:30" }, durationMinutes: 150, notes: "南城市的玉泉洞與文化園區。" }),
        stop({ id: "sakana-daitoryo", name: "漁師食堂 大ばんぶる舞 さかな大統領", type: "restaurant", latitude: 26.2123, longitude: 127.6792, time: { kind: "approximate", value: "12:30" }, durationMinutes: 75, notes: "鰻魚／甜蝦／奶油烤魚；鰻魚飯要直接跟老闆點。店址待確認。" }),
        stop({ id: "naminoue-shrine", name: "波上宮", type: "attraction", latitude: 26.2205, longitude: 127.671, coordinatesConfirmed: true, time: { kind: "approximate", value: "14:15" }, durationMinutes: 50 }),
        stop({ id: "oniku-no-isshin", name: "お肉の一心", type: "restaurant", latitude: 26.2145, longitude: 127.684, time: { kind: "approximate", value: "18:30" }, durationMinutes: 90, reservationRequired: true, notes: "壽喜燒；以 WhatsApp 或 LINE 預約。每位成人需點一份餐食，可刷卡或付現。地址與時間待確認。" }),
        stop({ id: "kokusai-dori", name: "國際通／市場本通り", type: "shopping", latitude: 26.2152, longitude: 127.6877, coordinatesConfirmed: true, time: { kind: "none", value: null }, durationMinutes: 90, openingHours: "Animate 11:00–20:00 · 駿河屋 10:00–21:00", notes: "晚餐後散步與購物。" }),
      ],
      travelLegs: [
        leg("rental-car-pickup", "okinawa-world", 35),
        leg("okinawa-world", "sakana-daitoryo", 35),
        leg("sakana-daitoryo", "naminoue-shrine", 12),
        leg("naminoue-shrine", "oniku-no-isshin", 12),
        leg("oniku-no-isshin", "kokusai-dori", 8, "walking"),
      ],
    },
    {
      id: "day-3",
      dayNumber: 3,
      date: "2027-01-23",
      dateLabel: "Sat, Jan 23",
      title: "中部北上・古宇利島",
      stops: [
        stop({ id: "minatogawa", name: "港川外人住宅", type: "attraction", latitude: 26.2605, longitude: 127.7231, coordinatesConfirmed: true, time: { kind: "fixed", value: "08:15" }, durationMinutes: 60, notes: "Houki Boshi 可麗露、Okinawa Cerrado Coffee。" }),
        stop({ id: "blue-seal", name: "Blue Seal 牧港本店", type: "restaurant", latitude: 26.2743, longitude: 127.7254, coordinatesConfirmed: true, time: { kind: "none", value: null }, durationMinutes: 30, notes: "可停車。" }),
        stop({ id: "aw-makiminato", name: "A&W 牧港店", type: "restaurant", latitude: 26.2771, longitude: 127.7261, coordinatesConfirmed: true, time: { kind: "none", value: null }, durationMinutes: 40, notes: "拍照，可停車。" }),
        stop({ id: "rycom", name: "永旺夢樂城 Okinawa Rycom", type: "shopping", latitude: 26.3147, longitude: 127.7964, coordinatesConfirmed: true, time: { kind: "approximate", value: "11:30" }, durationMinutes: 120, notes: "寶可夢中心。" }),
        stop({ id: "kyoda", name: "道の駅許田", type: "rest-stop", latitude: 26.5524, longitude: 127.9537, coordinatesConfirmed: true, time: { kind: "approximate", value: "14:15" }, durationMinutes: 20, notes: "北上途中的休息站。" }),
        stop({ id: "tamaya", name: "Kurumaebi Kitchen TAMAYA", type: "restaurant", latitude: 26.6506, longitude: 128.0251, coordinatesConfirmed: true, time: { kind: "none", value: null }, durationMinutes: 60, openingHours: "11:00–18:00", notes: "蝦蝦天婦羅。" }),
        stop({ id: "kouri", name: "古宇利大橋／古宇利海洋塔", type: "attraction", latitude: 26.6969, longitude: 128.0184, coordinatesConfirmed: true, time: { kind: "fixed", value: "15:05" }, durationMinutes: 105, openingHours: "10:00–18:00", lastEntryTime: "17:30", notes: "預計停留 1.5–2 小時。" }),
        stop({ id: "north-hotel-check-in", name: "北部飯店 check-in", type: "hotel", latitude: 26.6588, longitude: 127.8779, time: { kind: "none", value: null }, durationMinutes: 30, notes: "飯店名稱與實際座標待確認。" }),
        stop({ id: "ucchiya-soba", name: "Ucchiya Okinawa Soba", type: "restaurant", latitude: 26.6469, longitude: 127.8917, coordinatesConfirmed: true, time: { kind: "none", value: null }, durationMinutes: 60, openingHours: "08:00–20:30", notes: "沖繩麵。" }),
      ],
      travelLegs: [
        leg("minatogawa", "blue-seal", 6), leg("blue-seal", "aw-makiminato", 3),
        leg("aw-makiminato", "rycom", 30), leg("rycom", "kyoda", 45),
        leg("kyoda", "tamaya", 30), leg("tamaya", "kouri", 18),
        leg("kouri", "north-hotel-check-in", 35), leg("north-hotel-check-in", "ucchiya-soba", 12),
      ],
    },
    {
      id: "day-4",
      dayNumber: 4,
      date: "2027-01-24",
      dateLabel: "Sun, Jan 24",
      title: "美麗海水族館・南下回那霸",
      stops: [
        stop({ id: "churaumi-aquarium", name: "沖縄美ら海水族館", type: "attraction", latitude: 26.6943, longitude: 127.8779, coordinatesConfirmed: true, time: { kind: "fixed", value: "08:30" }, durationMinutes: 150 }),
        stop({ id: "restaurant-flipper", name: "Restaurant Flipper 潛水員牛排", type: "restaurant", latitude: 26.6062, longitude: 127.9682, time: { kind: "approximate", value: "11:45" }, durationMinutes: 75, openingHours: "10:30–14:00", notes: "只收現金、不可訂位；可順遊餐廳旁沙灘。店址待確認。" }),
        stop({ id: "american-village", name: "美國村", type: "attraction", latitude: 26.3159, longitude: 127.7576, coordinatesConfirmed: true, time: { kind: "approximate", value: "15:00" }, durationMinutes: 120 }),
        stop({ id: "naha-hotel-check-in", name: "那霸飯店 check-in", type: "hotel", latitude: 26.2164, longitude: 127.6923, time: { kind: "none", value: null }, durationMinutes: 30, notes: "飯店名稱與實際座標待確認。" }),
        stop({ id: "tonkatsu-koyaji-day4", name: "とんかつ小やじ 那覇店", type: "restaurant", latitude: 26.2152, longitude: 127.6877, time: { kind: "none", value: null }, durationMinutes: 75, openingHours: "11:00–18:00", notes: "原始筆記標示營業至 18:00，需確認能否趕上及店址。" }),
      ],
      travelLegs: [
        leg("churaumi-aquarium", "restaurant-flipper", 35), leg("restaurant-flipper", "american-village", 100),
        leg("american-village", "naha-hotel-check-in", 40), leg("naha-hotel-check-in", "tonkatsu-koyaji-day4", 10),
      ],
    },
    {
      id: "day-5",
      dayNumber: 5,
      date: "2027-01-25",
      dateLabel: "Mon, Jan 25",
      title: "最後採買・返程",
      stops: [
        stop({ id: "potama-makishi", name: "ポーたま 牧志市場店", type: "restaurant", latitude: 26.2142, longitude: 127.6883, time: { kind: "approximate", value: "08:30" }, durationMinutes: 30, openingHours: "07:00–20:00", notes: "買苦瓜口味飯糰。店址待確認。" }),
        stop({ id: "fukusuke-tamagoyaki", name: "福助の玉子焼き 市場本通り店", type: "restaurant", latitude: 26.2144, longitude: 127.6885, time: { kind: "none", value: null }, durationMinutes: 25, openingHours: "07:30–19:30", notes: "與ポーたま各買一個一起吃。店址待確認。" }),
        stop({ id: "last-shopping", name: "市場本通り／國際通最後採買", type: "shopping", latitude: 26.2152, longitude: 127.6877, coordinatesConfirmed: true, time: { kind: "none", value: null }, durationMinutes: 120 }),
        stop({ id: "tonkatsu-koyaji-day5", name: "とんかつ小やじ 那覇店", type: "restaurant", latitude: 26.2152, longitude: 127.6877, time: { kind: "approximate", value: "12:30" }, durationMinutes: 75, openingHours: "11:00–18:00", notes: "店址待確認。" }),
        stop({ id: "ashibinaa-outlet", name: "沖繩 ASHIBINAA Outlet", type: "shopping", latitude: 26.1571, longitude: 127.6562, coordinatesConfirmed: true, time: { kind: "approximate", value: "14:00" }, durationMinutes: 105, openingHours: "10:00–20:00" }),
        stop({ id: "rental-car-return", name: "美麗島租車還車", type: "rental-car", latitude: 26.2162, longitude: 127.692, time: { kind: "fixed", value: "16:30" }, durationMinutes: 30, notes: "牧志門市；地址與座標待確認，還車後搭免費接駁車。" }),
        stop({ id: "naha-airport-departure", name: "那霸機場・回程報到", type: "airport", latitude: 26.2064, longitude: 127.6465, coordinatesConfirmed: true, time: { kind: "fixed", value: "18:30" }, durationMinutes: 120, notes: "JX313 20:30 起飛前完成國際線報到。" }),
      ],
      travelLegs: [
        leg("potama-makishi", "fukusuke-tamagoyaki", 3, "walking"), leg("fukusuke-tamagoyaki", "last-shopping", 3, "walking"),
        leg("last-shopping", "tonkatsu-koyaji-day5", 8, "walking"), leg("tonkatsu-koyaji-day5", "ashibinaa-outlet", 30),
        leg("ashibinaa-outlet", "rental-car-return", 25), leg("rental-car-return", "naha-airport-departure", 20, "shuttle"),
      ],
    },
  ],
};

export const initialCandidates = [
  stop({ id: "candidate-senaga-island", suggestedDayId: "day-2", name: "瀨長島 Umikaji Terrace", type: "attraction", latitude: 26.1748, longitude: 127.6464, coordinatesConfirmed: true, time: { kind: "approximate", value: "17:45" }, durationMinutes: 75, notes: "Day 2 備選；傍晚看夕陽。", status: "tentative" }),
  stop({ id: "candidate-mitsuya-onna", suggestedDayId: "day-4", name: "三矢本舗 恩納店", type: "restaurant", latitude: 26.497, longitude: 127.853, time: { kind: "none", value: null }, durationMinutes: 25, notes: "Day 4 南下途中備選；購買沙翁。店址待確認。", status: "tentative" }),
  stop({ id: "candidate-kushiyaki-can", suggestedDayId: "day-4", name: "Kushiyaki Can クシヤキCan", type: "restaurant", latitude: 26.2152, longitude: 127.6877, time: { kind: "none", value: null }, durationMinutes: 75, openingHours: "17:30–24:00", notes: "若豬排來不及，改吃這間備案串燒；店址待確認。", status: "tentative" }),
];
