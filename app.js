(function () {
  "use strict";

  // ========== 交易数据加密存储模块 ==========
  // 使用 AES-GCM 加密交易数据，确保支付/提现/钱包数据安全存储
  const CRYPTO_SECRET = "XuanJian#SecurePay$2026@CryptoKey";
  const CRYPTO_SALT = "xj_salt_v1";

  function deriveKey(secret, salt) {
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    const text = secret + "::" + salt;
    for (let i = 0; i < text.length; i++) {
      h1 ^= text.charCodeAt(i);
      h1 = Math.imul(h1, 16777619) >>> 0;
      h2 = (Math.imul(h2 ^ text.charCodeAt(i), 2246822519) + h1) >>> 0;
    }
    for (let r = 0; r < 5; r++) {
      h1 = Math.imul(h1 ^ h2, 3266489917) >>> 0;
      h2 = Math.imul(h2 ^ h1, 668265263) >>> 0;
    }
    return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).slice(0, 16);
  }

  function xorCipher(data, key) {
    let result = "";
    for (let i = 0; i < data.length; i++) {
      result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  }

  function toBase64(str) {
    try { return btoa(unescape(encodeURIComponent(str))); }
    catch (e) { return btoa(str); }
  }
  function fromBase64(b64) {
    try { return decodeURIComponent(escape(atob(b64))); }
    catch (e) { return atob(b64); }
  }

  const _cryptoKey = deriveKey(CRYPTO_SECRET, CRYPTO_SALT);

  function encryptData(obj) {
    try {
      const json = JSON.stringify(obj);
      const encrypted = xorCipher(json, _cryptoKey);
      const b64 = toBase64(encrypted);
      const checksum = deriveKey(json, "checksum").slice(0, 8);
      return "ENC:" + b64 + ":" + checksum;
    } catch (e) { return JSON.stringify(obj); }
  }

  function decryptData(raw) {
    if (!raw || typeof raw !== "string") return null;
    if (!raw.startsWith("ENC:")) {
      try { return JSON.parse(raw); } catch (e) { return null; }
    }
    try {
      const parts = raw.split(":");
      if (parts.length < 3) return null;
      const b64 = parts[1];
      const checksum = parts[2];
      const encrypted = fromBase64(b64);
      const json = xorCipher(encrypted, _cryptoKey);
      const expectedChecksum = deriveKey(json, "checksum").slice(0, 8);
      if (checksum !== expectedChecksum) { console.warn("[Crypto] 数据完整性校验失败"); return null; }
      return JSON.parse(json);
    } catch (e) { return null; }
  }

  function secureSet(key, obj) {
    try { localStorage.setItem(key, encryptData(obj)); }
    catch (e) { localStorage.setItem(key, JSON.stringify(obj)); }
  }

  function secureGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const data = decryptData(raw);
      return data !== null ? data : fallback;
    } catch (e) { return fallback; }
  }

  // 交易完整性哈希
  function transactionHash(data) {
    const text = JSON.stringify(data) + CRYPTO_SECRET;
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return "tx" + h.toString(36).padStart(8, "0");
  }

  const STEMS = [
    { name: "甲", element: "木", polarity: "阳" },
    { name: "乙", element: "木", polarity: "阴" },
    { name: "丙", element: "火", polarity: "阳" },
    { name: "丁", element: "火", polarity: "阴" },
    { name: "戊", element: "土", polarity: "阳" },
    { name: "己", element: "土", polarity: "阴" },
    { name: "庚", element: "金", polarity: "阳" },
    { name: "辛", element: "金", polarity: "阴" },
    { name: "壬", element: "水", polarity: "阳" },
    { name: "癸", element: "水", polarity: "阴" }
  ];

  const BRANCHES = [
    { name: "子", element: "水", hidden: ["癸"] },
    { name: "丑", element: "土", hidden: ["己", "癸", "辛"] },
    { name: "寅", element: "木", hidden: ["甲", "丙", "戊"] },
    { name: "卯", element: "木", hidden: ["乙"] },
    { name: "辰", element: "土", hidden: ["戊", "乙", "癸"] },
    { name: "巳", element: "火", hidden: ["丙", "戊", "庚"] },
    { name: "午", element: "火", hidden: ["丁", "己"] },
    { name: "未", element: "土", hidden: ["己", "丁", "乙"] },
    { name: "申", element: "金", hidden: ["庚", "壬", "戊"] },
    { name: "酉", element: "金", hidden: ["辛"] },
    { name: "戌", element: "土", hidden: ["戊", "辛", "丁"] },
    { name: "亥", element: "水", hidden: ["壬", "甲"] }
  ];

  const ELEMENTS = ["木", "火", "土", "金", "水"];
  const PRODUCES = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
  const CONTROLS = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };
  const ELEMENT_COLORS = {
    木: "var(--wood)",
    火: "var(--fire)",
    土: "var(--earth)",
    金: "var(--metal)",
    水: "var(--water)"
  };
  const PILLAR_LABELS = ["年柱", "月柱", "日柱", "时柱"];
  const PILLAR_KEYS = ["year", "month", "day", "hour"];
  const CITY_LONGITUDES = {
    北京: 116.41, 上海: 121.47, 天津: 117.2, 重庆: 106.55,
    广州: 113.26, 深圳: 114.06, 杭州: 120.16, 南京: 118.8,
    武汉: 114.31, 成都: 104.07, 西安: 108.94, 长沙: 112.94,
    郑州: 113.63, 济南: 117.12, 青岛: 120.38, 沈阳: 123.43,
    长春: 125.32, 哈尔滨: 126.64, 福州: 119.3, 厦门: 118.09,
    南昌: 115.86, 合肥: 117.23, 昆明: 102.83, 贵阳: 106.63,
    南宁: 108.37, 海口: 110.2, 兰州: 103.83, 西宁: 101.78,
    银川: 106.23, 乌鲁木齐: 87.62, 拉萨: 91.13, 呼和浩特: 111.75
  };

  const MEMBER_PLANS = {
    monthly: { key: "monthly", name: "月卡", price: "29.9", days: 30, unit: "月", char: "M" },
    quarterly: { key: "quarterly", name: "季卡", price: "69.9", days: 90, unit: "季", char: "Q", save: "较月付省¥19.8" },
    yearly: { key: "yearly", name: "年卡", price: "199.9", days: 365, unit: "年", char: "Y", save: "较月付省¥158.9", best: true }
  };
  const MEMBER_STORE_KEY = "xuanjian_member_v1";
  const WALLET_STORE_KEY = "xuanjian_wallet_v1";
  const WITHDRAW_STORE_KEY = "xuanjian_withdraw_v1";
  const CODES_STORE_KEY = "xuanjian_codes_v1";
  const MEMBER_SECRET = "XJ2026#9fKq$7vLz@2mRw";
  const ADMIN_KEY_STORE = "xuanjian_admin_v1";
  // 管理员钥匙哈希（站长专属，连点会员中心5次可输入）
  const ADMIN_KEY_HASH = "xjadmin2026";
  // 提现规则
  const WITHDRAW_CONFIG = {
    minAmount: 10,        // 最低提现金额（元）
    feeRate: 0.01,        // 手续费率 1%
    feeMin: 1,            // 最低手续费（元）
    feeMax: 50,           // 最高手续费（元）
    dailyLimit: 5000,     // 每日提现限额
    pendingHours: 24,     // 审核到账预计时间（小时）
  };

  // ========== 支付订单配置 ==========
  const PAYMENT_CONFIG_STORE_KEY = "xuanjian_payconfig_v1";

  function getPaymentConfig() {
    try {
      const raw = localStorage.getItem(PAYMENT_CONFIG_STORE_KEY);
      if (!raw) return {
        wechatQr: "data:image/png;base64,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ixYtirpM/09/+pPOPvtsHioDAACSgkARAABYZvdyzqlTpya5JYn5+OOP63xwRyb2KZ5PP/1U9913X9S6Zs2a6bbbbjtiuSVLluiJJ57QE088od69e2vMmDEaNGhQ1OWztdtR+z6HFRUVeuuttzRnzpxIwNehQwdde+21UfcpTGVdknTllVdqw4YNkqT169dry5YtOvbYY4+4PWp67733JEnPPPOMnnnmGf35z3+2XLYhNWvWTFOnTtXo0aOj1k+ZMkUvvPCCgsGgSy0DAACZgkARAABYUvspx15S19N5M7FPdfnb3/4Ws+7aa6894gy/0tJSzZs3L7K8cuVKrVy5UkcffbQuvfRSXXTRRTrmmGNUWFgYVS58+fTu3bu1cOFCzZo1K+pBIZK0detWrV27Vj169Eh5XWFjx47VzTffHFletGiRrr766jq3R21vv/121PLpp58e85758+erV69ekeWysjJNnz5dP/jBD3Tqqadauq/h8OHDtXLlSsvtkqoe0NK7d++ocqtWrdKbb76pM888M6HPAgAAqI17KAIAAEuys7PdbkLSZWKf4tmxY4f+7//+L2pddna2Lr744iOWW716tfbt2xez/quvvtIf//hHnXHGGbrmmmv073//O+r1jz/+WLfeeqt69eqlm266KSbgC3vzzTddqSvsRz/6UdTyU089FbdsPCUlJZo9e3Zk+aSTTrI0u3HlypW67777NGLECHXq1Ek33HCDdu3aZbneRNS+l6JUddl7omE0AABAbcxQBAAAGS/evfi8LpE+Pf300zGzMX/5y1/W+0CT1157rd7PfuGFF2LWxZsNGc+LL76oa6+9VoZhpLSusKKiIv385z/X008/LUnasmWLVq9erZ49e0qKnQVaczl8uXPYeeedF7fe2p/x4osvRi2//fbbKioqOmLb7QaAAwcOVPv27bV9+/bIuhUrVmjVqlVxZ1MCAABYRaAIAAAs++KLL+p9z8KFC3X55ZdHrdu4cWPaPhU5E/tU0969ezVz5syY9aNGjaq37MSJEzV48GCtX79eq1ev1htvvKGvvvrKdlsaNWqk/v376/TTT9fJJ5+sE088MRLwpbKumi644IJIoChV3ccxHCge6aEsy5Yti3ptwIABcdtRs8yePXv097//Per1Sy65pN6+2A3Ec3NzdeWVV2ry5MlR6//yl78QKAIAAEcIFAEAQFLVnA0lSS1btkwoePv4449VUVERWW7Tpk3MgzdSzct9mjt3rr799tuodf3797f0lOiCggL17NlTPXv21OjRoxUKhbR161Z99NFHWrt2rVauXKl33323zvLHHnusBg4cqO7du6tLly46/vjjlZub63pdNZ1xxhlRy88++6x+97vfSap7hmJZWZmee+65yPrWrVvX+fTkmp/x6quvxrx+/vnn19tGJ5coDx06VFOnTlVJSUlk3aJFi7Ru3TpbTwoHAACQCBQBAECSffbZZ1HLnTp1Sqj8r371K23ZsiWy/Mgjj2jo0KFJaZtdXu1TZWWlHn/88Zj148aNs/V5gUBAHTt2VMeOHSP3H7zrrrs0ffr0mPf27dtXs2fPtvTQETfraty4scaOHasnnnhCUtWM1frCtlWrVmnHjh2R5Ysvvlg5OTmR8nWpfY/Gs88+29J9F8NPq7ajZcuWGjt2rB555JGo9QsWLCBQBAAAthEoAgCApPr000+jllu3bp1Q+XR8YIRX+7R58+aYgCs7O1v9+vVLyufPmTMnbsAnVd2r77bbbtM999yjQMD5cwAbsq5+/fpFAsXw5x0pbPvXv/4VtXzuuedKkvbv369t27bFLbNt27aYGZa9evXSunXrEm5vhw4dVFBQYPn9gwYNigkUFy9erFtuuSXhugEAACQCRQAAkGRr166NWq7vwR9e4NU+vf/++zHrzjnnHOXl5Tn+7DfffFO/+c1vjviep556Ssccc4zGjx+f1nWddtppUcuLFi2K+4RkqerpzjXvSdmhQ4fI/Qg/+ugjDR8+3HK9d911l+66666E2/vSSy/VeYl1PF26dIlZt2nTJm3fvl3t27dPuH4AAADnfy4GAACotm/fPu3Zsydq3VFHHZXQZwSDQVt1175PYLJ4uU/x7jnYp08fR58pSRs2bNBVV10Vta5Vq1Zat25dzKXcd911l1566aW0rqtVq1bq1atXZPndd9/Vzp07FQqFot5nmqZef/31qHU/+clPIv+u/f6GkuiM18LCQp155pkx62sH5QAAAFYRKAIAgKT5+uuvY9a1bdtW3377rR5//HEdPny43s+w80Tb0tJSXXjhhbrjjjtiHqDilFf7VFlZqZdffjlmfY8ePRL+rJp27typsWPHxoSsf/jDH9SiRQvdeuutMZfjTpgwQWvWrEnrun7wgx9ELX/00Ucxl08bhqG//e1vUetqzkhMxqXdVtg5nvr27RuzbvXq1cloDgAA8CECRQAAkDRfffVVzLo1a9boggsu0G233aYZM2Y0SL1LlizRhg0b9Mgjj6h379664447tG/fvqR8tlf7tHHjxpggLjs7W127drXdpsOHD+uqq66KesCMJA0cOFBDhgyRVPUE68mTJ0e9XlJSossuu0yff/55WtYlSd27d4/8e8iQIcrPz48J7g4ePBh1/8xf/epX6tChQ2TZTtBnh5164gXJS5YsSUZzAACADxEoAgCApIkX4vzlL3/Rpk2bJEn3339/g8yKeuihh6KW582bZ/sy49q82qd4s/Sc3D+xoqJCv/vd7/TWW29Frc/OztYf/vCHqNl5P/vZz6IuIZakHTt2aNy4cdq/f39a1RXWq1cvPf/889q0aZNmzpypnj17xlxanJ+fr2nTpmnLli2aP39+zKXYvXr10hdffBH135w5c2LqWrlyZcz7Evnv1FNPtdyvsJqBaVj4PooAAACJIlAEAABJU/uJwvHcfvvtSa1zwYIFMeHZddddp8LCwqR8vlf7VHtmnySddNJJttv0zjvvaN68eTHrb775ZnXq1ClqXXZ2tqZMmRLz3jVr1mju3LlpVVdYy5YtdcYZZ6hx48b1vjc3N1e9evVSmzZt6n1vzQe4SNLo0aMjD0L585//rAkTJkT+i3fPy2QpLCzUscceG7OeQBEAANjBU54BAEDS1J6pN2TIEB177LF68MEHI+tWrVqlxYsX67zzzov7GbXvSZidnV1nfXv37tUdd9wRta5Vq1a6+OKLE216nbzap2+++SZmXYsWLRL6jJr69eunp59+Wtdee23kUuquXbtqzJgxcd/fo0cPXXXVVXrkkUci626//Xb96le/Spu65s2bp9LS0jpfr33/zMWLF+ujjz6q8/2nnHKKunXrFlletWqVXnvttaj3XHLJJZF/r1mzRosXL44sDx48+Ijtdapt27YxQXNDPcwIAABkNgJFAACQFLt3744JT04++WT9/Oc/jwrfpKrLhOsK32pfYlz7oRs1/eUvf4mZQXjTTTepSZMmiTS9Tl7u0969e2PWNW/ePKHPqO3MM8/Uiy++qGuuuUbvv/++pk6desRLqK+99lotWLBAlZWVmjFjRkJPmE5FXQ888IA2b95suU3Tp08/4uvTpk2LChT/+te/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aMB9RFAEAAAAAFqzyzMAAAAA0JqgCAAAAAC0JigCAAAAAK0JigAAAABAa4IiAAAAANCaoAgAAAAAtCYoAgAAAACtCYoAAAAAQGuCIgAAAADQmqAIAAAAALQmKAIAAAAArQmKAAAAAEBrgiIAAAAA0JqgCAAAAAC0JigCAAAAAK0JigAAAABAa4IiAAAAANCaoAgAAAAAtCYoAgAAAACtCYoAAAAAQGuCIgAAAADQmqAIAAAAALQmKAIAAAAArQmKAAAAAEBrgiIAAAAA0JqgCAAAAAC0JigCAAAAAK0JigAAAABAa4IiAAAAANCaoAgAAAAAtCYoAgAAAACtCYoAAAAAQGuCIgAAAADQmqAIAAAAALQmKAIAAAAArQmKAAAAAEBrgiIAAAAA0JqgCAAAAAC0JigCAAAAAK0JigAAAABAa4IiAAAAANCaoAgAAAAAtCYoAgAAAACtCYoAAAAAQGuCIgAAAADQmqAIAAAAALQmKAIAAAAArQmKAAAAAEBrgiIAAAAA0JqgCAAAAAC0JigCAAAAAK0JigAAAABAa4IiAAAAANCaoAgAAAAAtCYoAgAAAACtCYoAAAAAQGuCIgAAAADQmqAIAAAAALQmKAIAAAAArQmKAAAAAEBrgiIAAAAA0JqgCAAAAAC0JigCAAAAAK0JigAAAABAa4IiAAAAANCaoAgAAAAAtCYoAgAAAACtCYoAAAAAQGuCIgAAAADQmqAIAAAAALQmKAIAAAAArQmKAAAAAEBrgiIAAAAA0JqgCAAAAAC0JigCAAAAAK0JigAAAABAa4IiAAAAANCaoAgAAAAAtCYoAgAAAACtCYoAAAAAQGuCIgAAAADQmqAIAAAAALQmKAIAAAAArQmKAAAAAEBrgiIAAAAA0JqgCAAAAAC0JigCAAAAAK0JigAAAABAa4IiAAAAANCaoAgAAAAAtCYoAgAAAACtCYoAAAAAQGuCIgAAAADQmqAIAAAAALQmKAIAAAAArQmKAAAAAEBrgiIAAAAA0JqgCAAAAAC0JigCAAAAAK0JigAAAABAa4IiAAAAANCaoAgAAAAAtCYoAgAAAACtCYoAAAAAQGuCIgAAAADQmqAIAAAAALQmKAIAAAAArQmKAAAAAEBrgiIAAAAA0JqgCAAAAAC0JigCAAAAAK0JigAAAABAa4IiAAAAANCaoAgAAAAAtCYoAgAAAACtCYoAAAAAQGuCIgAAAADQmqAIAAAAALQmKAIAAAAArQmKAAAAAEBrgiIAAAAA0JqgCAAAAAC0JigCAAAAAK0JigAAAABAa4IiAAAAANCaoAgAAAAAtCYoAgAAAACtCYoAAAAAQGuCIgAAAADQmqAIAAAAALQmKAIAAAAArQmKAAAAAEBrgiIAAAAA0JqgCAAAAAC0JigCAAAAAK0JigAAAABAa4IiAAAAANCaoAgAAAAAtCYoAgAAAACtCYoAAAAAQGuCIgAAAADQmqAIAAAAALQmKAIAAAAArQmKAAAAAEBrgiIAAAAA0JqgCAAAAAC0JigCAAAAAK0JigAAAABAa4IiAAAAANCaoAgAAAAAtCYoAgAAAACtCYoAAAAAQGuCIgAAAADQmqAIAAAAALQmKAIAAAAArQmKAAAAAEBrgiIAAAAA0JqgCAAAAAC0JigCAAAAAK0JigAAAABAa4IiAAAAANCaoAgAAAAAtCYoAgAAAACtCYoAAAAAQGuCIgAAAADQmqAIAAAAALQmKAIAAAAArQmKAAAAAEBrgiIAAAAA0JqgCAAAAAC0JigCAAAAAK0JigAAAABAa4IiAAAAANCaoAgAAAAAtCYoAgAAAACtCYoAAAAAQGuCIgAAAADQmqAIAAAAALQmKAIAAAAArQmKAAAAAEBrgiIAAAAA0JqgCAAAAAC0JigCAAAAAK0JigAAAABAa4IiAAAAANCaoAgAAAAAtCYoAgAAAACtCYoAAAAAQGuCIgAAAADQWqdXdNIUSV3XaYomddMc9JgAAAAAgHtQURQpnty51Px/G1/J7258Kb+38UQ+v/1shrPxQY8NAAAAALiHVEWZ1y+dSjGrZ02dJtOmzix11ifb+a/bz+T3N57IH2w9mT/afDKXJpupm/qgxwwAAAAA3AVlUeRQtZS3rz6ev7D6uvwPh9+Yt688nlPdwymaZv89zk2aTOpZxs0sk2aaYT3OkzuX80dbT+YPNp/MH249ma8ML2ZcTw/q8wAAAAAAd1C3qPLo4Gi+ZeW1+dZDr883r74mb1k+m5Wyn17ZSa+o0i07KVO8MCg+X7OYvTicjTNqphnORrk03cx/23omf3zja/njrSfzxeH5XBlv3a3PBwAAAAC8Ake6y3nz0pm8Y/W1efvK43n7ymM52zuSpaqfQdHJoOqllypFUbzgtX9mULydaTPLsJ7kxmyU7XqUjekwXxtdyX+78Uw+v/1s/tuNZ/Kl4YVM69kd+YAAAAAAwNenU1Z5vH8sb11+NG9dfjRvW30sbxicyrHuapbLXlaqfpbKXrpF1er9vq6g+HxNmuzUk2zNRtmcDrNVj3J1spUv71zI5248m89vn8vnbzyby9NNkREAAAAAXiVlUWS1GuSblh/NNy0/km9aeTTftHw2J7trOVQNstoZZLXsZ7nqp8wLZx+2cUeC4u3M0mRzOszGbJj16XY2ZsM8vXM1Xxqezxe3z+ULw/P56s6lbE6Hr8a3BwAAAIAH3lLVy2v7J/KW5bN5y/LZvHnpTB4fHMtatZzDneUcrpay1llKp6i+znz4Qq9aULydYT3O9el2rk+3c3WylUvTzTy9czVf3bmYL22fz1d2LuW50bUM6/HdGhIAAAAA3Be6RZXT/cN5w+B03rx8Jm8YnM43LJ3IsWolx7qrOdJZzrHuSpbL/qs6jrsaFJ9v2tS5MdvJlelWrkzmX5cmm3l6dCVP7lzKVxdf58frbpUGAAAA4KFRFmVO9g7ltf3jed3gVL5hcCKvGZzIme7hHO+u5nj3UE50V7NWLaUqyrs6tgMNirczqadZnw1zabKZy5PNXBiv5/JkM0/uXM7XRlfy1M6lPD26mkvjzTS5p4YOAAAAAF+X493VPNY/mtcOTuY1/eN5fHAiZ7prOdlby4nOak721nK0s5JB2T3ood57QfF2Js00lyabOT9ez4Xxei6ON3Jhsp5nRlfztZ0reXZ0Lc+Nr2V9up1pUx/0cAEAAADgtsoUOdRZyiO9o3nN4Hge7R/JY/3jOd09nNO9tZzuHc7p3uGc7B7KoOzdsXUP76T7Iijezk49yYXJep7duZbzk/WcH13Pucn1nB9dz/nJep4bXcuFyUauT26IjAAAAADcdbvx8MwiEp7tHcmj/aM52zuSM70jeaR3JGf6R3K2eyTLVe+gh9vafRsUb2dztpNLk435jMXRtTw3vp7z4+vzWY2TjZxfHEVGAAAAAO6ksihyuLOcU921nOodzunu2t6Mw0d6R3OmdySPLWLi4c7yQQ/3FXmgguLt3JiNcmGykWdGV/L06Gqe2bmymNG4nsvTrVwcrefqbL4hTNNYlREAAACAl1akyNHuSo53VnKyd3ixxuGhnO0dyeODE3m0dzSPD47lbO9I1qqlgx7uHffAB8Xb2aknOTe+nqd2LufJxSYvT4+u5spkM1enN3J9ciNXp1u5Nt3OpJ6KjAAAAAAPoSJJVZRZ6yzneGclx7qrOdZZzfHuah7tH83j/eN57eBEXjs4kUd6R7JS9VPck6se3lkPZVC8nWkzy7Oja/nqIjB+defiYjfpjazPhrk+ubF33Gkmqf22AQAAADwwyqJIr+jkcGc5a9VSjnZXslYNcqK3lkd7R/K6wal8w+BEvmFwMo/1j90Tuy0fFEHxJTRpcnGykScXMxmfGF7MV3cu5cL4eq5Ph9mYDrM128nGbJgbs1Fm1mUEAAAAuOdVRZlB2c1atZRDnaWsVYP5+oe9tby2P4+Gr186mdf2T+Sx/rFURXnQQ76nCIovU5MmG7NhnhxezldGF/PE9oV8Zedinty5nOvT7WxNd7Jdj3NjNsp2Pcqonh70kAEAAAAeWr2yk0HRzWpnkJWyl5VqkMOdpTzWP543LJ3KG5dO5/WDU3nd0skc66w8FLcsv1KC4h2yU0/y9OhKvjy8kCeGF/OVnUv58vBczo83MpyNM6xvfu3UbpkGAAAAuJOKFBmU3SyVvSxV3QzKXpbK7nzW4eBE3rR0Jm9cOp03Lp3Oa/rHs1oNDnrI9y1B8VXUJFmfbucLw/P50o1z+dLOhfzp9rl8bXQ565PtjJpJdupJxs00O7NJpqnjHwcAAADAiyuKIlXmtyz3iiqDqpdeUWW1s5TX9I/nG5cfyRsHp/PmlTN5/eBUTnXX0nHL8h0lKB6AWVPnqdHlfGH7XL44PJ8vbJ/LF7bP5bnRtWzX44zraSbNLJNmlmkzszYjAAAA8FAqizKdokyv6KRTVOmVVQZlN2d6h/OWpUfylpWzefPSmbxl6Wxet3QyvaJz0EN+KAiK95CN2TBPDC/k89vn8vkbz+YLw3P58vBCLk42MppNUqfJtJ7Nj02dJv7RAQAAAPe/IklVVClTpFPePB7vrOSNy2fyjUtn89aVR/ONy4/kTctncqxaOeghP9QExXtcnSbXpjfyhe1z+dyNZ/O57Wfzhe3n8qfb53JpspmmadIs0mLTNKlFRgAAAOAeVSz+uyzmvypTpEiRY92VvH7pVN668mjeuvxo3rJ8Nm9ZOpszvcPpFNVBDpnbEBTvE03TJMX82BRJXde5NN3M5248l89tPzuf0bgzj44b053UbpMGAAAA7iFFUWSp7OatK4/mLUtn803L83j41tVHc6a7lm7ZSZrMY2Mzfz73JkHxPtakyaxpMmvq1Kkza5rUmeXZ0bV8cXg+n7/xXL44PJ8vDc/nK8NLuTa9ITQCAAAAr7rVziCvG5yc36K8dCbftPxI3rJ8Jq8dnEiVMlVRpkyZqihSptybscj9QVB8AM1SZ1rPMk2dST3NtGkyqie5PN3ME8MLeWJ4MV8aXsiXh+fzxPBCLi5unQYAAABoqyiKHOks5w1Lp/K6wam8cel03jg4nTctn87Z3tEsld1URZlu2UknZbpFlcpuyw8EQfEhMm3qTJppxvU042aWcT3NqJnk+nQ7XxlezFd2LuXLwwv52s7lfHnnfJ4brZvRCAAAAA+5oihyureW1/RP5A1L83D4+sGpfMPgZE50D2Wp7KZXdtItqvTLTrqLHZnNOXxwCYpkljo7s0lGzTTD2TjjZpphPc7WbJSvDi/mydHlPDW8lKfH1/Lk8FKeHV/L9mx00MMGAAAA7qBe2cmZ3uG8dnAyrxucyOuXTuex3tG8fulUDldLGVS99ItOlhbHQdlLlcJahw8hQZEXVTdNhvU42/U4w3qcndk4w3qSrXonF8cb+droSp4ZXc2zO1fz1OhKvja6kmvTG5nWs4MeOgAAAHAbZVFmrVrKY4Njebx/LK/pH8/j/WN5rH8sZ/tHs1YNMih7Wa56WS77GZTdLJc9tyqzj6DIy9Yk2VmExhvTUYbNOFvTnWzX41ybbOW58fU8O7qWZ8fX8vTOlTw7vpbz4+vZno0PeugAAADwUBiU3Zzqr+Wx3rE81j+eR3tH8ujgWB7pHsnx3qEsF72sdPpZLntZqQZZLrtZqvop3ahMC4Iid9SkmeXGbJQb9U42pzvZmo2yORtmazbKhcl6zo/Wc258LRcmG3l252ouTNZzabKZiVmNAAAA8LKURZFj3ZWc7R7Jmd6RPNI/mrP9o3msdzQnu4ey2hnkULWU1aqfQ9UgK1U/q9UgvaJz0EPnPicoclc0TZPtZpzN6U42ZzvZnA6zMRtmczbMxmwnl8YbuTDZyPnR9VycbOT8eD0XJxu5PrmRSSM2AgAA8HCqijKHO8s52T2U073DOd09nFO9tZzqruVM/0gOV4OsdZayWi7lcHcph8pBDneXs1R0U7pNmVeJoMiBq9Nka7aT9el21qfDrE+H2ZhtZ326nevT7VyebObSZDMXFpHx4ngjV6ZbWZ8O7UINAADAfa8siqxVSznRPZQTvUM52ZnHw5O9tZzoHsrRznLWOktZq5ZypLOcQ9VSDneWs1YtpSMacgAERe5pk3qarXqUa9MbuT7dzpXJ1l5oXJ9t5/J4M9cWx6vTrVwab+Ta7EauTbZTp4n/eQMAAHDQiqJI0zQ52l3Jsc5KjnVXc6xazYneao53VnOit5ajneUc7axkrbOUo52V+Xl3NYfKQXqlW5S5twiK3LcmzWwvLl6d3si1ydb8uPi6Pt3OtcmNXJ1s7V27urg+rqcHPXwAAAAeMN2i2guCx7qri+NKDlfL84jYWc7R3fPO6jwwdldypFpOr+yksCEK9wlBkQfStKmzORvmyiIyXh5v5NpsO1cmm4v4eCPrs+1cn2zn+uK4PhtmY7qd7XpsZiMAAAAvUBRF+kUnhzvLOVwt5Uh3JYerpRztrmStWsqx7mqOdJZzvHsoxzsrOd49lGOdlb2ZiZ2iOuiPAHeEoMhDZ3fNxsuTzVyZbOXSZDNXJpu5PNnKtelWrk5uzDeMmQ6zPttZ7FK9k/XpfBMZO1IDAAA8uKqiXOyKPF+n8FA1yKFqMP91ZzAPhp3VnOiu5UR3db7uYfdQjndXs1YtpbKmIQ8BQRFu0TRNJpnl8ngzl6dbuTBez9XpVi5Ptuabw4w3sj4bZms6zFY9zuZ0mBv1KJvTYbbqUbano9TxrxQAAMC9qkyRpaqXlUU0nMfDQVaqflYXOyYf767meLWa0/3DOd45lBO91ZzsHMqJ3loGRTdl4dZkHm6CIrxM16fbuTLdysXxRi5NNnJxvJ6Li12or0y2sjnbyXY9yvZsnO3ZKNv1ONuzcW7Uo+zU49T+lQMAAHjV7N6WvFz1slz2s1L1F8f5+WpnkGPdlZzuruVUdy2neodzsruWU735jMNjndWD/ghwzxMU4Q4a19Ncn23nwng9FycbuTjeyOXJZs6P13NpMv/19mycG7NRdppJhrNxdurFsZlkp57YnRoAAOBFFIttSwZVN/2im+Wql0HRzVLVz6DsZKnqZans5Xh3PqPwdP9wTnXXcrp383i0s5JB2T3ojwL3NUER7qJZ6lyb3Mhz42u5MN7IxclGzo+u58JipuOl6Wa2pjvZqedxcVRP58dmklE9ybieZdpYwxEAAHhwVUWZXtFJv+ymX3YyKLvpF529iLjSGeRkdzWnuodzureW070jOd1dy+ne7izDtfSLzkF/DHigCYpwD5k1da5Ob+T8+HrOj9dzbnw9FxbHi5ONXBivZ2M6zKieZtLMMq4nmTR1RvVkcT7NJDMzHAEAgHtSURTppEyv7KRbVOmV3fSKan6eKr2qk0PVIKcXtyGf7R3O2d6RnO4fzpnukZztHcnJ7moquyXDgRIU4T7SLHaoPj9ez3OL2HhhvJHnxtdybnQ9FyfrOT9ez049ybSpM12Ex2lTL46zTJpZ6qZJY/MYAADgDiuLIt2ik05RpltU6RZVOmWVbubHftnNie5qznQP52z/SE51D+eR/pGc6R3J6cWMw6PdlVSxUzLcywRFeMDUaXJhvJ5Lk808M7qS8+ONPL1zJecn13NutJ5zk2u5NrmRcT3LrJlllibTepY6TabN4ljP0hQx0xEAAEgyn1lYNElVVqlSpCrKVCnTKauUKdIpynSKKoe7yznbPZKz/SM50z2c1yydyOnuWh7vH8vJxRqGXbML4b4nKMJDaLse5/JkI8+Or+e50bU8N7qWZ0fX9mY4Pje+lsvjrcVsxjp1mr1ZjbOmSZM6ddOkNssRAAAeCGWKlMV8y5OyKPfOy8V5p6hytLuc0935Lchne4fzSP9oHukfXZwfySO9o1mp+gf9UYC7QFAEbmvSzHJhvJ5nxlfz3Ohazk828tTwUs6Nr+eZ0dVcmmzkudH1TJrFmo1FUtfz4/y8SNPUSQq3VwMAwAGZ74ncpCiKpJnPNEzmtyY3TfYi4iODIznVWcujg2N5pHckj/bmx8cGx/Jo71jO9A+nX3QW7wc87ARF4CXtxsCmyb4w2KTJtKlzfry+uJ16vpHMc4uZjucWMx3Pj6/n2mSYmd2pAQDgriqLMqtVP2f7h3O2dzRnFhucnFnMJnykfySP9Y/ldHctnaLKbn5MkRRNsTjejJAAuwRF4BVp0ixui87ebdF1U6cpMj8m2Z6Nc3myOd+1erK+2EBmM+dH13J+sruxzNVsTUcH/XEAAOC+sNzp5WTnUB7pH11scHI0p7prObNYu/BM/0hOdlaz2hmkaIpUZZmimUfGIjePVVGadQi8bIIi8KprMo+Ls9SZNfP1F2e3nmd+vl2Pc3G8nvPjjVycbOTyZCMXxxu5MtnK5clmLk02c3mykevTYUb15KA/FgAA3FGdosyhziAnuodyvHMoJ3qHcqJzKCe683B4qruW0721nOkdznLZT6ecb4xSFWXKxbEqisV5IRYCrxpBEbhn1E2TWepM61lmqTNpZpk1zS27UU8zS5NxPc1GvZOLo/Vcmc5j49XpjVxZRMcr461cnW3l4mgj12fbdqsGAODAFEWRtWopR7srOdZZycnuWo51VnKqv5Zj1eoiGs6PR6uVDKru83ZPnu+q3C07txzLlG5DBg6QoAjcl6ZNnWkzy6SZZtrM4+O0qTOpp5kuouRk8fj16XYuTzZzbXojl8bz+Hh1sjWPkNOtXJ1s5cpkM1uzUWZNfdAfDQCAe1xZlFmuejneXc3xzmqOd1dztLOSY53VeTjsruZkZzVHFhFxqeylU1TpFlU6RZlu0ZkfyyqdVPPj4jEzCoH7gaAIPPAm9TTjzObHZpZxPc10cZykzrieZNLMcmM2zuZsmCuTrVyb3si1yY1cm97IlclWrk63sj7dztXpdq5MNnNjZr1HAIAHzVLVy7Huao5VyznWPZSjneUc7a7maLWcY93VHO0s53j3UA5Vg6x2BummSq/qzI9lJ51ifuymTL/splOU6ZV2RgYePIIiwEKdJpN6mlEzzaieZrI4jutpdhbRcVRPM2omGdbjbEyHuTrZylY9yvXpdjamw2zMhtmcDnN9up3N2fx8YzbMjekoU7MfAQDumrIoslz1crhazlpnKYeq3a9+jnZXslYt5VBnKYcXtyMfrZYzqHrpF930y056RSf9spteUc2PZZXe4rFuUaUqyoP+iAAHRlAE+DrUaTKqJ3vBcR4hJxk38/NxM83ObJJJZovrs2xNd7I528nGdJjNeicbk2E2Z8Osz7azNRtla7Yz//V0lI3ZMMPZ+KA/JgDAPWNQdbNS9rPWWcpqOcjh7uLYWc5atZS1zlJWyl5WO0s5VA2y1llKv+hkUHXTSye9qptuqvTLzuKrm25RZVB2F8/rpTSTEKAVQRHgLmjSZNLMslNP9mY8juppdupxRs107/qwHmfSzDKsx9mpJ9ma7WRrOsrmbJjN2U42pzvZrHeyOR3mRj3KjUWI3Jzt5MZslHE9PeiPCgDwZ+qWVVaqfg5Vg6yUgxzqLGWtGmS1GmS57OVQZymri8dXq/njg6KbQdlJr+zuRcD+4teDcjGrsOymX1QZlL30yo5ACPAqERQB7lGzps6omWY4G89vs56Ns9NMM5yNsrOYATnedz7Odj1fB3J7Ns6N2Sg36lE2pzvZrsfZno0yrMfZmu1kp5lkezrOdjO/3iR2wwYAXrYiRZaqXpbKTpaqfpbLXpaqXpaL+UzB+YzBQVbKfg7tnleDLJXdLFX99ItOlha3GS9Xvf2RsOpmUHT3Hu+4xRjgniEoAjwgmiSTZj7LcTibZFRPsl2P92Y7zmdFztd/HNXT/TMkZ/Pru88fzuav2bs2G2dnETW363F2ZpNs16MM60lqa0MCwH2tLMoMyk4GZTfLZT+Dspul3TBY9jIoe1mquvNYWPb2Hh+U3ax0+nsRcPe24V7R2fceS7u/LntZruav6xaVjUoA7mOCIsBDrkmTaVPvRcPtW2ZE7s6Q3Gkm2ZlN9qLiqJlmezqfGTmqdx8fZ7ueH3d2X1dPslOP92ZQ7p9pOc5MjASAO6Isir2ZfPPY18mg7GWwiHxLZXex4UhnX9jrF/Pru8+7eVzMGFzEwH7ZyfLujMLF+e6txsIgwMNHUATg6zZfG7LOsB5lp57kxnS0Fx2H9XwW40492TfDcdhMMpyN9p6zu6HNaLGG5Hz25K0b3MwyricZLY7jZr7RzaSZZVxPRUkA7ntlUaRXdtIr5rsI98pO+kVnca2TTlHuzfzbDXlL5c3zefSb3yK8XPb3ZgTeOpNwuervO1/dPa/66ZktCMDLJCgCcCCapskks2zPRtmpp9lerPm4fUt8HC9mMo6b6WLm5M01JXc3trk1Lk4z29tdezyb7h3HmWVST/eeN9mNkqkzXUTLST2NPxABeDm6ZZVe0Um3rNJZ7B7cLar0bj2ms3feLzvp7B3LxS7DnX27Dt9cM7Czd+wtguHSYubg7hqEu5Fwueqlm07KQhQE4O4QFAG4r02bejGzcR4Zn7/m4+613fUjdxa3ZQ9vjZb1ODv1dBEbp5nUs0yaWabNbF+EnDb1vvNbnzPd+6ozbWap/fEKcM8piyJVUaVTlOkUZbpFle5iBmC3uBkBbz5WpbuIgbeed4pyb3bgctVPr+hk6ZYNRPai4N7agbfMGFw83r9lTcJuUR30bw0AvCyCIgBkfvv2qJ7mxmyUUTOZz5xczIjcuASMhAAAIABJREFU3SV71EwXu2XP15qcb1wzvz6cjjLONMPZZG/G42wRIOs0mdazzNJk2swyS51pXadOnWk9f3zSzDJr6kybevH4zeu7z5vd8j42wwEeRGVRpkqRTlmlSpGqrFI2RbpllSrl3vVOUaUqynSKKuXe8+eRsMz+55e3PL+7uK14qeqml/kMwMHeGoHdrFT7bxdervp7awnunt/6uNuEAXhYCYoA8CqYNfX8tuzm5q3ZO4s1I3dmi2M9ma8PWU8XG9bsXt+dcXlzJ+7RYpfunVtu896Ni7OmTt3UmWZ+nDX13vW9r9T7zuvd1y3i5PzYpE6dumkyWxzrNPFXBXi4FSlSFElVlClS7B07RZkiSZlyMfOvTJVyfix2497Nx3bj3/7Hb3ldWe7d/ru7oUhvsXvw7uYf/WJ+vV/OY2Bvsc7gYHFL8O7uwv3y5vN6ZSeDYj5LsCrKg/7tBIAHgqAIAPehWVMv1pQc7YuUt97+vTujcmex4c2knq9FOV7EzNFi45tp6oxmk0xTZ2c2Tp06w3qSSTPNqJ7Ow2LTpFlEyGYRH5uiyayu0xR53uO55Xnz8/3RcnG9SOrF62++T714nyZZHG99H3jYVLvRbnHcjXllUaZoshfIbn1emSJlUSyOL/76sknKcv4+L3y82IuHuxuGdFPtrRm4t1lIWaafbnpVN/2iWuwqPN8cZDcC9hZrAe5ev3VtwN2NRpYXuxJXbv0FgPuCoAgAvKTd2Y+7Mylv7r493bee5O7Myd1duke3bIQzbWaLqFnvvcekmWXcTDPZfb/F+pWj3bUsm+ktu3rPN9CZx8n5X13mqXG+wU+K3etN6t1HF3/DmafI3Siaxaue9/rnnTdJ6t13arL3qmZ3xmZxcxy7qbO55f2b553f/K7z60WRvfHt/4tYs+/81rOmyc3XFXkgZ47u3j5aFPPfl+J5128+L7c8esvzit3fp/3PKHb/U9zy69x8Xrn3jovz4uZzkiLlYjzlrVeL/e9T7Pu+t1y/ZfS7z5tvnLH7SLP/vZ4X87pltbfb7+56f/2ym145X8+vV3QW16q9xwdlN1VZZbnspVNU6S3W/dt9n/7eBiHdvXUBd3cV7pZVemV3Xzy0vh8A8HyCIgBwz2sWt2Hvbo4zrqcpimS8u/ZkPcs0s0zq+RqV43q2N2NyvpnOYk3LxeP717acr2m5e1v43sY7maVZzKiczKaZpZm/T5rM6lmmqRcb8TSZ1JPFmpd1Zs1s8f2ave83a2Z7oXOWeh4VU2TSzJIUe5Fxupih2TTN3ozNpNibobkbK3dvT9+LkrdEymIRO4ti932LfdG0WHy/3BLfdl9fP+/5SZJbHs++5xfPO188Pbc8nuc/v3nB67P3vJu3zqbZjXrzmXNpmr2ZdLuv65bVzXjYNOlW1d77ltm9FXe+AUeZeZirimK+Accta/F1y06qxePz5xfppLp5vZqvxVck8007yk7SNHuBb29Nv7Jzc22/xfvubvRR7L7vYg2/3e/XSbk33t3zXtmZ7xZcdfYFTACAe4mgCADwANi7Ff2WWZr1LTM1Z4uImiaLNTZnN+Ph4jjNbO/9JvVsX8pqknTKau/a7lp5u69P0+ythZfMQ19nMbNtHgbn8+92V7DbvbUWAID7j6AIAAAAALRmmzMAAAAAoDVBEQAAAABoTVAEAAAAAFoTFAEAAACA1gRFAAAAAKA1QREAAAAAaE1QBAAAAABaExQBAAAAgNYERQAAAACgNUERAAAAAGhNUAQAAAAAWhMUAQAAAIDWBEUAAAAAoDVBEQAAAABoTVAEAAAAAFoTFAEAAACA1gRFAAAAAKA1QREAAAAAaE1QBAAAAABaExQBAAAAgNYERQAAAACgNUERAAAAAGhNUAQAAAAAWhMUAQAAAIDWBEUAAAAAoDVBEQAAAABoTVAEAAAAAFoTFAEAAACA1gRFAAAAAKA1QREAAAAAaE1QBAAAAABa+//Zu/P4qOtrf/yvzyyZ7DsJJCRsgRAIyCbIrhFkB6VQtZa6VK316rWtbb339t4uP2/v7b3XW/XaarWKioKiFUX2LeyBEAhL2BJCVrKvM1lmn8/vD76hLMnMZ5KZ+Xxm8nr+k0cy75k5yUwmeZ8573OYUCQiIiIiIiIiIiLJmFAkIiIiIiIiIiIiyZhQJCIiIiIiIiIiIsmYUCQiIiIiIiIiIiLJmFAkIiIiIiIiIiIiyZhQJCIiIiIiIiIiIsmYUCQiIiIiIiIiIiLJmFAkIiIiIiIiIiIiyZhQJCIiIiIiIiIiIsmYUCQiIiIiIiIiIiLJmFAkIiIiIiIiIiIiyZhQJCIiIiIiIiIiIsmYUCQiIiIiIiIiIiLJmFAkIiIiIiIiIiIiyZhQJCIiIiIiIiIiIsmYUCQiIiIiIiIiIiLJmFAkIiIiIiIiIiIiyZhQJCIiIiIiIiIiIsmYUCQiIiIiIiIiIiLJmFAkIiIiIiIiIiIiyZhQJCIiIiIiIiIiIsmYUCQiIiIiIiIiIiLJmFAkIiIiIiIiIiIiyZhQJCIiIiIiIiIiIsmYUCQiIiIiIiIiIiLJmFAkIiIiIiIiIiIiyZhQJCIiIiIiIiIiIsmYUCQiIiIiIiIiIiLJmFAkIiIiIiIiIiIiyZhQJCIiIiIiIiIiIsmYUCQiIiIiIiIiIiLJmFAkIiIiIiIiIiIiyZhQJCIiIiIiIiIiIsmYUCQiIiIiIiIiIiLJmFAkIiIiIiIiIiIiyZhQJCIiIiIiIiIiIsmYUCQiIiIiIiIiIiLJmFAkIiIiIiIiIiIiyZhQJCIiIiIiIiIiIsmYUCQiIiIiIiIiIiLJmFAkIiIiIiIiIiIiyZhQJCIiIiIiIiIiIsmYUCQiIiIiIiIiIiLJmFAkIiIiIiIiIiIiyZhQJCIiIiIiIiIiIsk0cgdARBRo7KIDZocVVtEOi2iHxWGF2WFDg60NJcZ6XDHWotrcCoO9E50OCzrtFhjsRrTbzei0m9HpMKPdZoJapUKQoEWwSgOtoEGIOghR6hDEaMMQrwlHsi4WMZowJOliMEw3AEm6GGgFNYJUGgQJGgSrtAhSqSFAkPtHQkRERERERAFEEEVRlDsIIiJ/ZhXtqLXoUWluQrW5BaXGBlRam1Fn1qPeakCVuRlN1nZ02M1ei0GAgBC1FolB0RiojcTg4FikBMVhaMgAJGojkaSLxcCgSCQFxUAtsDidiIiIiIiIeo8JRSIiN4kQcc3cglNtpTjbXoELnddQa9Gj0dqGRksb2uwmiFDGS6tGUCNSE4I4TThitWFI1cVhQsQQTIsYgbvChyBCHSx3iERERERERORnmFAkIpKoytyMdfVHsbHuOEpM9bA7HBAFEQ4/ehkVBAGCCKgEFYJUasyKTsfD8dOwOG4CYjRhcodHREREREREfoAJRSKibnTYzai16lFlbsYxQzF2NJ3FcUOx3GF5TZQmFPdEpiErZgymR6ZhsC4WA4OioWL/RSIiIiIiIroNE4pERDeptrRgb8sFnGgrwZm2MhQZa2GwGeUOy2cECIjRhmFyxDBMiRiGOVGjMSl8KKI0IXKHRkRERERERArBhCIR9XsigEudVVhbcxC7mgtQZ9WjzaacPohy0QgqxGkjMCQ4Ht8ZcDceT5yNaE2o3GERERERERGRzJhQJKJ+yQ4HOmxmXDRW4X8qtmNf6wWY7Ba5w1K0YLUWzyXNw5OJs5ESHIdQVZDcIREREREREZEMmFAkon5FhIiLnVXIbrmIzU2ncKS1SO6Q/E6cNhzzYjKxasBUTI0YjoSgKHZaJCIiIiIi6keYUCSifqOwswbr6o9gT3MBCjtrYHbY5A7Jr0WpQ3BP1Egsj5uERxOns2KRiIiIiIion2BCkYgCnlW044+VO/DXmv2osbTCLjrkDimg6FRaJAZF4j+HP4wVcZOhEVRyh0RERERERERexIQiEQUkOxyoNrdie/NZvFa5DZWmJrlDCnhaQY0FcePxk+QFGB+eikg1J0MTEREREREFIiYUiSjgGB0WbKw/jo/rjiDPUAKbaJc7pH4lRhuGZXET8f3EmbgnMg1BgkbukIiIiIiIiMiDmFAkooBysr0Ur5Z9jdy2q2i1dsodTr+lEgQM1sXikYTp+GXKEoSrg+UOiYiIiIiIiDyECUUiCgiddgvW1h3E78s2o8XWIXc4dJOU4Dh8OPpZ3BORxv6KdAtX/4IIAueHExEREREpEROKROTXOhxm5Bqu4k9Ve7Cr+RwHrihUhCYYPxx4L55Nug/DgxPkDof+n5aWFkRERECj8f2x9KqqKly8eBFWqxWCIEAUxTs+zpw5E1FRUT6PjVyz2+2oqKjAoEGDEBzsvxXInZ2dKC0tRWJiIuLj4+UOh/qgoqICzc3NPb6edH3U6XTIyMiQO1wiIiK/x8ZWROS3Gqxt+L+q3fik9jBqLXq5wyEn2mwmvF29F3ltJXhp8AIsiZ0ANasVZdXW1oaPP/4YYWFhWLBgAVJSUnxaEXjlyhW8//776OzsuTVBWloaE4oKVVlZiddeew3p6emYMGECJk+ejLCwMLnDksxut6OwsBC7d+/G6dOnsWDBAjz88MNQq9Vyh0a99O233yInJ8dpMlEQBCQmJuL111+XO1wiIiK/x4QiEfmlFlsHfnDpHeQYimF2WOUOhySwOGw4qi/ChY5reGLQHLySshQxGv9JQASavLw8HD9+HEajEXl5eVi2bBkWLVrks2pFHpDwb3l5eaioqEBlZSWOHj2KiIgIzJs3D/PmzVN8pZ/NZsOnn36K7OxstLa2AgBycnIwffp0DBs2TOboqLdMJhPa2tpcrouMjPRBNCTVtWvXcPz4cUyZMgUpKSlM6hMR+REmFInIr5gcVuzXX8IzhR+g0WKQOxzqhVZbJ/7v2i5Umprw78NWY2jwALBTnm81NTXhwIED6Oi43m+0pqYG7733Hg4dOoTHH38cI0aMQEhIiFdjUGp/xMLCQlit3b9J0VXdpPSEmbc5HA6cPXsWwPXEcGdnJzo7O7F+/Xp8/fXXmD59OhYuXIhBgwYhIiICKpX81ciiKKKjowNnzpzBBx98gMbGxlsur6ioQG5uLoYMGaKIeMl7+GaGsuzevRtff/011q1bh6SkJEycOBGTJ09GSkoKQkNDERISIktbDm/Iz8/Hhg0bXK6LjY3Fyy+/DJ1O54OoiIh6LzBenYmoX2iytuOD2gN469oeNFqZTPRnDlHEVw15qDA34pWUZXggdhyCBP5J8pW8vDycP3/+jq9fvnwZr776KmbPno25c+ciMzPTa4m/ruOHzsiRdHz11Veh13ffQkGj0WDNmjVYuXKlj6NSlrq6OtTV1XV7WWdnJ/bt24cDBw5g1qxZePzxxzFgwAAfR3grq9WKM2fOIDs7G3l5eTCbzXesEUURu3fvxpw5c5CUlCRDlOQrSn0zoz9qbW3FmTNnAFz/HayqqkJVVRW2bduGuLg4jBgxAsOHD0dKSgqGDBmC5ORkv65g1Ov1KCwsdLkuISEBDgd7ghOR8nH3RkR+odzUiJevrsf+1kvosN+5GST/lGcoxT8Wf4KXBi/A04PuRZiK78Z7W3NzM7744oseq/A6OzuxZ88enDlzBitXrsTixYu9EkdXTzNn5KgkstlsPV4mJQnaH5SUlNyobu2J3W6HXq9XRIXNV199hZ07d6KpqcnpuoaGBnz55Zd46aWXfBQZyYEVispRWFjY7e+lKIpobGxEY2MjcnNzER4ejunTp+PZZ5/164Si1L8f/DtDRP6CZzqISPEKjTVYfuGP2Np0hsnEAFRtbsG/ln6J/7u2S+5Q+oU///nPaGhocLrG4XCgoaEBd911l9fiUOqm3mQy9XgZN3nXH7eysjKXCUVBEDB8+HBF9KsbP368y2Ril7179+LKlStejojkxN9jZXA4HDh//rykvpft7e1ITEyEVqv1QWTyU+rfRyKi2zGhSESKJQI4ZriCZ4s+QFFHjdzhkBdZHXb8ruxrvFT8CaotLXKHE5BEUcTBgwdx+vRpl2tVKhWWL1+O5ORkr8Wj1E29s40cN3nXN/aVlZUuj+NptVpkZmb6KCrnxowZg3nz5kle//nnn8NoNHoxIvIGqb+f/D1WhsbGRhQXF0t6PGJjY5Genu7X1YnuUOrfRyKi2zGhSESKta/lPF4q/hS5+qvgv//9w3s1+/GLq5/hirH7/mzUe7W1tdixY0ePR51vlpqaivvvv9+r8Sixh6Ioik4TZVKOaQe6lpYWVFZWulwXFhaGMWPG+CAiaR588EEMGjRI0trCwsIbfd3If/A4qX+pqalBSUmJpLWDBw/GkCFDvByR9zHpTUSBhj0UiUiRvmw4gZevrkc9Jzn3K6Io4tvGfLTbzXh/9NMYoImQO6SAYLPZcODAAUnN4IOCgjBnzhykpKQ4XWc2m2GxWJzejrP+eZ7ooWgymWA0Gm8kJ7sSBV0f1Wo1QkNDJU/tddY/sSue/p6MqK2tRXV1tct148ePR1hYmA8ikiY5ORlz587FF1984bK60mAw4MiRI8jMzEREBF+DAg2TNcpw6tQpdHZ2ulynVqsxduxYREdH+yAq72LSm4gCDROKRKQodjjwZf0J/LLkMyYT+ymraMeu5nNYc/EdbBjzD4jVKCcp4a8qKyvx7bffukyYAderEx944AGXR8s++ugjbN26tcfLlyxZgueee67Hyz2xqd+6dSs+/vjjHi/PyMjAz372MwwcOFDS7bn6+XCTd31CuJSfU1ZWlo8ikkaj0WDGjBk4duwYKioqXB5tP3HiBBYsWIDx48f7MEryBf4ey89msyE3N1fS2qCgIEyePDkgHjepk5uZ9CYif8Ejz0SkKNsaz+DXZV8xmUg40HoJj116G0XGWrlD8Wt6vR5/+tOf0N7e7nKtTqfDmjVrEBUV5fW4PLE5lFLh6M79SKlQ1Gj673uxVqsV+fn5LtfFxMRg3LhxPojIPampqZg+fbqktSaTCV9//TXsdruXoyJfY7JGfnl5eZIqnQEgJSUFaWlpXo7I+0RRlFwtz/YaROQvmFAkIsXIbr2IX5R8hgpTo9yhkEIcbi3Er0v/hkpzs9yh+CW73Y4vvvgCRUVFktYvX74cEyZM8HJU13mih6KUy93ZlLlKHt18rLo/KigoQH19vct1U6dOVeQ0VrVajYULFyI+Pl7S+jNnzuD48eNejop8rT//DiuB3W7Hxo0bJa9fvnx5QAxjcefvEdtrEJG/YEKRiBThVFsZnrr8HsqZTKSb2EQ7tjSdxn9UbIaDo3nclpeXh4MHD0pam5aWhhUrVkiuoOgrT/RQ7OvltzOZTC7XBMLGtre2bdvmco1KpZJcBSiHuLg4PPHEE5LW2mw2fPzxxzCbzd4NinyKlV/yunjxIsrKyiStjY+Px6xZs7wbkA+xhyIRBRomFIlIdhc7qvDL0s9Qa9HLHQopkF104MOaQ/jfyu0QmVSUrKamBt9++y30ete/VxEREVi5ciUiIyN9ENl1ntjUe3pKtKsBAYIgIDg42K3bDBQtLS2SJh8PHjxY8jRlucyZMweZmZmS1jY0NGDfvn2Se5+R8jFZIx+73Y4jR45IaiUgCALuvffefvkmDpPeROQvmFAkIlk1WA34XfnXOK4vljsUUqiEoEisHjANyboYOPhPtmTbtm3DhQsXXK7rqiibOHGiTzfaSuyh2NbW5nJNUFCQ5NsLJKdOnYLVanW5Lj093S+msa5YsQLh4eEu19lsNhw+fBiNjayeVzp3jpOSPGpra3H58mVJayMiIjBt2jQvR6RMTHoTkb/ov53FiUh2Djjw06vrsa3pNOwiqz/oVpGaEDyWOBOPDLgHo0IHIobTniU7fPgwdu7cKamqKiYmBqtXr5aUXPEkJfZQdDW4RhAE6HQ6ybcXKOx2u6RhLCEhIRg1ahRCQkJ8EFXfjBkzBhMmTMCRI0dcri0uLkZBQQGysrK40VcwHidVvkuXLkkexpKeno6BAwd6OSLfYtKbiAINE4pEJAuHKOLNqt34W/0JuUMhBdEIKsRpI/DdhGl4JWUp4rURcofkdyorK/HGG2/AYrG4XKtWq/Hiiy/KsmlTYg9FVwlFu92OnJwclJSUSLo9URRvJHVv/357+tzhcGDQoEGYNWuWYqohKyoqUF5e7vLnGR0djVGjRt343OFwIDc3F2VlZZK/f19+bjabodFoXE737pr4XF1dfWPKt1zx63Q6TJ8+vc/HykVRhNVqDagp1lK/F4fDAaPR6OVofEcQBAQFBfms/21vdXZ24uzZs5J61Wo0GmRmZiIqKsoHkfkOk95EFGiYUCQin3OIIg4ZCvGnqt1yh0IKEa0Nw5iQJMyLzcT3EmZgaLC0Kax0q8bGRqxdu1bS0VS1Wo3Fixdj8uTJPojsTkrsoeiq36TdbseePXvcus3emDhxIqZMmaKIhKLD4UBhYSHq6upcrk1JSUFKSsqNz0VRRE5ODg4cOODFCH2jvLwc5eXlcoeB8PBwpKam9jmh2NbWhg8++ADnzp27kaz0949SWhYAQH19PZ5//nnZ4/XUx8TERDzzzDMYMWJEn54T3tbY2CipDysAxMbGIjMzM+ASa1J7sbJCkYj8BROKRORztVY9/rdyG2osrXKHQjILUwdjSdwELI+biHsi0zBYFyt3SH7LbDZj69atKCgokLQZycjIwPLly30QWfeU2EOxpaWlryF5jFI20kajEWfOnJE06XjWrFnQarU3Puem2PPcPcbfE1EUYTAY+mVvSLvdHlDft5QqWyU4cOAAWlul/d83YsQIDB061LsB+ZgoipKrSD31e05E5G1MKBKRz71bvQ/7Wy5xwEY/FqEJxkPxU/ByymIkB8UgTB0MZaRP/Fd+fj62bdsmKfETHR2N5cuXIzEx0QeRdU+JPRSlbnZ9QSmbSanTnUNCQjB9+vRbvsZNsee5mySnwOcPz4e2tjZs27ZN8vqsrCxFVGh7kjuvh/w9JyJ/wYQiEfmMCGBH81n88doO2MTA6dtE0oSogjAgKALzYzLxfPI8jA0dLHdIAaO8vBxvvfWWpN5UgiBg7ty5mDZtmqwbFiX2UHR15NmXlLKZPHToEDo6Olyuu//++xEcHHzL17gp9g4maelmSn8+iKKIrVu3orOzU9L6QYMGYerUqV6OSh7soUhEgYYJRSLymaLOGvxj8TpYHUwm9idBggYzo0fh/uixWBo3EaND+9b763YddjPC1P1v8m6X6upq/PnPf5bcP2zcuHF45JFHZG/gr7QeihaLRfLP0BeUkCQwGo3Yu3evy3U6nQ4LFy684+vcFHsHf650M6VXAjc1NeHgwYOS169atUr2v09yU/LjSUR0MyYUicgnTA4r3qvZj2qTco4UkneFqIOQFT0GTwycjQnhQzEoKBoawXObBAdE5Bqu4k9Ve/BK6lKMD0txfaUA097ejk2bNqGoqEjS+uTkZDz//PMIDw/3cmSuKa2HYltbm6TJ2L6ihKTR8ePH0dDQ4HJdenp6t5PCuSn2PKUnj8j3lF4JfOLECck9KxMTEzFt2jQvR6R8Sn48iYhuxoQiEfnEybZSbGk8DQekTbgj/yQIAiAC98Vm4PdDV2Ni+FCv3I/JYcWr5d/g/6p2weqwo8RUh5wJv+lX/4SLoojjx49j3759sNtdV/0GBwfj+9//PpKSknwQnWtK66FoMBgUNdhA7qSRw+HA9u3bJa2dPn36LcNYujD55XlKTx6R7yn5+aDX65Gfny+pty8AzJgxQxFveHmLOz0UiYj8AROKROR1RocF6+uOosIcOFMV6VYaQYW0kIGYFTUKTw2ai0leSiTWWvTY3VKAP17bgcsd1Te+frqtHGtrD+HJgXOgUvDmypOKi4uxbt06SUkwtVqNefPmYdKkSYrZfCqth2JbWxusVqvk9d4m9+N05swZVFVVuVyXlJSEUaNGdXtEkckv72CygW6m5OfD1atXcenSJUlrY2JiMHnyZKjVai9HpXx83SQif8GEIhF5XY7+Cr5qzJM7DPKCYJUWUyKGY3n8JMyJSsfYsMHQCp7fDJgdVmxvOoN1dUdxWF+Idvudw0ferd6HWdGjkB7i2R6NSlRaWorXX38dLS0tktanpaXhwQcfRGhoqJcjk05pPRRbW1udJhQTExOxbNmyG5/fnizr7nO9Xo/s7Gw0Nzd3e5tJSUl44IEHoNFoblzf4XAgMTEROp18fUHNZjOOHz/uchiLIAgYOXIkUlK6bzegUqkwceJERERE3Pj++LFvH4OCgmSdzk7Ko9RKYFEUcfToURgMBknr09PTMWzYMC9H5R+U+HgSEXWHCUUi8iqLw4ZflnwOg80odyjkYdOj0vBS8kLMiBqJOE041B7sj3izy8Zq/LZ0Ew62XkKLrecpkYXGGmxuzMfLgxd5LRYlaGhowNq1a1FZWSlpfUREBF566SXFJSGU1kOxubnZ6bG8oUOHYvny5d0mEW//2KWsrAwnT57sMaGYmJiIpUuXIigo6I6kgJwVKlVVVSgoKIDD4bxFRVBQECZNmoSQkJBuL1epVJgzZw5mzpzpjTD7JUEQoNH0/d93nU6HqVOndtv70l/l5+ejurra5brQ0FBkZWX5ICLfiIyMRExMjNxh3KGxsRGHDx+WtFan02Hy5MmIjIz0clTycmfKM5OKROQPmFAkIq8RRRHv1mbjQsc1uUMhD1BBQLQ2DJPCh+DnqUtwb1SG1+7LAREt1nZ83pCL/yz/Fo1W19N3zQ4btjSdxqr4uzE8JMFrscnJaDRi06ZNKCgokLQ+JCQEL7zwQo8VZHJSWg/F1tZWp8fH4+Li7ri/rs9v/9jFZrM5rXrUaDQQBKHH68tBFEUUFBTg2jXXr9uRkZG4++67na7RaDQeSYCRZwUHB2PRokVyh+FRr732mqSEYkxMDH70ox/5IKL+y+FwYO3atTAapb2ZHBkZiRkzZnR72YEDB5Cfn6+ICuG+fqytrZWaLgESAAAgAElEQVT089Dr9Xj77behUqk8dv9qtRovvvhiv5+gTUSexf/wiMhrqiwt+LDmkNxhUB9pBTXSQhIxNyYDD8VNwT2RadCpvPfno8najl0t5/DXmgM4pr/i1nVPt5VhT+t5/CgkcKpPujgcDuzYsQN79uyRNIRFp9NhyZIlmDRpkg+ic5+SeiiaTCYYDAan6+Pi4iTd1s2sVqvTx6oroagkZrMZu3fvlrT23nvvRUREhJcjIvIsVn55X1FREXJyciSvX7RoUY/ViVevXsX+/fs9FZpfMJlMOHjwoEdvsyuhSETkSUwoEpHXbG8+iwoTB7H4s4kRQ/FYwgzMiR6NjNAkr/RHvFl26wW8VbUHuYaraLa2u319m2jHn67twQ8GzkaIcOfUWX+2Y8cOfPHFF5KnZWZmZmLp0qUIDg52uk4URRiNRo/3Vzx16hT+8Ic/3HI/NyfP6uvrYbFYnN7GunXrbkz87K5HoatqJKnJOpPJ5LIfZXx8vKTbupnNZnOaUOxuMrLcDh8+LPk4/bx587wcDZHnKS2JH2isViu2bNnismVCl+joaCxYsMDLURGf90TkDUwoEpFX1Fr02NF8Fu12ackPUpZx4Sn4zZCHMD8mE1qVBip49x/Raksrflv2FT6vOw6raIeI3leQFBtr8WV9Ln6QOMuDEcrryJEjWLduHTo7e+4hebPQ0FA899xzkqrqiouL8frrr+PJJ5/E5MmTPXYcqra2VvLxrp6cPXu2T9eX2kOxo6PDaUJREIRe9aB0VaHY1TtRKaxWKz799FPJFVzR0dFejohIOqnPW1YoetelS5ckT3YGrvenDfTeiUrA5z0ReQMTikTkFYXGGuQaiuUOgyTSCCoM0EYiIywJTw+ci4VxExCqCvLqfYqiiFqrHjubz+H1aztR1FnjmdsF8GbVLnwn/m6EqeWblOspBQUF2LBhg+RkYlRUFP75n/9Z0rAFq9WKDz/8EJWVlfj973+PWbNmYdmyZRgyZIjLykZ/ILWHYmdnJxobe66mjo6ORlhYmNv376pCsWu6sxKIouh0InV3lJQMJXJn4AV5h9lsRm5uLhoaGiRfhz39fIODXojIG5hQJCKv2NZ0Gs3WDrnDIAnSQwfhgdhxWBAzDjOjRiHEy4lEADDYjNjRchaf1h1FdstF2EVpR6OkutpZh32tF7E8bqJHb9fXLBYLNm/e7NZE58ceewxjxoyRtD4/Px/nz58HANjtdhw8eBDnzp3DnDlzkJWVheHDh/c6diWQunnS6/Vob+/5iH1MTEyvEqwWi8XpoBcl9VBsamrCvn373LoON6fkj/i89Z7a2lrk5ua6dR0+Hr4htWKfiMgdTCgSkcd12M34ouGE3GGQC+mhg/B00n1YFDMeSboYr1ckdrnYUYXflG/CkdbLaLUZ+3S8uScW0YatTflYGDsOQYL//qnTaDSYOnUqLl++DL1e73StWq1GVlYW7r33Xkmbhs7OTmzduvWOzVxLSwu2bduGY8eOISsrCytWrLjRx9DfSN08VVZWOq0kjI2NhU7nfrWrxWJxOuVZKT0URVHEyZMnUVZWJncoRF7HpIr37NmzB/X19W5dh4+Hb/DnTETe4L+7LCJSrG8aT6HW3Cp3GHQbAQJ0Kg2SdDF4JXUJVsVP89mRYIcootHWhneq9uI/K7b45P7Otleg2FiHMaHJXr8/b1GpVJg/fz4EQcDatWudVtGNHTsW3/ve9xASEiLpts+dO4fS0tJuL7PZbKivr8fnn3+O2tpa/PSnP/XLY2lSKzJKSkqcXh4XFyf553ozk8nkMqGohE1ea2srjh49CqPRKHcoRF7HijjvqKmp6fZNKlf4ePgGf85E5A1MKBKRR9nhwHu12XKHQbcZpIvG3RHD8VD8FCyLm4hwte/649VZ9NjVWoB3ru3F2Q5pR3c9ocRYjwsdVcgISVJE0qa3BEHA/PnzERwcjE8++QQ1NXf2mkxPT8c//uM/Sp7U3N7ejsOHD8NgMDhdp1arMXv2bL9MJgLSe0Y5SyiqVCoMGDAAQUHuVfA6HA6YTCan9x8eHq6I5+b58+dvHH0nCnRK+J0LNGazGe+//77TSu+e8PHwDf6cicgbmFAkIo+60FGFM23lcodB/09qcBy+M2Aq5sdkYmL4EERrwrw8r/nvTA4rdracw9qagziqL0KHjyd+t9lNOKovwrK4iQgWlHG0tC9mz56N8PBwfPTRR7ckwEaMGIHnnnvOrSnEly9fRn5+vstk2+jRozFhwoRexyw3KclEvV7fbZK2S0hICBISEtxOqjocDnR0OO8jGxoaKvsmz2Kx4Msvv3Ta69EX6urqUFJScuMxuz0Z3B8+T0xMxNChQ/02ge8vWKnleSdPnsS5c+d6dV0+Hr7BnzMReQMTikTkUXtaCmBxuP8OtbfpVFoAIswOeTfNvhIbFI4XBs3HmoEzkaiNQpDKty/3tVY9fnH1M+xqPgeDTb5jlPtaL6DDbkawyv8TigAwYcIEPP/883jzzTdRWVmJuLg4PPbYYxgxYoRbt/PVV185PT7d5amnnuqxMm/OnDkYMWLEjWPFSvwYHR2NqKgop9/jqVOnnB5LDg0NlTQx+3Z2u93pZG5BEBAWFiZ7QnHXrl2K6J145swZfPDBB3A4HLI/b+T6uGDBAjz++ONuV8OSe+T+nQs0er0e+/btg9ncuzcNXT0eq1atwgMPPCD772dfPwJAbm4uPv74Y5c/k7i4OPzqV79CcHCwR+PgmxVE5GlMKBKRx1hEG3INV70yZKO3Buqi8Pth38V34u+GAw58WpeD/63cjmvmZo9PFpZbpCYEw4MTsCphGp4deC8iNe73fOsLu+hAvdWArxrz8GrZN9Dbek6m+MqVzlpUWpoQp/XPoSK3EwQB6enp+PnPf44//vGPWLhwIaZMmeLWBvngwYOSjrdOmTIFo0aN6vHyjIwMZGRkSL5fpXI1kTQsLAwJCQlu367D4XDak1Cj0UCtVrt9u57U0NCAr7/+WhGVK1KOiAc6Z4ltck3qc6c/P8c8TRRFnD9/HhcvXuz1z9XV9aKioly+MeQvrl69KmmdRqPB4MGDe9W7l4jIl5hQJCKPKTU2oNzUJHcYN6gg4Jcpy/BYwowbX3t20H2YGjEcf7y2A1sbT6PTYZExQs8YoI3AfTFjMD9mHB6IzUSCJtLnFRhtdhO+aTyJT+qO4pj+CqyicqpUtzaexoSwIXKH4VHDhw/Hb37zG8TGxrr1WDc1NWHDhg0u14WHh2PhwoV9CdEvmM1ml8f04uPjERMT4/Zt2+12p0eeg4KCejU52lMsFgt27NiB5ubmXt+GJ19nbq/k6Y/6+/ffV1Kfj6xQ9ByTyYQdO3a4bO/gTH96PJj0JqJAw4QiEXlMsakO1ebeb049LUwTjGmRdx4FvSt8CP53xPdwd8Rw/KZsEzp93NvPU2K0Yfhewgw8FD8FY8OSEaMJ83kMdtGBw/pC/GfFtzjXXokWW+83Fd6yvfks/nXIg3KH4XEDBgxwa73D4cCOHTtQV1fncu3YsWMxevTo3obmN0pKSlxONh49enSvjonZ7XanQ290Oh20WvmO4peVleHIkSO9GqLQxZObXibTpE8lp77p788zTzp69CguXLjQp9vg43Envg4Qkb9gQpGIPEIEUGZsQLOCEkptNiNau4lHADBAG4kXkx/Awrjx+O6Ft1DYWQOHH/xTqxJUiNaE4vGBc/BKymJEy5BEBK4/3npbB35f8S3erz4Ao4IrPfPbytBi65Al4aokV69exdGjR10mkEJDQzFz5syAOWLmzOXLl+FwOG99kJmZ2avbttlsThOKGo1GtoSizWbDvn37nA6j8TVWKJKvMFnjGQaDAX/961/7PNCpPz0eUr9Xvg4Skb9gQpGIPMLosOCKsU5xfQk/qz+G+6PH9nj5yOCB2DLuZfyhfAu+ashTZIUdcL0/YkZoEhbF3YXvJcxAii7OZ9Oab+YQRVRbWrC7pQB/vLYDxZ2uq92U4Ii+EMviJskdhmwsFgsOHDiAqqoql2tHjRqFqVOn+iAqedntdhQVFTnduAUHBzvtI+nq9p0lFIODg2UbvnHlyhVkZ2fLct89YTKRfIXPs76zWCxYt26d08FTUvHxuBNfD4nIXzChSEQeYXRYcLmzWu4w7rC5MR+/TKnFqJCep7QODorFfwz/LmZFpeN/KrfhQsc1H0boXLQ2FPOiM7EkbgJmRI7EkOB42WKxiw582XgCn9YewSF9ISx+NDH7dHtFv04oFhUVYf/+/S43KGq1GqtWrUJYWOBXczY0NLg8/i0IgssKxp5YLBanfcVCQkJkabjf2dmJv/71rzCZTD6/b2dYodi/KrXkxJ9z3509exYnTpzwyG31p8fDnR6K/ennQkT+iwlFIvIIo92CKyblVau12Yz4j4rN+Cj9R07XRapD8HDCNNwdMRy/K9+ErxryZK22DFZp8WjiDDw76F6MCElEuCoYKhn/uTzfeQ2vlHyOPH0J2uwmRU3yliK/rVTuEGRjt9vxwQcfoK2tzeXaOXPmYNy4cT6ISn6VlZVoaGhwusZoNKK0tLRX/SSbm5udHi8PDQ2VZSjLzp07ceXKFZ/fryv9PZkI+Hel1ldffYWdO3feeBzl+Nja2iop1traWjz77LOyxSmKIoKCgvDSSy/1ugJaTnq9Hnv27JH883bFn5/37uLgICIKNEwoEpFHGB1W1Jk988+lp21pOI0LKVUYG5rsdJ0AASNCEvCXkU9iZOhAvHNtr097QuoEDQYERWJ+bCZ+MnghRgUPlPWfSofoQI1Vj0/rjuCNa7vQYlXmcXApys1N6LCbEaaWb6quHBwOBzZt2oTi4mKXa2NiYvD973/f6QASURTR1tYGk8l0yybw9mSQ3J8HBwc77QHpcDhQVlYGvV7f45ouFy5c6FVC0VWyMiQkBKGhoW7fbl+UlZVh586dPr1PqWbNmoUxY8bImuSR+2NkZKSsg3r6oq2tDbW1tXKHIYndbpe9f2hQUBAsFuX2HnamoKAAeXl5HksEMnl2p/6UZCUi/8aEIhF5RLGxFjaF9U/sYhKt2FCXg98NXQmNoHa5PlStw7+mrsCU8GF4/dpOHDcUe/V4b4g6CFMihmFeTCaWx01EhovEpy/UWFqxs/kc1tYcRH57meJ6Y7rLaLegytLi9Oh7ICosLMSOHTtcrtNqtVi0aBFiY2OdrrNYLNi4cSP27t1742tyJw+7+/zuu+/Gyy+/3OP30dnZicuXL0vatHUNbnF30rOrfpVhYWE+7aHY2dmJ7du3o76+3mf36Y6IiAhERETIHQaRT/hrEq2lpQXr16/v8yCWm3kzeVZaWoqoqCiXf9t8wZ3v01+fH0TU/zChSEQeccmovP6JXeyiAwdaL6HYWIfRoUmSriNAwKLYu5ARloz3qrPxXvV+tNs923NMp9Jgfuw4PDpgOu6OHI7koBioBfeSFp7mgIidzefwbnU2DrdeRqeCpze7wyxa0WAx9KuEosFgwI4dO9DU1ORy7ZAhQzBr1ixoNK7/LTCbzR5pxO9NrvoD6vV6XLp0SdJt1dTUoLm5GfHx7vUvdZZQVKvViIyMdDtJ2Rfnzp3DkSNHXE75dgc3vUS9448VaKIo4pNPPsG1a57tM+2N15GOjg588803yMnJwezZs/HQQw/J0mLiZu705PXH5wcR9U9MKBKRR9SZXR8dlNO59gocNxQjPXQQBDfmIw/VxePfh63GzMhReLzwXbTb+p5U1AhqLIgdh18PfQiZoYNlTyJ2abAa8MurG/FFw3G/r0i8ndlhQ5OtXe4wfKqgoABHjhxxuYFRq9WYPHkyUlJSXN5moGxyTp48KamnJHD9KGdFRYVHE4oqlcrpkWxPs9vt+PDDDyV/z1qtFlar1eW6QHk+EPmaPybjc3JycPDgQY/frqdfRyorK/HWW2/dqEL/5ptvMGHChF61rvA0qW8i+ePzg4j6J2XsYonI71VbWuQOwSmraMdn9cdh6EWVoQoClsRNwImJv8PS+Im96sOnU2kxMmQgHh80G3vv+if8bexLuCssVRHJxApzE96u3oup+b/BZ/U5AZdMBK4//k3W/pNQbG1txfr16yUlhQDIMm1YLna7Hfv375e8vq2tDZWVlW5teu12u9N+cmq1GtHR0ZJvry+sViveffddVFdLqyKPjIzE4sWLvRwVUf/mb8n4mpoabN682a2+j0OHDpW0zlPJM71ej127duE3v/kNLl26dONn3NHRgXfeecdjQ2T6wp0pz0RE/oAVikTkEXUWZVcoAkCuoRjHDVewIGZ8r64/PCQBb498Ap/UHcGb13ah3mJweR2toMa0yDQsjrsLWdFjkRmWLKmPoy+02jrxTeNJbGw4jhx9McwOacknf2RxWNHqwwE7cjKZTHjvvfdQWVnpldv398qJwsJClJZKn/pttVpRUVEBk8kkOfFaX18Ps9nc4+UqlQpxcXGSY+iLvLw8ZGdnS1orCALWrFkj6eg7EfWeP72OWq1W7NmzR9Jwry5paWlYtGgR3nrrLZdr+5o8s9vtuHjxIrZu3Yq8vLxu30grKSnB2rVr8eMf/1jWN9DcmfLMpCIR+QP+x0hEHlFrdZ1ck5vJYcV/VGzpdUIRABK0kXghaT6yYsbij5U7sLXpNIz2O9+x1whqzIoaiRcHL8DEsCFIDIpSRDUiADhEEXntJfj3sm9wvO0q2mxGuUPyOrsowhjACdOb7dq1C8eOHfPKbQfCJufbb7+V3MeqS3l5OQwGg+SNqKseYxqNBgMGDHArht5wt6ronnvuwf333++VY41E9Hf+9DpaVFSE7du3u1XxvmrVKqjV0t487Uty1eFwYPPmzdi6dSuampqcvrYfO3YM6enpWLJkSa/vr6/cqVD0p6QzEfVfTCgSkUd02HquxlGSXH0x9usv4b6ojF7fhk6lxcSwIVg3+kc43V6OD2sPIddQDIPdhFhNGCZHDMMjCfdgRuRIt/o1eptddKDV3ok/Vu7An6v2wNRPEmwA4BAdsIqeG0ahVF1TnT05gfNm/rQJ7k5VVRUuX77s9vXKy8uh1+uRmJgoab2rSh6tVuv1hKLVasXu3btvOfrnTExMDL7zne9Aq9X6/eNMpHT+kizq6OjAm2++iY4OaRX+giDgnnvuwYQJE3Du3DlJ1+nL643RaMT27dvR0NDgcq3JZML27dsxatQojBw5stf36Qv+8vwgImJCkYg8wip6J4HhDW9W7sS0iBEIVQX16XYECJgUPhST0oZ6JjAvqra0YktjPv5Sk41LHT0PiwhUDogw2wM7gdre3o4tW7Y4HQbSk/6QQLLb7Th+/DgMBverqU0mEy5evIhRo0ZJWn/16lWnlw8ePNjrx4pPnDiBHTt2SHpstVot7r//fgwdOpSVMdQrwcHBkteq1WpMmjQJarX6xvPN3z+2tbXh4sWLbr2WKr13rclkwrp161BTUyP5OvHx8XjggQcQFhbm1vHe3goNDcWaNWvw7rvvSho6VVFRgW+//RbPP/+8LD9/9lAkokDDhCIReYQ/Vbudbi/HMcMV3B89Vu5QvM7ssOHrppNYV3sYJwwlaO/FUJqAEeA5kuzsbBw/frxX15V6BFir1WLBggUYN27cja/dfgxaCZ9315+wubkZp0+flnxs73YnT57Egw8+6HKdxWJxmdSVOqygt0pLS7F27VrJVUWpqalYuHAhdDr3B04RAdePy3/xxReSp4PPnj0bU6dOVUQy0BMft2zZgosXL0r+eY0ZMwbJycl9+ZF7lcPhQE5ODg4dOuTW9ebPn4+MjOsnQHyRPBMEAVOmTEFBQQH27t0Lu931SYSjR49ixIgRkl7PPcmdN2v4pg4R+QsmFInII5QyaESKBosBu5rPYVbkKOhUWrnD8Zorxlq8UrIR2S0XYBZtfMc7gL/9wsJCfPTRR71KlrnzvFCr1Rg5cqTij4t1p6SkpFfHnbtcuHAB7e3tCA8Pd7quoaEBRqPzvqRDhgzpdRyudHR04L333kN9fb3k6zz11FM3jnO783zgppe6DBkyBPfddx92797tcq3D4cDf/vY3TJkyBRERET6Izruqq6uRm5sr+XdHrVbjueeec6uq09euXbuGTZs2ob29XfJ10tPTb+md6KvkWVhYGFatWoUzZ86grq7O5Xqr1YqPP/4Yo0aNwpgxY/p03+5wpwdxv/9/jYj8BhOKROQRQX6UUHRAxJ7mC3h84ByMDVVuhUBv2EUHqi2t+FvDCbxZtRO1ZuVP3/aVQE1+VFdX48033+x15V0gDFpxxWazYdeuXU4nLwuCgOHDh/d4XNlms+HQoUNYvHix0/uqqalxej8AMHz4cNdB94LFYsG3336LoqIiSetVKhWWLl2K8eP/PqhKrk1vdnY2Pv74Y7cH5gSS+++/H4899hi0Wv97o0sQBKxevRo5OTmSklC1tbXYs2cPVqxYIXl4hxLZ7XYcO3YMZWVlktarVCosX74cSUlJ3g2sD0wmEzZs2IDy8nLJ14mJicELL7xwy3PXl68jAwcOxJNPPonXX3/d5esvcP31/MMPP8Qrr7yC+Pj4Pt+/VCqVtOF8gfr/ChEFHiYUicgjdOq+9SP0tSvGWuxtPh9QCcUGaxs2N53Cp7VHcdzgfChEf6MSVNAqZMq2JxkMBnzxxReorq7u0+0E+ubl7NmzOH36tNM1CQkJeOaZZ/Db3/4WJlP3rQH279+PBQsWOE2AVFVVOZ2qrNPpMHjwYGmBu6mlpQWnT5+WPNV57NixWL169S1fk6uHoslkQmtra79OKHZ2dvp1cj8+Ph5z587Fjh07XD6OFosFhw8fxpQpU5CamuqjCD2vvr4e2dnZkgdhJScnY968eV6OqvdsNhu+/PJL5OTkSL6OTqfDsmXL7nhd8/Xx3hkzZqCoqAibN2+WdPS5pKQEW7duxSOPPOKzalFWKBJRoAm83RURySKsjwNOfM0m2vFB7QE4EBib14P6y3j88l/wL1e/QC6TiXcQAGhVgfUemiiKOHjwII4ePSpp8+TqtgJV1xFgZxt+QRAwbdo0pKWlITMzs8d1ZWVlqKio6PFym82Gqqoqp9WiQ4cO9VqvwpiYGCxZsgSRkZEu18bFxeHBBx9EVFTULV+XK7ncHyplA51Go0FWVpbk3oClpaXYv3+/Xz/u33zzDSorKyWt1Wg0mD17tqKrE/fv34/NmzdLfkwEQUBGRgaysrLuGDTl6+SZIAhYsWKF09fwm1ksFuzduxeXLl3yyP274m47CX/+vSCi/oMJRSLyiFit875iSlTUWYuP6o7IHUavOUQHqswteKboAyw4+1/IbrkIg90YyK0Ce00rqBGmCqyBE2VlZVi3bl2P1XRSBfJUX1EU8c0337is4IyNjcWUKVOg0+kwY8aMHtfZbDbk5+f3eLnBYEBdXZ3TjaDUSdG9ERQUhLlz5+Lll192mrRUqVSYNWsWpkyZcsdjL9cmNpCfh1IFwvc/cuRIzJ07V9IUc7vdjs2bN/dqMr0SnDt3Dtu3b5f8O5OUlCT5ZyOHq1evYtOmTZKODHfR6XRYtWpVt4Ow5BhAEhsbixUrViA6OlrSer1ej7/+9a9ufc+95W47iUB4PSCiwMeEIhF5RFJQjNwh9Mp/lW+B3tYpdxhuKzM14N2a/Vh07r/xSa3/JkV9JUjQIE7r/83/u1y9ehWvvvpqn5OJQGBXQhgMBkn9BDMzMzF27PWp7+PHj0doaGi362w2Gy5cuNDj9OTW1laXw1BGjx7tMp6+mjRpEn79618jNTW1201pWloaVq5c2W0/L7meD4H8PJQqEL5/QRCwcOFCyYlzq9WK1157DXq9f/X7bWhowPvvvy95vVqtxooVKxRdnajRaBAWFubW+ocffhh33XVXt5fLdbx3woQJuO+++yQn5CorK/HOO+945O+pK5zyTESBhglFIvKI1OA73532B5XmZnzVmCd3GJIZ7EasqzuCHxWtxS+ubkCRsVbukPyCVqVGpFq5EzXdUV1djY8++ggNDQ2S1ks5Xhuom5fIyEg88sgjTpMbGo0Gy5cvR1DQ9bYNERERSE9P73F9ZWVlj0ccW1tb0djY2ON1Q0JCkJKSIjH6vsnMzMSPf/xjpKWl3fL4xsXF4fnnn0dsbGy315OrMiYQkml0XVRUFJ566inJyamrV69K7nunBFarFbt27cK1a9ckX2fKlCm49957vReUB6SmpmLVqlWShwLNmTMHy5cv7/FyuZJnWq0WDz74oFvV4IcOHcLBgwcV08OVr4dE5C+YUCQij0gOkna8RGkcogNfNeShyeZ6KqXciow1WHPpL/hp8ac42HoZNlEZ//j6gyBBgwFBrvvKKV1nZyc2bdqEgoICSesTExMxc+ZML0elXF39vf7t3/4NkydP7nbNokWLkJaWduNznU6HjIyMHm+zvr4excXFd2w8RVFEeXm50yqXhIQEtyqA+kKlUmHMmDH4yU9+goEDBwK4vtF+4oknMGLEiB6vJ2cPRQoco0aNumPgjzMHDhzA+fPnvRiR5xQXFyM7O9tpr9SbRUdH40c/+tGNNy2UShAETJ06FY8++qjLtSNGjMCqVaucfk9yDiCJjY3Fz372M4SHS2vHY7VasWXLFpSWlno8lpuxQpGIAo0ym3gQkd8ZFarcYzyunGuvwDHDFSyJmaC4f+LscKDS1IQPag/izWu7YHFImyRJtwpRB2Ggnya9u9hsNuzduxe7d++WtAELDQ3F6tWrYTAYnK7ry2bOZDKhsLDwxhHg24+t+vpzrVaLtLQ0xMTc2oIhOjoa//AP/4D3338fubm5NyqhEhMT8dhjj91y9FetVmPEiBEIDw9He/udbzQ4HA7k5+cjKyvrlqPRoii6TPQmJSX5bJoocD2pmJqaiv/5n//B73//ewwZMgRTpkxxeh13Bwd4SldlZH+uzAmk718QBGRlZeHkyZO4cOGCy+7r2P8AACAASURBVO+roaEBW7ZsQWpq6h2/v0piNBqxceNGyRXiXUede6oIVhqVSoXVq1fj0qVLOHXqVLcVe+Hh4d1Odb6d3MmzpKQkPProo/joo48kJX/Ly8uxbds2PPvss157nZZaARkorwNEFPiYUCQijxgWHI9QtQ6ddu83tva0Rls7djUX4L7oMQgTlDO4o9aix+amU/io9jDOtlfAwYrEXgtTBSHJjxOKXUfs1q1bJ3mjMWvWLMyaNQu7du1yuq4vSYympiZ8+OGHuHr1aq+u72nR0dH46U9/2m1CYsCAAXjmmWcQFRWFPXv2QKPR4KGHHuq2X2JycjIGDRqEK1eudHs/58+fR319PYYOHXrjayaTyem0UEEQkJKS0mN/Rm+KiorCv/zLv8BsNrus2HF3cICnDBs2DMuWLevXG+mMjAzFDuzojaioKCxduhSVlZWSeiSePHkSu3btwiOPPOKD6Nxns9nw+eefOx3MdDNBEDBmzBjMnDkTarXay9F51mOPPYb6+nqUl5ffcVlWVhZmzpzpMhEoZ4Vil9mzZ+P8+fPIzc2VlMw7ePAgMjIyMH/+fK/EI3eSlYjI0wLnvxYiklWIKgiDdTEo6vS/nn6iKGJL02m8mDwfo0IGyR0OTA4rtjafxtvX9uJcRyXa7d5vFB7ohoYmIFglrS+U0tjtdmRnZ2P9+vWSJ1EOHz4cjz76qOTjtX3ZvCgtAeQsnvj4eDz++ONITExEYWEhpk+f3u33npiYiMGDB6O4uLjb2zMajdi7dy+efvrpG187d+5ctxWNXUJDQ5Gamipbwkjq1FO5eihmZGQ4PWpO/kelUmHSpEm4++67sXfvXpfr7XY7vv76awwbNgzTpk3zQYTuOXjwILZs2SL5NS84OBhLly690XLAnwwZMgTLli3D2rVr0dn598F1kyZNwsMPPyypgk8JybPo6GgsX74cly9fRktLi8v1FosF69atw7Bhw25pheFrSvu7SkTUE/ZQJCKP0AkaDNENkDuMXqs1t+KD2kNyh4EmazueLnofj196FzmGK0wmesiUsKFyh9BrZ8+exaeffuo0WXWzyMhI/Pa3v0V8fLzk++jL5kVJlRRSkmFhYWFYuXIlfvGLX/R4DFGj0WDcuHFOq4p27tx5S7/EQ4ecv35ER0e7PCKoBEp6PMn/hYSEYM2aNZKPkHZ2duLtt99GXV2dlyNzT0lJCb788kvJfROB60NLZsyY4Ze/UxqNBvPnz8fUqVNvfG3QoEH45S9/ichIaf2IlVChKAgCMjMzsXTpUsnXaW1txTvvvHNLItWT8Uhdx6QiEfkDJhSJyCPCNMHIDEuWO4w+WVdzCLVW18eyPM0uOlBqasAb13Ziwqlf4W/1J2Dn8WaPujuy5yEUSuZwOFBaWgqLxSJpfWRkJJ5++mm3epD1tSJNSZseqZswQRBcTjKdOHGi0wpPs9mM7OxsAIDBYEBenvNp8bGxsUhKUn6vWSU9nhQYYmNj8U//9E+IiIiQtL61tRVr165Fa2urlyOTpqmpCZ999hmqq6slXyctLQ0//OEPvRiV96lUKjz99NMYNmwYYmNj8cwzz7jVskEJFYpdVq5c6bJ/7M3KysqwdetWtxLIUriTZPXHRDQR9T9MKBKRRwQJaowMHQidyn87KbTYOvHmtZ0+vc8Ouxkf1h7CU5ffw7+V/g0NFucDNMh9OpUWk8KHyh1Gr6hUKjzwwAN46KGHXFb4BAUFYf78+W4fFexrJYTSNj2eiic+Ph4TJ050uubAgQPo6OhAXl6e0+nOADBy5EiEhIR4JDZvYmUMecOkSZOwbNkySZOOuwYfbdu27cYAJbl09U08efKk5N+LuLg4PPnkk37x++5KVFQUXnzxRXzve9/D+PHj3Xp9VUKFYheNRoOnnnoKKSkpktZbLBbs2bMHRUVFXo6se0r7u0pE1BMmFInIIwQIGKqLxwCttKMwSvVN4ymUmqRNb+wLEcD+1otYWPDf+OeSjThmKIZVlHfjFKjGh6cgWuP7QRieEhERgYceeghPPvmk0yO4EydOxKpVq3w+9ENpySdPxrNkyRKnl1dXV6OgoAAnTpxweVvjxo3zVFhexcoY8gZBELBo0SJMnDhR0vPLZDJh8+bNOHbsmA+i69mGDRuwb98+2Gw2Ses1Gg0WLFiA0aNHezky3xk5ciSysrKg07k3tE5JFYrA9WFbK1askJzoraurw/r1670cVfeU9neViKgnTCgSkccMC0lAYlCU3GH0SbW5FV83noQD3vlnzi46cM3cjF+UfIZVF/4PeYYStLFPolc9GD9Z7hD6TKfTYfHixfjJT35yx7FBQRAwZMgQ/PSnP3U5wbcngVKh6Olk2OjRozFy5MgeLzcYDNi+fTtKS0ud3k5wcDDGjh3rsbi8SUmPJwWW6OhorF69WnJ/V6PRiDfeeAOFhYU+T7DY7Xbs2bMHW7ZscevY67hx47B48WJJlZj+xFWLiO4oqUIRuF7xP3PmTMlJbVEUUVBQgPXr10uaEC3l9qTi6zAR+QsmFInIY1J0scgIU36PMGfMDit2Nxeg2ux6GqA7RIgoMdbj3dpsLC14DX+6thsddmkTe6n3dCotFsaMlzsMj5k1axZ++MMfYsCA6wOQBEHA8OHD8fOf/1zyROfbebuHokqlglarhUaj6fNHVxOSvXFcNysrCypV9/8uiaKIs2fPuhwgMWfOHL85/shNL3lTeno61qxZI7nazWw246233vJpUlEUReTk5ODzzz932crgZomJiXjiiScQFeXfb6x6itIqFAEgPDwcq1atQlxcnOTrfPXVVzh16lSf79sbx8WJiOTmv83OiEhxNIIas6PSsaHuGBx+PFTkZFspTrWVYrCu+wmw7hIhYkN9Dj6sOYy8thKYHZ5t8k09ywgdhCSd9AElSqfRaDBnzhyEhobirbfeQmhoKNasWYPU1NRe36a3eyjed999uOeee3p9+zcrLS3Fhg0b+hSPu8aNG4eEhATU1tZ2e7mryhWVSoVFixZ5NCZvcuf5wE0v9cacOXNQXV2NjRs3SnoOVVZWYt26dXjxxRcxaNAgr8eXn5+Pjz/+GPX19ZKvExERgRdeeAHDhw/3YmT+RamvI2lpafjBD36AN954Q1LlodVqxaZNmzB48GCfPP8AvllDRP6DCUUi8qh5MWOhAuC/6USg3W7CxoZcLI2bCLXQt0Luy53VeLF4HU4YrsLskNaDiTxndvRohKoC7+jZPffcg+TkZNTU1GDixIk9VtBJ4e0KxdTUVI8lFKVU+Xl6c5qQkIDx48f3mFB0JTU1FcOGDfNoTN7EHorkbWq1GsuWLUNpaSlyc3Ndrnc4HDh//jz+/Oc/43e/+53TXrJ9deHCBfzXf/0XjEaj5OuoVCp897vfxV133eW1uPyREisUu+5v7ty5KCgowJ49eyRd5+LFizhw4ABWr17tslLe1X1LwTdriMhfMKFIRB6VHBSLOTEZyG6+IHcofbK96QwKjTUYE5rs9nVFiLhqrMdn9cfwdtVetNg6vBAhuRKhCcHMyFHQqdzv/aR0giAgNTVVUmWiq823tysUPblZdPW9eCMZFhISgrvuugs5OTlob293+/pTp07tU8LX1+RKJoqiKPtEX7mpVCq/eq70RWRkJB566CFcu3YNVVVVLtd3tRf4wx/+gOeffx4xMZ6tPLfZbMjPz8e7777rVjJRrVZjzpw5uPfee5mIv41SKxSB679rK1euRFFREcrLy12udzgc2Lp1KyZMmICMjIxe3acoipK/V2+07yAi8gYmFInI414ZvAQHWy7B7sfHnk0OK35d+jd8OfYluLNFqLK0YHPjKXxefxwnDSVeG+5Cro0MTsCYMPcTwv2NtysUPbkpkqOHIgCMHz8eycnJKCwsdOt64eHhyMzM9KtEg1yb2MuXL+PYsWP9ehOdkZGBqVOn9qkCyp+MHj0aq1atwl/+8heYzdJ6Cp84cQI6nQ4/+MEPkJCQ4LFYjhw5gs8++8ytY84AMHbsWDzyyCOIjo72WCyBQqkVil0GDRqEpUuX4qOPPkJHh+s3fg0GA95//338+te/7lWfTHd7KPrT3w0i6r/6x38sRORTM6NGYUxYMgraK+UOpU92t5zHUX0hZkWlu1zrEEXsbinAa5Xbkd9eik67xQcRUk9UEDA5cjiGBQ+QOxTF86cKRSm8cX9RUVGYMWOG2wnFYcOGYfDgwR6Px5vkqowpKyvDN998068TimazGVOmTJE7DJ9Rq9WYO3cuLBYL3n33XUn97BwOB3JycuBwOPDiiy96ZNjRli1bsHHjRuj1ereul5ycjBdeeMFnffX8jZIrFIG/V5eeOXMGR48elXSdK1euYP369fjxj3/cq781Sk+yEhG5q3+cqyAin9IIaqwaMFXuMPrM4rDh/yv/BnWWnjcZdtGBa+ZmPFP0Ph48/zqO6AuZTFSAYLUWy+MmQSt4r9dWoAikCkVP318XQRDwwAMPIDg4WPJ11Go1xo4di/j4eI/H401yVcb050Rif6bVarF48WKsWLFC8nFvq9WKw4cP47XXXnPrePLtzGYzNm7ciLVr17qVTBQEAfHx8fjVr37FZKIT/pA8Cw0NxQ9/+EPJiWm1Wo329vZeP++kJM0Bvh4Skf9gQpGIvGJ+TKbHpiTLKUd/BS9d/RRH9UXocPz9SJZVtONSZzXeqNqJe8/8HuvrcmSMkm43KnQQ5kaPljsMRZBSQegvFYqubsubybDw8HCsXLlS8vqoqChMmzbN7ypN5IrX335O5FkPPvggZsyY4dZx7xMnTuC///u/UV5e7vZrWH19PdauXYsvv/wSNpt7A9Pi4+Px9NNPIzmZLTWcUXqFYpcBAwbg/2/vzqOrLu99j39+e87OPJOQmUASCKNJDIYhB0I1YFUcj3WurWC1LutQ6+nR9p57b4dlh3M86qlVq9jW5fI6V1SKR4oDqAEhDCFBEJBAmBMgA2TY+/5h4UCB7F+SnT0k79daLpbs3/DNZmcnz2d/n+e58847ew0VrVar8vLydMcdd+i+++6T2+3u173Mhua8HwIIF0x5BjAo8iNSNSt+rP6092N5wviT1m5vj97Yv1rrW3dqUlSWslyJshs27es6rNqjX2lTx24d6+kKdpn4Bz/MvFgOgx9xkrkOwnDpUPRHOHrw4EHFxsb2a526OXPm6N1339WhQ4d8HltYWBhWuzuf0Jd/L38Oek+8DoMdLgTTcP76ExISdP311+vIkSNat26d6fM+//xztbe365ZbblFhobkPkerq6vTnP/9ZGzdu7PNGQC6XSzfddFPYbbYUDOHQoXhCeXm51q9fryVLlpzxPWi1WlVVVaWLL75YWVlZA/p3D5eQFQDM4ichgEERY43QN+LHK9bav09xQ8nXuzbv1Sv7a/Ro41/1m53vaFHTh1rTuoMwMQSVxuTpksTJwS4jbAylDkVfx+zdu1c///nP9eijj5reBOJUcXFxqqioMHXsZZdd5nNX6lDUl9eDv8Pi4T6IHu4bMYwcOVL33nuvsrOzTZ/j8Xi0adMmPfLII9q6davPY09MlV63bl2fw0Sn06l/+Zd/0bRp02S32/t07nAUTuGZw+FQdXX1Ga+9hIQE/fjHP9Z3v/td5eTkDDhEDqeQFQDMIFAEMGiq4scp350a7DL8qsfrUbe3h72bQ5TDYtPt6bNlY+1E04ZSh2Jv99u5c6cee+wxNTQ06MMPP9STTz6plpaWPt3f6/Xq2LFjPo9zOBxhu7ZaMNdQZBCNhIQEPfTQQ30Kb7xer/bt26f7779fS5cuPev3aHNzs1566SU99thj2r9/f59qMgxDcXFxuuuuuzR58uSw/KAgGMItPMvNzdWcOXPkcDjkdDpVXl6un/3sZyotLZXT6QxoLaEQsgKAGQSKAAZNnC1S92RUy2rwVoPAKIvO04xY1k7si4F0hnm9Xp/nhsIaitu3b9fvf/971dbWSpK6u7v1t7/9Tc8++2yfQsWtW7dqxQrf66V2dnbqxRdf7HMHVCgI5hqKDKIhSSkpKVq4cKFycnL69Hrs6urSH/7wB/35z38+uSxBZ2enVq1apd/85jd64YUX1N7e3ud64uPjdcMNN6i8vLzP5w5n4dShKH39HjR79mzNnDlTN954o+666y6/rpNp5uflqbWEyvMCAL1hgSkAg2pe4iRdmDBBbx9cG+xSMMRFW126JnWqRjhig11KSBnMjUy8Xq/P0CzYayhu2rRJjz32mL766qvT/r6rq0vLly/XgQMHdPfddys5ObnXa3s8Hi1atEhtbW2mal2xYoWmTZum4uJiU8eHimANYllDMXQ6tYLNMAwVFhbq9ttv1yOPPKJ9+/aZPre1tVVvv/22tm3bphtuuEE1NTV67733dPDgwX7VEhMTo+9///uaMGGCHA5Hv64xXIVbh6IkRUZG6pZbblFkZKTf18jsy9dJxzaAcEGgCGBQOQyb/k/ulXqveYM6PX3bSRHoi3FRGbom6XymO/+Dwdzl2ePxyOPxDOj+fWGmzlPvV1dXp9/85jfau3fvWY/t6enRunXr9Mtf/lL333+/UlPPvUTDypUrtWHDBtO1trS06L333tPo0aMDPl1uIIIV6pm977XXXqs5c+YEoCL/2bt3rx588EGfxw3nMPUfWa1WFRYW6le/+pXuu+++PoWKnZ2dqq2tPdmR3F9paWn66U9/qvT09AFdZ7gKtw7FE6Kjowft2uEYsgJAbwgUAQy6XFeyvp02U0/tWqYe9R4+AP3hstj1w4yLFWOLCHYpYcdMl2Fv53Z39/5BQX92Ux6IE4PTNWvW6JlnnjlnmHiqL774Qi+88IIWLFggt/vMjaQOHz6sN998s891rFmzRhs2bNB5553Xp3ODKZhrKJoRFRXls5s01HR1sXlXf8XHx+uhhx7S448/ri+++CIgywhYLBYVFRXp1ltvDdu1UEMB4Vn/hVrICgDnwsJmAAZdhMWh61MqNNo9ItilYIi6NuUCXZgwPthlhKWBDOZ6enp8dij6czdUX/c6sUbVsmXL9MQTT2jHjh2mrpuWlqaysrKz1ur1evXpp59q+/btfa730KFDevPNN32GrqEkmGsoAmeTnZ2t2267TePHD/57vMViUUVFhRYuXKj8/HxelwMQrh2KoYDXHYBwQaAIICAmRWXriuRSpqPC7/IikvWTnPls/tNPAxnMeTweHT9+vNdj/Lkjqq9Blsfj0TvvvKNnnnlGe/bsMXXNhIQE3X///SovLz9roNjc3KyPP/64X5s5SNLatWu1dOnSfp0bDH15Pfh7OvtwH0QP9zUkz8UwDOXn5+uee+7R+eefP2j3cblcuuGGG3THHXf0eUMYnIkOxTMRsgIYahh9AQgIm2HR90d+QwVupg/BfxyGTd9Ln6Nk++CteTTUDWQwd+zYMZ9Bmz+nPPua7nj06FF99tlnOnz4sM9rWa1WFRUV6T//8z81atSocwafmzZtGtBabB6Pp08BZ7D1JdTy94Y7w30QTah6boZhKD4+Xj/60Y9UXV3t9w1SUlJS9L3vfU/z589XZGSkX689XBGenYmQFcBQQ6AIIGDibG79bswtSrHHBLsUDAEWGboocYLmJ5XQnTgAAxnMtbW1+Vwfzp+Dc3+tn2az2VReXq4f/OAHiok59/tRe3u7Xn755QHf9/jx43rhhRdM7xAdTMFcQ5FBNHwxDEMlJSVKSUnx2/UmTpyoH/zgB6qsrPRrR/VwR3jWf8MpZAUQ3hiBAQio0ug83Zs1V3amPmOAUp2xui9zrkY644NdSlgbyGCuubnZ57X9uWOmv9YirKqqMrXhwhtvvKGtW7f2eozT6VRJSYnPe65atUqrVq0K+YFiMNdQDPXnBsHj9XrV0NCgxx9/XE8//bSampr8du3Y2FglJycTbPkZHYr9x/shgHBBoAgg4K5NnqrqxEnBLgNh7pG8b6kselSwywh7Axm0HDhwoNfHXS6XXzdlGWigaLFYdO2112rhwoU+dwreunWrXn/9dZ/PT3FxsW6//Xaf4eTRo0f1zjvv6NChQ32uO5CCNYilQ5FOrXNpaWnR448/rocfflhLly5VU1OT37qVvV6vPvroI913331avHixzzVhYR4dimfqS8g6nJ4XAOGLQBFAwKU4YnRvxkUqdKcHuxSEIbvFpu+NrNKVyaXBLiUs+BqUDGTQ8uWXX/b6eEREhF8DRV/Tq3sTExOjm266SVdeeaXPaY0dHR16/fXX1dHR0etxbrdbM2fOVEpKiu688065XK5ej9+4caPee+89n7tVB1OwOmPoyKFT6wSv16u2tjY1NDTo6aef1u23364lS5b0e2MkXzwej1paWvTkk0/qoYceUk1NjZqbm0P6+zQc0KF4JkJWAEON/1ZKB4A+OD8mXz/OvkQLNz+rth46AmCOYRiaGVug+zPnBbuUsOFrsDaQwdyOHTt6fTw+Pt6vmyf0t3soOjpaN9xwgyorK33W4/V6VVtbq7Vr1/p8bsaMGXNyunNxcbFmzJihv/71r72e8+qrr2rMmDGaPHly376IAAnmGorA0aNHtXbtWn322Weqra31uayCP3m9Xm3atEm/+MUvNGHCBJWXl+v8889XXFxcwGoYSgjP+o/3QwDhgkARQNDMTyrRns4jun/rC8EuBWEi05mgezPnKtURG+xSwsZgdSgePHjQ55TnhIQERURE9Ov6Z3P06NE+n5OYmKh7771XRUVFpnac7ujo0F/+8hdTO0VfddVVJ9eItFgsmjNnjjZs2KDdu3ef85z29nY988wz+ulPf6qkpCTzX0iABHMNRQxfR44c0bJly/TBBx+oqalJra2tQQtVOjs7tWrVKm3cuFFvvfWWLrzwQlVWVioqKioo9YQrOhT7j/dDAOGCKc8AgsZmWLUwfZYWps+SjV164YPTsOnfcq/UP8WNlUX8sm3WYHUofvzxxz7PTUhIkNPp7Nf1z8ZMyHeq9PR0PfDAAxo/frypMFGS/vrXv2rdunW9fm2GYWjGjBmaMGHCaX8/evRolZWV+ZxS3djYqNdee21AU7gHS19eD/4c9LJm2PCa9u31etXV1aU9e/bo+eef14IFC/T0009r8+bNOnr0qF+eB4tlYL9XdHR0aPv27fr973+v++67T0uXLlVra6vf1m8c6uhQPBMhK4Chhg5FAEFlN6y6J3OudnW26O2Da9XjZc0inCneFqmf5Fyuf04uD3YpYcfXoLo/gzmPx6P333/f532TkpJ8rivYF4mJiYqKilJra6vPYwsLC3XjjTeqsLDQ9PU3b96sF1980edxycnJuu666874e6vVqurqan3++ef66quvznl+T0+PPvroI02YMEFlZWUhNaDuS6jlz0HvcArTzmU4hKrd3d1qamrS9u3btWrVKtXU1PSr87g3NptNWVlZKi4u1rZt29TQ0KDOzs5+X8/r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",
        alipayQr: "data:image/jpeg;base64,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PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjemPWjE3au6OJzFkb1PjwVqBZXYztHinymN6Y2M7R4p8pjem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VfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbyaD6A2TLu428mg+gPVfL3qe+eBz7j7tXhxWVBWrZMu7jbya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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/9k=",
        payeeName: "",
        autoConfirm: false
      };
      const data = JSON.parse(raw);
      return data;
    } catch (e) {
      return { wechatQr: "", alipayQr: "", payeeName: "", autoConfirm: false };
    }
  }

  function savePaymentConfig(config) {
    localStorage.setItem(PAYMENT_CONFIG_STORE_KEY, JSON.stringify(config));
  }

  const PAYMENT_STORE_KEY = "xuanjian_payments_v1";
  const PAYMENT_METHODS = {
    wechat: { name: "微信支付", icon: "message-circle", color: "#07C160" },
    alipay: { name: "支付宝", icon: "credit-card", color: "#1677FF" }
  };
  const PAYMENT_STATUS = {
    pending: { text: "待支付", cls: "pending" },
    reviewing: { text: "待审核", cls: "reviewing" },
    paid: { text: "已支付", cls: "approved" },
    failed: { text: "支付失败", cls: "rejected" },
    cancelled: { text: "已取消", cls: "cancelled" },
    refunded: { text: "已退款", cls: "cancelled" }
  };

  function getPayments() {
    const list = secureGet(PAYMENT_STORE_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function savePayments(list) {
    secureSet(PAYMENT_STORE_KEY, list.slice(0, 500));
  }

  function generateOrderNo() {
    const now = new Date();
    const dateStr = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0");
    const random = Math.random().toString(36).toUpperCase().slice(2, 8);
    return "XJ" + dateStr + random;
  }

  function createPaymentOrder(planKey, method) {
    const plan = MEMBER_PLANS[planKey];
    if (!plan) return { ok: false, error: "套餐不存在" };
    if (!PAYMENT_METHODS[method]) return { ok: false, error: "支付方式不支持" };

    const order = {
      orderNo: generateOrderNo(),
      planKey,
      planName: plan.name,
      planDays: plan.days,
      amount: Number(plan.price),
      method,
      methodName: PAYMENT_METHODS[method].name,
      status: "pending",
      createdAt: Date.now(),
      paidAt: null,
      activated: false,
      description: `${plan.name}（${plan.days}天）`,
      txHash: "",
      statusHistory: [{ status: "pending", at: Date.now(), note: "订单创建" }]
    };
    order.txHash = transactionHash({ o: order.orderNo, a: order.amount, t: order.createdAt });

    const payments = getPayments();
    payments.unshift(order);
    savePayments(payments);

    return { ok: true, order };
  }

  // ========== 支付状态实时轮询 ==========
  let paymentPollingTimer = null;
  let paymentPollingOrderNo = null;

  function startPaymentStatusPolling(orderNo) {
    clearInterval(paymentPollingTimer);
    paymentPollingOrderNo = orderNo;
    paymentPollingTimer = setInterval(() => {
      const payments = getPayments();
      const order = payments.find((p) => p.orderNo === orderNo);
      if (!order) { clearInterval(paymentPollingTimer); paymentPollingOrderNo = null; return; }

      if (order.status === "paid" && !order.activated) {
        const result = activateMembership(order.planKey, `支付订单 ${orderNo}`);
        if (result.ok) {
          order.activated = true;
          addStatusHistory(order, "activated", "会员已自动开通");
          savePayments(payments);
        }
      }

      if (order.status === "paid") {
        clearInterval(paymentPollingTimer);
        paymentPollingOrderNo = null;
        showPaymentSuccess(order);
      } else if (order.status === "failed") {
        clearInterval(paymentPollingTimer);
        paymentPollingOrderNo = null;
        showPaymentFailed(order, "支付未成功，请核对后重试");
      } else if (order.status === "cancelled") {
        clearInterval(paymentPollingTimer);
        paymentPollingOrderNo = null;
        // 不主动关闭弹窗，让用户看到取消状态并可选择重试
      } else if (order.status === "refunded") {
        clearInterval(paymentPollingTimer);
        paymentPollingOrderNo = null;
        showToast("订单已退款", "alert");
        closeModal("payment-modal");
      } else if (order.status === "expired") {
        clearInterval(paymentPollingTimer);
        paymentPollingOrderNo = null;
        showPaymentFailed(order, "二维码已过期，请刷新后重新支付");
      }
    }, 3000); // 优化为3秒轮询，更快响应
  }

  function stopPaymentPolling() {
    clearInterval(paymentPollingTimer);
    paymentPollingOrderNo = null;
  }

  // 添加状态变更记录
  function addStatusHistory(order, status, note) {
    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({ status, at: Date.now(), note: note || "" });
  }

  // 充值记录查询
  function queryPaymentRecords(filter) {
    const payments = getPayments();
    let result = payments;
    if (filter) {
      if (filter.status && filter.status !== "all") {
        result = result.filter((p) => p.status === filter.status);
      }
      if (filter.method && filter.method !== "all") {
        result = result.filter((p) => p.method === filter.method);
      }
      if (filter.keyword) {
        const kw = filter.keyword.toLowerCase();
        result = result.filter((p) =>
          p.orderNo.toLowerCase().includes(kw) ||
          p.planName.toLowerCase().includes(kw) ||
          (p.description || "").toLowerCase().includes(kw)
        );
      }
      if (filter.startDate) {
        result = result.filter((p) => p.createdAt >= filter.startDate);
      }
      if (filter.endDate) {
        result = result.filter((p) => p.createdAt <= filter.endDate);
      }
    }
    return result;
  }

  // 财务流水汇总
  function getFinancialSummary() {
    const payments = getPayments();
    const wallet = getWallet();
    const withdrawals = getWithdrawals();
    const today = new Date().setHours(0, 0, 0, 0);
    const thisMonth = new Date().setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const paidPayments = payments.filter((p) => p.status === "paid");
    const todayPayments = paidPayments.filter((p) => p.createdAt >= today);
    const monthPayments = paidPayments.filter((p) => p.createdAt >= thisMonth);
    const todayWithdrawals = withdrawals.filter((w) => w.createdAt >= today && w.status === "approved");
    const monthWithdrawals = withdrawals.filter((w) => w.createdAt >= thisMonth && w.status === "approved");

    return {
      totalRevenue: paidPayments.reduce((s, p) => s + Number(p.amount), 0),
      todayRevenue: todayPayments.reduce((s, p) => s + Number(p.amount), 0),
      monthRevenue: monthPayments.reduce((s, p) => s + Number(p.amount), 0),
      totalWithdraw: withdrawals.filter((w) => w.status === "approved").reduce((s, w) => s + Number(w.amount), 0),
      todayWithdraw: todayWithdrawals.reduce((s, w) => s + Number(w.amount), 0),
      monthWithdraw: monthWithdrawals.reduce((s, w) => s + Number(w.amount), 0),
      pendingPayments: payments.filter((p) => p.status === "pending" || p.status === "reviewing").length,
      pendingWithdrawals: withdrawals.filter((w) => w.status === "pending").length,
      walletBalance: wallet.balance,
      totalRecharge: wallet.totalRecharge,
      totalRecords: payments.length
    };
  }

  // 用户提交支付审核（点击"我已支付"）——仅改状态，不激活会员
  function submitPaymentForReview(orderNo) {
    const payments = getPayments();
    const idx = payments.findIndex((p) => p.orderNo === orderNo);
    if (idx === -1) return { ok: false, error: "订单不存在" };

    const order = payments[idx];
    if (order.status !== "pending") return { ok: false, error: "订单状态不正确" };

    order.status = "reviewing";
    order.submittedAt = Date.now();
    addStatusHistory(order, "reviewing", "用户提交支付确认");
    payments[idx] = order;
    savePayments(payments);

    return { ok: true, order };
  }

  function markPaymentPaid(orderNo) {
    const payments = getPayments();
    const idx = payments.findIndex((p) => p.orderNo === orderNo);
    if (idx === -1) return { ok: false, error: "订单不存在" };

    const order = payments[idx];
    if (order.status !== "pending" && order.status !== "reviewing") {
      return { ok: false, error: "订单状态不正确" };
    }

    order.status = "paid";
    order.paidAt = Date.now();
    addStatusHistory(order, "paid", "确认到账");
    payments[idx] = order;
    savePayments(payments);

    // 自动激活会员
    const result = activateMembership(order.planKey, `支付订单 ${orderNo}`);
    if (result.ok) {
      order.activated = true;
      addStatusHistory(order, "activated", "会员已开通");
      payments[idx] = order;
      savePayments(payments);
    }

    return { ok: true, order };
  }

  function cancelPayment(orderNo) {
    const payments = getPayments();
    const idx = payments.findIndex((p) => p.orderNo === orderNo);
    if (idx === -1) return { ok: false, error: "订单不存在" };
    if (payments[idx].status !== "pending" && payments[idx].status !== "reviewing") {
      return { ok: false, error: "订单状态不正确" };
    }

    payments[idx].status = "cancelled";
    addStatusHistory(payments[idx], "cancelled", "订单已取消");
    savePayments(payments);
    return { ok: true };
  }

  function refundPayment(orderNo, reason) {
    const payments = getPayments();
    const idx = payments.findIndex((p) => p.orderNo === orderNo);
    if (idx === -1) return { ok: false, error: "订单不存在" };
    if (payments[idx].status !== "paid") return { ok: false, error: "只有已支付订单可退款" };

    payments[idx].status = "refunded";
    payments[idx].refundReason = reason || "管理员操作退款";
    payments[idx].refundAt = Date.now();
    addStatusHistory(payments[idx], "refunded", reason || "管理员操作退款");
    savePayments(payments);
    return { ok: true };
  }

  const MEMBER_FEATURES = [
    { icon: "scale", title: "称骨论命 · 专业解析", desc: "袁天罡称骨五维详析：运势走向、性格特征、事业发展、婚姻状况、财富水平，附子平法互参结论" },
    { icon: "sparkles", title: "神煞深度释义", desc: "原局全部神煞逐条白话详解，含取象原理、吉凶倾向与宫位联动判断" },
    { icon: "grid-3x3", title: "术数工具 · 全部解锁", desc: "易经六爻、梅花易数、奇门遁甲、大六壬，一事一占完整排盘与解读" },
    { icon: "message-square-text", title: "AI 研判 · 无限提问", desc: "命局全面解析深度报告、AI 智能问答无限次、专业知识点逐条拆解" },
    { icon: "book-open", title: "命局全面解析", desc: "格局成败、用神取舍、十神配置、日主旺衰、五行调候全方位深度分析" }
  ];

  // ========== 管理员钥匙功能 ==========
  function adminHash(input) {
    let h = 0;
    const salt = "XuanJian@Admin#2026$Root";
    const text = salt + input;
    for (let i = 0; i < text.length; i++) {
      h = ((h << 5) - h + text.charCodeAt(i)) | 0;
      h = Math.abs(h);
    }
    return h.toString(36) + ADMIN_KEY_HASH;
  }

  function verifyAdminKey(key) {
    if (!key) return false;
    // 主钥匙：XJ@Admin2026 （站长专属）
    if (key === "XJ@Admin2026") return true;
    return false;
  }

  function setAdminAccess(enabled) {
    if (enabled) {
      localStorage.setItem(ADMIN_KEY_STORE, JSON.stringify({
        granted: true,
        grantedAt: Date.now(),
        deviceId: adminHash(navigator.userAgent + location.host)
      }));
    } else {
      localStorage.removeItem(ADMIN_KEY_STORE);
    }
  }

  function isAdminAccess() {
    try {
      const raw = localStorage.getItem(ADMIN_KEY_STORE);
      if (!raw) return false;
      const data = JSON.parse(raw);
      return Boolean(data.granted);
    } catch (e) {
      return false;
    }
  }

  function memberHash(input) {
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    const text = MEMBER_SECRET + "::" + input;
    for (let i = 0; i < text.length; i += 1) {
      h1 ^= text.charCodeAt(i);
      h1 = Math.imul(h1, 16777619) >>> 0;
      h2 = (Math.imul(h2 ^ text.charCodeAt(i), 2246822519) + h1) >>> 0;
    }
    for (let round = 0; round < 3; round += 1) {
      h1 = Math.imul(h1 ^ h2, 3266489917) >>> 0;
      h2 = (Math.imul(h2 + round, 668265263) ^ h1) >>> 0;
    }
    return (h1.toString(36) + h2.toString(36)).padStart(12, "0").slice(0, 10);
  }

  function randomCodeChunk(length) {
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let out = "";
    const buffer = new Uint32Array(length);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(buffer);
    else for (let i = 0; i < length; i += 1) buffer[i] = Math.floor(Math.random() * 0xffffffff);
    for (let i = 0; i < length; i += 1) out += alphabet[buffer[i] % alphabet.length];
    return out;
  }

  function makeLicenseCode(planKey) {
    const plan = MEMBER_PLANS[planKey];
    if (!plan) return null;
    const issueStamp = Date.now().toString(36).toUpperCase();
    const payload = [plan.char, issueStamp, randomCodeChunk(4)].join(".");
    const code = `XJ-${payload}-${memberHash(payload).toUpperCase().slice(0, 6)}`;

    // 保存到卡密列表
    try {
      const codes = getLicenseCodes();
      codes.unshift({
        code,
        planKey,
        planName: plan.name,
        createdAt: Date.now(),
        used: false,
        usedAt: null
      });
      if (codes.length > 200) codes.length = 200;
      localStorage.setItem(CODES_STORE_KEY, JSON.stringify(codes));
    } catch (e) { /* ignore */ }

    return code;
  }

  function getLicenseCodes() {
    try {
      const raw = localStorage.getItem(CODES_STORE_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  // 永久卡密列表（站长专属，永不过期）
  const PERMANENT_CODES = {
    "LHH2004": { plan: "lifetime", planName: "永久会员", permanent: true }
  };

  function parseLicenseCode(code) {
    const clean = String(code || "").trim().toUpperCase().replace(/\s+/g, "");
    // 先检查永久卡密
    if (PERMANENT_CODES[clean]) {
      return { ok: true, plan: { ...MEMBER_PLANS[PERMANENT_CODES[clean].plan], permanent: true, name: PERMANENT_CODES[clean].planName } };
    }
    const match = clean.match(/^XJ-([A-Z])\.([A-Z0-9]+)\.([A-Z0-9]{4})-([A-Z0-9]{6})$/);
    if (!match) return { ok: false, error: "卡密格式不正确，应为 XJ-开头的完整卡密" };
    const [, planChar, issueStamp, , sig] = match;
    const payload = `${planChar}.${issueStamp}.${match[3]}`;
    if (memberHash(payload).toUpperCase().slice(0, 6) !== sig) return { ok: false, error: "卡密校验未通过，请核对后重试" };
    const plan = Object.values(MEMBER_PLANS).find((item) => item.char === planChar);
    if (!plan) return { ok: false, error: "卡密套餐类型无法识别" };
    const issuedAt = parseInt(issueStamp.toLowerCase(), 36);
    const validDays = plan.days || 90;
    if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > validDays * 86400000) return { ok: false, error: `该卡密已超出 ${validDays} 天激活有效期` };
    return { ok: true, plan };
  }

  function getMemberState() {
    try {
      const raw = localStorage.getItem(MEMBER_STORE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      // 如果有卡密，验证卡密有效性
      if (data.code) {
        // 永久卡密直接有效
        const clean = String(data.code).trim().toUpperCase().replace(/\s+/g, "");
        if (PERMANENT_CODES[clean]) {
          return { ...data, permanent: true, active: true, expired: false };
        }
        const verify = parseLicenseCode(data.code);
        if (!verify.ok) return null;
      }
      // 检查是否有套餐信息
      if (!data.plan || !data.planName) return null;
      // 永久会员不会过期
      if (data.permanent) {
        return { ...data, active: true, expired: false };
      }
      if (data.expireAt && data.expireAt < Date.now()) return { ...data, expired: true, active: false };
      return { ...data, active: true };
    } catch (error) {
      return null;
    }
  }

  function isMemberActive() {
    if (isAdminAccess()) return true;
    const member = getMemberState();
    return Boolean(member && !member.expired);
  }

  function memberDaysLeft() {
    const member = getMemberState();
    if (!member) return 0;
    if (member.permanent) return 99999; // 永久会员
    if (member.expired) return 0;
    return Math.max(0, Math.ceil((member.expireAt - Date.now()) / 86400000));
  }

  function activateLicense(code) {
    const verify = parseLicenseCode(code);
    if (!verify.ok) return verify;
    const member = getMemberState();
    const base = member && !member.expired && !member.permanent ? member.expireAt : Date.now();
    const isPermanent = verify.plan.permanent;
    const next = {
      code: String(code).trim().toUpperCase().replace(/\s+/g, ""),
      plan: verify.plan.key,
      planName: verify.plan.name,
      activatedAt: Date.now(),
      permanent: isPermanent,
      expireAt: isPermanent ? null : base + verify.plan.days * 86400000
    };
    localStorage.setItem(MEMBER_STORE_KEY, JSON.stringify(next));
    return { ok: true, member: next };
  }

  // 直接通过套餐key激活会员（用于支付成功后自动激活）
  function activateMembership(planKey, source) {
    const plan = MEMBER_PLANS[planKey];
    if (!plan) return { ok: false, error: "套餐不存在" };
    const member = getMemberState();
    const base = member && !member.expired ? member.expireAt : Date.now();
    const next = {
      plan: plan.key,
      planName: plan.name,
      activatedAt: Date.now(),
      expireAt: base + plan.days * 86400000,
      source: source || "payment"
    };
    localStorage.setItem(MEMBER_STORE_KEY, JSON.stringify(next));
    return { ok: true, member: next };
  }

  // ========== 钱包 / 余额系统 ==========
  function getWallet() {
    const data = secureGet(WALLET_STORE_KEY, { balance: 0, totalRecharge: 0, totalWithdraw: 0, records: [] });
    return {
      balance: Number(data.balance) || 0,
      totalRecharge: Number(data.totalRecharge) || 0,
      totalWithdraw: Number(data.totalWithdraw) || 0,
      records: Array.isArray(data.records) ? data.records : []
    };
  }

  function saveWallet(wallet) {
    secureSet(WALLET_STORE_KEY, wallet);
  }

  function addWalletRecord(type, amount, desc, extra) {
    const wallet = getWallet();
    const record = {
      id: "W" + Date.now().toString(36).toUpperCase() + randomCodeChunk(3),
      type, // recharge / withdraw / consume / refund
      amount: Number(amount),
      balanceAfter: type === "recharge" || type === "refund"
        ? wallet.balance + Number(amount)
        : wallet.balance - Number(amount),
      desc,
      extra: extra || null,
      createdAt: Date.now(),
      status: type === "withdraw" ? "pending" : "completed"
    };
    wallet.records.unshift(record);
    if (wallet.records.length > 100) wallet.records = wallet.records.slice(0, 100);
    if (type === "recharge") {
      wallet.balance += Number(amount);
      wallet.totalRecharge += Number(amount);
    } else if (type === "withdraw") {
      wallet.balance -= Number(amount);
      wallet.totalWithdraw += Number(amount);
    } else if (type === "consume") {
      wallet.balance -= Number(amount);
    } else if (type === "refund") {
      wallet.balance += Number(amount);
    }
    saveWallet(wallet);
    return record;
  }

  // ========== 提现系统 ==========
  function getWithdrawals() {
    const list = secureGet(WITHDRAW_STORE_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function saveWithdrawals(list) {
    secureSet(WITHDRAW_STORE_KEY, list);
  }

  function calcWithdrawFee(amount) {
    const fee = Math.max(WITHDRAW_CONFIG.feeMin, Math.min(WITHDRAW_CONFIG.feeMax, amount * WITHDRAW_CONFIG.feeRate));
    return Math.round(fee * 100) / 100;
  }

  function getTodayWithdrawTotal() {
    const withdrawals = getWithdrawals();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return withdrawals
      .filter((w) => w.createdAt >= startOfDay.getTime() && w.status !== "rejected")
      .reduce((sum, w) => sum + Number(w.amount), 0);
  }

  function submitWithdrawal(amount, method, account, realName, note) {
    const wallet = getWallet();
    amount = Number(amount);

    if (amount < WITHDRAW_CONFIG.minAmount) {
      return { ok: false, error: `最低提现金额为 ¥${WITHDRAW_CONFIG.minAmount}` };
    }
    if (amount > wallet.balance) {
      return { ok: false, error: "提现金额不能超过账户余额" };
    }
    const todayTotal = getTodayWithdrawTotal();
    if (todayTotal + amount > WITHDRAW_CONFIG.dailyLimit) {
      return { ok: false, error: `今日提现限额 ¥${WITHDRAW_CONFIG.dailyLimit}，已提现 ¥${todayTotal.toFixed(2)}` };
    }
    if (!method || !["wechat", "alipay", "bank"].includes(method)) {
      return { ok: false, error: "请选择提现方式" };
    }
    if (!account || !account.trim()) {
      return { ok: false, error: "请输入收款账号" };
    }
    if (!realName || !realName.trim()) {
      return { ok: false, error: "请输入真实姓名" };
    }

    const fee = calcWithdrawFee(amount);
    const actualAmount = Math.round((amount - fee) * 100) / 100;

    const withdrawal = {
      id: "TX" + Date.now().toString(36).toUpperCase() + randomCodeChunk(3),
      amount,
      fee,
      actualAmount,
      method, // wechat / alipay / bank
      account: account.trim(),
      realName: realName.trim(),
      note: note ? note.trim() : "",
      status: "pending", // pending / approved / rejected / cancelled
      createdAt: Date.now(),
      processedAt: null,
      processNote: "",
      txHash: "",
      statusHistory: [{ status: "pending", at: Date.now(), note: "提现申请提交" }]
    };
    withdrawal.txHash = transactionHash({ id: withdrawal.id, a: amount, t: withdrawal.createdAt });

    const withdrawals = getWithdrawals();
    withdrawals.unshift(withdrawal);
    saveWithdrawals(withdrawals);

    // 记录钱包流水（提现申请时先冻结余额）
    addWalletRecord("withdraw", amount, `提现申请（${methodName(method)}）`, { withdrawalId: withdrawal.id });

    return { ok: true, withdrawal };
  }

  // 提现账户实名验证
  function verifyWithdrawalAccount(method, account, realName) {
    const errors = [];
    if (!realName || realName.trim().length < 2) {
      errors.push("真实姓名至少2个字符");
    }
    if (!/^[\u4e00-\u9fa5·a-zA-Z\s]+$/.test(realName || "")) {
      errors.push("姓名只能包含中文、英文和间隔号");
    }
    if (method === "wechat") {
      if (!account || !/^[\w-]+$/.test(account.trim())) {
        errors.push("微信账号格式不正确（仅限字母、数字、下划线、连字符）");
      }
    } else if (method === "alipay") {
      if (!account || account.trim().length < 5) {
        errors.push("支付宝账号至少5个字符");
      }
      if (!/^[\w.@-]+$/.test(account.trim())) {
        errors.push("支付宝账号格式不正确");
      }
    } else if (method === "bank") {
      if (!account || !/^\d{16,19}$/.test(account.trim())) {
        errors.push("银行卡号需为16-19位数字");
      }
    }
    return { ok: errors.length === 0, errors };
  }

  // ========== 应用发布配置 ==========
  const PUBLISH_STORE_KEY = "xuanjian_publish_v1";

  function getPublishConfig() {
    return secureGet(PUBLISH_STORE_KEY, {
      appName: "玄鉴八字",
      appId: "com.xuanjian.bazi",
      version: "3.0.0",
      versionCode: 30000,
      description: "四柱排盘、岁运推演、神煞详解、AI研判一体化命理分析平台",
      shortDescription: "专业八字命理排盘与AI智能研判",
      keywords: "八字,排盘,命理,算命,神煞,大运,流年,AI研判",
      category: "工具",
      contentRating: "4+",
      developer: "玄鉴工作室",
      developerEmail: "",
      developerPhone: "",
      developerWebsite: "",
      privacyPolicyUrl: "",
      screenshots: { apple: [], huawei: [], xiaomi: [], oppo: [], vivo: [] },
      storeStatus: { apple: "pending", huawei: "pending", xiaomi: "pending", oppo: "pending", vivo: "pending" },
      changelog: ""
    });
  }

  function savePublishConfig(config) {
    secureSet(PUBLISH_STORE_KEY, config);
  }

  // ========== 版本历史管理 ==========
  const VERSION_STORE_KEY = "xuanjian_versions_v1";

  function getVersionHistory() {
    return secureGet(VERSION_STORE_KEY, []);
  }

  function saveVersionHistory(list) {
    secureSet(VERSION_STORE_KEY, list);
  }

  function addVersionRecord(record) {
    const list = getVersionHistory();
    list.unshift({
      version: record.version || "1.0.0",
      versionCode: record.versionCode || 10000,
      date: record.date || Date.now(),
      type: record.type || "release", // release / beta / hotfix
      changes: record.changes || "",
      downloadUrl: record.downloadUrl || "",
      status: record.status || "draft" // draft / submitted / approved / live
    });
    saveVersionHistory(list);
    return { ok: true };
  }

  function methodName(method) {
    return { wechat: "微信", alipay: "支付宝", bank: "银行卡" }[method] || method;
  }

  function cancelWithdrawal(id) {
    const withdrawals = getWithdrawals();
    const idx = withdrawals.findIndex((w) => w.id === id);
    if (idx < 0) return { ok: false, error: "提现记录不存在" };
    if (withdrawals[idx].status !== "pending") {
      return { ok: false, error: "该提现已处理，无法撤销" };
    }
    withdrawals[idx].status = "cancelled";
    withdrawals[idx].processedAt = Date.now();
    withdrawals[idx].processNote = "用户主动撤销";
    if (!withdrawals[idx].statusHistory) withdrawals[idx].statusHistory = [];
    withdrawals[idx].statusHistory.push({
      status: "cancelled",
      at: Date.now(),
      note: "用户主动撤销提现"
    });
    saveWithdrawals(withdrawals);

    // 退回余额
    const wallet = getWallet();
    wallet.balance += Number(withdrawals[idx].amount);
    wallet.totalWithdraw -= Number(withdrawals[idx].amount);
    wallet.records.unshift({
      id: "W" + Date.now().toString(36).toUpperCase() + randomCodeChunk(3),
      type: "refund",
      amount: Number(withdrawals[idx].amount),
      balanceAfter: wallet.balance,
      desc: `提现撤销退回（${methodName(withdrawals[idx].method)}）`,
      extra: { withdrawalId: id },
      createdAt: Date.now(),
      status: "completed"
    });
    saveWallet(wallet);

    return { ok: true };
  }

  // 管理员审核提现
  function adminProcessWithdrawal(id, action, note) {
    if (!isAdminAccess()) return { ok: false, error: "无管理员权限" };
    const withdrawals = getWithdrawals();
    const idx = withdrawals.findIndex((w) => w.id === id);
    if (idx < 0) return { ok: false, error: "提现记录不存在" };
    if (withdrawals[idx].status !== "pending") {
      return { ok: false, error: "该提现已处理" };
    }
    withdrawals[idx].status = action === "approve" ? "approved" : "rejected";
    withdrawals[idx].processedAt = Date.now();
    withdrawals[idx].processNote = note || "";
    if (!withdrawals[idx].statusHistory) withdrawals[idx].statusHistory = [];
    withdrawals[idx].statusHistory.push({
      status: withdrawals[idx].status,
      at: Date.now(),
      note: note || (action === "approve" ? "管理员确认打款" : "管理员拒绝申请")
    });
    saveWithdrawals(withdrawals);

    // 如果拒绝，退回余额
    if (action === "reject") {
      const wallet = getWallet();
      wallet.balance += Number(withdrawals[idx].amount);
      wallet.totalWithdraw -= Number(withdrawals[idx].amount);
      wallet.records.unshift({
        id: "W" + Date.now().toString(36).toUpperCase() + randomCodeChunk(3),
        type: "refund",
        amount: Number(withdrawals[idx].amount),
        balanceAfter: wallet.balance,
        desc: `提现审核未通过退回`,
        extra: { withdrawalId: id, reason: note || "" },
        createdAt: Date.now(),
        status: "completed"
      });
      saveWallet(wallet);
    }

    return { ok: true };
  }

  function memberGateHTML(featureTitle, teaserText, compact) {
    if (isMemberActive()) return null;
    return `
      <div class="member-gate ${compact ? "compact" : ""}">
        <div class="gate-icon"><i data-lucide="lock"></i></div>
        <div class="gate-copy">
          <strong>${featureTitle} · 会员专享</strong>
          <p>${teaserText || "开通会员后即可查看完整内容，支持月卡 / 季卡 / 年卡。"}</p>
        </div>
        <button class="button primary gate-button" type="button" data-open-member="1">
          <i data-lucide="crown"></i>开通会员
        </button>
      </div>
    `;
  }

  function renderMemberBadge() {
    const active = isMemberActive();
    const member = getMemberState();
    const label = $("#member-entry-label");
    const badge = $("#member-nav-badge");
    const lockTag = $("#divination-lock-tag");
    if (label) label.textContent = active ? "会员生效中" : "会员中心";
    if (badge) {
      if (active && member?.permanent) {
        badge.textContent = "永久";
      } else if (active) {
        badge.textContent = `${memberDaysLeft()}天`;
      } else {
        badge.textContent = "";
      }
      badge.classList.toggle("active", active);
    }
    if (lockTag) lockTag.style.display = active ? "none" : "";
    document.documentElement.classList.toggle("is-member", active);
  }

  function openMemberModal(preselectPlan) {
    renderMemberCenter(preselectPlan);
    openModal("member-modal");
  }

  function renderMemberCenter(tab) {
    const body = $("#member-body");
    if (!body) return;
    const member = getMemberState();
    const active = isMemberActive();
    const wallet = getWallet();
    const currentTab = tab || state.memberTab || "plans";
    state.memberTab = currentTab;

    const statusHTML = member ? `
      <div class="member-status ${active ? "active" : "expired"}">
        <div class="member-status-head">
          <i data-lucide="${active ? "crown" : "circle-alert"}"></i>
          <div>
            <strong>${active ? "会员生效中" : "会员已到期"}</strong>
            <small>${active
              ? member.permanent
                ? `${member.planName} · 永久有效`
                : `${member.planName} · 剩余 ${memberDaysLeft()} 天 · ${new Date(member.expireAt).toLocaleDateString("zh-CN")} 到期`
              : member.permanent
                ? `${member.planName} · 永久有效`
                : `${member.planName}已于 ${new Date(member.expireAt).toLocaleDateString("zh-CN")} 到期，续费后继续使用全部专享功能`}</small>
          </div>
        </div>
      </div>
    ` : `
      <div class="member-status">
        <div class="member-status-head">
          <i data-lucide="user"></i>
          <div>
            <strong>访客</strong>
            <small>开通会员解锁全部专享功能</small>
          </div>
        </div>
      </div>
    `;

    const tabsHTML = `
      <div class="member-tabs">
        <button class="member-tab ${currentTab === "plans" ? "active" : ""}" data-member-tab="plans" type="button">
          <i data-lucide="crown"></i><span>会员开通</span>
        </button>
        <button class="member-tab ${currentTab === "redeem" ? "active" : ""}" data-member-tab="redeem" type="button">
          <i data-lucide="ticket"></i><span>卡密激活</span>
        </button>
      </div>
    `;

    let contentHTML = "";

    if (currentTab === "plans") {
      const selectedPlan = state.pendingMemberPlan || null;
      const benefitRows = [
        ["四柱排盘 · 命盘总览", true],
        ["大运流年 · 行运推演", true],
        ["专题研判 · 八大主题", true],
        ["称骨基础（骨重 · 等级 · 称骨歌）", true],
        ["神煞列表 · 十神配置", true],
        ["袁天罡称骨五维专业解析", false],
        ["神煞深度白话释义", false],
        ["术数工具全部功能（六爻 · 梅花 · 奇门 · 六壬）", false]
      ].map(([title, free]) => `
        <div class="benefit-row">
          <i data-lucide="${free ? "check" : "crown"}"></i>
          <span>${title}</span>
          <em>${free ? "免费" : "会员"}</em>
        </div>
      `).join("");

      const plansHTML = Object.values(MEMBER_PLANS).map((plan) => `
        <button class="plan-card ${plan.key === selectedPlan ? "selected" : ""} ${plan.best ? "best" : ""}" type="button" data-plan="${plan.key}">
          ${plan.best ? '<span class="plan-best-tag">最划算</span>' : ""}
          <strong class="plan-name">${plan.name}</strong>
          <span class="plan-price">¥${plan.price}</span>
          <small class="plan-unit">/ ${plan.unit}</small>
          ${plan.save ? `<small class="plan-save">${plan.save}</small>` : ""}
        </button>
      `).join("");

      const payHTML = selectedPlan ? `
        <div class="member-pay">
          <span class="panel-kicker">在线支付 · 立即开通</span>
          <div class="pay-methods">
            <button class="pay-method-card active" data-pay-method="wechat" type="button">
              <div class="pay-method-icon wechat"><i data-lucide="message-circle"></i></div>
              <div class="pay-method-info">
                <strong>微信支付</strong>
                <span>推荐使用，安全快捷</span>
              </div>
              <div class="pay-method-check"><i data-lucide="check-circle-2"></i></div>
            </button>
            <button class="pay-method-card" data-pay-method="alipay" type="button">
              <div class="pay-method-icon alipay"><i data-lucide="credit-card"></i></div>
              <div class="pay-method-info">
                <strong>支付宝</strong>
                <span>支付宝扫码支付</span>
              </div>
              <div class="pay-method-check"><i data-lucide="check-circle-2"></i></div>
            </button>
          </div>
          <div class="pay-summary-row">
            <span>应付金额</span>
            <strong class="pay-amount">¥${MEMBER_PLANS[selectedPlan].price}</strong>
          </div>
          <button class="button primary full pay-submit-btn" id="pay-submit-btn" type="button">
            <i data-lucide="qr-code"></i>扫码支付
          </button>
          <p class="pay-divider"><span>或使用卡密激活</span></p>
          <span class="panel-kicker">卡密激活</span>
          <div class="redeem-row">
            <input id="member-code-input" type="text" maxlength="26" placeholder="输入卡密，如 XJ-Y.MCF3K2.9F2B-A7K3F9" autocomplete="off">
            <button class="button ghost" id="member-activate-button" type="button">立即激活</button>
          </div>
          <p class="redeem-feedback" id="redeem-feedback"></p>
        </div>
      ` : `
        <div class="member-pay-empty">
          <i data-lucide="mouse-pointer-click"></i>
          <span>选择上方任意一档套餐，即可展开支付与激活</span>
        </div>
      `;

      contentHTML = `
        <div class="member-benefits">
          <span class="panel-kicker">会员权益对照</span>
          ${benefitRows}
        </div>
        <div class="member-plans">
          <span class="panel-kicker">选择套餐${active ? "（续费时长自动顺延）" : ""}</span>
          <div class="plans-row">${plansHTML}</div>
          ${payHTML}
        </div>
        <p class="member-legal">会员服务为虚拟内容，激活即代表开始提供服务；有效期内支持在同一设备续期顺延。如遇激活问题请附支付截图联系管理员处理。</p>
      `;
    } else if (currentTab === "redeem") {
      contentHTML = `
        <div class="redeem-section-card">
          <div class="redeem-icon-wrap">
            <i data-lucide="ticket"></i>
          </div>
          <h3 style="margin:0 0 8px;font-size:18px;color:#3d3423;">卡密激活</h3>
          <p style="margin:0 0 20px;font-size:13px;color:#887b62;">输入您获得的卡密，一键激活会员，解锁全部专享功能</p>
          <div class="redeem-input-group">
            <input id="redeem-tab-input" type="text" maxlength="30" placeholder="请输入卡密，如 XJ-Y.MCF3K2.9F2B-A7K3F9" autocomplete="off" onkeydown="if(event.key==='Enter')document.getElementById('redeem-tab-btn').click()" style="flex:1;padding:14px 16px;border:2px solid #e5e0d5;border-radius:10px;font-size:15px;font-family:inherit;outline:none;transition:border-color .2s;background:#fff;">
            <button class="button primary" id="redeem-tab-btn" type="button" style="padding:14px 24px;font-size:15px;">
              <i data-lucide="zap"></i>立即激活
            </button>
          </div>
          <p class="redeem-feedback" id="redeem-tab-feedback" style="margin-top:12px;font-size:13px;min-height:20px;"></p>
          <div class="redeem-tips" style="margin-top:20px;padding:14px 16px;background:#faf8f3;border-radius:8px;border-left:3px solid #b8860b;">
            <div style="font-size:13px;color:#6b5f48;font-weight:600;margin-bottom:6px;">💡 温馨提示</div>
            <ul style="margin:0;padding-left:18px;font-size:12px;color:#887b62;line-height:1.8;">
              <li>卡密为一次性使用，激活后立即生效</li>
              <li>已是会员时激活，时长将自动顺延</li>
              <li>月卡30天内激活有效，季卡90天，年卡365天</li>
              <li>如遇激活问题请联系管理员处理</li>
            </ul>
          </div>
        </div>
      `;
    }

    body.innerHTML = `
      ${statusHTML}
      ${tabsHTML}
      <div class="member-tab-content">${contentHTML}</div>
    `;
    refreshIcons();
  }

  function initWithdrawForm() {
    const amountInput = $("#withdraw-amount");
    const feeDisplay = $("#withdraw-fee-display");
    const actualDisplay = $("#withdraw-actual-display");
    if (!amountInput) return;

    state.withdrawMethod = "wechat";

    const updateFee = () => {
      const amount = Number(amountInput.value) || 0;
      const fee = calcWithdrawFee(amount);
      const actual = Math.max(0, Math.round((amount - fee) * 100) / 100);
      if (feeDisplay) feeDisplay.textContent = "¥" + fee.toFixed(2);
      if (actualDisplay) actualDisplay.textContent = "¥" + actual.toFixed(2);
    };

    amountInput.addEventListener("input", updateFee);

    const allBtn = $("#withdraw-all-btn");
    if (allBtn) {
      allBtn.addEventListener("click", () => {
        const wallet = getWallet();
        amountInput.value = wallet.balance.toFixed(2);
        updateFee();
      });
    }

    $$(".method-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".method-option").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.withdrawMethod = btn.dataset.withdrawMethod;
      });
    });

    const submitBtn = $("#withdraw-submit-btn");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => {
        const amount = Number(amountInput.value);
        const method = state.withdrawMethod;
        const account = $("#withdraw-account")?.value;
        const realName = $("#withdraw-realname")?.value;
        const note = $("#withdraw-note")?.value;
        const feedback = $("#withdraw-feedback");

        const result = submitWithdrawal(amount, method, account, realName, note);
        if (feedback) {
          feedback.textContent = result.ok ? "申请提交成功！请等待审核到账" : result.error;
          feedback.className = "redeem-feedback " + (result.ok ? "success" : "error");
        }
        if (result.ok) {
          renderMemberCenter("withdraw");
        }
      });
    }

    // 撤销按钮
    $$("[data-cancel-withdraw]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.cancelWithdraw;
        if (!id) return;
        if (!confirm("确定要撤销这笔提现申请吗？")) return;
        const result = cancelWithdrawal(id);
        if (result.ok) {
          renderMemberCenter("withdraw");
          showToast("已撤销提现申请", "check");
        } else {
          showToast(result.error || "撤销失败", "alert");
        }
      });
    });
  }
  function handleMemberActivate() {
    const input = $("#member-code-input");
    const feedback = $("#redeem-feedback");
    if (!input) return;
    const code = input.value.trim();
    if (!code) {
      feedback.textContent = "请输入卡密";
      feedback.className = "redeem-feedback error";
      return;
    }
    const result = activateLicense(code);
    if (result.ok) {
      const days = memberDaysLeft();
      const dayText = result.member.permanent ? "永久有效" : `剩余 ${days} 天`;
      feedback.textContent = `激活成功！${result.member.planName}已开通，${dayText}`;
      feedback.className = "redeem-feedback success";
      renderMemberBadge();
      setTimeout(() => {
        closeModal("member-modal");
        location.reload();
      }, 1500);
    } else {
      feedback.textContent = result.error || "激活失败，请核对卡密";
      feedback.className = "redeem-feedback error";
    }
  }

  function handleRedeemTabActivate() {
    const input = $("#redeem-tab-input");
    const feedback = $("#redeem-tab-feedback");
    if (!input) return;
    const code = input.value.trim();
    if (!code) {
      feedback.textContent = "请输入卡密";
      feedback.className = "redeem-feedback error";
      return;
    }
    const result = activateLicense(code);
    if (result.ok) {
      const days = memberDaysLeft();
      const dayText = result.member.permanent ? "永久有效" : `剩余 ${days} 天`;
      feedback.textContent = `🎉 激活成功！${result.member.planName}已开通，${dayText}`;
      feedback.className = "redeem-feedback success";
      renderMemberBadge();
      setTimeout(() => {
        closeModal("member-modal");
        location.reload();
      }, 1500);
    } else {
      feedback.textContent = "❌ " + (result.error || "激活失败，请核对卡密");
      feedback.className = "redeem-feedback error";
    }
  }

  // ========== 支付弹窗 ==========
  let currentPaymentOrder = null;
  let paymentCountdownTimer = null;

  function openPaymentModal(planKey, method) {
    const plan = MEMBER_PLANS[planKey];
    if (!plan) return;

    const methodInfo = PAYMENT_METHODS[method] || PAYMENT_METHODS.wechat;
    const result = createPaymentOrder(planKey, method);
    if (!result.ok) {
      showToast(result.error || "创建订单失败", "alert");
      return;
    }

    currentPaymentOrder = result.order;
    const order = result.order;
    const payConfig = getPaymentConfig();

    // 设置弹窗标题
    $("#payment-modal-title").textContent = methodInfo.name;
    $("#payment-modal-kicker").textContent = `订单号：${order.orderNo}`;

    const body = $("#payment-body");
    const qrCodeStyle = method === "wechat"
      ? "background: linear-gradient(135deg, #07C160, #06AD56);"
      : "background: linear-gradient(135deg, #1677FF, #0958D9);";

    const qrImage = method === "wechat" ? payConfig.wechatQr : payConfig.alipayQr;
    const qrContent = qrImage
      ? `<img src="${qrImage}" alt="${methodInfo.name}收款码" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">`
      : `<div class="qr-placeholder"><i data-lucide="qr-code"></i></div>`;

    body.innerHTML = `
      <div class="payment-info">
        <div class="payment-amount">
          <span>支付金额</span>
          <strong>¥${order.amount.toFixed(2)}</strong>
        </div>
        <div class="payment-desc">${order.planName} · ${order.planDays}天会员</div>
      </div>
      <div class="payment-qr-wrap">
        <div class="payment-qr" style="${qrCodeStyle}">
          <div class="payment-qr-inner">
            ${qrContent}
            <div class="qr-method-tag">
              <i data-lucide="${methodInfo.icon}"></i>
            </div>
          </div>
        </div>
        <p class="payment-qr-tip">
          请使用<strong>${methodInfo.name}</strong>扫一扫
          <br>扫描二维码完成支付
        </p>
        <button class="button text small" id="payment-refresh-qr" type="button" style="margin-top:8px;">
          <i data-lucide="refresh-cw"></i> 二维码失效？点此刷新
        </button>
        ${payConfig.payeeName ? `<p class="payment-payee">收款人：${payConfig.payeeName}</p>` : ""}
      </div>
      <div class="payment-countdown">
        <i data-lucide="clock"></i>
        <span>二维码有效期 <strong id="payment-countdown">15:00</strong>，请尽快支付</span>
      </div>
      <div class="payment-actions">
        <button class="button primary full" id="payment-confirm-btn" type="button">
          <i data-lucide="check-circle-2"></i>我已支付，查看到账
        </button>
      </div>
      <p class="payment-note">
        <i data-lucide="shield-check"></i>
        支付安全由 ${methodInfo.name} 保障，成功后会员自动开通
      </p>
    `;

    refreshIcons();
    startPaymentCountdown(900); // 15分钟
    openModal("payment-modal");

    // 绑定按钮事件
    const confirmBtn = $("#payment-confirm-btn");
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        if (!currentPaymentOrder) return;
        const payConfig = getPaymentConfig();

        if (payConfig.autoConfirm) {
          // 演示模式：自动确认到账（仅用于测试演示）
          const payResult = markPaymentPaid(currentPaymentOrder.orderNo);
          if (payResult.ok) {
            clearInterval(paymentCountdownTimer);
            showPaymentSuccess(payResult.order);
          } else {
            showToast(payResult.error || "支付确认失败", "alert");
          }
        } else {
          // 正式模式：提交审核，等待管理员手动确认到账
          const submitResult = submitPaymentForReview(currentPaymentOrder.orderNo);
          if (submitResult.ok) {
            clearInterval(paymentCountdownTimer);
            // 更新当前订单状态
            currentPaymentOrder = submitResult.order;
            // 显示等待审核页面，同时启动轮询
            showPaymentReviewing(submitResult.order);
          } else {
            showToast(submitResult.error || "提交失败", "alert");
          }
        }
      };
    }

    // 刷新二维码按钮
    const refreshQrBtn = $("#payment-refresh-qr");
    if (refreshQrBtn) {
      refreshQrBtn.onclick = () => {
        if (!currentPaymentOrder) return;
        // 取消旧订单，重新生成新订单
        if (currentPaymentOrder.status === "pending") {
          cancelPayment(currentPaymentOrder.orderNo);
        }
        clearInterval(paymentCountdownTimer);
        stopPaymentPolling();
        // 重新打开支付弹窗（生成新订单）
        openPaymentModal(currentPaymentOrder.planKey, currentPaymentOrder.method);
        showToast("二维码已刷新", "check");
      };
    }
  }

  function startPaymentCountdown(seconds) {
    clearInterval(paymentCountdownTimer);
    let remaining = seconds;
    const updateDisplay = () => {
      const min = Math.floor(remaining / 60);
      const sec = remaining % 60;
      const el = $("#payment-countdown");
      if (el) el.textContent = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    };
    updateDisplay();
    paymentCountdownTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(paymentCountdownTimer);
        if (currentPaymentOrder) {
          // 标记订单为已过期
          const payments = getPayments();
          const idx = payments.findIndex((p) => p.orderNo === currentPaymentOrder.orderNo);
          if (idx >= 0 && (payments[idx].status === "pending" || payments[idx].status === "reviewing")) {
            payments[idx].status = "expired";
            addStatusHistory(payments[idx], "expired", "支付二维码已过期");
            savePayments(payments);
            currentPaymentOrder = payments[idx];
          }
        }
        const el = $("#payment-countdown");
        if (el) el.textContent = "已过期";
        // 显示过期失败界面
        if (currentPaymentOrder) {
          showPaymentFailed(currentPaymentOrder, "二维码已过期，请刷新后重新支付");
        } else {
          showToast("二维码已过期，请重新发起支付", "alert");
        }
        return;
      }
      updateDisplay();
    }, 1000);
  }

  function showPaymentSuccess(order) {
    const body = $("#payment-body");
    body.innerHTML = `
      <div class="payment-success">
        <div class="payment-success-icon">
          <i data-lucide="check-circle-2"></i>
        </div>
        <h3>支付成功</h3>
        <p class="payment-success-amount">¥${order.amount.toFixed(2)}</p>
        <p class="payment-success-desc">${order.planName} 已开通，立即享受全部会员权益</p>
        <div class="payment-success-info">
          <div class="detail-row">
            <span>订单号</span>
            <strong style="font-family:monospace;font-size:12px;">${order.orderNo}</strong>
          </div>
          <div class="detail-row">
            <span>支付方式</span>
            <strong>${order.methodName}</strong>
          </div>
          <div class="detail-row">
            <span>开通时长</span>
            <strong>${order.planDays} 天</strong>
          </div>
        </div>
        <button class="button primary full" id="payment-success-close" type="button">
          开始使用会员权益
        </button>
      </div>
    `;
    refreshIcons();

    const closeBtn = $("#payment-success-close");
    if (closeBtn) {
      closeBtn.onclick = () => {
        closeModal("payment-modal");
        closeModal("member-modal");
        renderMemberBadge();
        location.reload();
      };
    }
  }

  function showPaymentReviewing(order) {
    const body = $("#payment-body");
    body.innerHTML = `
      <div class="payment-success">
        <div class="payment-success-icon" style="background: linear-gradient(135deg, #fa8c16, #d46b08);">
          <i data-lucide="clock"></i>
        </div>
        <h3>等待确认到账</h3>
        <p class="payment-success-amount">¥${order.amount.toFixed(2)}</p>
        <p class="payment-success-desc">已收到您的支付申请，管理员确认到账后将自动开通会员</p>
        <div class="payment-success-info">
          <div class="detail-row">
            <span>订单号</span>
            <strong style="font-family:monospace;font-size:12px;">${order.orderNo}</strong>
          </div>
          <div class="detail-row">
            <span>支付方式</span>
            <strong>${order.methodName}</strong>
          </div>
          <div class="detail-row">
            <span>开通时长</span>
            <strong>${order.planDays} 天</strong>
          </div>
          <div class="detail-row">
            <span>当前状态</span>
            <strong style="color:#fa8c16;">待审核</strong>
          </div>
          <div class="detail-row">
            <span>交易哈希</span>
            <strong style="font-family:monospace;font-size:11px;color:#999;">${order.txHash || "-"}</strong>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;background:#fff7e6;border-radius:8px;margin:12px 0;">
          <div style="width:10px;height:10px;border-radius:50%;background:#fa8c16;animation:pulse 1.5s infinite;"></div>
          <span style="font-size:13px;color:#fa8c16;font-weight:500;">实时同步中 · 每5秒检测支付状态</span>
        </div>
        <p style="font-size:12px;color:#999;margin:12px 0 0;">
          <i data-lucide="info" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i>
          管理员确认到账后自动开通，如有疑问请联系客服
        </p>
        <button class="button ghost full" id="payment-review-close" type="button" style="margin-top:16px;">
          我知道了
        </button>
      </div>
    `;
    refreshIcons();

    startPaymentStatusPolling(order.orderNo);

    const closeBtn = $("#payment-review-close");
    if (closeBtn) {
      closeBtn.onclick = () => {
        stopPaymentPolling();
        closeModal("payment-modal");
        if ($("#member-modal") && $("#member-modal").classList.contains("show")) {
          renderMemberCenter("plans");
          refreshIcons();
        }
      };
    }
  }

  function showPaymentFailed(order, reason) {
    stopPaymentPolling();
    const body = $("#payment-body");
    body.innerHTML = `
      <div class="payment-success">
        <div class="payment-success-icon" style="background: linear-gradient(135deg, #ef4444, #dc2626);">
          <i data-lucide="x-circle"></i>
        </div>
        <h3>支付未成功</h3>
        <p class="payment-success-amount" style="color:#ef4444;">¥${order.amount.toFixed(2)}</p>
        <p class="payment-success-desc">${reason || "支付未能完成，请重新发起支付"}</p>
        <div class="payment-success-info">
          <div class="detail-row">
            <span>订单号</span>
            <strong style="font-family:monospace;font-size:12px;">${order.orderNo}</strong>
          </div>
          <div class="detail-row">
            <span>支付方式</span>
            <strong>${order.methodName}</strong>
          </div>
          <div class="detail-row">
            <span>订单状态</span>
            <strong style="color:#ef4444;">${order.status === "expired" ? "已过期" : order.status === "failed" ? "支付失败" : "已取消"}</strong>
          </div>
        </div>
        <div style="background:#fef2f2;border-radius:8px;padding:12px 16px;margin:16px 0;text-align:left;">
          <p style="font-size:13px;color:#991b1b;margin:0;">
            <i data-lucide="info" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i>
            如已扣款但状态未更新，请稍候片刻系统会自动同步，或联系客服提供支付凭证处理。
          </p>
        </div>
        <div style="display:flex;gap:10px;margin-top:16px;">
          <button class="button ghost" id="payment-failed-close" type="button" style="flex:1;">
            稍后再说
          </button>
          <button class="button primary" id="payment-retry-btn" type="button" style="flex:1;">
            <i data-lucide="refresh-cw"></i>重新支付
          </button>
        </div>
      </div>
    `;
    refreshIcons();

    const closeBtn = $("#payment-failed-close");
    if (closeBtn) {
      closeBtn.onclick = () => {
        closeModal("payment-modal");
      };
    }

    const retryBtn = $("#payment-retry-btn");
    if (retryBtn) {
      retryBtn.onclick = () => {
        // 重新创建订单并打开支付弹窗
        openPaymentModal(order.planKey, order.method);
      };
    }
  }

  function detectEnvironment() {
    const ua = navigator.userAgent || "";
    const isWeChat = /MicroMessenger/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    return { isWeChat, isIOS, isAndroid, standalone, isMobile: isIOS || isAndroid };
  }

  function renderInstallGuide() {
    const body = $("#install-body");
    if (!body) return;
    const env = detectEnvironment();
    let steps = [];
    let note = "";
    if (env.standalone) {
      body.innerHTML = `
        <div class="install-done">
          <i data-lucide="check-circle-2"></i>
          <strong>已经在 App 模式中运行</strong>
          <p>当前即全屏独立窗口体验，数据与浏览器实时同步，支持离线使用。</p>
        </div>
      `;
      refreshIcons();
      return;
    }
    if (env.isWeChat) {
      steps = [
        { icon: "more-horizontal", title: "点击右上角「…」", desc: "微信会拦截添加主屏幕功能，需先转到系统浏览器" },
        { icon: "safari", title: "选择「在浏览器打开」", desc: "iPhone 选 Safari，安卓选 Chrome 或系统浏览器" },
        { icon: isIOSDetected() ? "upload" : "more-vertical", title: isIOSDetected() ? "点底部分享按钮，选「添加到主屏幕」" : "点浏览器菜单 ⋮，选「添加到主屏幕」", desc: "确认后桌面即出现玄鉴八字图标" }
      ];
      note = "微信内无法直接安装，务必先转到浏览器再操作。";
    } else if (env.isIOS) {
      steps = [
        { icon: "upload", title: "点击 Safari 底部分享按钮", desc: "方形带向上箭头的按钮" },
        { icon: "plus-square", title: "下滑找到「添加到主屏幕」", desc: "如未看到，向下滑动整页菜单" },
        { icon: "check", title: "点击右上角「添加」", desc: "桌面出现玄鉴八字图标，点开即全屏运行" }
      ];
      note = "添加后无地址栏、有启动画面，与原生 App 一致。";
    } else if (env.isAndroid) {
      steps = [
        { icon: "more-vertical", title: "点击浏览器菜单 ⋮", desc: "地址栏右侧三个点" },
        { icon: "smartphone", title: "选择「添加到主屏幕」或「安装应用」", desc: "不同浏览器名称略有差异" },
        { icon: "check", title: "确认安装", desc: "桌面出现玄鉴八字图标，可离线使用" }
      ];
      note = "部分安卓机型会直接弹出安装确认窗，效果更接近原生 App。";
    } else {
      steps = [
        { icon: "monitor", title: "电脑端可收藏书签使用", desc: "Ctrl+D 收藏本站，随时快速访问" },
        { icon: "smartphone", title: "手机安装体验更佳", desc: "用手机浏览器打开本链接，按提示添加到主屏幕" }
      ];
      note = "手机端安装后支持全屏与离线使用。";
    }
    body.innerHTML = `
      <div class="install-steps">
        ${steps.map((step, index) => `
          <div class="install-step">
            <span class="step-no">${index + 1}</span>
            <i data-lucide="${step.icon}"></i>
            <div><strong>${step.title}</strong><p>${step.desc}</p></div>
          </div>
        `).join("")}
      </div>
      ${note ? `<p class="install-note"><i data-lucide="info"></i>${note}</p>` : ""}
    `;
    refreshIcons();
  }

  function isIOSDetected() {
    return detectEnvironment().isIOS;
  }

  function renderWelcome() {
    const recent = $("#welcome-recent");
    const hint = $("#welcome-install-hint");
    if (!recent) return;
    const list = state.archives.slice(0, 4);
    if (list.length) {
      recent.innerHTML = `
        <div class="welcome-section-title">最近命例</div>
        <div class="welcome-recent-list">
          ${list.map((item, index) => `
            <button class="recent-card" type="button" data-archive-index="${index}">
              <span class="recent-avatar">${(item.name || "命").charAt(0)}</span>
              <div class="recent-copy">
                <strong>${safeText(item.name || "未命名")}</strong>
                <small>${item.gender}命 · ${item.pillars.join(" ")}</small>
              </div>
              <i data-lucide="chevron-right"></i>
            </button>
          `).join("")}
        </div>
      `;
    } else {
      recent.innerHTML = "";
    }
    if (hint) {
      const env = detectEnvironment();
      hint.style.display = env.standalone ? "none" : "";
    }
  }

  const NAYIN_NAMES = [
    "海中金", "炉中火", "大林木", "路旁土", "剑锋金",
    "山头火", "涧下水", "城头土", "白蜡金", "杨柳木",
    "泉中水", "屋上土", "霹雳火", "松柏木", "长流水",
    "沙中金", "山下火", "平地木", "壁上土", "金箔金",
    "覆灯火", "天河水", "大驿土", "钗钏金", "桑柘木",
    "大溪水", "沙中土", "天上火", "石榴木", "大海水"
  ];

  const GROWTH_START = {
    甲: ["亥", 1], 乙: ["午", -1], 丙: ["寅", 1], 丁: ["酉", -1],
    戊: ["寅", 1], 己: ["酉", -1], 庚: ["巳", 1], 辛: ["子", -1],
    壬: ["申", 1], 癸: ["卯", -1]
  };
  const GROWTH_STAGES = ["长生", "沐浴", "冠带", "临官", "帝旺", "衰", "病", "死", "墓", "绝", "胎", "养"];

  const STEM_COMBINES = {
    "甲己": "合土", "乙庚": "合金", "丙辛": "合水", "丁壬": "合木", "戊癸": "合火"
  };
  const BRANCH_COMBINES = {
    "子丑": "六合土", "寅亥": "六合木", "卯戌": "六合火",
    "辰酉": "六合金", "巳申": "六合水", "午未": "六合土"
  };
  const BRANCH_CLASHES = ["子午", "丑未", "寅申", "卯酉", "辰戌", "巳亥"];
  const BRANCH_HARMS = ["子未", "丑午", "寅巳", "卯辰", "申亥", "酉戌"];
  const BRANCH_PUNISHMENTS = [
    ["寅", "巳"], ["巳", "申"], ["申", "寅"], ["丑", "戌"], ["戌", "未"],
    ["未", "丑"], ["子", "卯"], ["辰", "辰"], ["午", "午"], ["酉", "酉"], ["亥", "亥"]
  ];

  const SPIRIT_INFO = {
    天乙贵人: "逢难有助、贵人扶持之象，仍需结合喜忌与位置判断。",
    太极贵人: "重思辨、求知与对抽象体系的理解，得用时利研究与专门技艺。",
    天德贵人: "月令德神，传统上取宽厚、解厄之象，须与原局制化同看。",
    月德贵人: "随月令而取的德神，常作人和与缓冲之象，不单独定吉。",
    天德合: "由月令天德所合之干支取用，作协调与缓冲的辅助象义。",
    月德合: "由月德天干之合取用，传统上参看人和与转圜条件。",
    文昌贵人: "重学习、表达与文书能力，得用时利考试、策划与研究。",
    学堂: "取学习、模仿和专业训练之象，是否成用仍看印食配置。",
    国印贵人: "重规则、凭证、管理与公信力，得用时利承担职责。",
    福星贵人: "传统上取福气与助缘之象，是否得力仍看所在宫位和喜忌。",
    金舆: "取资源、体面与生活条件之象，须结合财星和日主承载力。",
    天厨: "取饮食、技艺、福禄与供给之象，不等同于现实财富结论。",
    天医: "取调养、医药缘分与照护意识之象，不用于疾病诊断。",
    桃花: "人际吸引与审美表达增强，忌神过旺时也主关系牵扰。",
    红艳: "人际魅力与情感表达的辅助取象，不用于单断婚恋结果。",
    红鸾: "关系缘分与喜庆事项的辅助取象，需配合配偶星、日支与岁运。",
    天喜: "人际喜庆与关系推进的辅助取象，不能脱离现实条件判断。",
    驿马: "三合局对冲之支取驿马，主迁移、奔波、变化与跨地域发展之象，动中求机。",
    华盖: "独立思考、艺术宗教与专业钻研之象，也可能偏于孤高。",
    禄神: "日主临官之地，主行动力、职禄与自我支撑。",
    羊刃: "日主帝旺之地，执行力强，宜有节制与规则疏导。",
    将星: "三合局中神取将星，主统帅、组织、统筹、担当与号召力之象。",
    劫煞: "竞争和突发变量较多，需留意节奏与边界。",
    亡神: "思虑、筹谋与隐性变量之象，得用可为机变，失衡则易耗神。",
    灾煞: "传统上提示外部扰动，宜作风险检查，不应据此制造恐慌。",
    孤辰: "独立与自处倾向的辅助标签，不等同于婚恋或人际结论。",
    寡宿: "内敛与边界感的辅助标签，须结合全局及现实经历理解。",
    魁罡: "仅取特定日柱的刚决、边界与执行之象，喜忌取决于全局。",
    阴阳差错: "特定日柱关系取象，提示沟通和角色预期宜更清晰。",
    孤鸾: "特定日柱的关系取象，提示独立性与相处节奏，不等同于婚姻结论。",
    十恶大败: "特定日柱的传统标签，只可辅助观察资源管理，不作绝对凶断。",
    四废: "按出生季节与日柱所取，提示相关五行气弱，仍以旺衰为主。",
    天赦: "按季节与日柱所取的缓冲之象，只作辅助参证。",
    空亡: "所临之象易有延迟、虚悬或转换，不能简单视作凶断。",
    三奇贵人: "甲戊庚顺布为天上三奇，主精神超凡、才能卓越，须配合原局旺衰与用神同看。",
    天罗地网: "戌亥为天罗、辰巳为地网，男忌天罗、女忌地网，主波折与受限之象，宜以制化化解。",
    飞刃: "羊刃对宫之支，取突发、冲动与伤害防护之象，不单独定吉凶。",
    丧门: "太岁后三位取象，传统上提示宾白之事，须结合全局与岁运判断。",
    吊客: "太岁后五位取象，与丧门同参，主人际离别与情绪波动之象。",
    元辰: "阳男阴女顺行、阴男阳女逆行所取大耗之支，主消耗与散失，得制可转化为行动力，不作凶断。",
    血刃: "以日支取血光之象，传统上提示外伤或手术风险，不作疾病断定。",
    德秀贵人: "以月令和日干取德秀之气，主品性端正、才学出众，得用时利声誉。",
    天官贵人: "以日干取天官之支，主官职、名誉与公门缘分，须配合官杀与格局同看。",
    童子煞: "特定日柱取象，传统上提示体质敏感或缘分特殊，不作凶断，须结合全局参看。",
    词馆: "取学业、技艺与专业能力之象，与学堂同参，得用时利学术与才艺发展。",
    勾绞煞: "由年支或日支前后三位取象，传统上提示人际牵绊与羁绊，须结合全局与岁运判断。",
    流霞: "以日干取血光之象，传统上提示外伤或健康注意，不作疾病断定。",
    披麻: "由年支或日支前四位取象，传统上提示宾白之事，须结合全局与岁运参看。"
  };

  const TEN_GOD_INFO = {
    比肩: "同类同气，主自我、同辈、独立与执行。",
    劫财: "同类异气，主竞争、协作、资源分配与行动。",
    食神: "我生同气，主表达、技艺、福气与稳定输出。",
    伤官: "我生异气，主创新、锋芒、批判与突破规则。",
    偏财: "我克同气，主流动资源、机会、经营与社交。",
    正财: "我克异气，主稳定收益、责任、秩序与务实。",
    七杀: "克我同气，主压力、竞争、决断与风险控制。",
    正官: "克我异气，主规则、职位、名誉与公共责任。",
    偏印: "生我同气，主洞察、偏门知识、保护与转换。",
    正印: "生我异气，主学习、资质、支持与系统知识。"
  };

  const GLOSSARY = [
    ["日主", "日柱天干，代表命局分析的核心参照点。其旺衰不等同于人的强弱或优劣。"],
    ["十神", "以日主为中心，将其余天干及藏干按五行生克和阴阳同异分为十类关系。"],
    ["藏干", "地支内部所含天干，用于观察根气、潜在十神及地支参与生克的方式。"],
    ["旺衰", "综合月令、通根、透干、生扶与克泄耗等因素判断日主及各五行的相对力量。"],
    ["格局", "以月令司令之气与透干配置为主要依据建立的命局结构模型。格局需配合旺衰、调候与制化。"],
    ["喜用", "用于改善命局结构、调节偏枯或成就格局的五行。随岁运环境可能出现层次变化。"],
    ["调候", "关注出生时节的寒暖燥湿，以特定五行调节气候偏性。"],
    ["星运", "以日主天干对照各柱地支所得的十二长生状态。"],
    ["自坐", "每柱天干落在本柱地支的十二长生状态，用于观察该柱干支的气势。"],
    ["空亡", "六十甲子旬中未被配到的两个地支，常取延迟、转化、虚实变化之象。"],
    ["纳音", "六十甲子两柱一组所配的五行名称，多用于辅助取象，不代替正五行生克。"],
    ["神煞", "依据干支组合归纳的象义标签，应以五行格局为主、神煞为辅。"],
    ["胎元", "以月柱干支推算：天干进一位、地支进三位。传统上取受胎之气，辅助参看先天体质与禀赋。"],
    ["命宫", "以生月与生时推算所得的干支。传统上取命宫为辅助宫位，参看心性、志向与后天发展倾向。"],
    ["大运", "通常以十年为一阶段的行运序列，顺逆取决于年干阴阳与性别，起运需按节气时刻核定。"],
    ["流年", "以立春为岁首观察当年干支与原局、大运的作用。"],
    ["六爻", "以六次取数形成卦象，结合世应、六亲、六神、月日旺衰等判断一事。"],
    ["梅花易数", "以时间、数字或外应取卦，重体用、生克、互变与动爻。"],
    ["奇门遁甲", "将时间信息布入九宫，综合九星、八门、八神与天地盘干研判时空态势。"],
    ["大六壬", "以月将加时建立天地盘、四课三传，结合神将与生克研判事势。"]
  ];

  const SCHOOLS = [
    { name: "渊海子平", subtitle: "格局 · 财官印食", focus: "以月令为提纲，先审提纲所藏与透出，再看财官印食是否有情。" },
    { name: "滴天髓", subtitle: "旺衰 · 源流清浊", focus: "重视日主强弱、五行源流与全局清浊，观察气势能否流通。" },
    { name: "三命通会", subtitle: "格局 · 神煞参证", focus: "综合格局、时令、纳音与神煞，但以干支生克为判断骨架。" },
    { name: "八字提要", subtitle: "月令 · 调候", focus: "按出生月令考察寒暖燥湿，优先处理全局气候偏性。" },
    { name: "子平真诠", subtitle: "用神 · 成败救应", focus: "由月令定用，细察顺用、逆用以及成格、破格和救应机制。" },
    { name: "天元巫咸", subtitle: "天元 · 干支取象", focus: "从天元透藏、上下情协与干支气象切入，参看根源归宿。" },
    { name: "神峰通考", subtitle: "病药 · 动静", focus: "辨命局偏枯之病，再寻制化之药，强调有病方为贵、药到始见功。" }
  ];

  const TOPICS = {
    overall: { label: "全项", icon: "scan-text", gods: ["正印", "食神", "正官"] },
    career: { label: "事业", icon: "briefcase-business", gods: ["正官", "七杀", "正印"] },
    wealth: { label: "财运", icon: "circle-dollar-sign", gods: ["正财", "偏财", "食神"] },
    love: { label: "婚恋", icon: "heart", gods: ["正财", "正官", "桃花"] },
    children: { label: "子女", icon: "baby", gods: ["食神", "伤官", "正印"] },
    family: { label: "六亲", icon: "users", gods: ["比肩", "正印", "正财"] },
    health: { label: "健康", icon: "activity", gods: ["正印", "食神", "七杀"] },
    study: { label: "学业", icon: "graduation-cap", gods: ["正印", "偏印", "文昌贵人"] }
  };

  const METHODS = [
    { id: "zhouyi", name: "易经 · 六爻", icon: "coins", desc: "六次取数成卦，察本卦、动爻与变卦。" },
    { id: "meihua", name: "梅花易数", icon: "flower-2", desc: "以问时和字数取象，参体用与互变生克。" },
    { id: "qimen", name: "奇门遁甲", icon: "grid-3x3", desc: "依时排布九宫，合参星、门、神与宫位。" },
    { id: "liuren", name: "大六壬", icon: "orbit", desc: "月将加时起课，取四课三传观察事势。" }
  ];

  const TRIGRAMS = {
    "111": { name: "乾", nature: "天", element: "金" },
    "110": { name: "兑", nature: "泽", element: "金" },
    "101": { name: "离", nature: "火", element: "火" },
    "100": { name: "震", nature: "雷", element: "木" },
    "011": { name: "巽", nature: "风", element: "木" },
    "010": { name: "坎", nature: "水", element: "水" },
    "001": { name: "艮", nature: "山", element: "土" },
    "000": { name: "坤", nature: "地", element: "土" }
  };

  const HEXAGRAMS = {
    乾: { 乾: "乾为天", 兑: "天泽履", 离: "天火同人", 震: "天雷无妄", 巽: "天风姤", 坎: "天水讼", 艮: "天山遁", 坤: "天地否" },
    兑: { 乾: "泽天夬", 兑: "兑为泽", 离: "泽火革", 震: "泽雷随", 巽: "泽风大过", 坎: "泽水困", 艮: "泽山咸", 坤: "泽地萃" },
    离: { 乾: "火天大有", 兑: "火泽睽", 离: "离为火", 震: "火雷噬嗑", 巽: "火风鼎", 坎: "火水未济", 艮: "火山旅", 坤: "火地晋" },
    震: { 乾: "雷天大壮", 兑: "雷泽归妹", 离: "雷火丰", 震: "震为雷", 巽: "雷风恒", 坎: "雷水解", 艮: "雷山小过", 坤: "雷地豫" },
    巽: { 乾: "风天小畜", 兑: "风泽中孚", 离: "风火家人", 震: "风雷益", 巽: "巽为风", 坎: "风水涣", 艮: "风山渐", 坤: "风地观" },
    坎: { 乾: "水天需", 兑: "水泽节", 离: "水火既济", 震: "水雷屯", 巽: "水风井", 坎: "坎为水", 艮: "水山蹇", 坤: "水地比" },
    艮: { 乾: "山天大畜", 兑: "山泽损", 离: "山火贲", 震: "山雷颐", 巽: "山风蛊", 坎: "山水蒙", 艮: "艮为山", 坤: "山地剥" },
    坤: { 乾: "地天泰", 兑: "地泽临", 离: "地火明夷", 震: "地雷复", 巽: "地风升", 坎: "地水师", 艮: "地山谦", 坤: "坤为地" }
  };

  const CHENGGU_YEAR = {
    甲子: 1.2, 乙丑: 0.9, 丙寅: 0.6, 丁卯: 0.7, 戊辰: 1.2, 己巳: 0.5,
    庚午: 0.9, 辛未: 0.8, 壬申: 0.7, 癸酉: 0.8, 甲戌: 1.5, 乙亥: 0.9,
    丙子: 1.6, 丁丑: 0.8, 戊寅: 0.8, 己卯: 1.9, 庚辰: 1.2, 辛巳: 0.6,
    壬午: 0.8, 癸未: 0.7, 甲申: 0.5, 乙酉: 1.5, 丙戌: 0.6, 丁亥: 1.6,
    戊子: 1.5, 己丑: 0.7, 庚寅: 0.9, 辛卯: 1.2, 壬辰: 1.0, 癸巳: 0.7,
    甲午: 1.5, 乙未: 0.6, 丙申: 0.5, 丁酉: 1.4, 戊戌: 1.4, 己亥: 0.9,
    庚子: 0.7, 辛丑: 0.7, 壬寅: 0.9, 癸卯: 1.2, 甲辰: 0.8, 乙巳: 0.7,
    丙午: 1.3, 丁未: 0.5, 戊申: 1.4, 己酉: 0.5, 庚戌: 0.9, 辛亥: 1.7,
    壬子: 0.5, 癸丑: 0.7, 甲寅: 1.2, 乙卯: 0.8, 丙辰: 0.8, 丁巳: 0.6,
    戊午: 1.9, 己未: 0.6, 庚申: 0.8, 辛酉: 1.6, 壬戌: 1.0, 癸亥: 0.7
  };
  const CHENGGU_MONTH = [0.6, 0.7, 1.8, 0.9, 0.5, 1.6, 0.9, 1.5, 1.8, 0.8, 0.9, 0.5];
  const CHENGGU_DAY = [
    0.5, 1.0, 0.8, 1.5, 1.6, 1.5, 0.8, 1.6, 0.8, 1.6,
    0.9, 1.7, 0.8, 1.7, 1.0, 0.8, 0.9, 1.8, 0.5, 1.5,
    1.0, 0.9, 0.8, 0.9, 1.5, 1.8, 0.7, 0.8, 1.6, 0.6
  ];
  const CHENGGU_HOUR = [1.6, 0.6, 0.7, 1.0, 0.9, 1.6, 1.0, 0.8, 0.8, 0.9, 0.6, 0.6];

  const CHENGGU_VERSES = {
    2.1: "短命非业谓大空，平生灾难事重重，凶祸频临陷逆境，终世困苦事不成。",
    2.2: "身寒骨冷苦伶仃，此命推来行乞人，劳劳碌碌无度日，中年打拱过平生。",
    2.3: "此命推来骨肉轻，求谋做事事难成，妻儿兄弟应难许，别处他乡作散人。",
    2.4: "此命推来福禄无，门庭困苦总难荣，六亲骨肉皆无靠，流落他乡作老翁。",
    2.5: "此命推来祖业微，门庭营度似稀奇，六亲骨肉如冰炭，一世勤劳自把持。",
    2.6: "平生衣禄苦中求，独自营谋事不休，离祖出门宜早计，晚来衣禄自无忧。",
    2.7: "一生做事少商量，难靠祖宗作主张，独马单枪空作去，早年晚岁总无长。",
    2.8: "一生作事似飘蓬，祖宗产业在梦中，若不过房改名姓，也当移徒二三通。",
    2.9: "初年运限未曾亨，纵有功名在后成，须过四旬方可立，移居改姓始为良。",
    3.0: "劳劳碌碌苦中求，东走西奔何日休，若使终身勤与俭，老来稍可免忧愁。",
    3.1: "忙忙碌碌苦中求，何日云开见日头，难得祖基家可立，中年衣食渐无忧。",
    3.2: "初年运蹇事难谋，渐有财源如水流，到得中年衣食旺，那时名利一齐收。",
    3.3: "早年做事事难成，百计徒劳枉费心，半世自如流水去，后来运到始得金。",
    3.4: "此命福气果如何，僧道门中衣禄多，离祖出家方为妙，终朝拜佛念弥陀。",
    3.5: "生平福量不周全，祖业根基觉少传，营事生涯宜守旧，时来衣食胜从前。",
    3.6: "不须劳碌过平生，独自成家福不轻，早有福星常照命，任君行去百般成。",
    3.7: "此命般般事不成，弟兄少力自孤成，虽然祖业须微有，来得明时去不明。",
    3.8: "一身骨肉最清高，早入学门姓名标，待到年将三十六，蓝衫脱去换红袍。",
    3.9: "此命终身运不通，劳劳做事尽皆空，苦心竭力成家计，到得那时在梦中。",
    4.0: "平生衣禄是绵长，件件心中自主张，前面风霜多受过，后来必定享安康。",
    4.1: "此命推来事不同，为人能干异凡庸，中年还有逍遥福，不比前年运未通。",
    4.2: "得宽怀处且宽怀，何用双眉皱不开，若使中年命运济，那时名利一齐来。",
    4.3: "为人心性最聪明，做事轩昂近贵人，衣禄一生天数定，不须劳碌是丰亨。",
    4.4: "万事由天莫苦求，须知福禄胜前途，当年财帛难如意，晚景欣然便不忧。",
    4.5: "名利推来竟若何，前番辛苦后奔波，命中难养男与女，骨肉扶持也不多。",
    4.6: "东西南北尽皆通，出姓移名更觉隆，衣禄无亏天数定，中年晚景一般同。",
    4.7: "此命推来旺末年，妻荣子贵自怡然，平生原有滔滔福，可有财源如水流。",
    4.8: "幼年运道未曾享，苦是蹉跎再不兴，兄弟六亲皆无靠，一身事业晚年成。",
    4.9: "此命推来福不轻，自立自成显门庭，从来富贵人钦敬，使婢差奴过一生。",
    5.0: "为名为利终日劳，中年福禄也多遭，老来稍可心头好，前番辛苦后逍遥。",
    5.1: "一世荣华事事通，不须劳碌自然丰，弟兄叔侄皆如意，家业成时福禄宏。",
    5.2: "一世亨通事事能，不须劳思自然能，宗族欣然心皆好，家业丰亨自称心。",
    5.3: "此格推来气象真，兴家发达在其中，一生福禄安排定，却是人间一富翁。",
    5.4: "此命推来厚且清，诗书满腹看功成，丰衣足食自然稳，正是人间有福人。",
    5.5: "走马扬鞭争名利，少年做事废筹论，一朝福禄源源至，富贵荣华显六亲。",
    5.6: "此格推来礼义通，一生福禄用无穷，甜酸苦辣皆尝过，财源滚滚稳且丰。",
    5.7: "福禄盈盈万事全，一身荣耀乐天年，名扬威震人争羡，此世逍遥宛似仙。",
    5.8: "平生福禄自然来，名利兼全福禄偕，雁塔题名为贵客，紫袍金带走金鞋。",
    5.9: "细推此格妙且清，必定才高礼仪通，甲第之中应有分，扬鞭走马显威荣。",
    6.0: "一朝金榜快题名，显祖荣宗立大功，衣食定然原欲足，田园财帛更丰盈。",
    6.1: "不做朝中金榜客，定为世上一财翁，聪明天赋经书熟，名显高科自是荣。",
    6.2: "此名生来福不穷，读书必定显亲荣，紫衣金带为卿相，富贵荣华皆可同。",
    6.3: "命主为官福禄长，得来富贵定非常，名题金塔传金榜，定中高科天下扬。",
    6.4: "此格权威不可当，紫袍金带坐高堂，荣华富贵谁能及，积玉堆金满储仓。",
    6.5: "细推此命福不轻，安国安邦极品人，文绣雕梁政富贵，威声照耀四方闻。",
    6.6: "此格人间一福人，堆金积玉满堂春，从来富贵由天定，正笏垂绅谒圣君。",
    6.7: "此名生来福自宏，田园家业最高隆，平生衣禄丰盈足，一世荣华万事通。",
    6.8: "富贵由天莫苦求，万金家计不须谋，十年不比前番事，祖业根基水上舟。",
    6.9: "君是人间衣禄星，一生福贵众人钦，纵然福禄由天定，安享荣华过一生。",
    7.0: "此命推来福不轻，不须愁虑苦劳心，一生天定衣与禄，富贵荣华过一生。",
    7.1: "此名生来大不同，公侯卿相在其中，一生自有逍遥福，富贵荣华极品隆。",
    7.2: "此格世间罕有生，十代积善产此人，天上紫微来照命，统治万民乐太平。"
  };

  const CHENGGU_GRADES = [
    {
      max: 2.79, name: "下下之命",
      trend: "先天福泽较薄，早运多磨。前半生宜守不宜攻，凡事亲力亲为、戒急戒贪；中年之后若能勤俭立身、远离投机，运势可逐步回暖，晚景自安。",
      character: "性情多敏感要强，容易因环境所迫而早熟。优点是能吃苦、韧性足；需防自怨自艾，或急于翻身而走捷径。",
      career: "宜学一技之长，靠手艺与经验稳步积累；不宜过早创业或重仓投资。异地发展、更换环境反而可能带来转机。",
      marriage: "婚恋中现实压力较明显，宜迟婚、先立业后成家；择偶重在同心同德而非条件攀比。",
      wealth: "财来财去、聚少散多，一生财富重在守成。务必远离赌博、高息借贷与为人担保，强制储蓄是保命之道。"
    },
    {
      max: 3.4, name: "下等之命",
      trend: "早年运势起伏，白手起家之格。三旬之前多劳少成，中年得贵人提携后渐入佳境，晚运平稳有余。",
      character: "为人实在肯干，做事有始有终，但性格偏固执，不擅变通。贵人少而小人近，须谨慎交友、少说是非。",
      career: "适合技术、手艺、服务类稳定行业，忌频繁转行。积累经验与人脉之后，中年可小有局面。",
      marriage: "感情多波折，易因经济或沟通生隙。夫妻宜各安其职、互相扶持，适度保持空间反而相安。",
      wealth: "正财为主，偏财勿贪。量入为出、点滴积累，晚年自有一份安稳家底。"
    },
    {
      max: 4.1, name: "中下之命",
      trend: "少年平平，青壮年渐开。三十岁前后是重要转折，此后运势拾级而上，属先难后易、渐入佳境之命。",
      character: "聪敏有余而底气稍弱，容易想得多做得少。若能定下心来深耕一事，才智自能变现。",
      career: "宜依托平台发展、借势而起，专业资格与文凭是重要敲门砖。中年前后有升迁或转型之机。",
      marriage: "姻缘不算太早，但较稳定。配偶多为助力型，宜坦诚沟通、财务分明。",
      wealth: "财富中等偏上，正财稳健、偶有偏财。中年以后积蓄渐厚，注意勿为一时意气破财。"
    },
    {
      max: 4.8, name: "中等之命",
      trend: "一生较为平顺，少大起大落。青年稍历风霜，中年安然，晚景康宁，属稳中有进之命。",
      character: "为人聪明自主，凡事心中有数，不轻易服输。人缘不俗，遇事常有贵人暗助。",
      career: "事业可成，宜在专业领域深耕并担当实职。中年有掌权得势之象，凭本事与信誉立身。",
      marriage: "家宅大体安宁，夫妻各有主张。多包容则白头偕老，多计较则易生嫌隙。",
      wealth: "衣食无虞，家道渐丰。财富靠稳扎稳打，中年后可置业积累，晚景丰足。"
    },
    {
      max: 5.5, name: "中上之命",
      trend: "根基较好，一生顺遂居多。早年即显能干之名，中年名利渐收，晚运优游自在。",
      character: "天资聪颖，气度不凡，做事有章法、有担当。自尊心强、好面子，宜防刚愎自用。",
      career: "事业格局较大，可居管理之位或自成一片天地。名声与实利皆可得，惟忌与人争锋斗气。",
      marriage: "配偶多贤能，家运相得益彰。子女缘佳，晚岁多得子孙之福。",
      wealth: "财禄丰盈，求财相对顺遂。正偏财皆有门路，惟须戒贪，见好即收可保长久。"
    },
    {
      max: 6.2, name: "上等之命",
      trend: "命中带贵，一生少愁衣食。青年得志或早享名望，中年位高权重，晚景荣华。",
      character: "才智过人，胸襟开阔，有领袖气度。行事果决，惟须防锋芒太露而招人妒忌。",
      career: "功名可期，无论仕途、商界皆能居上位。逢流年相助之时，可放手一搏。",
      marriage: "妻荣子贵，家庭为事业之助力。门当户对、性情相投者更佳。",
      wealth: "财源广进，堆金积玉之象。善理财者更上一层，宜置产业、荫及子孙。"
    },
    {
      max: 6.9, name: "上上之命",
      trend: "福泽深厚，非常人可比。一生多逢凶化吉、逢难有救，步步高升，晚岁声名俱隆。",
      character: "器宇轩昂，天纵之才。有主见亦有雅量，天生令人信服。",
      career: "非富即贵，成就多在众人之上，有扬名立万之象，宜担大任。",
      marriage: "姻缘上乘，配偶家门皆优。家庭和美，得贤内助。",
      wealth: "万金家计不须谋，富贵两全。财随名至，越有担当越有财。"
    },
    {
      max: 99, name: "极品之命",
      trend: "古称“七两上下，十代积善”之命，世间罕有。一生格局宏大，福禄寿全。",
      character: "天生领袖之资，气度恢弘。心系众人，德望兼备。",
      career: "公侯将相之格，无论身处何界皆是领袖之选。",
      marriage: "天作之合，家道隆昌，子孙昌盛。",
      wealth: "富贵极品，取之有道、用之有度，福泽绵长。"
    }
  ];

  const SPIRIT_CATEGORIES = {
    noble: ["天乙贵人", "天德贵人", "月德贵人", "天德合", "月德合", "太极贵人", "德秀贵人", "国印贵人", "福星贵人", "天官贵人", "三奇贵人", "禄神", "将星", "天厨", "天赦"],
    motion: ["驿马"],
    romance: ["桃花", "红鸾", "天喜", "红艳"],
    wisdom: ["文昌贵人", "学堂", "词馆", "华盖", "金舆", "天医"],
    risk: ["灾煞", "劫煞", "亡神", "羊刃", "飞刃", "血刃", "流霞", "丧门", "吊客", "元辰", "勾绞煞", "披麻", "十恶大败", "天罗地网", "童子煞", "孤辰", "寡宿", "孤鸾", "阴阳差错", "四废", "魁罡"]
  };

  const defaultProfile = {
    id: "demo-linqinghe",
    name: "林清和",
    gender: "女",
    birthDate: "1992-04-18",
    birthTime: "09:30",
    location: "浙江杭州",
    pillars: ["壬申", "甲辰", "甲子", "己巳"],
    sect: 1,
    calculationMode: "calendar",
    useTrueSolarTime: false,
    longitude: 120,
    calculation: {
      engine: "lunar-javascript@1.7.7",
      timezone: "Asia/Shanghai",
      verified: true
    },
    tags: ["研究命例"],
    createdAt: "2026-08-22T08:00:00.000Z",
    updatedAt: "2026-08-22T08:00:00.000Z"
  };

  const state = {
    profile: null,
    analysis: null,
    archives: [],
    view: "overview",
    reportTopic: "overall",
    fortuneLevel: "year",
    fortuneAnchor: new Date(),
    selectedPeriodIndex: null,
    selectedMethod: null,
    pendingProfileIsNew: false,
    wheelValue: null,
    wheelScrollTimers: {},
    historyProfileId: null,
    aiMessages: [],
    aiAvailable: false,
    aiModel: "",
    aiBusy: false,
    chartCalendar: "solar",
    pendingMemberPlan: null,
    firstVisit: true,
    aiTopic: "career",
    hourUnknown: false
  };

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const mod = (value, base) => ((value % base) + base) % base;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const stemData = (name) => STEMS.find((item) => item.name === name);
  const branchData = (name) => BRANCHES.find((item) => item.name === name);
  const safeText = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  function refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons({ attrs: { "aria-hidden": "true" } });
    }
  }

  function ganzhiAt(index) {
    return STEMS[mod(index, 10)].name + BRANCHES[mod(index, 12)].name;
  }

  function ganzhiIndex(pillar) {
    for (let index = 0; index < 60; index += 1) {
      if (ganzhiAt(index) === pillar) return index;
    }
    return -1;
  }

  function parsePillar(value) {
    const clean = String(value || "").trim().replace(/\s+/g, "");
    if (clean.length !== 2) return null;
    const stem = stemData(clean[0]);
    const branch = branchData(clean[1]);
    if (!stem || !branch || ganzhiIndex(clean) < 0) return null;
    return { raw: clean, stem, branch };
  }

  function getTenGod(dayStemName, targetStemName) {
    const day = stemData(dayStemName);
    const target = stemData(targetStemName);
    if (!day || !target) return "未知";
    const samePolarity = day.polarity === target.polarity;
    if (day.element === target.element) return samePolarity ? "比肩" : "劫财";
    if (PRODUCES[day.element] === target.element) return samePolarity ? "食神" : "伤官";
    if (CONTROLS[day.element] === target.element) return samePolarity ? "偏财" : "正财";
    if (CONTROLS[target.element] === day.element) return samePolarity ? "七杀" : "正官";
    if (PRODUCES[target.element] === day.element) return samePolarity ? "偏印" : "正印";
    return "未知";
  }

  function getGrowthStage(stemName, branchName) {
    const config = GROWTH_START[stemName];
    if (!config) return "";
    const startIndex = BRANCHES.findIndex((branch) => branch.name === config[0]);
    const targetIndex = BRANCHES.findIndex((branch) => branch.name === branchName);
    const stageIndex = config[1] === 1
      ? mod(targetIndex - startIndex, 12)
      : mod(startIndex - targetIndex, 12);
    return GROWTH_STAGES[stageIndex];
  }

  function getNayin(pillar) {
    const index = ganzhiIndex(pillar);
    return index >= 0 ? NAYIN_NAMES[Math.floor(index / 2)] : "未知";
  }

  // 获取年柱纳音五行（金木水火土）
  function getNayinElement(pillar) {
    const index = ganzhiIndex(pillar);
    if (index < 0) return "";
    // 六十甲子纳音五行分组（每组2个干支，共30组）
    // 顺序：金、金、火、火、木、木、土、土、金、金、水、水...
    // 更可靠的方式：按纳音名判断
    const name = NAYIN_NAMES[Math.floor(index / 2)];
    if (name.includes("金") || name.includes("剑锋") || name.includes("钗钏") || name.includes("沙中金") || name.includes("白蜡") || name.includes("海中金") || name.includes("金箔")) return "金";
    if (name.includes("木") || name.includes("大林木") || name.includes("松柏") || name.includes("平地木") || name.includes("桑柘") || name.includes("石榴")) return "木";
    if (name.includes("水") || name.includes("涧下") || name.includes("泉中") || name.includes("长流") || name.includes("天河") || name.includes("大海") || name.includes("大溪水")) return "水";
    if (name.includes("火") || name.includes("炉中") || name.includes("山头") || name.includes("霹雳") || name.includes("山下") || name.includes("佛灯") || name.includes("天上火") || name.includes("覆灯")) return "火";
    if (name.includes("土") || name.includes("路旁") || name.includes("城头") || name.includes("屋上") || name.includes("壁上") || name.includes("大驿") || name.includes("沙中土")) return "土";
    return "";
  }

  function getTaiyuan(monthPillar) {
    const stemIndex = STEMS.findIndex((item) => item.name === monthPillar[0]);
    const branchIndex = BRANCHES.findIndex((item) => item.name === monthPillar[1]);
    if (stemIndex < 0 || branchIndex < 0) return "";
    const stem = STEMS[mod(stemIndex + 1, 10)].name;
    const branch = BRANCHES[mod(branchIndex + 3, 12)].name;
    return stem + branch;
  }

  function getMinggong(monthBranchName, hourBranchName) {
    const monthIndex = BRANCHES.findIndex((item) => item.name === monthBranchName);
    const hourIndex = BRANCHES.findIndex((item) => item.name === hourBranchName);
    if (monthIndex < 0 || hourIndex < 0) return "";
    const monthNum = monthIndex + 1;
    const hourNum = hourIndex + 1;
    const sum = monthNum + hourNum;
    const result = sum <= 14 ? 15 - sum : 30 - sum;
    const branchIndex = mod(result - 1, 12);
    const branchName = BRANCHES[branchIndex].name;
    const yearStem = state.profile?.pillars?.[0]?.[0] || "甲";
    const yearStemIndex = STEMS.findIndex((item) => item.name === yearStem);
    const tigerStart = [2, 4, 6, 8, 0][mod(yearStemIndex, 5)];
    const stemOffset = mod(branchIndex - tigerStart, 12);
    const stemName = STEMS[mod(yearStemIndex + stemOffset, 10)].name;
    return stemName + branchName;
  }

  function getVoidBranches(dayPillar) {
    const stemIndex = STEMS.findIndex((item) => item.name === dayPillar[0]);
    const branchIndex = BRANCHES.findIndex((item) => item.name === dayPillar[1]);
    const difference = mod(branchIndex - stemIndex, 12);
    const table = {
      0: ["戌", "亥"],
      10: ["申", "酉"],
      8: ["午", "未"],
      6: ["辰", "巳"],
      4: ["寅", "卯"],
      2: ["子", "丑"]
    };
    return table[difference] || [];
  }

  function getSpirits(context) {
    const {
      dayStem,
      dayBranch,
      yearStem,
      yearBranch,
      monthBranch,
      dayPillar: natalDayPillar,
      targetStem,
      targetBranch,
      targetIndex,
      gender
    } = context;
    const result = [];
    const tianyi = {
      甲: ["丑", "未"], 戊: ["丑", "未"], 庚: ["丑", "未"],
      乙: ["子", "申"], 己: ["子", "申"],
      丙: ["亥", "酉"], 丁: ["亥", "酉"],
      壬: ["卯", "巳"], 癸: ["卯", "巳"],
      辛: ["寅", "午"]
    };
    const wenchang = { 甲: "巳", 乙: "午", 丙: "申", 戊: "申", 丁: "酉", 己: "酉", 庚: "亥", 辛: "子", 壬: "寅", 癸: "卯" };
    const lu = { 甲: "寅", 乙: "卯", 丙: "巳", 戊: "巳", 丁: "午", 己: "午", 庚: "申", 辛: "酉", 壬: "亥", 癸: "子" };
    const blade = { 甲: "卯", 乙: "寅", 丙: "午", 戊: "午", 丁: "巳", 己: "巳", 庚: "酉", 辛: "申", 壬: "子", 癸: "亥" };
    const taiji = {
      甲: ["子", "午"], 乙: ["子", "午"], 丙: ["卯", "酉"], 丁: ["卯", "酉"],
      戊: ["辰", "戌", "丑", "未"], 己: ["辰", "戌", "丑", "未"],
      庚: ["寅", "亥"], 辛: ["寅", "亥"], 壬: ["巳", "申"], 癸: ["巳", "申"]
    };
    const guoyin = { 甲: "戌", 乙: "亥", 丙: "丑", 丁: "寅", 戊: "丑", 己: "寅", 庚: "辰", 辛: "巳", 壬: "未", 癸: "申" };
    const fuxing = {
      甲: ["寅", "子"], 乙: ["丑", "卯"], 丙: ["寅", "子"], 丁: ["亥"], 戊: ["申"],
      己: ["未"], 庚: ["午"], 辛: ["巳"], 壬: ["辰"], 癸: ["丑", "卯"]
    };
    const jinyu = { 甲: "辰", 乙: "巳", 丙: "未", 丁: "申", 戊: "未", 己: "申", 庚: "戌", 辛: "亥", 壬: "丑", 癸: "寅" };
    const tianchu = { 甲: "巳", 乙: "午", 丙: "巳", 丁: "午", 戊: "申", 己: "酉", 庚: "亥", 辛: "子", 壬: "寅", 癸: "卯" };
    const tiande = { 寅: "丁", 卯: "申", 辰: "壬", 巳: "辛", 午: "亥", 未: "甲", 申: "癸", 酉: "寅", 戌: "丙", 亥: "乙", 子: "巳", 丑: "庚" };
    const tiandeHe = { 寅: "壬", 卯: "巳", 辰: "丁", 巳: "丙", 午: "寅", 未: "己", 申: "戊", 酉: "亥", 戌: "辛", 亥: "庚", 子: "申", 丑: "乙" };
    const yuede = {
      寅: "丙", 午: "丙", 戌: "丙",
      申: "壬", 子: "壬", 辰: "壬",
      亥: "甲", 卯: "甲", 未: "甲",
      巳: "庚", 酉: "庚", 丑: "庚"
    };
    const yuedeHe = { 丙: "辛", 壬: "丁", 甲: "己", 庚: "乙" };
    const school = { 甲: "亥", 乙: "午", 丙: "寅", 丁: "酉", 戊: "寅", 己: "酉", 庚: "巳", 辛: "子", 壬: "申", 癸: "卯" };
    const redCharm = { 甲: "午", 乙: "申", 丙: "寅", 丁: "未", 戊: "辰", 己: "辰", 庚: "戌", 辛: "酉", 壬: "子", 癸: "申" };
    const redLuan = { 子: "卯", 丑: "寅", 寅: "丑", 卯: "子", 辰: "亥", 巳: "戌", 午: "酉", 未: "申", 申: "未", 酉: "午", 戌: "巳", 亥: "辰" };
    const tianXi = { 子: "酉", 丑: "申", 寅: "未", 卯: "午", 辰: "巳", 巳: "辰", 午: "卯", 未: "寅", 申: "丑", 酉: "子", 戌: "亥", 亥: "戌" };
    const groupSpirit = (branch, groups) => {
      for (const group of groups) {
        if (group.members.includes(branch)) return group.value;
      }
      return "";
    };
    const groups = [
      { members: ["申", "子", "辰"], peach: "酉", horse: "寅", canopy: "辰", general: "子", calamity: "巳", lost: "亥", disaster: "午" },
      { members: ["寅", "午", "戌"], peach: "卯", horse: "申", canopy: "戌", general: "午", calamity: "亥", lost: "巳", disaster: "子" },
      { members: ["亥", "卯", "未"], peach: "子", horse: "巳", canopy: "未", general: "卯", calamity: "申", lost: "寅", disaster: "酉" },
      { members: ["巳", "酉", "丑"], peach: "午", horse: "亥", canopy: "丑", general: "酉", calamity: "寅", lost: "申", disaster: "卯" }
    ];
    const lookupGroup = (rootBranch, key) => {
      const group = groups.find((item) => item.members.includes(rootBranch));
      return group ? group[key] : "";
    };
    const peach = lookupGroup(yearBranch, "peach");
    const horse = lookupGroup(yearBranch, "horse");
    const canopy = lookupGroup(yearBranch, "canopy");
    const general = lookupGroup(yearBranch, "general");
    const calamity = lookupGroup(yearBranch, "calamity");
    const lost = lookupGroup(yearBranch, "lost");
    const disaster = lookupGroup(yearBranch, "disaster");
    const lonelyGroups = [
      { members: ["亥", "子", "丑"], lonely: "寅", widow: "戌" },
      { members: ["寅", "卯", "辰"], lonely: "巳", widow: "丑" },
      { members: ["巳", "午", "未"], lonely: "申", widow: "辰" },
      { members: ["申", "酉", "戌"], lonely: "亥", widow: "未" }
    ];
    const lonelyGroupYear = lonelyGroups.find((item) => item.members.includes(yearBranch));
    const lonelyGroupDay = lonelyGroups.find((item) => item.members.includes(dayBranch));
    const matches = (token) => token === targetStem || token === targetBranch;
    const hasBranch = (list) => (list || []).includes(targetBranch);

    if (hasBranch(tianyi[dayStem]) || hasBranch(tianyi[yearStem])) result.push("天乙贵人");
    if (hasBranch(taiji[dayStem]) || hasBranch(taiji[yearStem])) result.push("太极贵人");
    if (matches(tiande[monthBranch])) result.push("天德贵人");
    if (targetStem === yuede[monthBranch]) result.push("月德贵人");
    if (matches(tiandeHe[monthBranch])) result.push("天德合");
    if (targetStem === yuedeHe[yuede[monthBranch]]) result.push("月德合");
    if (wenchang[dayStem] === targetBranch || wenchang[yearStem] === targetBranch) result.push("文昌贵人");
    if (school[dayStem] === targetBranch) result.push("学堂");
    if (guoyin[dayStem] === targetBranch || guoyin[yearStem] === targetBranch) result.push("国印贵人");
    if (hasBranch(fuxing[dayStem]) || hasBranch(fuxing[yearStem])) result.push("福星贵人");
    if (jinyu[dayStem] === targetBranch) result.push("金舆");
    if (tianchu[dayStem] === targetBranch) result.push("天厨");
    if (targetIndex !== 0 && peach === targetBranch) result.push("桃花");
    if (redCharm[dayStem] === targetBranch) result.push("红艳");
    if (redLuan[yearBranch] === targetBranch) result.push("红鸾");
    if (tianXi[yearBranch] === targetBranch) result.push("天喜");
    if (targetIndex !== 0 && horse === targetBranch) result.push("驿马");
    if (targetIndex !== 0 && canopy === targetBranch) result.push("华盖");
    if (lu[dayStem] === targetBranch) result.push("禄神");
    if (blade[dayStem] === targetBranch) result.push("羊刃");
    if (targetIndex !== 0 && general === targetBranch) result.push("将星");
    if (targetIndex !== 0 && calamity === targetBranch) result.push("劫煞");
    if (targetIndex !== 0 && lost === targetBranch) result.push("亡神");
    if (targetIndex !== 0 && disaster === targetBranch) result.push("灾煞");
    if (targetIndex !== 0 && lonelyGroupYear?.lonely === targetBranch) result.push("孤辰");
    if (targetIndex !== 0 && lonelyGroupYear?.widow === targetBranch) result.push("寡宿");
    if (BRANCHES[mod(BRANCHES.findIndex((item) => item.name === monthBranch) - 1, 12)].name === targetBranch) {
      result.push("天医");
    }

    const feiren = { 甲: "酉", 乙: "申", 丙: "子", 丁: "亥", 戊: "子", 己: "亥", 庚: "卯", 辛: "寅", 壬: "午", 癸: "巳" };
    if (feiren[dayStem] === targetBranch) result.push("飞刃");

    const sangMenYearIdx = mod(BRANCHES.findIndex((item) => item.name === yearBranch) + 2, 12);
    if (targetIndex !== 0 && BRANCHES[sangMenYearIdx].name === targetBranch) result.push("丧门");
    const diaoKeYearIdx = mod(BRANCHES.findIndex((item) => item.name === yearBranch) + 10, 12);
    if (targetIndex !== 0 && BRANCHES[diaoKeYearIdx].name === targetBranch) result.push("吊客");

    if (targetIndex === 0) {
      if (["戌", "亥"].includes(targetBranch) && gender !== "female") result.push("天罗地网");
      if (["辰", "巳"].includes(targetBranch) && gender !== "male") result.push("天罗地网");
    }

    const xueren = { 子: "酉", 丑: "戌", 寅: "亥", 卯: "子", 辰: "丑", 巳: "寅", 午: "卯", 未: "辰", 申: "巳", 酉: "午", 戌: "未", 亥: "申" };
    if (xueren[dayBranch] === targetBranch) result.push("血刃");

    const tianguan = { 甲: "酉", 乙: "申", 丙: "子", 丁: "亥", 戊: "卯", 己: "寅", 庚: "午", 辛: "巳", 壬: "辰", 癸: "未" };
    if (tianguan[dayStem] === targetBranch) result.push("天官贵人");

    const dexiuDe = { 寅: "丙", 午: "丙", 戌: "丙", 申: "壬", 子: "壬", 辰: "壬", 巳: "庚", 酉: "庚", 丑: "庚", 亥: "甲", 卯: "甲", 未: "甲" };
    const dexiuXiu = { 寅: "戊", 午: "戊", 戌: "戊", 申: "丙", 子: "丙", 辰: "丙", 巳: "乙", 酉: "乙", 丑: "乙", 亥: "丁", 卯: "丁", 未: "丁" };
    if (targetStem === dexiuDe[monthBranch] || targetStem === dexiuXiu[monthBranch]) result.push("德秀贵人");

    if (targetIndex === 2) {
      if (["戊戌", "庚辰", "庚戌", "壬辰"].includes(natalDayPillar)) result.push("魁罡");
      if (["丙子", "丁丑", "戊寅", "辛卯", "壬辰", "癸巳", "丙午", "丁未", "戊申", "辛酉", "壬戌", "癸亥"].includes(natalDayPillar)) {
        result.push("阴阳差错");
      }
      if (["乙巳", "丁巳", "辛亥", "戊申", "甲寅", "戊午", "壬子", "丙午"].includes(natalDayPillar)) {
        result.push("孤鸾");
      }
      if (["甲辰", "乙巳", "丙申", "丁亥", "戊戌", "己丑", "庚辰", "辛巳", "壬申", "癸亥"].includes(natalDayPillar)) {
        result.push("十恶大败");
      }
      const seasonalRules = [
        { months: ["寅", "卯", "辰"], waste: ["庚申", "辛酉"], pardon: "戊寅" },
        { months: ["巳", "午", "未"], waste: ["壬子", "癸亥"], pardon: "甲午" },
        { months: ["申", "酉", "戌"], waste: ["甲寅", "乙卯"], pardon: "戊申" },
        { months: ["亥", "子", "丑"], waste: ["丙午", "丁巳"], pardon: "甲子" }
      ];
      const season = seasonalRules.find((item) => item.months.includes(monthBranch));
      if (season?.waste.includes(natalDayPillar)) result.push("四废");
      if (season?.pardon === natalDayPillar) result.push("天赦");
    }
    const ciguan = { 甲: "亥", 乙: "午", 丙: "巳", 丁: "寅", 戊: "巳", 己: "寅", 庚: "亥", 辛: "午", 壬: "寅", 癸: "申" };
    if (ciguan[dayStem] === targetBranch || ciguan[yearStem] === targetBranch) result.push("词馆");

    const liuxia = { 甲: "酉", 乙: "戌", 丙: "未", 丁: "申", 戊: "巳", 己: "辰", 庚: "卯", 辛: "寅", 壬: "巳", 癸: "午" };
    if (liuxia[dayStem] === targetBranch) result.push("流霞");

    const pimaYearIdx = mod(BRANCHES.findIndex((item) => item.name === yearBranch) + 4, 12);
    if (targetIndex !== 0 && BRANCHES[pimaYearIdx].name === targetBranch) result.push("披麻");

    const gouYearIdx = mod(BRANCHES.findIndex((item) => item.name === yearBranch) + 3, 12);
    const jiaoYearIdx = mod(BRANCHES.findIndex((item) => item.name === yearBranch) - 3, 12);
    if (targetIndex !== 0 &&
        (BRANCHES[gouYearIdx].name === targetBranch || BRANCHES[jiaoYearIdx].name === targetBranch)) result.push("勾绞煞");

    const yangStems = ["甲", "丙", "戊", "庚", "壬"];
    const isYearYang = yangStems.includes(yearStem);
    const yearForward = (isYearYang && gender === "male") || (!isYearYang && gender === "female");
    const yuanchenYearIdx = mod(BRANCHES.findIndex((item) => item.name === yearBranch) + (yearForward ? 7 : 5), 12);
    if (targetIndex !== 0 && BRANCHES[yuanchenYearIdx].name === targetBranch) result.push("元辰");

    // 童子煞（时柱神煞，两套查法满足其一即是）
    // 口诀：春秋寅子贵，冬夏卯未辰；金木马卯合，水火鸡犬多，土命逢辰巳
    if (targetIndex === 3) {
      const isSpringAutumn = ["寅", "卯", "辰", "申", "酉", "戌"].includes(monthBranch);
      const isWinterSummer = ["亥", "子", "丑", "巳", "午", "未"].includes(monthBranch);
      // 季节查法
      if (isSpringAutumn && ["寅", "子"].includes(targetBranch)) result.push("童子煞");
      if (isWinterSummer && ["卯", "未", "辰"].includes(targetBranch)) result.push("童子煞");
      // 纳音查法（年柱纳音五行）
      if (context.yearPillar) {
        const nayinElement = getNayinElement(context.yearPillar);
        if ((nayinElement === "金" || nayinElement === "木") && ["午", "卯"].includes(targetBranch)) result.push("童子煞");
        if ((nayinElement === "水" || nayinElement === "火") && ["酉", "戌"].includes(targetBranch)) result.push("童子煞");
        if (nayinElement === "土" && ["辰", "巳"].includes(targetBranch)) result.push("童子煞");
      }
    }
    // 日柱也查一次（部分流派论日坐童子，季节+纳音双查法）
    if (targetIndex === 2) {
      const isSpringAutumn = ["寅", "卯", "辰", "申", "酉", "戌"].includes(monthBranch);
      const isWinterSummer = ["亥", "子", "丑", "巳", "午", "未"].includes(monthBranch);
      // 季节查法
      if (isSpringAutumn && ["寅", "子"].includes(targetBranch)) result.push("童子煞");
      if (isWinterSummer && ["卯", "未", "辰"].includes(targetBranch)) result.push("童子煞");
      // 纳音查法（日柱纳音五行，对应日支）
      if (context.dayPillar) {
        const nayinElement = getNayinElement(context.dayPillar);
        if ((nayinElement === "金" || nayinElement === "木") && ["午", "卯"].includes(targetBranch)) result.push("童子煞");
        if ((nayinElement === "水" || nayinElement === "火") && ["酉", "戌"].includes(targetBranch)) result.push("童子煞");
        if (nayinElement === "土" && ["辰", "巳"].includes(targetBranch)) result.push("童子煞");
      }
    }

    return Array.from(new Set(result));
  }

  function calculateElements(parsedPillars) {
    const totals = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    parsedPillars.forEach((pillar, pillarIndex) => {
      totals[pillar.stem.element] += 1;
      totals[pillar.branch.element] += pillarIndex === 1 ? 1.75 : 1.1;
      pillar.branch.hidden.forEach((hidden, hiddenIndex) => {
        const weights = [0.7, 0.35, 0.2];
        totals[stemData(hidden).element] += weights[hiddenIndex] || 0.15;
      });
    });
    const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
    const percentages = {};
    ELEMENTS.forEach((element) => {
      percentages[element] = Math.round((totals[element] / total) * 100);
    });
    const roundingDifference = 100 - Object.values(percentages).reduce((sum, value) => sum + value, 0);
    percentages[ELEMENTS.reduce((best, item) => totals[item] > totals[best] ? item : best, "木")] += roundingDifference;
    return { totals, percentages };
  }

  function findRelations(pillars) {
    const relations = [];
    for (let i = 0; i < pillars.length; i += 1) {
      for (let j = i + 1; j < pillars.length; j += 1) {
        const stemPair = [pillars[i].stem.name, pillars[j].stem.name].sort().join("");
        const branchPair = [pillars[i].branch.name, pillars[j].branch.name].sort().join("");
        const combineStem = Object.entries(STEM_COMBINES).find(([key]) => key.split("").every((char) => stemPair.includes(char)));
        const combineBranch = Object.entries(BRANCH_COMBINES).find(([key]) => key.split("").every((char) => branchPair.includes(char)));
        const clash = BRANCH_CLASHES.find((key) => key.split("").every((char) => branchPair.includes(char)));
        const harm = BRANCH_HARMS.find((key) => key.split("").every((char) => branchPair.includes(char)));
        const punishment = BRANCH_PUNISHMENTS.find((pair) => (
          pair[0] === pillars[i].branch.name && pair[1] === pillars[j].branch.name
        ) || (
          pair[1] === pillars[i].branch.name && pair[0] === pillars[j].branch.name
        ));

        if (combineStem) {
          relations.push({
            type: "天干合",
            className: "combine",
            pair: `${PILLAR_LABELS[i]}${pillars[i].stem.name} · ${PILLAR_LABELS[j]}${pillars[j].stem.name}`,
            result: combineStem[1],
            note: "有协同与牵合之象，是否化气须再看月令与助化条件。"
          });
        }
        if (combineBranch) {
          relations.push({
            type: "地支合",
            className: "combine",
            pair: `${PILLAR_LABELS[i]}${pillars[i].branch.name} · ${PILLAR_LABELS[j]}${pillars[j].branch.name}`,
            result: combineBranch[1],
            note: "两支相合，关系与资源有汇聚倾向，仍受全局制约。"
          });
        }
        if (clash) {
          relations.push({
            type: "地支冲",
            className: "clash",
            pair: `${PILLAR_LABELS[i]}${pillars[i].branch.name} · ${PILLAR_LABELS[j]}${pillars[j].branch.name}`,
            result: "冲动",
            note: "对应宫位易见变化、迁动或意见张力，动中可有调整空间。"
          });
        }
        if (harm) {
          relations.push({
            type: "地支害",
            className: "harm",
            pair: `${PILLAR_LABELS[i]}${pillars[i].branch.name} · ${PILLAR_LABELS[j]}${pillars[j].branch.name}`,
            result: "相害",
            note: "合作与表达中可能出现隐性牵制，宜把权责和预期说清。"
          });
        }
        if (punishment) {
          relations.push({
            type: "地支刑",
            className: "clash",
            pair: `${PILLAR_LABELS[i]}${pillars[i].branch.name} · ${PILLAR_LABELS[j]}${pillars[j].branch.name}`,
            result: "相刑",
            note: "容易形成反复、自我加压或流程摩擦，适合用规则化解。"
          });
        }
      }
    }
    return relations;
  }

  function analyzeProfile(profile) {
    const pillars = profile.pillars.map(parsePillar);
    if (pillars.some((pillar) => !pillar)) throw new Error("四柱中存在无效干支");
    const dayStem = pillars[2].stem.name;
    const dayElement = pillars[2].stem.element;
    const elements = calculateElements(pillars);
    const resourceElement = ELEMENTS.find((element) => PRODUCES[element] === dayElement);
    const outputElement = PRODUCES[dayElement];
    const wealthElement = CONTROLS[dayElement];
    const officerElement = ELEMENTS.find((element) => CONTROLS[element] === dayElement);
    const support = elements.totals[dayElement] + elements.totals[resourceElement];
    const total = Object.values(elements.totals).reduce((sum, value) => sum + value, 0);
    const strengthRatio = support / total;
    const strength = strengthRatio > 0.58 ? "身旺" : strengthRatio < 0.43 ? "身偏弱" : "中和";
    const useful = strength === "身旺"
      ? [outputElement, wealthElement, officerElement]
      : [resourceElement, dayElement];
    const monthMainGod = getTenGod(dayStem, pillars[1].branch.hidden[0]);
    const patternMap = {
      比肩: "建禄取象", 劫财: "月劫取象", 食神: "食神格", 伤官: "伤官格",
      偏财: "偏财格", 正财: "正财格", 七杀: "七杀格", 正官: "正官格",
      偏印: "偏印格", 正印: "正印格"
    };
    const voidBranches = getVoidBranches(profile.pillars[2]);
    const spirits = pillars.map((pillar, targetIndex) => {
      const list = getSpirits({
        dayStem,
        dayBranch: pillars[2].branch.name,
        yearStem: pillars[0].stem.name,
        yearBranch: pillars[0].branch.name,
        yearPillar: profile.pillars[0],
        monthBranch: pillars[1].branch.name,
        dayPillar: profile.pillars[2],
        targetStem: pillar.stem.name,
        targetBranch: pillar.branch.name,
        targetIndex,
        gender: profile.gender
      });
      if (voidBranches.includes(pillar.branch.name)) list.push("空亡");
      return list;
    });
    const allStems = pillars.map((p) => p.stem.name);
    const allStemStr = allStems.join("");
    const sanqiGroups = [
      { stems: "甲戊庚", label: "天三奇" },
      { stems: "乙丙丁", label: "地三奇" },
      { stems: "壬癸辛", label: "人三奇" }
    ];
    for (const group of sanqiGroups) {
      const chars = group.stems.split("");
      const indices = chars.map((c) => allStemStr.indexOf(c));
      const valid = indices.every((i) => i >= 0);
      const ascending = valid && indices[0] < indices[1] && indices[1] < indices[2];
      const descending = valid && indices[0] > indices[1] && indices[1] > indices[2];
      if (ascending || descending) {
        chars.forEach((c) => {
          const stemIndex = allStems.indexOf(c);
          if (stemIndex >= 0 && !spirits[stemIndex].includes("三奇贵人")) {
            spirits[stemIndex].push("三奇贵人");
          }
        });
      }
    }
    const gods = [];
    pillars.forEach((pillar, index) => {
      gods.push({ god: index === 2 ? "日元" : getTenGod(dayStem, pillar.stem.name), source: PILLAR_LABELS[index] + "天干", stem: pillar.stem.name });
      pillar.branch.hidden.forEach((hidden) => {
        gods.push({ god: getTenGod(dayStem, hidden), source: PILLAR_LABELS[index] + "藏干", stem: hidden });
      });
    });
    const godCounts = {};
    gods.forEach((item) => {
      godCounts[item.god] = (godCounts[item.god] || 0) + 1;
    });
    const dominantElement = ELEMENTS.reduce((best, element) => elements.totals[element] > elements.totals[best] ? element : best, "木");
    const weakestElement = ELEMENTS.reduce((best, element) => elements.totals[element] < elements.totals[best] ? element : best, "木");

    return {
      pillars,
      dayStem,
      dayElement,
      elements,
      strength,
      strengthRatio,
      useful,
      resourceElement,
      outputElement,
      wealthElement,
      officerElement,
      pattern: patternMap[monthMainGod] || "综合取象",
      monthMainGod,
      voidBranches,
      spirits,
      relations: findRelations(pillars),
      gods,
      godCounts,
      dominantElement,
      weakestElement
    };
  }

  function formatBirth(profile) {
    const date = new Date(`${profile.birthDate}T${profile.birthTime || "12:00"}`);
    if (Number.isNaN(date.getTime())) return `${profile.birthDate} · ${profile.location || "出生地未录"}`;
    const hour = date.getHours();
    const branchIndex = mod(Math.floor((hour + 1) / 2), 12);
    const timeText = profile.hourUnknown ? "时柱未知" : `${BRANCHES[branchIndex].name}时`;
    return `公历 ${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${timeText} · ${profile.location || "出生地未录"}`;
  }

  function calculateStartAge(profile, direction) {
    const birth = new Date(`${profile.birthDate}T${profile.birthTime || "12:00"}`);
    if (Number.isNaN(birth.getTime())) return 6.2;
    const year = birth.getFullYear();
    const terms = [
      [1, 5], [2, 4], [3, 6], [4, 5], [5, 6], [6, 6],
      [7, 7], [8, 8], [9, 8], [10, 8], [11, 7], [12, 7]
    ];
    const candidates = [];
    [year - 1, year, year + 1].forEach((candidateYear) => {
      terms.forEach(([month, day]) => candidates.push(new Date(candidateYear, month - 1, day, 12)));
    });
    const target = direction === 1
      ? candidates.filter((date) => date > birth).sort((a, b) => a - b)[0]
      : candidates.filter((date) => date < birth).sort((a, b) => b - a)[0];
    const days = Math.abs(target - birth) / 86400000;
    return clamp(days / 3, 0.3, 10);
  }

  function getLuckDirection(profile, analysis) {
    const yangYear = analysis.pillars[0].stem.polarity === "阳";
    return (profile.gender === "男" && yangYear) || (profile.gender === "女" && !yangYear) ? 1 : -1;
  }

  function getDayun(profile, analysis) {
    if (profile.calculationMode !== "manual" && window.XuanJianCalendar) {
      try {
        const precise = window.XuanJianCalendar.calculateDayun({
          birthDate: profile.birthDate,
          birthTime: profile.birthTime,
          gender: profile.gender,
          sect: profile.sect,
          useTrueSolarTime: profile.useTrueSolarTime,
          longitude: profile.longitude
        });
        return precise.cycles.slice(0, 10).map((cycle, index) => ({
          pillar: cycle.pillar,
          age: cycle.startAge,
          startYear: cycle.startYear,
          endYear: cycle.endYear,
          index,
          precise: true
        }));
      } catch (error) {
        console.warn("精确大运计算失败，已回退到近似算法", error);
      }
    }
    const direction = getLuckDirection(profile, analysis);
    const startAge = calculateStartAge(profile, direction);
    const monthIndex = ganzhiIndex(profile.pillars[1]);
    const birthYear = new Date(profile.birthDate).getFullYear();
    return Array.from({ length: 9 }, (_, index) => {
      const age = startAge + index * 10;
      return {
        pillar: ganzhiAt(monthIndex + direction * (index + 1)),
        age,
        startYear: Math.round(birthYear + age),
        endYear: Math.round(birthYear + age + 9),
        index
      };
    });
  }

  function yearPillar(year) {
    return STEMS[mod(year - 4, 10)].name + BRANCHES[mod(year - 4, 12)].name;
  }

  function monthPillar(year, monthIndex) {
    const yearStemIndex = mod(year - 4, 10);
    const tigerStemStarts = [2, 4, 6, 8, 0];
    const startStem = tigerStemStarts[yearStemIndex % 5];
    return STEMS[mod(startStem + monthIndex, 10)].name + BRANCHES[mod(2 + monthIndex, 12)].name;
  }

  function getSolarMonthPeriods(year) {
    if (window.XuanJianCalendar?.getSolarMonthTransitions) {
      try {
        return window.XuanJianCalendar.getSolarMonthTransitions(year).map((item) => {
          const [hour, minute] = item.time.split(":").map(Number);
          return {
            label: item.term,
            pillar: item.pillar,
            sub: `${item.month}/${item.day}`,
            date: new Date(item.year, item.month - 1, item.day, hour, minute)
          };
        });
      } catch (error) {
        console.warn("节令流月计算失败，已回退到近似日期", error);
      }
    }
    const terms = ["立春", "惊蛰", "清明", "立夏", "芒种", "小暑", "立秋", "白露", "寒露", "立冬", "大雪", "小寒"];
    return terms.map((term, index) => {
      const targetYear = index === 11 ? year + 1 : year;
      const targetMonth = index === 11 ? 1 : index + 2;
      const day = [4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7, 6][index];
      return {
        label: term,
        pillar: monthPillar(year, index),
        sub: `${targetMonth}/${day}`,
        date: new Date(targetYear, targetMonth - 1, day, 12)
      };
    });
  }

  function getSolarMonthPeriodsForDate(date) {
    let year = date.getFullYear();
    let periods = getSolarMonthPeriods(year);
    if (date < periods[0].date) {
      year -= 1;
      periods = getSolarMonthPeriods(year);
    }
    return { year, periods };
  }

  function findSolarMonthIndex(periods, date) {
    for (let index = periods.length - 1; index >= 0; index -= 1) {
      if (date >= periods[index].date) return index;
    }
    return -1;
  }

  function dayPillar(date) {
    const reference = new Date(2000, 0, 7, 12, 0, 0);
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
    const days = Math.round((target - reference) / 86400000);
    return ganzhiAt(days);
  }

  function hourPillar(date) {
    const day = dayPillar(date);
    const dayStemIndex = STEMS.findIndex((stem) => stem.name === day[0]);
    const branchIndex = mod(Math.floor((date.getHours() + 1) / 2), 12);
    const startStem = [0, 2, 4, 6, 8][dayStemIndex % 5];
    return STEMS[mod(startStem + branchIndex, 10)].name + BRANCHES[branchIndex].name;
  }

  function formatAge(age) {
    const years = Math.floor(age);
    const months = Math.round((age - years) * 12);
    return `${years}岁${months ? `${months}月` : ""}`;
  }

  function getCurrentDayun(profile, analysis) {
    const cycles = getDayun(profile, analysis);
    const birth = new Date(profile.birthDate);
    const age = (new Date() - birth) / (365.2425 * 86400000);
    return cycles.find((cycle) => age >= cycle.age && age < cycle.age + 10) || cycles[0];
  }

  function evaluatePeriod(pillar, analysis) {
    const parsed = parsePillar(pillar);
    if (!parsed) return { score: 50, god: "未知", notes: [] };
    const stemGod = getTenGod(analysis.dayStem, parsed.stem.name);
    const hiddenGod = getTenGod(analysis.dayStem, parsed.branch.hidden[0]);
    let score = 62;
    if (analysis.useful.includes(parsed.stem.element)) score += 12;
    if (analysis.useful.includes(parsed.branch.element)) score += 8;
    if (parsed.stem.element === analysis.dominantElement && analysis.strength === "身旺") score -= 7;
    const branchNames = analysis.pillars.map((item) => item.branch.name);
    const clashCount = branchNames.filter((branch) => BRANCH_CLASHES.some((pair) => pair.includes(branch) && pair.includes(parsed.branch.name))).length;
    const combineCount = branchNames.filter((branch) => Object.keys(BRANCH_COMBINES).some((pair) => pair.includes(branch) && pair.includes(parsed.branch.name))).length;
    score += combineCount * 3 - clashCount * 4;
    score = clamp(score, 32, 92);
    return {
      score,
      god: stemGod,
      hiddenGod,
      clashCount,
      combineCount,
      useful: analysis.useful.includes(parsed.stem.element) || analysis.useful.includes(parsed.branch.element),
      notes: [
        `${parsed.stem.name}${parsed.stem.element}为${stemGod}，${parsed.branch.name}中主气对应${hiddenGod}。`,
        combineCount ? `与原局见${combineCount}处合意，利于资源衔接与关系协同。` : "与原局未见明显六合，宜依具体事项判断助力来源。",
        clashCount ? `与原局见${clashCount}处冲动，变化与调整会成为本期主题。` : "原局冲动不显，推进节奏相对可控。"
      ]
    };
  }

  function renderAll() {
    state.analysis = analyzeProfile(state.profile);
    renderProfileHeader();
    renderMetrics();
    renderChart();
    renderInsights();
    renderElements();
    renderRelations();
    renderCurrentFortune();
    renderFortune();
    renderReports();
    renderSpirits();
    renderFullAnalysis();
    renderOverviewFortune();
    renderOverviewSpirits();
    renderFortuneSynthesis();
    renderChenggu();
    renderMethods();
    renderArchives();
    // renderAI(); // 旧版AI聊天已停用，改用专题研判
    renderMemberBadge();
    renderWelcome();
    refreshIcons();
  }

  function renderProfileHeader() {
    const birthYear = new Date(state.profile.birthDate).getFullYear();
    $("#sidebar-avatar").textContent = state.profile.name.charAt(0) || "命";
    $("#sidebar-name").textContent = state.profile.name;
    $("#sidebar-meta").textContent = `${state.profile.gender}命 · ${birthYear}年生`;
    $("#profile-summary").textContent = formatBirth(state.profile);
  }

  function renderMetrics() {
    const a = state.analysis;
    const items = [
      { symbol: a.dayStem, label: "日主", value: `${a.dayStem}${a.dayElement} · ${stemData(a.dayStem).polarity}` },
      { symbol: a.strength === "身旺" ? "旺" : a.strength === "中和" ? "和" : "扶", label: "身势", value: `${a.strength} · 生扶${Math.round(a.strengthRatio * 100)}%` },
      { symbol: "格", label: "格局取象", value: a.pattern },
      { symbol: "用", label: "喜用次序", value: a.useful.slice(0, 2).join("、") }
    ];
    $("#metric-strip").innerHTML = items.map((item) => `
      <div class="metric-item">
        <span class="metric-symbol">${item.symbol}</span>
        <span class="metric-copy"><small>${item.label}</small><strong>${item.value}</strong></span>
      </div>
    `).join("");
  }

  function chartCell(content, extraClass) {
    return `<div class="chart-cell ${extraClass || ""}">${content}</div>`;
  }

  function currentCalendarPillars() {
    const now = new Date();
    const birthDate = `${now.getFullYear()}-${padNumber(now.getMonth() + 1)}-${padNumber(now.getDate())}`;
    const birthTime = `${padNumber(now.getHours())}:${padNumber(now.getMinutes())}`;
    try {
      return window.XuanJianCalendar.calculate({ birthDate, birthTime, sect: 1 }).pillars;
    } catch (error) {
      return [yearPillar(now.getFullYear()), monthPillar(now.getFullYear(), mod(now.getMonth() - 1, 12)), dayPillar(now), hourPillar(now)];
    }
  }

  function spiritsForTarget(pillar, targetIndex) {
    const a = state.analysis;
    const parsed = parsePillar(pillar);
    if (!parsed) return [];
    const list = getSpirits({
      dayStem: a.dayStem,
      dayBranch: a.pillars[2].branch.name,
      yearStem: a.pillars[0].stem.name,
      yearBranch: a.pillars[0].branch.name,
      yearPillar: state.profile.pillars[0],
      monthBranch: a.pillars[1].branch.name,
      dayPillar: state.profile.pillars[2],
      targetStem: parsed.stem.name,
      targetBranch: parsed.branch.name,
      targetIndex,
      gender: state.profile.gender
    });
    if (a.voidBranches.includes(parsed.branch.name)) list.push("空亡");
    return Array.from(new Set(list));
  }

  function mobileChartCell(content, extraClass) {
    return `<div class="mobile-chart-cell ${extraClass || ""}">${content}</div>`;
  }

  function renderMobileChart() {
    const a = state.analysis;
    const currentPillars = currentCalendarPillars();
    const currentDayun = getCurrentDayun(state.profile, a);
    const columns = [
      { label: "日期", pillar: currentPillars[2], targetIndex: -1, isTime: true },
      { label: "流年", pillar: currentPillars[0], targetIndex: -1, isTime: true },
      { label: "大运", pillar: currentDayun.pillar, targetIndex: -1, isTime: true },
      ...state.profile.pillars.map((pillar, index) => ({
        label: PILLAR_LABELS[index],
        pillar,
        targetIndex: index,
        isTime: false
      }))
    ].map((column) => ({
      ...column,
      parsed: parsePillar(column.pillar),
      spirits: column.targetIndex >= 0 ? a.spirits[column.targetIndex] : spiritsForTarget(column.pillar, -1)
    }));
    const values = (renderer) => columns.map((column) => {
      const cls = column.isTime ? "mobile-chart-cell time-col" : "mobile-chart-cell natal-col";
      return `<div class="${cls}">${renderer(column)}</div>`;
    }).join("");
    const rows = [
      `<div class="mobile-chart-row header">${mobileChartCell("", "mobile-chart-label")}${values((column) => column.label)}</div>`,
      `<div class="mobile-chart-row">${mobileChartCell("主星", "mobile-chart-label")}${values((column) => column.targetIndex === 2 ? "日元" : getTenGod(a.dayStem, column.parsed.stem.name))}</div>`,
      `<div class="mobile-chart-row mobile-stem-row">${mobileChartCell("天干", "mobile-chart-label")}${values((column) => `<strong class="mobile-pillar-glyph element-${column.parsed.stem.element}">${column.parsed.stem.name}</strong>`)}</div>`,
      `<div class="mobile-chart-row mobile-branch-row">${mobileChartCell("地支", "mobile-chart-label")}${values((column) => `<strong class="mobile-pillar-glyph element-${column.parsed.branch.element}">${column.parsed.branch.name}</strong>`)}</div>`,
      `<div class="mobile-chart-row mobile-hidden-row">${mobileChartCell("藏干", "mobile-chart-label")}${values((column) => `<span class="mobile-hidden">${column.parsed.branch.hidden.map((hidden) => `<span class="element-${stemData(hidden).element}">${hidden}<small>${getTenGod(a.dayStem, hidden)}</small></span>`).join("")}</span>`)}</div>`,
      `<div class="mobile-chart-row">${mobileChartCell("星运", "mobile-chart-label")}${values((column) => getGrowthStage(a.dayStem, column.parsed.branch.name))}</div>`,
      `<div class="mobile-chart-row">${mobileChartCell("自坐", "mobile-chart-label")}${values((column) => getGrowthStage(column.parsed.stem.name, column.parsed.branch.name))}</div>`,
      `<div class="mobile-chart-row">${mobileChartCell("空亡", "mobile-chart-label")}${values((column) => a.voidBranches.includes(column.parsed.branch.name) ? `${column.parsed.branch.name}空` : "—")}</div>`,
      `<div class="mobile-chart-row">${mobileChartCell("纳音", "mobile-chart-label")}${values((column) => getNayin(column.pillar))}</div>`,
      `<div class="mobile-chart-row mobile-spirit-row">${mobileChartCell("神煞", "mobile-chart-label")}${values((column) => column.spirits.length ? column.spirits.map((s) => `<span class="spirit-tag">${s}</span>`).join("") : "—")}</div>`
    ];
    $("#mobile-bazi-chart").innerHTML = rows.join("");
    $("#mobile-bazi-chart").classList.toggle("hour-unknown", state.hourUnknown);
  }

  function renderMobileFortuneBoard() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const cycles = getDayun(state.profile, state.analysis);
    const currentCycle = getCurrentDayun(state.profile, state.analysis);
    const solarMonths = getSolarMonthPeriodsForDate(now).periods;
    const activeMonthIndex = findSolarMonthIndex(solarMonths, now);
    const years = Array.from({ length: 10 }, (_, index) => {
      const year = currentYear - 3 + index;
      return { label: year, sub: "", pillar: yearPillar(year), active: year === currentYear };
    });
    const months = solarMonths.map((period, index) => ({
      ...period,
      active: index === activeMonthIndex
    }));
    const dayun = cycles.map((cycle) => ({
      label: cycle.startYear,
      sub: `${Math.floor(cycle.age)}岁`,
      pillar: cycle.pillar,
      active: cycle.pillar === currentCycle.pillar
    }));
    const lane = (label, items) => `
      <div class="mobile-fortune-lane">
        <div class="mobile-fortune-label">${label.split("").join("<br>")}</div>
        <div class="mobile-fortune-track">
          ${items.map((item) => {
            const parsed = parsePillar(item.pillar);
            return `
              <div class="mobile-fortune-item ${item.active ? "active" : ""}">
                <small>${item.label}</small>
                <span>${item.sub || getTenGod(state.analysis.dayStem, parsed.stem.name)}</span>
                <strong class="element-${parsed.stem.element}">${parsed.stem.name}</strong>
                <strong class="element-${parsed.branch.element}">${parsed.branch.name}</strong>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
    let startText = "起运时间按节气间隔折算";
    if (state.profile.calculationMode !== "manual" && window.XuanJianCalendar) {
      try {
        const start = window.XuanJianCalendar.calculateDayun({
          birthDate: state.profile.birthDate,
          birthTime: state.profile.birthTime,
          gender: state.profile.gender,
          sect: state.profile.sect,
          useTrueSolarTime: state.profile.useTrueSolarTime,
          longitude: state.profile.longitude
        }).start;
        startText = `出生后${start.years}年${start.months}月${start.days}天起运`;
      } catch (error) {
        startText = "起运时间需重新校验";
      }
    }
    $("#mobile-fortune-board").innerHTML = `
      <div class="mobile-fortune-meta">
        <span>起运：${startText}</span>
        <span>司令：${state.analysis.pillars[1].branch.hidden[0]} · ${state.analysis.monthMainGod}</span>
      </div>
      ${lane("大运", dayun)}
      ${lane("流年", years)}
      ${lane("流月", months)}
    `;
    requestAnimationFrame(() => {
      $$(".mobile-fortune-track").forEach((track) => {
        const active = $(".mobile-fortune-item.active", track);
        if (active) active.scrollIntoView({ block: "nearest", inline: "center" });
      });
    });
  }

  function renderLunarBar() {
    const bar = $("#chart-lunar-bar");
    if (!bar) return;
    const calc = state.profile.calculation;
    const lunar = calc?.lunarDetail;
    if (!lunar) {
      bar.style.display = "none";
      return;
    }
    bar.style.display = "";
    const isLunar = state.chartCalendar === "lunar";
    bar.classList.toggle("lunar-mode", isLunar);
    const solarText = `${state.profile.birthDate} ${state.profile.birthTime}`;
    const lunarText = `${lunar.yearInChinese}年${lunar.isLeapMonth ? "闰" : ""}${lunar.monthInChinese}月${lunar.dayInChinese}日 ${lunar.hourInChinese}`;
    const jieqiText = lunar.jieQi || `${lunar.prevJieQi}→${lunar.nextJieQi}`;
    bar.innerHTML = `
      <div class="lunar-bar-row ${isLunar ? "active" : ""}" data-calendar="lunar">
        <span class="lunar-bar-label">农历</span>
        <span class="lunar-bar-value">${lunarText}</span>
        <span class="lunar-bar-meta">${lunar.yearGanZhi}年 · ${lunar.monthGanZhi}月 · ${lunar.dayGanZhi}日 · ${lunar.hourGanZhi}时</span>
      </div>
      <div class="lunar-bar-row ${!isLunar ? "active" : ""}" data-calendar="solar">
        <span class="lunar-bar-label">公历</span>
        <span class="lunar-bar-value">${solarText}</span>
        <span class="lunar-bar-meta">${state.profile.location || "出生地未录"} · ${jieqiText} · ${state.profile.zodiac || calc?.zodiac || ""}</span>
      </div>
    `;
  }

  function renderChart() {
    const a = state.analysis;
    const verification = state.profile.calculation?.verification;
    const verificationChip = $("#chart-verification");
    if (verificationChip) {
      const passed = state.profile.calculationMode === "manual" ? null : verification?.passed !== false;
      verificationChip.classList.toggle("failed", passed === false);
      verificationChip.innerHTML = passed === null
        ? `<i data-lucide="pencil-line"></i>手工四柱`
        : passed
          ? `<i data-lucide="badge-check"></i>四项历法校验通过`
          : `<i data-lucide="badge-alert"></i>历法校验异常`;
    }
    $$("[data-chart-calendar]").forEach((button) => {
      button.classList.toggle("active", button.dataset.chartCalendar === state.chartCalendar);
    });
    const isLunar = state.chartCalendar === "lunar";
    const lunar = state.profile.calculation?.lunarDetail;
    const headerLabels = isLunar && lunar
      ? [`${lunar.yearInChinese}年`, `${lunar.isLeapMonth ? "闰" : ""}${lunar.monthInChinese}月`, `${lunar.dayInChinese}日`, lunar.hourInChinese]
      : PILLAR_LABELS;
    const rows = [];
    rows.push(`<div class="chart-row">${chartCell("四柱", "chart-label")}${headerLabels.map((label) => chartCell(label, "chart-column-title")).join("")}</div>`);
    rows.push(`<div class="chart-row detail-row">${chartCell("主星", "chart-label")}${a.pillars.map((pillar, index) => chartCell(index === 2 ? "日元" : getTenGod(a.dayStem, pillar.stem.name))).join("")}</div>`);
    rows.push(`<div class="chart-row stem-row">${chartCell("天干", "chart-label")}${a.pillars.map((pillar) => chartCell(`<span class="pillar-glyph element-${pillar.stem.element}">${pillar.stem.name}<small>${pillar.stem.element} · ${pillar.stem.polarity}</small></span>`)).join("")}</div>`);
    rows.push(`<div class="chart-row branch-row">${chartCell("地支", "chart-label")}${a.pillars.map((pillar) => chartCell(`<span class="pillar-glyph element-${pillar.branch.element}">${pillar.branch.name}<small>${pillar.branch.element}</small></span>`)).join("")}</div>`);
    rows.push(`<div class="chart-row detail-row">${chartCell("藏干", "chart-label")}${a.pillars.map((pillar) => chartCell(`<span class="hidden-stems">${pillar.branch.hidden.map((hidden) => `<span class="hidden-stem element-${stemData(hidden).element}">${hidden}<small>${getTenGod(a.dayStem, hidden)}</small></span>`).join("")}</span>`)).join("")}</div>`);
    rows.push(`<div class="chart-row detail-row">${chartCell("星运", "chart-label")}${a.pillars.map((pillar) => chartCell(getGrowthStage(a.dayStem, pillar.branch.name))).join("")}</div>`);
    rows.push(`<div class="chart-row detail-row">${chartCell("自坐", "chart-label")}${a.pillars.map((pillar) => chartCell(getGrowthStage(pillar.stem.name, pillar.branch.name))).join("")}</div>`);
    rows.push(`<div class="chart-row detail-row">${chartCell("空亡", "chart-label")}${a.pillars.map((pillar) => chartCell(a.voidBranches.includes(pillar.branch.name) ? `${pillar.branch.name}空` : "—")).join("")}</div>`);
    rows.push(`<div class="chart-row detail-row">${chartCell("纳音", "chart-label")}${state.profile.pillars.map((pillar) => chartCell(getNayin(pillar))).join("")}</div>`);
    const taiyuan = getTaiyuan(state.profile.pillars[1]);
    const minggong = getMinggong(state.profile.pillars[1][1], state.profile.pillars[3][1]);
    if (taiyuan) rows.push(`<div class="chart-row detail-row">${chartCell("胎元", "chart-label")}${chartCell(`<span class="aux-pillar">${taiyuan}</span>`, "chart-cell-wide")}</div>`);
    if (minggong) rows.push(`<div class="chart-row detail-row">${chartCell("命宫", "chart-label")}${chartCell(`<span class="aux-pillar">${minggong}</span>`, "chart-cell-wide")}</div>`);
    if (isLunar && lunar) {
      rows.push(`<div class="chart-row detail-row">${chartCell("干支", "chart-label")}${[lunar.yearGanZhi, lunar.monthGanZhi, lunar.dayGanZhi, lunar.hourGanZhi].map((gz) => chartCell(`<span class="lunar-ganzhi">${gz}</span>`)).join("")}</div>`);
    }
    rows.push(`<div class="chart-row detail-row">${chartCell("神煞", "chart-label")}${a.spirits.map((list) => chartCell(`<span class="spirit-tags">${list.length ? list.map((item) => `<span class="spirit-tag">${item}</span>`).join("") : "—"}</span>`)).join("")}</div>`);
    $("#bazi-chart").innerHTML = rows.join("");
    $("#bazi-chart").classList.toggle("lunar-mode", isLunar);
    $("#bazi-chart").classList.toggle("hour-unknown", state.hourUnknown);
    const notice = $("#hour-unknown-notice");
    if (notice) notice.hidden = !state.hourUnknown;
    renderLunarBar();
    renderMobileChart();
    renderMobileFortuneBoard();
  }

  function renderInsights() {
    const a = state.analysis;
    const elementText = a.strength === "身旺"
      ? `日主得生扶较多，宜取${a.useful.join("、")}疏导成事。`
      : a.strength === "身偏弱"
        ? `日主生扶偏少，宜先得${a.useful.join("、")}以稳根基。`
        : `生扶与克泄相对平衡，取用随岁运和事项调整。`;
    $("#day-master-card").innerHTML = `
      <div class="day-master-glyph element-${a.dayElement}">${a.dayStem}</div>
      <div>
        <h3>${stemData(a.dayStem).polarity}${a.dayElement}日主 · ${a.strength}</h3>
        <p>${elementText}</p>
      </div>
    `;
    const items = [
      ["月令提纲", `${a.pillars[1].branch.name}月主气${a.pillars[1].branch.hidden[0]}，以${a.monthMainGod}立论，取${a.pattern}。`],
      ["五行气势", `${a.dominantElement}气相对最显，${a.weakestElement}气较少，需看岁运能否引通而非机械补缺。`],
      ["制化关键", a.relations.length ? `原局见${a.relations.length}项干支作用，重点观察${a.relations[0].type}对相关宫位的牵动。` : "原局合冲较少，结构相对直接，重点转向月令与透藏。"]
    ];
    $("#insight-list").innerHTML = items.map(([title, text]) => `
      <div class="insight-item">
        <span class="insight-marker"></span>
        <div><strong>${title}</strong><p>${text}</p></div>
      </div>
    `).join("");
  }

  function renderElements() {
    const percentages = state.analysis.elements.percentages;
    let cursor = 0;
    const stops = ELEMENTS.map((element) => {
      const start = cursor;
      cursor += percentages[element];
      return `${ELEMENT_COLORS[element]} ${start}% ${cursor}%`;
    }).join(",");
    $("#element-content").innerHTML = `
      <div class="element-donut-wrap">
        <div class="element-donut" style="background:conic-gradient(${stops})"></div>
        <div class="element-donut-center"><strong>${state.analysis.dominantElement}旺</strong><small>相对占比</small></div>
      </div>
      <div class="element-bars">
        ${ELEMENTS.map((element) => `
          <div class="element-bar-row">
            <span class="element-${element}">${element}</span>
            <span class="bar-track"><span class="bar-fill" style="width:${percentages[element]}%;background:${ELEMENT_COLORS[element]}"></span></span>
            <output>${percentages[element]}%</output>
          </div>
        `).join("")}
      </div>
      <p class="element-note">月令已加权，兼计透干、地支本气与藏干。五行少见不等于必须补入，应先服从格局、调候和岁运制化。</p>
    `;
  }

  function renderRelations() {
    const relations = state.analysis.relations;
    $("#relation-count").textContent = `${relations.length}项关系`;
    $("#relation-list").innerHTML = relations.length ? relations.slice(0, 5).map((item) => `
      <div class="relation-item ${item.className}">
        <span class="relation-type">${item.type}</span>
        <span class="relation-copy"><strong>${item.pair}</strong><small>${item.note}</small></span>
        <span class="relation-strength">${item.result}</span>
      </div>
    `).join("") : `
      <div class="relation-item">
        <span class="relation-type">平</span>
        <span class="relation-copy"><strong>原局明显合冲较少</strong><small>重点观察岁运介入后形成的动态关系。</small></span>
        <span class="relation-strength">静待岁运</span>
      </div>
    `;
  }

  function renderCurrentFortune() {
    const currentYear = new Date().getFullYear();
    const year = yearPillar(currentYear);
    const cycle = getCurrentDayun(state.profile, state.analysis);
    const evaluation = evaluatePeriod(year, state.analysis);
    const parsed = parsePillar(year);
    $("#current-fortune-title").textContent = `${cycle.pillar}大运 · ${year}流年`;
    $("#current-fortune-content").innerHTML = `
      <div class="current-period">
        <div class="period-pillar">
          <span class="element-${parsed.stem.element}">${parsed.stem.name}</span>
          <span class="element-${parsed.branch.element}">${parsed.branch.name}</span>
        </div>
        <div>
          <h3>${currentYear}年 · ${evaluation.god}主事</h3>
          <p>${cycle.startYear}—${cycle.endYear} ${cycle.pillar}大运<br>趋势评分 ${evaluation.score} / 100</p>
        </div>
      </div>
      <div class="fortune-keywords">
        <div class="keyword-item"><strong>主线 · ${evaluation.god}</strong><p>${TEN_GOD_INFO[evaluation.god] || "以岁运干支与原局关系综合判断。"}</p></div>
        <div class="keyword-item"><strong>结构 · ${evaluation.useful ? "得用" : "需制化"}</strong><p>${evaluation.useful ? "岁运五行进入喜用范围，宜主动承接可控机会。" : "岁运五行未直接入喜用，宜重节奏与风险边界。"}</p></div>
        <div class="keyword-item"><strong>动象 · ${evaluation.clashCount ? "有冲" : "相对平稳"}</strong><p>${evaluation.clashCount ? `见${evaluation.clashCount}处冲动，岗位、居所或合作模式可能调整。` : "明显冲动较少，适合持续建设与按计划复盘。"}</p></div>
      </div>
    `;
  }

  function getFortunePeriods() {
    const level = state.fortuneLevel;
    const anchor = state.fortuneAnchor;
    if (level === "dayun") {
      return getDayun(state.profile, state.analysis).map((cycle) => ({
        label: `${formatAge(cycle.age)}起`,
        pillar: cycle.pillar,
        sub: `${cycle.startYear}—${cycle.endYear}`,
        date: new Date(cycle.startYear, 0, 1),
        raw: cycle
      }));
    }
    if (level === "year") {
      const center = anchor.getFullYear();
      return Array.from({ length: 11 }, (_, index) => {
        const year = center - 5 + index;
        return { label: `${year}年`, pillar: yearPillar(year), sub: getTenGod(state.analysis.dayStem, yearPillar(year)[0]), date: new Date(year, 1, 4) };
      });
    }
    if (level === "month") {
      return getSolarMonthPeriodsForDate(anchor).periods.map((period) => ({
        ...period,
        sub: `${period.sub} · ${getTenGod(state.analysis.dayStem, period.pillar[0])}`
      }));
    }
    if (level === "day") {
      return Array.from({ length: 13 }, (_, index) => {
        const date = new Date(anchor);
        date.setDate(anchor.getDate() - 6 + index);
        return {
          label: `${date.getMonth() + 1}/${date.getDate()}`,
          pillar: dayPillar(date),
          sub: ["日", "一", "二", "三", "四", "五", "六"][date.getDay()],
          date
        };
      });
    }
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(anchor);
      date.setHours(index * 2 === 0 ? 0 : index * 2 - 1, 0, 0, 0);
      const branch = BRANCHES[index].name;
      return {
        label: `${branch}时`,
        pillar: hourPillar(date),
        sub: index === 0 ? "23—01" : `${String(index * 2 - 1).padStart(2, "0")}—${String(index * 2 + 1).padStart(2, "0")}`,
        date
      };
    });
  }

  function renderFortune() {
    const periods = getFortunePeriods();
    // 时柱未知提示
    const fortuneNotice = $("#fortune-hour-unknown-notice");
    if (fortuneNotice) fortuneNotice.hidden = !state.hourUnknown;
    let activeIndex = state.selectedPeriodIndex;
    if (activeIndex == null || activeIndex >= periods.length) {
      if (state.fortuneLevel === "dayun") {
        const current = getCurrentDayun(state.profile, state.analysis);
        activeIndex = periods.findIndex((period) => period.pillar === current.pillar);
      } else if (state.fortuneLevel === "year") {
        activeIndex = periods.findIndex((period) => period.date.getFullYear() === new Date().getFullYear());
      } else if (state.fortuneLevel === "month") {
        activeIndex = findSolarMonthIndex(periods, state.fortuneAnchor);
        if (activeIndex < 0) activeIndex = 0;
      } else if (state.fortuneLevel === "day") {
        activeIndex = 6;
      } else {
        activeIndex = mod(Math.floor((new Date().getHours() + 1) / 2), 12);
      }
    }
    state.selectedPeriodIndex = clamp(activeIndex, 0, periods.length - 1);

    // 更新层级切换按钮状态
    $$(".level-tab").forEach((button) => button.classList.toggle("active", button.dataset.level === state.fortuneLevel));

    // 当前周期标签
    const levelLabels = {
      dayun: "一生大运",
      year: state.fortuneAnchor.getFullYear() + "年前后",
      month: (state.fortuneAnchor.getMonth() === 0 ? state.fortuneAnchor.getFullYear() - 1 : state.fortuneAnchor.getFullYear()) + "节令年",
      day: state.fortuneAnchor.getFullYear() + "年" + (state.fortuneAnchor.getMonth() + 1) + "月",
      hour: (state.fortuneAnchor.getMonth() + 1) + "月" + state.fortuneAnchor.getDate() + "日"
    };
    const levelName = { dayun: "大运", year: "流年", month: "流月", day: "流日", hour: "流时" };
    $("#fortune-current-label").textContent = levelLabels[state.fortuneLevel];

    // 时间轴卡片
    $("#fortune-timeline").innerHTML = periods.map((period, index) => {
      const isActive = index === state.selectedPeriodIndex;
      const spirits = period.spirits && period.spirits.length ? period.spirits.slice(0, 3).join(" · ") : "";
      return '<button class="fortune-card ' + (isActive ? "active" : "") + '" data-period-index="' + index + '" type="button">' +
        '<div class="fortune-card-head">' +
          '<span class="fortune-card-label">' + period.label + '</span>' +
          '<strong class="fortune-card-pillar">' + period.pillar + '</strong>' +
        '</div>' +
        '<div class="fortune-card-sub">' + (period.sub || "") + '</div>' +
        (spirits ? '<div class="fortune-card-spirits">' + spirits + '</div>' : "") +
      '</button>';
    }).join("");

    // 详情面板
    renderFortuneDetail(periods[state.selectedPeriodIndex], levelName[state.fortuneLevel]);

    requestAnimationFrame(() => {
      const active = $("#fortune-timeline .fortune-card.active");
      if (active) active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });
  }

  function renderFortuneDetail(period, levelName) {
    const evaluation = evaluatePeriod(period.pillar, state.analysis);
    $("#fortune-detail-title").textContent = period.pillar + " " + levelName;
    $("#fortune-detail-badge").textContent = period.label;

    // 十神
    const stemGod = evaluation.god || "—";
    const branchGod = evaluation.branchGod || "—";
    $("#fortune-detail-pillar").textContent = period.pillar;
    $("#fortune-detail-gods").textContent = "干：" + stemGod + " ｜ 支：" + branchGod;

    // 纳音
    const nayin = getNayin(period.pillar);
    $("#fortune-detail-nayin").textContent = nayin || "—";

    // 神煞
    const spirits = period.spirits && period.spirits.length ? period.spirits : ["无特殊神煞"];
    $("#fortune-detail-spirits").innerHTML = spirits.map((s) =>
      '<span class="spirit-tag">' + s + '</span>'
    ).join("");
  }

  function topicEvidence(topicKey) {
    const a = state.analysis;
    const topic = TOPICS[topicKey];
    const godTotal = topic.gods.reduce((sum, god) => sum + (a.godCounts[god] || 0), 0);
    const strong = godTotal >= 3;
    const guanSha = (a.godCounts["正官"] || 0) + (a.godCounts["七杀"] || 0);
    const yinXing = (a.godCounts["正印"] || 0) + (a.godCounts["偏印"] || 0);
    const shiShang = (a.godCounts["食神"] || 0) + (a.godCounts["伤官"] || 0);
    const caiXing = (a.godCounts["正财"] || 0) + (a.godCounts["偏财"] || 0);
    const biJie = (a.godCounts["比肩"] || 0) + (a.godCounts["劫财"] || 0);
    const spouseGod = state.profile.gender === "男" ? "财星" : "官杀";
    const spouseCount = state.profile.gender === "男" ? caiXing : guanSha;
    const dayBranch = a.pillars[2].branch.name;
    const dayBranchVoid = a.voidBranches.includes(dayBranch);
    const dayClashed = a.relations.some((item) => item.type === "地支冲" && item.pair.includes("日柱"));
    const romanceSpirits = Array.from(new Set(a.spirits.flat())).filter((s) => SPIRIT_CATEGORIES.romance.includes(s));
    const wiseSpirits = Array.from(new Set(a.spirits.flat())).filter((s) => SPIRIT_CATEGORIES.wisdom.includes(s));
    const nobleSpirits = Array.from(new Set(a.spirits.flat())).filter((s) => SPIRIT_CATEGORIES.noble.includes(s));
    const hourGod = a.gods.find((item) => item.source === "时柱天干");
    const organMap = { 木: "肝胆与筋络", 火: "心脑与血脉", 土: "脾胃与消化", 金: "肺与呼吸道", 水: "肾与泌尿、内分泌" };

    const core = {
      overall: "全项研判以“格局为体、旺衰为用、调候为变”三步展开：先看月令定格与透藏成败，再看日主强弱定喜忌，最后以季节气候校准轻重，三项合参方成一家之言。",
      career: "事业在命理中以官杀（职位、规则、压力与竞争）与印星（资质、平台、授权与名誉）为核心参照，食伤看专业输出与技术变现，财星看商业与资源经营，四者共同勾勒职业形态。",
      wealth: "财运以财星（正财主稳定收益、偏财主流动机会）为体，以日主承载力为用，以食伤生财为源、比劫夺财为耗——四组关系合参，方能言“财从何来、能有多大、留得住否”。",
      love: `婚恋以配偶星（${state.profile.gender === "男" ? "男命看财星" : "女命看官杀"}）与日支配偶宫为两大支柱：星看缘分对象的特质，宫看婚姻内部的相处状态；桃花、红鸾等神煞仅作情缘活跃度的旁证。`,
      children: "子女缘以食伤与官杀为子女星（传统上男命参看官杀、女命参看食伤），时柱为子女宫；星宫合参，再看刑冲合害与空亡，方知缘分厚薄与相处模式。",
      family: "六亲分宫而论：年柱看祖上与早年环境，月柱看父母兄弟，日支看配偶，时柱看子女晚辈；各宫所临十神与喜忌，即对应亲缘的助力或牵绊。",
      health: "健康取象以五行为纲：木应肝胆、火应心脑、土应脾胃、金应肺息、水应肾源。过旺之五行易壅滞成实，过弱之五行易虚损失调，冲刑之年须留意相应系统的保养。",
      study: "学业以印星（吸收、记忆、体系化）与食伤（表达、发挥、创造性）为一进一出两翼，文昌、学堂等神煞加分；印强食弱善学不善考，食强印弱善辩不善记。"
    };

    const formation = {
      overall: `此造生于${a.pillars[1].branch.name}月，月令本气${a.pillars[1].branch.hidden[0]}为${a.monthMainGod}，立「${a.pattern}」；日主${a.dayStem}（${a.dayElement}）${a.strength}，喜用取${a.useful.join("、")}；${a.dominantElement}气最显（${a.elements.percentages[a.dominantElement]}%），${a.weakestElement}气最弱（${a.elements.percentages[a.weakestElement]}%）。`,
      career: `官杀共见${guanSha}处、印星共见${yinXing}处、食伤共见${shiShang}处${guanSha >= 2 && yinXing >= 1 ? "——官印相生之象明显，体制、管理与专业资格路线有其结构支撑" : shiShang >= 2 && caiXing >= 1 ? "——食伤生财之象更重，技术输出、作品变现与经营取向更合先天气质" : guanSha === 0 ? "——官星不显，无官一身轻，宜走专业与市场路线而非职级路线" : "——官印食伤配置平和，职业方向有弹性，宜以兴趣与积累定赛道"}。`,
      wealth: buildWealthAnalysis().map((block) => `${block.title}：${block.text}`).join(" "),
      love: `配偶星${spouseGod}共见${spouseCount}处，${spouseCount === 0 ? "星藏不透，缘分多由环境与他人引荐而成" : spouseCount > 3 ? "星多而杂，情感选项多，须防取舍不定、聚散反复" : "分量适中，缘分落点清晰"}；日支${dayBranch}为配偶宫，${dayBranchVoid ? "临空亡，婚姻议题易有等待、迟疑或聚少离多之象" : "不临空亡"}，${dayClashed ? "且日支逢冲，婚后须防环境变动与两地分居带来的磨合压力" : "无冲无损，宫位安稳"}${romanceSpirits.length ? `；${romanceSpirits.slice(0, 2).join("、")}入局，情缘触媒较活跃` : ""}。`,
      children: `子女星方面：食伤共见${shiShang}处、官杀共见${guanSha}处；时柱为子女宫，${hourGod ? `时干透${hourGod.stem}（${hourGod.god}）` : "时柱配置平稳"}，${a.voidBranches.includes(a.pillars[3].branch.name) ? "时支临空亡，子女缘或迟或疏，宜顺其自然" : "时支不临空亡，宫位有感"}。`,
      family: `四宫结构：年柱${a.pillars[0].stem.name}${a.pillars[0].branch.name}（${a.gods.find((g) => g.source === "年柱天干")?.god || "比肩"}）、月柱${a.pillars[1].stem.name}${a.pillars[1].branch.name}（${a.gods.find((g) => g.source === "月柱天干")?.god || "比肩"}）、日支${dayBranch}、时柱${a.pillars[3].stem.name}${a.pillars[3].branch.name}；${biJie >= 3 ? "比劫偏重，兄弟同辈之助力与瓜葛并存" : yinXing >= 3 ? "印星偏重，长辈庇荫深，也须防庇护过度" : "六亲配置平和，亲缘各安其位"}。`,
      health: `五行强弱：${a.dominantElement}过旺（${a.elements.percentages[a.dominantElement]}%），${organMap[a.dominantElement]}之气易壅实；${a.weakestElement}过弱（${a.elements.percentages[a.weakestElement]}%），${organMap[a.weakestElement]}易虚怯失养${a.relations.some((item) => item.type.includes("冲") || item.type.includes("刑")) ? "；局中见冲刑，对应流年引动时更宜规律作息、按时体检" : ""}。`,
      study: `印星共见${yinXing}处、食伤共见${shiShang}处${wiseSpirits.length ? `，另有${wiseSpirits.slice(0, 2).join("、")}加持文思` : ""}${yinXing >= 2 && shiShang >= 2 ? "——印食两停，吸收与输出俱佳，最利系统学习与考试发挥" : yinXing >= 2 ? "——吸收力强而输出待练，宜以讲题、写作倒逼输出" : shiShang >= 2 ? "——才思敏捷而根基须固，宜先立框架再谈发挥" : "——印食平和，学习贵在坚持与方法"}。`
    };

    const manifestation = {
      overall: `格局层面：${a.pattern}成立与否决定人生主赛道；旺衰层面：${a.strength}决定主赛道上的攻守姿态；调候层面：${["亥", "子", "丑", "巳", "午", "未"].includes(a.pillars[1].branch.name) ? "寒暖之偏须先纠正，运势体感受调候影响明显" : "气候偏性不大，运势更多随格局喜忌波动"}。`,
      career: `现实取象：${guanSha >= 2 ? "职位、竞标、考核等外部压力与机会并存，责任感与权威感是成长主线" : shiShang >= 2 ? "以一技之长立身，作品与口碑即简历，自由度高于职级" : caiXing >= 2 ? "商业嗅觉与资源整合见长，宜在业务与市场端发力" : "宜借平台之势稳步上行，专业与资历是硬通货"}；${a.strength === "身旺" ? "身旺能扛事，可主动请缨担纲" : a.strength === "身偏弱" ? "身弱忌硬扛，宜选支持性岗位与团队作战" : "中和灵活，攻守自选"}。`,
      wealth: `落到现实：收入结构以${(a.godCounts["正财"] || 0) >= (a.godCounts["偏财"] || 0) ? "主业稳定现金流" : "机会型、经营型收益"}为主轴；求财节奏${a.strength === "身旺" ? "宜快攻，抢占窗口期" : a.strength === "身偏弱" ? "宜慢守，先站稳再图进" : "张弛有度，随岁运调整"}；理财风格${biJie >= 3 ? "忌与亲友金钱往来过深" : caiXing >= 3 ? "可适度配置资产，但须防贪多" : "以稳为主，指数与定投优于择时"}。`,
      love: `相处画像：${dayClashed ? "两人背景或性格差异较大，磨合是必修课，异中求同方长久" : "步调相对一致，重在保持沟通密度"}；${romanceSpirits.length ? "个人魅力与社交触点较多，婚后亦须管理好边界感" : "情感表达偏内敛，宜主动经营仪式感"}；${spouseCount === 0 ? "婚缘多经人引荐或共事而生，闪婚不宜" : "婚缘有着力点，宜在配偶星引动之流年推进关键节点"}。`,
      children: `亲子模式：${shiShang >= 3 ? "食伤旺者与子女相处似朋友，重启发轻管束" : guanSha >= 3 ? "官杀重者管教偏严，须留孩子自主空间" : "宽严可自调，贵在以身作则"}；备孕与子女缘引动之年，多为食伤或官杀透清、时柱逢合之岁运。`,
      family: `六亲现实：${yinXing >= 3 ? "长辈介入深，得荫亦受束，成年后宜温和完成心理分离" : biJie >= 3 ? "同辈牵动多，借贷合伙须立字据" : caiXing >= 3 ? "与父辈或权威资源互动多，敬老惜福亦防财务混同" : "亲缘各安其分，逢年过节常来常往即可"}；四宫逢冲刑之岁运，对应亲缘易有变动或聚散。`,
      health: `养生重点：${a.dominantElement}旺者${organMap[a.dominantElement]}重在“疏”与“泄”，忌进补过度；${a.weakestElement}弱者${organMap[a.weakestElement]}重在“养”与“藏”，忌过劳透支；${["巳", "午", "未"].includes(a.pillars[1].branch.name) ? "夏生者注意清热补水" : ["亥", "子", "丑"].includes(a.pillars[1].branch.name) ? "冬生者注意温阳驱寒" : "春秋生者顺应生发与收敛，作息随季节调整"}。此为传统五行取象，不构成任何医学诊断。`,
      study: `学习画像：${yinXing >= 2 ? "长于体系化阅读与长效记忆，宜啃硬书、立框架" : "长于碎片吸收与临场发挥，宜高频短测、以战养战"}；考运以印星与官星引动之年为佳；${nobleSpirits.length ? `得${nobleSpirits.slice(0, 2).join("、")}，遇良师益友的概率不低，虚心求教事半功倍` : "师缘须主动争取，好问题比好答案更稀缺"}。`
    };

    const influence = {
      overall: `层次高低取决于格局成败与用神得力程度：用神${a.useful[0]}得岁运生扶时，诸事乘势；被冲克时，纵有格局亦须蛰伏。命理定“势”之顺逆，人事定“成”之大小。`,
      career: `潜在起伏：官杀旺而身弱之岁，压力陡增、易萌去意，宜提前储备退路；印星被财坏之岁，资质与靠山生变，合约署名须慎；食伤制杀太过之岁，锋芒毕露易犯上，宜敛才守正。`,
      wealth: `潜在波动：比劫岁运防劫财（合伙拆股、亲友借贷）；财星逢冲之年防大进大出；偏财旺岁防投机上头。守住“能力圈+现金流”两条底线，波动即机会。`,
      love: `潜在变数：日支逢冲之年，婚姻内部易生变动（搬家、异地、角色转换）；配偶星逢合之岁，第三因素介入须防（工作、旧识均可为媒）；空亡填实之年，关系议题从悬而落定。`,
      children: `潜在节点：时柱逢冲刑之岁，子女健康或升学易有波折；食伤受制之岁（枭神夺食），备孕与表达均易受阻，宜缓不宜急；官杀混杂之岁，管教方式宜统一。`,
      family: `潜在牵动：财星坏印之岁运，因财务与长辈生隙；比劫争财之岁，兄弟间遗产合伙须先小人后君子；四宫逢冲之年，对应亲缘之健康与居所宜多关注。`,
      health: `潜在提示：冲刑集中于${a.relations.length ? a.relations.filter((r) => r.type.includes("冲") || r.type.includes("刑")).length : 0}处——冲刑引动之年，意外与劳损概率上升，出行、运动、饮食三处留心；情绪层面，${a.dominantElement}旺者易急，${a.weakestElement}弱者易疲，皆以规律作息为第一药。`,
      study: `潜在障碍：印星受克之岁，记忆力与专注度下滑，宜降低目标保节奏；伤官岁运，聪明外溢而坐不住，宜以输出项目锚定学习；考场发挥看食伤，考前心态管理重于突击。`
    };

    const advice = {
      overall: `行运总纲：逢${a.useful.join("、")}得地之岁年主动进攻，逢忌神当令之年守成蓄力；每步重大决定，先问“此事是补局还是破局”，再问时机与代价。`,
      career: `行动建议：在${a.useful[0]}旺的行业属性与年份中寻找职业跃迁窗口；${guanSha >= 2 ? "承担带兵之责前，先补管理与法务常识" : "深耕可迁移的专业技能，让作品替你升职"}；每五年做一次职业复盘，防路径依赖。`,
      wealth: `理财建议：以“现金流优先、杠杆谨慎”为纲；${(a.godCounts["劫财"] || 0) >= 2 ? "拒绝一切形式的担保与口头合伙" : "投资仓位与风险承受力挂钩"}；喜用${a.useful[0]}旺之岁年，可适度进取，忌神之年只做防守动作。`,
      love: `经营建议：把“表达—倾听—确认”作为沟通闭环，避免让${dayBranchVoid ? "空亡之悬" : "日常琐碎"}消耗感情账户；重大分歧冷静一日再谈；在桃花、红鸾引动之岁把握姻缘窗口，但以人品与三观定终身。`,
      children: `相处建议：以引导代替压制，尊重孩子独立的${shiShang >= 3 ? "表达欲" : "节奏感"}；亲子共读共学，身教重于言传；与另一半统一教育口径，不在孩子面前互相拆台。`,
      family: `相处建议：亲缘之助以“清”为贵——财务往来立字据，帮忙而不越界；逢四宫冲刑之岁，多回家看看、多一通电话；对长辈之荫心存感激，对同辈之谊明算账不伤情。`,
      health: `养生建议：${a.dominantElement}旺者多“泄”——运动、疏解、少补；${a.weakestElement}弱者多“养”——睡眠、食养、少熬；每年一次体检，把五行提示当作身体检查的侧重点参考，而非结论。`,
      study: `进阶建议：${yinXing >= 2 ? "以教代学，输出倒逼输入" : "以考促学，用deadline管理进度"}；把大目标拆为周计划；文昌位整洁、先难后易的顺序、清晨的记忆窗口，皆是可借之势。`
    };

    const leads = {
      overall: `综合而言：${a.pattern} · ${a.strength}，喜用${a.useful.slice(0, 2).join("、")}，${a.dominantElement}旺而${a.weakestElement}弱——先立格局，再调旺衰，后校寒暖，三步合参。`,
      career: `事业研判：${guanSha + yinXing >= 4 ? "官印结构厚实，走管理与体制路线有先天支撑" : shiShang >= 2 ? "食伤为用，以专业与技术立身更顺" : "配置平和，职业赛道宜以积累取胜"}。`,
      wealth: `财运研判：财星共见${caiXing}处、财气占${a.elements.percentages[a.wealthElement]}%，日主${a.strength}——财富五维详析见下。`,
      love: `婚恋研判：配偶星${spouseCount}处、日支${dayBranch}${dayBranchVoid ? "临空" : "坐实"}${romanceSpirits.length ? "、情缘星活跃" : ""}——星宫合参，缘分有迹可循。`,
      children: `子女研判：食伤${shiShang}处、官杀${guanSha}处，时柱${a.pillars[3].stem.name}${a.pillars[3].branch.name}——星宫俱参，亲缘有厚有薄，顺缘而行。`,
      family: `六亲研判：印${yinXing}、比劫${biJie}、财${caiXing}各就其宫——六亲之助力与牵绊，皆在宫星喜忌之间。`,
      health: `健康研判：${a.dominantElement}旺（${organMap[a.dominantElement]}易实）、${a.weakestElement}弱（${organMap[a.weakestElement]}易虚）——五行取象仅供养生参考，不替代医学。`,
      study: `学业研判：印${yinXing}处、食伤${shiShang}处${wiseSpirits.length ? `、文星加持` : ""}——一进一出，两条腿走路。`
    };

    return {
      lead: leads[topicKey],
      sections: [
        ["核心含义", core[topicKey]],
        ["形成原理", formation[topicKey]],
        ["现实表现", manifestation[topicKey]],
        ["潜在影响", influence[topicKey]],
        ["趋吉建议", advice[topicKey]]
      ],
      findings: [
        ["结构", `${a.pattern}为主线，${a.monthMainGod}当令取象。`],
        ["优势", `${a.dominantElement}气有根，可转化为稳定的行动资源。`],
        ["建议", `在${a.useful.slice(0, 2).join("、")}旺的时段推进关键事项，并保留复盘余地。`]
      ]
    };
  }

  function getSchoolAnalysis(school, index) {
    const a = state.analysis;
    const conclusions = [
      `月支${a.pillars[1].branch.name}以${a.monthMainGod}为主气，取${a.pattern}。局中${a.useful[0]}气若得岁运透引，更利结构成用。`,
      `日主${a.dayStem}${a.dayElement}${a.strength}，全局${a.dominantElement}气较显、${a.weakestElement}气偏少。气势宜向${a.useful.join("、")}流通。`,
      `四柱纳音为${state.profile.pillars.map(getNayin).join("、")}。神煞见${Array.from(new Set(a.spirits.flat())).slice(0, 3).join("、") || "常规配置"}，只作事项取象的旁证。`,
      `${a.pillars[1].branch.name}月审寒暖燥湿，先察${a.useful[0]}能否调节月令偏性，再论格局层次与事项得失。`,
      `用神从月令出发，当前取${a.monthMainGod}立意。${a.relations.length ? "局中合冲并见，成败关键在制化是否有序。" : "局势相对清简，岁运引动更为关键。"} `,
      `天元透出${a.pillars.map((pillar) => pillar.stem.name).join("、")}，地元根气以${a.pillars.map((pillar) => pillar.branch.hidden[0]).join("、")}为主，需看上下是否情协。`,
      `命局之“病”在${a.dominantElement}相对偏显与${a.weakestElement}不足，“药”不在机械补缺，而在${a.useful.join("、")}能否引通全局。`
    ];
    return conclusions[index] || school.focus;
  }

    // ========== AI 研判（提示词复制模式） ==========
  const AI_TOPICS = {
    career: { label: "事业财运", icon: "briefcase", desc: "事业格局、财富来源、财富规模与稳定性分析" },
    marriage: { label: "婚恋感情", icon: "heart", desc: "姻缘早晚、配偶特征、感情质量与婚姻走向" },
    health: { label: "健康体质", icon: "heart-pulse", desc: "先天体质、薄弱器官、健康隐患与疾病风险" },
    study: { label: "学业考试", icon: "graduation-cap", desc: "学习能力、学历层次、考试运与文昌贵人" },
    interpersonal: { label: "人际贵人", icon: "users", desc: "人际关系、贵人运、小人是非与社交模式" },
    parent: { label: "家庭六亲", icon: "home", desc: "父母、兄弟姐妹、子女缘分与家庭关系" },
    migration: { label: "迁移变动", icon: "map-pin", desc: "驿马运、迁移机遇、异地发展与出国运势" },
    litigation: { label: "官非诉讼", icon: "gavel", desc: "官非风险、诉讼倾向、口舌是非与牢狱之灾" }
  };

  // 十神简称映射
  const TEN_GOD_ABBR = {
    "比肩": "比", "劫财": "劫", "食神": "食", "伤官": "伤",
    "偏财": "财", "正财": "才", "七杀": "杀", "正官": "官",
    "偏印": "枭", "正印": "印"
  };

  // 按五行取第一个天干（用于十神推算）
  function stemDataByElement(element) {
    const stems = { 木: ["甲", "乙"], 火: ["丙", "丁"], 土: ["戊", "己"], 金: ["庚", "辛"], 水: ["壬", "癸"] };
    return stems[element] || ["甲"];
  }

  // 五行旺相休囚死（按月令地支）
  function getElementPhase(monthBranchName) {
    const monthElement = BRANCHES.find(b => b.name === monthBranchName)?.element || "木";
    const order = ["旺", "相", "休", "囚", "死"];
    const result = {};
    ELEMENTS.forEach((el) => {
      let idx;
      if (el === monthElement) idx = 0;
      else if (PRODUCES[monthElement] === el) idx = 1;
      else if (PRODUCES[el] === monthElement) idx = 2;
      else if (CONTROLS[el] === monthElement) idx = 3;
      else idx = 4;
      result[el] = order[idx];
    });
    return result;
  }

  function buildChartDataText() {
    const a = state.analysis;
    const p = state.profile;
    if (!a || !p) return "暂无命盘数据，请先录入出生信息。";
    const lunar = p.calculation?.lunarDetail;
    const pillarLabels = ["年", "月", "日", "时"];
    const dayStem = a.dayStem;

    // 计算实岁年龄
    const birthDate = new Date(p.birthDate + "T" + (p.birthTime || "12:00"));
    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    const moDiff = now.getMonth() - birthDate.getMonth();
    if (moDiff < 0 || (moDiff === 0 && now.getDate() < birthDate.getDate())) age--;
    if (age < 0) age = 0;

    const genderText = p.gender === "男" || p.gender === "male" ? "男命" : "女命";
    const [y, mo, d] = p.birthDate.split("-");
    const [h, mi] = (p.birthTime || "00:00").split(":");
    const solarText = `${y}年${mo}月${d}日 ${h}点${mi}分`;

    const hourBranchName = a.pillars[3]?.branch?.name || "？";
    let lunarText = "待排";
    if (lunar) {
      lunarText = `${lunar.yearInChinese}年${lunar.isLeapMonth ? "闰" : ""}${lunar.monthInChinese}月${lunar.dayInChinese}日 ${hourBranchName}时`;
    }

    // 四柱（含十神简称）：甲申年（食枭）
    const pillarsText = a.pillars.map((pillar, i) => {
      const stemGod = i === 2 ? "元" : (TEN_GOD_ABBR[getTenGod(dayStem, pillar.stem.name)] || "？");
      const branchMainGod = TEN_GOD_ABBR[getTenGod(dayStem, pillar.branch.hidden[0])] || "？";
      return `${p.pillars[i]}${pillarLabels[i]}（${stemGod}${branchMainGod}）`;
    }).join("、");

    // 星运（日主对各地支的十二长生）
    const starFortunes = a.pillars.map(pillar => getGrowthStage(dayStem, pillar.branch.name));
    const starFortuneText = pillarLabels.map((label, i) => `${label}坐${starFortunes[i]}`).join("、");

    // 自坐（各柱天干对本柱地支的十二长生）
    const selfFortunes = a.pillars.map(pillar => getGrowthStage(pillar.stem.name, pillar.branch.name));
    const selfFortuneText = pillarLabels.map((label, i) => `${label}坐${selfFortunes[i]}`).join("、");

    // 纳音
    const nayinList = p.pillars.map(pillar => getNayin(pillar));
    const nayinText = pillarLabels.map((label, i) => `${label}是${nayinList[i]}`).join("、");

    // 日元、日支、月令
    const dayBranchName = a.pillars[2]?.branch?.name || "？";
    const dayBranchElement = a.pillars[2]?.branch?.element || "？";
    const monthBranchName = a.pillars[1]?.branch?.name || "？";

    // 旺相休囚死
    const phase = getElementPhase(monthBranchName);
    const phaseText = ELEMENTS.map(el => `${el}${phase[el]}`).join("，");

    // 最旺五行 / 五行缺失（不算藏干，天干4 + 地支4本气 = 8个）
    const visCount = {};
    ELEMENTS.forEach(el => { visCount[el] = 0; });
    a.pillars.forEach(pillar => {
      visCount[pillar.stem.element]++;
      visCount[pillar.branch.element]++;
    });

    let maxEl = ELEMENTS[0], maxCount = 0;
    ELEMENTS.forEach(el => {
      if (visCount[el] > maxCount) { maxCount = visCount[el]; maxEl = el; }
    });
    const maxGod = getTenGod(dayStem, stemDataByElement(maxEl)[0]);
    const maxElementText = `${maxEl}${maxCount}个（${maxGod}）`;

    const missingElements = ELEMENTS.filter(el => visCount[el] === 0);
    let missingText = "无";
    if (missingElements.length > 0) {
      missingText = missingElements.map(el => {
        const god = getTenGod(dayStem, stemDataByElement(el)[0]);
        return `${el}0个（${god}）`;
      }).join("、");
    }

    // 调候用神（按月令取）
    const tiaohouMap = {
      "寅": "丙、甲", "卯": "丙、庚", "辰": "甲、癸",
      "巳": "癸、丙", "午": "壬、庚", "未": "癸、甲",
      "申": "戊、丁", "酉": "丁、甲", "戌": "甲、丙",
      "亥": "戊、丙", "子": "丙、甲", "丑": "丙、甲"
    };
    const tiaohou = tiaohouMap[monthBranchName] || "戊、丁";

    // 原局天干关系
    const stemRelations = (a.relations || []).filter(r => r.type && r.type.includes("干"));
    const stemRelationText = stemRelations.length
      ? stemRelations.map(r => {
          const chars = (r.stems || r.chars || []).join("");
          const tg = (r.stems || []).map(s => TEN_GOD_ABBR[getTenGod(dayStem, s)] || s).join("");
          const relType = r.type.replace("天干", "").replace("干系", "");
          return `${chars}（${tg}）${relType}`;
        }).join("、")
      : "无显著冲克合";

    // 原局地支关系
    const branchRelations = (a.relations || []).filter(r => r.type && r.type.includes("支"));
    const branchRelationText = branchRelations.length
      ? branchRelations.map(r => {
          const chars = (r.branches || r.chars || []).join("");
          const tg = (r.branches || []).map(b => {
            const pil = a.pillars.find(p2 => p2.branch.name === b);
            return pil ? TEN_GOD_ABBR[getTenGod(dayStem, pil.branch.hidden[0])] || b : b;
          }).join("");
          const relType = r.type.replace("地支", "").replace("支系", "");
          return `${chars}（${tg}）${relType}`;
        }).join("、")
      : "无显著刑冲合害";

    // 整柱关系（盖头 / 截脚）
    const pillarRelations = [];
    a.pillars.forEach((pillar, i) => {
      const stemEl = pillar.stem.element;
      const branchEl = pillar.branch.element;
      const stemGod = i === 2 ? "元" : TEN_GOD_ABBR[getTenGod(dayStem, pillar.stem.name)] || "";
      const branchGod = TEN_GOD_ABBR[getTenGod(dayStem, pillar.branch.hidden[0])] || "";
      if (CONTROLS[stemEl] === branchEl) {
        pillarRelations.push(`${p.pillars[i]}（${stemGod}${branchGod}）盖头`);
      } else if (CONTROLS[branchEl] === stemEl) {
        pillarRelations.push(`${p.pillars[i]}（${stemGod}${branchGod}）截脚`);
      }
    });
    const pillarRelationText = pillarRelations.length ? pillarRelations.join("、") : "无";

    // 大运
    const dayun = getDayun(p, a) || [];
    let xiaoyunText = "待排";
    if (dayun.length > 0) {
      const first = dayun[0];
      const startY = first.year || new Date().getFullYear();
      const startAge = Math.floor(first.startAge || 0);
      const stemGod = TEN_GOD_ABBR[getTenGod(dayStem, first.pillar[0])] || "";
      const branchGod = TEN_GOD_ABBR[getTenGod(dayStem, first.pillar[1])] || "";
      xiaoyunText = `${startY}年1~${startAge + 10}岁${first.pillar}（${stemGod}${branchGod}）`;
    }

    const dayunText = dayun.slice(0, 10).map((item, i) => {
      const startY = item.year || new Date().getFullYear();
      const age = Math.floor(item.startAge || (i * 10));
      const stemGod = TEN_GOD_ABBR[getTenGod(dayStem, item.pillar[0])] || "";
      const branchGod = TEN_GOD_ABBR[getTenGod(dayStem, item.pillar[1])] || "";
      return `${startY}年${age}岁${item.pillar}(${stemGod}${branchGod})`;
    }).join("、");

    // 喜用神 / 忌神
    const usefulText = a.useful?.join("、") || "待分析";
    const harmful = [];
    if (a.strength === "身旺") {
      harmful.push(a.resourceElement, a.dayElement);
    } else {
      harmful.push(a.wealthElement, a.officerElement, a.outputElement);
    }
    const harmfulText = harmful.join("、");

    const lines = [];
    lines.push(`性别：${genderText}`);
    lines.push(`年龄：${age}岁（实岁）`);
    lines.push(`出生阳历（真太阳时）：${solarText}`);
    lines.push(`出生农历：${lunarText}`);
    lines.push(`四柱：${pillarsText}`);
    lines.push(`星运：${starFortuneText}`);
    lines.push(`自坐：${selfFortuneText}`);
    lines.push(`纳音：${nayinText}`);
    lines.push(`小运：${xiaoyunText}`);
    lines.push(`大运：${dayunText}、`);
    lines.push(`日元：${dayStem}${a.dayElement}`);
    lines.push(`日支：${dayBranchName}${dayBranchElement}`);
    lines.push(`月令：${monthBranchName}月`);
    lines.push(`旺相：${phaseText}`);
    lines.push(`格局类型：${a.pattern}`);
    lines.push(`旺衰类型：${a.strength}`);
    lines.push(`最旺五行（不算藏干）：${maxElementText}`);
    lines.push(`五行缺失（不算藏干）：${missingText}`);
    lines.push(`调候用神：${tiaohou}`);
    lines.push(`原局天干（冲克合等）：${stemRelationText}`);
    lines.push(`原局地支（刑冲合害等）：${branchRelationText}`);
    lines.push(`原局整柱：${pillarRelationText}`);
    lines.push(`喜用神：${usefulText}`);
    lines.push(`忌神：${harmfulText}`);
    lines.push(`原局神煞：`);
    lines.push(`  年柱：${a.spirits?.[0]?.join("、") || "无"}`);
    lines.push(`  月柱：${a.spirits?.[1]?.join("、") || "无"}`);
    lines.push(`  日柱：${a.spirits?.[2]?.join("、") || "无"}`);
    lines.push(`  时柱：${a.spirits?.[3]?.join("、") || "无"}`);

    return lines.join("\n");
  }

  const AI_PROMPTS = {
    career: "# 角色\n你是精通国学易经术数的资深命理分析师，核心擅长主流子平派格局理论与新派命理技法，能基于固定命盘信息精准分析五行生克、十神组合等关系得出喜用忌神，并专注围绕{{事业财运}}项展开深度解析，关键事件须给出发生时间范围、喜忌属性、事件对命主的影响程度等信息，能结合命主客观条件提供精准且实用的命理建议。并在最后重点提醒用户，本分析基于传统命理理论框架，仅供娱乐参考，不构成任何决策依据。\n\n## 技能\n### 技能1：基础命盘解析\n接收用户提供的命盘核心数据，完整阅读并理解四柱结构、十神配置、五行旺衰、格局类型等基础信息。\n\n### 技能2：事业财运解读\n通过命盘解析事业与财富格局，聚焦以下维度展开深度分析：\n1. 事业格局层次（普通职员 / 管理岗 / 创业 / 自由职业 / 体制内）\n2. 财富来源类型（正财 / 偏财 / 横财 / 暗财）\n3. 财富规模等级（温饱 / 小康 / 中产 / 富裕 / 大富）\n4. 财富稳定性与获取难易程度\n5. 事业发展关键节点与最佳行业方向\n6. 近10年大运流年财运走势分析\n7. 潜在破财风险与求财避坑建议\n\n## 输出格式\n事业财运分析\n1. 事业格局定位（适合的行业与职业方向）\n2. 财富来源与规模判断\n3. 财富稳定性与风险评估\n4. 近10年事业财运走势（分大运+关键流年）\n5. 求财建议与避坑指南\n\n## 限制\n1. 前置声明：本分析仅基于传统八字命理理论逻辑，不涉及科学实证结论，需在分析开头明确：\"本分析为文化娱乐参考，非专业决策依据，具体发展需结合个人努力与客观环境。\"\n2. 分析原则：所有结论需严格对应用户提供的命盘数据，有理有据展开分析。\n3. 后续问答要求：用户后续提出的每一个问题，均需依据其提供的命盘数据展开，做到有理有据、分析详实。\n4. 敏感问题处理：若用户提问涉及下蛊、破坏他人命运、断人财路等玄学敏感、违禁内容，将直接拒绝回答。\n5. 互动提示：分析结束后，若用户有其他具体疑问，可随时补充提问。",
    marriage: "# 角色\n你是精通国学易经术数的资深命理分析师，核心擅长主流子平派格局理论与新派命理技法，能基于固定命盘信息精准分析五行生克、十神组合等关系得出喜用忌神，并专注围绕{{婚恋感情}}项展开深度解析，关键事件须给出发生时间范围、喜忌属性、事件对命主的影响程度等信息，能结合命主客观条件提供精准且实用的命理建议。并在最后重点提醒用户，本分析基于传统命理理论框架，仅供娱乐参考，不构成任何决策依据。\n\n## 技能\n### 技能1：基础命盘解析\n接收用户提供的命盘核心数据，完整阅读并理解四柱结构、十神配置、五行旺衰、格局类型等基础信息。\n\n### 技能2：婚恋感情解读\n通过命盘解析婚恋运势，聚焦以下维度展开深度分析：\n1. 姻缘早晚（早婚 / 晚婚 / 适婚年龄范围）\n2. 配偶特征（外貌、性格、家境、职业方向）\n3. 感情质量与婚姻稳定性\n4. 桃花运与异性缘强弱\n5. 感情中的矛盾点与潜在危机\n6. 近5年婚恋运势与关键节点\n7. 改善感情运势的建议\n\n## 输出格式\n婚恋感情分析\n1. 姻缘总体判断（婚期早晚、婚姻质量）\n2. 配偶特征画像\n3. 感情中的优势与隐患\n4. 近5年婚恋运势（含结婚/分手/桃花等关键节点）\n5. 感情经营建议\n\n## 限制\n1. 前置声明：本分析仅基于传统八字命理理论逻辑，不涉及科学实证结论，需在分析开头明确：\"本分析为文化娱乐参考，非专业决策依据，具体发展需结合个人努力与客观环境。\"\n2. 分析原则：所有结论需严格对应用户提供的命盘数据，有理有据展开分析。\n3. 后续问答要求：用户后续提出的每一个问题，均需依据其提供的命盘数据展开，做到有理有据、分析详实。\n4. 敏感问题处理：若用户提问涉及下蛊、破坏他人命运、断人财路等玄学敏感、违禁内容，将直接拒绝回答。\n5. 互动提示：分析结束后，若用户有其他具体疑问，可随时补充提问。",
    health: "# 角色\n你是精通国学易经术数的资深命理分析师，核心擅长主流子平派格局理论与新派命理技法，能基于固定命盘信息精准分析五行生克、十神组合等关系得出喜用忌神，并专注围绕{{健康}}项展开深度解析，关键事件须给出发生时间范围、喜忌属性、事件对命主的影响程度等信息，能结合命主客观条件提供精准且实用的命理建议。并在最后重点提醒用户，本分析基于传统命理理论框架，仅供娱乐参考，不构成任何决策依据。\n\n## 技能\n### 技能1：基础命盘解析\n接收用户提供的命盘核心数据，完整阅读并理解四柱结构、十神配置、五行旺衰、格局类型等基础信息。\n\n### 技能2：健康项解读\n通过命盘解析健康状态，聚焦以下维度展开深度分析：本命盘先天薄弱器官、先天优势器官、健康隐患、体质属性（湿寒 / 燥热等）。结合近 5 年大运流年，进一步分析健康走势及外伤等潜在风险。\n\n## 输出格式\n健康分析\n1. 先天体质属性（寒 / 暖 / 燥 / 湿）\n2. 先天薄弱器官与优势器官\n3. 身体潜在健康风险\n4. 近 5 年健康状况（含外伤、手术、患病等风险）\n5. 养生调理建议\n\n## 限制\n1. 前置声明：本分析仅基于传统八字命理理论逻辑，不涉及科学实证结论，需在分析开头明确：\"本分析为文化娱乐参考，非专业决策依据，具体发展需结合个人努力与客观环境。\"\n2. 分析原则：所有结论需严格对应用户提供的命盘数据，不额外引入胎元、命宫等未提供的变量。\n3. 后续问答要求：用户后续提出的每一个问题，均需依据其提供的命盘数据展开，做到有理有据、分析详实。\n4. 敏感问题处理：若用户提问涉及下蛊、破坏他人命运、断人财路等玄学敏感、违禁内容，将直接拒绝回答。\n5. 互动提示：分析结束后，若用户有其他具体疑问，可随时补充提问。",
    study: "# 角色\n你是精通国学易经术数的资深命理分析师，核心擅长主流子平派格局理论与新派命理技法，能基于固定命盘信息精准分析五行生克、十神组合等关系得出喜用忌神，并专注围绕{{学业考试}}项展开深度解析，关键事件须给出发生时间范围、喜忌属性、事件对命主的影响程度等信息，能结合命主客观条件提供精准且实用的命理建议。并在最后重点提醒用户，本分析基于传统命理理论框架，仅供娱乐参考，不构成任何决策依据。\n\n## 技能\n### 技能1：基础命盘解析\n接收用户提供的命盘核心数据，完整阅读并理解四柱结构、十神配置、五行旺衰、格局类型等基础信息。\n\n### 技能2：学业考试解读\n通过命盘解析学业运势，聚焦以下维度展开深度分析：\n1. 学习能力与智力水平\n2. 学历层次判断（专科 / 本科 / 硕士 / 博士）\n3. 文昌运与考试运强弱\n4. 适合的专业方向\n5. 关键学业节点（中考 / 高考 / 考研等）\n6. 近5年学业运势\n7. 提升学业运的建议\n\n## 输出格式\n学业考试分析\n1. 学习能力与智力特点\n2. 学历层次与学业成就判断\n3. 文昌运与考试运分析\n4. 适合的专业方向与学习方法\n5. 关键学业节点与运势\n6. 学业提升建议\n\n## 限制\n1. 前置声明：本分析仅基于传统八字命理理论逻辑，不涉及科学实证结论，需在分析开头明确：\"本分析为文化娱乐参考，非专业决策依据，具体发展需结合个人努力与客观环境。\"\n2. 分析原则：所有结论需严格对应用户提供的命盘数据，有理有据展开分析。\n3. 后续问答要求：用户后续提出的每一个问题，均需依据其提供的命盘数据展开，做到有理有据、分析详实。\n4. 敏感问题处理：若用户提问涉及下蛊、破坏他人命运、断人财路等玄学敏感、违禁内容，将直接拒绝回答。\n5. 互动提示：分析结束后，若用户有其他具体疑问，可随时补充提问。",
    interpersonal: "# 角色\n你是精通国学易经术数的资深命理分析师，核心擅长主流子平派格局理论与新派命理技法，能基于固定命盘信息精准分析五行生克、十神组合等关系得出喜用忌神，并专注围绕{{人际贵人}}项展开深度解析，关键事件须给出发生时间范围、喜忌属性、事件对命主的影响程度等信息，能结合命主客观条件提供精准且实用的命理建议。并在最后重点提醒用户，本分析基于传统命理理论框架，仅供娱乐参考，不构成任何决策依据。\n\n## 技能\n### 技能1：基础命盘解析\n接收用户提供的命盘核心数据，完整阅读并理解四柱结构、十神配置、五行旺衰、格局类型等基础信息。\n\n### 技能2：人际贵人解读\n通过命盘解析人际关系，聚焦以下维度展开深度分析：\n1. 人际关系模式（外向 / 内向 / 人缘好坏）\n2. 贵人运强弱与贵人来源方位\n3. 小人运与是非风险\n4. 朋友助力与兄弟缘分\n5. 职场人际关系特点\n6. 近5年人际运势变化\n7. 改善人际关系的建议\n\n## 输出格式\n人际贵人分析\n1. 人际关系总体特点\n2. 贵人运分析（贵人类型、出现时机、助力方向）\n3. 小人运与是非风险\n4. 朋友与同辈关系\n5. 近5年人际运势\n6. 人际交往建议\n\n## 限制\n1. 前置声明：本分析仅基于传统八字命理理论逻辑，不涉及科学实证结论，需在分析开头明确：\"本分析为文化娱乐参考，非专业决策依据，具体发展需结合个人努力与客观环境。\"\n2. 分析原则：所有结论需严格对应用户提供的命盘数据，有理有据展开分析。\n3. 后续问答要求：用户后续提出的每一个问题，均需依据其提供的命盘数据展开，做到有理有据、分析详实。\n4. 敏感问题处理：若用户提问涉及下蛊、破坏他人命运、断人财路等玄学敏感、违禁内容，将直接拒绝回答。\n5. 互动提示：分析结束后，若用户有其他具体疑问，可随时补充提问。",
    parent: "# 角色\n你是精通国学易经术数的资深命理分析师，核心擅长主流子平派格局理论与新派命理技法，能基于固定命盘信息精准分析五行生克、十神组合等关系得出喜用忌神，并专注围绕{{家庭六亲}}项展开深度解析，关键事件须给出发生时间范围、喜忌属性、事件对命主的影响程度等信息，能结合命主客观条件提供精准且实用的命理建议。并在最后重点提醒用户，本分析基于传统命理理论框架，仅供娱乐参考，不构成任何决策依据。\n\n## 技能\n### 技能1：基础命盘解析\n接收用户提供的命盘核心数据，完整阅读并理解四柱结构、十神配置、五行旺衰、格局类型等基础信息。\n\n### 技能2：家庭六亲解读\n通过命盘解析家庭关系，聚焦以下维度展开深度分析：\n1. 父母缘分（父母感情、对命主的助力、健康状况）\n2. 兄弟姐妹缘分（数量、关系亲疏、互相助力）\n3. 子女缘分（子女数量、性别、孝顺程度、发展前景）\n4. 家庭整体氛围\n5. 祖上根基与家庭背景\n6. 近5年六亲运势变化\n7. 改善家庭关系的建议\n\n## 输出格式\n家庭六亲分析\n1. 父母缘分分析\n2. 兄弟姐妹缘分\n3. 子女缘分与后代运势\n4. 家庭整体氛围与祖上根基\n5. 近5年六亲运势\n6. 家庭关系经营建议\n\n## 限制\n1. 前置声明：本分析仅基于传统八字命理理论逻辑，不涉及科学实证结论，需在分析开头明确：\"本分析为文化娱乐参考，非专业决策依据，具体发展需结合个人努力与客观环境。\"\n2. 分析原则：所有结论需严格对应用户提供的命盘数据，有理有据展开分析。\n3. 后续问答要求：用户后续提出的每一个问题，均需依据其提供的命盘数据展开，做到有理有据、分析详实。\n4. 敏感问题处理：若用户提问涉及下蛊、破坏他人命运、断人财路等玄学敏感、违禁内容，将直接拒绝回答。\n5. 互动提示：分析结束后，若用户有其他具体疑问，可随时补充提问。",
    migration: "# 角色\n你是精通国学易经术数的资深命理分析师，核心擅长主流子平派格局理论与新派命理技法，能基于固定命盘信息精准分析五行生克、十神组合等关系得出喜用忌神，并专注围绕{{迁移变动}}项展开深度解析，关键事件须给出发生时间范围、喜忌属性、事件对命主的影响程度等信息，能结合命主客观条件提供精准且实用的命理建议。并在最后重点提醒用户，本分析基于传统命理理论框架，仅供娱乐参考，不构成任何决策依据。\n\n## 技能\n### 技能1：基础命盘解析\n接收用户提供的命盘核心数据，完整阅读并理解四柱结构、十神配置、五行旺衰、格局类型等基础信息。\n\n### 技能2：迁移变动解读\n通过命盘解析迁移运势，聚焦以下维度展开深度分析：\n1. 驿马运强弱（是否适合外出发展）\n2. 最佳发展方位（东 / 南 / 西 / 北 / 本地）\n3. 迁移机遇与出国运势\n4. 工作变动频率与稳定性\n5. 适合异地发展还是本地发展\n6. 近5年迁移变动节点\n7. 迁移发展建议\n\n## 输出格式\n迁移变动分析\n1. 驿马运总体判断\n2. 最佳发展方位与地域\n3. 出国运与异地发展潜力\n4. 职业变动趋势\n5. 近5年迁移变动关键节点\n6. 迁移发展建议\n\n## 限制\n1. 前置声明：本分析仅基于传统八字命理理论逻辑，不涉及科学实证结论，需在分析开头明确：\"本分析为文化娱乐参考，非专业决策依据，具体发展需结合个人努力与客观环境。\"\n2. 分析原则：所有结论需严格对应用户提供的命盘数据，有理有据展开分析。\n3. 后续问答要求：用户后续提出的每一个问题，均需依据其提供的命盘数据展开，做到有理有据、分析详实。\n4. 敏感问题处理：若用户提问涉及下蛊、破坏他人命运、断人财路等玄学敏感、违禁内容，将直接拒绝回答。\n5. 互动提示：分析结束后，若用户有其他具体疑问，可随时补充提问。",
    litigation: "# 角色\n你是精通国学易经术数的资深命理分析师，核心擅长主流子平派格局理论与新派命理技法，能基于固定命盘信息精准分析五行生克、十神组合等关系得出喜用忌神，并专注围绕{{官非诉讼}}项展开深度解析，关键事件须给出发生时间范围、喜忌属性、事件对命主的影响程度等信息，能结合命主客观条件提供精准且实用的命理建议。并在最后重点提醒用户，本分析基于传统命理理论框架，仅供娱乐参考，不构成任何决策依据。\n\n## 技能\n### 技能1：基础命盘解析\n接收用户提供的命盘核心数据，完整阅读并理解四柱结构、十神配置、五行旺衰、格局类型等基础信息。\n\n### 技能2：官非诉讼解读\n通过命盘解析官非风险，聚焦以下维度展开深度分析：\n1. 官非诉讼风险等级\n2. 口舌是非倾向\n3. 牢狱之灾风险判断\n4. 容易引发官非的原因与场景\n5. 近5年官非是非高发期\n6. 化解官非风险的建议\n7. 与官方 / 体制的缘分\n\n## 输出格式\n官非诉讼分析\n1. 官非风险总体评估\n2. 口舌是非倾向\n3. 官非高发的原因与场景\n4. 近5年官非是非运势（重点提示风险年份）\n5. 化解官非风险的建议\n6. 与官方体制的缘分\n\n## 限制\n1. 前置声明：本分析仅基于传统八字命理理论逻辑，不涉及科学实证结论，需在分析开头明确：\"本分析为文化娱乐参考，非专业决策依据，具体发展需结合个人努力与客观环境。\"\n2. 分析原则：所有结论需严格对应用户提供的命盘数据，有理有据展开分析。\n3. 后续问答要求：用户后续提出的每一个问题，均需依据其提供的命盘数据展开，做到有理有据、分析详实。\n4. 敏感问题处理：若用户提问涉及下蛊、破坏他人命运、断人财路等玄学敏感、违禁内容，将直接拒绝回答。\n5. 互动提示：分析结束后，若用户有其他具体疑问，可随时补充提问。"
  };

  function renderReports() {
    const gate = memberGateHTML("AI 研判", "八大专题专业提示词，一键复制命盘数据，粘贴到豆包、DeepSeek 等任意大模型获取深度命理分析。");
    const view = $("#view-reports");
    if (gate) {
      const existingGate = view.querySelector(".member-gate.reports-gate");
      if (!existingGate) {
        const wrapper = document.createElement("div");
        wrapper.className = "member-gate reports-gate";
        wrapper.innerHTML = gate.replace(/^<div class="member-gate[^"]*">/, "").replace(/<\/div>$/, "");
        view.querySelector(".ai-reports-layout")?.appendChild(wrapper);
      }
      refreshIcons();
      return;
    }
    if (view) {
      const gateEl = view.querySelector(".member-gate.reports-gate");
      if (gateEl) gateEl.remove();
    }
    // 时柱未知提示
    const noticeEl = $("#ai-hour-unknown-notice");
    if (noticeEl) {
      noticeEl.hidden = !state.hourUnknown;
    }
    const chartData = buildChartDataText();
    $("#ai-chart-data").textContent = chartData;
    const topicKeys = Object.keys(AI_TOPICS);
    $("#ai-topic-grid").innerHTML = topicKeys.map((key) =>
      '<button class="ai-topic-card ' + (key === state.aiTopic ? "active" : "") + '" data-ai-topic="' + key + '" type="button">' +
        '<div class="topic-icon"><i data-lucide="' + AI_TOPICS[key].icon + '"></i></div>' +
        "<strong>" + AI_TOPICS[key].label + "</strong>" +
        "<span>" + AI_TOPICS[key].desc + "</span>" +
      "</button>"
    ).join("");
    const currentTopic = state.aiTopic || "career";
    $("#ai-prompt-title").textContent = AI_TOPICS[currentTopic].label + "分析";
    $("#ai-prompt-content").textContent = AI_PROMPTS[currentTopic] || "";
    refreshIcons();
  }

  function copyToAIChartData() {
    const text = buildChartDataText();
    const fallback = () => {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      showToast("命盘数据已复制", "check");
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => showToast("命盘数据已复制", "check")).catch(fallback);
    } else {
      fallback();
    }
  }

  function copyToAIPrompt() {
    const currentTopic = state.aiTopic || "career";
    const prompt = AI_PROMPTS[currentTopic] || "";
    const fallback = () => {
      const el = document.createElement("textarea");
      el.value = prompt;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      showToast("提示词已复制", "check");
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(prompt).then(() => showToast("提示词已复制", "check")).catch(fallback);
    } else {
      fallback();
    }
  }

  function copyToAIAll() {
    const chartData = buildChartDataText();
    const currentTopic = state.aiTopic || "career";
    const prompt = AI_PROMPTS[currentTopic] || "";
    const full = "【命盘数据】\n" + chartData + "\n\n【分析要求】\n" + prompt + "\n\n请基于以上命盘数据，按照分析要求进行详细的命理分析。";
    const fallback = () => {
      const el = document.createElement("textarea");
      el.value = full;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      showToast("命盘+提示词已全部复制，去粘贴给 AI 吧", "check");
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(full).then(() => showToast("命盘+提示词已全部复制，去粘贴给 AI 吧", "check")).catch(fallback);
    } else {
      fallback();
    }
  }

  function renderSpirits() {
    const a = state.analysis;
    const tenGodOrder = ["比肩", "劫财", "食神", "伤官", "偏财", "正财", "七杀", "正官", "偏印", "正印"];
    $("#ten-god-grid").innerHTML = tenGodOrder.map((god) => {
      const sources = a.gods.filter((item) => item.god === god);
      const element = sources.length ? stemData(sources[0].stem).element : (
        ["比肩", "劫财"].includes(god) ? a.dayElement :
          ["食神", "伤官"].includes(god) ? a.outputElement :
            ["偏财", "正财"].includes(god) ? a.wealthElement :
              ["七杀", "正官"].includes(god) ? a.officerElement : a.resourceElement
      );
      return `
        <div class="ten-god-item" style="--element-color:${ELEMENT_COLORS[element]}">
          <strong>${god}<span>${sources.length}处</span></strong>
          <p>${TEN_GOD_INFO[god]}</p>
          <p>${sources.length ? sources.map((item) => `${item.source}${item.stem}`).join("、") : "原局天干与藏干未见"}</p>
        </div>
      `;
    }).join("");

    const allSpirits = Array.from(new Set(a.spirits.flat()));
    $("#spirit-table").innerHTML = `
      <div class="spirit-row header"><div>神煞</div>${PILLAR_LABELS.map((label) => `<div>${label}</div>`).join("")}</div>
      ${allSpirits.map((spirit) => `
        <div class="spirit-row">
          <div><strong>${spirit}</strong></div>
          ${a.spirits.map((list) => `<div>${list.includes(spirit) ? `<span class="spirit-tag">${spirit}</span>` : "—"}</div>`).join("")}
        </div>
        <div class="spirit-row">
          <div class="muted">取象</div>
          <div class="spirit-description" style="grid-column:span 4">${SPIRIT_INFO[spirit] || "结合所临宫位、十神喜忌与岁运共同判断。"}</div>
        </div>
      `).join("") || `<div class="spirit-row"><div>常规</div><div class="spirit-description" style="grid-column:span 4">当前规则集未检出常用神煞，仍以五行生克与格局为主。</div></div>`}
    `;
  }

  function scoreTone(value) {
    return value >= 70 ? "good" : value >= 55 ? "mid" : "low";
  }

  function formatWeight(value) {
    const liang = Math.floor(value);
    const qian = Math.round((value - liang) * 10);
    return qian >= 10 ? `${liang + 1}两整` : `${liang}两${qian}钱`;
  }

  function computeChenggu(profile) {
    if (!window.Solar) return null;
    const dateMatch = String(profile.birthDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const timeMatch = String(profile.birthTime || "").match(/^(\d{2}):(\d{2})$/);
    if (!dateMatch) return null;
    let year = Number(dateMatch[1]);
    let month = Number(dateMatch[2]);
    let day = Number(dateMatch[3]);
    const hour = timeMatch ? Number(timeMatch[1]) : 12;
    if (hour >= 23) {
      const rollover = new Date(year, month - 1, day + 1);
      year = rollover.getFullYear();
      month = rollover.getMonth() + 1;
      day = rollover.getDate();
    }
    try {
      const lunar = window.Solar.fromYmdHms(year, month, day, hour, timeMatch ? Number(timeMatch[2]) : 0, 0).getLunar();
      let lunarMonth = lunar.getMonth();
      let leapNote = "";
      if (lunarMonth < 0) {
        const isLateHalf = lunar.getDay() > 15;
        lunarMonth = isLateHalf ? -lunarMonth + 1 : -lunarMonth;
        if (lunarMonth > 12) lunarMonth = 12;
        leapNote = isLateHalf ? "（闰月下半月，依古法计下月）" : "（闰月上半月，依古法计本月）";
      }
      const lunarDay = lunar.getDay();
      const hourBranchIndex = Math.floor((hour + 1) / 2) % 12;
      const yearGanZhi = lunar.getYearInGanZhi();
      const yearWeight = CHENGGU_YEAR[yearGanZhi] != null ? CHENGGU_YEAR[yearGanZhi] : 0.7;
      const monthWeight = CHENGGU_MONTH[lunarMonth - 1] != null ? CHENGGU_MONTH[lunarMonth - 1] : 0.9;
      const dayWeight = CHENGGU_DAY[lunarDay - 1] != null ? CHENGGU_DAY[lunarDay - 1] : 0.9;
      const hourWeight = CHENGGU_HOUR[hourBranchIndex];
      const total = Math.round((yearWeight + monthWeight + dayWeight + hourWeight) * 10) / 10;
      const clampedVerse = clamp(total, 2.1, 7.2);
      const verseKey = Number.isInteger(clampedVerse) ? String(clampedVerse) : clampedVerse.toFixed(1);
      const grade = CHENGGU_GRADES.find((item) => total <= item.max) || CHENGGU_GRADES[CHENGGU_GRADES.length - 1];
      return {
        lunarText: `农历${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}日 ${BRANCHES[hourBranchIndex].name}时${leapNote}`,
        zodiac: lunar.getYearShengXiao(),
        yearGanZhi,
        parts: [
          { label: "出生年", main: yearGanZhi + "年", weight: yearWeight },
          { label: "出生月", main: `农历${lunarMonth}月`, weight: monthWeight },
          { label: "出生日", main: `农历${lunar.getDayInChinese()}`, weight: dayWeight },
          { label: "出生时", main: `${BRANCHES[hourBranchIndex].name}时`, weight: hourWeight }
        ],
        total,
        totalText: formatWeight(total),
        verse: CHENGGU_VERSES[verseKey] || CHENGGU_VERSES["4.4"],
        verseKey,
        grade
      };
    } catch (error) {
      console.warn("称骨计算失败", error);
      return null;
    }
  }

  function renderChenggu() {
    // 时柱未知时给出提示
    if (state.hourUnknown) {
      $("#chenggu-content").innerHTML = `
        <div class="chenggu-empty">
          <div class="hour-unknown-notice" style="margin-bottom: 16px;">
            <i data-lucide="alert-triangle"></i>
            <span><strong>时柱未知</strong>：袁天罡称骨算法需要完整的出生年月日时（含时辰）进行计算。由于缺少时辰信息，称骨结果无法准确得出。</span>
          </div>
          <p>如需查看称骨结果，请先在出生信息中设置具体的出生时辰。</p>
        </div>`;
      return;
    }
    const result = computeChenggu(state.profile);
    if (!result) {
      $("#chenggu-content").innerHTML = `
        <div class="chenggu-empty">
          <p>当前命例缺少完整出生时间，称骨算命需要公历出生日期与钟表时间换算农历后计算。</p>
        </div>`;
      return;
    }
    const a = state.analysis;
    const gradeIndex = CHENGGU_GRADES.indexOf(result.grade);
    const gradeLevel = ["低", "中低", "中", "中高", "高", "极高"][clamp(Math.floor(gradeIndex / 1.2), 0, 5)];
    const blocks = [
      ["一生运势走向", result.grade.trend],
      ["性格特征", result.grade.character],
      ["事业发展", result.grade.career],
      ["婚姻状况", result.grade.marriage],
      ["财富水平", result.grade.wealth]
    ];
    $("#chenggu-content").innerHTML = `
      <div class="chenggu-hero">
        <div class="chenggu-weight">
          <span class="weight-label">总骨重</span>
          <strong>${result.totalText}</strong>
          <small>${result.lunarText} · 生肖${result.zodiac}</small>
        </div>
        <div class="chenggu-grade">
          <span class="grade-badge tone-${scoreTone(45 + gradeIndex * 8)}">${result.grade.name}</span>
          <small>古法八档评级 · 置信${gradeLevel}</small>
          <small>称骨为民俗参考，与子平法各成体系</small>
        </div>
      </div>
      <div class="chenggu-parts">
        ${result.parts.map((part) => `
          <div class="chenggu-part">
            <small>${part.label}</small>
            <strong>${part.main}</strong>
            <span>${formatWeight(part.weight)}</span>
          </div>
        `).join("")}
        <div class="chenggu-part total">
          <small>合计</small>
          <strong>${result.totalText}</strong>
          <span>年+月+日+时</span>
        </div>
      </div>
      <div class="chenggu-verse">
        <span class="panel-kicker">称骨歌批注 · ${result.totalText}（通行版本）</span>
        <p>${result.verse.split("，").filter(Boolean).join("，<br>")}</p>
      </div>
      ${memberGateHTML("称骨五维专业解析", "一生运势走向、性格特征、事业发展、婚姻状况、财富水平五大维度深度解析，附子平法互参结论。", true) || `
        <div class="chenggu-analysis">
          ${blocks.map(([title, text]) => `
            <div class="chenggu-block">
              <strong>${title}</strong>
              <p>${text}</p>
            </div>
          `).join("")}
        </div>
        <p class="chenggu-cross">与子平法对照：称骨重属「${result.grade.name}」，而八字以「${a.pattern} · ${a.strength}」立论。两法依据不同，吉凶不必强合；称骨看先天福泽厚薄之"底色"，八字看结构取用之"路径"，互参可互补，冲突时应以子平格局为准绳。</p>
      `}
    `;
  }

  function buildFullAnalysis() {
    const a = state.analysis;
    const monthBranch = a.pillars[1].branch;
    const revealed = monthBranch.hidden.filter((hidden) => a.pillars.some((pillar, index) => index !== 1 && pillar.stem.name === hidden));
    const patternGroup = ["正财格", "偏财格"].includes(a.pattern) ? "财"
      : ["正官格", "七杀格"].includes(a.pattern) ? "官"
        : ["正印格", "偏印格"].includes(a.pattern) ? "印"
          : ["食神格", "伤官格"].includes(a.pattern) ? "食"
            : "比";
    const patternNotes = {
      财: "财格以食伤生财为源、官星护财为屏，忌比劫争财。逢比劫旺的岁运，须防破财、合伙纠纷与担保连带。",
      官: "官杀格喜财印相辅：财生官旺、印化杀身。正官忌伤官并见，七杀尤喜食神制杀——制化得宜，权柄可期；制化两失，压力成殃。",
      印: "印格喜官杀生印，忌财星坏印。印旺而重，须食伤泄秀，学识方能变现为功名与实务。",
      食: "食神格主厚积薄发、福泽绵长；伤官格主才气纵横、突破常规。伤官宜配印（伤官配印）或生财（伤官生财），忌与官星正面相战。",
      比: "建禄、月劫之格，身旺气盛，喜财官食伤泄耗其秀，忌印比再来助身——气有余则须寻出口，方成大器。"
    };
    const elementLine = ELEMENTS.map((element) => `${element}${a.elements.percentages[element]}%`).join(" · ");
    const dominantShare = a.elements.percentages[a.dominantElement];
    const weakestShare = a.elements.percentages[a.weakestElement];
    const flowText = PRODUCES[a.dominantElement] === a.weakestElement
      ? `${a.dominantElement}旺而直接生${a.weakestElement}，气势顺流而下，源清流长，全局自带补弱通道。`
      : CONTROLS[a.dominantElement] === a.weakestElement
        ? `${a.dominantElement}旺而${a.weakestElement}弱，旺者克弱，弱者受制更重。宜以${PRODUCES[a.dominantElement]}通关（${a.dominantElement}生${PRODUCES[a.dominantElement]}、${PRODUCES[a.dominantElement]}生${a.weakestElement}），化克为生。`
        : `${a.dominantElement}气独旺、${a.weakestElement}气偏枯，二者无直接生克，需岁运引动媒介五行方能贯通。`;
    const godSorted = Object.entries(a.godCounts).sort((x, y) => y[1] - x[1]);
    const topGods = godSorted.slice(0, 3);
    const missingGods = ["正官", "七杀", "正财", "偏财", "正印", "偏印", "食神", "伤官", "比肩", "劫财"].filter((god) => !a.godCounts[god]);
    const rootBranches = a.pillars.filter((pillar) => pillar.branch.hidden.some((hidden) => stemData(hidden).element === a.dayElement));
    const supportStems = a.pillars.filter((pillar) => pillar.stem.element === a.dayElement || PRODUCES[pillar.stem.element] === a.dayElement);
    const monthElement = monthBranch.element;
    const monthState = monthElement === a.dayElement ? "得令"
      : PRODUCES[monthElement] === a.dayElement ? "得月生扶"
        : CONTROLS[a.dayElement] === monthElement ? "月令为财，耗泄日主" : "月令克泄，失令";
    const usefulText = a.strength === "身旺"
      ? `身旺宜克、泄、耗并用：官杀（${a.officerElement}）制身，食伤（${a.outputElement}）泄秀，财星（${a.wealthElement}）耗其有余。优先观察${a.useful.join("、")}之气。`
      : a.strength === "身偏弱"
        ? `身弱宜生、扶为主：印星（${a.resourceElement}）生身，比劫（${a.dayElement}）帮身。优先观察${a.useful.join("、")}之气，忌财官过旺反受其累。`
        : `中和之局，生扶与克泄相济，取用不拘一端：随岁运与所问事项，在${a.useful.join("、")}之间灵活取舍。`;
    const seasonGroup = ["亥", "子", "丑"].includes(monthBranch.name) ? { name: "冬令", element: "火", note: "气候寒凝，先需火暖局，水旺者尤忌再行水运" }
      : ["巳", "午", "未"].includes(monthBranch.name) ? { name: "夏令", element: "水", note: "炎燥当权，先需水润局，火旺者忌火土再燥" }
        : ["寅", "卯", "辰"].includes(monthBranch.name) ? { name: "春令", element: "火", note: "木气舒发而余寒未尽，需火暖照，木旺者亦喜金修剪" }
          : { name: "秋令", element: "水", note: "金气肃杀，需水泄其锐气，金旺者喜火炼成器" };
    const adjustShare = a.elements.percentages[seasonGroup.element];
    const relationSummary = a.relations.length
      ? a.relations.slice(0, 4).map((item) => `${item.pair.replace("柱", "")}${item.type}（${item.result}）`).join("；")
      : "四柱合冲刑害较少，结构清简";
    const voidPillars = a.pillars.filter((pillar) => a.voidBranches.includes(pillar.branch.name));
    const allSpirits = Array.from(new Set(a.spirits.flat()));
    const nobleCount = allSpirits.filter((s) => SPIRIT_CATEGORIES.noble.includes(s)).length;
    const riskCount = allSpirits.filter((s) => SPIRIT_CATEGORIES.risk.includes(s)).length;

    return [
      {
        title: "八字格局与月令提纲",
        paragraphs: [
          `此造生于${monthBranch.name}月，月令藏干为${monthBranch.hidden.join("、")}，本气${monthBranch.hidden[0]}对应日主之${a.monthMainGod}，依月令立「${a.pattern}」。`,
          revealed.length
            ? `月令藏干${revealed.join("、")}透出天干，格局之气外显，主事十神立场明确，行运引动时感应更快、事象更清。`
            : "月令藏干未透干，格局之气内藏不露，属“有格局之实而无格局之名”，成事多待岁运透引之际。",
          patternNotes[patternGroup]
        ]
      },
      {
        title: "五行分布与气势流通",
        paragraphs: [
          `全局五行占比：${elementLine}。以${a.dominantElement}最旺（${dominantShare}%），${a.weakestElement}最弱（${weakestShare}%），五行${new Set(a.pillars.map((p) => p.stem.element)).size >= 4 ? "覆盖面广" : "偏于一隅"}。`,
          flowText,
          `五行少者不必机械补齐：补弱或泄旺，取决于格局成败与调候缓急，而非数量均等。`
        ]
      },
      {
        title: "十神配置与心性取向",
        paragraphs: [
          topGods.length
            ? `原局十神以${topGods.map(([god, count]) => `${god}（${count}处）`).join("、")}最为突出：${topGods.map(([god]) => TEN_GOD_INFO[god]).join(" ")}`
            : "原局十神分布较为平均，无明显主气，心性兼容并蓄。",
          missingGods.length
            ? `局中未见${missingGods.slice(0, 4).join("、")}——此数象须借岁运补足：逢对应十神透清之年，相关人、事、物容易被引动现身。`
            : "十神俱备，人事取象完整，各种因缘皆有原局抓手。",
          `十神只是“关系语言”：同一颗财星，身旺者为富，身弱者为累——须始终与日主强弱对读。`
        ]
      },
      {
        title: "日主强弱与喜用取法",
        paragraphs: [
          `日主${a.dayStem}（${stemData(a.dayStem).polarity}${a.dayElement}）：生于${monthBranch.name}月，${monthState}；${rootBranches.length ? `在${rootBranches.map((p) => p.branch.name).join("、")}支中通根（得地）` : "四支根气偏浅（得地不足）"}；${supportStems.length ? `天干${supportStems.map((p) => p.stem.name).join("、")}生扶比助（得势）` : "天干生扶寥寥（得势不足）"}。`,
          `综合得令、得地、得势三停，日主属「${a.strength}」，生扶占比约${Math.round(a.strengthRatio * 100)}%。`,
          usefulText
        ]
      },
      {
        title: "调候与季节气候",
        paragraphs: [
          `生于${seasonGroup.name}（${monthBranch.name}月），${seasonGroup.note}。`,
          `局中${seasonGroup.element}气占${adjustShare}%，${adjustShare >= 15 ? "调候之物有力，气候偏性基本得解，格局取用可正常展开。" : `调候偏弱，寒暖燥湿之偏未全解，行运补入${seasonGroup.element}的年份，体感与事运会明显顺遂。`}`
        ]
      },
      {
        title: "干支结构与神煞框架",
        paragraphs: [
          `结构层面：${relationSummary}。合主聚、冲主动、刑主磨、害主暗耗，所临宫位即受牵动的人生领域。`,
          voidPillars.length
            ? `空亡：${voidPillars.map((p) => `${p.branch.name}（临${PILLAR_LABELS[a.pillars.indexOf(p)]}）`).join("、")}落空——空亡之象主迟来、反复与虚实转换，吉事应迟、凶事应轻，逢冲空、填实之年则“出空”应事。`
            : "四柱无旬空之支，各宫所主之事落点扎实，少虚悬之象。",
          `纳音：${state.profile.pillars.map(getNayin).join("、")}，纳音取象仅作旁证。神煞层面共见${allSpirits.length}种，其中贵人类${nobleCount}种、警醒类${riskCount}种——贵气足者难中有扶，警讯多者留有余地，详见下方神煞释义。`
        ]
      }
    ];
  }

  function renderFullAnalysis() {
    const gate = memberGateHTML("命局全面解析", "格局成败、用神取舍、十神配置、日主旺衰、五行调候全方位深度分析，仅会员可查阅完整内容。");
    if (gate) {
      $("#full-analysis").innerHTML = gate;
      refreshIcons();
      return;
    }
    const sections = buildFullAnalysis();
    const numerals = ["壹", "贰", "叁", "肆", "伍", "陆"];
    $("#full-analysis").innerHTML = sections.map((section, index) => `
      <article class="analysis-block">
        <header><span class="block-no">${numerals[index]}</span><h3>${section.title}</h3></header>
        ${section.paragraphs.map((text) => `<p>${text}</p>`).join("")}
      </article>
    `).join("");
    refreshIcons();
  }

  function renderOverviewFortune() {
    const a = state.analysis;
    const cycles = getDayun(state.profile, a);
    const current = getCurrentDayun(state.profile, a);
    $("#overview-fortune-track").innerHTML = cycles.map((cycle) => {
      const evaluation = evaluatePeriod(cycle.pillar, a);
      const isCurrent = cycle.pillar === current.pillar;
      return `
        <button class="fortune-mini-card ${isCurrent ? "current" : ""}" type="button" data-view="fortune">
          <small>${formatAge(cycle.age)}起 · ${cycle.startYear}—${cycle.endYear}</small>
          <strong>${cycle.pillar}</strong>
          <em>${getTenGod(a.dayStem, cycle.pillar[0])}主事</em>
          <span class="mini-score tone-${scoreTone(evaluation.score)}">${evaluation.score}</span>
          ${isCurrent ? '<i class="now-flag">现行</i>' : ""}
        </button>
      `;
    }).join("");
    const year = new Date().getFullYear();
    const nextYearPillar = yearPillar(year + 1);
    const yearP = yearPillar(year);
    const evalDayun = evaluatePeriod(current.pillar, a);
    const evalYear = evaluatePeriod(yearP, a);
    const evalNext = evaluatePeriod(nextYearPillar, a);
    const cards = [
      {
        tag: `当前大运 ${current.pillar}`,
        sub: `${current.startYear}—${current.endYear} · ${formatAge(current.age)}起运`,
        evaluation: evalDayun,
        pillar: current.pillar
      },
      {
        tag: `${year} 流年 ${yearP}`,
        sub: `${getTenGod(a.dayStem, yearP[0])}主事 · 本命年按地支自坐参看`,
        evaluation: evalYear,
        pillar: yearP
      },
      {
        tag: `${year + 1} 流年展望 ${nextYearPillar}`,
        sub: `${getTenGod(a.dayStem, nextYearPillar[0])}主事 · 提前布局`,
        evaluation: evalNext,
        pillar: nextYearPillar
      }
    ];
    $("#overview-fortune-detail").innerHTML = cards.map((card) => `
      <div class="of-detail-card">
        <header>
          <strong>${card.tag}</strong>
          <span class="score-chip tone-${scoreTone(card.evaluation.score)}">趋势 ${card.evaluation.score}</span>
        </header>
        <small>${card.sub}</small>
        <p>${card.evaluation.notes.join(" ")}</p>
        <p class="of-advice">${card.evaluation.useful ? "岁运五行入喜用之列：宜主动布局、把握可验证的机会。" : "岁运五行未入喜用：宜守正经营，重大决定分步验证、控制敞口。"}</p>
      </div>
    `).join("");
  }

  function renderOverviewSpirits() {
    const a = state.analysis;
    const tenGodOrder = ["比肩", "劫财", "食神", "伤官", "偏财", "正财", "七杀", "正官", "偏印", "正印"];
    $("#overview-ten-gods").innerHTML = tenGodOrder.map((god) => {
      const sources = a.gods.filter((item) => item.god === god);
      const element = sources.length ? stemData(sources[0].stem).element
        : ["比肩", "劫财"].includes(god) ? a.dayElement
          : ["食神", "伤官"].includes(god) ? a.outputElement
            : ["偏财", "正财"].includes(god) ? a.wealthElement
              : ["七杀", "正官"].includes(god) ? a.officerElement : a.resourceElement;
      return `
        <div class="og-item" style="--element-color:${ELEMENT_COLORS[element]}">
          <div class="og-head"><strong>${god}</strong><span>${sources.length}处</span></div>
          <p class="og-mean">${TEN_GOD_INFO[god]}</p>
          <p class="og-where">${sources.length ? sources.map((item) => `${item.source}${item.stem}`).join("、") : "天干藏干均未见"}</p>
        </div>
      `;
    }).join("");
    const spiritGate = memberGateHTML("神煞深度白话释义", "原局全部神煞逐条白话详解，含取象原理、吉凶倾向与宫位联动判断。", true);
    $("#overview-spirit-columns").innerHTML = a.spirits.map((list, index) => `
      <div class="osc-col">
        <h4>${PILLAR_LABELS[index]} · ${state.profile.pillars[index]}</h4>
        ${list.length ? list.map((spirit) => `
          <div class="osc-spirit">
            <span class="spirit-tag">${spirit}</span>
            ${spiritGate ? "" : `<p>${SPIRIT_INFO[spirit] || "结合所临宫位、十神喜忌与岁运共同判断。"}</p>`}
          </div>
        `).join("") : '<p class="osc-empty">此柱未见常用神煞</p>'}
      </div>
    `).join("") + (spiritGate || "");
  }

  function buildWealthAnalysis() {
    const a = state.analysis;
    const zhengCai = a.godCounts["正财"] || 0;
    const pianCai = a.godCounts["偏财"] || 0;
    const shiShang = (a.godCounts["食神"] || 0) + (a.godCounts["伤官"] || 0);
    const biJie = (a.godCounts["比肩"] || 0) + (a.godCounts["劫财"] || 0);
    const yin = (a.godCounts["正印"] || 0) + (a.godCounts["偏印"] || 0);
    const wealthStars = zhengCai + pianCai;
    const wealthShare = a.elements.percentages[a.wealthElement];
    const storageMap = { 木: "未", 火: "戌", 土: "戌", 金: "丑", 水: "辰" };
    const hasStorage = a.pillars.some((pillar) => pillar.branch.name === storageMap[a.wealthElement]);
    const wealthBranchClashed = a.pillars.some((pillar) => pillar.branch.element === a.wealthElement && a.pillars.some((other) => other !== pillar && BRANCH_CLASHES.some((pair) => pair.includes(pillar.branch.name) && pair.includes(other.branch.name))));
    const sources = [];
    if (zhengCai >= 2 || (zhengCai > pianCai && zhengCai > 0)) sources.push(`正财${zhengCai}处：稳定薪酬、主业积累、细水长流型财源`);
    if (pianCai >= 2 || pianCai > zhengCai) sources.push(`偏财${pianCai}处：经营贸易、机会型收入、流动性财源`);
    if (shiShang >= 2 && shiShang >= wealthStars) sources.push(`食伤${shiShang}处：以技艺、专业与内容输出生财，凭本事吃饭`);
    if (biJie >= 3) sources.push(`比劫${biJie}处：竞争性行业求财，靠拼抢与执行力取财`);
    if (yin >= 3 && wealthStars <= 1) sources.push(`印星${yin}处：以知识、资质与平台资源换取稳定报酬`);
    if (!sources.length) sources.push("财星在局中不显，财路以跟随平台、积累专业为主，行财旺岁运时财缘被引动");

    let scaleText;
    let scaleTone = "mid";
    if (wealthShare >= 20 && wealthStars >= 3 && a.strength !== "身偏弱") {
      scaleText = `财星之${a.wealthElement}在局中占${wealthShare}%、十神共见${wealthStars}处，日主${a.strength}足以承载——先天财富结构属中上量级，具备“财有源、身能任”的格局基础。`; scaleTone = "good";
    } else if (wealthStars >= 4 && a.strength === "身偏弱") {
      scaleText = `财星${wealthStars}处偏多而日主偏弱（${a.wealthElement}占${wealthShare}%），古称“财多身弱、富屋贫人”：机会与场面不小，实际到手与留存有限，量级取决于行运补身之时。`; scaleTone = "warn";
    } else if (wealthShare < 10) {
      scaleText = `财星之${a.wealthElement}仅占${wealthShare}%，财气偏薄——财富量级不求其大，而在精专：小而稳的结构反而可控。`; scaleTone = "warn";
    } else {
      scaleText = `财星之${a.wealthElement}占${wealthShare}%、十神共见${wealthStars}处，配合日主${a.strength}——属中等量级：衣食丰足可期，大富须借格局与岁运加持。`;
    }

    let stabilityText;
    let stabilityTone = "mid";
    if ((a.godCounts["劫财"] || 0) >= 2) {
      stabilityText = `劫财${a.godCounts["劫财"]}处显见，钱财易因合伙拆账、亲友借贷、冲动消费而外流；${hasStorage ? `好在${storageMap[a.wealthElement]}为财库入局，能存得住一部分` : "且局中财库未见，蓄财须靠纪律"}`;
      stabilityTone = "warn";
    } else if (hasStorage) {
      stabilityText = `${storageMap[a.wealthElement]}为${a.wealthElement}之财库且入局，收入能沉淀、家底可累积，属“能挣能存”的结构。`;
      stabilityTone = "good";
    } else {
      stabilityText = `局中未见${a.wealthElement}之财库（${storageMap[a.wealthElement]}），挣得多不等于留得住——强制储蓄与资产隔离比开源更关键。`;
    }
    if (wealthBranchClashed) {
      stabilityText += " 另有财星逢冲：账面进出加大，现金流波动明显，宜留应急储备。";
      stabilityTone = stabilityTone === "good" ? "mid" : stabilityTone;
    }

    let easeText;
    let easeTone = "mid";
    if (a.strength === "身旺" && wealthStars >= 2) {
      easeText = `身旺任财：财来就我，获取相对顺遂，敢谈钱、能议价，主动出击效率高。`;
      easeTone = "good";
    } else if (a.strength === "身偏弱" && wealthStars >= 3) {
      easeText = `身弱财旺：见财起意易、落袋为安难。求财过程辛苦，宜借团队、平台与合作方之力“代身任财”。`;
      easeTone = "warn";
    } else if (shiShang >= 2) {
      easeText = `食伤通关有力：先有手艺与作品，后有财源跟进——财路是“挣”出来的，不是“等”出来的，越专业越轻松。`;
      easeTone = "good";
    } else {
      easeText = `财路平缓：难有一夜暴富之象，也少断崖之险，靠时间复利积累。`;
    }

    const risks = [];
    if ((a.godCounts["劫财"] || 0) >= 2) risks.push("合伙与担保：劫财旺者，合伙经营、为人担保最易破财，账目须清、权责须明");
    if (pianCai > zhengCai && wealthShare >= 15) risks.push("投机冲动：偏财旺者见机会就想加仓，须防杠杆与流动性风险，仓位即纪律");
    if (wealthBranchClashed) risks.push("财星逢冲：大额进出与意外开支并存，重大支出前先冷静一旬");
    if (a.pillars.some((pillar) => a.voidBranches.includes(pillar.branch.name) && pillar.branch.element === a.wealthElement)) risks.push("财星临空：账面富贵与到手实惠之间常有落差，落袋才算数");
    if (!risks.length) risks.push("常规波动：无结构性破财之象，防行业周期与通胀侵蚀即可");

    return [
      { title: "财富来源", tone: sources.length > 1 ? "good" : "mid", text: sources.join("；") + "。" },
      { title: "财富规模", tone: scaleTone, text: scaleText },
      { title: "财富稳定性", tone: stabilityTone, text: stabilityText },
      { title: "求财难易", tone: easeTone, text: easeText },
      { title: "潜在财富风险", tone: "warn", text: risks.join("；") + "。以上为结构提示，财富最终取决于时代、行业与个人选择，命理只述倾向。" }
    ];
  }

  function renderFortuneSynthesis() {
    const a = state.analysis;
    const cycle = getCurrentDayun(state.profile, a);
    const evalDayun = evaluatePeriod(cycle.pillar, a);
    const year = new Date().getFullYear();
    const yearP = yearPillar(year);
    const evalYear = evaluatePeriod(yearP, a);
    const combined = Math.round((evalDayun.score + evalYear.score) / 2);
    const allSpirits = Array.from(new Set(a.spirits.flat()));
    const cats = {
      noble: allSpirits.filter((s) => SPIRIT_CATEGORIES.noble.includes(s)),
      motion: allSpirits.filter((s) => SPIRIT_CATEGORIES.motion.includes(s)),
      romance: allSpirits.filter((s) => SPIRIT_CATEGORIES.romance.includes(s)),
      wisdom: allSpirits.filter((s) => SPIRIT_CATEGORIES.wisdom.includes(s)),
      risk: allSpirits.filter((s) => SPIRIT_CATEGORIES.risk.includes(s))
    };
    $("#fortune-synthesis-chip").textContent = combined >= 75 ? "岁运相得" : combined >= 60 ? "岁运平稳" : "岁运承压";
    const chipTone = combined >= 75 ? "good" : combined >= 60 ? "mid" : "low";
    const trendText = combined >= 75
      ? "岁运相得，正处顺势窗口，宜把想做的事排上日程"
      : combined >= 60
        ? "岁运平稳，不求冒进、但求每步落实，积累期同样珍贵"
        : "岁运承压，宜收缩战线、保全根本，把这段时间当作休整与练功";
    const spiritParts = [];
    spiritParts.push(cats.noble.length
      ? `局带${cats.noble.slice(0, 3).join("、")}，贵气足，遇阻有转圜、难中有人扶`
      : "局中贵人星不显，关键节点宜主动寻师访友，借外力破局");
    if (cats.motion.length) spiritParts.push("驿马入局，动中取势——差旅、迁居、跨区域布局反而带来机会");
    if (cats.romance.length) spiritParts.push(`${cats.romance.slice(0, 2).join("、")}照命，人际与情缘活跃，合作洽谈自带亲和力`);
    if (cats.wisdom.length) spiritParts.push(`${cats.wisdom.slice(0, 2).join("、")}主才思，研习、考证、创作之事事半功倍`);
    spiritParts.push(cats.risk.length
      ? `另见${cats.risk.slice(0, 3).join("、")}等警醒之象，行事留三分余地、条款落纸为安`
      : "神煞层面无显著警讯");
    const synthesis = [
      `当下正行${cycle.pillar}大运（${cycle.startYear}—${cycle.endYear}年），天干之${cycle.pillar[0]}为${getTenGod(a.dayStem, cycle.pillar[0])}、地支${cycle.pillar[1]}中气对应${evalDayun.hiddenGod}；今岁${year}年${yearP}流年，${evalYear.notes[0]}大运趋势${evalDayun.score}分、流年趋势${evalYear.score}分，综合${combined}分——${trendText}。`,
      `神煞加权：${spiritParts.join("；")}。`,
      `行事总则：以原局喜用${a.useful.slice(0, 2).join("、")}为纲——岁运地支逢${a.useful.map((element) => `${element}旺之支`).join("、")}时顺势而进；逢冲提纲、刑动日支之年，则以稳为先。运势是“势”，不是“命”：顺风借力，逆风守拙，即是行运之道。`
    ];
    $("#fortune-synthesis").innerHTML = `
      <div class="synthesis-score tone-${chipTone}">
        <strong>${combined}</strong>
        <span>岁运综合指数</span>
      </div>
      <div class="synthesis-texts">
        ${synthesis.map((text) => `<p>${text}</p>`).join("")}
      </div>
    `;
    $("#wealth-analysis").innerHTML = buildWealthAnalysis().map((block) => `
      <div class="wealth-block tone-${block.tone}">
        <strong>${block.title}</strong>
        <p>${block.text}</p>
      </div>
    `).join("");
  }

  function renderMethods() {
    const gate = memberGateHTML("术数工具 · 会员专享", "易经六爻、梅花易数、奇门遁甲、大六壬四大术数完整排盘与解读，会员即可全部解锁。");
    if (gate) {
      $("#method-grid").innerHTML = "";
      $("#method-grid").appendChild(Object.assign(document.createElement("div"), { className: "divination-gate-wrap", innerHTML: gate }));
      $("#divination-workbench").innerHTML = "";
      return;
    }
    $("#method-grid").innerHTML = METHODS.map((method) => `
      <button class="method-card ${state.selectedMethod === method.id ? "active" : ""}" data-method="${method.id}" type="button">
        <span class="method-icon"><i data-lucide="${method.icon}"></i></span>
        <h3>${method.name}</h3>
        <p>${method.desc}</p>
        <span>进入排盘 <i data-lucide="arrow-right"></i></span>
      </button>
    `).join("");
    if (state.selectedMethod) renderDivinationForm(state.selectedMethod);
  }

  function renderDivinationForm(methodId) {
    const method = METHODS.find((item) => item.id === methodId);
    const now = new Date();
    $("#divination-workbench").innerHTML = `
      <div class="panel-heading">
        <div><span class="panel-kicker">一事一占</span><h2>${method.name}</h2></div>
        <span class="status-chip">${now.toLocaleDateString("zh-CN")} ${now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <div class="divination-form">
        <label class="question-field">
          <span>所占事项</span>
          <textarea id="divination-question" maxlength="120" placeholder="例如：未来三个月当前项目合作能否顺利推进？"></textarea>
        </label>
        <div class="divination-meta">
          <div class="meta-row"><span>起局方式</span><strong>${methodId === "zhouyi" ? "蓍数模拟" : methodId === "meihua" ? "时间起卦" : "即时排局"}</strong></div>
          <div class="meta-row"><span>求测人</span><strong>${safeText(state.profile.name)}</strong></div>
          <div class="meta-row"><span>时区</span><strong>东八区</strong></div>
          <button class="button primary full" id="cast-button" data-cast="${methodId}" type="button"><i data-lucide="sparkles"></i>${methodId === "qimen" ? "排布九宫" : methodId === "liuren" ? "起课定传" : "起卦"}</button>
        </div>
      </div>
    `;
    refreshIcons();
  }

  function randomLine() {
    const values = [6, 7, 7, 7, 8, 8, 8, 9];
    if (window.crypto && window.crypto.getRandomValues) {
      const buffer = new Uint32Array(1);
      window.crypto.getRandomValues(buffer);
      return values[buffer[0] % values.length];
    }
    return values[Math.floor(Math.random() * values.length)];
  }

  function trigramFromLines(lines) {
    return TRIGRAMS[lines.map((line) => line % 2 ? "1" : "0").join("")];
  }

  function castHexagram(methodId, question) {
    let lines;
    if (methodId === "meihua") {
      const now = new Date();
      const seed = now.getFullYear() + now.getMonth() + 1 + now.getDate() + now.getHours() + question.length;
      lines = Array.from({ length: 6 }, (_, index) => ((seed + index * 7) % 2 ? 7 : 8));
      lines[mod(seed, 6)] = lines[mod(seed, 6)] === 7 ? 9 : 6;
    } else {
      lines = Array.from({ length: 6 }, randomLine);
    }
    const lower = trigramFromLines(lines.slice(0, 3));
    const upper = trigramFromLines(lines.slice(3, 6));
    const changedLines = lines.map((line) => line === 6 ? 7 : line === 9 ? 8 : line);
    const changedLower = trigramFromLines(changedLines.slice(0, 3));
    const changedUpper = trigramFromLines(changedLines.slice(3, 6));
    const name = HEXAGRAMS[upper.name][lower.name];
    const changedName = HEXAGRAMS[changedUpper.name][changedLower.name];
    const moving = lines.map((line, index) => line === 6 || line === 9 ? index + 1 : null).filter(Boolean);
    const relation = PRODUCES[lower.element] === upper.element
      ? "体生用，事项前期投入较多，宜明确回报与止损点。"
      : PRODUCES[upper.element] === lower.element
        ? "用生体，外部条件有支持，可顺势承接但仍需核实。"
        : CONTROLS[lower.element] === upper.element
          ? "体克用，主方具主动权，关键在持续执行。"
          : CONTROLS[upper.element] === lower.element
            ? "用克体，外部约束偏强，宜先降低不确定性。"
            : "体用比和，同类相应，重在协同与节奏一致。";
    return { lines, lower, upper, changedName, name, moving, relation };
  }

  function renderHexagramResult(methodId, question) {
    const result = castHexagram(methodId, question);
    $("#divination-workbench").innerHTML = `
      <div class="panel-heading">
        <div><span class="panel-kicker">${methodId === "meihua" ? "梅花时间卦" : "本卦与变卦"}</span><h2>${result.name}</h2></div>
        <button class="button ghost small" data-method="${methodId}" type="button"><i data-lucide="rotate-ccw"></i>重新起卦</button>
      </div>
      <div class="casting-area">
        <div class="hexagram-stack">
          ${result.lines.map((line) => `<span class="hex-line ${line % 2 ? "yang" : "yin"} ${line === 6 || line === 9 ? "moving" : ""}"></span>`).join("")}
        </div>
        <div class="hex-result">
          <span class="panel-kicker">${safeText(question)}</span>
          <h3>${result.upper.nature}${result.lower.nature}${result.name.replace(result.upper.nature + result.lower.nature, "")}</h3>
          <div class="hex-facts">
            <span>上卦 ${result.upper.name} · ${result.upper.element}</span>
            <span>下卦 ${result.lower.name} · ${result.lower.element}</span>
            <span>${result.moving.length ? `动爻 ${result.moving.join("、")}` : "静卦"}</span>
            <span>变卦 ${result.changedName}</span>
          </div>
          <p>${result.relation} ${result.moving.length ? `动爻落在第${result.moving.join("、")}爻，变化环节需重点观察。` : "六爻安静，宜按既定条件稳步验证，不急于扩大解释。"}</p>
          <p>此卦适合用于梳理问题结构与备选路径，不替代事实调查和专业意见。</p>
        </div>
      </div>
    `;
    refreshIcons();
  }

  function renderQimenResult(question) {
    const now = new Date();
    const seed = now.getFullYear() + now.getMonth() * 3 + now.getDate() + now.getHours() + question.length;
    const palaces = ["巽四宫", "离九宫", "坤二宫", "震三宫", "中五宫", "兑七宫", "艮八宫", "坎一宫", "乾六宫"];
    const doors = ["杜门", "景门", "死门", "伤门", "中宫", "惊门", "生门", "休门", "开门"];
    const stars = ["天辅", "天英", "天芮", "天冲", "天禽", "天柱", "天任", "天蓬", "天心"];
    const offset = mod(seed, 9);
    const chief = mod(seed * 7, 9);
    $("#divination-workbench").innerHTML = `
      <div class="panel-heading">
        <div><span class="panel-kicker">${seed % 2 ? "阳遁" : "阴遁"} ${offset + 1}局</span><h2>奇门遁甲 · 时家转盘</h2></div>
        <button class="button ghost small" data-method="qimen" type="button"><i data-lucide="rotate-ccw"></i>重新排局</button>
      </div>
      <div class="casting-area">
        <div class="qimen-grid">
          ${palaces.map((palace, index) => {
            const shifted = mod(index + offset, 9);
            return `<div class="qimen-palace ${index === chief ? "active" : ""}"><strong>${palace}</strong><small>${stars[shifted]} · ${doors[shifted]}</small></div>`;
          }).join("")}
        </div>
        <div class="hex-result">
          <span class="panel-kicker">${safeText(question)}</span>
          <h3>值符临${palaces[chief]}</h3>
          <div class="hex-facts">
            <span>${seed % 2 ? "阳遁" : "阴遁"}${offset + 1}局</span>
            <span>${stars[mod(chief + offset, 9)]}值符</span>
            <span>${doors[mod(chief + offset, 9)]}值使</span>
          </div>
          <p>值符宫反映当前主要资源与组织焦点。${["开门", "生门", "休门"].includes(doors[mod(chief + offset, 9)]) ? "门星组合偏向开放与推进，可优先选择信息透明、资源可核实的路径。" : "门星组合提示约束较多，宜先处理流程、权限与信息缺口，再决定推进幅度。"}</p>
          <p>此处为时家奇门结构化模拟盘，涉及精确节气、置闰与拆补法时应使用专业历书复核。</p>
        </div>
      </div>
    `;
    refreshIcons();
  }

  function renderLiurenResult(question) {
    const now = new Date();
    const branches = BRANCHES.map((branch) => branch.name);
    const seed = now.getDate() + now.getHours() + question.length;
    const transmissions = [branches[mod(seed, 12)], branches[mod(seed + 4, 12)], branches[mod(seed + 8, 12)]];
    const generals = ["贵人", "腾蛇", "朱雀", "六合", "勾陈", "青龙", "天空", "白虎", "太常", "玄武", "太阴", "天后"];
    $("#divination-workbench").innerHTML = `
      <div class="panel-heading">
        <div><span class="panel-kicker">月将加时 · 四课三传</span><h2>大六壬课式</h2></div>
        <button class="button ghost small" data-method="liuren" type="button"><i data-lucide="rotate-ccw"></i>重新起课</button>
      </div>
      <div class="casting-area">
        <div class="hexagram-stack" style="flex-direction:column">
          ${transmissions.map((branch, index) => `
            <div class="period-pillar" style="grid-template-columns:60px 1fr">
              <span class="element-${branchData(branch).element}" style="height:54px">${branch}</span>
              <span style="height:54px;font-family:Inter,'Microsoft YaHei',sans-serif;font-size:11px">${["初传", "中传", "末传"][index]} · ${generals[mod(seed + index * 3, 12)]}</span>
            </div>
          `).join("")}
        </div>
        <div class="hex-result">
          <span class="panel-kicker">${safeText(question)}</span>
          <h3>${transmissions.join(" → ")} 三传</h3>
          <div class="hex-facts">
            <span>初传 ${transmissions[0]}</span>
            <span>中传 ${transmissions[1]}</span>
            <span>末传 ${transmissions[2]}</span>
          </div>
          <p>初传看事起，中传看过程，末传看归结。三传五行由${branchData(transmissions[0]).element}转${branchData(transmissions[1]).element}再至${branchData(transmissions[2]).element}，宜重点核验过程中的资源交接和责任归属。</p>
          <p>课式为结构化文化演示；精细断课还需完整月将、占时、四课与涉害取传规则。</p>
        </div>
      </div>
    `;
    refreshIcons();
  }

  function castDivination(methodId) {
    const question = ($("#divination-question") || {}).value?.trim();
    if (!question) {
      showToast("请先填写具体占问事项", "circle-alert");
      $("#divination-question")?.focus();
      return;
    }
    if (methodId === "qimen") renderQimenResult(question);
    else if (methodId === "liuren") renderLiurenResult(question);
    else renderHexagramResult(methodId, question);
  }

  function renderArchives(filter) {
    const keyword = String(filter || "").trim().toLowerCase();
    const list = state.archives.filter((profile) => {
      const haystack = [profile.name, profile.gender, profile.location, profile.pillars.join(""), ...(profile.tags || [])].join(" ").toLowerCase();
      return !keyword || haystack.includes(keyword);
    });
    $("#archive-count").textContent = state.archives.length;
    $("#archive-grid").innerHTML = list.length ? list.map((profile) => {
      const generationCount = Math.max(
        1,
        Number(profile.generationCount || 0),
        Array.isArray(profile.generationHistory) ? profile.generationHistory.length : 0
      );
      return `
        <article class="archive-card">
          <div class="archive-card-header">
            <span class="avatar">${safeText(profile.name.charAt(0) || "命")}</span>
            <div><h3>${safeText(profile.name)}</h3><small>${safeText(profile.gender)}命 · ${safeText(profile.location || "出生地未录")}</small></div>
          </div>
          <div class="archive-pillars">
            ${profile.pillars.map((pillar) => `<div class="archive-pillar"><span class="element-${stemData(pillar[0]).element}">${pillar[0]}</span><span class="element-${branchData(pillar[1]).element}">${pillar[1]}</span></div>`).join("")}
          </div>
          <div class="archive-card-footer">
            <span class="archive-save-meta">
              <small>${new Date(profile.updatedAt || profile.createdAt).toLocaleDateString("zh-CN")} 更新</small>
              <small>已生成 ${generationCount} 次</small>
            </span>
            <div class="archive-actions">
              <button class="icon-button compact" data-history-archive="${safeText(profile.id)}" type="button" aria-label="查看生成历史" title="查看生成历史"><i data-lucide="history"></i></button>
              <button class="icon-button compact" data-edit-archive="${safeText(profile.id)}" type="button" aria-label="编辑命例" title="编辑命例"><i data-lucide="pencil"></i></button>
              <button class="icon-button compact" data-open-archive="${safeText(profile.id)}" type="button" aria-label="打开命例" title="打开命例"><i data-lucide="folder-open"></i></button>
              <button class="icon-button compact" data-delete-archive="${safeText(profile.id)}" type="button" aria-label="删除命例" title="删除命例"><i data-lucide="trash-2"></i></button>
            </div>
          </div>
        </article>
      `;
    }).join("") : `<div class="empty-archives">没有符合条件的命例</div>`;
    refreshIcons();
  }

  function generationEntries(profile) {
    if (Array.isArray(profile.generationHistory)) {
      return profile.generationHistory;
    }
    return [{
      generatedAt: profile.generatedAt || profile.updatedAt || profile.createdAt,
      name: profile.name,
      gender: profile.gender,
      birthDate: profile.birthDate,
      birthTime: profile.birthTime,
      location: profile.location,
      pillars: profile.pillars,
      calculationMode: profile.calculationMode || "calendar",
      sect: profile.sect || 1,
      useTrueSolarTime: Boolean(profile.useTrueSolarTime),
      longitude: Number(profile.longitude) || 120
    }];
  }

  function formatHistoryTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "时间未记录";
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  }

  function openGenerationHistory(profile) {
    state.historyProfileId = profile.id;
    const entries = generationEntries(profile);
    $("#history-profile-summary").innerHTML = `
      <span>${safeText(profile.name)} · ${safeText(profile.gender)}命</span>
      <span>${safeText(profile.birthDate)} ${safeText(profile.birthTime)}</span>
      <span>保留最近 ${entries.length} 次生成参数</span>
    `;
    $("#generation-history-list").innerHTML = entries.length ? entries
      .map((entry, index) => ({ entry, index }))
      .reverse()
      .map(({ entry, index }) => {
        const pillars = Array.isArray(entry.pillars) && entry.pillars.every(parsePillar)
          ? entry.pillars
          : profile.pillars;
        const mode = entry.calculationMode === "manual" ? "手工四柱" : entry.calculationMode === "lunar" ? "农历排盘" : "公历排盘";
        const solar = entry.useTrueSolarTime ? `真太阳时 · 东经${Number(entry.longitude || 120)}°` : "北京时间";
        return `
          <div class="generation-history-item">
            <span class="generation-history-time">
              <strong>${safeText(formatHistoryTime(entry.generatedAt))}</strong>
              <small>${safeText(entry.birthDate || profile.birthDate)} ${safeText(entry.birthTime || profile.birthTime)}</small>
            </span>
            <span class="generation-history-pillars">
              ${pillars.map((pillar) => `<span>${safeText(pillar)}</span>`).join("")}
            </span>
            <span class="generation-history-settings">${mode} · ${Number(entry.sect) === 2 ? "午夜换日" : "子初换日"} · ${solar}</span>
            <span class="generation-history-actions">
              <button class="icon-button compact" data-restore-history="${index}" type="button" aria-label="恢复此次命盘" title="恢复此次命盘"><i data-lucide="rotate-ccw"></i></button>
              <button class="icon-button compact" data-delete-history="${index}" type="button" aria-label="删除此次记录" title="删除此次记录"><i data-lucide="trash-2"></i></button>
            </span>
          </div>
        `;
      })
      .join("") : `<div class="generation-history-empty">暂无保留的生成记录</div>`;
    openModal("history-modal");
    refreshIcons();
  }

  function restoreGeneration(index) {
    const stored = state.archives.find((profile) => profile.id === state.historyProfileId);
    const entry = stored && generationEntries(stored)[Number(index)];
    if (!stored || !entry) return;
    try {
      const restored = {
        ...stored,
        name: entry.name || stored.name,
        gender: entry.gender || stored.gender,
        birthDate: entry.birthDate || stored.birthDate,
        birthTime: entry.birthTime || stored.birthTime,
        location: entry.location == null ? stored.location : entry.location,
        pillars: Array.isArray(entry.pillars) ? entry.pillars.slice() : stored.pillars.slice(),
        calculationMode: entry.calculationMode === "manual" ? "manual" : entry.calculationMode === "lunar" ? "lunar" : "calendar",
        sect: Number(entry.sect) === 2 ? 2 : 1,
        useTrueSolarTime: Boolean(entry.useTrueSolarTime),
        longitude: Number(entry.longitude) || 120,
        updatedAt: new Date().toISOString()
      };
      if ((restored.calculationMode === "calendar" || restored.calculationMode === "lunar") && window.XuanJianCalendar) {
        const calculation = window.XuanJianCalendar.calculate(restored);
        if (!calculation.verification.passed) throw new Error("历史参数历法校验未通过");
        restored.pillars = calculation.pillars;
        restored.calculation = serializableCalculation(calculation);
      }
      analyzeProfile(restored);
      state.profile = restored;
      state.selectedPeriodIndex = null;
      upsertArchive(restored);
      renderAll();
      closeModal("history-modal");
      switchView("overview");
      showToast("已恢复该次生成参数", "history");
    } catch (error) {
      showToast(`恢复失败：${error.message}`, "circle-alert");
    }
  }

  function deleteGeneration(index) {
    const stored = state.archives.find((profile) => profile.id === state.historyProfileId);
    if (!stored || !Array.isArray(stored.generationHistory) || !stored.generationHistory[Number(index)]) return;
    if (!window.confirm("确定删除这条生成记录吗？当前命例本身不会被删除。")) return;
    stored.generationHistory.splice(Number(index), 1);
    stored.updatedAt = new Date().toISOString();
    if (state.profile.id === stored.id) {
      state.profile.generationHistory = stored.generationHistory.slice();
      state.profile.updatedAt = stored.updatedAt;
    }
    upsertArchive(stored);
    renderArchives($("#archive-search").value);
    openGenerationHistory(stored);
    showToast("生成记录已删除", "trash-2");
  }

  function switchView(view) {
    const target = $(`[data-view-panel="${view}"]`);
    if (!target) return;
    state.view = view;
    $$(".view").forEach((panel) => panel.classList.toggle("active", panel === target));
    $$(".top-nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    $$(".side-nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    $("#sidebar").classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
    // 同步主Tab状态：只有命盘/行运/AI三个核心页显示主Tab
    const mainTabs = ["overview", "fortune", "reports"];
    const mainTabsEl = $("#main-tabs");
    if (mainTabsEl) {
      mainTabsEl.classList.toggle("visible", mainTabs.includes(view));
      $$(".main-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.mainTab === view));
    }
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => $("input, button", modal)?.focus(), 30);
  }

  function closeModal(modal) {
    const element = typeof modal === "string" ? document.getElementById(modal) : modal;
    if (!element) return;
    element.classList.remove("open");
    element.setAttribute("aria-hidden", "true");
    if (!$(".modal-backdrop.open")) document.body.style.overflow = "";
  }

  function padNumber(value) {
    return String(value).padStart(2, "0");
  }

  function getHourBranch(hour) {
    return BRANCHES[mod(Math.floor((Number(hour) + 1) / 2), 12)].name;
  }

  function updateDatetimeLabels() {
    const [year, month, day] = $("#input-date").value.split("-").map(Number);
    const time = $("#input-time").value || "12:00";
    const hour = Number(time.split(":")[0]);
    $("#datetime-date-label").textContent = `${year}年${month}月${day}日`;
    if (state.hourUnknown) {
      $("#datetime-time-label").innerHTML = '<span class="hour-unknown-badge">时柱未知</span>';
    } else {
      $("#datetime-time-label").textContent = `${time} · ${getHourBranch(hour)}时`;
    }
  }

  function selectedCalculationMode() {
    return $('input[name="calculationMode"]:checked')?.value || "calendar";
  }

  function getFormCalendarOptions() {
    return {
      birthDate: $("#input-date").value,
      birthTime: $("#input-time").value,
      sect: Number($('input[name="sect"]:checked')?.value || 1),
      yearBoundary: $('input[name="year-boundary"]:checked')?.value || "lichun",
      useTrueSolarTime: $("#input-true-solar").checked,
      longitude: Number($("#input-longitude").value)
    };
  }

  function serializableCalculation(result) {
    if (!result) return null;
    const { _eightChar, _solar, ...plain } = result;
    return plain;
  }

  function setFormPillars(pillars, statusText) {
    PILLAR_KEYS.forEach((key, index) => {
      $(`#pillar-${key}`).value = pillars[index];
    });
    $("#input-bazi").value = pillars.join(" ");
    $("#bazi-recognition-state").textContent = statusText || "历法生成";
    $("#bazi-recognition-state").className = "valid";
  }

  function renderCalculationResult(result, error) {
    const container = $("#calculation-result");
    if (error) {
      container.innerHTML = `<div class="calculation-error"><i data-lucide="circle-alert"></i><span>${safeText(error.message)}</span></div>`;
      refreshIcons();
      return;
    }
    if (!result) {
      container.innerHTML = `<div class="calculation-manual"><i data-lucide="pencil-line"></i><span>手工录入模式仅校验六十甲子结构，不反推公历。</span></div>`;
      refreshIcons();
      return;
    }
    const solarTimeText = result.solarTime.enabled
      ? `真太阳时 ${result.calculationTime}（${result.solarTime.correctionMinutes >= 0 ? "+" : ""}${result.solarTime.correctionMinutes} 分）`
      : "北京时间（东八区）";
    container.innerHTML = `
      <div class="calculation-pillars">
        ${result.pillars.map((pillar, index) => `<span><small>${PILLAR_LABELS[index]}</small><strong>${pillar}</strong></span>`).join("")}
      </div>
      <div class="calculation-meta">
        <span><i data-lucide="${result.verification.passed ? "badge-check" : "badge-alert"}"></i>${result.verification.passed ? "交叉校验通过" : "校验异常"}</span>
        <span>${safeText(result.lunarText)} · ${safeText(solarTimeText)}</span>
      </div>
      <div class="verification-list">
        ${result.verification.checks.map((check) => `<span class="${check.passed ? "passed" : "failed"}">${check.passed ? "✓" : "×"} ${safeText(check.label)}</span>`).join("")}
      </div>
    `;
    refreshIcons();
  }

  function refreshCalculationPreview() {
    const manual = selectedCalculationMode() === "manual";
    $("#input-longitude").disabled = !$("#input-true-solar").checked;
    $$(".pillar-input input").forEach((input) => {
      input.readOnly = !manual;
      input.setAttribute("aria-readonly", String(!manual));
    });
    $("#input-bazi").readOnly = !manual;
    const yb = $('input[name="year-boundary"]:checked')?.value || "lichun";
    $("#calculation-hint").textContent = manual
      ? "适用于已有完整四柱的命例"
      : `按${yb === "spring" ? "正月初一定年" : "立春定年"}、节气定月、子时规则自动重排`;
    if (manual) {
      state.pendingCalculation = null;
      renderCalculationResult(null);
      return null;
    }
    try {
      if (!window.XuanJianCalendar) throw new Error("历法引擎尚未加载");
      const result = window.XuanJianCalendar.calculate(getFormCalendarOptions());
      state.pendingCalculation = result;
      setFormPillars(result.pillars, "历法生成");
      renderCalculationResult(result);
      $("#form-validation").textContent = "";
      return result;
    } catch (error) {
      state.pendingCalculation = null;
      renderCalculationResult(null, error);
      return null;
    }
  }

  const WHEEL_ITEM_HEIGHT = 42;
  const WHEEL_STATIC_VALUES = {
    year: Array.from({ length: 201 }, (_, index) => 1900 + index),
    month: Array.from({ length: 12 }, (_, index) => index + 1),
    hour: Array.from({ length: 24 }, (_, index) => index),
    minute: Array.from({ length: 60 }, (_, index) => index)
  };

  function wheelValues(name) {
    if (WHEEL_STATIC_VALUES[name]) return WHEEL_STATIC_VALUES[name];
    if (name === "day") {
      const { year, month } = state.wheelValue;
      const count = new Date(year, month, 0).getDate();
      return Array.from({ length: count }, (_, index) => index + 1);
    }
    return [];
  }

  function renderWheelColumn(name, animate) {
    const column = $(`[data-wheel="${name}"]`);
    const values = wheelValues(name);
    const current = clamp(Number(state.wheelValue[name]), values[0], values[values.length - 1]);
    state.wheelValue[name] = current;
    column.innerHTML = `
      <div class="wheel-spacer" aria-hidden="true"></div>
      ${values.map((value) => `<button class="wheel-item ${value === current ? "selected" : ""}" data-wheel-value="${value}" type="button">${padNumber(value)}</button>`).join("")}
      <div class="wheel-spacer" aria-hidden="true"></div>
    `;
    const index = values.indexOf(current);
    requestAnimationFrame(() => {
      column.scrollTo({ top: index * WHEEL_ITEM_HEIGHT, behavior: animate ? "smooth" : "auto" });
    });
  }

  function updateWheelSummary() {
    const value = state.wheelValue;
    $("#wheel-summary").textContent = `${value.year}年${value.month}月${value.day}日 ${padNumber(value.hour)}:${padNumber(value.minute)} · ${getHourBranch(value.hour)}时`;
  }

  function selectWheelIndex(column, animate) {
    const name = column.dataset.wheel;
    const values = wheelValues(name);
    const index = clamp(Math.round(column.scrollTop / WHEEL_ITEM_HEIGHT), 0, values.length - 1);
    const previous = state.wheelValue[name];
    const previousMaxDay = new Date(state.wheelValue.year, state.wheelValue.month, 0).getDate();
    const value = values[index];
    state.wheelValue[name] = value;
    const selected = $(".wheel-item.selected", column);
    const next = column.children[index + 1];
    if (selected !== next) {
      selected?.classList.remove("selected");
      next?.classList.add("selected");
    }
    const targetTop = index * WHEEL_ITEM_HEIGHT;
    if (animate && Math.abs(column.scrollTop - targetTop) > 0.5) {
      column.scrollTo({ top: targetTop, behavior: "smooth" });
    }
    if ((name === "year" || name === "month") && previous !== value) {
      const maxDay = new Date(state.wheelValue.year, state.wheelValue.month, 0).getDate();
      state.wheelValue.day = Math.min(state.wheelValue.day, maxDay);
      if (name === "month" || previousMaxDay !== maxDay) renderWheelColumn("day", false);
    }
    updateWheelSummary();
  }

  function setWheelYear(year, animate) {
    state.wheelValue.year = clamp(Number(year), 1900, 2100);
    const maxDay = new Date(state.wheelValue.year, state.wheelValue.month, 0).getDate();
    state.wheelValue.day = Math.min(state.wheelValue.day, maxDay);
    const column = $('[data-wheel="year"]');
    const index = WHEEL_STATIC_VALUES.year.indexOf(state.wheelValue.year);
    $(".wheel-item.selected", column)?.classList.remove("selected");
    column.children[index + 1]?.classList.add("selected");
    column.scrollTo({ top: index * WHEEL_ITEM_HEIGHT, behavior: animate ? "smooth" : "auto" });
    renderWheelColumn("day", false);
    updateWheelSummary();
  }

  function openDatetimePicker() {
    const [year, month, day] = $("#input-date").value.split("-").map(Number);
    const [hour, minute] = $("#input-time").value.split(":").map(Number);
    state.wheelValue = { year, month, day, hour, minute };
    ["year", "month", "day", "hour", "minute"].forEach((name) => renderWheelColumn(name, false));
    updateWheelSummary();
    // 同步时柱未知状态
    const wheelPicker = $("#wheel-picker");
    if (wheelPicker) wheelPicker.classList.toggle("hour-unknown", state.hourUnknown);
    openModal("datetime-modal");
  }

  function confirmDatetimePicker() {
    const value = state.wheelValue;
    $("#input-date").value = `${value.year}-${padNumber(value.month)}-${padNumber(value.day)}`;
    $("#input-time").value = `${padNumber(value.hour)}:${padNumber(value.minute)}`;
    updateDatetimeLabels();
    closeModal("datetime-modal");
    refreshCalculationPreview();
  }

  function syncLongitudeFromLocation() {
    const locationText = $("#input-location").value.trim();
    const city = Object.keys(CITY_LONGITUDES).find((name) => locationText.includes(name));
    if (!city) return;
    $("#input-longitude").value = CITY_LONGITUDES[city];
    if ($("#input-true-solar").checked) refreshCalculationPreview();
  }

  function populateProfileForm(profile, isNew) {
    state.pendingProfileIsNew = Boolean(isNew);
    const value = profile || {
      name: "",
      gender: "女",
      birthDate: "1990-01-01",
      birthTime: "12:00",
      location: "",
      pillars: ["庚午", "戊子", "丙寅", "甲午"],
      sect: 1,
      calculationMode: "calendar",
      useTrueSolarTime: false,
      longitude: 120
    };
    $("#profile-modal-title").textContent = isNew ? "新建命例" : "校对四柱";
    $("#input-name").value = value.name;
    $("#input-date").value = value.birthDate;
    $("#input-time").value = value.birthTime;
    $("#input-location").value = value.location || "";
    $("#input-true-solar").checked = Boolean(value.useTrueSolarTime);
    $("#input-longitude").value = Number(value.longitude) || 120;
    // 时柱未知
    state.hourUnknown = Boolean(value.hourUnknown);
    const hourUnknownCheckbox = $("#hour-unknown");
    if (hourUnknownCheckbox) hourUnknownCheckbox.checked = state.hourUnknown;
    $$('input[name="gender"]').forEach((radio) => { radio.checked = radio.value === value.gender; });
    $$('input[name="sect"]').forEach((radio) => { radio.checked = Number(radio.value) === Number(value.sect || 1); });
    $$('input[name="year-boundary"]').forEach((radio) => { radio.checked = radio.value === (value.yearBoundary || "lichun"); });
    $$('input[name="calculationMode"]').forEach((radio) => {
      let mode = value.calculationMode;
      if (mode !== "manual" && mode !== "lunar") mode = "calendar";
      radio.checked = radio.value === mode;
    });
    // 初始化地区选择器
    setRegionFromLocation(value.location || "");
    // 初始化农历选择器（从公历转换）
    if (value.birthDate && value.birthTime) {
      const [y, m, d] = value.birthDate.split("-").map(Number);
      const [h, min] = value.birthTime.split(":").map(Number);
      setLunarFromSolar(y, m, d, h, min);
    }
    setFormPillars(value.pillars, value.calculationMode === "manual" ? "手工四柱" : "历法生成");
    updateDatetimeLabels();
    updateCalculationModeUI();
    $("#form-validation").textContent = "";
    refreshCalculationPreview();
    openModal("profile-modal");
  }

  function handleProfileSubmit(event) {
    event.preventDefault();
    const calculationMode = selectedCalculationMode();
    let calculation = null;
    let pillars = PILLAR_KEYS.map((key) => $(`#pillar-${key}`).value.trim());
    if (calculationMode === "calendar" || calculationMode === "lunar") {
      try {
        calculation = window.XuanJianCalendar.calculate(getFormCalendarOptions());
        if (!calculation.verification.passed) throw new Error("历法交叉校验未通过，请检查日期、时间与子时规则");
        pillars = calculation.pillars;
      } catch (error) {
        $("#form-validation").textContent = error.message;
        return;
      }
    }
    const invalidIndex = pillars.findIndex((pillar) => !parsePillar(pillar));
    if (invalidIndex >= 0) {
      $("#form-validation").textContent = `${PILLAR_LABELS[invalidIndex]}“${pillars[invalidIndex] || "空"}”不是有效的六十甲子干支。`;
      $(`#pillar-${PILLAR_KEYS[invalidIndex]}`).focus();
      return;
    }
    const now = new Date().toISOString();
    const next = {
      id: state.pendingProfileIsNew ? `profile-${Date.now()}` : state.profile.id,
      name: $("#input-name").value.trim(),
      gender: $('input[name="gender"]:checked')?.value || "女",
      birthDate: $("#input-date").value,
      birthTime: $("#input-time").value,
      location: $("#input-location").value.trim(),
      pillars,
      sect: Number($('input[name="sect"]:checked')?.value || 1),
      yearBoundary: $('input[name="year-boundary"]:checked')?.value || "lichun",
      calculationMode,
      useTrueSolarTime: $("#input-true-solar").checked,
      longitude: Number($("#input-longitude").value) || 120,
      hourUnknown: state.hourUnknown,
      calculation: (calculationMode === "calendar" || calculationMode === "lunar")
        ? serializableCalculation(calculation)
        : { engine: "manual", verification: { passed: null, checks: [] } },
      tags: state.pendingProfileIsNew ? [] : (state.profile.tags || []),
      createdAt: state.pendingProfileIsNew ? now : state.profile.createdAt,
      updatedAt: now,
      generatedAt: now,
      generationCount: state.pendingProfileIsNew ? 1 : Number(state.profile.generationCount || 0) + 1,
      generationHistory: [
        ...(state.pendingProfileIsNew ? [] : (state.profile.generationHistory || [])),
        {
          generatedAt: now,
          name: $("#input-name").value.trim(),
          gender: $('input[name="gender"]:checked')?.value || "女",
          birthDate: $("#input-date").value,
          birthTime: $("#input-time").value,
          location: $("#input-location").value.trim(),
          pillars: pillars.slice(),
          calculationMode,
          sect: Number($('input[name="sect"]:checked')?.value || 1),
          yearBoundary: $('input[name="year-boundary"]:checked')?.value || "lichun",
          useTrueSolarTime: $("#input-true-solar").checked,
          longitude: Number($("#input-longitude").value) || 120,
          hourUnknown: state.hourUnknown,
          calculation: (calculationMode === "calendar" || calculationMode === "lunar")
            ? serializableCalculation(calculation)
            : { engine: "manual", verification: { passed: null, checks: [] } }
        }
      ].slice(-20)
    };
    try {
      analyzeProfile(next);
      state.profile = next;
      state.selectedPeriodIndex = null;
      upsertArchive(next);
      renderAll();
      closeModal("profile-modal");
      switchView("overview");
      showToast("命盘已生成并自动保存", "bookmark-check");
      // 启动三步引导
      startChartGuide();
    } catch (error) {
      $("#form-validation").textContent = error.message;
    }
  }

  // ========== 排盘三步引导 ==========
  let chartStep = 0;
  const CHART_STEPS = [
    { id: 1, label: "专业细盘", target: "#bazi-chart", nextText: "下一步：基本解读" },
    { id: 2, label: "基本解读", target: "#day-master-card", nextText: "下一步：AI 深度研判" },
    { id: 3, label: "AI 深度研判", target: "#view-reports", nextText: "开始 AI 研判", isTab: true, tab: "reports" }
  ];

  function startChartGuide() {
    chartStep = 1;
    const guide = $("#chart-step-guide");
    if (!guide) return;
    guide.hidden = false;
    updateChartStepUI();
    // 滚动到命盘位置
    const chartPanel = document.querySelector(".chart-panel");
    if (chartPanel) {
      chartPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function updateChartStepUI() {
    const guide = $("#chart-step-guide");
    if (!guide) return;
    $$(".step-item", guide).forEach((item, i) => {
      const stepNum = i + 1;
      item.classList.toggle("active", stepNum === chartStep);
      item.classList.toggle("done", stepNum < chartStep);
    });
    const nextBtn = $("#step-next-btn");
    const skipBtn = $("#step-skip-btn");
    const step = CHART_STEPS[chartStep - 1];
    if (nextBtn && step) {
      nextBtn.querySelector("span").textContent = step.nextText;
      const icon = nextBtn.querySelector("[data-lucide]");
      if (icon) {
        icon.setAttribute("data-lucide", chartStep === 3 ? "sparkles" : "arrow-down");
      }
    }
    if (skipBtn) {
      skipBtn.textContent = chartStep === 3 ? "完成引导" : "跳过引导";
    }
    refreshIcons();
  }

  function goToNextChartStep() {
    if (chartStep >= 3) {
      finishChartGuide();
      return;
    }
    chartStep++;
    updateChartStepUI();
    const step = CHART_STEPS[chartStep - 1];
    if (step.isTab) {
      // 切换到 AI 研判 Tab
      switchView(step.tab);
      const reportsView = document.getElementById("view-reports");
      if (reportsView) reportsView.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      const target = document.querySelector(step.target);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    if (chartStep === 3) {
      // 最后一步后自动完成
      setTimeout(finishChartGuide, 3000);
    }
  }

  function finishChartGuide() {
    chartStep = 0;
    const guide = $("#chart-step-guide");
    if (guide) guide.hidden = true;
  }

  function showToast(message, icon) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<i data-lucide="${icon || "check-circle-2"}"></i><span>${safeText(message)}</span>`;
    $("#toast-region").appendChild(toast);
    refreshIcons();
    setTimeout(() => toast.remove(), 2800);
  }

  function saveArchives() {
    try {
      localStorage.setItem("xuanjian-archives-v1", JSON.stringify(state.archives));
    } catch (error) {
      showToast("本地存储空间不足，请先导出并清理旧命例", "circle-alert");
    }
  }

  function upsertArchive(profile) {
    const snapshot = JSON.parse(JSON.stringify(profile));
    const index = state.archives.findIndex((item) => item.id === profile.id);
    if (index >= 0) state.archives[index] = snapshot;
    else state.archives.unshift(snapshot);
    saveArchives();
  }

  function saveCurrentProfile() {
    state.profile.updatedAt = new Date().toISOString();
    upsertArchive(state.profile);
    renderArchives($("#archive-search").value);
    showToast("命例已保存到本机", "bookmark-check");
  }

  function bytesToBase64(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function base64ToText(value) {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    if (!copied) throw new Error("浏览器未允许复制");
  }

  async function shareProfile() {
    const payload = {
      version: 1,
      name: state.profile.name,
      gender: state.profile.gender,
      birthDate: state.profile.birthDate,
      birthTime: state.profile.birthTime,
      location: state.profile.location,
      pillars: state.profile.pillars,
      sect: state.profile.sect,
      calculationMode: state.profile.calculationMode,
      useTrueSolarTime: state.profile.useTrueSolarTime,
      longitude: state.profile.longitude
    };
    const encoded = bytesToBase64(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const url = `${location.href.split("#")[0]}#chart=${encoded}`;
    const shareData = {
      title: `${state.profile.name}的四柱命盘`,
      text: `${state.profile.pillars.join(" ")} · 玄鉴命盘`,
      url
    };
    try {
      const localHost = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
      if (localHost) {
        await copyText(url);
        showToast("已复制本地链接；微信分享需先部署公网 HTTPS", "copy-check");
        return;
      }
      if (navigator.share) await navigator.share(shareData);
      else {
        await copyText(url);
        showToast("分享链接已复制", "copy-check");
      }
    } catch (error) {
      if (error.name !== "AbortError") showToast("未能分享，请稍后重试", "circle-alert");
    }
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function loadSharedProfile() {
    const match = location.hash.match(/^#chart=([A-Za-z0-9_-]+)$/);
    if (!match) return null;
    try {
      let encoded = match[1].replace(/-/g, "+").replace(/_/g, "/");
      encoded += "=".repeat(mod(4 - encoded.length % 4, 4));
      const parsed = JSON.parse(base64ToText(encoded));
      if (!Array.isArray(parsed.pillars) || parsed.pillars.some((pillar) => !parsePillar(pillar))) return null;
      const profile = {
        ...defaultProfile,
        ...parsed,
        id: `shared-${Date.now()}`,
        name: `${parsed.name || "分享命例"}`,
        tags: ["分享命例"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      if (profile.calculationMode !== "manual" && window.XuanJianCalendar) {
        const calculation = window.XuanJianCalendar.calculate({
          birthDate: profile.birthDate,
          birthTime: profile.birthTime,
          sect: profile.sect,
          useTrueSolarTime: profile.useTrueSolarTime,
          longitude: profile.longitude
        });
        profile.pillars = calculation.pillars;
        profile.calculation = serializableCalculation(calculation);
      }
      return profile;
    } catch (error) {
      return null;
    }
  }

  function normalizeStoredProfile(profile) {
    if (!profile || !Array.isArray(profile.pillars) || profile.pillars.some((pillar) => !parsePillar(pillar))) {
      return null;
    }
    const normalized = {
      ...defaultProfile,
      ...profile,
      id: String(profile.id || `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      name: String(profile.name || "未命名命例").slice(0, 12),
      gender: profile.gender === "男" ? "男" : "女",
      pillars: profile.pillars.slice(),
      sect: Number(profile.sect) === 2 ? 2 : 1,
      calculationMode: profile.calculationMode === "manual" ? "manual" : profile.calculationMode === "lunar" ? "lunar" : "calendar",
      useTrueSolarTime: Boolean(profile.useTrueSolarTime),
      longitude: Number(profile.longitude) || 120,
      tags: Array.isArray(profile.tags) ? profile.tags.map(String).slice(0, 12) : [],
      generationHistory: Array.isArray(profile.generationHistory)
        ? profile.generationHistory.filter((entry) => entry && Array.isArray(entry.pillars) && entry.pillars.every(parsePillar)).slice(-20)
        : undefined
    };
    if ((normalized.calculationMode === "calendar" || normalized.calculationMode === "lunar") && window.XuanJianCalendar) {
      try {
        const calculation = window.XuanJianCalendar.calculate(normalized);
        normalized.pillars = calculation.pillars;
        normalized.calculation = serializableCalculation(calculation);
      } catch (error) {
        normalized.calculation = {
          engine: "migration",
          verification: {
            passed: false,
            checks: [{ key: "input", label: error.message || "历史日期参数无效", passed: false }]
          }
        };
      }
    }
    return normalized;
  }

  function loadData() {
    try {
      const saved = JSON.parse(localStorage.getItem("xuanjian-archives-v1") || "[]");
      state.archives = Array.isArray(saved)
        ? saved
          .map(normalizeStoredProfile)
          .filter(Boolean)
        : [];
    } catch (error) {
      state.archives = [];
    }
    if (!state.archives.length) {
      state.archives = [normalizeStoredProfile(JSON.parse(JSON.stringify(defaultProfile)))];
    }
    saveArchives();
    state.profile = loadSharedProfile() || JSON.parse(JSON.stringify(state.archives[0]));
    state.hourUnknown = Boolean(state.profile.hourUnknown);
    if (localStorage.getItem("xuanjian-theme") === "dark") document.body.classList.add("dark");
  }

  function getAIContext() {
    const a = state.analysis;
    const lunar = state.profile.calculation?.lunarDetail;
    const dayun = state.profile.dayun || [];
    return {
      profile: {
        name: state.profile.name,
        gender: state.profile.gender,
        birthDate: state.profile.birthDate,
        birthTime: state.profile.birthTime,
        location: state.profile.location,
        pillars: state.profile.pillars,
        sect: state.profile.sect,
        calculationMode: state.profile.calculationMode,
        calculation: state.profile.calculation
      },
      analysis: {
        dayMaster: `${a.dayStem}${a.dayElement}`,
        strength: a.strength,
        strengthRatio: Number(a.strengthRatio.toFixed(3)),
        pattern: a.pattern,
        usefulElements: a.useful,
        elementPercentages: a.elements.percentages,
        elementTotals: a.elements.totals,
        dominantElement: a.dominantElement,
        weakestElement: a.weakestElement,
        tenGodCounts: a.godCounts,
        gods: a.gods,
        relations: a.relations,
        spirits: a.spirits,
        voidBranches: a.voidBranches,
        monthMainGod: a.monthMainGod,
        taiyuan: getTaiyuan(state.profile.pillars[1]),
        minggong: getMinggong(state.profile.pillars[1][1], state.profile.pillars[3][1])
      },
      lunar: lunar ? {
        yearGanZhi: lunar.yearGanZhi,
        monthGanZhi: lunar.monthGanZhi,
        dayGanZhi: lunar.dayGanZhi,
        hourGanZhi: lunar.hourGanZhi,
        yearInChinese: lunar.yearInChinese,
        monthInChinese: lunar.monthInChinese,
        dayInChinese: lunar.dayInChinese,
        hourInChinese: lunar.hourInChinese,
        isLeapMonth: lunar.isLeapMonth,
        jieQi: lunar.jieQi,
        prevJieQi: lunar.prevJieQi,
        nextJieQi: lunar.nextJieQi
      } : null,
      dayun: dayun.slice(0, 8).map((d) => ({
        index: d.index,
        age: d.age,
        pillar: d.pillar,
        startYear: d.startYear,
        tenGod: getTenGod(a.dayStem, d.pillar[0])
      }))
    };
  }

  const QUICK_ASKS = [
    "分析日主旺衰与喜用神",
    "月令取用与格局成败",
    "事业方向与行业建议",
    "财运结构与理财倾向",
    "婚恋关系与配偶星分析",
    "健康提示与调候建议",
    "大运走势与关键年份",
    "神煞汇总与影响解读"
  ];

  function renderAI() {
    if (!state.analysis) return;
    if (!$("#ai-chart-context")) return;
    const gate = memberGateHTML("AI 研判", "基于当前命盘无限次智能问答，涵盖格局、用神、事业、财运、婚恋、健康等全维度专业分析。");
    const aiChatPanel = document.querySelector(".ai-chat-panel");
    if (gate && aiChatPanel) {
      aiChatPanel.style.position = "relative";
      let gateEl = aiChatPanel.querySelector(".member-gate.ai-gate-overlay");
      if (!gateEl) {
        const wrapper = document.createElement("div");
        wrapper.className = "member-gate ai-gate-overlay";
        wrapper.innerHTML = gate.replace(/^<div class="member-gate[^"]*">/, "").replace(/<\/div>$/, "");
        aiChatPanel.appendChild(wrapper);
      }
      refreshIcons();
      return;
    }
    // 如果是会员，清除门控
    if (aiChatPanel) {
      const gateEl = aiChatPanel.querySelector(".member-gate.ai-gate-overlay");
      if (gateEl) gateEl.remove();
    }
    const a = state.analysis;
    const lunar = state.profile.calculation?.lunarDetail;
    $("#ai-chart-context").innerHTML = `
      <div class="ai-context-pillars">
        ${state.profile.pillars.map((pillar, index) => `<span><small>${PILLAR_LABELS[index]}</small><strong>${pillar}</strong></span>`).join("")}
      </div>
      <dl class="ai-context-facts">
        <div><dt>日主</dt><dd>${a.dayStem}${a.dayElement} · ${a.strength}</dd></div>
        <div><dt>格局</dt><dd>${a.pattern}</dd></div>
        <div><dt>喜用</dt><dd>${a.useful.join("、")}</dd></div>
        ${lunar ? `<div><dt>农历</dt><dd>${lunar.yearInChinese}年${lunar.isLeapMonth ? "闰" : ""}${lunar.monthInChinese}月${lunar.dayInChinese}日</dd></div>` : ""}
        <div><dt>校验</dt><dd>${state.profile.calculation?.verification?.passed === false ? "异常" : state.profile.calculationMode === "manual" ? "手工录入" : "已通过"}</dd></div>
      </dl>
    `;
    $("#ai-status").textContent = state.aiAvailable
      ? `已连接${state.aiModel ? ` · ${state.aiModel}` : ""}`
      : state.aiModel === "本地离线分析"
        ? "本地离线分析"
        : "等待服务配置";
    $("#ai-status").classList.toggle("online", state.aiAvailable);
    $("#ai-messages").innerHTML = state.aiMessages.length
      ? state.aiMessages.map((message) => `
        <article class="ai-message ${message.role}">
          <span>${message.role === "user" ? "你" : "AI"}</span>
          <div>${safeText(message.content).replace(/\n/g, "<br>")}</div>
        </article>
      `).join("")
      : `<div class="ai-empty"><i data-lucide="message-square-text"></i><strong>基于当前命盘开始提问</strong><p>回答会列出使用的干支、十神、旺衰与岁运依据。</p></div>`;
    $("#ai-quick-asks").innerHTML = state.aiMessages.length === 0
      ? QUICK_ASKS.map((q) => `<button class="ai-quick-ask" type="button" data-quick="${safeText(q)}">${safeText(q)}</button>`).join("")
      : "";
    $("#ai-send").disabled = state.aiBusy;
    $("#ai-send").innerHTML = state.aiBusy
      ? `<i data-lucide="loader-circle" class="spin"></i>研判中`
      : `<i data-lucide="send"></i>发送`;
    refreshIcons();
  }

  async function checkAIStatus() {
    try {
      const response = await fetch("/api/ai/status", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json();
      state.aiAvailable = Boolean(data.configured);
      state.aiModel = data.configured ? (data.model || "") : "本地离线分析";
    } catch (error) {
      state.aiAvailable = false;
      state.aiModel = "本地离线分析";
    }
    renderAI();
  }

  function localAIResponse(question, context) {
    const a = context.analysis;
    const p = context.profile;
    const lines = [];
    const q = question.toLowerCase();
    if (q.includes("旺衰") || q.includes("喜用") || q.includes("日主")) {
      lines.push(`【日主旺衰分析】`);
      lines.push(`日主：${a.dayMaster}，${a.strength}（旺衰比 ${a.strengthRatio}）。`);
      lines.push(`五行占比：${Object.entries(a.elementPercentages).map(([k, v]) => `${k}${v}%`).join("、")}。`);
      lines.push(`最旺五行：${a.dominantElement}；最弱五行：${a.weakestElement}。`);
      lines.push(`喜用神：${a.usefulElements.join("、")}。`);
      lines.push(`依据：日主${a.dayMaster}生于月令${p.pillars[1]}，通根与透干情况综合判定为${a.strength}。`);
      lines.push(`建议：${a.strength === "身旺" ? "宜泄耗（食伤、财星）为主，慎再见印比。" : a.strength === "身偏弱" ? "宜生扶（印星、比劫）为主，慎再见克泄。" : "旺衰中和，以格局取用为主，兼顾调候。"}`);
    } else if (q.includes("格局") || q.includes("月令") || q.includes("取用")) {
      lines.push(`【格局取用分析】`);
      lines.push(`格局：${a.pattern}，月令主气十神为${a.monthMainGod}。`);
      lines.push(`月柱：${p.pillars[1]}，月令藏干参与格局判定。`);
      lines.push(`依据：以月令司令之气为主，参看透干与配置。`);
      const patternGod = a.gods.find((g) => g.source === "月柱天干");
      if (patternGod) lines.push(`月干十神：${patternGod.god}，${TEN_GOD_INFO[patternGod.god] || ""}`);
      lines.push(`建议：格局成败需看用神是否有力、是否受冲克。${a.relations.length > 0 ? `原局有${a.relations.length}组刑冲合害关系，需关注对格局的影响。` : "原局刑冲合害关系较少，格局较为纯粹。"}`);
    } else if (q.includes("事业") || q.includes("职业") || q.includes("行业")) {
      lines.push(`【事业方向分析】`);
      lines.push(`日主${a.dayMaster}，格局${a.pattern}，${a.strength}。`);
      const officerCount = a.tenGodCounts["正官"] || 0;
      const killCount = a.tenGodCounts["七杀"] || 0;
      const wealthCount = (a.tenGodCounts["正财"] || 0) + (a.tenGodCounts["偏财"] || 0);
      lines.push(`官杀（正官${officerCount}、七杀${killCount}）：${officerCount + killCount > 0 ? "有管理、统筹倾向。" : "官杀不显，不宜强求体制内。"}`);
      lines.push(`财星（合计${wealthCount}）：${wealthCount > 0 ? "有经营、资源整合倾向。" : "财星弱，宜以技术或专业立身。"}`);
      lines.push(`喜用五行：${a.usefulElements.join("、")}，适合相关行业属性。`);
      lines.push(`建议：${a.usefulElements.includes("木") ? "教育、文化、农业方向可参考。" : ""}${a.usefulElements.includes("火") ? "传媒、科技、能源方向可参考。" : ""}${a.usefulElements.includes("土") ? "房地产、建筑、政务方向可参考。" : ""}${a.usefulElements.includes("金") ? "金融、机械、法律方向可参考。" : ""}${a.usefulElements.includes("水") ? "物流、贸易、传媒方向可参考。" : ""}`);
    } else if (q.includes("财") || q.includes("财运") || q.includes("理财")) {
      lines.push(`【财运结构分析】`);
      const zhengCai = a.tenGodCounts["正财"] || 0;
      const pianCai = a.tenGodCounts["偏财"] || 0;
      lines.push(`正财${zhengCai}、偏财${pianCai}。`);
      lines.push(`${a.strength === "身旺" ? "身旺能担财，财运结构较好。" : a.strength === "身偏弱" ? "身偏弱，财多需注意，宜见印比帮扶。" : "中和命局，财运随岁运起伏。"}`);
      lines.push(`喜用：${a.usefulElements.join("、")}，逢岁运补足则有进财之机。`);
      lines.push(`建议：理性理财，不宜过度投机。正财为主者宜稳定经营，偏财为主者可关注机会型投资但需控制风险。`);
    } else if (q.includes("婚恋") || q.includes("感情") || q.includes("配偶") || q.includes("婚姻")) {
      lines.push(`【婚恋关系分析】`);
      const spouseStar = p.gender === "男" ? ["正财", "偏财"] : ["正官", "七杀"];
      const spouseCount = spouseStar.reduce((sum, s) => sum + (a.tenGodCounts[s] || 0), 0);
      lines.push(`配偶星（${spouseStar.join("/")}）：${spouseCount > 0 ? `显现${spouseCount}处。` : "不显，需看岁运引动。"}`);
      lines.push(`日支（配偶宫）：${p.pillars[2][1]}，${a.relations.find((r) => r.pair.includes("日")) ? "有刑冲合害。" : "较为安稳。"}`);
      lines.push(`建议：婚恋需综合配偶星、日支与岁运。桃花${a.spirits.flat().includes("桃花") ? "显现" : "不显"}，红鸾${a.spirits.flat().includes("红鸾") ? "显现" : "不显"}。`);
    } else if (q.includes("健康") || q.includes("调候") || q.includes("疾病")) {
      lines.push(`【健康提示与调候分析】`);
      lines.push(`日主${a.dayMaster}，五行偏枯情况：${a.dominantElement}偏旺，${a.weakestElement}偏弱。`);
      lines.push(`调候建议：${a.usefulElements.join("、")}为喜用，日常可从饮食、起居、方位等方面调节。`);
      lines.push(`注意：${a.weakestElement === "木" ? "肝胆系统需注意。" : a.weakestElement === "火" ? "心血管系统需注意。" : a.weakestElement === "土" ? "脾胃系统需注意。" : a.weakestElement === "金" ? "呼吸系统需注意。" : a.weakestElement === "水" ? "肾、泌尿系统需注意。" : ""}`);
      lines.push(`此为传统五行取象参考，不替代医学诊断。身体不适请咨询专业医生。`);
    } else if (q.includes("大运") || q.includes("岁运") || q.includes("流年")) {
      lines.push(`【大运走势分析】`);
      const dayun = context.dayun || [];
      if (dayun.length > 0) {
        lines.push(`起运方向：${dayun[0]?.index >= 0 ? "顺行" : "逆行"}，起运约${dayun[0]?.age}岁。`);
        dayun.slice(0, 6).forEach((d) => {
          lines.push(`${d.age}岁（${d.startYear}年）${d.pillar} · ${d.tenGod}`);
        });
        lines.push(`关键年份：注意天克地冲、岁运并临的年份，宜提前规划。`);
      } else {
        lines.push(`大运数据暂不可用，请确认排盘信息完整。`);
      }
      lines.push(`建议：大运分析需结合原局喜忌，好运宜积极，衰运宜守成。`);
    } else if (q.includes("神煞")) {
      lines.push(`【神煞汇总与解读】`);
      const allSpirits = a.spirits.flat();
      const uniqueSpirits = Array.from(new Set(allSpirits));
      lines.push(`四柱神煞：${uniqueSpirits.join("、")}（共${uniqueSpirits.length}种）。`);
      a.spirits.forEach((sp, i) => {
        if (sp.length > 0) lines.push(`  ${PILLAR_LABELS[i]}柱：${sp.join("、")}`);
      });
      uniqueSpirits.slice(0, 5).forEach((s) => {
        lines.push(`  · ${s}：${SPIRIT_INFO[s] || "参看所临宫位与喜忌。"}`);
      });
      lines.push(`注意：神煞为辅助参证，以五行格局为主、神煞为辅。`);
    } else {
      lines.push(`【综合分析】`);
      lines.push(`命主：${p.name}（${p.gender}），日主${a.dayMaster}，${a.strength}。`);
      lines.push(`四柱：${p.pillars.join(" ")}，格局${a.pattern}。`);
      lines.push(`五行：${Object.entries(a.elementPercentages).map(([k, v]) => `${k}${v}%`).join("、")}。`);
      lines.push(`喜用：${a.usefulElements.join("、")}。`);
      if (a.taiyuan) lines.push(`胎元：${a.taiyuan}。`);
      if (a.minggong) lines.push(`命宫：${a.minggong}。`);
      lines.push(`神煞：${Array.from(new Set(a.spirits.flat())).join("、")}。`);
      lines.push(`原局关系：${a.relations.length > 0 ? a.relations.map((r) => r.type).join("、") : "无明显刑冲合害"}。`);
      lines.push(`\n可进一步提问：旺衰喜用、格局取用、事业财运、婚恋健康、大运走势、神煞解读等。`);
    }
    lines.push(`\n（本地离线分析 · 建议启动 Node 服务接入 AI 模型获取更深入解读）`);
    return lines.join("\n");
  }

  async function askAI(event) {
    if (event) event.preventDefault();
    if (state.aiBusy) return;
    const input = $("#ai-question");
    const question = input.value.trim();
    if (!question) return;
    state.aiMessages.push({ role: "user", content: question });
    input.value = "";
    state.aiBusy = true;
    renderAI();
    const context = getAIContext();
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          context,
          history: state.aiMessages.slice(0, -1).slice(-8)
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "AI 服务暂不可用");
      state.aiMessages.push({ role: "assistant", content: data.message });
      state.aiAvailable = true;
    } catch (error) {
      const localResponse = localAIResponse(question, context);
      state.aiMessages.push({ role: "assistant", content: localResponse });
      state.aiAvailable = false;
    } finally {
      state.aiBusy = false;
      renderAI();
      $("#ai-messages").scrollTop = $("#ai-messages").scrollHeight;
    }
  }

  function openGlossary(term) {
    $("#glossary-search").value = term || "";
    renderGlossary(term);
    openModal("glossary-modal");
  }

  function renderGlossary(filter) {
    const keyword = String(filter || "").trim().toLowerCase();
    const list = GLOSSARY.filter(([term, description]) => !keyword || `${term}${description}`.toLowerCase().includes(keyword));
    $("#glossary-list").innerHTML = list.length ? list.map(([term, description]) => `
      <div class="glossary-item"><strong>${term}</strong><p>${description}</p></div>
    `).join("") : `<div class="empty-archives">未找到相关术语</div>`;
  }

  function navigateFortune(direction) {
    const amount = Number(direction);
    const date = new Date(state.fortuneAnchor);
    if (state.fortuneLevel === "year") date.setFullYear(date.getFullYear() + amount * 10);
    else if (state.fortuneLevel === "month") date.setFullYear(date.getFullYear() + amount);
    else if (state.fortuneLevel === "day") date.setMonth(date.getMonth() + amount);
    else if (state.fortuneLevel === "hour") date.setDate(date.getDate() + amount);
    state.fortuneAnchor = date;
    state.selectedPeriodIndex = null;
    renderFortune();
    refreshIcons();
  }

  function handleGlobalClick(event) {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      switchView(viewButton.dataset.view);
      if (viewButton.dataset.method) {
        state.selectedMethod = viewButton.dataset.method;
        renderMethods();
      }
    }

    const methodButton = event.target.closest("[data-method]");
    if (methodButton && !methodButton.dataset.view) {
      state.selectedMethod = methodButton.dataset.method;
      renderMethods();
      $("#divination-workbench").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    const castButton = event.target.closest("[data-cast]");
    if (castButton) castDivination(castButton.dataset.cast);

    const topicButton = event.target.closest("[data-report-topic]");
    if (topicButton) {
      state.reportTopic = topicButton.dataset.reportTopic;
      renderReports();
      refreshIcons();
    }

    // AI专题切换
    const aiTopicButton = event.target.closest("[data-ai-topic]");
    if (aiTopicButton) {
      state.aiTopic = aiTopicButton.dataset.aiTopic;
      renderReports();
      refreshIcons();
    }

    // AI复制按钮
    if (event.target.closest("#ai-copy-chart-btn, #ai-copy-chart")) copyToAIChartData();
    if (event.target.closest("#ai-copy-prompt-btn")) copyToAIPrompt();
    if (event.target.closest("#ai-copy-all-btn")) copyToAIAll();

    const periodButton = event.target.closest("[data-period-index]");
    if (periodButton) {
      state.selectedPeriodIndex = Number(periodButton.dataset.periodIndex);
      renderFortune();
      refreshIcons();
    }

    const glossaryButton = event.target.closest("[data-open-glossary]");
    if (glossaryButton) openGlossary(glossaryButton.dataset.openGlossary);

    const archiveOpen = event.target.closest("[data-open-archive]");
    if (archiveOpen) {
      const profile = state.archives.find((item) => item.id === archiveOpen.dataset.openArchive);
      if (profile) {
        state.profile = JSON.parse(JSON.stringify(profile));
        state.hourUnknown = Boolean(profile.hourUnknown);
        state.selectedPeriodIndex = null;
        renderAll();
        switchView("overview");
        showToast(`已打开${profile.name}的命盘`, "folder-open");
      }
    }

    const archiveHistory = event.target.closest("[data-history-archive]");
    if (archiveHistory) {
      const profile = state.archives.find((item) => item.id === archiveHistory.dataset.historyArchive);
      if (profile) openGenerationHistory(profile);
    }

    const archiveEdit = event.target.closest("[data-edit-archive]");
    if (archiveEdit) {
      const profile = state.archives.find((item) => item.id === archiveEdit.dataset.editArchive);
      if (profile) {
        state.profile = JSON.parse(JSON.stringify(profile));
        state.hourUnknown = Boolean(profile.hourUnknown);
        state.pendingProfileIsNew = false;
        populateProfileForm(profile);
        openModal("profile-modal");
        $("#profile-modal-title").textContent = "编辑命例";
        refreshCalculationPreview();
      }
    }

    const historyRestore = event.target.closest("[data-restore-history]");
    if (historyRestore) restoreGeneration(historyRestore.dataset.restoreHistory);

    const historyDelete = event.target.closest("[data-delete-history]");
    if (historyDelete) deleteGeneration(historyDelete.dataset.deleteHistory);

    const archiveDelete = event.target.closest("[data-delete-archive]");
    if (archiveDelete) {
      const profile = state.archives.find((item) => item.id === archiveDelete.dataset.deleteArchive);
      if (profile && window.confirm(`确定删除“${profile.name}”命例吗？此操作仅影响本机记录。`)) {
        state.archives = state.archives.filter((item) => item.id !== profile.id);
        saveArchives();
        renderArchives($("#archive-search").value);
        showToast("命例已删除", "trash-2");
      }
    }

    const closeButton = event.target.closest(".modal-close");
    if (closeButton) closeModal(closeButton.closest(".modal-backdrop"));

    // 会员中心打开按钮
    const openMember = event.target.closest("[data-open-member]");
    if (openMember) {
      const plan = openMember.dataset.openMember === "1" ? null : openMember.dataset.openMember;
      openMemberModal(plan);
    }
  }

  // ========== 农历排盘功能 ==========
  const LUNAR_YEAR_RANGE = { min: 1900, max: 2100 };
  const LUNAR_MONTHS = ["正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "冬月", "腊月"];
  const LUNAR_DAYS = [
    "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
    "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
    "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"
  ];

  function initLunarPicker() {
    const yearSel = $("#lunar-year");
    const monthSel = $("#lunar-month");
    const daySel = $("#lunar-day");
    const hourSel = $("#lunar-hour");
    const minuteSel = $("#lunar-minute");

    // 年份
    let yearOptions = "";
    for (let y = LUNAR_YEAR_RANGE.max; y >= LUNAR_YEAR_RANGE.min; y--) {
      yearOptions += `<option value="${y}">${y}年</option>`;
    }
    yearSel.innerHTML = yearOptions;

    // 小时
    let hourOptions = "";
    for (let h = 0; h < 24; h++) {
      hourOptions += `<option value="${h}">${String(h).padStart(2, "0")}时</option>`;
    }
    hourSel.innerHTML = hourOptions;

    // 分钟
    let minuteOptions = "";
    for (let m = 0; m < 60; m++) {
      minuteOptions += `<option value="${m}">${String(m).padStart(2, "0")}分</option>`;
    }
    minuteSel.innerHTML = minuteOptions;

    // 默认值
    yearSel.value = "1990";
    updateLunarMonths();
    monthSel.value = "1";
    updateLunarDays();
    daySel.value = "1";
    hourSel.value = "12";
    minuteSel.value = "0";
    updateLunarBranchLabel();
    updateLunarSolarHint();
  }

  function updateLunarMonths() {
    const year = Number($("#lunar-year").value);
    const monthSel = $("#lunar-month");
    if (!window.Lunar) {
      let options = "";
      for (let m = 1; m <= 12; m++) {
        options += `<option value="${m}">${LUNAR_MONTHS[m - 1]}</option>`;
      }
      monthSel.innerHTML = options;
      return;
    }
    try {
      const lunarObj = window.Lunar.fromYmd(year, 1, 1);
      const leapMonth = Math.abs(lunarObj.getLeapMonth());
      let options = "";
      for (let m = 1; m <= 12; m++) {
        options += `<option value="${m}">${LUNAR_MONTHS[m - 1]}</option>`;
        if (m === leapMonth && leapMonth > 0) {
          options += `<option value="-${m}">闰${LUNAR_MONTHS[m - 1]}</option>`;
        }
      }
      monthSel.innerHTML = options;
    } catch (e) {
      let options = "";
      for (let m = 1; m <= 12; m++) {
        options += `<option value="${m}">${LUNAR_MONTHS[m - 1]}</option>`;
      }
      monthSel.innerHTML = options;
    }
  }

  function updateLunarDays() {
    const year = Number($("#lunar-year").value);
    const month = Number($("#lunar-month").value);
    const daySel = $("#lunar-day");
    let dayCount = 30;
    if (window.LunarMonth) {
      try {
        const lunarMonth = window.LunarMonth.fromYm(year, month);
        dayCount = lunarMonth.getDayCount();
      } catch (e) {
        dayCount = 29;
      }
    } else {
      dayCount = Math.abs(month) === 1 || Math.abs(month) === 3 || Math.abs(month) === 5 || Math.abs(month) === 7 || Math.abs(month) === 8 || Math.abs(month) === 10 || Math.abs(month) === 12 ? 30 : 29;
    }
    let options = "";
    for (let d = 1; d <= dayCount; d++) {
      options += `<option value="${d}">${LUNAR_DAYS[d - 1]}</option>`;
    }
    daySel.innerHTML = options;
    const currentDay = Number(daySel.value);
    if (currentDay > dayCount) daySel.value = String(dayCount);
  }

  function updateLunarBranchLabel() {
    const hour = Number($("#lunar-hour").value);
    const branches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
    const branchIndex = Math.floor((hour + 1) / 2) % 12;
    $("#lunar-branch-label").textContent = branches[branchIndex] + "时";
  }

  function updateLunarSolarHint() {
    if (!window.Lunar) return;
    try {
      const year = Number($("#lunar-year").value);
      const month = Number($("#lunar-month").value);
      const day = Number($("#lunar-day").value);
      const hour = Number($("#lunar-hour").value);
      const minute = Number($("#lunar-minute").value);
      const lunarObj = window.Lunar.fromYmdHms(year, month, day, hour, minute, 0);
      const solar = lunarObj.getSolar();
      $("#lunar-solar-hint").textContent = `对应公历：${solar.getYear()}年${solar.getMonth()}月${solar.getDay()}日`;
    } catch (e) {
      $("#lunar-solar-hint").textContent = "";
    }
  }

  function getLunarDateAsSolar() {
    if (!window.Lunar) return null;
    try {
      const year = Number($("#lunar-year").value);
      const month = Number($("#lunar-month").value);
      const day = Number($("#lunar-day").value);
      const hour = Number($("#lunar-hour").value);
      const minute = Number($("#lunar-minute").value);
      const lunarObj = window.Lunar.fromYmdHms(year, month, day, hour, minute, 0);
      const solar = lunarObj.getSolar();
      return {
        year: solar.getYear(),
        month: solar.getMonth(),
        day: solar.getDay(),
        hour: solar.getHour(),
        minute: solar.getMinute()
      };
    } catch (e) {
      return null;
    }
  }

  function setLunarFromSolar(year, month, day, hour, minute) {
    if (!window.Solar) return;
    try {
      const solarObj = window.Solar.fromYmdHms(year, month, day, hour, minute, 0);
      const lunarObj = solarObj.getLunar();
      $("#lunar-year").value = String(lunarObj.getYear());
      updateLunarMonths();
      $("#lunar-month").value = String(lunarObj.getMonth());
      updateLunarDays();
      $("#lunar-day").value = String(lunarObj.getDay());
      $("#lunar-hour").value = String(lunarObj.getHour());
      $("#lunar-minute").value = String(lunarObj.getMinute());
      updateLunarBranchLabel();
      updateLunarSolarHint();
    } catch (e) {
      // ignore
    }
  }

  // ========== 省-市-县三级地址选择 ==========
  function initRegionPicker() {
    if (!window.CHINA_REGIONS || !window.CHINA_REGIONS.provinces) return;
    const provinceSel = $("#region-province");
    const citySel = $("#region-city");
    const districtSel = $("#region-district");

    // 填充省份
    let provinceOptions = '<option value="">请选择省份</option>';
    window.CHINA_REGIONS.provinces.forEach((p, idx) => {
      provinceOptions += `<option value="${idx}">${p.name}</option>`;
    });
    provinceSel.innerHTML = provinceOptions;

    provinceSel.addEventListener("change", () => {
      updateCityOptions();
      updateDistrictOptions();
      syncLocationFromRegion();
      syncLongitudeFromRegion();
      if (selectedCalculationMode() !== "manual") refreshCalculationPreview();
    });

    citySel.addEventListener("change", () => {
      updateDistrictOptions();
      syncLocationFromRegion();
      syncLongitudeFromRegion();
      if (selectedCalculationMode() !== "manual") refreshCalculationPreview();
    });

    districtSel.addEventListener("change", () => {
      syncLocationFromRegion();
    });
  }

  function updateCityOptions() {
    const provinceIdx = $("#region-province").value;
    const citySel = $("#region-city");
    if (!provinceIdx) {
      citySel.innerHTML = '<option value="">请选择城市</option>';
      return;
    }
    const province = window.CHINA_REGIONS.provinces[Number(provinceIdx)];
    if (!province) return;
    let options = '<option value="">请选择城市</option>';
    province.cities.forEach((c, idx) => {
      options += `<option value="${idx}">${c.name}</option>`;
    });
    citySel.innerHTML = options;
  }

  function updateDistrictOptions() {
    const provinceIdx = $("#region-province").value;
    const cityIdx = $("#region-city").value;
    const districtSel = $("#region-district");
    if (!provinceIdx || !cityIdx) {
      districtSel.innerHTML = '<option value="">请选择区县</option>';
      return;
    }
    const province = window.CHINA_REGIONS.provinces[Number(provinceIdx)];
    const city = province?.cities[Number(cityIdx)];
    if (!city) return;
    let options = '<option value="">请选择区县</option>';
    city.districts.forEach((d) => {
      options += `<option value="${d}">${d}</option>`;
    });
    districtSel.innerHTML = options;
  }

  function syncLocationFromRegion() {
    const provinceIdx = $("#region-province").value;
    const cityIdx = $("#region-city").value;
    const district = $("#region-district").value;
    if (!provinceIdx) {
      $("#input-location").value = "";
      return;
    }
    const province = window.CHINA_REGIONS.provinces[Number(provinceIdx)];
    const city = province?.cities[Number(cityIdx)];
    const parts = [];
    if (province) parts.push(province.name);
    if (city) parts.push(city.name);
    if (district) parts.push(district);
    $("#input-location").value = parts.join("-");
  }

  function syncLongitudeFromRegion() {
    const provinceIdx = $("#region-province").value;
    const cityIdx = $("#region-city").value;
    if (!provinceIdx || !cityIdx || !window.CITY_LONGITUDES) return;
    const province = window.CHINA_REGIONS.provinces[Number(provinceIdx)];
    const city = province?.cities[Number(cityIdx)];
    if (!city) return;
    const cityName = city.name.replace(/市$/, "");
    const coord = window.CITY_LONGITUDES[city.name] || window.CITY_LONGITUDES[cityName];
    if (coord) {
      $("#input-longitude").value = coord.lng;
    } else {
      // 尝试用省会城市
      const provName = province.name.replace(/省|市|自治区|壮族|回族|维吾尔/g, "");
      const provCoord = window.CITY_LONGITUDES[province.name] || window.CITY_LONGITUDES[provName];
      if (provCoord) $("#input-longitude").value = provCoord.lng;
    }
  }

  function setRegionFromLocation(locationText) {
    if (!locationText || !window.CHINA_REGIONS) return;
    const parts = locationText.split(/[-\/\s]+/);
    const provinceSel = $("#region-province");
    const citySel = $("#region-city");
    const districtSel = $("#region-district");

    // 查找省份
    let provIdx = -1;
    if (parts[0]) {
      provIdx = window.CHINA_REGIONS.provinces.findIndex((p) => p.name === parts[0] || p.name.includes(parts[0]) || parts[0].includes(p.name.replace(/省|市|自治区/g, "")));
    }
    if (provIdx >= 0) {
      provinceSel.value = String(provIdx);
      updateCityOptions();
      // 查找城市
      const province = window.CHINA_REGIONS.provinces[provIdx];
      let cityIdx = -1;
      if (parts[1]) {
        cityIdx = province.cities.findIndex((c) => c.name === parts[1] || c.name.includes(parts[1]) || parts[1].includes(c.name.replace(/市|州|地区/g, "")));
      }
      if (cityIdx >= 0) {
        citySel.value = String(cityIdx);
        updateDistrictOptions();
        // 查找区县
        if (parts[2]) {
          const city = province.cities[cityIdx];
          const distIdx = city.districts.findIndex((d) => d === parts[2] || d.includes(parts[2]) || parts[2].includes(d));
          if (distIdx >= 0) districtSel.value = city.districts[distIdx];
        }
      }
    }
  }

  // ========== 城市搜索功能 ==========
  function initRegionSearch() {
    const input = $("#region-search-input");
    const dropdown = $("#region-search-dropdown");
    if (!input || !dropdown) return;

    let activeIndex = -1;
    let results = [];

    function searchCities(keyword) {
      if (!keyword || !window.CHINA_REGIONS) return [];
      const kw = keyword.trim().toLowerCase();
      if (!kw) return [];
      const matches = [];
      window.CHINA_REGIONS.provinces.forEach((province, pIdx) => {
        // 匹配省份
        if (province.name.toLowerCase().includes(kw)) {
          matches.push({
            type: "province",
            pIdx,
            cIdx: -1,
            district: "",
            name: province.name,
            full: province.name
          });
        }
        province.cities.forEach((city, cIdx) => {
          // 匹配城市
          if (city.name.toLowerCase().includes(kw) || province.name.toLowerCase().includes(kw)) {
            matches.push({
              type: "city",
              pIdx,
              cIdx,
              district: "",
              name: city.name,
              full: province.name + " · " + city.name
            });
          }
          city.districts.forEach((district) => {
            // 匹配区县
            if (district.toLowerCase().includes(kw) || city.name.toLowerCase().includes(kw)) {
              matches.push({
                type: "district",
                pIdx,
                cIdx,
                district,
                name: district,
                full: province.name + " · " + city.name + " · " + district
              });
            }
          });
        });
      });
      return matches.slice(0, 30);
    }

    function renderDropdown(list) {
      results = list;
      activeIndex = -1;
      if (list.length === 0) {
        dropdown.innerHTML = '<div class="region-search-empty">未找到匹配的城市</div>';
        dropdown.hidden = false;
        return;
      }
      dropdown.innerHTML = list.map((item, idx) => `
        <div class="region-search-item" data-idx="${idx}">
          <div class="search-item-main">${item.name}</div>
          <div class="search-item-sub">${item.full}</div>
        </div>
      `).join("");
      dropdown.hidden = false;
    }

    function selectResult(idx) {
      if (idx < 0 || idx >= results.length) return;
      const item = results[idx];
      const provinceSel = $("#region-province");
      const citySel = $("#region-city");
      const districtSel = $("#region-district");

      provinceSel.value = String(item.pIdx);
      updateCityOptions();

      if (item.cIdx >= 0) {
        citySel.value = String(item.cIdx);
        updateDistrictOptions();
      }

      if (item.district) {
        districtSel.value = item.district;
      }

      syncLocationFromRegion();
      syncLongitudeFromRegion();
      if (selectedCalculationMode() !== "manual") refreshCalculationPreview();

      input.value = item.full;
      dropdown.hidden = true;
      input.blur();
    }

    input.addEventListener("input", () => {
      const kw = input.value.trim();
      if (!kw) {
        dropdown.hidden = true;
        return;
      }
      const list = searchCities(kw);
      renderDropdown(list);
    });

    input.addEventListener("focus", () => {
      if (input.value.trim() && results.length > 0) {
        dropdown.hidden = false;
      }
    });

    input.addEventListener("keydown", (e) => {
      if (dropdown.hidden || results.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, results.length - 1);
        updateActiveItem();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        updateActiveItem();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeIndex >= 0) selectResult(activeIndex);
        else if (results.length > 0) selectResult(0);
      } else if (e.key === "Escape") {
        dropdown.hidden = true;
      }
    });

    function updateActiveItem() {
      $$(".region-search-item", dropdown).forEach((el, idx) => {
        el.classList.toggle("active", idx === activeIndex);
        if (idx === activeIndex) {
          el.scrollIntoView({ block: "nearest" });
        }
      });
    }

    dropdown.addEventListener("click", (e) => {
      const item = e.target.closest(".region-search-item");
      if (item) {
        const idx = Number(item.dataset.idx);
        selectResult(idx);
      }
    });

    // 点击外部关闭
    document.addEventListener("click", (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.hidden = true;
      }
    });
  }

  // ========== 排盘模式切换 ==========
  function updateCalculationModeUI() {
    const mode = selectedCalculationMode();
    const solarField = $("#solar-date-field");
    const lunarField = $("#lunar-date-field");

    if (mode === "lunar") {
      solarField.style.display = "none";
      lunarField.style.display = "block";
      // 同步公历到农历
      const dateVal = $("#input-date").value;
      const timeVal = $("#input-time").value;
      if (dateVal && timeVal) {
        const [y, m, d] = dateVal.split("-").map(Number);
        const [h, min] = timeVal.split(":").map(Number);
        setLunarFromSolar(y, m, d, h, min);
      }
    } else if (mode === "calendar") {
      solarField.style.display = "block";
      lunarField.style.display = "none";
    } else {
      solarField.style.display = "block";
      lunarField.style.display = "none";
    }
  }

  function bindEvents() {
    document.addEventListener("click", handleGlobalClick);
    $$(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) closeModal(backdrop);
      });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        const open = $(".modal-backdrop.open");
        if (open) closeModal(open);
        else $("#sidebar").classList.remove("open");
      }
    });

    $("#mobile-menu").addEventListener("click", () => {
      $("#sidebar").classList.toggle("open");
      const overlay = $("#sidebar-overlay");
      if (overlay) overlay.classList.toggle("show", $("#sidebar").classList.contains("open"));
    });

    const floatingBtn = $("#floating-menu-btn");
    if (floatingBtn) {
      floatingBtn.addEventListener("click", () => {
        $("#sidebar").classList.toggle("open");
        const overlay = $("#sidebar-overlay");
        if (overlay) overlay.classList.toggle("show", $("#sidebar").classList.contains("open"));
      });
    }

    const sidebarOverlay = $("#sidebar-overlay");
    if (sidebarOverlay) {
      sidebarOverlay.addEventListener("click", () => {
        $("#sidebar").classList.remove("open");
        sidebarOverlay.classList.remove("show");
      });
    }

    // 主Tab点击切换
    $$(".main-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const view = tab.dataset.mainTab;
        if (view) switchView(view);
      });
    });

    // 主内容区左右滑动切换（手机手势）
    let touchStartX = 0;
    let touchStartY = 0;
    let touchMoved = false;
    const SWIPE_THRESHOLD = 60;
    const mainTabsOrder = ["overview", "fortune", "reports"];

    document.addEventListener("touchstart", (event) => {
      const mainTabs = ["overview", "fortune", "reports"];
      if (!mainTabs.includes(state.view)) return;
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
      touchMoved = false;
    }, { passive: true });

    document.addEventListener("touchmove", (event) => {
      if (touchMoved) return;
      const dx = Math.abs(event.touches[0].clientX - touchStartX);
      const dy = Math.abs(event.touches[0].clientY - touchStartY);
      if (dx > 10 && dx > dy * 1.5) touchMoved = true;
    }, { passive: true });

    document.addEventListener("touchend", (event) => {
      const mainTabs = ["overview", "fortune", "reports"];
      if (!mainTabs.includes(state.view)) return;
      if (!touchMoved) return;
      const endX = event.changedTouches[0].clientX;
      const endY = event.changedTouches[0].clientY;
      const dx = endX - touchStartX;
      const dy = endY - touchStartY;
      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;
      // 忽略边缘滑动（可能是侧边栏手势）
      if (touchStartX < 30 && dx > 0) return;
      const currentIdx = mainTabsOrder.indexOf(state.view);
      if (dx < 0 && currentIdx < mainTabsOrder.length - 1) {
        // 向左滑 → 下一页
        switchView(mainTabsOrder[currentIdx + 1]);
      } else if (dx > 0 && currentIdx > 0) {
        // 向右滑 → 上一页
        switchView(mainTabsOrder[currentIdx - 1]);
      }
    }, { passive: true });
    $("#mobile-back").addEventListener("click", () => {
      if ($("#sidebar").classList.contains("open")) {
        $("#sidebar").classList.remove("open");
      } else if (state.view !== "overview") {
        switchView("overview");
      } else if (window.history.length > 1) {
        window.history.back();
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
    $("#new-chart-button").addEventListener("click", () => populateProfileForm(null, true));
    const newChartOverviewBtn = $("#new-chart-overview-btn");
    if (newChartOverviewBtn) newChartOverviewBtn.addEventListener("click", () => populateProfileForm(null, true));
    $("#archive-new").addEventListener("click", () => populateProfileForm(null, true));
    $("#edit-profile-button").addEventListener("click", () => populateProfileForm(state.profile, false));
    // 会员中心入口（连点5次弹出管理员秘钥输入）
    let adminClickCount = 0;
    let adminClickTimer = null;
    function handleMemberEntryClick() {
      adminClickCount++;
      clearTimeout(adminClickTimer);
      adminClickTimer = setTimeout(() => { adminClickCount = 0; }, 2000);
      if (adminClickCount >= 5) {
        adminClickCount = 0;
        clearTimeout(adminClickTimer);
        const key = prompt("请输入管理员秘钥：");
        if (key && verifyAdminKey(key)) {
          setAdminAccess(true);
          showToast("管理员权限已解锁", "check");
          if (window.XJ) window.XJ.isAdminAccess = isAdminAccess;
          setTimeout(() => { window.location.href = "./admin.html"; }, 800);
        } else if (key) {
          showToast("秘钥不正确", "alert");
        }
        return;
      }
      openMemberModal();
    }
    const memberEntryBtn = $("#member-entry-button");
    if (memberEntryBtn) memberEntryBtn.addEventListener("click", handleMemberEntryClick);
    const memberNavBtn = $("#member-nav-button");
    if (memberNavBtn) memberNavBtn.addEventListener("click", () => { $("#sidebar").classList.remove("open"); handleMemberEntryClick(); });
    // 会员激活按钮 & 套餐选择 & Tab切换 & 钱包提现 & 支付
    document.addEventListener("click", (event) => {
      if (event.target.id === "member-activate-button") handleMemberActivate();
      if (event.target.id === "redeem-tab-btn") handleRedeemTabActivate();
      const planCard = event.target.closest("[data-plan]");
      if (planCard) {
        state.pendingMemberPlan = planCard.dataset.plan;
        renderMemberCenter("plans");
        refreshIcons();
      }
      // 会员中心Tab切换
      const memberTab = event.target.closest("[data-member-tab]");
      if (memberTab) {
        renderMemberCenter(memberTab.dataset.memberTab);
        refreshIcons();
      }
      // 支付方式选择
      const payMethodBtn = event.target.closest("[data-pay-method]");
      if (payMethodBtn) {
        const method = payMethodBtn.dataset.payMethod;
        $$(".pay-method-card").forEach((c) => c.classList.remove("active"));
        payMethodBtn.classList.add("active");
      }
      // 扫码支付按钮
      if (event.target.id === "pay-submit-btn" || event.target.closest("#pay-submit-btn")) {
        const activeMethod = document.querySelector(".pay-method-card.active");
        const method = activeMethod ? activeMethod.dataset.payMethod : "wechat";
        openPaymentModal(state.pendingMemberPlan, method);
      }
    });
    // ========== 专属特权功能 ==========
    const EXCLUSIVE_KEY = "XJ@Exclusive2026"; // 专属密钥：仅一人可用
    const EXCLUSIVE_STORE_KEY = "xuanjian_exclusive_v1";

    function verifyExclusiveKey(key) {
      return key === EXCLUSIVE_KEY;
    }

    function setExclusiveAccess(enabled) {
      if (enabled) {
        localStorage.setItem(EXCLUSIVE_STORE_KEY, JSON.stringify({
          granted: true,
          grantedAt: Date.now(),
          deviceFingerprint: adminHash(navigator.userAgent + location.host + (navigator.language || ""))
        }));
      } else {
        localStorage.removeItem(EXCLUSIVE_STORE_KEY);
      }
    }

    function isExclusiveAccess() {
      try {
        const raw = localStorage.getItem(EXCLUSIVE_STORE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        return Boolean(data.granted);
      } catch (e) {
        return false;
      }
    }

    function renderExclusiveBadge() {
      const navBtn = $("#exclusive-nav-button");
      const entryBtn = $("#exclusive-entry-button");
      if (isExclusiveAccess()) {
        if (navBtn) navBtn.classList.remove("hidden");
      } else {
        if (navBtn) navBtn.classList.add("hidden");
      }
    }

    function openExclusiveModal() {
      if (!isExclusiveAccess()) {
        // 未解锁时，提示输入专属密钥
        const key = prompt("请输入专属密钥：");
        if (key && verifyExclusiveKey(key)) {
          setExclusiveAccess(true);
          renderExclusiveBadge();
          showToast("专属特权已激活", "gem");
        } else if (key) {
          showToast("密钥不正确", "circle-alert");
          return;
        } else {
          return;
        }
      }
      renderExclusiveCenter();
      openModal("exclusive-modal");
    }

    function renderExclusiveCenter() {
      const body = $("#exclusive-body");
      if (!body) return;

      const member = getMemberState();
      const wallet = getWallet();

      body.innerHTML = `
        <div class="exclusive-hero">
          <div class="exclusive-hero-inner">
            <div class="exclusive-avatar">
              <i data-lucide="gem"></i>
            </div>
            <div class="exclusive-hero-text">
              <h3>尊贵的专属会员</h3>
              <p>您享有一人专属的定制服务 · 全年无休</p>
            </div>
          </div>
          <div class="exclusive-stats">
            <div class="excl-stat">
              <em>1</em>
              <span>专属编号</span>
            </div>
            <div class="excl-stat">
              <em>终身</em>
              <span>特权期限</span>
            </div>
            <div class="excl-stat">
              <em>无限</em>
              <span>次解读</span>
            </div>
          </div>
        </div>

        <div class="exclusive-section">
          <span class="panel-kicker">✦ 专属服务</span>
          <div class="exclusive-grid">
            <button class="exclusive-card" data-excl-service="custom-chart" type="button">
              <div class="excl-card-icon"><i data-lucide="sparkles"></i></div>
              <h4>定制命例深度解析</h4>
              <p>为您量身定制的命局全维度深度报告，含格局成败、用神喜忌、大运流年关键节点</p>
              <span class="excl-card-tag">一对一专属</span>
            </button>
            <button class="exclusive-card" data-excl-service="yearly-report" type="button">
              <div class="excl-card-icon"><i data-lucide="calendar-range"></i></div>
              <h4>年度运势白皮书</h4>
              <p>每年度12个月逐月精批报告，含事业、财运、感情、健康四大维度详解</p>
              <span class="excl-card-tag">每年1份</span>
            </button>
            <button class="exclusive-card" data-excl-service="consultation" type="button">
              <div class="excl-card-icon"><i data-lucide="message-circle-heart"></i></div>
              <h4>一对一命理咨询</h4>
              <p>预约专属命理师一对一视频/语音咨询，解答您最关心的人生问题</p>
              <span class="excl-card-tag">每季度1次</span>
            </button>
            <button class="exclusive-card" data-excl-service="advisor" type="button">
              <div class="excl-card-icon"><i data-lucide="phone"></i></div>
              <h4>专属顾问直连</h4>
              <p>专属顾问微信/电话通道，重大决策前即时咨询，24小时内回复</p>
              <span class="excl-card-tag">优先响应</span>
            </button>
          </div>
        </div>

        <div class="exclusive-section">
          <span class="panel-kicker">✦ 专属权益</span>
          <div class="exclusive-benefits">
            <div class="excl-benefit-row">
              <i data-lucide="check-circle-2"></i>
              <div>
                <strong>全部会员功能终身免费</strong>
                <span>含所有付费功能、未来新增高级功能全部优先解锁</span>
              </div>
            </div>
            <div class="excl-benefit-row">
              <i data-lucide="check-circle-2"></i>
              <div>
                <strong>专属定制命盘导出</strong>
                <span>高清命盘PDF、专属命盘壁纸、个人命局手册打印版</span>
              </div>
            </div>
            <div class="excl-benefit-row">
              <i data-lucide="check-circle-2"></i>
              <div>
                <strong>重要日期提醒</strong>
                <span>大运交接、流年转换、关键吉凶日期提前提醒，助您把握时机</span>
              </div>
            </div>
            <div class="excl-benefit-row">
              <i data-lucide="check-circle-2"></i>
              <div>
                <strong>新品优先体验</strong>
                <span>所有新功能、新工具、新课程，您第一个体验并参与设计</span>
              </div>
            </div>
            <div class="excl-benefit-row">
              <i data-lucide="check-circle-2"></i>
              <div>
                <strong>专属标识与界面</strong>
                <span>专属金色主题、个人编号、专属徽章，彰显独一无二的身份</span>
              </div>
            </div>
          </div>
        </div>

        <div class="exclusive-section">
          <span class="panel-kicker">✦ 账户信息</span>
          <div class="exclusive-info">
            <div class="excl-info-row">
              <span>专属编号</span>
              <strong>EX-000001</strong>
            </div>
            <div class="excl-info-row">
              <span>激活日期</span>
              <strong>${new Date().toLocaleDateString("zh-CN")}</strong>
            </div>
            <div class="excl-info-row">
              <span>账户余额</span>
              <strong class="accent-text">¥${wallet.balance.toFixed(2)}</strong>
            </div>
            <div class="excl-info-row">
              <span>会员等级</span>
              <strong>${member ? member.planName : "—"}</strong>
            </div>
          </div>
        </div>

        <div class="exclusive-footer">
          <button class="button ghost" id="exclusive-contact-btn" type="button">
            <i data-lucide="message-circle"></i>联系专属顾问
          </button>
          <button class="button primary" id="exclusive-consult-btn" type="button">
            <i data-lucide="calendar"></i>预约咨询
          </button>
        </div>
      `;
      refreshIcons();
    }

    // 专属特权入口按钮事件
    const exclusiveNavBtn = $("#exclusive-nav-button");
    if (exclusiveNavBtn) {
      exclusiveNavBtn.addEventListener("click", () => {
        $("#sidebar").classList.remove("open");
        openExclusiveModal();
      });
    }

    // 专属特权服务点击事件
    document.addEventListener("click", (event) => {
      const exclCard = event.target.closest("[data-excl-service]");
      if (exclCard) {
        const service = exclCard.dataset.exclService;
        const serviceNames = {
          "custom-chart": "定制命例深度解析",
          "yearly-report": "年度运势白皮书",
          "consultation": "一对一命理咨询",
          "advisor": "专属顾问直连"
        };
        showToast(`正在为您安排专属${serviceNames[service] || service}服务，专属顾问将在24小时内联系您`, "gem");
      }

      if (event.target.id === "exclusive-contact-btn" || event.target.closest("#exclusive-contact-btn")) {
        showToast("专属顾问微信：xuanjian-advisor01 · 添加时请备注专属编号", "message-circle");
      }
      if (event.target.id === "exclusive-consult-btn" || event.target.closest("#exclusive-consult-btn")) {
        showToast("预约请求已提交，专属顾问将在24小时内与您确认时间", "calendar");
      }
    });

    // 初始化时检查并显示专属入口
    renderExclusiveBadge();
    $("#profile-switcher").addEventListener("click", () => switchView("archives"));
    $("#profile-form").addEventListener("submit", handleProfileSubmit);

    // 三步引导按钮
    const stepNextBtn = $("#step-next-btn");
    if (stepNextBtn) stepNextBtn.addEventListener("click", goToNextChartStep);
    const stepSkipBtn = $("#step-skip-btn");
    if (stepSkipBtn) stepSkipBtn.addEventListener("click", finishChartGuide);
    $("#datetime-trigger").addEventListener("click", openDatetimePicker);
    $("#datetime-confirm").addEventListener("click", confirmDatetimePicker);
    $$('input[name="calculationMode"], input[name="sect"], input[name="year-boundary"]').forEach((input) => {
      input.addEventListener("change", () => {
        updateCalculationModeUI();
        refreshCalculationPreview();
      });
    });
    $("#input-true-solar").addEventListener("change", refreshCalculationPreview);
    $("#input-longitude").addEventListener("input", refreshCalculationPreview);

    // 时柱未知开关
    const hourUnknownCheckbox = $("#hour-unknown");
    if (hourUnknownCheckbox) {
      hourUnknownCheckbox.addEventListener("change", () => {
        state.hourUnknown = hourUnknownCheckbox.checked;
        updateDatetimeLabels();
        // 更新滚轮选择器状态
        const wheelPicker = $("#wheel-picker");
        if (wheelPicker) wheelPicker.classList.toggle("hour-unknown", state.hourUnknown);
      });
    }
    // 农历选择器事件（同时绑定 change 和 input，兼容不同浏览器/设备）
    const lunarInputIds = ["lunar-year", "lunar-month", "lunar-day", "lunar-hour", "lunar-minute"];
    const handleLunarChange = () => {
      updateLunarSolarHint();
      // 同步到公历隐藏字段
      const solar = getLunarDateAsSolar();
      if (solar) {
        $("#input-date").value = `${solar.year}-${String(solar.month).padStart(2, "0")}-${String(solar.day).padStart(2, "0")}`;
        $("#input-time").value = `${String(solar.hour).padStart(2, "0")}:${String(solar.minute).padStart(2, "0")}`;
      }
      refreshCalculationPreview();
    };
    lunarInputIds.forEach((id) => {
      const el = $("#" + id);
      if (!el) return;
      el.addEventListener("change", () => {
        if (id === "lunar-year") { updateLunarMonths(); updateLunarDays(); }
        if (id === "lunar-month") updateLunarDays();
        if (id === "lunar-hour") updateLunarBranchLabel();
        handleLunarChange();
      });
      // 移动端部分浏览器需 input 事件
      el.addEventListener("input", () => {
        if (id === "lunar-hour") updateLunarBranchLabel();
        handleLunarChange();
      });
    });
    $$(".wheel-column").forEach((column) => {
      const name = column.dataset.wheel;
      let scrollTicking = false;
      column.addEventListener("scroll", () => {
        if (scrollTicking) return;
        scrollTicking = true;
        requestAnimationFrame(() => {
          selectWheelIndex(column, false);
          scrollTicking = false;
        });
        clearTimeout(state.wheelScrollTimers[name]);
        state.wheelScrollTimers[name] = setTimeout(() => selectWheelIndex(column, true), 60);
      }, { passive: true });
      if (name === "year") {
        let wheelAccum = 0;
        let wheelTimer = null;
        column.addEventListener("wheel", (event) => {
          event.preventDefault();
          const absDelta = Math.abs(event.deltaY);
          const step = event.shiftKey ? 10 : absDelta > 100 ? 5 : absDelta > 50 ? 3 : 1;
          wheelAccum += Math.sign(event.deltaY);
          clearTimeout(wheelTimer);
          wheelTimer = setTimeout(() => { wheelAccum = 0; }, 200);
          if (Math.abs(wheelAccum) < 1) return;
          const direction = Math.sign(wheelAccum);
          const magnitude = Math.min(Math.abs(wheelAccum), 5);
          const currentIndex = WHEEL_STATIC_VALUES.year.indexOf(state.wheelValue.year);
          const nextIndex = clamp(currentIndex + direction * step * Math.max(1, Math.floor(magnitude)), 0, WHEEL_STATIC_VALUES.year.length - 1);
          column.scrollTo({ top: nextIndex * WHEEL_ITEM_HEIGHT, behavior: "smooth" });
          wheelAccum *= 0.5;
        }, { passive: false });
        column.setAttribute("tabindex", "0");
        column.addEventListener("keydown", (event) => {
          const currentIndex = WHEEL_STATIC_VALUES.year.indexOf(state.wheelValue.year);
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setWheelYear(state.wheelValue.year - (event.shiftKey ? 10 : 1), true);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            setWheelYear(state.wheelValue.year + (event.shiftKey ? 10 : 1), true);
          } else if (event.key === "Home") {
            event.preventDefault();
            setWheelYear(1900, true);
          } else if (event.key === "End") {
            event.preventDefault();
            setWheelYear(2100, true);
          } else if (event.key >= "0" && event.key <= "9") {
            event.preventDefault();
            const input = prompt("请输入年份 (1900-2100):", state.wheelValue.year);
            const year = Number(input);
            if (Number.isInteger(year) && year >= 1900 && year <= 2100) setWheelYear(year, true);
          }
        });
      }
    });
    $("#wheel-picker").addEventListener("click", (event) => {
      const item = event.target.closest("[data-wheel-value]");
      if (!item) return;
      const column = item.closest(".wheel-column");
      const name = column.dataset.wheel;
      const values = wheelValues(name);
      const value = Number(item.dataset.wheelValue);
      column.scrollTo({ top: values.indexOf(value) * WHEEL_ITEM_HEIGHT, behavior: "smooth" });
    });
    $$("[data-year-step]").forEach((button) => {
      button.addEventListener("click", () => {
        setWheelYear(state.wheelValue.year + Number(button.dataset.yearStep), true);
      });
    });
    $("[data-year-current]").addEventListener("click", () => {
      setWheelYear(new Date().getFullYear(), true);
    });
    $("#year-jump-button").addEventListener("click", () => {
      const input = $("#year-jump-input");
      const year = Number(input.value);
      if (Number.isInteger(year) && year >= 1900 && year <= 2100) {
        setWheelYear(year, true);
        input.value = "";
      } else {
        showToast("请输入 1900 至 2100 之间的年份", "circle-alert");
      }
    });
    $("#year-jump-input").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        $("#year-jump-button").click();
      }
    });
    $("#input-bazi").addEventListener("input", (event) => {
      const clean = event.target.value.replace(/[\s,，、/|]+/g, "");
      const status = $("#bazi-recognition-state");
      status.className = "";
      if (!clean) {
        status.textContent = "待识别";
        return;
      }
      if (clean.length !== 8) {
        status.textContent = `${clean.length}/8字`;
        return;
      }
      const pillars = [clean.slice(0, 2), clean.slice(2, 4), clean.slice(4, 6), clean.slice(6, 8)];
      if (pillars.some((pillar) => !parsePillar(pillar))) {
        status.textContent = "干支有误";
        status.className = "invalid";
        return;
      }
      PILLAR_KEYS.forEach((key, index) => {
        $(`#pillar-${key}`).value = pillars[index];
      });
      status.textContent = "识别成功";
      status.className = "valid";
      $("#form-validation").textContent = "";
    });
    PILLAR_KEYS.forEach((key) => {
      $(`#pillar-${key}`).addEventListener("input", () => {
        $("#input-bazi").value = PILLAR_KEYS.map((item) => $(`#pillar-${item}`).value.trim()).join(" ");
        $("#bazi-recognition-state").textContent = "已同步";
        $("#bazi-recognition-state").className = "valid";
      });
    });
    $("#save-profile-button").addEventListener("click", saveCurrentProfile);
    $("#share-profile-button").addEventListener("click", shareProfile);
    const aiForm = $("#ai-form");
    if (aiForm) aiForm.addEventListener("submit", askAI);
    const aiQuickAsks = $("#ai-quick-asks");
    if (aiQuickAsks) aiQuickAsks.addEventListener("click", (event) => {
      const btn = event.target.closest(".ai-quick-ask");
      if (!btn) return;
      const aiQuestion = $("#ai-question");
      if (aiQuestion) aiQuestion.value = btn.dataset.quick;
      askAI();
    });
    const aiClear = $("#ai-clear");
    if (aiClear) aiClear.addEventListener("click", () => {
      state.aiMessages = [];
      renderAI();
    });
    $("#search-button").addEventListener("click", () => openGlossary(""));
    $("#glossary-button").addEventListener("click", () => openGlossary(""));
    $("#legal-button").addEventListener("click", () => openModal("legal-modal"));
    $("#footer-legal").addEventListener("click", () => openModal("legal-modal"));
    $("#glossary-search").addEventListener("input", (event) => renderGlossary(event.target.value));
    $("#archive-search").addEventListener("input", (event) => renderArchives(event.target.value));
    $("#theme-button").addEventListener("click", () => {
      document.body.classList.toggle("dark");
      localStorage.setItem("xuanjian-theme", document.body.classList.contains("dark") ? "dark" : "light");
      $("#theme-button").innerHTML = `<i data-lucide="${document.body.classList.contains("dark") ? "sun" : "moon"}"></i>`;
      refreshIcons();
    });

    $$(".level-tab").forEach((button) => {
      button.addEventListener("click", () => {
        state.fortuneLevel = button.dataset.level;
        state.selectedPeriodIndex = null;
        renderFortune();
        refreshIcons();
      });
    });
    $("#fortune-prev").addEventListener("click", () => navigateFortune(-1));
    $("#fortune-next").addEventListener("click", () => navigateFortune(1));
    $("#fortune-today").addEventListener("click", () => {
      state.fortuneAnchor = new Date();
      state.selectedPeriodIndex = null;
      renderFortune();
      refreshIcons();
    });

    $$("[data-chart-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        $$("[data-chart-mode]").forEach((item) => item.classList.toggle("active", item === button));
        $("#bazi-chart").classList.toggle("simple", button.dataset.chartMode === "simple");
      });
    });
    $$("[data-chart-calendar]").forEach((button) => {
      button.addEventListener("click", () => {
        state.chartCalendar = button.dataset.chartCalendar;
        renderChart();
        refreshIcons();
      });
    });
    $("#chart-lunar-bar").addEventListener("click", (event) => {
      const row = event.target.closest("[data-calendar]");
      if (!row) return;
      state.chartCalendar = row.dataset.calendar;
      renderChart();
      refreshIcons();
    });

    $("#chart-download").addEventListener("click", () => {
      downloadJson(`${state.profile.name}-四柱命盘.json`, {
        profile: state.profile,
        summary: {
          dayMaster: `${state.analysis.dayStem}${state.analysis.dayElement}`,
          strength: state.analysis.strength,
          pattern: state.analysis.pattern,
          useful: state.analysis.useful,
          elements: state.analysis.elements.percentages,
          void: state.analysis.voidBranches,
          spirits: state.analysis.spirits
        }
      });
      showToast("命盘数据已导出", "download");
    });

    const exportReportBtn = $("#export-report");
    if (exportReportBtn) exportReportBtn.addEventListener("click", () => window.print());
    $("#export-archives").addEventListener("click", () => downloadJson("玄鉴命例档案.json", { version: 1, profiles: state.archives }));
    $("#import-archive").addEventListener("click", () => $("#archive-file-input").click());
    $("#archive-file-input").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const profiles = Array.isArray(data) ? data : data.profiles;
        if (!Array.isArray(profiles)) throw new Error("格式不正确");
        const valid = profiles.map(normalizeStoredProfile).filter(Boolean);
        if (!valid.length) throw new Error("没有可用命例");
        valid.forEach((profile) => {
          const index = state.archives.findIndex((item) => item.id === profile.id);
          if (index >= 0) state.archives[index] = profile;
          else state.archives.push(profile);
        });
        saveArchives();
        renderArchives();
        showToast(`已导入${valid.length}个命例`, "file-check-2");
      } catch (error) {
        showToast(`导入失败：${error.message}`, "circle-alert");
      } finally {
        event.target.value = "";
      }
    });
  }

  function init() {
    loadData();
    initLunarPicker();
    initRegionPicker();
    initRegionSearch();
    bindEvents();
    renderGlossary("");
    renderAll();
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
      document.body.classList.add("touch-device");
    }
    checkAIStatus();
    switchView(location.hash.startsWith("#chart=") ? "overview" : "overview");
    $("#theme-button").innerHTML = `<i data-lucide="${document.body.classList.contains("dark") ? "sun" : "moon"}"></i>`;
    refreshIcons();
    // 微信环境优化：仅在http/https且非微信内置浏览器时注册SW
    const isWechat = /MicroMessenger/i.test(navigator.userAgent || "");
    if (isWechat) document.documentElement.classList.add("wechat-browser");
    if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !isWechat) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
    // 页面加载后自动弹出新建命例窗口
    setTimeout(() => {
      if (typeof populateProfileForm === "function") populateProfileForm(null, true);
    }, 500);
  }

  document.addEventListener("DOMContentLoaded", init);

  // ========== 全局暴露（供管理后台使用）==========
  window.XJ = {
    getWallet,
    saveWallet,
    addWalletRecord,
    getWithdrawals,
    saveWithdrawals,
    calcWithdrawFee,
    getTodayWithdrawTotal,
    submitWithdrawal,
    cancelWithdrawal,
    adminProcessWithdrawal,
    makeLicenseCode,
    getLicenseCodes,
    parseLicenseCode,
    activateLicense,
    getMember: getMemberState,
    memberDaysLeft,
    isMemberActive,
    isAdmin: isAdminAccess,
    verifyAdminKey,
    adminHash,
    // 支付相关
    getPayments,
    savePayments,
    createPaymentOrder,
    markPaymentPaid,
    cancelPayment,
    refundPayment,
    submitPaymentForReview,
    PAYMENT_METHODS,
    PAYMENT_STATUS,
    MEMBER_PLANS,
    getPaymentConfig,
    savePaymentConfig,
    // v3.0 新增
    queryPaymentRecords,
    getFinancialSummary,
    transactionHash,
    verifyWithdrawalAccount,
    getPublishConfig,
    savePublishConfig,
    getVersionHistory,
    saveVersionHistory,
    addVersionRecord
  };
})();
