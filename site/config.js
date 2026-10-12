// =====================================================================
//  O'ZARO — единственный файл, который нужно редактировать.
//  Тексты (ru/uz), зеркала, пакеты, цены, контакты, адрес приёма заявок.
// =====================================================================
window.OZARO = {
  brand: "O'ZARO",
  phone: "+998 91 784 03 10",
  instagram: "ozaro.uz",          // username без @
  telegram: "",                   // username без @ (если появится Telegram-аккаунт)
  city: { ru: "Ташкент", uz: "Toshkent" },
  established: 2025,

  // URL веб-приложения Google Apps Script (docs/LAUNCH.md, шаг 2).
  // Пока пусто — заявка копируется и открывается Instagram Direct.
  leadEndpoint: "",

  currency: "$",
  prepayPercent: 50,
  leadDays: "7–10",

  mirrors: [
    {
      id: "gold", name: "Gold", img: "img/mirror-gold.jpg",
      ru: { shape: "Арка: верх — овал, низ — прямоугольник", frame: "Золотая матовая рама, алюминий", size: "165 × 60 см" },
      uz: { shape: "Arka: tepasi oval, pasti to'rtburchak", frame: "Oltin rangli mat rom, alyuminiy", size: "165 × 60 sm" },
    },
    {
      id: "black", name: "Black", img: "img/mirror-black.jpg",
      ru: { shape: "Прямоугольник, напольное с опорой", frame: "Чёрная матовая металлическая рама", size: "160 × 70 см" },
      uz: { shape: "To'rtburchak, tayanchli pol oynasi", frame: "Qora mat metall rom", size: "160 × 70 sm" },
    },
    {
      id: "blomb", name: "Blomb", img: "img/mirror-blomb.jpg",
      ru: { shape: "Необычная волнистая форма", frame: "Без рамы, деревянный мольберт в комплекте", size: "80 × 60 см" },
      uz: { shape: "Noodatiy to'lqinsimon shakl", frame: "Romsiz, yog'och molbert bilan", size: "80 × 60 sm" },
    },
  ],

  packages: [
    {
      id: "classic", price: 50, mirrors: 1,
      ru: { name: "Классика", desc: "1 зеркало любого типа с гравировкой" },
      uz: { name: "Klassika", desc: "Istalgan turdagi 1 ta oyna, yozuv bilan" },
    },
    {
      id: "premium", price: 80, mirrors: 1, flowers: true,
      ru: { name: "Премиальный", desc: "1 зеркало с гравировкой + цветочная композиция по вашим пожеланиям" },
      uz: { name: "Premium", desc: "1 ta oyna yozuv bilan + istagingiz bo'yicha gul kompozitsiyasi" },
    },
    {
      id: "mini", price: 90, mirrors: 2,
      ru: { name: "Мини-ивент", desc: "2 зеркала любого типа с гравировкой" },
      uz: { name: "Mini-ivent", desc: "Istalgan turdagi 2 ta oyna, yozuv bilan" },
    },
    {
      id: "photozone", price: 200, mirrors: 2, flowers: true, light: true, featured: true,
      ru: { name: "Идеальная фотозона", desc: "2 зеркала с гравировкой + цветочная композиция + подсветка" },
      uz: { name: "Ideal fotozona", desc: "2 ta oyna yozuv bilan + gul kompozitsiyasi + yoritish" },
    },
  ],

  team: [
    { ru: { name: "Камила", role: "Директор" }, uz: { name: "Kamila", role: "Direktor" } },
    { ru: { name: "Мирамир", role: "Менеджер" }, uz: { name: "Miramir", role: "Menejer" } },
    { ru: { name: "Севиль", role: "Дизайнер и флорист" }, uz: { name: "Sevil", role: "Dizayner va florist" } },
  ],

  districts: [
    "Алмазар / Olmazor", "Бектемир / Bektemir", "Мирабад / Mirobod", "Мирзо-Улугбек / Mirzo Ulug'bek",
    "Сергели / Sergeli", "Учтепа / Uchtepa", "Чиланзар / Chilonzor", "Шайхантахур / Shayxontohur",
    "Юнусабад / Yunusobod", "Яккасарай / Yakkasaroy", "Яшнабад / Yashnobod", "Янгихаёт / Yangihayot",
    "Ташкентская обл. / Toshkent vil.",
  ],
};
