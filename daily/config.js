const CONFIG = {
  // 🔑 必須保留這兩個，否則 Google 登入會失效
  GOOGLE_CLIENT_ID: "972558989435-armd41776e7ueo4d57ud3i4i9p27hdb7.apps.googleusercontent.com",
  GAS_URL: "https://script.google.com/macros/s/AKfycbzsRO60ArZr8jdhh7OqIva3416UajwiEXFUy3doRRhkNNo0kbnhGZdcg96xX1_bkQtg/exec",

  // 📊 各分頁的 Sheet ID 設定
  DAILY_SHEET_ID: '1RQAj3owFnsEn53UZ41EPUErIFJBywJvvW9BKMOUCquI',
  SECRET_KEY: "wfjlps.edu.hk_0716",
  MONTHLY_SHEET_ID: "1RQAj3owFnsEn53UZ41EPUErIFJBywJvvW9BKMOUCquI",
  

  // 各分頁的 GID
  GIDS: {
    DAILY_LOG: '0',
    IDEAS: '1821924181',                    
    MONTHLY: "1986460880",
    BIRTHDAYS: "1194139889",
    DAILY_RECURRING: "702099618" 
    
  },

  API_URLS: {
    DAILY: 'https://script.google.com/macros/s/AKfycbxS1fG-eaufphO6PH2KRpSSyf8Dx8sLjYBRn_u6P6AWM51Bp8-qaJVW-xmbeC5klbKI/exec',
    MONTHLY: 'https://script.google.com/macros/s/AKfycbxS1fG-eaufphO6PH2KRpSSyf8Dx8sLjYBRn_u6P6AWM51Bp8-qaJVW-xmbeC5klbKI/exec',
    DAILY_RECURRING: 'https://script.google.com/macros/s/AKfycbxS1fG-eaufphO6PH2KRpSSyf8Dx8sLjYBRn_u6P6AWM51Bp8-qaJVW-xmbeC5klbKI/exec'
  }
};
