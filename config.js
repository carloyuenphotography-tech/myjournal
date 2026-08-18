const CONFIG = {
  // 🔑 必須保留這兩個，否則 Google 登入會失效
  GOOGLE_CLIENT_ID: "972558989435-armd41776e7ueo4d57ud3i4i9p27hdb7.apps.googleusercontent.com",
  GAS_URL: "https://script.google.com/macros/s/AKfycbxkwB3tjRWDQV0ZBV87e2ExqBduxpSEibkbfkX01WASG-JOY3ycBB6vKUt9Mvm6NTQ/exec",

  // 📊 各分頁的 Sheet ID 設定
  MAIN_SHEET_ID: '1q3NLPoGG8qr33knDt6REdLM8-GVrarzSercPLrjKSbo',
  DAILY_SHEET_ID: '1RQAj3owFnsEn53UZ41EPUErIFJBywJvvW9BKMOUCquI',
  SECRET_KEY: "wfjlps.edu.hk_0716",
  IDEAS_SHEET_ID: '1Zgyq8EG-sbkVbQmi-YKYB0q2xOhfsEqL6MNtlqZ8f-0', 
  FT_SHEET_ID: "1ultOcsf8s4bFj7CrqyD_DlN4hOZ8ekK7ip4czQQl5Ms",
  MONTHLY_SHEET_ID: "1RQAj3owFnsEn53UZ41EPUErIFJBywJvvW9BKMOUCquI",
  PROJECTS_SHEET_ID: "1ultOcsf8s4bFj7CrqyD_DlN4hOZ8ekK7ip4czQQl5Ms", 

  // 各分頁的 GID
  GIDS: {
    DAILY_LOG: '0',
    IDEAS: '0',                    
    HABITS: '837132755',
    HABIT_LOGS: '1991677412',
    FT: "1351247680",
    MONTHLY: "1986460880",
    PROJECTS: "1071938293" 
  },

  API_URLS: {
    DAILY: 'https://script.google.com/macros/s/AKfycbzTPPb9pvb41mU2D-nz2e2wn3QeBU36t92YkW_24EX95dFwuMJjVRJKrjNJ5aTdFbbH/exec',
    IDEAS: 'https://script.google.com/macros/s/AKfycby2i-JNjupBPLaWuASqnUmezJRwUdQNBT2Gzsi27r1TW9kcdb-DaMwnsrYZqdv2VBhU/exec',
    HABIT: 'https://script.google.com/macros/s/AKfycbz72-QL780wO-NVLsszPusQN3WGqCCeb-vn0yZEI8I6dgGwFaawpJtbUATozrE631rE/exec',
    FT: 'https://script.google.com/macros/s/AKfycbwnpWBweDBZoEvHukGHitf0yq3ycBLfF_YpYTCsPhgz-H5snw9rfgEdgGIv7sbMETyVYA/exec',
    PROJECTS: 'https://script.google.com/macros/s/AKfycby2i-JNjupBPLaWuASqnUmezJRwUdQNBT2Gzsi27r1TW9kcdb-DaMwnsrYZqdv2VBhU/exec', 
    MONTHLY: 'https://script.google.com/macros/s/AKfycbzTPPb9pvb41mU2D-nz2e2wn3QeBU36t92YkW_24EX95dFwuMJjVRJKrjNJ5aTdFbbH/exec'
  }
};