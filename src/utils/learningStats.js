const TOTAL_QUIZ_COUNT_KEY = 'leapTotalQuizCount'

/**
 * これまでに出題した累計語数を取得する。
 * 出題履歴とは別の値として保存するため、履歴を削除しても維持される。
 */
export function getTotalQuizCountFromLocalStorage() {
  try {
    const count = Number(localStorage.getItem(TOTAL_QUIZ_COUNT_KEY))
    return Number.isSafeInteger(count) && count >= 0 ? count : 0
  } catch (error) {
    console.error('累計語数の読み込みに失敗しました:', error)
    return 0
  }
}

/** 累計語数を保存する。 */
export function saveTotalQuizCountToLocalStorage(count) {
  try {
    const safeCount = Number.isSafeInteger(count) && count >= 0 ? count : 0
    localStorage.setItem(TOTAL_QUIZ_COUNT_KEY, safeCount.toString())
  } catch (error) {
    console.error('累計語数の保存に失敗しました:', error)
  }
}
