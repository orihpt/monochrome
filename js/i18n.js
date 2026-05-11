// js/i18n.js

const translations = {
    he: {
        // General
        'play': 'נגן',
        'shuffle_play': 'נגן בסדר אקראי',
        'start_radio': 'הפעל רדיו',
        'add_to_queue': 'הוסף לתור',
        'like': 'אהבתי',
        'mark_as_favorite': 'סמן כמעודף',
        'add_to_playlist': 'הוסף לפלייליסט',
        'copy_link': 'העתק קישור',
        
        // Placeholders / Empty States
        'no_artists_found': 'לא נמצאו אמנים',
        'no_albums_found': 'לא נמצאו אלבומים',
        'no_tracks_found': 'לא נמצאו שירים',
        'no_results_found': 'לא נמצאו תוצאות',
        'empty_library': 'הספרייה שלך ריקה עדיין',
        'scan_library': 'סרוק את הספרייה שלך כדי להתחיל',
        'error_loading_artists': 'שגיאה בטעינת אמנים',
        'error_loading_albums': 'שגיאה בטעינת אלבומים',
        'exact_match': 'התאמה מושלמת',
        'name_match': 'התאמה לפי שם',
        'no_match': 'לא נמצאה התאמה',
        'no_tracks': 'אין שירים',
        
        // Actions
        'search': 'חפש...',
        'cancel': 'ביטול',
        'save': 'שמירה',
        'import': 'ייבוא',
        'export': 'ייצוא',
        
        // Time
        'minutes_short': 'דק׳',
        'hours_and_minutes': '{hours} שעות ו-{minutes} דק׳',
    },
    en: {
        'play': 'Play',
        'shuffle_play': 'Shuffle play',
        'start_radio': 'Start radio',
        'add_to_queue': 'Add to queue',
        'like': 'Like',
        'mark_as_favorite': 'Mark as favorite',
        'add_to_playlist': 'Add to playlist',
        'copy_link': 'Copy link',
        
        'no_artists_found': 'No artists found',
        'no_albums_found': 'No albums found',
        'no_tracks_found': 'No tracks found',
        'no_results_found': 'No results found',
        'empty_library': 'Your library is empty',
        'scan_library': 'Scan your library to get started',
        'error_loading_artists': 'Error loading artists',
        'error_loading_albums': 'Error loading albums',
        'exact_match': 'Exact Match',
        'name_match': 'Name Match',
        'no_match': 'No Match',
        'no_tracks': 'No tracks',
        
        'search': 'Search...',
        'cancel': 'Cancel',
        'save': 'Save',
        'import': 'Import',
        'export': 'Export',
        
        'minutes_short': 'min',
        'hours_and_minutes': '{hours}h {minutes}m',
    }
};

let currentLanguage = document.documentElement.lang || 'he';

export const t = (key, params = {}) => {
    const lang = translations[currentLanguage] || translations['he'];
    let text = lang[key] || key;
    
    for (const [param, value] of Object.entries(params)) {
        text = text.replace(`{${param}}`, value);
    }
    
    return text;
};

export const setLanguage = (lang) => {
    if (translations[lang]) {
        currentLanguage = lang;
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    }
};

export const getLanguage = () => currentLanguage;
