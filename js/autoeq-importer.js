import { db } from './db.js';

const CACHE_KEY = 'autoeq_index_v2';
const FALLBACK_INDEX = [];

/**
 * Fetches the index of all headphones from jaakkopasanen/AutoEq
 * @returns {Promise<Array<{name: string, type: string, path: string}>>}
 */
export async function getAutoEqData() {
    return FALLBACK_INDEX;
}

/**
 * Fetches the raw frequency response for a specific entry
 * @param {object} entry
 * @returns {Promise<Array<{freq: number, gain: number}>>}
 */
export async function fetchHeadphoneData(entry) {
    return [];
}

export async function fetchAutoEqIndex() {
    return [];
}

export async function searchHeadphones(query) {
    return [];
}

export const POPULAR_HEADPHONES = [];
